/* Rooms and directions. Each room is one record in content/places/ (in production, one row an
 * editor adds in Connect); the build gives every published room its own page at
 * /directions/<id>/, lists it on /directions/, and links every event held there to that page.
 * Adding a room is adding a record: no page file, no code.
 *
 * A draft room (published: false) gets no page and no link, so a room can be written up before
 * anyone is sent to it. A published room needs only an address: with no steps its page is the
 * address card and the map button (owner, 20 Oct 2026: "Show addresses only for Marquee and Tripp").
 *
 * kind: "hub" is a place people can find Badger Supports any day (today only the Student Mental
 * Health Hub); every other room is an event room, used only when an event is held there. The
 * list of rooms leads with the hub.
 */

import { photoProblems } from "./media.mjs";

export const PLACE_SCHEMA = "bss.place/1";
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const placePath = (id) => `/directions/${id}/`;

/* Problems with one record. A published room needs at least an address; steps are optional. */
export function placeProblems(p, { media = null, production = false } = {}) {
  const out = [];
  if (p.schema !== PLACE_SCHEMA) out.push(`schema must be ${PLACE_SCHEMA}`);
  if (!ID_RE.test(p.id || "")) out.push("id must use a–z, 0–9 and single hyphens");
  if (!p.name) out.push("needs a name");
  const steps = p.steps || [];
  const ids = new Set();
  for (const s of steps) {
    if (!/^s-[a-z0-9-]{1,40}$/.test(s.id || "")) out.push(`step ${s.id || "?"}: id must look like s-something`);
    if (ids.has(s.id)) out.push(`step ${s.id}: duplicate id`);
    ids.add(s.id);
    if (!s.text) out.push(`step ${s.id}: needs text`);
    if (s.photo) for (const x of photoProblems(s.photo, { media, production })) out.push(`step ${s.id}: ${x}`);
  }
  if (p.published) {
    if (!p.address) out.push("a published room needs an address");
  }
  if (p.kind && !["hub", "event"].includes(p.kind)) out.push('kind must be "hub" (where people can find us) or "event" (a room events are held in)');
  if (p.photo) for (const x of photoProblems(p.photo, { media, production })) out.push(x);
  if (p.arrivePhoto) for (const x of photoProblems(p.arrivePhoto, { media, production })) out.push(`arrivePhoto: ${x}`);
  if (p.arrivePhoto && !steps.length) out.push("arrivePhoto ends the steps, so it needs at least one step");
  for (const a of p.aliases || []) if (!/^\/[^\s]*[^/]$/.test(a)) out.push(`alias ${a}: an old address starts with "/" and has no trailing slash`);
  return out;
}

/* One page per published room. t is the resolved word table, for the title and description. */
export function placePages(places, t) {
  return Object.values(places).filter((p) => p.published).map((p) => ({
    schema: "bss.page/1",
    id: `pg-place-${p.id}`,
    path: placePath(p.id),
    aliases: p.aliases || [],
    generated: "place",
    title: t("directions.pageTitle", { place: p.name, building: p.building }),
    description: t("directions.pageDescription", { place: p.name, building: p.building, address: p.address }),
    analytics: "public",
    blocks: [{ id: "b-directions", type: "directions", place: p.id }],
  }));
}

/* What an event list shows for a place: its short name, the line under it, and its page if it
   has one. */
export function eventPlaces(places) {
  return Object.fromEntries(Object.values(places).map((p) => [p.id, {
    name: p.short || p.name,
    detail: [p.building, p.where].filter(Boolean).join(", "),
    href: p.published ? placePath(p.id) : null,
  }]));
}

/* Every event held somewhere that is not a room. */
export function eventPlaceProblems(events, places) {
  return [...(events.recurring || []), ...(events.dated || [])]
    .filter((e) => e.place && !places[e.place])
    .map((e) => `${e.id} is held at "${e.place}", which is not a room in content/places/`);
}
