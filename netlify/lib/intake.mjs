/* Form intake: what state a form is in, and accepting one submission.
 *
 * The server decides everything a browser might have got wrong or stale: whether the form is
 * open, which version is current, which questions were visible, and whether each answer is
 * acceptable (the same rules the browser ran, from src/shared/forms.mjs). A submission and all
 * the work it causes — hand-off to Connect, the Sheets backup, a receipt, claiming its uploaded
 * files (files.mjs) — are written in one transaction, so none of it can be half-done.
 */

import crypto from "node:crypto";
import { one, tx } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { HttpError } from "./http.mjs";
import { fileRecords, claimFiles } from "./files.mjs";
import { definitionFor } from "./deliver.mjs";
import { definitionProblems, readRaw, validateAnswers, canonicalJSON, allQuestions, answerWords, KEY_RE, OTHER } from "../../src/shared/forms.mjs";
import { chicagoDate } from "../../src/render/context.mjs";

const REF_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const IDEM_RE = /^[A-Za-z0-9-]{8,64}$/;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

/* The form as it stands: the newest definition (published from Connect, or the shipped file if
   that is newer), then its switch. A form switched open that has no questions stays closed —
   an application cannot open by accident before it has been written. */
export async function currentForm(key) {
  if (!KEY_RE.test(String(key))) return null;
  const shipped = serverContent().forms[key] || null;
  const published = await one("SELECT definition FROM form_versions WHERE form_key = $1 ORDER BY version DESC LIMIT 1", [key]);
  let def = shipped;
  if (published && (!shipped || published.definition.version > shipped.version)) def = published.definition;
  if (!def) return null;
  if (definitionProblems({ ...def, state: "closed" }).length) throw new HttpError(503, "form.broken");
  const sw = await one("SELECT state, closed_message FROM form_state WHERE form_key = $1", [key]);
  let state = sw ? sw.state : def.state;
  if (state === "open" && allQuestions(def).length === 0) state = "closed";
  return { def, state, closedMessage: (sw && sw.closed_message) || def.closedMessage };
}

function newRef(def) {
  const prefix = (def.refPrefix || def.key.split("-").map((w) => w[0]).join("")).toUpperCase().slice(0, 3);
  const bytes = crypto.randomBytes(8);
  const body = [...bytes].map((b) => REF_ALPHABET[b % 32]).join("");
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4)}`;
}

const field = (input, k) => (typeof input?.get === "function" ? input.get(k) : input?.[k]);

/* The person's answers as label/value rows, for a page that has to give them back. A file is
   left out: it is still on their own device, and its id would mean nothing to them. */
export function answersForPerson(def, raw) {
  const rows = [];
  for (const { q } of allQuestions(def)) {
    if (q.type === "file") continue;
    let v = raw[q.id];
    if (q.type === "rank" || q.type === "links") v = v == null ? [] : answerWords(q, v).filter(Boolean);
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    const label = (id) => (id === OTHER ? raw[`${q.id}${OTHER}`] || "" : (q.options || []).find((o) => o.id === id)?.label || id);
    if (q.type === "rank" || q.type === "links") v = v.join(", ");
    else v = Array.isArray(v) ? v.map(label).join(", ") : q.options ? label(v) : String(v);
    rows.push({ label: q.label, value: v });
  }
  return rows;
}

/* What someone typed for questions the form no longer asks, read with the version their page had,
   so a reply that puts the new form in front of them can show it instead of losing it. Nothing
   here is stored or sent; a question renamed by its id counts as gone, which is why ids stay. */
async function leftBehind(def, versionSeen, input) {
  if (!versionSeen || versionSeen === def.version) return [];
  const seen = await definitionFor(def.key, versionSeen).catch(() => null);
  if (!seen || seen.version !== versionSeen) return [];
  const still = new Set(allQuestions(def).map(({ q }) => q.id));
  const gone = { ...seen, sections: seen.sections.map((s) => ({ ...s, questions: s.questions.filter((q) => !still.has(q.id)) })) };
  return answersForPerson(gone, readRaw(gone, input));
}

/* One submission. Returns one of
     { ok: true, ref, def, duplicate }               accepted (or the same one again)
     { ok: false, error: "form.closed", ... }        switched off, or closed while the tab was open
     { ok: false, error: "answers.invalid", ... }    with errors by question id, and `gone`: answers
                                                     to questions dropped since the page loaded
   Throws HttpError for an unknown form. */
export async function submit(key, input, { now = new Date() } = {}) {
  const form = await currentForm(key);
  if (!form) throw new HttpError(404, "form.unknown");
  const { def } = form;
  const raw = readRaw(def, input);
  if (form.state !== "open") return { ok: false, error: "form.closed", closedMessage: form.closedMessage, def, raw };

  // The trap field: only automated spam fills it. It is told it succeeded and nothing is kept.
  if (String(field(input, "_website") || "").trim()) return { ok: true, ref: newRef(def), def, trapped: true };

  const versionSeen = Number(field(input, "_version")) || null;
  const check = validateAnswers(def, raw);
  if (!check.ok) return { ok: false, error: "answers.invalid", errors: check.errors, version: def.version, versionSeen, def, raw, gone: await leftBehind(def, versionSeen, input) };

  // The browser sends one key per filled-in form. Without JavaScript there is none, so the key
  // is the answers themselves for the day: pressing Send twice, or reloading the reply, is one
  // submission either way.
  let idem = String(field(input, "_key") || "").trim();
  if (!IDEM_RE.test(idem)) idem = `d-${sha256(`${def.key}|${def.version}|${canonicalJSON(check.answers)}|${chicagoDate(now)}`).slice(0, 40)}`;

  return tx(async (t) => {
    const existing = await t.one("SELECT ref FROM submissions WHERE form_key = $1 AND idem_key = $2", [def.key, idem]);
    if (existing) return { ok: true, ref: existing.ref, def, duplicate: true };
    // Each file's id becomes its record, and an upload that is gone is said on its question. The
    // id is cleared from what is given back, so the page asks for the file again.
    const files = await fileRecords(t, def, check.answers);
    if (files.errors) {
      const back = { ...raw };
      for (const id of Object.keys(files.errors)) back[id] = [];
      return { ok: false, error: "answers.invalid", errors: files.errors, version: def.version, versionSeen, def, raw: back, gone: await leftBehind(def, versionSeen, input) };
    }
    let row = null;
    for (let attempt = 0; !row && attempt < 5; attempt++) {
      row = await t.one(
        `INSERT INTO submissions (ref, form_key, form_version, version_seen, idem_key, answers, anonymous)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         ON CONFLICT (ref) DO NOTHING RETURNING id, ref`,
        [newRef(def), def.key, def.version, versionSeen, idem, JSON.stringify(files.answers), !!def.anonymous]);
    }
    if (!row) throw new Error("could not mint a unique reference");
    await claimFiles(t, row.id, files.ids);
    await t.query("INSERT INTO submission_events (submission_id, actor, kind, detail) VALUES ($1, 'public', 'received', $2::jsonb)",
      [row.id, JSON.stringify({ version: def.version, versionSeen })]);
    const outbox = (kind, state = "pending", hold = null) => t.query(
      "INSERT INTO outbox (kind, submission_id, dedupe_key, state, hold_reason) VALUES ($1, $2, $3, $4, $5)",
      [kind, row.id, `${kind}:${row.ref}`, state, hold]);
    await outbox("connect.ingest");
    await outbox("sheets.backup");
    // A receipt only where the form's workflow has it switched on ("proposed" is not on), and
    // even then it waits for a person: the sender address is not verified (docs/COMMUNICATIONS.md).
    if (!def.anonymous && def.workflow?.receipt === "on" && check.answers.email) await outbox("mail.receipt", "held", "sender-unverified");
    return { ok: true, ref: row.ref, def, duplicate: false };
  });
}
