/* Form intake: what state a form is in, and accepting one submission.
 *
 * The server decides everything a browser might have got wrong or stale: whether the form is
 * open, which version is current, which questions were visible, and whether each answer is
 * acceptable (the same rules the browser ran, from src/shared/forms.mjs). A submission and all
 * the work it causes — hand-off to Connect, the Sheets backup, a receipt, claiming its uploaded
 * files (files.mjs) — are written in one transaction, so none of it can be half-done.
 */

import crypto from "node:crypto";
import { q, one, tx } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { HttpError } from "./http.mjs";
import { fileRecords, claimFiles } from "./files.mjs";
import { definitionFor } from "./deliver.mjs";
import { definitionProblems, readRaw, validateAnswers, canonicalJSON, allQuestions, answerWords, KEY_RE, OTHER, withResources, hiringContext, AGREE_VALUE_RE } from "../../src/shared/forms.mjs";
import { sharedNow } from "./live-content.mjs";
import { chicagoDate } from "../../src/render/context.mjs";
import { readFormSettings, effectiveForm } from "./form-settings.mjs";
import { wordedForm } from "./form-wording.mjs";
import { legalNow } from "./legal.mjs";

const REF_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const IDEM_RE = /^[A-Za-z0-9-]{8,64}$/;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

/* The form as it stands: the newest definition (published from Connect, or the shipped file if
   that is newer), its words as changed in Connect (form-wording.mjs), then its switch. A form switched open that has no questions stays closed —
   an application cannot open by accident before it has been written. Once a switch row exists the
   launch build's link to the Google Form (`elsewhere`) is dropped: a form a director closed is
   closed, with its own message. The pages draw forms from this too (pages.mjs). */
export async function currentForm(key, { now = Date.now() } = {}) {
  if (!KEY_RE.test(String(key))) return null;
  const shipped = serverContent().forms[key] || null;
  const published = await one("SELECT definition FROM form_versions WHERE form_key = $1 ORDER BY version DESC LIMIT 1", [key]);
  let def = shipped;
  if (published && (!shipped || published.definition.version > shipped.version)) def = published.definition;
  if (!def) return null;
  // Connect's changed words, before the site's own form settings, which still win for title, introduction and closing.
  def = await wordedForm(def, { now });
  if (allQuestions(def).some(({ q }) => q.type === "agree")) def = withAgreements(def, await legalNow({ now: Number(now) }));
  if (Array.isArray(def.sections) && def.sections.some(s => Array.isArray(s.questions) && s.questions.some(q => q.type === "resource"))) {
    const live = await sharedNow(serverContent().render, { kinds: ["resources"] });
    if (live?.resources) def = withResources(def, live.resources.value.resources);
  }
  if (definitionProblems({ ...def, state: "closed" }).length) throw new HttpError(503, "form.broken");
  const sw = await one("SELECT state, closed_message FROM form_state WHERE form_key = $1", [key]);
  if (sw && def.elsewhere) { const { elsewhere, ...own } = def; def = own; }
  const manualState = sw ? sw.state : def.state;
  // A form asking for agreement to a document Connect has not published (or cannot be read) does not open.
  const unavailable = !allQuestions(def).length || allQuestions(def).some(({ q }) => (q.type === "resource" && !q.resources?.length) || (q.type === "agree" && !q.current));
  const settings = await readFormSettings(key, def);
  const result = effectiveForm(def, settings, manualState, now);
  if (result.state === "open" && unavailable) { result.state = "closed"; result.stateReason = "unavailable"; }
  return { ...result, closedMessage: settings.closedMessage ?? (sw && sw.closed_message) ?? def.closedMessage };
}

/* Each agreement question with its document's current version laid on, as `current`, on a copy. */
function withAgreements(def, legal) {
  const out = structuredClone(def);
  for (const { q } of allQuestions(out)) if (q.type === "agree") {
    const d = legal?.[q.doc];
    if (d) q.current = { title: d.title, version: d.version, sha256: d.sha256, words: d.words };
    else delete q.current;
  }
  return out;
}

/* What the person agreed to, checked against the versions on the form now. Returns { errors, agreements } and takes
   the agreement values out of answers: they travel as the submission's agreements, not as answers. */
function agreementsOf(def, answers) {
  const errors = {}, agreements = [];
  for (const { q } of allQuestions(def)) {
    if (q.type !== "agree" || !Object.hasOwn(answers, q.id)) continue;
    const m = AGREE_VALUE_RE.exec(answers[q.id]);
    delete answers[q.id];
    if (!m) continue;
    if (!q.current || Number(m[1]) !== q.current.version || m[2] !== q.current.sha256) errors[q.id] = "agreement-out-of-date";
    else agreements.push({ doc: q.doc, version: q.current.version, sha256: q.current.sha256 });
  }
  return { errors, agreements };
}

/* A form's switch, set from the staff page (router.mjs, formSwitch). `by` is the Connect id of whoever
   set it. The row's closed message, if any, is kept. */
export async function writeFormSwitch(t, key, state, by, expectedState) {
  if (expectedState === undefined) return t.query(`INSERT INTO form_state (form_key, state, changed_by) VALUES ($1, $2, $3)
           ON CONFLICT (form_key) DO UPDATE SET state = EXCLUDED.state, changed_by = EXCLUDED.changed_by, changed_at = now()`, [key, state, by]);
  const existing = await t.one("SELECT state FROM form_state WHERE form_key=$1 FOR UPDATE", [key]);
  if (existing && existing.state !== expectedState) throw new HttpError(409, "settings.conflict");
  const changed = existing
    ? await t.one("UPDATE form_state SET state=$2,changed_by=$3,changed_at=now() WHERE form_key=$1 AND state=$4 RETURNING form_key", [key, state, by, expectedState])
    : await t.one("INSERT INTO form_state(form_key,state,changed_by) VALUES($1,$2,$3) ON CONFLICT(form_key) DO NOTHING RETURNING form_key", [key, state, by]);
  if (!changed) throw new HttpError(409, "settings.conflict");
}
export async function setSwitch(key, state, by) {
  return writeFormSwitch({ query: q, one }, key, state, by);
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
    if (q.type === "file" || q.type === "agree") continue;
    let v = raw[q.id];
    if (q.type === "rank" || q.type === "links") v = v == null ? [] : answerWords(q, v).filter(Boolean);
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    const label = (id) => (id === OTHER ? raw[`${q.id}${OTHER}`] || "" : (q.options || []).find((o) => o.id === id)?.label || id);
    if (q.type === "rank" || q.type === "links") v = v.join(", ");
    else if (q.type === "resource") v = answerWords(q, v);
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
  const form = await currentForm(key, { now });
  if (!form) throw new HttpError(404, "form.unknown");
  const { def } = form;
  const raw = readRaw(def, input);
  const context = hiringContext(key, input);
  if (form.state !== "open") return { ok: false, error: "form.closed", closedMessage: form.closedMessage, def, raw, context };

  // The trap field: only automated spam fills it. It is told it succeeded and nothing is kept.
  if (String(field(input, "_website") || "").trim()) return { ok: true, ref: newRef(def), def, trapped: true };

  const versionSeen = Number(field(input, "_version")) || null;
  const check = validateAnswers(def, raw);
  const agreed = agreementsOf(def, check.answers);
  if (Object.keys(agreed.errors).length) Object.assign(check, { ok: false, errors: { ...check.errors, ...agreed.errors } });
  if (agreed.agreements.length) context.agreements = agreed.agreements;
  if (!check.ok) return { ok: false, error: "answers.invalid", errors: check.errors, version: def.version, versionSeen, def, raw, context, gone: await leftBehind(def, versionSeen, input) };

  // The browser sends one key per filled-in form. Without JavaScript there is none, so the key
  // is the answers themselves for the day: pressing Send twice, or reloading the reply, is one
  // submission either way.
  let idem = String(field(input, "_key") || "").trim();
  const contextKey = Object.keys(context).length ? `|${canonicalJSON(context)}` : "";
  if (!IDEM_RE.test(idem)) idem = `d-${sha256(`${def.key}|${def.version}|${canonicalJSON(check.answers)}${contextKey}|${chicagoDate(now)}`).slice(0, 40)}`;

  const out = await tx(async (t) => {
    const existing = await t.one("SELECT ref FROM submissions WHERE form_key = $1 AND idem_key = $2", [def.key, idem]);
    if (existing) return { ok: true, ref: existing.ref, def, duplicate: true };
    // Each file's id becomes its record, and an upload that is gone is said on its question. The
    // id is cleared from what is given back, so the page asks for the file again.
    const files = await fileRecords(t, def, check.answers);
    if (files.errors) {
      const back = { ...raw };
      for (const id of Object.keys(files.errors)) back[id] = [];
      return { ok: false, error: "answers.invalid", errors: files.errors, version: def.version, versionSeen, def, raw: back, context };
    }
    let row = null;
    for (let attempt = 0; !row && attempt < 5; attempt++) {
      row = await t.one(
        `INSERT INTO submissions (ref, form_key, form_version, version_seen, idem_key, answers, anonymous, context)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb)
         ON CONFLICT (ref) DO NOTHING RETURNING id, ref`,
        [newRef(def), def.key, def.version, versionSeen, idem, JSON.stringify(files.answers), !!def.anonymous, JSON.stringify(context)]);
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
    // A notice to the owning team, where its workflow has it on (Programs asked for one per
    // workshop request, 11 Nov 2026): held the same way, and addressed by Connect, which holds
    // the team's address — this site never names one (docs/COMMUNICATIONS.md).
    if (def.workflow?.notify === "on") await outbox("mail.notify", "held", "sender-unverified");
    return { ok: true, ref: row.ref, def, duplicate: false };
  });
  // Read after the transaction ends: on one connection (PGlite) a read beside it waits for it.
  if (out.error === "answers.invalid") out.gone = await leftBehind(def, versionSeen, input);
  return out;
}
