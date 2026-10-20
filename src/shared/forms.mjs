/* One definition of what a form is, shared by the build, the browser and the intake API.
 *
 * The model follows Badger SPILL's site/shared/forms.mjs (stable question IDs, server-side
 * validation is the authority, answers keyed by ID so a relabelled question keeps its history)
 * and adds what the public BSS forms need and SPILL's do not: branching by `showIf`, option IDs
 * separate from option labels, an "Other" choice, and an open/closed state.
 *
 * Nothing here touches the network, the DOM or the database. The browser imports it to show and
 * hide branches; the server imports it to decide. When the two disagree the server wins, because
 * a hidden branch's answers are dropped on the server whatever the browser sent.
 */

export const FORM_SCHEMA = "bss.form/1";
export const KEY_RE = /^[a-z][a-z0-9-]{1,39}$/;
export const ID_RE = /^[a-z][a-z0-9_]{0,39}$/;
export const OTHER = "__other";

export const QUESTION_TYPES = {
  short:      { input: "text",           max: 200 },
  long:       { input: "textarea",       max: 4000 },
  email:      { input: "email",          max: 254 },
  number:     { input: "number" },
  choice:     { input: "radio",          options: true },
  select:     { input: "select",         options: true },
  checkboxes: { input: "checkbox",       options: true },
  date:       { input: "date" },
  datetime:   { input: "datetime-local" },
  confirm:    { input: "checkbox" },
};

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/* ------------------------------------------------------------------ at launch */

/* The address of the Google Form a native form replaces, from its source note, or null. */
export function googleFormUrl(def) {
  const id = def?.source?.system === "google-forms" ? String(def.source.publishedId || "") : "";
  return /^[A-Za-z0-9_-]{20,}$/.test(id) ? `https://docs.google.com/forms/d/e/${id}/viewform` : null;
}

/* The forms as a launch build serves them (owner, 20 Oct 2026): every open form closed, its page
   linking the Google Form it replaces (`elsewhere`), until Connect shows submissions to the team
   that answers them. A form already closed keeps its own message. On the server a switch row
   still wins over this (netlify/lib/intake.mjs), but the page stays as built until a rebuild. */
export function launchForms(forms) {
  return Object.fromEntries(Object.entries(forms).map(([key, def]) => [key, def.state === "open" ? { ...def, state: "closed", elsewhere: googleFormUrl(def) } : def]));
}

/* ------------------------------------------------------------------ walking a definition */

export function allQuestions(def) {
  const out = [];
  for (const section of def.sections || []) for (const q of section.questions || []) out.push({ section, q });
  return out;
}

export function questionById(def, id) {
  for (const { q } of allQuestions(def)) if (q.id === id) return q;
  return null;
}

/* ------------------------------------------------------------------ definition checks */

/* Every problem a definition has, as { code, at } rows. An empty list means it may be published.
   The editor in Connect is expected to call the same function before it offers Publish; the intake
   API calls it again on every definition it loads, and refuses a form whose definition fails. */
export function definitionProblems(def) {
  const problems = [];
  const add = (code, at) => problems.push({ code, at });
  if (!def || typeof def !== "object") return [{ code: "not-an-object", at: "" }];
  if (def.schema !== FORM_SCHEMA) add("schema-unknown", "schema");
  if (!KEY_RE.test(String(def.key || ""))) add("key-shape", "key");
  if (!Number.isInteger(def.version) || def.version < 1) add("version-shape", "version");
  if (!String(def.title || "").trim()) add("title-missing", "title");
  if (!["open", "closed"].includes(def.state)) add("state-unknown", "state");
  if (def.state === "closed" && !String(def.closedMessage || "").trim()) add("closed-message-missing", "closedMessage");
  if (!Array.isArray(def.sections)) { add("sections-missing", "sections"); return problems; }

  const seenSections = new Set();
  const seen = new Map(); // question id -> question, in order: a condition may only look backwards
  let answerable = 0;
  for (const section of def.sections) {
    const at = `sections.${section.id}`;
    if (!ID_RE.test(String(section.id || ""))) add("section-id-shape", at);
    if (seenSections.has(section.id)) add("section-id-duplicate", at);
    seenSections.add(section.id);
    if (section.showIf) conditionProblems(section.showIf, seen, at, add);
    for (const q of section.questions || []) {
      const qat = `${at}.${q.id}`;
      if (!ID_RE.test(String(q.id || ""))) add("question-id-shape", qat);
      if (seen.has(q.id)) add("question-id-duplicate", qat);
      const type = QUESTION_TYPES[q.type];
      if (!type) { add("type-unknown", qat); seen.set(q.id, q); continue; }
      if (!String(q.label || "").trim()) add("label-missing", qat);
      if (type.options) {
        if (!Array.isArray(q.options) || q.options.length === 0) add("options-missing", qat);
        const ids = new Set();
        for (const o of q.options || []) {
          if (!ID_RE.test(String(o.id || ""))) add("option-id-shape", `${qat}.${o.id}`);
          if (ids.has(o.id)) add("option-id-duplicate", `${qat}.${o.id}`);
          if (!String(o.label || "").trim()) add("option-label-missing", `${qat}.${o.id}`);
          ids.add(o.id);
        }
      }
      if (q.allowOther && !["choice", "checkboxes"].includes(q.type)) add("other-not-allowed", qat);
      if (q.type === "number" && q.min != null && q.max != null && q.min > q.max) add("number-range", qat);
      if (q.maxLength != null && !(Number.isInteger(q.maxLength) && q.maxLength > 0)) add("max-length-shape", qat);
      if (q.showIf) conditionProblems(q.showIf, seen, qat, add);
      seen.set(q.id, q);
      answerable++;
    }
  }
  /* An open form with nothing to answer is how an application "opens" with no questions on it.
     Refused by name rather than rendered as an empty page with a Send button. */
  if (def.state === "open" && answerable === 0) add("open-without-questions", "state");
  return problems;
}

function conditionProblems(cond, seen, at, add) {
  const target = seen.get(cond.question);
  if (!target) { add("condition-target-unknown-or-later", at); return; }
  const ops = ["equals", "in", "includes"].filter((k) => k in cond);
  if (ops.length !== 1) { add("condition-operator", at); return; }
  const optionIds = new Set((target.options || []).map((o) => o.id));
  const values = ops[0] === "in" ? cond.in : [cond[ops[0]]];
  if (!Array.isArray(values) || values.length === 0) add("condition-values", at);
  if (QUESTION_TYPES[target.type]?.options) {
    for (const v of values || []) if (!optionIds.has(v)) add("condition-option-unknown", at);
  }
  if (ops[0] === "includes" && target.type !== "checkboxes") add("condition-includes-needs-checkboxes", at);
}

/* ------------------------------------------------------------------ branching */

export function conditionHolds(cond, answers) {
  if (!cond) return true;
  const v = answers[cond.question];
  if ("equals" in cond) return Array.isArray(v) ? v.includes(cond.equals) : v === cond.equals;
  if ("in" in cond) return Array.isArray(v) ? v.some((x) => cond.in.includes(x)) : cond.in.includes(v);
  if ("includes" in cond) return Array.isArray(v) && v.includes(cond.includes);
  return false;
}

/* Which sections and questions are live for these answers. A question inside a hidden section is
   hidden, and a question whose condition reads a hidden question is hidden too — evaluated in
   order, so a chain of conditions resolves in one pass. */
export function visibility(def, answers) {
  const sections = new Set();
  const questions = new Set();
  const live = {};
  for (const section of def.sections || []) {
    if (!conditionHolds(section.showIf, live)) continue;
    sections.add(section.id);
    for (const q of section.questions || []) {
      if (!conditionHolds(q.showIf, live)) continue;
      questions.add(q.id);
      if (q.id in answers) live[q.id] = answers[q.id];
    }
  }
  return { sections, questions };
}

/* ------------------------------------------------------------------ reading raw input */

/* Turns what arrived — URLSearchParams-like pairs from a no-JS POST, or a JSON object from the
   enhanced form — into one shape: strings, and arrays for checkboxes. Unknown keys are ignored. */
export function readRaw(def, input) {
  const get = (k) => {
    if (input == null) return undefined;
    if (typeof input.getAll === "function") {
      const all = input.getAll(k);
      return all.length === 0 ? undefined : all.length === 1 ? all[0] : all;
    }
    return input[k];
  };
  const raw = {};
  for (const { q } of allQuestions(def)) {
    let v = get(q.id);
    if (q.type === "checkboxes") v = v == null ? [] : Array.isArray(v) ? v : [v];
    else if (Array.isArray(v)) v = v[0];
    raw[q.id] = v;
    if (q.allowOther) {
      const other = get(`${q.id}${OTHER}`);
      raw[`${q.id}${OTHER}`] = Array.isArray(other) ? other[0] : other;
    }
  }
  return raw;
}

/* ------------------------------------------------------------------ validating answers */

/* The server's decision. Returns { ok, answers, errors }:
   - answers holds only questions visible for these answers, cleaned and typed;
   - errors maps a question id to a code from ERROR_CODES. */
export function validateAnswers(def, raw) {
  const errors = {};
  const typed = {};
  for (const { q } of allQuestions(def)) typed[q.id] = clean(q, raw[q.id]);
  const vis = visibility(def, typed);
  const answers = {};
  for (const { q } of allQuestions(def)) {
    if (!vis.questions.has(q.id)) continue;
    const v = typed[q.id];
    const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) errors[q.id] = "required";
      continue;
    }
    const code = typeProblem(q, v);
    if (code) { errors[q.id] = code; answers[q.id] = v; continue; }
    answers[q.id] = v;
    if (q.allowOther) {
      const picked = Array.isArray(v) ? v.includes(OTHER) : v === OTHER;
      const other = clean({ type: "short", maxLength: 200 }, raw[`${q.id}${OTHER}`]);
      if (picked) {
        if (!other) errors[q.id] = "other-missing";
        else if (other.length > 200) errors[q.id] = "too-long";
        answers[`${q.id}${OTHER}`] = other || "";
      }
    }
  }
  return { ok: Object.keys(errors).length === 0, answers, errors };
}

function clean(q, v) {
  if (v == null) return q.type === "checkboxes" ? [] : "";
  if (q.type === "checkboxes") {
    const arr = (Array.isArray(v) ? v : [v]).map((x) => String(x));
    return [...new Set(arr)];
  }
  let s = String(v).replace(/\r\n?/g, "\n");
  s = q.type === "long" ? s.replace(/[ \t]+$/gm, "").trim() : s.replace(/\s+/g, " ").trim();
  if (q.type === "email") s = s.toLowerCase();
  if (q.type === "confirm") return s === "yes" ? "yes" : s ? "invalid" : "";
  return s;
}

function typeProblem(q, v) {
  const t = QUESTION_TYPES[q.type];
  const ids = new Set((q.options || []).map((o) => o.id));
  if (q.allowOther) ids.add(OTHER);
  switch (q.type) {
    case "short": case "long": case "email": {
      const max = q.maxLength || t.max;
      if (v.length > max) return "too-long";
      if (q.type === "email" && !EMAIL_RE.test(v)) return "email-shape";
      return null;
    }
    case "number": {
      if (!/^-?\d+$/.test(v)) return "number-shape";
      const n = Number(v);
      if (q.min != null && n < q.min) return "number-low";
      if (q.max != null && n > q.max) return "number-high";
      return null;
    }
    case "choice": case "select":
      return ids.has(v) ? null : "option-unknown";
    case "checkboxes":
      if (v.some((x) => !ids.has(x))) return "option-unknown";
      if (q.maxSelected && v.length > q.maxSelected) return "too-many";
      return null;
    case "date":
      return DATE_RE.test(v) && realDate(v) ? null : "date-shape";
    case "datetime":
      return DATETIME_RE.test(v) && realDate(v.slice(0, 10)) ? null : "datetime-shape";
    case "confirm":
      return v === "yes" ? null : "confirm-needed";
    default:
      return "type-unknown";
  }
}

function realDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/* What a person reads beside a field, from the text registry (form.error.*) through `t`, which the
   build, the API and the browser each pass in. Written as what to do next, never as a code. */
export function errorText(code, q, t) {
  const label = (q && q.label) || t("form.error.thisQuestion");
  switch (code) {
    case "required": return q && QUESTION_TYPES[q.type]?.options ? t("form.error.requiredChoice", { label }) : t("form.error.required", { label });
    case "too-long": return t("form.error.tooLong", { max: (q && (q.maxLength || QUESTION_TYPES[q.type]?.max)) || 200 });
    case "email-shape": return t("form.error.emailShape");
    case "number-shape": return t("form.error.numberShape");
    case "number-low": return t("form.error.numberLow", { min: q.min });
    case "number-high": return t("form.error.numberHigh", { max: q.max });
    case "option-unknown": return t("form.error.optionUnknown");
    case "too-many": return t("form.error.tooMany", { max: q.maxSelected });
    case "other-missing": return t("form.error.otherMissing");
    case "date-shape": return t("form.error.dateShape");
    case "datetime-shape": return t("form.error.datetimeShape");
    case "confirm-needed": return t("form.error.confirmNeeded");
    default: return t("form.error.other");
  }
}

/* ------------------------------------------------------------------ backups and exports */

/* One column per question, in definition order, by ID. Old answers keep their column when a
   label changes; a retired question keeps its column because the backup reads every version. */
export function answerColumns(def) {
  const cols = [];
  for (const { q } of allQuestions(def)) {
    cols.push({ id: q.id, label: q.label, type: q.type });
    if (q.allowOther) cols.push({ id: `${q.id}${OTHER}`, label: `${q.label} (other)`, type: "short" });
  }
  return cols;
}

/* A cell for a spreadsheet or CSV. Option IDs become labels; anything that a spreadsheet would
   read as a formula is prefixed with an apostrophe, because the answers are untrusted. */
export function cellText(def, id, value) {
  const q = id.endsWith(OTHER) ? null : questionById(def, id);
  let s;
  if (value == null) s = "";
  else if (Array.isArray(value)) s = value.map((v) => optionLabel(q, v)).join("; ");
  else if (q && QUESTION_TYPES[q.type]?.options) s = optionLabel(q, value);
  else s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function optionLabel(q, v) {
  if (v === OTHER) return "Other";
  const o = q && (q.options || []).find((x) => x.id === v);
  return o ? o.label : String(v);
}

/* ------------------------------------------------------------------ digests */

/* Canonical JSON (sorted keys) so a definition has one digest however it was written down. The
   submission records the digest of the exact definition it was validated against. */
export function canonicalJSON(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJSON).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJSON(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
