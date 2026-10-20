/* Carrying submissions to Connect: the connect.ingest rows of the outbox (migration 001).
 *
 * A submission is saved here first, in one transaction with its outbox rows (intake.mjs); only
 * then does anything leave this site. There is no scheduled job: each new submission wakes the
 * outbox once, after its reply is on its way, and so does a director opening the staff page or
 * pressing Try again. A row that fails waits longer each time (two minutes, four, eight … at most
 * six hours). Connect keeps one copy per ref, so a row sent twice is stored once.
 *
 * With Connect not set up (connect.mjs), nothing is sent and every row stays pending: a
 * submission is never lost for want of a connection.
 */

import { q, many } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { connectConfig, deliverForm } from "./connect.mjs";
import { answerColumns, questionById, optionLabel, OTHER } from "../../src/shared/forms.mjs";

const MAX_WAIT_MINUTES = 6 * 60;
let inflight = Promise.resolve();

/* The definition a submission was checked against: the published version it names, or the
   shipped file when that is the same version. */
export async function definitionFor(key, version) {
  const row = (await many("SELECT definition FROM form_versions WHERE form_key = $1 AND version = $2", [key, version]))[0];
  if (row) return row.definition;
  const shipped = serverContent().forms[key];
  return shipped || null;
}

/* What Connect stores: every column the form can have, and each answer as the words the person
   chose rather than option ids. Anonymous forms carry nothing that was not asked. */
export function ingestPayload(sub, def) {
  const columns = answerColumns(def).map((c) => ({ id: c.id, label: c.label }));
  const answers = {};
  for (const [id, v] of Object.entries(sub.answers || {})) {
    const q = id.endsWith(OTHER) ? null : questionById(def, id);
    if (Array.isArray(v)) answers[id] = v.map((x) => optionLabel(q, x));
    else if (q && (q.options || []).length) answers[id] = optionLabel(q, v);
    else answers[id] = v;
  }
  return {
    ref: sub.ref,
    form: sub.form_key,
    formTitle: def.title,
    version: sub.form_version,
    receivedAt: new Date(sub.received_at).toISOString(),
    anonymous: !!sub.anonymous,
    columns,
    answers,
  };
}

async function deliverOne(cfg, row) {
  try {
    const def = await definitionFor(row.form_key, row.form_version);
    if (!def) throw Object.assign(new Error("no definition"), { code: "form.unknown" });
    await deliverForm(cfg, ingestPayload(row, def));
    await q("UPDATE outbox SET state = 'sent', sent_at = now(), last_error = NULL WHERE id = $1", [row.outbox_id]);
    await q("INSERT INTO submission_events (submission_id, actor, kind, detail) VALUES ($1, 'system', 'delivered', $2::jsonb)",
      [row.id, JSON.stringify({ to: "connect" })]);
    return true;
  } catch (e) {
    const wait = Math.min(2 ** (row.attempts + 1), MAX_WAIT_MINUTES);
    await q(`UPDATE outbox SET state = 'failed', attempts = attempts + 1, last_error = $2,
             next_at = now() + ($3::int * interval '1 minute') WHERE id = $1`,
      [row.outbox_id, String(e?.code || "send.failed").slice(0, 60), wait]);
    return false;
  }
}

/* Send whatever is due. force sends failed rows now, without waiting out their back-off. */
async function run({ limit, force }) {
  const cfg = connectConfig();
  if (!cfg) return { sent: 0, failed: 0, configured: false };
  const rows = await many(
    `SELECT o.id AS outbox_id, o.attempts, s.id, s.ref, s.form_key, s.form_version, s.answers, s.anonymous, s.received_at
       FROM outbox o JOIN submissions s ON s.id = o.submission_id
      WHERE o.kind = 'connect.ingest' AND o.state IN ('pending', 'failed') AND ($2::boolean OR o.next_at <= now())
      ORDER BY o.next_at, o.id LIMIT $1`, [limit, !!force]);
  let sent = 0, failed = 0;
  for (const row of rows) (await deliverOne(cfg, row)) ? sent++ : failed++;
  return { sent, failed, configured: true };
}

/* One delivery run at a time in this process: a second caller waits for the first. */
export function deliverDue({ limit = 5, force = false } = {}) {
  const next = inflight.then(() => run({ limit, force }));
  inflight = next.catch(() => {});
  return next;
}

/* Tests wait for the run a submission kicked off. */
export const deliveriesSettled = () => inflight;

/* Per form: how many rows are waiting, sent and failing. */
export async function deliveryCounts() {
  const rows = await many(
    `SELECT s.form_key, o.state, count(*)::int AS n, max(o.last_error) AS last_error
       FROM outbox o JOIN submissions s ON s.id = o.submission_id
      WHERE o.kind = 'connect.ingest' GROUP BY s.form_key, o.state`);
  const out = {};
  for (const r of rows) {
    const f = (out[r.form_key] ||= { pending: 0, sent: 0, failed: 0, held: 0, cancelled: 0, lastError: null });
    f[r.state] = r.n;
    if (r.state === "failed") f.lastError = r.last_error;
  }
  return out;
}
