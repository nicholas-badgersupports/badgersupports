/* The events between publishes. A page built from Connect's list was right on the day it was
 * published; this answers its event blocks again from Connect's current list, rendered by the
 * build's own renderer for today, so an event added, moved or taken off in Connect shows on the site
 * without a publish. src/client/schedule.js asks and swaps the answer in; when anything fails the
 * published page stays as it is.
 *
 *   GET /api/events/<page id>          { ok, today, blocks: { <block id>: html } }, "" for a block
 *                                      that shows nothing today
 *   GET /api/calendar/<event id>.ics   the calendar file for one upcoming event
 *
 * Public and read only, and nothing in it the page does not already show: the blocks the build
 * rendered (ops/build.mjs eventsForServer), the same escaping, and Connect's public list only.
 * Connect is asked at most once a minute by a warm function and the CDN holds an answer five
 * minutes (router.mjs), so a busy page costs Connect next to nothing. When Connect cannot be read the
 * answer is the last successful public read, or the publish's list if none was saved, held for half a minute. A site built from the fixture,
 * a prototype, answers from the fixture and never calls Connect.
 */

import { call, serviceConfigNow } from "./connect.mjs";
import { serverContent } from "./content.mjs";
import { mapEvents } from "../../ops/connect-feed.mjs";
import { makeContext, chicagoDate } from "../../src/render/context.mjs";
import { liveBlocks, renderBlock } from "../../src/render/registry.mjs";
import { nextDated } from "../../src/render/events.mjs";
import { eventIcs, hasCalendarTimes } from "../../src/render/ics.mjs";
import { withRoomPlaces } from "../../src/render/places.mjs";
import { siteNow } from "./pages.mjs";
import { noteGet, noteSet } from "./published.mjs";

const FRESH_MS = 60_000;
const FAILED_MS = 30_000;

let held = null;

/* This copy forgets the list it holds. Tests start each case with nothing held. */
export function forgetEvents() { held = null; }

/* Refresh now, in whichever running copy took it, writes a new token beside the revision. A copy whose held list was
   asked for under another token asks Connect again, so no copy draws a list held from before the refresh into the
   answers the refresh cleared. The token is read before Connect is asked, so a refresh during the ask is seen on the
   next call. When the token cannot be read, the held list is used as before. */
const FORGET_NOTE = "events-forgotten";
async function forgetToken() {
  try { return (await noteGet(FORGET_NOTE))?.token || ""; } catch (e) {
    console.error(`events: the refresh note could not be read (${e.message}); using the list this copy holds`);
    return undefined;
  }
}
export async function forgetEventsEverywhere() {
  forgetEvents();
  await noteSet(FORGET_NOTE, { token: crypto.randomUUID(), at: new Date().toISOString() });
}

async function readEvents(ev) {
  const cfg = serviceConfigNow();
  if (!cfg) throw Object.assign(new Error("Connect is not set up."), { code: "connect.missing" });
  const reply = await call(cfg, { action: "publicEvents" });
  if (reply.schema !== 1 || !Array.isArray(reply.events) || !Array.isArray(reply.weekly)) throw Object.assign(new Error("Connect's event list was not in the shape this site reads."), { code: "connect.bad-reply" });
  const { rooms, ...events } = mapEvents(reply, ev.rules).events;
  return { ...events, places: { ...ev.placeNames, ...rooms } };
}

/* { events, stale }: Connect's list now, or the last good public list when Connect cannot be read. */
export async function eventsNow(ev, now = Date.now()) {
  if (ev.source !== "connect") return { events: ev.built, stale: false };
  const token = await forgetToken();
  if (held && held.until > now && (token === undefined || token === held.token)) return held.promise;
  const promise = readEvents(ev).then(
    async (events) => {
      await noteSet("events-last-good", { source: serviceConfigNow()?.url || "", events }).catch(() => {});
      return { events, stale: false };
    },
    async (e) => {
      console.error(`events: Connect could not be read (${e.code || "error"}); answering with the most recent public list`);
      if (held?.promise === promise) held.until = now + FAILED_MS;
      let previous = null;
      try { previous = await noteGet("events-last-good"); } catch { /* fall back to the built public list */ }
      const events = previous?.source === (serviceConfigNow()?.url || "") && previous?.events ? previous.events : ev.built;
      return { events, stale: true };
    },
  );
  held = { until: now + FRESH_MS, promise, token };
  return held.promise;
}

/* The words as published now (pages.mjs): a saved word, and a room's saved words and photos, reach the event blocks and
   calendar files as they reach the page. If the revision cannot be read, the build's. */
async function published(c) {
  try { return await siteNow({ catalogues: false }); } catch { return null; }
}

function context(c, page, events, today, publishedSite, now, stale = false) {
  const ev = c.events;
  return makeContext({
    site: publishedSite?.site || c.site, media: c.media, builtPaths: c.builtPaths, programs: new Map([...ev.programs, ...page.sections]),
    routes: c.routes, data: { events: publishedSite ? withRoomPlaces(events, publishedSite.places, publishedSite.roomIds) : events, eventsState: { stale }, places: publishedSite?.places || ev.places }, text: publishedSite?.text || c.text, today, now, prototype: c.prototype, assets: c.assets,
    liveEvents: ev.source === "connect", path: page.path || null,
  });
}

/* A page's event blocks for today, or null for a page that has none. */
export async function eventSections(pageId, { today = chicagoDate(), now = Date.now() } = {}) {
  const c = serverContent();
  const page = Object.hasOwn(c.events?.pages || {}, pageId) ? c.events.pages[pageId] : null;
  if (!page) return null;
  const { events, stale } = await eventsNow(c.events, now);
  const site = await published(c);
  // the blocks with their saved words, so a refreshed block never puts the build's words back
  const edited = site?.pages.find((p) => p.id === pageId)?.blocks;
  const own = page.blocks.map((b) => edited?.find((x) => x.id === b.id) || b);
  const ctx = context(c, page, events, today, site, now, stale);
  const showing = new Set(liveBlocks({ blocks: own }, today).map((b) => b.id));
  const blocks = {};
  for (const b of own) blocks[b.id] = showing.has(b.id) ? String(renderBlock(b, ctx)) : "";
  return { today, stale, blocks };
}

/* The calendar file for one upcoming event, as the build writes it, or null when it is not coming up. */
export async function calendarFile(eventId, { today = chicagoDate(), now = Date.now() } = {}) {
  const c = serverContent();
  if (!c.events) return null;
  const { events, stale } = await eventsNow(c.events, now);
  const r = nextDated(events, today, Infinity, null, now).find((x) => x.event === eventId);
  if (!r || !hasCalendarTimes(r)) return null;
  const places = (await published(c))?.places || c.events.places;
  const place = places[r.placeId] || (r.place ? { name: r.place.name } : null);
  return { stale, text: eventIcs(r, { place, origin: c.site.origin, stamp: `${today.replace(/-/g, "")}T000000Z` }) };
}
