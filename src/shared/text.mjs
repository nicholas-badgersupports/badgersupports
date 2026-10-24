/* Every word the site shows, by key. Follows Badger SPILL's content registry: keys are permanent,
 * content/text.json holds the shipped default (the floor), and a published edit from Connect wins
 * over it. Page content, menus, form questions and photo descriptions are edited where they live;
 * this registry holds everything else — buttons, labels read by screen readers, statuses, errors,
 * day and month names.
 *
 * Imported by the build, the intake API and the browser. ops/editable.mjs fails the check when a
 * renderer or a browser script carries a word that is not a key here.
 */

export const TEXT_SCHEMA = "bss.text/1";
export const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;

export const placeholders = (s) => [...String(s).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);

/* Problems with the registry itself, or with a set of edits about to be published. */
export function textProblems(registry, edits = {}) {
  const problems = [];
  if (registry?.schema !== TEXT_SCHEMA) problems.push("schema: must be bss.text/1");
  const groups = new Set((registry?.groups || []).map((g) => g.id));
  for (const [key, e] of Object.entries(registry?.text || {})) {
    if (!KEY_RE.test(key)) problems.push(`${key}: key shape`);
    if (typeof e.text !== "string") problems.push(`${key}: text must be a string`);
    if (!e.optional && !String(e.text || "").trim()) problems.push(`${key}: required text is empty`);
    if (!e.where) problems.push(`${key}: says nowhere where it shows (the editor needs it)`);
    if (!groups.has(e.group)) problems.push(`${key}: group ${e.group} is not declared`);
  }
  for (const [key, value] of Object.entries(edits)) {
    const e = registry?.text?.[key];
    if (!e) { problems.push(`${key}: not a text key`); continue; }
    if (typeof value !== "string") { problems.push(`${key}: an edit must be text`); continue; }
    if (!e.optional && !value.trim()) problems.push(`${key}: required text cannot be published empty`);
    if (!e.optional) for (const v of placeholders(e.text)) if (!value.includes(`{{${v}}}`)) problems.push(`${key}: must keep {{${v}}}`);
    for (const v of placeholders(value)) if (!placeholders(e.text).includes(v)) problems.push(`${key}: {{${v}}} is not something this text can show`);
  }
  return problems;
}

/* The words in force: each default, replaced by its edit where the edit is acceptable. An edit
   that would blank required text or drop a placeholder is ignored here as well as refused at
   publish, so a page never shows an empty button whatever the store holds. */
export function resolveText(registry, edits = {}) {
  const table = {};
  for (const [key, e] of Object.entries(registry.text)) {
    const v = edits[key];
    const ok = typeof v === "string"
      && (e.optional || (v.trim() && placeholders(e.text).every((p) => v.includes(`{{${p}}}`))))
      && placeholders(v).every((p) => placeholders(e.text).includes(p));
    table[key] = ok ? v : e.text;
  }
  return table;
}

/* t("key", { name: value }). An unknown key is a programming error and throws, so the build and
   the tests find it; the browser's copy (src/client/text.js) cannot throw at a reader. */
export function makeT(table) {
  const t = (key, vars = {}) => {
    if (!(key in table)) throw new Error(`text key "${key}" is not in content/text.json`);
    return fill(table[key], vars);
  };
  t.table = table;
  return t;
}

export const fill = (s, vars = {}) => String(s).replace(/\{\{(\w+)\}\}/g, (m, v) => (v in vars ? String(vars[v]) : m));

/* The keys a browser module may ask for. A page carries only the keys its modules need, as a
   JSON island; ops/editable.mjs checks every t("…") in src/client/ is listed here. A key ending
   in ".*" takes every key under it. */
export const CLIENT_TEXT = {
  "form.js": ["form.errors.one", "form.errors.many", "form.closedNow.title", "form.closedNow.body", "form.updated.title", "form.updated.body", "form.sending", "form.status.*", "form.done.title", "form.done.ref", "form.error.*", "form.upload.*", "form.preview.sent", "form.preview.file"],
  "mood.js": ["mood.error", "mood.count.one", "mood.count.other"],
  "strip.js": ["strip.count"],
  "schedule.js": ["schedule.today"],
  "hero.js": ["hero.pause", "hero.play"],
  "staff.js": ["staff.*"],
  "edit.js": ["edit.*"],
  "resources.js": ["resources.count.*"],
};

export function clientTable(table, modules) {
  const out = {};
  for (const m of modules) for (const k of CLIENT_TEXT[m] || []) {
    if (k.endsWith(".*")) { for (const key of Object.keys(table)) if (key.startsWith(k.slice(0, -1))) out[key] = table[key]; }
    else out[k] = table[k];
  }
  return out;
}
