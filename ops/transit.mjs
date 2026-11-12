/* The Bus Route Explorer's route topology (WORK item 45, EXPLORE-I-BUS-ROUTES).
 *
 * Madison Metro's static GTFS says which stops each route serves. That, and only that, is what
 * this site keeps (content/transit/topology.json, written by ops/transit-build.mjs): no times are
 * read or stored, so no schedule, departure or prediction can be shown from this data — the
 * classification is direct / one transfer / no suitable connection, from route topology alone.
 *
 * A stop serves a place when it is within WALK_RADIUS_M of it, measured straight-line; the page
 * states that rule and shows the walking distances it used. A route missing from the topology is
 * never shown as available: classification reads only the topology it is given.
 *
 * The licence and the checks behind this are in
 * docs/research/EXPLORE-TRANSIT-VERIFICATION-2026-11-11.md. */

export const WALK_RADIUS_M = 500;

const EARTH_M = 6_371_000;
export function haversineM(a, b) {
  const p = Math.PI / 180;
  const dLat = (b.lat - a.lat) * p;
  const dLon = (b.lon - a.lon) * p;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(s));
}

/* GTFS files are simple CSV: no quoted commas in the fields this reads. */
export function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const head = lines[0].split(",");
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    const o = {};
    head.forEach((h, i) => { o[h] = cells[i] ?? ""; });
    return o;
  });
}

/* The topology from a GTFS copy's files, as plain data:
 * { feed, routes: [{ id, name, long, stops: [stopId] }], stops: [{ id, name, lat, lon }] } */
export function buildTopology({ stopsTxt, routesTxt, tripsTxt, stopTimesTxt, feedInfoTxt }) {
  const stops = parseCsv(stopsTxt)
    .filter((s) => s.stop_id && Number.isFinite(+s.stop_lat) && Number.isFinite(+s.stop_lon))
    .map((s) => ({ id: s.stop_id, name: s.stop_name || s.stop_id, lat: +s.stop_lat, lon: +s.stop_lon }));
  const stopIds = new Set(stops.map((s) => s.id));
  const routes = new Map();
  for (const r of parseCsv(routesTxt)) routes.set(r.route_id, { id: r.route_id, name: r.route_short_name || r.route_id, long: r.route_long_name || "", stops: new Set() });
  const tripRoute = new Map();
  for (const t of parseCsv(tripsTxt)) if (routes.has(t.route_id)) tripRoute.set(t.trip_id, t.route_id);
  for (const line of String(stopTimesTxt || "").split(/\r?\n/)) {
    if (!line || line.startsWith("trip_id")) continue;
    const [trip, , , stop] = line.split(",");
    const rid = tripRoute.get(trip);
    if (rid && stopIds.has(stop)) routes.get(rid).stops.add(stop);
  }
  const info = parseCsv(feedInfoTxt)[0] || {};
  return {
    feed: { publisher: info.feed_publisher_name || "Metro Transit–City of Madison", version: info.feed_version || "", start: info.feed_start_date || "", end: info.feed_end_date || "" },
    routes: [...routes.values()].filter((r) => r.stops.size).map((r) => ({ id: r.id, name: r.name, long: r.long, stops: [...r.stops] })),
    stops,
  };
}

/* A runtime view of the topology: the same data with lookups built once. */
export function indexTopology(topology) {
  const stops = new Map((topology.stops || []).map((s) => [s.id, s]));
  const routes = (topology.routes || []).map((r) => ({ ...r, stopSet: new Set(r.stops) }));
  return { stops, routes, feed: topology.feed || {} };
}

export function stopsNear(index, point, radiusM = WALK_RADIUS_M) {
  const out = [];
  for (const s of index.stops.values()) {
    const d = haversineM(point, s);
    if (d <= radiusM) out.push({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, walkM: Math.round(d) });
  }
  return out.sort((a, b) => a.walkM - b.walkM);
}

/* Routes serving a set of stops, each with the nearest of those stops on it. */
function routesAt(index, near) {
  const out = new Map();
  for (const r of index.routes) {
    const on = near.filter((s) => r.stopSet.has(s.id));
    if (on.length) out.set(r.id, { route: r, stop: on[0] });
  }
  return out;
}

/* One address point and one building point, classified. The answer names the stops used and the
 * walking distances to them, and never a time. */
export function classifyPair(index, from, to, radiusM = WALK_RADIUS_M) {
  const nearFrom = stopsNear(index, from, radiusM);
  const nearTo = stopsNear(index, to, radiusM);
  if (!nearFrom.length || !nearTo.length) return { kind: "none" };
  const atFrom = routesAt(index, nearFrom);
  const atTo = routesAt(index, nearTo);
  let best = null;
  for (const [rid, a] of atFrom) {
    const b = atTo.get(rid);
    if (!b) continue;
    const total = a.stop.walkM + b.stop.walkM;
    if (!best || total < best.total) best = { kind: "direct", routes: [a.route.name], board: a.stop, alight: b.stop, total };
  }
  if (best) return { kind: "direct", routes: best.routes, board: best.board, alight: best.alight };
  for (const [, a] of atFrom) {
    for (const [, b] of atTo) {
      if (a.route.id === b.route.id) continue;
      const shared = a.route.stops.filter((id) => b.route.stopSet.has(id)).map((id) => index.stops.get(id)).filter(Boolean);
      if (!shared.length) continue;
      const via = shared.map((s) => ({ ...s, score: haversineM(a.stop, s) + haversineM(s, b.stop) })).sort((x, y) => x.score - y.score)[0];
      const total = a.stop.walkM + b.stop.walkM;
      if (!best || total < best.total) best = { kind: "transfer", routes: [a.route.name, b.route.name], board: a.stop, alight: b.stop, via: { id: via.id, name: via.name, lat: via.lat, lon: via.lon }, total };
    }
  }
  if (best) return { kind: "transfer", routes: best.routes, board: best.board, alight: best.alight, via: best.via };
  return { kind: "none" };
}

/* Every address × building pair, in the order given. */
export function classifyMatrix(index, points, buildings) {
  return points.map((point) => ({
    cells: buildings.map((b) => ({ building: b.id, ...classifyPair(index, point, b) })),
  }));
}
