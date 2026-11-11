/* The Campus Events Explorer between publishes (WORK item 41). The build's read of the two
 * public feeds is in the page already; this answers /api/campus-events with a fresher read:
 * the feeds are read at most once every five minutes by a warm function (the CDN holds an
 * answer five minutes — router.mjs), Badger Supports programs come from Connect through the
 * same path the site's other event blocks use (live-events.mjs eventsNow), and a failed read
 * answers with the last good list, or the build's, and says it is stale. A site built from the
 * fixtures answers from the build and never calls out. */

import { serverContent } from "./content.mjs";
import { fetchCampusEvents, mergeCampusEvents, fromConnectRows } from "../../ops/campus-feed.mjs";
import { eventsNow } from "./live-events.mjs";
import { nextDated, addDays } from "../../src/render/events.mjs";
import { chicagoDate } from "../../src/render/context.mjs";
import { noteGet, noteSet } from "./published.mjs";

const FRESH_MS = 5 * 60_000;
const FAILED_MS = 30_000;

let held = null;

/* This copy forgets the list it holds. Tests start each case with nothing held. */
export function forgetCampusEvents() { held = null; }

async function readCampus(c, today) {
  const got = await fetchCampusEvents({ today });
  let badger = [];
  let connectStale = false;
  try {
    const { events, stale } = await eventsNow(c.events, Date.now());
    connectStale = stale;
    badger = fromConnectRows(nextDated(events, today, Infinity));
  } catch { /* Connect unreadable just now: the explorer still answers with the two public feeds */ }
  const merged = mergeCampusEvents({ badger }, { from: today, to: addDays(today, 62) });
  return {
    events: [...got.events, ...merged.events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title)),
    updated: got.updated, stale: connectStale, report: got.report,
  };
}

export async function campusEventsNow() {
  const c = serverContent();
  const today = chicagoDate();
  const interests = c.campus?.interests?.interests || [];
  if (!c.campus || c.campus.source !== "live") {
    return { today, updated: c.campus?.built?.updated || null, stale: false, events: c.campus?.built?.events || [], interests, report: null };
  }
  const now = Date.now();
  if (held && held.until > now) return held.promise;
  const promise = readCampus(c, today).then(
    async (r) => {
      await noteSet("campus-events-last-good", { events: r.events, updated: r.updated, report: r.report }).catch(() => {});
      return { today, ...r, interests };
    },
    async (e) => {
      console.error(`campus events: the feeds could not be read (${e.message}); answering with the last good list`);
      if (held?.promise === promise) held.until = now + FAILED_MS;
      let previous = null;
      try { previous = await noteGet("campus-events-last-good"); } catch { /* fall back to the build's list */ }
      const base = previous?.events
        ? { events: previous.events, updated: previous.updated || null, report: previous.report || null }
        : { events: c.campus.built?.events || [], updated: c.campus.built?.updated || null, report: null };
      return { today, ...base, stale: true, interests };
    },
  );
  held = { until: now + FRESH_MS, promise };
  return promise;
}
