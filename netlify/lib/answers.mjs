/* What a signed-in director reads on the staff page: the forms their Connect role lets them see,
 * how many answers each holds and whether those reached Connect, and the latest answers.
 *
 * Connect's Website Forms queue is where answers are worked on. This is the copy the site kept, so
 * a director can check that nothing is stuck on the way. Nothing records who looked.
 */

import { many } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { currentForm } from "./intake.mjs";
import { connectConfig } from "./connect.mjs";
import { definitionFor, deliveryCounts, ingestPayload } from "./deliver.mjs";
import { can } from "./staff.mjs";
import { answerColumns } from "../../src/shared/forms.mjs";

const LATEST = 50;
const NONE = { pending: 0, sent: 0, failed: 0, held: 0, cancelled: 0, lastError: null };

const formOrNull = (key) => currentForm(key).catch(() => null);

export async function formsFor(who) {
  const keys = new Set(Object.keys(serverContent().forms || {}));
  const counts = new Map();
  for (const r of await many("SELECT form_key, count(*)::int AS n, max(received_at) AS latest FROM submissions GROUP BY form_key")) {
    keys.add(r.form_key);
    counts.set(r.form_key, r);
  }
  const delivery = await deliveryCounts();
  const forms = [];
  for (const key of [...keys].sort()) {
    if (!can(who, `forms.read:${key}`)) continue;
    const f = await formOrNull(key);
    const c = counts.get(key);
    forms.push({
      key, title: f?.def.title || key, state: f?.state || "closed",
      total: c?.n || 0, latest: c ? new Date(c.latest).toISOString() : null,
      delivery: delivery[key] || NONE,
    });
  }
  return { connect: !!connectConfig(), forms };
}

/* The newest answers to one form, each as the words the person chose, with whether it has reached
   Connect. Columns follow the form as it is now; an answer to a question since retired keeps a
   column of its own at the end. A confidential answer (an applicant's work study, their other
   commitments) is not shown here at all: it goes to Connect, whose permissions decide who reads it. */
export async function latestAnswers(key) {
  const f = await formOrNull(key);
  const rows = await many(
    `SELECT s.id, s.ref, s.form_key, s.form_version, s.answers, s.anonymous, s.received_at, o.state AS delivery
       FROM submissions s LEFT JOIN outbox o ON o.submission_id = s.id AND o.kind = 'connect.ingest'
      WHERE s.form_key = $1 ORDER BY s.received_at DESC, s.id DESC LIMIT $2`, [key, LATEST]);
  if (!f && !rows.length) return null;
  const total = (await many("SELECT count(*)::int AS n FROM submissions WHERE form_key = $1", [key]))[0].n;
  const secret = new Set(f ? answerColumns(f.def).filter((c) => c.confidential).map((c) => c.id) : []);
  const columns = f ? answerColumns(f.def).filter((c) => !secret.has(c.id)).map((c) => ({ id: c.id, label: c.label })) : [];
  const known = new Set(columns.map((c) => c.id));
  const defs = new Map();
  const items = [];
  for (const r of rows) {
    if (!defs.has(r.form_version)) defs.set(r.form_version, (await definitionFor(key, r.form_version)) || f?.def || null);
    const def = defs.get(r.form_version);
    if (def) for (const c of answerColumns(def)) if (c.confidential) secret.add(c.id);
    const answers = def ? ingestPayload(r, def).answers : r.answers;
    const words = {};
    for (const [id, v] of Object.entries(answers || {})) {
      if (secret.has(id)) continue;
      words[id] = Array.isArray(v) ? v.join(", ") : String(v);
      if (!known.has(id)) {
        known.add(id);
        columns.push({ id, label: def ? answerColumns(def).find((c) => c.id === id)?.label || id : id });
      }
    }
    items.push({ ref: r.ref, receivedAt: new Date(r.received_at).toISOString(), anonymous: !!r.anonymous, delivery: r.delivery || "pending", answers: words });
  }
  return { key, title: f?.def.title || key, total, columns, items };
}
