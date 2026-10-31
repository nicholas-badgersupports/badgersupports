/* Page structure: the pages staff add, copy, put on the site, move or retire with the staff page, and the menu's
 * order. One document; every change is a new version of it (netlify/lib/structure.mjs keeps each one), the published
 * revision carries the current one, and composeSite (src/render/site.mjs) lays it over the build's pages after the
 * saved words.
 *
 *   { schema: "bss.structure/1",
 *     pages:   { "<pg-id>": { state: "draft" | "live" | "retired", page?: <a whole bss.page/1, for a page made here>,
 *                             path?, title?, description?, oldPaths?: ["/was/"], retiredTo?: "<pg-id>" } },
 *     menu:    null | [ { id, children?: [ids] } ],   the menu by entry id; null keeps the build's
 *     removed: [ entry ids taken off the menu ],
 *     entries: { "<nav-id>": { label, page: "<pg-id>", group?: "<nav-id>" | "" } } }   menu entries made here, with
 *              the group they were put in ("" the top), so one taken off goes back there
 *
 *   A page's record may also hold its sections: sections: { made: { "<b-id>": <a block made or copied here> },
 *     order: null | [every block id, retired ones included], retired: [block ids] }.
 *
 * Rules the operations below hold:
 *   - A page made here is a draft until someone with site.publish puts it on. A build page is live unless retired.
 *   - A page id is never given twice: a retired page keeps its record, and a new id skips every id ever listed.
 *   - A retired page's addresses answer a 301 to the page it names, or the 404 page; never another page under its id.
 *   - A moved page's old addresses answer a 301 to its new one, until a page takes that address again.
 *   - A menu entry the build adds later and the menu document does not name keeps its place from the build.
 *   - An entry taken off the menu stays listed as off until it is put back, and goes back to its own group: the one the
 *     build puts it in, or the one it was put on the site in. A group comes back with its entries that are off.
 *   - A section is never deleted: a retired one keeps its record and its place, so Put back returns it there, and a
 *     block id is never given twice on a page. A block the build adds later keeps its place from the build.
 *   - A page's opening (a page head, hero or event hero) keeps its place: it is not moved, copied or retired.
 *   - Only a section drawn from its own words alone (no data source, no script) is copied; a new one is a Text section.
 *   - A section a link on the site lands on (its anchor, or an id inside it) is not retired while that link stands.
 *
 * Pure: no files, no database, no clock.
 */

import { BLOCKS } from "../render/registry.mjs";
import { editProblem } from "./edits.mjs";

export const STRUCTURE_SCHEMA = "bss.structure/1";
export const emptyStructure = () => ({ schema: STRUCTURE_SCHEMA, pages: {}, menu: null, removed: [], entries: {} });

/* Pages that are made from their own records, or that the site cannot do without, never change shape here. */
export const FIXED_PAGES = new Set(["pg-home", "pg-not-found", "pg-staff"]);
const RESERVED = new Set(["api", "assets", "media", "calendar", "staff", "forms", "admin", "netlify", "_server"]);
const PATH_RE = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/){1,4}$/;
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 300;

export const trimSlash = (p) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
/* A link's address as a page address compares: no query, no fragment, no final "/". */
export const linkKey = (href) => trimSlash(String(href || "").replace(/[?#].*$/, "")) || "/";

class Problem extends Error {
  constructor(code, status = 422) { super(code); this.code = code; this.status = status; }
}
export const isProblem = (e) => e instanceof Problem;
const fail = (code, status) => { throw new Problem(code, status); };

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
function title(value) {
  const v = clean(value);
  if (!v || v.length > TITLE_MAX || CONTROL.test(String(value ?? "").replace(/[\n\t]/g, ""))) fail("page.title");
  return v;
}
function description(value) {
  const v = clean(value);
  if (v.length > DESCRIPTION_MAX) fail("page.description");
  return v;
}

/* Every address a page holds or held, and every id ever listed, across the composed pages and this document. */
function inUse(doc, pages) {
  const paths = new Set(), ids = new Set();
  for (const p of pages) { ids.add(p.id); if (p.path) paths.add(trimSlash(p.path)); }
  for (const [id, r] of Object.entries(doc.pages)) {
    ids.add(id);
    for (const p of [r.path, r.page?.path, ...(r.oldPaths || [])]) if (p) paths.add(trimSlash(p));
  }
  return { paths, ids };
}

/* A new page's address: lower-case words joined by "-", one to four folders, a final "/", in no reserved folder,
   and held by no page, old address or redirect line. `redirected(path)` says whether a redirect line takes it. */
function newPath(value, doc, pages, redirected, { except = null } = {}) {
  const p = String(value ?? "").trim();
  if (!PATH_RE.test(p)) fail("page.path");
  if (RESERVED.has(p.split("/")[1])) fail("page.path.reserved");
  if (redirected(p)) fail("page.path.taken");
  const { paths } = inUse(doc, pages.filter((x) => x.id !== except));
  const mine = except ? doc.pages[except] : null;
  const own = new Set([...(mine?.oldPaths || []), mine?.path, mine?.page?.path].filter(Boolean).map(trimSlash));
  if (paths.has(trimSlash(p)) && !own.has(trimSlash(p))) fail("page.path.taken");
  return p;
}

/* An id from the address's last folder, never one listed before: pg-press, then pg-press-2. */
function newId(path, doc, pages) {
  const { ids } = inUse(doc, pages);
  const slug = path.split("/").filter(Boolean).at(-1).slice(0, 40).replace(/-+$/, "");
  let id = `pg-${slug}`;
  for (let n = 2; ids.has(id); n++) id = `pg-${slug}-${n}`;
  return id;
}

/* A copy's blocks: the words and settings as they stand, each block with a new id. A block that had no anchor keeps
   its old id as one, so the page's own "#" links still land. */
function copyBlocks(blocks, id) {
  const stem = id.slice(3, 33).replace(/-+$/, "");
  return blocks.map((b, i) => ({ ...structuredClone(b), id: `b-${stem}-${i + 1}`, ...(b.anchor || !b.id ? {} : { anchor: b.id }) }));
}

/* ---------- sections within a page ---------- */

/* Pages whose sections never change here: the 404 page and the staff page itself. */
export const SECTION_FIXED = new Set(["pg-not-found", "pg-staff"]);
const HEADS = new Set(["pagehead", "hero", "eventhero"]);
export const isOpening = (b) => HEADS.has(b?.type);
export const copyable = (type) => { const d = BLOCKS[type]; return !!d && !HEADS.has(type) && !(d.data || []).length && !d.client; };

/* What a section is called in a list: its first words, cut to 80 characters, or "" when it has none. */
export function sectionName(b) {
  const first = [b.title, b.text, ...(Array.isArray(b.body) ? b.body : [b.body])].find((x) => typeof x === "string" && x.trim());
  const v = clean(first);
  return v.length > 80 ? `${v.slice(0, 79)}…` : v;
}

/* Every block id in `current` (the page's blocks, made ones last), in the saved order; a block the order does not
   name goes after the nearest block before it in `current`. */
export function fullOrder(current, order) {
  if (!order) return [...current];
  const have = new Set(current);
  const out = order.filter((id) => have.has(id));
  const placed = new Set(out);
  current.forEach((id, i) => {
    if (placed.has(id)) return;
    let at = 0;
    for (let k = i - 1; k >= 0; k--) { const j = out.indexOf(current[k]); if (j >= 0) { at = j + 1; break; } }
    out.splice(at, 0, id);
    placed.add(id);
  });
  return out;
}

/* The sections a page's record makes join its blocks, before the words are laid, so their words save like any other. */
export function addMadeSections(doc, pages) {
  for (const p of pages) {
    const made = doc?.pages?.[p.id]?.sections?.made;
    if (made && Object.keys(made).length) p.blocks = [...(p.blocks || []), ...Object.values(made).map((b) => structuredClone(b))];
  }
}

/* Lay the order and take the retired sections off. The page keeps, unlisted, its full order and its retired blocks,
   for the staff page and the next change. */
function laySections(p, sec) {
  const all = p.blocks || [];
  const byId = new Map(all.map((b) => [b.id, b]));
  const full = fullOrder(all.map((b) => b.id), sec.order);
  const retired = new Set(sec.retired || []);
  p.blocks = full.filter((id) => !retired.has(id)).map((id) => byId.get(id));
  Object.defineProperty(p, "sectionOrder", { value: full, enumerable: false, configurable: true });
  Object.defineProperty(p, "retiredSections", { value: full.filter((id) => retired.has(id)).map((id) => byId.get(id)), enumerable: false, configurable: true });
}

/* Every link on the site: [{ from, href }], `from` naming the page and block it is in, or null for the menus and footer. */
export function siteLinks(site, pages) {
  const out = [];
  const walk = (node, from) => {
    if (Array.isArray(node)) { for (const x of node) walk(x, from); return; }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "href" && typeof v === "string") out.push({ from, href: v });
      else walk(v, from);
    }
  };
  for (const part of ["nav", "headerAction", "supportLine", "footer"]) walk(site?.[part], null);
  for (const p of pages) for (const b of p.blocks || []) walk(b, { page: p.id, path: p.path, block: b.id });
  return out;
}

/* The ids a section draws on the page: its anchor and every id or anchor inside it. */
function idsIn(b) {
  const ids = new Set([b.anchor || b.id]);
  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== "object") return;
    for (const [k, v] of Object.entries(n)) { if ((k === "id" || k === "anchor") && typeof v === "string") ids.add(v); else walk(v); }
  };
  for (const [k, v] of Object.entries(b)) if (k !== "id" && k !== "anchor") walk(v);
  return ids;
}

/* Whether a link on the site lands on section `b` of page `p`: "#x" on the same page, or "<its address>#x". */
function linkedTo(b, p, links) {
  const ids = idsIn(b);
  return links.some(({ from, href }) => {
    const at = href.indexOf("#");
    if (at < 0 || !ids.has(href.slice(at + 1))) return false;
    const base = href.slice(0, at);
    if (from?.block === b.id && from?.page === p.id) return false;
    if (base === "") return from?.page === p.id;
    return base.startsWith("/") && linkKey(base) === linkKey(p.path || "");
  });
}

/* A copy's own ids: the block's and every id inside it, each new on the page, and no anchor carried over. */
function copySection(b, used, nested) {
  const base = b.id.slice(0, 55).replace(/-+$/, "");
  let k = 1;
  while (used.has(`${base}-c${k}`)) k++;
  const copy = structuredClone(b);
  copy.id = `${base}-c${k}`;
  delete copy.anchor;
  const rekey = (n) => {
    if (Array.isArray(n)) { n.forEach(rekey); return; }
    if (!n || typeof n !== "object") return;
    delete n.anchor;
    if (typeof n.id === "string") {
      const stem = n.id.slice(0, 41 - `-c${k}`.length - 3).replace(/-+$/, "");
      let id = `${stem}-c${k}`;
      for (let m = 2; nested.has(id); m++) id = `${stem}-c${k}-${m}`;
      nested.add(id);
      n.id = id;
    }
    for (const [key, v] of Object.entries(n)) if (key !== "id") rekey(v);
  };
  for (const [key, v] of Object.entries(copy)) if (key !== "id") rekey(v);
  return copy;
}

/* The full order with the retired sections put back after the section each followed before. */
function withRetired(visible, before, retired) {
  const out = [...visible];
  before.forEach((id, i) => {
    if (!retired.has(id)) return;
    let at = 0;
    for (let k = i - 1; k >= 0; k--) { const j = out.indexOf(before[k]); if (j >= 0) { at = j + 1; break; } }
    out.splice(at, 0, id);
  });
  return out;
}

function sectionChange(doc, change, ctx, { find, authored }) {
  const p = find(change.page);
  if (SECTION_FIXED.has(p.id) || !authored(p.id)) fail("section.fixed");
  if (stateOf(doc, p.id) === "retired") fail("page.retired");
  const r = (doc.pages[p.id] ||= { state: "live" });
  const sec = (r.sections ||= { made: {}, order: null, retired: [] });
  sec.made ||= {};
  sec.retired ||= [];
  const shown = p.blocks || [];
  const gone = p.retiredSections || [];
  const full = p.sectionOrder ? [...p.sectionOrder] : shown.map((b) => b.id);
  const used = new Set([...full, ...Object.keys(sec.made), ...sec.retired]);
  const nested = new Set([...shown, ...gone].flatMap((b) => [...idsIn(b)]));
  const visible = (id) => shown.find((b) => b.id === id);
  const named = (id) => visible(id) || (gone.some((b) => b.id === id) ? null : fail("section.unknown", 404));
  const after = (list, at, id) => { const i = list.indexOf(at); list.splice(i < 0 ? list.length : i + 1, 0, id); return list; };
  const lastOpening = shown.reduce((n, b, i) => (isOpening(b) ? i : n), -1);

  switch (change.action) {
    case "sectionAdd": {
      const stem = p.id.slice(3, 50).replace(/-+$/, "");
      let k = 1;
      while (used.has(`b-${stem}-s${k}`)) k++;
      const id = `b-${stem}-s${k}`;
      const at = change.after === undefined || change.after === null || change.after === "" ? shown.at(-1)?.id : change.after;
      const i = shown.findIndex((b) => b.id === at);
      if (at !== undefined && (i < 0 || i < lastOpening)) fail("section.after");
      const t = change.title === undefined || change.title === null ? "" : clean(change.title);
      if (t && (t.length > TITLE_MAX || editProblem(`page:${p.id}:${id}/title`, t, ""))) fail("section.title");
      const body = String(change.words ?? "").split(/\n\s*\n/).map(clean).filter(Boolean);
      if (!body.length || body.some((w, n) => editProblem(`page:${p.id}:${id}/body/${n}`, w, ""))) fail("section.words");
      sec.made[id] = { id, type: "text", ...(t ? { title: t } : {}), body };
      sec.order = after(full, at, id);
      return { doc, page: p.id, section: id };
    }
    case "sectionCopy": {
      const b = named(change.section) || fail("section.retired");
      if (isOpening(b)) fail("section.head");
      if (!copyable(b.type)) fail("section.kind");
      const copy = copySection(b, used, nested);
      sec.made[copy.id] = copy;
      sec.order = after(full, b.id, copy.id);
      return { doc, page: p.id, section: copy.id };
    }
    case "sectionOrder": {
      const want = change.order;
      const ids = shown.map((b) => b.id);
      if (!Array.isArray(want) || want.length !== ids.length || new Set(want).size !== want.length || want.some((id) => !ids.includes(id))) fail("section.order");
      shown.forEach((b, i) => { if (isOpening(b) && want[i] !== b.id) fail("section.order"); });
      sec.order = withRetired(want, full, new Set(sec.retired));
      return { doc, page: p.id };
    }
    case "sectionRetire": {
      const b = named(change.section) || fail("section.retired");
      if (isOpening(b)) fail("section.head");
      if (linkedTo(b, p, ctx.links || [])) fail("section.linked");
      sec.order = full;
      sec.retired = [...sec.retired, b.id];
      return { doc, page: p.id, section: b.id };
    }
    case "sectionBack": {
      if (visible(change.section)) fail("section.notRetired");
      named(change.section);
      sec.order = full;
      sec.retired = sec.retired.filter((id) => id !== change.section);
      return { doc, page: p.id, section: change.section };
    }
    default:
      return fail("pages.action", 400);
  }
}

export const SECTION_ACTIONS = new Set(["sectionAdd", "sectionCopy", "sectionOrder", "sectionRetire", "sectionBack"]);

/* The state a page is in: a record's, or live for a build page. */
export const stateOf = (doc, id) => doc.pages[id]?.state || "live";

/* What the menu holds now, as the editor reorders it: [{ id, label, page?, children? }]. `nav` is the composed
   site's menu (the build's words, saved words and this document laid over it). */
export function menuOutline(nav) {
  return nav.map((top) => ({ id: top.id, label: top.label, ...(top.href ? { href: top.href } : {}),
    ...(top.children ? { children: top.children.map((c) => ({ id: c.id, label: c.label, href: c.href })) } : {}) }));
}

/* Apply one change. `ctx` = { pages: every page as composed now, in any state, with its current address; authored:
   the ids of the build's own page files; menu: the menu as composed now (menuOutline); offMenu: the entries that can
   be put back (layStructure); site: { name, description };
   redirected(path): whether a redirect line takes it; links: siteLinks() }. Returns { doc, page?, section? }: a new
   document, the old one untouched.
   Throws a Problem (code, status) when the change is not allowed; who may ask for it is the router's to check. */
export function applyChange(current, change, ctx) {
  const doc = structuredClone(current || emptyStructure());
  const { pages, site, redirected } = ctx;
  const find = (id) => pages.find((p) => p.id === id) || fail("page.unknown", 404);
  const authored = (id) => !!doc.pages[id]?.page || ctx.authored.has(id);
  const changeable = (id) => { find(id); if (FIXED_PAGES.has(id) || !authored(id)) fail("page.fixed"); return id; };

  if (SECTION_ACTIONS.has(change.action)) return sectionChange(doc, change, ctx, { find, authored });

  switch (change.action) {
    case "add":
    case "copy": {
      const t = title(change.title);
      const from = change.action === "copy" ? find(changeable(change.page)) : null;
      const path = newPath(change.path, doc, pages, redirected);
      const id = newId(path, doc, pages);
      const page = from
        ? { ...structuredClone(from), id, path, title: `${t} — ${site.name}`, blocks: copyBlocks(from.blocks || [], id) }
        : { schema: "bss.page/1", id, path, title: `${t} — ${site.name}`, description: description(change.description ?? site.description), analytics: "public",
            blocks: [{ id: `b-${id.slice(3, 33).replace(/-+$/, "")}-1`, type: "pagehead", title: t }] };
      delete page.file;
      doc.pages[id] = { state: "draft", page };
      return { doc, page: id };
    }
    case "details": {
      const id = changeable(change.page);
      const r = (doc.pages[id] ||= { state: "live" });
      if (r.state === "retired") fail("page.retired");
      if (change.title !== undefined) r.title = `${title(change.title)} — ${site.name}`;
      if (change.description !== undefined) r.description = description(change.description);
      if (change.path !== undefined) {
        const was = find(id).path;
        const path = newPath(change.path, doc, pages, redirected, { except: id });
        if (path !== was) {
          r.oldPaths = [...new Set([...(r.oldPaths || []), was])].filter((p) => trimSlash(p) !== trimSlash(path));
          r.path = path;
        }
      }
      return { doc, page: id };
    }
    case "publish": {
      const id = changeable(change.page);
      const r = doc.pages[id];
      if (!r || r.state !== "draft") fail("page.notDraft");
      r.state = "live";
      if (change.group !== undefined && change.group !== null) {
        const label = title(change.label ?? clean(find(id).title).replace(new RegExp(` — ${site.name}$`), ""));
        const entry = `nav-${id.slice(3)}`;
        const outline = change.menu || ctx.menu;
        const tree = outline.map((x) => ({ id: x.id, ...(x.children ? { children: x.children.map((c) => c.id) } : {}) }));
        if (change.group === "") tree.push({ id: entry });
        else {
          const g = tree.find((x) => x.id === change.group && x.children);
          if (!g) fail("menu.group");
          g.children.push(entry);
        }
        doc.entries[entry] = { label, page: id, group: change.group };
        doc.menu = tree;
        doc.removed = (doc.removed || []).filter((x) => x !== entry);
      }
      return { doc, page: id };
    }
    case "retire": {
      const id = changeable(change.page);
      const r = (doc.pages[id] ||= { state: "live" });
      if (r.state === "retired") fail("page.retired");
      if (change.to) {
        const to = find(change.to);
        if (to.id === id || stateOf(doc, to.id) !== "live") fail("page.retireTo");
        r.retiredTo = to.id;
      }
      r.state = "retired";
      return { doc, page: id };
    }
    case "menu": {
      const known = new Map([...ctx.menu, ...(ctx.offMenu || [])].flatMap((x) => [[x.id, !!x.children], ...(x.children || []).map((c) => [c.id, false])]));
      const seen = new Set();
      const take = (id, group) => {
        if (typeof id !== "string" || !known.has(id) || seen.has(id) || known.get(id) !== group) fail("menu.entry");
        seen.add(id);
      };
      if (!Array.isArray(change.menu)) fail("menu.entry");
      const tree = change.menu.map((x) => {
        take(x?.id, Array.isArray(x?.children));
        if (!x.children) return { id: x.id };
        for (const c of x.children) take(c, false);
        return { id: x.id, children: [...x.children] };
      });
      doc.menu = tree;
      doc.removed = [...known.keys()].filter((id) => !seen.has(id));
      return { doc };
    }
    default:
      return fail("pages.action", 400);
  }
}

/* Lay the document over the composed pages and menu, in place. Returns { pages: what visitors get, drafts, retired,
   moves: Map(address without its final "/" → { to: address | null, page }), offMenu: the entries taken off the menu
   that can be put back, [{ id, label, href?, group, children? }], `group` the group each goes back to ("" the top) }. */
export function layStructure(doc, { site, pages }) {
  const s = doc || emptyStructure();
  const recs = s.pages || {};
  const live = [], drafts = [], retired = [];
  for (const p of pages) {
    const r = recs[p.id];
    if (r?.sections) laySections(p, r.sections);
    if (r?.path) p.path = r.path;
    if (r?.title) p.title = r.title;
    if (r?.description !== undefined) p.description = r.description;
    const state = r?.state || "live";
    (state === "live" ? live : state === "draft" ? drafts : retired).push(p);
  }
  const at = new Map(live.map((p) => [trimSlash(p.path || ""), p]));
  const moves = new Map();
  const moveTo = (from, to, page) => { const k = trimSlash(from); if (!at.has(k)) moves.set(k, { to, page }); };
  for (const p of live) for (const old of recs[p.id]?.oldPaths || []) moveTo(old, p.path, p.id);
  for (const p of retired) {
    const r = recs[p.id] || {};
    const to = r.retiredTo ? live.find((x) => x.id === r.retiredTo)?.path || null : null;
    for (const old of [p.path, ...(r.oldPaths || [])]) if (old) moveTo(old, to, p.id);
  }
  const menu = layMenu(site.nav || [], s, { live, moves, gone: new Set([...drafts, ...retired].map((p) => trimSlash(p.path || ""))) });
  site.nav = menu.tree;
  return { pages: live, drafts, retired, moves, offMenu: menu.off };
}

function layMenu(nav, s, { live, moves, gone }) {
  const flat = new Map();
  const home = new Map(); // entry → the group the build puts it in ("" for the top)
  for (const top of nav) {
    flat.set(top.id, top);
    home.set(top.id, "");
    for (const c of top.children || []) { flat.set(c.id, c); home.set(c.id, top.id); }
  }
  const byId = new Map(live.map((p) => [p.id, p]));
  for (const [id, e] of Object.entries(s.entries || {})) {
    const p = byId.get(e.page);
    if (p) flat.set(id, { id, label: e.label, href: p.path });
  }
  const removed = new Set(s.removed || []);
  let tree;
  if (s.menu) {
    const named = new Set(s.menu.flatMap((x) => [x.id, ...(x.children || [])]));
    tree = s.menu.filter((x) => flat.has(x.id)).map((x) => ({ ...flat.get(x.id), ...(x.children ? { children: x.children.filter((c) => flat.has(c)).map((c) => flat.get(c)) } : {}) }));
    // what a later build added, where the build put it
    for (const top of nav) {
      if (!named.has(top.id) && !removed.has(top.id)) tree.push({ ...top, ...(top.children ? { children: [] } : {}) });
      for (const c of top.children || []) {
        if (named.has(c.id) || removed.has(c.id)) continue;
        const g = tree.find((x) => x.id === top.id && x.children);
        if (g) g.children.push(c);
      }
    }
  } else {
    tree = nav.map((top) => ({ ...top, ...(top.children ? { children: [...top.children] } : {}) }));
  }
  const fix = (item) => {
    if (!item.href) return item;
    const k = linkKey(item.href);
    if (gone.has(k)) return null;
    const m = moves.get(k);
    if (m) return m.to ? { ...item, href: m.to } : null;
    return item;
  };
  const laid = tree
    .map((x) => (x.children ? { ...x, children: x.children.map(fix).filter(Boolean) } : fix(x)))
    .filter((x) => x && (!x.children || x.children.length || x.href));
  return { tree: laid, off: offMenu({ flat, home, removed, entries: s.entries || {}, fix }) };
}

/* The entries taken off the menu that can come back: an entry whose page is a draft, retired or gone is not offered.
   A group that is off carries its entries that are off; each other entry names the group it goes back to. */
function offMenu({ flat, home, removed, entries, fix }) {
  const off = [...flat.keys()].filter((id) => removed.has(id));
  const groupOf = (id) => home.get(id) ?? entries[id]?.group ?? "";
  const link = (id) => { const x = fix(flat.get(id)); return x && x.href ? { id, label: x.label, href: x.href } : null; };
  const groups = new Map();
  for (const id of off) {
    if (!flat.get(id).children) continue;
    const children = off.filter((c) => !flat.get(c).children && groupOf(c) === id).map(link).filter(Boolean);
    if (children.length) groups.set(id, { id, label: flat.get(id).label, group: "", children });
  }
  return off.flatMap((id) => {
    if (flat.get(id).children) return groups.has(id) ? [groups.get(id)] : [];
    if (groups.has(groupOf(id))) return [];
    const x = link(id);
    return x ? [{ ...x, group: groupOf(id) }] : [];
  });
}
