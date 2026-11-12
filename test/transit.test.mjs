/* EXPLORE-I-BUS-ROUTES (WORK item 45): the classification is read off route topology alone —
 * a pair served by one route is direct, a pair needing two routes is a transfer, an unserved
 * pair has no suitable connection — and nothing in the data or the answer is a time. The fixture
 * is a hand-built miniature GTFS; the real feed's topology was checked against known pairs on
 * 11 Nov 2026 (docs/research/EXPLORE-TRANSIT-VERIFICATION-2026-11-11.md). */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildTopology, indexTopology, classifyPair, classifyMatrix, stopsNear } from "../ops/transit.mjs";

const stopsTxt = [
  "stop_id,stop_name,stop_lat,stop_lon",
  "a1,Alpha West,43.0700,-89.4100",
  "a2,Alpha Mid,43.0750,-89.4050",
  "a3,Alpha East,43.0752,-89.4000",
  "b1,Beta South,43.0600,-89.4050",
  "b2,Beta Mid,43.0750,-89.4050",
  "b3,Beta West,43.0755,-89.4200",
  "z1,Far Away,43.2000,-89.6000",
].join("\n");
const routesTxt = ["route_id,route_short_name,route_long_name", "RA,A,Alpha", "RB,B,Beta", "RZ,Z,Far"].join("\n");
const tripsTxt = ["trip_id,route_id", "t1,RA", "t2,RB", "t3,RZ"].join("\n");
const stopTimesTxt = [
  "trip_id,arrival_time,departure_time,stop_id",
  "t1,08:00:00,08:00:00,a1", "t1,08:05:00,08:05:00,a2", "t1,08:09:00,08:09:00,a3",
  "t2,09:00:00,09:00:00,b1", "t2,09:06:00,09:06:00,a2", "t2,09:12:00,09:12:00,b3",
  "t3,10:00:00,10:00:00,z1",
].join("\n");
const feedInfoTxt = ["feed_publisher_name,feed_version,feed_start_date,feed_end_date", "Metro Transit-City of Madison,FIX,20260101,20261231"].join("\n");

const topology = buildTopology({ stopsTxt, routesTxt, tripsTxt, stopTimesTxt, feedInfoTxt });
const index = indexTopology(topology);

const near = (lat, lon) => ({ lat, lon });

test("the topology keeps routes and stops, and no times", () => {
  assert.equal(topology.routes.length, 3);
  assert.equal(topology.stops.length, 7);
  assert.equal(topology.feed.version, "FIX");
  assert.ok(!JSON.stringify(topology).match(/arrival_time|departure_time|08:00/), "no time field survives into the topology");
  assert.deepEqual(topology.routes.find((r) => r.name === "A").stops.sort(), ["a1", "a2", "a3"]);
});

test("a pair served by one route reads direct", () => {
  const r = classifyPair(index, near(43.0701, -89.4101), near(43.0753, -89.4001));
  assert.equal(r.kind, "direct");
  assert.deepEqual(r.routes, ["A"]);
  assert.equal(r.board.name, "Alpha West");
  assert.equal(r.alight.name, "Alpha East");
  assert.ok(r.board.walkM < 30 && r.alight.walkM < 30);
});

test("a pair needing two routes reads transfer, with the change stop named", () => {
  const r = classifyPair(index, near(43.0701, -89.4101), near(43.0601, -89.4051));
  assert.equal(r.kind, "transfer");
  assert.deepEqual(r.routes, ["A", "B"]);
  assert.equal(r.via.name, "Alpha Mid", "route A and route B share the Alpha Mid stop");
  assert.equal(r.board.name, "Alpha West");
  assert.equal(r.alight.name, "Beta South");
});

test("an unserved pair reads no suitable connection", () => {
  const r = classifyPair(index, near(43.2001, -89.6001), near(43.0300, -89.3000));
  assert.equal(r.kind, "none");
  assert.equal(r.routes, undefined);
});

test("the matrix answers every address × building pair", () => {
  const out = classifyMatrix(index, [near(43.0701, -89.4101)], [{ id: "x", ...near(43.0753, -89.4001) }, { id: "y", ...near(43.03, -89.3) }]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].cells.map((c) => [c.building, c.kind]), [["x", "direct"], ["y", "none"]]);
});

test("stops near a point come with walking distances, nearest first", () => {
  const nearList = stopsNear(index, near(43.0750, -89.4050), 600);
  assert.ok(nearList.length >= 2);
  assert.ok(nearList[0].walkM <= nearList[1].walkM);
});
