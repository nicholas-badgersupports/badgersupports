/* The Bus Route Explorer's server half (WORK item 45): placing an address, and classifying
 * address × building pairs from the topology the build carried (server.json, from
 * content/transit/topology.json).
 *
 * The address a visitor types is sent only to OpenStreetMap's Nominatim service, by this
 * function, with the site's contact address in the user agent and at most the service's one
 * request a second. It is not logged, stored, or sent anywhere else; the classification request
 * that follows carries coordinates only. Results are limited to the Madison area. */

import { serverContent } from "./content.mjs";
import { indexTopology, classifyMatrix } from "../../ops/transit.mjs";

let heldIndex = null;
let heldTopo = null;
function index() {
  const topo = serverContent().transit?.topology || { routes: [], stops: [] };
  if (!heldIndex || heldTopo !== topo) { heldIndex = indexTopology(topo); heldTopo = topo; }
  return heldIndex;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
let lastCall = 0;

/* The area the comparison can speak for: the box busRoutesAnswer has always held
 * points to. A match outside it cannot be classified, and the page says so rather
 * than letting the point vanish on the way to the classifier. */
const AREA = { latMin: 42.5, latMax: 43.6, lonMin: -90, lonMax: -88.5 };
const inArea = (lat, lon) => lat > AREA.latMin && lat < AREA.latMax && lon > AREA.lonMin && lon < AREA.lonMax;

/* The town or city a result sits in, as the service names it. */
function localityOf(a) { return a.city || a.town || a.village || a.municipality || ""; }

/* A result in the plain form the page shows: the place's own name when it has one,
 * then its street address, then its town or city — never the county, state and
 * country tail the service appends to every match. */
function cleanLabel(r) {
  const a = r.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const name = String(r.name || "").trim();
  const parts = [];
  if (name && name !== a.road && name !== street) parts.push(name);
  if (street) parts.push(street);
  if (!parts.length && name) parts.push(name);
  const place = localityOf(a);
  if (place && !parts.includes(place)) parts.push(place);
  if (parts.length) return parts.join(", ");
  return String(r.display_name || "").split(", ").filter((p) => p !== "United States").slice(0, 3).join(", ");
}

/* Up to three candidate places for a typed address, or [] when none is found near Madison.
 * Each carries its clean label, the town or city and state it sits in, and whether it
 * falls inside the area the comparison covers, so the page can say which address
 * failed and can keep a match outside Madison from reading as a Madison answer. */
export async function geocodeAddress(q, { fetchImpl = fetch } = {}) {
  const query = String(q || "").trim().slice(0, 200);
  if (query.length < 3) return [];
  const wait = Math.max(0, 1100 - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const params = new URLSearchParams({ format: "jsonv2", limit: "3", addressdetails: "1", q: query, viewbox: "-89.66,43.21,-89.19,42.94", bounded: "0", countrycodes: "us" });
  const res = await fetchImpl(`${NOMINATIM}?${params}`, { headers: { "user-agent": "BadgerSupportsWebsite/1.0 (directors@badgersupports.org)", accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`the address lookup answered ${res.status}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const lat = +r.lat, lon = +r.lon;
      const a = r.address || {};
      return { label: cleanLabel(r), city: localityOf(a), state: a.state || "", lat, lon, inArea: inArea(lat, lon) };
    })
    .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lon));
}

/* { results, feed } for the body's points and building ids, or null when the body names neither
 * a usable point nor a known building. */
export function busRoutesAnswer(body) {
  const c = serverContent();
  const wanted = new Set(Array.isArray(body?.buildings) ? body.buildings : []);
  const buildings = (c.transit?.buildings || []).filter((b) => wanted.has(b.id));
  const points = (Array.isArray(body?.points) ? body.points : []).slice(0, 6)
    .map((p) => ({ lat: +p?.lat, lon: +p?.lon }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && inArea(p.lat, p.lon));
  if (!points.length || !buildings.length) return null;
  return { results: classifyMatrix(index(), points, buildings), feed: c.transit?.topology?.feed || null };
}
