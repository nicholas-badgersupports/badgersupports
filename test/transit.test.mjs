/* The bus page's data (Explore redesign, 15 Nov 2026): one GTFS download becomes the
 * browser's route-and-shape data and the function's pattern timetable. The fixture is a
 * hand-built miniature GTFS: two trips on one pattern (same stops, same offsets) must
 * collapse to one pattern with two starts; a loop shape that ends where it began must
 * survive thinning; headsigns print in title case. The real feed's build was checked
 * against the published counts when the artifacts were generated (876 patterns,
 * 14,199 trips, 19 campus routes on feed S072). */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildTransitData, simplifyShape, displayHeadsign, gtfsSeconds } from "../ops/transit.mjs";

const stopsTxt = [
  "stop_id,stop_code,stop_name,stop_lat,stop_lon",
  "a1,0001,Alpha West,43.0700,-89.4100",
  "a2,0002,Alpha Mid,43.0750,-89.4050",
  "a3,0003,Alpha East,43.0752,-89.4000",
  "b1,0004,Beta South,43.0600,-89.4050",
].join("\n");
const routesTxt = [
  "route_id,route_short_name,route_long_name,route_color,route_text_color,route_sort_order",
  "RA,A,Alpha Line,FF0000,FFFFFF,1",
  "RB,B,Beta Line,00FF00,000000,2",
].join("\n");
const tripsTxt = [
  "trip_id,route_id,service_id,trip_headsign,direction_id,shape_id",
  "t1,RA,wd,ALPHA EAST,0,shp-a",
  "t2,RA,wd,ALPHA EAST,0,shp-a",
  "t3,RA,wd,ALPHA EAST,0,shp-a",
  "t4,RB,sat,BETA SOUTH,1,shp-b",
].join("\n");
const stopTimesTxt = [
  "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
  "t1,08:00:00,08:00:00,a1,1", "t1,08:05:00,08:05:00,a2,2", "t1,08:09:00,08:09:00,a3,3",
  "t2,09:00:00,09:00:00,a1,1", "t2,09:05:00,09:05:00,a2,2", "t2,09:09:00,09:09:00,a3,3",
  "t3,10:00:00,10:00:00,a1,1", "t3,10:07:00,10:07:00,a2,2", "t3,10:11:00,10:11:00,a3,3",
  "t4,11:00:00,11:00:00,b1,1", "t4,11:06:00,11:06:00,a2,2",
].join("\n");
const shapesTxt = [
  "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence",
  "shp-a,43.0700,-89.4100,1", "shp-a,43.0730,-89.4060,2", "shp-a,43.0750,-89.4050,3", "shp-a,43.0752,-89.4000,4",
  "shp-b,43.0600,-89.4050,1", "shp-b,43.0750,-89.4050,2",
].join("\n");
const calendarTxt = [
  "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
  "wd,1,1,1,1,1,0,0,20260101,20261231",
  "sat,0,0,0,0,0,1,0,20260101,20261231",
].join("\n");
const calendarDatesTxt = [
  "service_id,date,exception_type",
  "wd,20260703,2",
  "sat,20260703,1",
].join("\n");
const feedInfoTxt = ["feed_publisher_name,feed_version,feed_start_date,feed_end_date", "Metro Transit-City of Madison,FIX,20260101,20261231"].join("\n");

const { client, schedule } = buildTransitData({
  stopsTxt, routesTxt, tripsTxt, stopTimesTxt, shapesTxt, calendarTxt, calendarDatesTxt, feedInfoTxt,
  panels: [{ id: "mid", label: "Alpha Mid", stops: ["a2"] }],
});

test("the two artifacts name the feed and carry its credit", () => {
  assert.equal(client.feed.version, "FIX");
  assert.equal(client.feed.start, "2026-01-01");
  assert.equal(schedule.feed.end, "2026-12-31");
  assert.match(client.credit, /license granted by City of Madison/);
});

test("trips on one pattern collapse; a different timing is its own pattern", () => {
  assert.equal(schedule.patterns.length, 3, "t1+t2 share a pattern; t3's offsets differ; t4 is its own");
  const a = schedule.patterns.filter((p) => p.route === "RA");
  assert.equal(a.length, 2);
  const shared = a.find((p) => p.offsets === "0/300/540");
  assert.ok(shared, "the shared pattern keeps the offsets from its start, slash-joined as the schedule file carries them");
  assert.equal(shared.stops, "0/1/2", "pattern stops are indices into the shared stop list, slash-joined the same way");
  const starts = schedule.trips.filter((t) => t.pattern === schedule.patterns.indexOf(shared)).map((t) => t.start).sort((x, y) => x - y);
  assert.deepEqual(starts, [28800, 32400], "both trips ride the pattern at their own starts");
});

test("services carry their week and their dated exceptions", () => {
  const wd = schedule.services.find((s) => s.id === "wd");
  assert.deepEqual(wd.days, [1, 1, 1, 1, 1, 0, 0]);
  const ex = schedule.exceptions["2026-07-03"];
  assert.ok(ex, "the exception date is carried");
  assert.deepEqual(ex.find(([si]) => si === schedule.services.indexOf(wd)), [schedule.services.indexOf(wd), 2], "wd is removed that day");
});

test("the browser's routes carry colours, headsigns in title case, stop order and shape", () => {
  const ai = client.routes.findIndex((r) => r.name === "A");
  const a = client.routes[ai];
  assert.equal(a.color, "ff0000");
  assert.equal(client.schema, "bss.transit-data/2");
  const vs = client.variants[ai];
  assert.equal(vs.length, 1, "the variants list stands parallel to the routes");
  assert.equal(vs[0].headsign, "Alpha East");
  assert.equal(vs[0].stops, "0/1/2", "a variant's stops ride slash-joined");
  assert.ok(vs[0].trips >= 1, "a variant carries its trip count");
  assert.ok(client.shapes[vs[0].shape].length >= 3, "the shape the variant names survives thinning");
  assert.equal(client.panels[0].stops, "1", "a panel's stops resolve to indices, slash-joined");
});

test("the routes Nicholas named (W, G, P, S, 55) are left out of both artifacts", () => {
  const goneRoutesTxt = [
    "route_id,route_short_name,route_long_name,route_color,route_text_color,route_sort_order",
    "RA,A,Alpha Line,FF0000,FFFFFF,1",
    "RW,W,West Line,0000FF,FFFFFF,2",
    "R55,55,Fifty Five Line,00FFFF,000000,3",
  ].join("\n");
  const goneTripsTxt = [
    "trip_id,route_id,service_id,trip_headsign,direction_id,shape_id",
    "g1,RA,wd,ALPHA EAST,0,shp-a",
    "g2,RW,wd,ALPHA EAST,0,shp-a",
    "g3,R55,wd,ALPHA EAST,0,shp-a",
  ].join("\n");
  const goneStopTimesTxt = [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "g1,08:00:00,08:00:00,a1,1", "g1,08:05:00,08:05:00,a2,2", "g1,08:09:00,08:09:00,a3,3",
    "g2,09:00:00,09:00:00,a1,1", "g2,09:05:00,09:05:00,a2,2", "g2,09:09:00,09:09:00,a3,3",
    "g3,10:00:00,10:00:00,a1,1", "g3,10:05:00,10:05:00,a2,2", "g3,10:09:00,10:09:00,a3,3",
  ].join("\n");
  const out = buildTransitData({
    stopsTxt, routesTxt: goneRoutesTxt, tripsTxt: goneTripsTxt, stopTimesTxt: goneStopTimesTxt,
    shapesTxt, calendarTxt, calendarDatesTxt, feedInfoTxt, panels: [],
  });
  assert.deepEqual(out.client.routes.map((r) => r.name), ["A"], "only the kept route reaches the browser");
  assert.deepEqual(out.schedule.routes.map((r) => r.name), ["A"], "only the kept route reaches the timetable");
  assert.ok(out.schedule.patterns.every((p) => p.route === "RA"), "no pattern rides an excluded route");
  assert.equal(out.schedule.trips.length, 1, "the excluded routes' trips are not carried");
});

test("a panel naming a stop the feed does not hold is refused", () => {
  assert.throws(() => buildTransitData({
    stopsTxt, routesTxt, tripsTxt, stopTimesTxt, shapesTxt, calendarTxt, calendarDatesTxt, feedInfoTxt,
    panels: [{ id: "x", label: "X", stops: ["nope"] }],
  }), /does not hold/);
});

test("a shape that ends where it began keeps its middle", () => {
  const loop = [
    { lat: 43.070, lon: -89.410 }, { lat: 43.080, lon: -89.410 }, { lat: 43.080, lon: -89.390 },
    { lat: 43.070, lon: -89.390 }, { lat: 43.070, lon: -89.410 },
  ];
  const out = simplifyShape(loop, 15);
  assert.ok(out.length >= 4, `a loop thins to its corners, not its endpoints (got ${out.length})`);
  assert.deepEqual(out[0], loop[0]);
});

test("headsigns print as the preview prints them", () => {
  assert.equal(displayHeadsign("MEMORIAL UNION VIA EAGLE HEIGHTS"), "Memorial Union Via Eagle Heights");
  assert.equal(displayHeadsign("U.W. HOSPITAL VIA EAGLE HEIGHTS"), "U.W. Hospital Via Eagle Heights");
  assert.equal(displayHeadsign("1-SUN PRAIRIE"), "1-Sun Prairie");
});

test("GTFS times past midnight are seconds on the same service day", () => {
  assert.equal(gtfsSeconds("25:10:00"), 25 * 3600 + 600);
  assert.equal(gtfsSeconds("08:05:00"), 8 * 3600 + 300);
  assert.equal(gtfsSeconds(""), null);
});
