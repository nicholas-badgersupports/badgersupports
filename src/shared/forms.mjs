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
  /* Added for the two applications (WORK.md item 14). A phone number is never refused for its
     format. A ranking gives each option a different place, first choice first. A file is one PDF
     that goes up in its own request before Send (netlify/lib/files.mjs); the answer names it by
     fileId and never carries it. */
  tel:        { input: "tel",            max: 40 },
  links:      { input: "textarea",       maxItems: 5 },
  rank:       { input: "select",         options: true },
  file:       { input: "file",           maxBytes: 3 * 1024 * 1024, accept: "application/pdf" },
  /* One resource from the site's resource list. Its `resources` ([{ id, name }]) are filled in by
     the build from the list the resource viewer shows (withResources), never typed into the file,
     so the form and the viewer always offer the same resources. The answer is the resource's id. */
  resource:   { input: "select",         list: true },
};

/* What Connect keeps as a suggestion's resource id (its suggestionFields()), so no id Connect
   exports is refused here and none it would cut short is sent. */
export const RESOURCE_ID_RE = /^[A-Za-z0-9_-]{1,120}$/;

export const LINK_MAX = 2000;
export const FILE_ID_RE = /^[A-Za-z0-9_-]{32}$/;
/* Types whose answer is not one value a condition could test. */
const UNCONDITIONAL = new Set(["links", "rank", "file", "resource"]);

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

/* The definition with every `resource` question given the site's resource list, by name. The
   list is the build's: the resource viewer's own records. A definition with no such question comes
   back unchanged. */
export function withResources(def, resources) {
  if (!def || !Array.isArray(def.sections) || !def.sections.some((s) => (s.questions || []).some((q) => q.type === "resource"))) return def;
  const list = (resources || []).filter((r) => r && r.id && r.name).map((r) => ({ id: String(r.id), name: String(r.name) }))
    .sort((a, z) => a.name.localeCompare(z.name, "en") || a.id.localeCompare(z.id));
  return { ...def, sections: def.sections.map((s) => ({ ...s, questions: (s.questions || []).map((q) => (q.type === "resource" ? { ...q, resources: list } : q)) })) };
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
  if (proseProblem(def.intro)) add("prose-shape", "intro");
  if (!Array.isArray(def.sections)) { add("sections-missing", "sections"); return problems; }

  const seenSections = new Set();
  const seen = new Map(); // question id -> question, in order: a condition may only look backwards
  let answerable = 0;
  for (const section of def.sections) {
    const at = `sections.${section.id}`;
    if (!ID_RE.test(String(section.id || ""))) add("section-id-shape", at);
    if (seenSections.has(section.id)) add("section-id-duplicate", at);
    seenSections.add(section.id);
    if (!String(section.title || "").trim()) add("section-title-missing", at);
    if (proseProblem(section.intro)) add("prose-shape", `${at}.intro`);
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
      if (type.list) {
        if (!Array.isArray(q.resources) || q.resources.length === 0) add("resources-missing", qat);
        const ids = new Set();
        for (const r of q.resources || []) {
          if (!RESOURCE_ID_RE.test(String(r?.id || ""))) add("resource-id-shape", `${qat}.${r?.id}`);
          else if (ids.has(r.id)) add("resource-id-duplicate", `${qat}.${r.id}`);
          if (!String(r?.name || "").trim()) add("resource-name-missing", `${qat}.${r?.id}`);
          ids.add(r?.id);
        }
      }
      if (q.allowOther && !["choice", "checkboxes"].includes(q.type)) add("other-not-allowed", qat);
      if (q.type === "number" && q.min != null && q.max != null && q.min > q.max) add("number-range", qat);
      if (q.maxLength != null && !(Number.isInteger(q.maxLength) && q.maxLength > 0)) add("max-length-shape", qat);
      if (proseProblem(q.help)) add("prose-shape", `${qat}.help`);
      if (q.confidential != null && typeof q.confidential !== "boolean") add("confidential-shape", qat);
      // A confirmation's checkbox words, when its label is a heading above it rather than the words.
      if (q.confirmText != null && (q.type !== "confirm" || !words(q.confirmText))) add("confirm-text-shape", qat);
      if (q.type === "links" && q.maxLinks != null && !(Number.isInteger(q.maxLinks) && q.maxLinks >= 1 && q.maxLinks <= 10)) add("max-links-shape", qat);
      if (q.type === "rank" && (q.options || []).length < 2) add("rank-needs-two-options", qat);
      // An anonymous form keeps no name with its answers; a resume would carry one.
      if (q.type === "file" && def.anonymous) add("file-on-anonymous-form", qat);
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

/* Words longer than a line (a form's intro, a section's intro, a question's help) are prose: one
   paragraph as a string, or a list of parts. A part is a paragraph (a string), { heading },
   { list, ordered }, { links: [{ href, label }] } or { more, body }: secondary help folded under
   its label, body being parts of the other kinds and never empty. Plain words only: the renderer
   adds the markup, so nothing an editor types becomes HTML. True when the shape is wrong. */
export function proseProblem(v) {
  if (v == null || typeof v === "string") return false;
  return !Array.isArray(v) || !v.every((p) => prosePartOk(p));
}

const words = (x) => typeof x === "string" && x.trim() !== "";
function prosePartOk(p, folded = false) {
  if (typeof p === "string") return true;
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const keys = Object.keys(p);
  if ("more" in p) return !folded && keys.length === 2 && words(p.more) && Array.isArray(p.body) && p.body.length > 0 && p.body.every((b) => prosePartOk(b, true));
  if ("heading" in p) return keys.length === 1 && words(p.heading);
  if ("list" in p) return keys.every((k) => k === "list" || k === "ordered") && Array.isArray(p.list) && p.list.length > 0 && p.list.every(words) && (p.ordered == null || typeof p.ordered === "boolean");
  if ("links" in p) return keys.length === 1 && Array.isArray(p.links) && p.links.length > 0 && p.links.every((l) => l && typeof l === "object" && /^(\/|#|https:\/\/|mailto:)/.test(String(l.href || "")) && words(l.label));
  return false;
}

/* The paragraphs of a piece of prose as plain text, for a place with no room for markup (the
   closed page's kept answers, a receipt). Headings, list items and a fold's label become their own
   lines; a fold's body follows its label. */
export function proseText(v) {
  if (v == null) return [];
  if (typeof v === "string") return [v];
  return v.flatMap((p) => (typeof p === "string" ? [p] : p.heading ? [p.heading] : p.list ? p.list : p.links ? p.links.map((l) => l.label) : p.more ? [p.more, ...proseText(p.body)] : []));
}

function conditionProblems(cond, seen, at, add) {
  const target = seen.get(cond.question);
  if (!target) { add("condition-target-unknown-or-later", at); return; }
  if (UNCONDITIONAL.has(target.type)) { add("condition-target-type", at); return; }
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
   enhanced form — into one shape: strings, arrays for checkboxes and files, and for a ranking an
   object of option id to rank, read from its one select per option ("<id>.<option>"). Unknown
   keys are ignored. */
export function readRaw(def, input) {
  const get = (k) => {
    if (input == null) return undefined;
    if (typeof input.getAll === "function") {
      const all = input.getAll(k);
      return all.length === 0 ? undefined : all.length === 1 ? all[0] : all;
    }
    return Object.hasOwn(input, k) ? input[k] : undefined;
  };
  const raw = {};
  for (const { q } of allQuestions(def)) {
    let v = get(q.id);
    if (q.type === "checkboxes" || q.type === "file") v = v == null ? [] : Array.isArray(v) ? v : [v];
    else if (q.type === "rank") v = v != null && typeof v === "object" ? v : Object.fromEntries((q.options || []).map((o) => [o.id, get(`${q.id}.${o.id}`)]).filter(([, x]) => x != null));
    else if (Array.isArray(v) && q.type !== "links") v = v[0];
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
    if (isEmpty(v)) {
      if (q.required) errors[q.id] = "required";
      continue;
    }
    const code = typeProblem(q, v);
    if (code) { errors[q.id] = code; answers[q.id] = v; continue; }
    answers[q.id] = q.type === "rank" ? rankOrder(q, v) : v;
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

const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) ? v.length === 0 : typeof v === "object" && Object.keys(v).length === 0);

/* A ranking as option ids, first choice first. Accepts the object the form sends or a list. */
export function rankOrder(q, v) {
  if (Array.isArray(v)) return v.map(String);
  const r = rankFrom(q, v);
  return (q.options || []).filter((o) => Object.hasOwn(r, o.id)).sort((a, b) => Number(r[a.id]) - Number(r[b.id])).map((o) => o.id);
}

/* Option id -> rank as a string, for the options that have one. Reads only the definition's own
   options, so a key that is not one of them is ignored rather than trusted. */
function rankFrom(q, v) {
  const out = {};
  if (v == null || typeof v !== "object") return out;
  for (const o of q.options || []) {
    let x = Array.isArray(v) ? (v.includes(o.id) ? v.indexOf(o.id) + 1 : null) : Object.hasOwn(v, o.id) ? v[o.id] : null;
    if (Array.isArray(x)) x = x[0];
    const s = x == null ? "" : String(x).trim();
    if (s) out[o.id] = s;
  }
  return out;
}

function httpsLink(s) {
  if (/\s/.test(s) || !/^https:\/\//i.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && /^[^.]+(\.[^.]+)+$/.test(u.hostname) && !u.username && !u.password;
  } catch { return false; }
}

function clean(q, v) {
  if (q.type === "rank") return rankFrom(q, v);
  if (v == null) return ["checkboxes", "file", "links"].includes(q.type) ? [] : "";
  if (q.type === "checkboxes") {
    const arr = (Array.isArray(v) ? v : [v]).map((x) => String(x));
    return [...new Set(arr)];
  }
  if (q.type === "file") return [...new Set((Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean))];
  if (q.type === "links") return (Array.isArray(v) ? v.map(String) : String(v).split(/\r\n?|\n/)).map((s) => s.trim()).filter(Boolean);
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
    case "short": case "long": case "email": case "tel": {
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
    case "resource":
      return (q.resources || []).some((r) => r.id === v) ? null : "option-unknown";
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
    case "links":
      if (v.length > (q.maxLinks || t.maxItems)) return "links-too-many";
      if (v.some((s) => s.length > LINK_MAX)) return "link-too-long";
      return v.every(httpsLink) ? null : "link-shape";
    case "rank": {
      const n = (q.options || []).length;
      const ranks = Object.values(v);
      if (ranks.some((r) => !/^\d+$/.test(r) || Number(r) < 1 || Number(r) > n)) return "rank-shape";
      if (new Set(ranks.map(Number)).size !== ranks.length) return "rank-repeated";
      return ranks.length === n ? null : "rank-incomplete";
    }
    case "file":
      if (v.length > 1) return "files-too-many";
      return v.every((x) => FILE_ID_RE.test(x)) ? null : "file-shape";
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
    case "required":
      if (q?.type === "file") return t("form.error.requiredFile", { label });
      if (q?.type === "rank") return t("form.error.requiredRank", { label });
      return q && (QUESTION_TYPES[q.type]?.options || QUESTION_TYPES[q.type]?.list) ? t("form.error.requiredChoice", { label }) : t("form.error.required", { label });
    case "links-too-many": return t("form.error.linksTooMany", { max: q.maxLinks || QUESTION_TYPES.links.maxItems });
    case "link-too-long": return t("form.error.linkTooLong", { max: LINK_MAX.toLocaleString("en-US") });
    case "link-shape": return t("form.error.linkShape");
    case "rank-shape": return t("form.error.rankShape", { max: (q.options || []).length });
    case "rank-repeated": return t("form.error.rankRepeated");
    // A required ranking cannot be left blank, so it is not offered as a way out.
    case "rank-incomplete": return q.required ? t("form.error.requiredRank", { label }) : t("form.error.rankIncomplete");
    case "file-shape": return t("form.error.fileShape");
    case "file-missing": return t("form.error.fileMissing");
    case "files-too-many": return t("form.error.filesTooMany");
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
   label changes; a retired question keeps its column because the backup reads every version.
   A confidential question's column says so: its answers go to Connect and nowhere else (not the
   backup, logs or analytics), and whatever copies answers onward has to skip it. */
export function answerColumns(def) {
  const cols = [];
  for (const { q } of allQuestions(def)) {
    cols.push({ id: q.id, label: q.label, type: q.type, ...(q.confidential ? { confidential: true } : {}) });
    if (q.allowOther) cols.push({ id: `${q.id}${OTHER}`, label: `${q.label} (other)`, type: "short", ...(q.confidential ? { confidential: true } : {}) });
  }
  return cols;
}

/* An answer as the words a person reads: a string, or a list of strings for an answer in parts.
   Option IDs become labels, a ranking reads "1. Programs" first choice first, links stay as they
   were typed, and a file reads as its name and size — never its contents. Connect's copy, the
   backup and the staff page all use this, so they say the same thing. */
export function answerWords(q, v) {
  if (v == null) return "";
  // A file record reads as a file even where its question has since been retired.
  const type = q?.type || (Array.isArray(v) && v.length && v.every(isFileRecord) ? "file" : null);
  switch (type) {
    case "rank": return rankOrder(q, v).map((id, i) => `${i + 1}. ${optionLabel(q, id)}`);
    case "file": return (Array.isArray(v) ? v : [v]).map((f) => (isFileRecord(f) ? `${f.name} (${sizeWords(f.bytes)})` : String(f)));
    case "links": return Array.isArray(v) ? v.map(String) : String(v).split("\n");
    case "resource": return resourceName(q, v);
    default:
      if (Array.isArray(v)) return v.map((x) => optionLabel(q, x));
      return q && QUESTION_TYPES[q.type]?.options ? optionLabel(q, v) : String(v);
  }
}

const isFileRecord = (f) => !!f && typeof f === "object" && typeof f.name === "string" && Number.isFinite(f.bytes);

export function sizeWords(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* A cell for a spreadsheet or CSV, from answerWords: parts joined with "; ", links one per line.
   Anything that a spreadsheet would read as a formula is prefixed with an apostrophe, because the
   answers are untrusted. */
export function cellText(def, id, value) {
  const q = id.endsWith(OTHER) ? null : questionById(def, id);
  const w = value == null ? "" : answerWords(q, value);
  const s = Array.isArray(w) ? w.join(q?.type === "links" ? "\n" : "; ") : w;
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/* A resource's name, or its id when the list no longer holds it. */
export function resourceName(q, v) {
  const r = q && (q.resources || []).find((x) => x.id === v);
  return r ? r.name : String(v);
}

export function optionLabel(q, v) {
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
