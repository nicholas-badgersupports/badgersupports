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
import { placePages, withRoomPlaces } from "./places.mjs";
import { personPages } from "./team.mjs";
import { formPreviewPages } from "./blocks/form.mjs";
import { resolveText, makeT } from "../shared/text.mjs";
import { applyEdits } from "../shared/edits.mjs";
import { layStructure, addMadeSections, laySettings, layRooms } from "../shared/structure.mjs";

/* The colour each page wears, so a link to it (a circle in the hero, a door) can wear it too ... */
export const pagePrograms = (pages) => new Map(pages.filter((p) => p.program && p.path).map((p) => [p.path, p.program]));
/* ... and the sections of one page, so a circle to "#craft" wears the craft section's colour. */
export const sectionPrograms = (page) => (page.blocks || []).filter((b) => PROGRAMS.includes(b.program)).map((b) => [`#${b.anchor || b.id}`, b.program]);

/* What a snapshot holds: the files before any saved word (floor), and everything else the pages read. */
export function siteSnapshot({ floor, textRegistry, textEdits = {}, places, team, forms, production, prototype, media, routes, data, assets, liveEvents, builtPaths, shared = null, alumniSource = null }) {
  return { shared, alumniSource, schema: "bss.render/1", floor, textRegistry, textEdits, places, team, forms, production, prototype, media, routes, data, assets, liveEvents, builtPaths };
}

/* Every page with the edits laid over the floor, as loadContent() does, then the page structure (src/shared/structure.mjs):
   pages and sections made on the staff page join the build's before the words are laid, so their words save like any other; drafts
   and retired pages leave the list visitors get; moved and retired addresses are in `moves`. The site's saved
   settings (name, search description, accessibility email) are laid over its own, the build's kept as site.built.
   Rooms' saved words and photos are laid over the room records before anything draws a room: the room pages, the
   blocks that read `places`, and the room names the event lists carry (`places`, `data`, `roomIds`).
   With no structure the result is the build's, byte for byte. */
export function composeSite(snap, edits = {}, structure = null, shared = null) {
  const team = shared?.team?.value || snap.team;
  const liveData = { ...snap.data, ...(shared?.events ? { events: shared.events.value, eventsState: shared.events } : {}), ...(shared?.team ? { team, teamState: shared.team } : {}), ...(shared?.resources ? { resources: shared.resources.value.resources, resourcesUpdated: shared.resources.value.sourceUpdatedAt, resourcesState: shared.resources } : {}), ...(shared?.wall ? { wallNotes: shared.wall.value.notes, wallState: shared.wall } : {}), ...(shared?.alumni ? { alumni: shared.alumni.value, alumniState: shared.alumni.state } : {}) };
  const site = laySettings(structuredClone(snap.floor.site), structure?.settings);
  const made = Object.values(structure?.pages || {}).filter((r) => r.page).map((r) => structuredClone(r.page));
  const authored = [...structuredClone(snap.floor.pages), ...made];
  if (structure) addMadeSections(structure, authored);
  const overlay = applyEdits(edits, { site, pages: authored, text: snap.floor.text }, { media: new Set((snap.media?.items || []).map((m) => m.id)) });
  const text = resolveText(snap.textRegistry, { ...snap.textEdits, ...overlay.textEdits });
  const t = makeT(text);
  const roomIds = Object.keys(structure?.rooms || {});
  const places = layRooms(snap.places, structure?.rooms, { media: new Set((snap.media?.items || []).map((m) => m.id)) });
  const data = places === snap.places ? liveData : { ...liveData, places, events: withRoomPlaces(liveData.events, places, roomIds) };
  const every = [...authored, ...placePages(places, t), ...personPages(team, t), ...(snap.production ? [] : formPreviewPages(snap.forms, t))];
  const laid = layStructure(structure, { site, pages: every });
  const pages = laid.pages;
  const builtPaths = structure || shared?.team ? [...new Set([...(snap.builtPaths || []).filter(p => !shared?.team || !p.startsWith("/about/our-team/") || p === "/about/our-team/"), ...pages.map((p) => p.path).filter(Boolean)])] : snap.builtPaths;
  return {
    site, pages, drafts: laid.drafts, retired: laid.retired, moves: laid.moves, offMenu: laid.offMenu, all: [...pages, ...laid.drafts, ...laid.retired],
    authored: new Set(snap.floor.pages.map((p) => p.id)), builtPaths,
    text, applied: overlay.applied, skipped: overlay.problems, programs: pagePrograms(pages), places, data, roomIds,
  };
}

/* The forms a page shows the state of: its form blocks and the doors that name a form. A review page's
   preview shows the questions whatever the switch says, so it is not one of them. */
export const formsOn = (page) => [...new Set((page.blocks || []).flatMap((b) => [
  b.type === "form" && !b.preview ? b.form : null,
  ...(b.type === "involve" ? (b.items || []).map((it) => it.form) : []),
]).filter(Boolean))];

/* One page as HTML. `forms`, when given, replaces those forms' definitions in the snapshot: the forms as
   they stand now, switch included (netlify/lib/pages.mjs). */
export function renderSitePage(snap, composed, page, today, forms = null, { formTopic = null, now = null } = {}) {
  const base = composed.data || snap.data;
  const data = forms ? { ...base, forms: { ...base.forms, ...forms } } : base;
  const ctx = makeContext({
    site: composed.site, media: snap.media, builtPaths: composed.builtPaths || snap.builtPaths, programs: new Map([...composed.programs, ...sectionPrograms(page)]),
    routes: snap.routes, data, text: composed.text, today, prototype: snap.prototype, assets: snap.assets, liveEvents: snap.liveEvents, path: page.path || null, formTopic, now,
  });
  const ownForm = (page.blocks || []).find(b => b.type === "form" && forms?.[b.form]?.settingsTitle);
  return String(renderPage(ctx, ownForm ? { ...page, title: forms[ownForm.form].title } : page));
}
