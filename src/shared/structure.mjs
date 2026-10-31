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
 *     entries: { "<nav-id>": { label, page: "<pg-id>" } } }   menu entries made here
 *
 * Rules the operations below hold:
 *   - A page made here is a draft until someone with site.publish puts it on. A build page is live unless retired.
 *   - A page id is never given twice: a retired page keeps its record, and a new id skips every id ever listed.
 *   - A retired page's addresses answer a 301 to the page it names, or the 404 page; never another page under its id.
 *   - A moved page's old addresses answer a 301 to its new one, until a page takes that address again.
 *   - A menu entry the build adds later and the menu document does not name keeps its place from the build.
 *
 * Pure: no files, no database, no clock.
 */

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

/* The state a page is in: a record's, or live for a build page. */
export const stateOf = (doc, id) => doc.pages[id]?.state || "live";

/* What the menu holds now, as the editor reorders it: [{ id, label, page?, children? }]. `nav` is the composed
   site's menu (the build's words, saved words and this document laid over it). */
export function menuOutline(nav) {
  return nav.map((top) => ({ id: top.id, label: top.label, ...(top.href ? { href: top.href } : {}),
    ...(top.children ? { children: top.children.map((c) => ({ id: c.id, label: c.label, href: c.href })) } : {}) }));
}

/* Apply one change. `ctx` = { pages: every page as composed now, in any state, with its current address; authored:
   the ids of the build's own page files; menu: the menu as composed now (menuOutline); site: { name, description };
   redirected(path): whether a redirect line takes it }. Returns { doc, page? }: a new document, the old one untouched.
   Throws a Problem (code, status) when the change is not allowed; who may ask for it is the router's to check. */
export function applyChange(current, change, ctx) {
  const doc = structuredClone(current || emptyStructure());
  const { pages, site, redirected } = ctx;
  const find = (id) => pages.find((p) => p.id === id) || fail("page.unknown", 404);
  const authored = (id) => !!doc.pages[id]?.page || ctx.authored.has(id);
  const changeable = (id) => { find(id); if (FIXED_PAGES.has(id) || !authored(id)) fail("page.fixed"); return id; };

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
        doc.entries[entry] = { label, page: id };
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
      const known = new Map(ctx.menu.flatMap((x) => [[x.id, !!x.children], ...(x.children || []).map((c) => [c.id, false])]));
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
   moves: Map(address without its final "/" → { to: address | null, page }) }. */
export function layStructure(doc, { site, pages }) {
  const s = doc || emptyStructure();
  const recs = s.pages || {};
  const live = [], drafts = [], retired = [];
  for (const p of pages) {
    const r = recs[p.id];
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
  site.nav = layMenu(site.nav || [], s, { live, moves, gone: new Set([...drafts, ...retired].map((p) => trimSlash(p.path || ""))) });
  return { pages: live, drafts, retired, moves };
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
  return tree
    .map((x) => (x.children ? { ...x, children: x.children.map(fix).filter(Boolean) } : fix(x)))
    .filter((x) => x && (!x.children || x.children.length || x.href));
}
