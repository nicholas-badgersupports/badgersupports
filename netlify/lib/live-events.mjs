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
 * answer is the list the last publish used, held for half a minute. A site built from the fixture,
 * a prototype, answers from the fixture and never calls Connect.
 */

import { call, serviceConfigNow } from "./connect.mjs";
import { serverContent } from "./content.mjs";
import { mapEvents } from "../../ops/connect-feed.mjs";
import { makeContext, chicagoDate } from "../../src/render/context.mjs";
import { liveBlocks, renderBlock } from "../../src/render/registry.mjs";
import { nextDated } from "../../src/render/events.mjs";
import { eventIcs } from "../../src/render/ics.mjs";
import { siteNow } from "./pages.mjs";

const FRESH_MS = 60_000;
const FAILED_MS = 30_000;

let held = null;

/* Tests start each case with nothing held. */
export function forgetEvents() { held = null; }

async function readEvents(ev) {
  const cfg = serviceConfigNow();
  if (!cfg) throw Object.assign(new Error("Connect is not set up."), { code: "connect.missing" });
  const reply = await call(cfg, { action: "publicEvents" });
  if (reply.schema !== 1 || !Array.isArray(reply.events) || !Array.isArray(reply.weekly)) throw Object.assign(new Error("Connect's event list was not in the shape this site reads."), { code: "connect.bad-reply" });
  const { rooms, ...events } = mapEvents(reply, ev.rules).events;
  return { ...events, places: { ...ev.placeNames, ...rooms } };
}

/* { events, stale }: Connect's list now, or the publish's when Connect cannot be read. */
export async function eventsNow(ev, now = Date.now()) {
  if (ev.source !== "connect") return { events: ev.built, stale: false };
  if (!held || held.until <= now) {
    const promise = readEvents(ev).then(
      (events) => ({ events, stale: false }),
      (e) => {
        console.error(`events: Connect could not be read (${e.code || "error"}); answering with the published list`);
        if (held?.promise === promise) held.until = now + FAILED_MS;
        return { events: ev.built, stale: true };
      },
    );
    held = { until: now + FRESH_MS, promise };
  }
  return held.promise;
}

/* The words as published now (pages.mjs): a saved word reaches the event blocks as it reaches the page. If the
   revision cannot be read, the build's words. */
async function published(c) {
  try { return await siteNow(); } catch { return null; }
}

function context(c, page, events, today, now) {
  const ev = c.events;
  return makeContext({
    site: now?.site || c.site, media: c.media, builtPaths: c.builtPaths, programs: new Map([...ev.programs, ...page.sections]),
    routes: c.routes, data: { events, places: ev.places }, text: now?.text || c.text, today, prototype: c.prototype, assets: c.assets,
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
  const ctx = context(c, page, events, today, site);
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
  const r = nextDated(events, today, Infinity).find((x) => x.event === eventId);
  if (!r) return null;
  const place = c.events.places[r.placeId] || (r.place ? { name: r.place.name } : null);
  return { stale, text: eventIcs(r, { place, origin: c.site.origin, stamp: `${today.replace(/-/g, "")}T000000Z` }) };
}
