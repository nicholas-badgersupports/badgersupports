/* The bus page's live half: Madison Metro's static timetable (content/transit/
 * schedule.json, carried in .build/server.json) merged with Metro's own GTFS-RT
 * feeds (netlify/lib/gtfsrt.mjs) — Trip Updates for the times, Vehicle Positions
 * for the map's buses, Alerts for the notices that ride with the departures.
 *
 * The merge rule is the redesign's (15 Nov 2026): a departure the live feed
 * speaks for shows its predicted time and says so; one it does not speak for
 * keeps its scheduled time, labelled Scheduled by the page; a trip or stop the
 * feed marks cancelled shows as cancelled, never silently dropped. A feed that
 * cannot be read leaves the schedule standing alone — the page says live times
 * are off rather than pretending. Each feed is read at most once per freshness
 * window per warm function (25 seconds for trips and vehicles, a minute for
 * alerts), and a failed read falls back to the last good copy for five
 * minutes; the router marks the answer no-store, so the sharing happens here,
 * in the function, not at the edge.
 *
 * Times: the timetable's seconds run from a service day's Chicago midnight and
 * may pass 24:00 (a 25:10 trip is 1:10 AM on the next civil day, on the same
 * service day), so departures are gathered for yesterday's and today's service
 * days and placed by the Chicago-midnight instant of each. */

import { serverContent } from "./content.mjs";
import { decodeFeed } from "./gtfsrt.mjs";

export const RT_URLS = {
  trips: "https://metromap.cityofmadison.com/gtfsrt/trips",
  vehicles: "https://metromap.cityofmadison.com/gtfsrt/vehicles",
  alerts: "https://metromap.cityofmadison.com/gtfsrt/alerts",
};
const FRESH_MS = { trips: 25_000, vehicles: 25_000, alerts: 60_000 };
const STALE_OK_MS = 5 * 60_000;
const AHEAD_MS = 3 * 60 * 60_000;
const BEHIND_MS = 45 * 60_000;
const PER_STOP = 10;

const TZ = "America/Chicago";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const chicagoDayOf = (ms) => dayFmt.format(new Date(ms));
export const addDays = (dateStr, n) => { const d = new Date(`${dateStr}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* The UTC instant of a Chicago midnight: read the zone's offset at the day's
 * UTC midnight and step back by it. One reading is enough — an offset change
 * inside the step happens only on the two DST mornings, and the live merge
 * dominates the error there. */
export function chicagoMidnightMs(dateStr) {
  const guess = Date.parse(`${dateStr}T00:00:00Z`);
  const as = {};
  for (const p of partsFmt.formatToParts(new Date(guess))) as[p.type] = p.value;
  const localAsUtc = Date.UTC(+as.year, +as.month - 1, +as.day, (+as.hour) % 24, +as.minute, +as.second);
  return guess - (localAsUtc - guess);
}

/* A pattern's stops and offsets ride in the schedule file as slash-joined
 * strings (the builder's note in ops/transit.mjs says why); an array is taken
 * as it stands, so a schedule written either way reads the same. */
const nums = (v) => (Array.isArray(v) ? v : String(v ?? "").split("/").filter((x) => x !== "").map(Number));

/* The schedule with its lookups built once: every trip expanded onto its
 * pattern's stops, each stop holding its departures in time order. */
let heldIndex = null;
let heldSchedule = null;
export function scheduleIndex(schedule) {
  if (heldIndex && heldSchedule === schedule) return heldIndex;
  const routeById = new Map((schedule.routes || []).map((r, i) => [r.id, i]));
  const trips = (schedule.trips || []).map((t) => {
    const p = (schedule.patterns || [])[t.pattern];
    if (!p) return null;
    return { id: t.id, service: t.service, start: t.start, route: routeById.get(p.route), dir: p.dir, headsign: (schedule.headsigns || [])[p.headsign] || "", pattern: t.pattern };
  }).filter(Boolean);
  const byStop = new Map();
  trips.forEach((trip, ti) => {
    const p = schedule.patterns[trip.pattern];
    const stops = nums(p.stops);
    const offsets = nums(p.offsets);
    stops.forEach((stopIdx, i) => {
      const list = byStop.get(stopIdx) || [];
      list.push({ trip: ti, sec: trip.start + offsets[i] });
      byStop.set(stopIdx, list);
    });
  });
  for (const list of byStop.values()) list.sort((a, b) => a.sec - b.sec);
  heldIndex = {
    schedule, trips, byStop,
    stopIdToIdx: new Map((schedule.stops || []).map((id, i) => [id, i])),
    routeById,
  };
  heldSchedule = schedule;
  return heldIndex;
}

/* The services running on one Chicago date: the weekly pattern, with the
 * day's dated exceptions laid over it (1 adds, 2 removes). */
export function activeServices(schedule, dateStr) {
  const dow = (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7;
  const on = new Set();
  (schedule.services || []).forEach((s, i) => { if (s.start <= dateStr && dateStr <= s.end && s.days[dow]) on.add(i); });
  for (const [si, type] of schedule.exceptions?.[dateStr] || []) { if (type === 1) on.add(si); else if (type === 2) on.delete(si); }
  return on;
}

/* Departures at the given stop indices, merged. `rt` is a decoded Trip Updates
 * feed or null. Returns a Map from stop index to its departures, soonest first,
 * each { route, headsign, dir, time, scheduled, live, delaySec, cancelled, trip }
 * with times as ISO strings. */
export function mergedDepartures(index, stopIdxs, { now = Date.now(), rt = null, routeName = null } = {}) {
  const byTrip = new Map();
  if (rt) for (const tu of rt.tripUpdates || []) if (tu.tripId && !byTrip.has(tu.tripId)) byTrip.set(tu.tripId, tu);
  const today = chicagoDayOf(now);
  const out = new Map(stopIdxs.map((si) => [si, []]));
  const seen = new Set();
  for (const dayOffset of [-1, 0]) {
    const date = addDays(today, dayOffset);
    const active = activeServices(index.schedule, date);
    if (!active.size) continue;
    const dayStart = chicagoMidnightMs(date);
    for (const si of stopIdxs) {
      const gtfsStopId = index.schedule.stops[si];
      for (const e of index.byStop.get(si) || []) {
        const trip = index.trips[e.trip];
        if (!active.has(trip.service)) continue;
        const route = index.schedule.routes[trip.route];
        if (!route) continue;
        if (routeName && route.name !== routeName) continue;
        const schedMs = dayStart + e.sec * 1000;
        if (schedMs < now - BEHIND_MS || schedMs > now + AHEAD_MS) continue;
        let ms = schedMs, live = false, delaySec = null, cancelled = false;
        const tu = byTrip.get(trip.id);
        if (tu) {
          if (tu.relationship === 3) cancelled = true;
          const stu = (tu.stops || []).find((s) => s.stopId === gtfsStopId);
          if (stu) {
            if (stu.relationship === 1) cancelled = true;
            const abs = stu.departureTime ?? stu.arrivalTime;
            const delay = stu.departureDelay ?? stu.arrivalDelay ?? tu.delay;
            if (abs != null) { ms = abs * 1000; delaySec = Math.round((ms - schedMs) / 1000); live = true; }
            else if (delay != null) { ms = schedMs + delay * 1000; delaySec = delay; live = true; }
          } else if (tu.delay != null) {
            ms = schedMs + tu.delay * 1000; delaySec = tu.delay; live = true;
          }
        }
        if (!cancelled && ms < now - 60_000) continue;
        /* A trip evaluated on both service days is one bus, not two. */
        const key = `${trip.id}|${ms}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.get(si).push({
          route: route.name, headsign: trip.headsign, dir: trip.dir,
          time: new Date(ms).toISOString(), scheduled: new Date(schedMs).toISOString(),
          live, delaySec, cancelled, trip: trip.id,
        });
      }
    }
  }
  for (const [si, list] of out) out.set(si, list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time)).slice(0, PER_STOP));
  return out;
}

/* The alerts that belong with a set of departures: ones naming one of its
 * routes or stops, and ones naming nothing (they are for everyone). */
export function alertsFor(alerts, { routes = new Set(), stops = new Set() } = {}) {
  return (alerts || []).filter((a) => {
    const named = (a.routes?.length || 0) + (a.stops?.length || 0) > 0;
    if (!named) return true;
    return (a.routes || []).some((r) => routes.has(r)) || (a.stops || []).some((s) => stops.has(s));
  }).map((a) => ({ header: a.header, description: a.description, url: a.url, routes: a.routes || [] }));
}

/* One feed, read at most once per freshness window; a failed read serves the
 * last good copy inside its stale window, and nothing outside it. */
const rtHeld = { trips: null, vehicles: null, alerts: null };
export function forgetRt() { for (const k of Object.keys(rtHeld)) rtHeld[k] = null; }
async function rtFeed(kind, fetchImpl) {
  const now = Date.now();
  const held = rtHeld[kind];
  if (held && now - held.at < FRESH_MS[kind]) return held.data;
  try {
    const res = await fetchImpl(RT_URLS[kind], { signal: AbortSignal.timeout(8_000), headers: { "user-agent": "BadgerSupportsWebsite/1.0" } });
    if (!res.ok) throw new Error(`the ${kind} feed answered ${res.status}`);
    const data = decodeFeed(Buffer.from(await res.arrayBuffer()));
    rtHeld[kind] = { at: now, data };
    return data;
  } catch {
    if (held && now - held.at < STALE_OK_MS) return held.data;
    return null;
  }
}

const stopList = (param) => [...new Set(String(param || "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 48);

/* GET /api/transit/departures?stops=<gtfs ids>&route=<name> */
export async function transitDepartures(searchParams, { fetchImpl = fetch, now = Date.now() } = {}) {
  const schedule = serverContent().transit?.schedule;
  if (!schedule) return { ok: true, live: false, generatedAt: new Date(now).toISOString(), feed: null, stops: {}, alerts: [] };
  const index = scheduleIndex(schedule);
  const wanted = stopList(searchParams.get("stops"));
  const idxs = wanted.map((id) => index.stopIdToIdx.get(id)).filter((i) => i != null);
  const routeName = searchParams.get("route") || null;
  const [tu, al] = await Promise.all([rtFeed("trips", fetchImpl), rtFeed("alerts", fetchImpl)]);
  const merged = mergedDepartures(index, idxs, { now, rt: tu, routeName });
  const stops = {};
  const routeSet = new Set(routeName ? [routeName] : []);
  for (const [si, list] of merged) {
    stops[schedule.stops[si]] = list;
    for (const d of list) routeSet.add(d.route);
  }
  return {
    ok: true, live: !!tu, generatedAt: new Date(now).toISOString(), feed: schedule.feed,
    stops,
    alerts: alertsFor(al?.alerts, { routes: routeSet, stops: new Set(wanted) }),
  };
}

/* GET /api/transit/vehicles?route=<name> */
export async function transitVehicles(searchParams, { fetchImpl = fetch } = {}) {
  const routeName = searchParams.get("route") || null;
  const veh = await rtFeed("vehicles", fetchImpl);
  const vehicles = (veh?.vehicles || [])
    .filter((v) => v.lat != null && v.lon != null && (!routeName || v.routeId === routeName))
    .map((v) => ({ route: v.routeId, trip: v.tripId, lat: v.lat, lon: v.lon, bearing: v.bearing }));
  return { ok: true, live: !!veh, generatedAt: new Date().toISOString(), vehicles };
}
