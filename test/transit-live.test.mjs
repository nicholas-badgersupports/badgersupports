/* The bus page's live merge (Explore redesign, 15 Nov 2026): the static
 * timetable plus Metro's GTFS-RT, merged in netlify/lib/transit-live.mjs.
 * A miniature hand-built timetable stands in for the feed — one route, one
 * pattern, two stops — and each rule of the merge gets its own case: a delay
 * moves a departure and marks it live; an absolute predicted time does the
 * same and derives the delay; a trip or a stop the feed cancels shows as
 * cancelled; a service exception removes and adds a day; a trip past 24:00
 * belongs to the service day that started it. Chicago-midnight placement is
 * pinned against the known November offset (CST, UTC-6). */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { useContent } from "../netlify/lib/content.mjs";
import {
  scheduleIndex, activeServices, mergedDepartures, chicagoMidnightMs, chicagoDayOf,
  transitDepartures, transitVehicles, forgetRt, RT_URLS,
} from "../netlify/lib/transit-live.mjs";

const SCHEDULE = {
  feed: { version: "TEST", from: "2026-11-01", to: "2026-12-31" },
  stops: ["100", "200"],
  routes: [{ id: "80", name: "80", long: "Campus Bus", color: "2272B5", text: "FFFFFF" }],
  headsigns: ["Memorial Union"],
  patterns: [{ route: "80", dir: 0, headsign: 0, shape: 0, stops: [0, 1], offsets: [0, 300] }],
  shapes: [],
  services: [{ start: "2026-11-01", end: "2026-12-31", days: [1, 1, 1, 1, 1, 0, 0] }],
  exceptions: { "2026-11-26": [[0, 2]], "2026-11-28": [[0, 1]] },
  trips: [
    { id: "T1", pattern: 0, service: 0, start: 28800 },
    { id: "T2", pattern: 0, service: 0, start: 90000 },
  ],
};
const index = scheduleIndex(SCHEDULE);
const MON = chicagoMidnightMs("2026-11-23"); // a Monday
const at = (dayMs, h, m = 0) => dayMs + (h * 3600 + m * 60) * 1000;

test("Chicago midnight in November is 06:00 UTC, and the day reads back", () => {
  assert.equal(MON, Date.parse("2026-11-23T06:00:00Z"));
  assert.equal(chicagoDayOf(at(MON, 12)), "2026-11-23");
  assert.equal(chicagoDayOf(at(MON, 23, 59)), "2026-11-23");
});

test("service exceptions remove a weekday and add a Saturday", () => {
  assert.equal(activeServices(SCHEDULE, "2026-11-23").has(0), true, "an ordinary Monday runs");
  assert.equal(activeServices(SCHEDULE, "2026-11-26").has(0), false, "the exception takes Thanksgiving off");
  assert.equal(activeServices(SCHEDULE, "2026-11-28").has(0), true, "the exception adds the Saturday");
  assert.equal(activeServices(SCHEDULE, "2026-11-29").has(0), false, "an ordinary Sunday does not run");
});

test("scheduled departures stand alone when the feed is silent", () => {
  const out = mergedDepartures(index, [0], { now: at(MON, 7, 30) });
  const deps = out.get(0);
  assert.equal(deps.length, 1);
  assert.equal(deps[0].route, "80");
  assert.equal(deps[0].headsign, "Memorial Union");
  assert.equal(deps[0].time, new Date(at(MON, 8)).toISOString());
  assert.equal(deps[0].live, false);
  assert.equal(deps[0].delaySec, null);
  assert.equal(deps[0].cancelled, false);
});

test("a delay moves the departure and marks it live", () => {
  const rt = { tripUpdates: [{ tripId: "T1", stops: [{ stopId: "100", departureDelay: 300, arrivalDelay: null, departureTime: null, arrivalTime: null, relationship: 0 }] }] };
  const deps = mergedDepartures(index, [0], { now: at(MON, 7, 30), rt }).get(0);
  assert.equal(deps[0].time, new Date(at(MON, 8, 5)).toISOString());
  assert.equal(deps[0].live, true);
  assert.equal(deps[0].delaySec, 300);
  assert.equal(deps[0].scheduled, new Date(at(MON, 8)).toISOString());
});

test("an absolute predicted time does the same and derives the delay", () => {
  const abs = Math.round(at(MON, 8, 7) / 1000);
  const rt = { tripUpdates: [{ tripId: "T1", stops: [{ stopId: "100", departureTime: abs, arrivalTime: null, departureDelay: null, arrivalDelay: null, relationship: 0 }] }] };
  const deps = mergedDepartures(index, [0], { now: at(MON, 7, 30), rt }).get(0);
  assert.equal(deps[0].time, new Date(abs * 1000).toISOString());
  assert.equal(deps[0].delaySec, 420);
  assert.equal(deps[0].live, true);
});

test("a cancelled trip and a skipped stop both show as cancelled", () => {
  const rtTrip = { tripUpdates: [{ tripId: "T1", relationship: 3, stops: [] }] };
  assert.equal(mergedDepartures(index, [0], { now: at(MON, 7, 30), rt: rtTrip }).get(0)[0].cancelled, true);
  const rtStop = { tripUpdates: [{ tripId: "T1", stops: [{ stopId: "100", relationship: 1, departureTime: null, arrivalTime: null, departureDelay: null, arrivalDelay: null }] }] };
  assert.equal(mergedDepartures(index, [0], { now: at(MON, 7, 30), rt: rtStop }).get(0)[0].cancelled, true);
});

test("a trip past 24:00 belongs to the service day that started it", () => {
  const tue = chicagoMidnightMs("2026-11-24");
  const deps = mergedDepartures(index, [0], { now: at(tue, 0, 30) }).get(0);
  assert.equal(deps.length, 1);
  assert.equal(deps[0].trip, "T2");
  assert.equal(deps[0].time, new Date(at(tue, 1)).toISOString());
});

test("the route filter keeps only the named route, and a removed day is empty", () => {
  assert.equal(mergedDepartures(index, [0], { now: at(MON, 7, 30), routeName: "A" }).get(0).length, 0);
  const thu = chicagoMidnightMs("2026-11-26");
  assert.equal(mergedDepartures(index, [0], { now: at(thu, 7, 30) }).get(0).length, 0);
});

/* The endpoint pair, with the feeds faked from the captured fixtures: the
 * departures answer stands on the schedule alone when every feed read fails,
 * and the vehicles answer reads the real capture. */
const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const feedFetch = (bodies) => async (url) => {
  const body = bodies[url];
  if (!body) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
  return { ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
};

test("departures endpoint: a dead feed leaves scheduled times, live off", async () => {
  useContent({ transit: { schedule: SCHEDULE } });
  forgetRt();
  const r = await transitDepartures(new URLSearchParams("stops=100"), { fetchImpl: feedFetch({}), now: at(MON, 7, 30) });
  assert.equal(r.ok, true);
  assert.equal(r.live, false);
  assert.equal(r.stops["100"].length, 1);
  assert.equal(r.stops["100"][0].live, false);
});

test("vehicles endpoint: the real capture, filtered by route", async () => {
  forgetRt();
  const all = await transitVehicles(new URLSearchParams(""), { fetchImpl: feedFetch({ [RT_URLS.vehicles]: fixture("gtfsrt-vehicles.bin") }) });
  assert.equal(all.live, true);
  assert.ok(all.vehicles.length >= 1);
  forgetRt();
  const only81 = await transitVehicles(new URLSearchParams("route=81"), { fetchImpl: feedFetch({ [RT_URLS.vehicles]: fixture("gtfsrt-vehicles.bin") }) });
  assert.ok(only81.vehicles.length >= 1);
  assert.ok(only81.vehicles.every((v) => v.route === "81"));
});
