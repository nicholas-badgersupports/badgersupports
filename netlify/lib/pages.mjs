/* Every page, drawn when it is asked for: the build's renderer, the build's snapshot (.build/server.json,
 * `render`) and the published revision of saved words (published.mjs) laid over it. This is how a save
 * reaches visitors with no deploy (owner, 24 Oct 2026; docs/ARCHITECTURE.md, "Publishing a save").
 *
 * Bounded: Netlify's CDN holds a page at most 30 minutes (25, then 5 while it draws it again), the browser
 * not at all. The revision is read from the store at every draw and never held (published.mjs), so a page drawn
 * after a save's clearing carries the save, whichever running copy draws it. The cache key ignores every query string but
 * the two the pages read, and no cookie or header, so nobody can ask past it. Only a page that shows a form's
 * state reads the database: each such form as it stands (intake.mjs currentForm), so a switch set on the staff
 * page is on the page once the switch clears its tags (formTags). Nothing is held between draws. If those forms
 * cannot be read, the page draws them as built and is held a minute, keeping its published words.
 *
 * If the revision cannot be read or the page cannot be drawn, the answer is the build's own file, held a
 * minute, so a fault is never kept for long. A path the build does not have answers the site's 404 page.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { serverContent } from "./content.mjs";
import { currentRevision } from "./published.mjs";
import { currentForm } from "./intake.mjs";
import { composeSite, renderSitePage, formsOn } from "../../src/render/site.mjs";
import { trimSlash as dropSlash } from "../../src/shared/structure.mjs";
import { chicagoDate } from "../../src/render/context.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
let dist = path.resolve(HERE, "..", "..", "dist");
/* Tests point it at their own build. */
export function useDist(dir) { dist = dir; composed = null; }

export const PAGE_CACHE = {
  "cache-control": "public, max-age=0, must-revalidate",
  "netlify-cdn-cache-control": "public, durable, s-maxage=1500, stale-while-revalidate=300",
  "netlify-vary": "query=topic|return",
};
const FALLBACK_CACHE = { "cache-control": "public, max-age=0, must-revalidate", "netlify-cdn-cache-control": "public, s-maxage=60", "netlify-vary": "query=topic|return" };

let composed = null; // { key, site }

function siteFor(snap, revision) {
  const key = revision ? `${revision.n}:${revision.stamp}:${revision.sstamp || 0}` : "none";
  if (composed?.key !== key || composed.snap !== snap) composed = { key, snap, site: composeSite(snap, revision?.edits || {}, revision?.structure || null) };
  return composed.site;
}

/* The site as published now: the snapshot with the current revision laid over it, or null when this build
   carries no snapshot (an older server.json, or a test's own content). */
export async function siteNow() {
  const c = serverContent();
  if (!c.render) return null;
  return siteFor(c.render, await currentRevision());
}

/* The forms this page shows, as they stand now: { forms } (null when it shows none), or { failed: true } when
   they cannot be read, and the page draws them as built. */
async function formsNow(page) {
  const keys = formsOn(page);
  if (!keys.length) return { forms: null };
  const forms = {};
  try {
    for (const key of keys) {
      const f = await currentForm(key);
      if (f) forms[key] = { ...f.def, state: f.state, closedMessage: f.closedMessage };
    }
  } catch (e) {
    console.error(`pages: forms drawn as built (${e.code || e.message})`);
    return { forms: null, failed: true };
  }
  return { forms };
}

/* The cache tags a form's switch touches: its state answer (router.mjs) and every page that shows it. When the
   pages cannot be listed, every page. */
export async function formTags(key) {
  try {
    const site = await siteNow();
    return [`form:${key}`, ...(site ? site.pages.filter((p) => formsOn(p).includes(key)).map((p) => `page:${p.id}`) : [])];
  } catch {
    return [`form:${key}`, "page"];
  }
}

const headerPairs = (lines) => Object.fromEntries(lines.map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).toLowerCase(), l.slice(i + 1).trim()]; }));

/* Matches as Netlify's own matcher does, so the answer is the same whichever of _redirects and this function
   Netlify runs first: a line takes its address with or without a final "/", and a line ending "/*" takes its
   folder, with or without the "/", and everything below it. Case counts; the first matching line wins.
   A target's placeholders (":splat") are not filled in, so a line that needs one does not belong here. */
const trimSlash = (p) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
export function redirectFor(c, pathname) {
  const asked = trimSlash(pathname);
  for (const line of String(c.redirects || "").split("\n")) {
    const [from, to, status] = line.trim().split(/\s+/);
    if (!from) continue;
    const f = decodeURI(from);
    const hit = f.endsWith("/*") ? asked === f.slice(0, -2) || asked.startsWith(f.slice(0, -1)) : asked === trimSlash(f);
    if (hit) return { to, status: Number(status) || 301 };
  }
  return null;
}

function staticFile(pathname) {
  const rel = pathname === "/404.html" ? "404.html" : path.join(pathname, "index.html");
  const file = path.join(dist, rel);
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

/* A page's answer, or null for a path this function does not draw (an asset, the API). */
export async function handlePage(req, { today = chicagoDate() } = {}) {
  const u = new URL(req.url);
  // An address whose %-escapes do not decode is kept as it came: it names no page, so it answers the 404 page, and
  // only a redirect line can still take it, as Netlify's matcher does.
  let pathname;
  let malformed = false;
  try { pathname = decodeURI(u.pathname); } catch { pathname = u.pathname; malformed = true; }
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("", { status: 405, headers: { allow: "GET, HEAD" } });
  const c = serverContent();
  const base = headerPairs(c.headers || []);
  const html = (status, body, extra) => new Response(req.method === "HEAD" ? null : body, { status, headers: { "content-type": "text/html; charset=utf-8", ...base, ...extra } });

  const moved = redirectFor(c, pathname);
  if (moved) return new Response(null, { status: moved.status, headers: { location: moved.to + (u.search && !moved.to.includes("?") ? u.search : ""), ...base, ...PAGE_CACHE } });

  const snap = c.render;
  let revision = null, site = null, fault = null;
  try { revision = await currentRevision(); site = siteFor(snap, revision); } catch (e) { fault = e; }
  // A page moved or retired on the staff page: its old address moves in one step, with or without its final "/", and
  // is tagged like a page, so the next structure change clears it. Retired with nowhere to go, it is the 404 page.
  const shifted = site && !malformed ? site.moves.get(dropSlash(pathname)) : null;
  if (shifted?.to) return new Response(null, { status: 301, headers: { location: shifted.to + u.search, ...base, ...PAGE_CACHE, "netlify-cache-tag": `page,page:${shifted.page}` } });
  // A page's address ends in "/", as the static site's do. The address goes back as it came, encoded: a header
  // cannot carry a letter outside Latin-1, and building one throws.
  if (!shifted && !malformed && !pathname.endsWith("/") && !path.extname(pathname)) return new Response(null, { status: 301, headers: { location: `${u.pathname}/${u.search}`, ...base, ...PAGE_CACHE } });

  try {
    if (fault) throw fault;
    const page = shifted ? null : site.pages.find((p) => (p.file ? `/${p.file}` : p.path) === pathname);
    const notFound = !page;
    const shown = page || site.pages.find((p) => p.id === "pg-not-found");
    const tags = `page,page:${shown.id}`;
    const { forms, failed } = await formsNow(shown);
    return html(notFound ? 404 : 200, renderSitePage(snap, site, shown, today, forms), { ...(failed ? FALLBACK_CACHE : PAGE_CACHE), "netlify-cache-tag": tags, "x-bss-revision": revision ? String(revision.n) : "0" });
  } catch (e) {
    console.error(`pages: drawn from the build's file instead (${e.code || e.message})`);
    const file = staticFile(pathname);
    if (file) return html(200, file, { ...FALLBACK_CACHE, "x-bss-revision": "build" });
    return html(404, staticFile("/404.html") || "", { ...FALLBACK_CACHE, "x-bss-revision": "build" });
  }
}

/* A page as it will be once published, for the staff page's preview: the saved words and the structure now, drafts
   included. Never cached, never indexed, and framed only by this site's own pages. null for a page that is not there
   or is retired. */
export async function previewResponse(pageId, { edits, structure, today = chicagoDate() }) {
  const c = serverContent();
  if (!c.render) return null;
  const site = composeSite(c.render, edits, structure);
  const page = [...site.pages, ...site.drafts].find((p) => p.id === pageId);
  if (!page) return null;
  const { forms } = await formsNow(page);
  const base = headerPairs(c.headers || []);
  const csp = String(base["content-security-policy"] || "").split(";").map((d) => d.trim()).filter((d) => d && !d.startsWith("frame-ancestors"));
  return new Response(renderSitePage(c.render, site, page, today, forms), { status: 200, headers: {
    "content-type": "text/html; charset=utf-8", ...base,
    "content-security-policy": [...csp, "frame-ancestors 'self'"].join("; "),
    "x-frame-options": "SAMEORIGIN", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow",
  } });
}
