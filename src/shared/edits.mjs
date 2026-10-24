/* Words changed with the edit button, and how the build lays them over the shipped files.
 *
 * A place on the site is named by a target:
 *   text:<key>                       a line in content/text.json
 *   site:<path>                      a word in content/site.json, e.g. site:footer/address
 *   page:<pageId>:<blockId>/<path>   a word in a block of a page, e.g. page:pg-home:b-home-hero/title
 * Paths are keys and list positions joined by "/". Only words a visitor reads can be targets: ids,
 * links, photos, icons, dates and choices are structure, and stay with the files.
 *
 * The shipped files stay the floor. An edits file ({ schema: "bss.edits/1", edits: { target:
 * words } }) is laid over them at build time, and an edit equal to the floor is simply dropped.
 */

export const EDITS_SCHEMA = "bss.edits/1";

/* Keys whose strings are structure, never words. */
const STRUCTURAL = new Set([
  "id", "type", "href", "media", "icon", "anchor", "form", "variant", "heading", "place", "person", "program",
  "path", "schema", "analytics", "photo", "photos", "aliases", "home", "kind", "group", "card", "show", "source",
  "tone", "startsOn", "endsOn", "file", "lang", "connectOrigin", "liveOrigin", "origin", "url", "accessibilityEmail",
  "description", "category", "series",
]);
/* The parts of site.json a visitor reads on every page. */
const SITE_PARTS = ["nav", "headerAction", "supportLine", "footer"];
const LINKISH = /^(\/|https?:|mailto:|tel:|#)/;
const MAX = 2000;

function* walk(node, at) {
  if (typeof node === "string") {
    if (node.trim() && !LINKISH.test(node)) yield [at, node];
    return;
  }
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) yield* walk(node[i], [...at, i]); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) if (!STRUCTURAL.has(k)) yield* walk(v, [...at, k]);
  }
}

const join = (parts) => parts.join("/");

/* Every editable word on a page: { target, value, block }. */
export function pageStrings(page) {
  const out = [];
  for (const b of page.blocks || []) {
    if (!b?.id) continue;
    for (const [at, value] of walk(b, [])) out.push({ target: `page:${page.id}:${join([b.id, ...at])}`, value, block: b.id });
  }
  return out;
}

export function siteStrings(site) {
  const out = [];
  for (const part of SITE_PARTS) for (const [at, value] of walk(site[part], [part])) out.push({ target: `site:${join(at)}`, value });
  return out;
}

/* Lines of text.json that read the same everywhere (no {{placeholders}}). */
export function textStrings(table) {
  return Object.entries(table).filter(([, v]) => typeof v === "string" && v.trim() && !v.includes("{{")).map(([k, v]) => ({ target: `text:${k}`, value: v }));
}

/* Split a target into its parts, or null when it is not one. */
export function parseTarget(target) {
  const s = String(target || "");
  let m = s.match(/^text:([a-zA-Z0-9_.-]{1,80})$/);
  if (m) return { kind: "text", key: m[1] };
  m = s.match(/^site:([A-Za-z0-9_/]{1,200})$/);
  if (m) return { kind: "site", path: m[1].split("/") };
  m = s.match(/^page:(pg-[a-z0-9-]{1,60}):(b-[a-z0-9-]{2,60})((?:\/[A-Za-z0-9_]{1,60}){1,8})$/);
  if (m) return { kind: "page", page: m[1], block: m[2], path: m[3].slice(1).split("/") };
  return null;
}

function holder(root, path) {
  let node = root;
  for (const k of path.slice(0, -1)) {
    if (node == null || typeof node !== "object") return null;
    node = node[Array.isArray(node) ? Number(k) : k];
  }
  const last = path.at(-1);
  if (node == null || typeof node !== "object" || typeof node[Array.isArray(node) ? Number(last) : last] !== "string") return null;
  return { node, key: Array.isArray(node) ? Number(last) : last };
}

function structural(path) { return path.some((k) => STRUCTURAL.has(k)); }

/* The string a target names in the shipped content, or undefined. */
export function floorValue(target, { site, pages, text }) {
  const t = parseTarget(target);
  if (!t) return undefined;
  if (t.kind === "text") return typeof text[t.key] === "string" ? text[t.key] : undefined;
  if (t.kind === "site") {
    if (!SITE_PARTS.includes(t.path[0]) || structural(t.path)) return undefined;
    const h = holder(site, t.path);
    return h ? h.node[h.key] : undefined;
  }
  const page = pages.find((p) => p.id === t.page);
  const block = page?.blocks?.find((b) => b.id === t.block);
  if (!block || structural(t.path)) return undefined;
  const h = holder(block, t.path);
  return h ? h.node[h.key] : undefined;
}

/* What is wrong with one edit, as a code, or null. */
export function editProblem(target, value, floor) {
  if (!parseTarget(target)) return "edit.target";
  if (floor === undefined || LINKISH.test(floor)) return "edit.target";
  if (typeof value !== "string") return "edit.value";
  const v = value.trim();
  if (!v) return "edit.empty";
  if (v.length > MAX) return "edit.long";
  if (/[<>]/.test(v)) return "edit.markup";
  if (LINKISH.test(v)) return "edit.value";
  const need = (floor.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) || []).map((p) => p.replace(/\s/g, ""));
  const have = new Set((v.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) || []).map((p) => p.replace(/\s/g, "")));
  if (need.some((p) => !have.has(p))) return "edit.placeholder";
  return null;
}

/* Lay edits over raw content in place. Returns { textEdits, applied, problems }: text edits go to
   resolveText (text.mjs) like any other; the rest are written into site and the pages. */
export function applyEdits(edits, { site, pages, text }) {
  const textEdits = {}, problems = [], applied = [];
  for (const [target, raw] of Object.entries(edits || {})) {
    const floor = floorValue(target, { site, pages, text });
    const problem = editProblem(target, raw, floor);
    if (problem) { problems.push(`${target}: ${problem}`); continue; }
    const value = raw.trim();
    if (value === floor) continue;
    const t = parseTarget(target);
    if (t.kind === "text") textEdits[t.key] = value;
    else if (t.kind === "site") { const h = holder(site, t.path); h.node[h.key] = value; }
    else { const b = pages.find((p) => p.id === t.page).blocks.find((x) => x.id === t.block); const h = holder(b, t.path); h.node[h.key] = value; }
    applied.push(target);
  }
  return { textEdits, applied, problems };
}

/* An edits file, checked. */
export function readEditsFile(json) {
  if (!json || json.schema !== EDITS_SCHEMA || typeof json.edits !== "object" || Array.isArray(json.edits)) throw new Error(`an edits file must be { "schema": "${EDITS_SCHEMA}", "edits": { target: words } }`);
  return json.edits;
}
