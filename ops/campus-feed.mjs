/* The Campus Events Explorer's data (WORK item 41, EXPLORE-A-EVENTS).
 *
 * Three public sources become one list of campus events:
 *   - UW–Madison Events (today.wisc.edu), a JSON API whose records carry true ISO instants;
 *   - the Wisconsin Union event calendar's full feed (XML), whose times are Madison wall times
 *     and are turned into instants by the site's own Chicago conversion, the same one Connect's
 *     events use, so nothing is shifted by a machine's time zone;
 *   - Badger Supports programs, from Connect's public events as the rest of the site reads them
 *     (the caller passes rows from src/render/events.mjs nextDated).
 *
 * The verification behind these choices is docs/research/EXPLORE-FEEDS-VERIFICATION-2026-11-11.md.
 * In particular: the Union's feed_1 carries titles only, so the full feed at the same path without
 * the suffix is the one read for data; feed_1 is still read, to count what it carries.
 *
 * A field the source does not state stays absent: no cost, no "sold out", no cancellation is ever
 * inferred. Feed text is untrusted input — descriptions are flattened to plain text here, and the
 * renderers escape everything again on the way out.
 */

import { chicagoInstant } from "../src/shared/chicago-time.mjs";
import { canonicalPlaceName } from "../src/shared/place-names.mjs";

export const UW_EVENTS_URL = "https://today.wisc.edu/events.json";
export const UNION_FEED_URL = "https://union.wisc.edu/events-and-activities/event-calendar/feed";
export const UNION_TITLES_URL = "https://union.wisc.edu/events-and-activities/event-calendar/feed_1";

export const SOURCE_NAMES = { uw: "UW–Madison Events", union: "Wisconsin Union", badger: "Badger Supports" };

const DAY_MS = 86_400_000;
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/* "WUD  Film — Presents!" and "wud film presents" are the same title for dedup. */
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
export function plainText(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const cap = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const stated = (v) => { const s = plainText(v); return s && s !== "None" ? s : null; };

/* One UW record as an explorer event, or a reason it was left out. */
export function parseUwEvent(e) {
  if (!e || e.id == null || !plainText(e.title)) return { drop: "a UW event with no id or title" };
  let start = typeof e.startDate8601 === "string" && Number.isFinite(Date.parse(e.startDate8601)) ? new Date(e.startDate8601).toISOString() : null;
  if (!start && Number.isFinite(e.startDateUnix)) start = new Date(e.startDateUnix * 1000).toISOString();
  if (!start) return { drop: `UW event ${e.id}: no readable start time` };
  let end = typeof e.endDate8601 === "string" && Number.isFinite(Date.parse(e.endDate8601)) ? new Date(e.endDate8601).toISOString() : null;
  if (!end && Number.isFinite(e.endDateUnix)) end = new Date(e.endDateUnix * 1000).toISOString();
  if (end && end <= start) end = null;
  const place = stated(e.building?.name) || stated(e.location);
  return {
    event: {
      id: `uw-${e.id}`,
      title: cap(plainText(e.title), 160),
      start, end,
      allDay: !!e.allDayEvent,
      place,
      organizer: stated(e.sponsor),
      sources: [{ source: "uw", name: SOURCE_NAMES.uw, url: stated(e.url) || `https://today.wisc.edu/events/view/${e.id}` }],
      cost: stated(e.cost),
      status: null,
      tags: (Array.isArray(e.tags) ? e.tags : []).map((t) => plainText(t)).filter(Boolean).slice(0, 12),
      categories: [],
      blurb: cap(plainText(e.description), 280) || null,
      badger: false,
    },
  };
}

const tagOf = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? plainText(m[1]) : null; };

/* One <event> of the Union feed as an explorer event, or a reason it was left out. */
export function parseUnionEvent(xml) {
  const title = tagOf(xml, "event_title");
  const date = tagOf(xml, "event_start_date");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return { drop: "a Union event with no title or start date" };
  const startTime = tagOf(xml, "event_start_time");
  const hm = /^\d{2}:\d{2}/.test(startTime || "") ? startTime.slice(0, 5) : null;
  const start = chicagoInstant(date, hm || "00:00");
  if (!start) return { drop: `Union event "${title.slice(0, 60)}": its start time does not resolve` };
  const dates = [...String(tagOf(xml, "event_date") || "").matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].map((m) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`);
  const endDate = dates.length && dates[dates.length - 1] > date ? dates[dates.length - 1] : date;
  const endTime = tagOf(xml, "event_end_time");
  const endHm = /^\d{2}:\d{2}/.test(endTime || "") ? endTime.slice(0, 5) : null;
  const end = endHm ? chicagoInstant(endDate, endHm) : null;
  const vague = (v) => { const s = stated(v); return s && s !== "See Event Details" ? s : null; };
  const status = stated(tagOf(xml, "status"));
  const id = tagOf(xml, "event_id");
  return {
    event: {
      id: `union-${id || norm(title).replace(/ /g, "-").slice(0, 60)}`,
      title: cap(title, 160),
      start, end: end && end > start ? end : null,
      allDay: !hm,
      place: vague(tagOf(xml, "venue")) || vague(tagOf(xml, "location")) || vague(tagOf(xml, "room")),
      organizer: stated(tagOf(xml, "event_sponsor")),
      sources: [{ source: "union", name: SOURCE_NAMES.union, url: stated(tagOf(xml, "url")) || "https://union.wisc.edu/events-and-activities/event-calendar/" }],
      cost: stated(tagOf(xml, "cost")),
      status: status === "sold_out" ? "soldOut" : null,
      tags: [],
      categories: [stated(tagOf(xml, "category"))].filter(Boolean),
      blurb: cap(plainText(tagOf(xml, "short_description") || ""), 280) || null,
      badger: false,
    },
  };
}

/* The whole Union feed, split into events and the reasons any were left out. */
export function parseUnionFeed(xml) {
  const events = [], dropped = [];
  for (const m of String(xml || "").matchAll(/<event>([\s\S]*?)<\/event>/g)) {
    const r = parseUnionEvent(m[1]);
    if (r.event) events.push(r.event); else dropped.push(r.drop);
  }
  return { events, dropped };
}

export function countUnionTitles(xml) {
  return (String(xml || "").match(/<event_title>/g) || []).length;
}

/* Connect's dated rows (from nextDated) as explorer events. */
export function fromConnectRows(rows) {
  return (rows || []).map((r) => ({
    id: `badger-${r.event}`,
    title: cap(plainText(r.short || r.title), 160),
    start: r.startsAt, end: r.endsAt || null,
    allDay: false,
    place: r.place?.name || null,
    organizer: SOURCE_NAMES.badger,
    sources: [{ source: "badger", name: SOURCE_NAMES.badger, url: r.href || null }],
    cost: null, status: null,
    tags: [], categories: [],
    blurb: cap(plainText(r.tagline || ""), 280) || null,
    badger: true,
  })).filter((e) => Number.isFinite(Date.parse(e.start)));
}

/* The start to the minute, as an instant: two feeds write the same moment with different offsets. */
const dedupKey = (e) => `${norm(e.title)}|${Math.floor(Date.parse(e.start) / 60000)}|${norm(e.place || "")}`;

/* The three lists as one: a listing in both external feeds (the Union cross-posts to the campus
 * calendar) becomes one card keeping both source links; Badger Supports programs never merge into
 * an external listing. Only events running into the window are kept. A place a feed names by a
 * short name is first put in its full form (src/shared/place-names.mjs), so the two writings of
 * one room are one listing. */
export function mergeCampusEvents({ uw = [], union = [], badger = [] } = {}, { from, to } = {}) {
  const dropped = [];
  const byKey = new Map();
  const out = [];
  const atFullName = (e) => (typeof e?.place === "string" ? { ...e, place: canonicalPlaceName(e.place) } : e);
  const put = (e) => {
    const key = dedupKey(e);
    const held = byKey.get(key);
    if (!held) { byKey.set(key, e); out.push(e); return; }
    for (const s of e.sources) if (!held.sources.some((x) => x.source === s.source)) held.sources.push(s);
    held.cost = held.cost || e.cost;
    held.status = held.status || e.status;
    held.end = held.end || e.end;
    if ((e.blurb || "").length > (held.blurb || "").length) held.blurb = e.blurb;
    held.tags = [...new Set([...held.tags, ...e.tags])];
    held.categories = [...new Set([...held.categories, ...e.categories])];
    dropped.push(`merged duplicate: "${e.title.slice(0, 60)}"`);
  };
  for (const e of uw) put(atFullName(e));
  for (const e of union) put(atFullName(e));
  for (const e of badger) out.push(atFullName(e));
  const fromMs = from ? Date.parse(`${from}T00:00:00-06:00`) : -Infinity;
  const toMs = to ? Date.parse(`${to}T23:59:59-06:00`) : Infinity;
  const events = out.filter((e) => { const s = Date.parse(e.start); const en = Date.parse(e.end || e.start); return en >= fromMs && s <= toMs; })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title));
  return { events, dropped };
}

/* Reads the two external feeds for the window. Throws only when both fail; a single failed source
 * contributes nothing and is named in the report, so the caller can fall back to its last good list. */
export async function fetchCampusEvents({ fetchImpl = fetch, today, days = 62 } = {}) {
  const to = addDays(today, days);
  const dropped = [];
  let uw = [], union = [], unionTitles = 0, failed = 0;
  try {
    const all = [];
    for (let page = 1; page <= 6; page++) {
      const url = `${UW_EVENTS_URL}?start=${today}&end=${to}&limit=100&per_page=100&page=${page}`;
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`UW Events answered ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("UW Events did not answer with a list");
      all.push(...rows);
      if (rows.length < 100) break;
    }
    for (const row of all) { const r = parseUwEvent(row); if (r.event) uw.push(r.event); else dropped.push(r.drop); }
  } catch (e) { failed++; dropped.push(`UW Events could not be read (${e.message})`); }
  try {
    const res = await fetchImpl(UNION_FEED_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`the Union feed answered ${res.status}`);
    const parsed = parseUnionFeed(await res.text());
    union = parsed.events; dropped.push(...parsed.dropped);
  } catch (e) { failed++; dropped.push(`the Union feed could not be read (${e.message})`); }
  try {
    const res = await fetchImpl(UNION_TITLES_URL, { signal: AbortSignal.timeout(15_000) });
    if (res.ok) unionTitles = countUnionTitles(await res.text());
  } catch { /* the count is a check, not data: its failure changes nothing */ }
  if (failed === 2) throw new Error("Neither UW Events nor the Union feed could be read.");
  const merged = mergeCampusEvents({ uw, union }, { from: today, to });
  dropped.push(...merged.dropped);
  return {
    events: merged.events,
    report: { read: { uw: uw.length, union: union.length, unionTitles }, shown: merged.events.length, dropped },
    updated: new Date().toISOString(),
  };
}

/* Prototype data, used only by a build that is not production (the prototype is noindex and its
 * people are fictional too): a small set across the three sources, dated from the build's today so
 * the page always has something to show. */
export function fixtureCampusEvents(today) {
  const at = (plus, hm) => chicagoInstant(addDays(today, plus), hm);
  const mk = (plus, hm, endHm, rest) => ({ start: at(plus, hm), end: endHm ? at(plus, endHm) : null, allDay: false, status: null, cost: null, tags: [], categories: [], blurb: null, badger: false, ...rest });
  return [
    mk(0, "17:00", "19:00", { id: "uw-fixture-1", title: "Arboretum Night Walk", place: "UW–Madison Arboretum", organizer: "Arboretum", sources: [{ source: "uw", name: SOURCE_NAMES.uw, url: "https://today.wisc.edu/" }], tags: ["nature", "environment"], blurb: "A guided evening walk through the Arboretum's prairies and woodlands." }),
    mk(1, "19:00", "21:00", { id: "union-fixture-1", title: "WUD Film Presents: A Classic", place: "Marquee Cinema, Union South", organizer: "WUD Film", sources: [{ source: "union", name: SOURCE_NAMES.union, url: "https://union.wisc.edu/events-and-activities/event-calendar/" }], categories: ["Film"], cost: "Free for students" }),
    mk(2, "18:00", "20:00", { id: "union-fixture-2", title: "WUD Games Committee", place: "Memorial Union", organizer: "WUD Games", sources: [{ source: "union", name: SOURCE_NAMES.union, url: "https://union.wisc.edu/events-and-activities/event-calendar/" }], categories: ["Games"], status: null }),
    mk(3, "12:00", "13:00", { id: "uw-fixture-2", title: "Research Showcase: Student Posters", place: "Discovery Building", organizer: "Graduate School", sources: [{ source: "uw", name: SOURCE_NAMES.uw, url: "https://today.wisc.edu/" }], tags: ["science", "research"] }),
    mk(5, "16:30", "18:00", { id: "badger-fixture-1", title: "Peer Support Group", place: "Student Mental Health Hub", organizer: SOURCE_NAMES.badger, sources: [{ source: "badger", name: SOURCE_NAMES.badger, url: "/join/peer-support-groups/" }], badger: true }),
  ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
