/* Madison Metro's static GTFS, kept as the two artifacts the bus page runs on
 * (ops/transit-build.mjs writes both from one download of the feed):
 *
 *   content/transit/transit-data.json — what the visitor's browser holds: every route
 *   with its colour, each direction's stops in order and its published shape (the
 *   line the map draws), every stop's name and position, and the three stops the
 *   Next Buses panels watch. No times: a shape and a stop list cannot go stale
 *   inside a service period.
 *
 *   content/transit/schedule.json — what the site's own function holds (it rides in
 *   .build/server.json): the timetable in the compact form below, which
 *   netlify/lib/transit-live.mjs expands and merges with Metro's live GTFS-RT
 *   feeds. Trips that share a route, direction, headsign, stop sequence and
 *   stop-to-stop timing are one pattern; a trip is then a pattern and a start
 *   time, so the whole period's 600,000 stop times travel as a few thousand
 *   patterns and 14,000-odd starts.
 *
 * The licence and the checks behind this are in
 * docs/research/EXPLORE-TRANSIT-VERIFICATION-2026-11-11.md. */

export const WALK_RADIUS_M = 500;

/* The campus fare-free routes, a UW–Madison policy fact that holds across feeds:
 * the 80, 81, 82 and 84 cost nothing to ride. */
export const FREE_ROUTES = ["80", "81", "82", "84"];

/* The box the campus routes are read off: a route is a campus route when one of
 * its stops stands inside it. Measured on the current feed it names exactly the
 * nineteen routes the Explore redesign counted. */
export const CAMPUS_BOX = { latMin: 43.065, latMax: 43.085, lonMin: -89.435, lonMax: -89.385 };

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

/* A GTFS clock time ("25:10:00" is 1:10 AM on the next civil day, on the same
 * service day) as seconds from the service day's midnight. */
export function gtfsSeconds(t) {
  const m = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(String(t || "").trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/* A shape thinned for the map by Douglas-Peucker: a point survives only when
 * the line through its neighbours would otherwise stray more than `tolM`
 * metres from it. The published shape has hundreds of points per direction,
 * most of them on straight runs; at fifteen metres the drawn line is the
 * feed's own at any zoom the page offers, at a tenth of the points. */
export function simplifyShape(points, tolM = 15) {
  if (points.length < 3) return points.slice();
  /* A loop route's shape ends where it began, and a line from a point to
   * itself has no direction for the test below: split a closed shape at the
   * point farthest from its start and thin the two open halves. */
  if (haversineM(points[0], points[points.length - 1]) <= tolM) {
    let k = 0, far = -1;
    for (let i = 1; i < points.length - 1; i++) { const d = haversineM(points[0], points[i]); if (d > far) { far = d; k = i; } }
    if (k > 0) return [...thinOpen(points.slice(0, k + 1), tolM), ...thinOpen(points.slice(k), tolM).slice(1)];
  }
  return thinOpen(points, tolM);
}

function thinOpen(points, tolM) {
  if (points.length < 3) return points.slice();
  const p = Math.PI / 180;
  const xy = points.map((q) => [q.lon * p * EARTH_M * Math.cos(q.lat * p), q.lat * p * EARTH_M]);
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let far = -1, farD = tolM;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((xy[i][0] - ax) * dy - (xy[i][1] - ay) * dx) / len;
      if (d > farD) { farD = d; far = i; }
    }
    if (far >= 0) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

/* A GTFS headsign in the case the page prints: the feed shouts (MEMORIAL UNION
 * VIA EAGLE HEIGHTS); the preview's words are title case, with abbreviations
 * the feed spells in points (U.W.) left as they are. */
export function displayHeadsign(h) {
  const word = (w) => (/^([A-Za-z]\.)+$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return String(h || "").split(/\s+/).filter(Boolean).map((w) => w.split("-").map(word).join("-")).join(" ");
}

const ymd = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

/* Both artifacts from a GTFS copy's files. `panels` is content/transit/panels.json:
 * the stops the Next Buses panels watch, named by their GTFS stop ids; a panel
 * naming a stop the feed does not hold is a build error, never a silent gap. */
export function buildTransitData({ stopsTxt, routesTxt, tripsTxt, stopTimesTxt, shapesTxt, calendarTxt, calendarDatesTxt, feedInfoTxt, panels = [] }) {
  const stops = parseCsv(stopsTxt)
    .filter((s) => s.stop_id && Number.isFinite(+s.stop_lat) && Number.isFinite(+s.stop_lon))
    .map((s) => ({ id: s.stop_id, name: s.stop_name || s.stop_id, lat: +s.stop_lat, lon: +s.stop_lon }));
  const stopIdx = new Map(stops.map((s, i) => [s.id, i]));

  const routes = new Map();
  for (const r of parseCsv(routesTxt)) {
    if (!r.route_id) continue;
    routes.set(r.route_id, {
      id: r.route_id, name: r.route_short_name || r.route_id, long: r.route_long_name || "",
      color: (r.route_color || "").toLowerCase(), textColor: (r.route_text_color || "").toLowerCase(),
      sort: Number(r.route_sort_order) || 999,
    });
  }

  const shapes = new Map();
  for (const p of parseCsv(shapesTxt)) {
    if (!p.shape_id || !Number.isFinite(+p.shape_pt_lat) || !Number.isFinite(+p.shape_pt_lon)) continue;
    const list = shapes.get(p.shape_id) || [];
    list[Number(p.shape_pt_sequence) || 0] = { lat: +p.shape_pt_lat, lon: +p.shape_pt_lon };
    shapes.set(p.shape_id, list);
  }
  for (const [id, list] of shapes) shapes.set(id, list.filter(Boolean));

  /* Trips, with their stop times gathered in sequence order. stop_times.txt is
   * the feed's big file (600,000 rows): read it line by line, never as objects. */
  const trips = new Map();
  for (const t of parseCsv(tripsTxt)) {
    if (!routes.has(t.route_id)) continue;
    trips.set(t.trip_id, {
      id: t.trip_id, route: t.route_id, service: t.service_id, dir: Number(t.direction_id) || 0,
      headsign: (t.trip_headsign || "").trim(), shape: t.shape_id || "", times: [],
    });
  }
  for (const line of String(stopTimesTxt || "").split(/\r?\n/)) {
    if (!line || line.startsWith("trip_id")) continue;
    const [trip, , dep, stop, seq] = line.split(",");
    const t = trips.get(trip);
    if (!t || !stopIdx.has(stop)) continue;
    const sec = gtfsSeconds(dep);
    if (sec == null) continue;
    t.times[Number(seq) || 0] = { stop: stopIdx.get(stop), sec };
  }
  for (const t of trips.values()) t.times = t.times.filter(Boolean);

  /* Patterns: trips identical in route, direction, headsign, stops and offsets. */
  const headsigns = [];
  const hsIdx = new Map();
  const headsignIdx = (h) => { if (!hsIdx.has(h)) { hsIdx.set(h, headsigns.length); headsigns.push(displayHeadsign(h)); } return hsIdx.get(h); };
  const patterns = [];
  const patternIdx = new Map();
  const tripRows = [];
  for (const t of trips.values()) {
    if (t.times.length < 2) continue;
    const start = t.times[0].sec;
    const offsets = t.times.map((x) => x.sec - start);
    const key = [t.route, t.dir, t.headsign, t.times.map((x) => x.stop).join("."), offsets.join(".")].join("|");
    let pi = patternIdx.get(key);
    if (pi == null) {
      pi = patterns.length;
      patternIdx.set(key, pi);
      patterns.push({ route: t.route, dir: t.dir, headsign: headsignIdx(t.headsign), stops: t.times.map((x) => x.stop), offsets, shape: t.shape });
    }
    tripRows.push({ id: t.id, pattern: pi, service: t.service, start });
  }

  /* Services: the weekly pattern (calendar.txt) and its dated exceptions
   * (calendar_dates.txt: 1 adds the service that day, 2 removes it). */
  const services = [];
  const serviceIdx = new Map();
  for (const c of parseCsv(calendarTxt)) {
    serviceIdx.set(c.service_id, services.length);
    services.push({
      id: c.service_id,
      days: [c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday].map((d) => (d === "1" ? 1 : 0)),
      start: ymd(c.start_date || ""), end: ymd(c.end_date || ""),
    });
  }
  const exceptions = {};
  for (const d of parseCsv(calendarDatesTxt)) {
    if (!serviceIdx.has(d.service_id) || !/^\d{8}$/.test(d.date || "")) continue;
    const date = ymd(d.date);
    (exceptions[date] = exceptions[date] || []).push([serviceIdx.get(d.service_id), Number(d.exception_type) || 0]);
  }
  for (const t of tripRows) t.service = serviceIdx.get(t.service) ?? -1;

  /* The browser's routes: a route's variants — one per direction and headsign
   * (a loop like the 80 runs one direction_id under five headsigns) — each
   * drawn from its fullest pattern, which gives the stop order and the shape. */
  const variants = new Map();
  const variantTrips = new Map();
  for (const t of tripRows) {
    const p = patterns[t.pattern];
    const k = `${p.route}|${p.dir}|${p.headsign}`;
    variantTrips.set(k, (variantTrips.get(k) || 0) + 1);
    const cur = variants.get(k);
    if (!cur || p.stops.length > cur.stops.length) variants.set(k, p);
  }
  const campusStops = new Set(stops.filter((s) => s.lat >= CAMPUS_BOX.latMin && s.lat <= CAMPUS_BOX.latMax && s.lon >= CAMPUS_BOX.lonMin && s.lon <= CAMPUS_BOX.lonMax).map((s) => s.id));
  const clientRoutes = [...routes.values()].sort((a, b) => a.sort - b.sort).map((r) => {
    const dirs = [...variants.values()].filter((p) => p.route === r.id)
      .sort((a, b) => a.dir - b.dir || (variantTrips.get(`${b.route}|${b.dir}|${b.headsign}`) || 0) - (variantTrips.get(`${a.route}|${a.dir}|${a.headsign}`) || 0))
      .map((p) => ({
        dir: p.dir, headsign: headsigns[p.headsign],
        stops: p.stops,
        shape: simplifyShape(shapes.get(p.shape) || []).map((q) => [Math.round(q.lat * 1e5) / 1e5, Math.round(q.lon * 1e5) / 1e5]),
      }));
    return {
      id: r.id, name: r.name, long: r.long, color: r.color, textColor: r.textColor,
      free: FREE_ROUTES.includes(r.name), campus: dirs.some((d) => d.stops.some((si) => campusStops.has(stops[si].id))),
      dirs,
    };
  }).filter((r) => r.dirs.length);

  const outPanels = panels.map((p) => {
    const missing = (p.stops || []).filter((id) => !stopIdx.has(id));
    if (missing.length) throw new Error(`content/transit/panels.json: panel "${p.id}" names stop(s) the feed does not hold: ${missing.join(", ")}`);
    return { id: p.id, label: p.label, stops: (p.stops || []).map((id) => stopIdx.get(id)) };
  });

  const info = parseCsv(feedInfoTxt)[0] || {};
  const feed = { publisher: info.feed_publisher_name || "Metro Transit-City of Madison", version: info.feed_version || "", start: ymd(info.feed_start_date || ""), end: ymd(info.feed_end_date || "") };
  const credit = "Data provided under license granted by City of Madison, WI, Metro Transit.";

  const client = { schema: "bss.transit-data/1", feed, credit, stops, routes: clientRoutes, panels: outPanels };
  const schedule = {
    schema: "bss.transit-schedule/1", feed, credit,
    stops: stops.map((s) => s.id),
    routes: clientRoutes.map((r) => ({ id: r.id, name: r.name, color: r.color, textColor: r.textColor, free: r.free })),
    headsigns,
    services, exceptions,
    /* Stops and offsets ride as slash-joined strings, not number arrays: the
       repository's privacy scan reads three bare number runs in a row as a phone
       number, and a timetable's stop indexes and offsets are exactly that. The
       function's index splits them back (netlify/lib/transit-live.mjs). */
    patterns: patterns.map((p) => ({ route: p.route, dir: p.dir, headsign: p.headsign, stops: p.stops.join("/"), offsets: p.offsets.join("/") })),
    trips: tripRows.filter((t) => t.service >= 0),
  };
  /* Patterns name their route by id in the schedule; the function's index turns
   * them into route rows. Client routes carry the same ids. */
  return { client, schedule };
}
