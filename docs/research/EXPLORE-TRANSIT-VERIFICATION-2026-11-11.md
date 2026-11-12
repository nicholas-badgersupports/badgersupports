# Bus Route Explorer — data-source verification, 11 November 2026

Written before the EXPLORE-I-BUS-ROUTES build (WORK item 45), as its entry requires: licences and
attribution confirmed for each source, the geocoding approach settled, and the route topology checked
against known pairs. **Nicholas's approval of this note is still required before the tool is switched
on in production** (the entry's Review line); the build below is queue work, not activation.

## Madison Metro GTFS

- Source: the static GTFS at https://transitdata.cityofmadison.com/GTFS/mmt_gtfs.zip, published by
  Metro Transit, City of Madison. The copy read on 11 Nov 2026 is feed version `S072_202608240858`,
  covering 16 Aug 2026 to 5 Dec 2026: 29 routes, 1,681 stops, 14,198 trips.
- Licence: the feed's own `terms_of_use.txt` is the City of Madison Metro Transit Developer License
  Agreement. It grants a non-exclusive, revocable licence to use and redistribute the data for uses
  "assisting mass transit riders or in furtherance of promoting public transportation" — this tool is
  exactly that use. The City's credit line, shown on the page, is: "Data provided under license
  granted by City of Madison, WI, Metro Transit."
- What this site keeps: a derived topology only — each route's set of stops, and each stop's name and
  coordinates (`content/transit/topology.json`, written by `ops/transit-build.mjs`). It holds no
  times, so no schedule or prediction can be shown from it, by construction.
- Refresh: `node ops/transit-build.mjs` downloads the current feed and rewrites the topology. The
  feed's start and end dates are recorded in the file it writes; a feed whose end date has passed is
  a stale topology, and the runbook entry in `docs/ARCHITECTURE.md` says to rerun the script each
  schedule period.

## OpenStreetMap and geocoding

- Building coordinates and address lookup both come from OpenStreetMap data, © OpenStreetMap
  contributors, available under the Open Database License; the page carries that attribution.
- A typed address is sent to OpenStreetMap's Nominatim service by this site's own function
  (`GET /api/geocode`), never from the visitor's browser, with the site's contact address in the
  request's user agent, at most one request per lookup, results limited to the Madison area. The
  page says, before the Compare button, that addresses are looked up with OpenStreetMap to place
  them and are not kept. The function does not log, store or send the address anywhere else, and
  the classification request that follows carries coordinates only.
- Building list: 20 UW–Madison academic buildings in `content/transit/buildings.json`, each placed
  from its OpenStreetMap record on 11 Nov 2026 (name and street address matched, e.g. "William H.
  Sewell Social Sciences Building, 1180 Observatory Drive" for the Social Science Building).

## Topology checks against known pairs (real feed, 11 Nov 2026)

A stop counts as serving a place when it is within 500 metres of it, measured straight-line; the
page states that distance rule and shows the actual walking distances it used.

1. Langdon Street at N Park Street → Bascom Hall: **direct**, route 81 (board at Langdon at N Park).
2. Eagle Heights (Lake Mendota Drive) → Van Vleck Hall: **direct**, route 80 — the campus route that
   serves Eagle Heights.
3. Hubbard Avenue, Middleton → Engineering Hall: **direct**, route F — the Middleton route.
4. East Towne (Melvin Court) → Van Vleck Hall: **direct**, route A.
5. S Park Street at Burr Oak Lane → Health Sciences Learning Center: **transfer required**,
   routes 64 then 65.
6. Verona (off the Metro service area) → Bascom Hall: **no suitable connection** — no stop within
   500 metres of the address.

A route missing from the verified topology is never shown as available: classification reads only
`content/transit/topology.json`, and the fixture tests in `test/transit.test.mjs` pin the three
classes (direct / transfer / no suitable connection) and the absence of any time field.
