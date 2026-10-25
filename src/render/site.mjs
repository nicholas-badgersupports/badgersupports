/* The whole site from one snapshot of the build and a set of saved words, and one page of it rendered as
 * the build renders it. The build writes the snapshot into .build/server.json (`render`); the page
 * function (netlify/lib/pages.mjs) lays the current published revision over it, so a saved word reaches
 * the page with no new deploy. With the edits the build itself used, every page comes out byte for byte
 * as the build wrote it (test/published.test.mjs).
 *
 * Pure: no files, no network, no clock but the `today` it is given.
 */

import { makeContext, PROGRAMS } from "./context.mjs";
import { renderPage } from "./layout.mjs";
import { placePages } from "./places.mjs";
import { personPages } from "./team.mjs";
import { formPreviewPages } from "./blocks/form.mjs";
import { resolveText, makeT } from "../shared/text.mjs";
import { applyEdits } from "../shared/edits.mjs";

/* The colour each page wears, so a link to it (a circle in the hero, a door) can wear it too ... */
export const pagePrograms = (pages) => new Map(pages.filter((p) => p.program && p.path).map((p) => [p.path, p.program]));
/* ... and the sections of one page, so a circle to "#craft" wears the craft section's colour. */
export const sectionPrograms = (page) => (page.blocks || []).filter((b) => PROGRAMS.includes(b.program)).map((b) => [`#${b.anchor || b.id}`, b.program]);

/* What a snapshot holds: the files before any saved word (floor), and everything else the pages read. */
export function siteSnapshot({ floor, textRegistry, textEdits = {}, places, team, forms, production, prototype, media, routes, data, assets, liveEvents, builtPaths }) {
  return { schema: "bss.render/1", floor, textRegistry, textEdits, places, team, forms, production, prototype, media, routes, data, assets, liveEvents, builtPaths };
}

/* Every page with the edits laid over the floor, as loadContent() does. */
export function composeSite(snap, edits = {}) {
  const site = structuredClone(snap.floor.site);
  const authored = structuredClone(snap.floor.pages);
  const overlay = applyEdits(edits, { site, pages: authored, text: snap.floor.text }, { media: new Set((snap.media?.items || []).map((m) => m.id)) });
  const text = resolveText(snap.textRegistry, { ...snap.textEdits, ...overlay.textEdits });
  const t = makeT(text);
  const pages = [...authored, ...placePages(snap.places, t), ...personPages(snap.team, t), ...(snap.production ? [] : formPreviewPages(snap.forms, t))];
  return { site, pages, text, applied: overlay.applied, skipped: overlay.problems, programs: pagePrograms(pages) };
}

/* One page as HTML. */
export function renderSitePage(snap, composed, page, today) {
  const ctx = makeContext({
    site: composed.site, media: snap.media, builtPaths: snap.builtPaths, programs: new Map([...composed.programs, ...sectionPrograms(page)]),
    routes: snap.routes, data: snap.data, text: composed.text, today, prototype: snap.prototype, assets: snap.assets, liveEvents: snap.liveEvents, path: page.path || null,
  });
  return String(renderPage(ctx, page));
}
