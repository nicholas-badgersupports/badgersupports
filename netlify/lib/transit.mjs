/* The bus page's server geocoder: an address becomes coordinates, or a plain
 * no. It sends the address to the US Census Bureau's free geocoder — no key,
 * and the address is never stored or logged; only the outcome travels (an ok
 * with the point, or an error kind the page turns into a sentence). The
 * benchmark is pinned to the current vintage (Public_AR_Current), the one the
 * Census API itself names; the same input must always give the same answer.
 *
 * The timetable and the live merge that used to live here moved out in the
 * Explore redesign (15 Nov 2026): the timetable is built by ops/transit-build
 * into content/transit, and the departures the page shows are computed by
 * netlify/lib/transit-live.mjs from that timetable and Metro's GTFS-RT feeds.
 * The old building-proximity classification went with them — the redesigned
 * page compares real stops near an address instead of rating building pairs. */

const GEOCODE_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
export const GEOCODE_BENCHMARK = "Public_AR_Current";

/* A street address, coordinates, or an honest no. Throws only when the
 * service cannot be reached at all; the route turns that into a 502. */
export async function geocodeAddress(address, { fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ address, benchmark: GEOCODE_BENCHMARK, format: "json" });
  const res = await fetchImpl(`${GEOCODE_URL}?${params}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`the Census geocoder answered ${res.status}`);
  const body = await res.json().catch(() => null);
  const matches = body?.result?.addressMatches;
  if (!Array.isArray(matches)) throw new Error("the Census geocoder answered in a shape this site does not read");
  const first = matches[0];
  const point = first?.coordinates;
  if (!point || typeof point.x !== "number" || typeof point.y !== "number") return { ok: false, error: "no-match" };
  const components = first.addressComponents || {};
  const matched = [first.matchedAddress, components.city && components.state ? "" : ""].filter(Boolean).join("");
  return {
    ok: true,
    lon: point.x,
    lat: point.y,
    label: first.matchedAddress || address,
    city: components.city || null,
    state: components.state || null,
    zip: components.zip || null,
    matched,
  };
}
