/* Words changed with the edit button, and how the build lays them over the shipped files.
 *
 * A place on the site is named by a target:
 *   text:<key>                       a line in content/text.json
 *   site:<path>                      a word in content/site.json, e.g. site:footer/address
 *   page:<pageId>:<blockId>/<path>   a word in a block of a page, e.g. page:pg-home:b-home-hero/title
 * Paths are keys and list positions joined by "/". Words a visitor reads are targets, and so are the
 * values that shape a page but are not words (owner, 24 Oct 2026: "everything should be editable"), each
 * by its kind (KINDS, below): a link, a photo from the library, an icon, a layout choice, a number, a
 * section switched on or off, the dates a section shows. Ids and references (a form, a room, a person, a
 * series, a source) are permanent keys and stay with the files.
 *
 * The shipped files stay the floor. An edits file ({ schema: "bss.edits/1", edits: { target:
 * words } }) is laid over them at build time, and an edit equal to the floor is simply dropped.
 */

import { BLOCKS } from "../render/registry.mjs";
import { ICONS } from "../render/icons.mjs";
import { embedProblems } from "../render/blocks/embed.mjs";

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

/* Every line of text.json. A line with {{placeholders}} is filled in where it shows, so it cannot be found on the
   page; the edit box lists it under More words, and a save must keep each placeholder (editProblem). */
export function textStrings(table) {
  return Object.entries(table).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => ({ target: `text:${k}`, value: v }));
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

/* ---------- values that are not words ---------- */

/* What a value is, from where it sits: { kind, options? } or null for structure. A block's own fields take
   the kind they are declared with (src/render/registry.mjs); anywhere deeper, a link is an `href`, a
   photo a `media`, `photo` or an entry of `photos`, an icon an `icon`. */
export function kindAt(blockType, path, value) {
  const last = String(path.at(-1));
  if (last === "href") return { kind: "link" };
  if (typeof value === "boolean") return { kind: "boolean" };
  // inside a list: the colour a link or a row wears, a word's size in the cloud, a workshop answer's tone
  if (last === "program") return { kind: "choice", options: ["peer", "craft", "workshops", "other"] };
  if (blockType === "words" && last === "size") return { kind: "choice", options: ["1", "2", "3"] };
  if (blockType === "workshops" && last === "tone") return { kind: "choice", options: ["soft", "clear", "harsh"] };
  if (last === "count" && typeof value === "number") return { kind: "number" };
  // a video: an Instagram post or reel, the one frame the page's security policy lets in
  if (last === "url" && (blockType === "embed" || String(path[0]) === "embed")) return { kind: "video" };
  if (last === "media" || last === "photo" || (path.length >= 2 && String(path.at(-2)) === "photos" && /^\d+$/.test(last))) return { kind: "media" };
  if (last === "icon") return { kind: "icon", options: ICONS };
  if (path.length !== 1) return null;
  if (last === "enabled") return { kind: "boolean" };
  if (last === "startsOn" || last === "endsOn") return { kind: "date" };
  const spec = String(BLOCKS[blockType]?.fields?.[last] || "").replace(/!$/, "");
  if (spec.startsWith("choice:")) return { kind: "choice", options: spec.slice(7).split("|") };
  if (spec === "number") return { kind: "number" };
  if (spec === "boolean") return { kind: "boolean" };
  return null;
}
const siteKindAt = (path) => (String(path.at(-1)) === "href" ? { kind: "link" } : String(path.at(-1)) === "enabled" ? { kind: "boolean" } : null);

/* Every value of a page that is not a word but may be changed, as text, with its kind. */
export function pageValues(page) {
  const out = [];
  const walkAll = (node, at, block) => {
    if (node !== null && typeof node === "object") {
      for (const [k, v] of Array.isArray(node) ? node.entries() : Object.entries(node)) walkAll(v, [...at, k], block);
      return;
    }
    if (!["string", "number", "boolean"].includes(typeof node) || !at.length) return;
    const k = kindAt(block.type, at, node);
    if (k) out.push({ target: `page:${page.id}:${join([block.id, ...at])}`, value: String(node), ...k });
  };
  for (const b of page.blocks || []) if (b?.id) for (const [key, v] of Object.entries(b)) if (key !== "id" && key !== "type") walkAll(v, [key], b);
  return out;
}

export function siteValues(site) {
  const out = [];
  const walkAll = (node, at) => {
    if (node !== null && typeof node === "object") { for (const [k, v] of Array.isArray(node) ? node.entries() : Object.entries(node)) walkAll(v, [...at, k]); return; }
    const k = ["string", "boolean"].includes(typeof node) ? siteKindAt(at) : null;
    if (k) out.push({ target: `site:${join(at)}`, value: String(node), ...k });
  };
  for (const part of SITE_PARTS) walkAll(site[part], [part]);
  return out;
}

const ANCHOR = /^#[a-z0-9-]{1,80}$/;
const PATH = /^\/[a-z0-9\-/]*(\?[a-z]+=[a-z0-9-]+)?(#[a-z0-9-]{1,80})?$/;

/* What is wrong with a new value of a given kind, as a code, or null. media: the library's ids. */
export function valueProblem(kind, value, { options = [], media = null } = {}) {
  if (typeof value !== "string") return "edit.value";
  const v = value.trim();
  if (!v) return "edit.empty";
  if (/[\s<>"'`\\]/.test(v) && kind !== "choice") return "edit.markup";
  if (kind === "link") {
    if (v.length > 500) return "edit.long";
    if (PATH.test(v) || ANCHOR.test(v)) return null;
    if (/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return null;
    if (/^tel:\+?[0-9-]{3,20}$/.test(v)) return null;
    let u;
    try { u = new URL(v); } catch { return "edit.link"; }
    // web addresses are https only, with no name or password in them
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") ? null : "edit.link";
  }
  if (kind === "video") return embedProblems({ url: v, title: "-" }).length ? "edit.video" : null;
  if (kind === "media") return /^m-[a-z0-9-]{2,80}$/.test(v) && (!media || media.has(v)) ? null : "edit.media";
  if (kind === "icon" || kind === "choice") return options.includes(v) ? null : "edit.choice";
  if (kind === "number") return /^\d{1,2}$/.test(v) ? null : "edit.number";
  if (kind === "boolean") return v === "true" || v === "false" ? null : "edit.choice";
  if (kind === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "edit.date";
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? null : "edit.date";
  }
  return "edit.target";
}

/* The value a typed target names in the shipped content, with its kind, or null. */
export function floorTyped(target, { site, pages }) {
  const t = parseTarget(target);
  if (!t || t.kind === "text") return null;
  if (t.kind === "site") return siteValues(site).find((x) => x.target === target) || null;
  const page = pages.find((p) => p.id === t.page);
  return page ? pageValues(page).find((x) => x.target === target) || null : null;
}

function setTyped(target, { site, pages }, kind, value) {
  const t = parseTarget(target);
  const root = t.kind === "site" ? site : pages.find((p) => p.id === t.page).blocks.find((x) => x.id === t.block);
  let node = root;
  for (const k of t.path.slice(0, -1)) node = node[Array.isArray(node) ? Number(k) : k];
  const last = Array.isArray(node) ? Number(t.path.at(-1)) : t.path.at(-1);
  // a value keeps the type it had in the file: a size written 2 stays a number
  const was = node[last];
  node[last] = typeof was === "number" ? Number(value) : typeof was === "boolean" ? value === "true" : value;
}

/* Lay edits over raw content in place. Returns { textEdits, applied, problems }: text edits go to
   resolveText (text.mjs) like any other; the rest are written into site and the pages. */
export function applyEdits(edits, { site, pages, text }, { media = null } = {}) {
  const textEdits = {}, problems = [], applied = [];
  for (const [target, raw] of Object.entries(edits || {})) {
    const typed = floorTyped(target, { site, pages });
    if (typed) {
      const problem = valueProblem(typed.kind, raw, { options: typed.options, media });
      if (problem) { problems.push(`${target}: ${problem}`); continue; }
      if (raw.trim() === typed.value) continue;
      setTyped(target, { site, pages }, typed.kind, raw.trim());
      applied.push(target);
      continue;
    }
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
