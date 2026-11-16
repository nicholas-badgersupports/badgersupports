/* Metro's GTFS-RT wire format, read by netlify/lib/gtfsrt.mjs (Explore redesign,
 * 15 Nov 2026). The fixtures are the live feeds exactly as Metro served them on
 * 15 Nov 2026 at 23:46 — late Sunday, service winding down — kept because the
 * feed speaks two dialects of the format (stop updates at TripUpdate field 2,
 * alert title and body at fields 10 and 11) and only a real capture proves the
 * reader against them. The assertions stay loose on purpose: they pin the
 * shapes and the dialect, not one evening's buses. */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { decodeFeed } from "../netlify/lib/gtfsrt.mjs";

const read = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

test("the trips capture decodes: trip updates carry stop ids and absolute times", () => {
  const d = decodeFeed(read("gtfsrt-trips.bin"));
  assert.ok(d.timestamp > 0, "the feed's own timestamp");
  assert.ok(d.tripUpdates.length >= 10, `trip updates read (${d.tripUpdates.length})`);
  const withStops = d.tripUpdates.filter((t) => t.stops.length > 0);
  assert.ok(withStops.length >= 10, "stop updates ride at the field Metro uses, not only the published one");
  const withTimes = withStops.flatMap((t) => t.stops).filter((s) => s.departureTime != null || s.arrivalTime != null);
  assert.ok(withTimes.length > 50, `absolute stop times read (${withTimes.length})`);
  for (const s of withTimes.slice(0, 25)) {
    assert.equal(typeof s.stopId, "string");
    const t = s.departureTime ?? s.arrivalTime;
    assert.ok(t > d.timestamp - 3600 && t < d.timestamp + 30 * 3600, "a stop time in the feed's own service horizon (it carries next-morning trips too)");
  }
  const identified = d.tripUpdates.filter((t) => t.tripId);
  assert.ok(identified.length >= 10, "most updates name their trip in the static timetable's ids");
});

test("the vehicles capture decodes: buses with Madison coordinates", () => {
  const d = decodeFeed(read("gtfsrt-vehicles.bin"));
  assert.ok(d.vehicles.length >= 1, "vehicles read");
  for (const v of d.vehicles) {
    assert.ok(v.lat > 42.9 && v.lat < 43.2 && v.lon > -89.7 && v.lon < -89.1, "a Madison position");
  }
  assert.ok(d.vehicles.some((v) => v.tripId && v.routeId), "a bus in service names its trip and route");
});

test("the alerts capture decodes: title, body and detour link, routes named", () => {
  const d = decodeFeed(read("gtfsrt-alerts.bin"));
  assert.ok(d.alerts.length >= 5, `alerts read (${d.alerts.length})`);
  const titled = d.alerts.filter((a) => a.header && a.description);
  assert.ok(titled.length >= 5, "titles and bodies ride at the fields Metro uses");
  const linked = d.alerts.filter((a) => a.url && a.url.startsWith("https://www.cityofmadison.com/"));
  assert.ok(linked.length >= 5, "the detour link is kept as a link, not read as the title");
  const routed = d.alerts.filter((a) => a.routes.length > 0);
  assert.ok(routed.length >= 5, "alerts name their routes");
  for (const a of d.alerts) assert.ok(!a.header.includes("http"), "no alert title is a web address");
});

test("an empty feed decodes to the empty shape", () => {
  const empty = decodeFeed(Buffer.alloc(0));
  assert.deepEqual(empty, { timestamp: null, tripUpdates: [], vehicles: [], alerts: [] });
});
