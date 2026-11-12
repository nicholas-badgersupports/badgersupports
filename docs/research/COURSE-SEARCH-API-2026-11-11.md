# UW Course Search API — verification note (EXPLORE-F-CLASSES)

Checked 11 November 2026, from Nicholas's Mac, against the live service. This is the
verification the queue entry (`docs/EXPLORE-CAMPUS-QUEUE-2026-11-10.md`, EXPLORE-F) requires
before any production use. **Conclusion first: the API is real and readable, but it is
undocumented and no terms for it are published, so the production switch waits for Nicholas to
accept this note and for permission to be sought from the Office of the Registrar, exactly as
the queue entry prescribes.** Until then the tool ships with a clearly labelled verification
pull (the data file's `fixture` flag and label, the pattern the resource list uses), and
`ops/courses.mjs` is the only thing that talks to the API.

## What the service is

- UW Course Search is the public face of Course Search & Enroll, run for the Office of the
  Registrar (the DoIT ROAD team maintains the app, per DoIT Enterprise Integration's own
  About page). The public app is at https://public.enroll.wisc.edu/search.
- The JSON it calls is undocumented: no developer page, no published rate limits, no terms of
  use for the JSON endpoints were found (searched 11 Nov 2026). UW–Madison's general web
  terms do not mention it. `/robots.txt` is not served (the address returns the app itself).
- Requests without a browser User-Agent are refused by CloudFront (403, observed). With a
  browser User-Agent the endpoints answer. That is a signal the endpoints are meant for the
  app, not for third parties: another reason permission comes before production use.

## Endpoints verified (all read-only)

- `GET /api/search/v1/aggregate` — the terms the app offers and every subject, by term.
  On 11 Nov 2026 it offers two terms: `1272` "2026 Fall" (Fall 2026-2027) and `1274`
  "2027 Sprng" (Spring 2026-2027).
- `GET /api/search/v2/subjectsMap/0000` — subject code → short name (e.g. `872` → SCAND ST).
- `POST /api/search/v2` — the search itself. Body: `{selectedTerm, queryString, filters,
  page, pageSize, sortOrder}`. `filters` are the same Elasticsearch clauses the app builds;
  the one this site uses is the published-sections clause,
  `{has_child: {type: "enrollmentPackage", query: {term: {"enrollmentPackage.sections.published": true}}}}`,
  which is what makes a result a published section offering rather than a catalog entry.
  A subject clause is `{term: {"course.subject.subjectCode": "<code>"}}`.
- A hit is a course: subject, catalog number, title, credit range, breadths,
  `typicallyOffered`, `lastTaught`, `currentlyTaught`. Sections themselves sit behind
  `/api/search/v2/enrollmentPackages/...`, which this site does not need: presence in a
  term's published-sections search is the offering evidence the official search itself shows.

## Term codes, verified against a fall-only and a spring-only course

Codes step by two per term, rolling at the season digit (…1256, 1262, 1264, 1266, 1272,
1274…). Anchored on the aggregate's own labels (1272 = Fall 2026, 1274 = Spring 2027):

- SCAND ST 101, First Semester Norwegian (`typicallyOffered` "Fall"): present in the 1272
  published-sections search, absent from 1274. ✓ fall term behaves as a fall term.
- SCAND ST 102, Second Semester Norwegian (`typicallyOffered` "Spring"): present in 1274,
  absent from 1272. ✓
- 1266 answers the search (1,974 courses unfiltered, 1,185 with published sections;
  SCAND ST has 4) and is the term one step before Fall 2026: Summer 2026. Terms 1264 and
  earlier no longer answer (`found: null`): their indexes have been retired.

**What that means for the queue entry's window.** "Verified offerings in the past academic
year" is only partly reachable: Summer 2026 is verifiable directly; Fall 2025 and Spring
2026 are not, because the service no longer serves those indexes. A course's own
`lastTaught` names older terms, but a claim this site cannot re-verify is not used as an
offering. So "recently offered" on the page means: a published offering in Summer 2026, the
most recent past term the service still verifies. The pull script derives term labels from
the aggregate's anchors and the step-by-two cycle, and skips any term it cannot label —
it never invents one.

## Volume and cost

One pull is three terms × the full published-sections index at 500 results a page:
about 30 requests, sequential, once per refresh (the 11 Nov 2026 pull read 1,185 + 4,742 +
5,122 courses with published sections for Summer 2026, Fall 2026 and Spring 2027, of which
2,235 fall under the interest mapping). No key, no account, no cost. The pull runs at publish/refresh
time on our side only; a visitor's browser never calls the API. A failed pull leaves the
last good data file untouched.

## What is not verified

- No permission has been sought or given. Before the production switch: Nicholas accepts
  this note, and the Office of the Registrar is asked (the queue entry names it).
- Stability: an undocumented API can change shape without notice. The pull validates what
  it reads and refuses to write a data file from a response that is not in the shape it
  expects, so a change fails the refresh, not the page.
- Enrollment state (open/closed seats) is deliberately not read: the queue entry forbids
  enrollment data, and no card shows it.
