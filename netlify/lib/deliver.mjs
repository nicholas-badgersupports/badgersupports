/* Carrying submissions onward: the outbox (migration 001), row by row.
 *
 *   connect.ingest  the submission into Connect's Website Forms
 *   mail.receipt    a receipt to the person who wrote, through Connect's mail path (PROPOSED: Connect's
 *                   publicReceipt action is an Exchange request), only once the owner sets a verified sender
 *   mail.notify     a notice to the team that owns the form, through the same mail path (PROPOSED:
 *                   Connect's publicNotify action; Connect addresses it — this site holds no team
 *                   address), only once the owner sets a verified sender
 *   sheets.backup   a row in the directors' backup workbook (backup.mjs), only once it is set up
 *
 * A submission is saved here first, in one transaction with its outbox rows (intake.mjs); only then does
 * anything leave this site. Each new submission wakes the outbox once, after its reply is on its way;
 * Try again on the staff page sends the reader's own forms; and runOutbox(), below, is what a scheduled
 * function calls (registering that schedule is an owner action, docs/COMMUNICATIONS.md).
 *
 * A worker claims its rows in one statement (claim_until, claim_token: migration 006), skipping any another
 * worker holds, so two instances never send one row at once. A row that fails waits longer each time — two
 * minutes, four, eight, then every fifteen — so with a run every fifteen minutes a due retry happens within
 * thirty. A send whose outcome is unknown (no answer) is sent again later with the same dedupe key, which
 * Connect keeps once: it is never stored or mailed twice.
 *
 * Trying on its own ends at MAX_ATTEMPTS failures (the ceiling SPILL's mail queue settled on): the row
 * parks in 'stuck' (migration 011), out of the claim and out of the count of rows still being tried, and
 * keeps its last error so the staff page can say why it stopped. Nothing wakes the schedule for a stuck
 * row. A person can still send it: Try again on the staff page is a forced run, and a forced run claims
 * stuck rows with the rest — if it fails again it parks again, one attempt the wiser.
 *
 * With Connect not set up (connect.mjs), nothing is sent and every row stays pending: a submission is never
 * lost for want of a connection.
 */

import crypto from "node:crypto";
import { q, many, one, tx } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { connectConfig, deliverForm, call, DELIVERY_BUDGET_MS } from "./connect.mjs";
import { noteGet, noteSet } from "./published.mjs";
import { backupConfig, writeBackup } from "./backup.mjs";
import { answerColumns, answerWords, questionById, rankOrder, OTHER, QUESTION_TYPES, hiringContext } from "../../src/shared/forms.mjs";

export const MAX_WAIT_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
export const CLAIM_SECONDS = 120;
let inflight = Promise.resolve();

/* The definition a submission was checked against: the published version it names, or the
   shipped file when that is the same version. */
export async function definitionFor(key, version) {
  const row = (await many("SELECT definition FROM form_versions WHERE form_key = $1 AND version = $2", [key, version]))[0];
  if (row) return row.definition;
  const shipped = serverContent().forms[key];
  return shipped?.version === Number(version) ? shipped : null;
}

/* What Connect stores: every column the form can have, and each answer as the words the person
   chose rather than option ids (answerWords: a ranking reads "1. Programs", a file its name and
   size). Anonymous forms carry nothing that was not asked. A form with files also lists them —
   question, id, name, type, size and digest, never the bytes — so Connect knows what to collect;
   a column that is confidential says so. An answer chosen from options also comes as its option
   ids (a ranking first choice first), because labels can be edited and ids cannot: Connect maps
   by those, and shows the words. */
export function ingestPayload(sub, def) {
  const columns = answerColumns(def).map((c) => ({ id: c.id, label: c.label, ...(c.confidential ? { confidential: true } : {}) }));
  const answers = {};
  const files = [];
  const optionIds = {};
  for (const [id, v] of Object.entries(sub.answers || {})) {
    const q = id.endsWith(OTHER) ? null : questionById(def, id);
    answers[id] = answerWords(q, v);
    if (q && QUESTION_TYPES[q.type]?.options && v != null) optionIds[id] = q.type === "rank" ? rankOrder(q, v) : v;
    if (q?.type === "resource" && v) optionIds[id] = v;
    if (q?.type !== "file") continue;
    for (const f of Array.isArray(v) ? v : []) {
      if (f && typeof f === "object") files.push({ question: id, fileId: f.fileId, name: f.name, type: f.type, bytes: f.bytes, sha256: f.sha256 });
    }
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
    ...(sub.form_key === "recommendation-letter" && sub.context && Object.hasOwn(sub.context, "hiringCycleId") ? { context: hiringContext(sub.form_key, { _cycle: sub.context.hiringCycleId }) } : {}),
    ...(Array.isArray(sub.context?.agreements) && sub.context.agreements.length ? { agreements: sub.context.agreements } : {}),
    ...(Object.keys(optionIds).length ? { optionIds } : {}),
    ...(files.length ? { files } : {}),
  };
}

/* Take up to `limit` due rows of one kind for this worker: one statement, skipping rows another worker holds
   (FOR UPDATE SKIP LOCKED) or claimed in the last CLAIM_SECONDS. force takes failed rows before their wait is
   over, and stuck rows at all (Try again is a person deciding to try once more); forms limits it to those
   form keys. Returns the rows with their submissions. */
async function claim(kind, { limit, force = false, forms = null }) {
  const token = crypto.randomBytes(12).toString("base64url");
  const ids = await many(
    `UPDATE outbox SET claim_until = now() + ($5::int * interval '1 second'), claim_token = $4
      WHERE id IN (
        SELECT o.id FROM outbox o JOIN submissions s ON s.id = o.submission_id
         WHERE o.kind = $1 AND (o.state IN ('pending', 'failed') OR ($2::boolean AND o.state = 'stuck')) AND ($2::boolean OR o.next_at <= now())
           AND (o.claim_until IS NULL OR o.claim_until < now())
           AND ($3::jsonb IS NULL OR s.form_key IN (SELECT jsonb_array_elements_text($3::jsonb)))
         ORDER BY o.next_at, o.id LIMIT $6 FOR UPDATE SKIP LOCKED)
      RETURNING id`, [kind, !!force, forms ? JSON.stringify(forms) : null, token, CLAIM_SECONDS, limit]);
  if (!ids.length) return { token, rows: [] };
  const rows = await many(
    `SELECT o.id AS outbox_id, o.attempts, o.dedupe_key, s.id, s.ref, s.form_key, s.form_version, s.answers, s.anonymous, s.received_at, s.context
       FROM outbox o JOIN submissions s ON s.id = o.submission_id WHERE o.id = ANY($1::bigint[]) ORDER BY o.next_at, o.id`,
    [ids.map((r) => r.id)]);
  return { token, rows };
}

/* A row done, or failed and waiting longer; only while this worker still holds it. */
async function sent(row, token, detail, files = []) {
  return tx(async t => {
    const held = await t.one("UPDATE outbox SET state = 'sent', sent_at = now(), last_error = NULL, claim_until = NULL, claim_token = NULL WHERE id = $1 AND claim_token = $2 RETURNING id", [row.outbox_id, token]);
    if (!held) return false;
    if (files.length) await t.query("UPDATE uploads SET delivered_at = coalesce(delivered_at, now()) WHERE submission_id = $1 AND file_id = ANY($2::text[])", [row.id, files]);
    await t.query("INSERT INTO submission_events (submission_id, actor, kind, detail) VALUES ($1, 'system', 'delivered', $2::jsonb)", [row.id, JSON.stringify(detail)]);
    return true;
  });
}
/* A row failed: it waits longer and tries again — unless this failure reaches MAX_ATTEMPTS, when the
   row parks in 'stuck' in the same statement that counts the attempt, and only a forced run claims
   it again. The last error is kept either way, so the staff page can say why it stopped. */
async function failed(row, token, e) {
  const wait = Math.min(2 ** (row.attempts + 1), MAX_WAIT_MINUTES);
  await q(`UPDATE outbox SET state = CASE WHEN attempts + 1 >= $5 THEN 'stuck' ELSE 'failed' END, attempts = attempts + 1, last_error = $3, claim_until = NULL, claim_token = NULL,
           next_at = now() + ($4::int * interval '1 minute') WHERE id = $1 AND claim_token = $2`,
    [row.outbox_id, token, String(e?.code || "send.failed").slice(0, 60), wait, MAX_ATTEMPTS]);
}

async function ingest(cfg, opts) {
  const deadline = Date.now() + DELIVERY_BUDGET_MS;
  const { token, rows } = await claim("connect.ingest", opts);
  let n = 0, bad = 0;
  for (const row of rows) {
    if (Date.now() >= deadline) break;
    try {
      const def = await definitionFor(row.form_key, row.form_version);
      if (!def) throw Object.assign(new Error("no definition"), { code: "form.unknown" });
      const payload = ingestPayload(row, def);
      const uploads = await many("SELECT file_id, question, name, type, bytes, sha256, data FROM uploads WHERE submission_id = $1", [row.id]);
      const files = payload.files || [];
      if (uploads.length !== files.length || uploads.some(u => !files.some(f =>
        f.fileId === u.file_id && f.question === u.question && f.name === u.name &&
        f.type === u.type && f.bytes === u.bytes && f.sha256 === u.sha256))) {
        throw Object.assign(new Error("Attached files do not match the saved form."), { code: "file.changed" });
      }
      const data = new Map(uploads.map(u => [u.file_id, u.data]));
      const result = await deliverForm(cfg, payload, { readFile: id => data.get(id), deadline });
      if (await sent(row, token, { to: "connect", files: result.files.length }, result.files)) n++;
    } catch (e) {
      // Connect refuses an agreement to a document published again after Send. The row waits, named, for a director:
      // it is never resent as agreeing to words the person did not see.
      await failed(row, token, e?.reply?.outOfDate === true ? { code: "agreement.out-of-date" } : e); bad++;
    }
  }
  // Work not started within this invocation's budget remains due for the next run.
  await q("UPDATE outbox SET claim_until = NULL, claim_token = NULL WHERE claim_token = $1", [token]);
  return { sent: n, failed: bad };
}

/* The sender the owner verified, or null: receipts stay held until it is set (RECEIPT_SENDER). */
export const receiptSender = (env = process.env) => (/^[^@\s]+@badgersupports\.org$/.test(env.RECEIPT_SENDER || "") ? env.RECEIPT_SENDER : null);

/* Receipts, once a sender is verified: the held rows are released, then each is handed to Connect's mail path
   with its dedupe key (PROPOSED: Connect's publicReceipt). Never for an anonymous form, whatever its row says. */
async function receipts(cfg, opts) {
  const sender = receiptSender();
  if (!sender) return { sent: 0, failed: 0, configured: false };
  await q("UPDATE outbox SET state = 'pending', hold_reason = NULL WHERE kind = 'mail.receipt' AND state = 'held' AND hold_reason = 'sender-unverified'");
  const { token, rows } = await claim("mail.receipt", opts);
  let n = 0, bad = 0;
  for (const row of rows) {
    if (row.anonymous || !row.answers?.email) {
      await q("UPDATE outbox SET state = 'cancelled', claim_until = NULL, claim_token = NULL WHERE id = $1 AND claim_token = $2", [row.outbox_id, token]);
      continue;
    }
    try {
      await call(cfg, { action: "publicReceipt", dedupeKey: row.dedupe_key, ref: row.ref, form: row.form_key, template: `public.${row.form_key}.receipt`, to: row.answers.email, sender });
      await sent(row, token, { to: "receipt" });
      n++;
    } catch (e) { await failed(row, token, e); bad++; }
  }
  return { sent: n, failed: bad, configured: true };
}

/* Notices to the owning team, once a sender is verified: the held rows are released, then each is
   handed to Connect's mail path with its dedupe key (PROPOSED: Connect's publicNotify). The site
   names no recipient: Connect addresses the notice to the team that owns the form's queue. */
async function notifies(cfg, opts) {
  const sender = receiptSender();
  if (!sender) return { sent: 0, failed: 0, configured: false };
  await q("UPDATE outbox SET state = 'pending', hold_reason = NULL WHERE kind = 'mail.notify' AND state = 'held' AND hold_reason = 'sender-unverified'");
  const { token, rows } = await claim("mail.notify", opts);
  let n = 0, bad = 0;
  for (const row of rows) {
    try {
      await call(cfg, { action: "publicNotify", dedupeKey: row.dedupe_key, ref: row.ref, form: row.form_key, template: `public.${row.form_key}.notify`, sender });
      await sent(row, token, { to: "notify" });
      n++;
    } catch (e) { await failed(row, token, e); bad++; }
  }
  return { sent: n, failed: bad, configured: true };
}

/* Backup rows, once the workbook is set up (backup.mjs): written together, each kept once by its reference. */
async function backups(opts) {
  const b = backupConfig();
  if (!b) return { sent: 0, failed: 0, configured: false };
  const { token, rows } = await claim("sheets.backup", opts);
  if (!rows.length) return { sent: 0, failed: 0, configured: true };
  try {
    const written = await writeBackup(b, rows);
    let n = 0;
    for (const row of rows) if (written.has(row.ref)) { await sent(row, token, { to: "backup" }); n++; } else await failed(row, token, { code: "backup.missing" });
    return { sent: n, failed: rows.length - n, configured: true };
  } catch (e) {
    for (const row of rows) await failed(row, token, e);
    return { sent: 0, failed: rows.length, configured: true };
  }
}

/* When the outbox next has work it can do, written where a scheduled run reads it without the database
   (published.mjs, noteSet). Kinds not set up here are left out, so a row that cannot be sent never keeps
   the database awake. */
const activeKinds = () => [connectConfig() && "connect.ingest", connectConfig() && receiptSender() && "mail.receipt", connectConfig() && receiptSender() && "mail.notify", backupConfig() && "sheets.backup"].filter(Boolean);
async function noteNextDue() {
  const kinds = activeKinds();
  const r = kinds.length ? await one("SELECT min(greatest(next_at, coalesce(claim_until, next_at))) AS at FROM outbox WHERE state IN ('pending', 'failed', 'held') AND kind = ANY($1::text[])", [kinds]) : null;
  await noteSet("outbox-next", { at: r?.at ? new Date(r.at).toISOString() : null, kinds }).catch(() => {});
}

/* Send whatever is due to Connect. force sends failed rows now, without waiting out their back-off. forms,
   when given, is the list of form keys to send and nothing else; null means every form. */
async function run({ limit, force, forms }) {
  const cfg = connectConfig();
  if (!cfg) return { sent: 0, failed: 0, configured: false };
  if (forms && !forms.length) return { sent: 0, failed: 0, configured: true };
  // An explicit permitted retry also repairs legacy rows marked sent before their PDFs arrived.
  if (force) await q(`UPDATE outbox o SET state = 'pending', sent_at = NULL, next_at = now()
    WHERE o.kind = 'connect.ingest' AND o.state = 'sent'
      AND (o.claim_until IS NULL OR o.claim_until < now())
      AND EXISTS (SELECT 1 FROM uploads u WHERE u.submission_id = o.submission_id AND u.delivered_at IS NULL)
      AND ($1::jsonb IS NULL OR o.submission_id IN (SELECT id FROM submissions WHERE form_key IN (SELECT jsonb_array_elements_text($1::jsonb))))`,
    [forms ? JSON.stringify(forms) : null]);
  const r = await ingest(cfg, { limit, force, forms });
  await noteNextDue();
  return { ...r, configured: true };
}

/* One delivery run at a time in this process: a second caller waits for the first. Another instance may run
   at the same moment; claim() keeps them off each other's rows. */
export function deliverDue({ limit = 5, force = false, forms = null } = {}) {
  const next = inflight.then(() => run({ limit, force, forms }));
  inflight = next.catch(() => {});
  return next;
}

/* Tests run two workers at once, as two instances would, without this process's queue. */
export const deliverOnce = (opts = {}) => run({ limit: 5, force: false, forms: null, ...opts });

/* What a scheduled function calls. It reads when work is next due without the database, and returns at once
   when nothing is (or nothing can be sent); otherwise it sends every kind that is set up, then notes when
   work is next due. A note it cannot read counts as work due, so a fault never stops delivery. */
export async function runOutbox({ now = Date.now(), limit = 20 } = {}) {
  let note;
  try { note = await noteGet("outbox-next"); } catch { note = undefined; }
  // the note holds only while the same kinds are set up: a sender or a workbook switched on since wakes it
  const same = note && JSON.stringify(note.kinds || []) === JSON.stringify(activeKinds());
  if (same && (note.at === null || Date.parse(note.at) > now)) return { woke: false };
  const cfg = connectConfig();
  const out = { woke: true, ingest: cfg ? await ingest(cfg, { limit }) : { configured: false }, receipts: cfg ? await receipts(cfg, { limit }) : { configured: false }, notifies: cfg ? await notifies(cfg, { limit }) : { configured: false }, backup: await backups({ limit: 200 }) };
  await noteNextDue();
  return out;
}

/* Tests wait for the run a submission kicked off. */
export const deliveriesSettled = () => inflight;

/* Per form: how many rows are waiting, sent, failing and parked (stuck). */
export async function deliveryCounts() {
  const rows = await many(
    `SELECT s.form_key, CASE WHEN o.state = 'sent' AND EXISTS
       (SELECT 1 FROM uploads u WHERE u.submission_id = s.id AND u.delivered_at IS NULL)
       THEN 'pending' ELSE o.state END AS state, count(*)::int AS n, max(o.last_error) AS last_error
       FROM outbox o JOIN submissions s ON s.id = o.submission_id
      WHERE o.kind = 'connect.ingest' GROUP BY s.form_key, 2`);
  const out = {};
  for (const r of rows) {
    const f = (out[r.form_key] ||= { pending: 0, sent: 0, failed: 0, held: 0, cancelled: 0, stuck: 0, lastError: null });
    f[r.state] = r.n;
    if (r.state === "failed") f.lastError = r.last_error;
  }
  return out;
}
