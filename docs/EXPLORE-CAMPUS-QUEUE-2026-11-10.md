# Explore Campus and changelog — queue entries, 10 November 2026

Full entries for `WORK.md` items 40–47. `WORK.md` keeps the order and the one-line state; this file keeps the
agreed scope. Queued at Nicholas's request of 10 Nov 2026, **queue only**: nothing here is built, approved,
published or switched on. Every entry is **Status: Proposed / Not Implemented** until a commit and a
publication say otherwise, and development, publication and operational activation stay three separate states.

Companion entries (same IDs, owned elsewhere):

| ID | Owner | Where |
|---|---|---|
| EXPLORE-C-RESOURCE-FINDER (shared library half), EXPLORE-D-RESOURCE-FRESHNESS, EXPLORE-X-SHARED-RESOURCE-IDS, CONNECT-VERSION-HISTORY-RETRO | Connect | `BSS Intranet Transfer v23/QUEUE.md`, section "Explore Campus, shared resources and Version History — 10 November 2026" |
| EXPLORE-E-SPILL-LIBRARY, SPILL-CHANGELOG-OPEN-1 to 5 | SPILL | `Admin/Handoffs/Exchange/to-spill/EXPLORE-CAMPUS-AND-CHANGELOG-QUEUE-2026-11-10.md` |

## Rules every entry here keeps

- **Ownership.** Connect owns the approved resource library, its identifiers and editorial approval (SPILL
  START-HERE, "Boundaries"; Connect BLK-FIND). This site presents it and never keeps a second writable resource
  database. Public data feeds (events, courses, transit, maps) are read-only inputs, cached by this site.
- **Hybrid approval.** Public events and course offerings refresh automatically. A new Resource Finder entry, a new
  KnowledgeBase article, or a change to referral guidance appears only after authorized student staff approve it in
  Connect (EXPLORE-D).
- **University sources.** Every item that came from a university system says so by name (for example "UW–Madison
  KnowledgeBase", "Wisconsin Union", "UW Course Search") and links to the official page. Badger Supports programs are
  visually and textually distinct from external listings.
- **Photographs.** Only photographs approved in the Badger Supports Google Drive, through the existing
  `ops/media.mjs` / `media/manifest.json` path (originals stay in `local/`; the repository is public). No photograph is
  taken from a university feed, a map tile or a third-party site, and no image is generated.
- **Privacy.** No sign-in, no account and no stored personal input is needed for any tool here. Nothing a visitor
  types (interests, addresses, answers) is sent to analytics (item 22: no Connect identity, exclusions before any tag)
  or kept on the server by default. No schedules, grades, enrollment records or health information are collected.
- **Accessibility.** WCAG 2.2 AA: keyboard-only use, visible focus, screen-reader names and live-region status for
  loading/empty/error, 200% zoom, reduced motion, and widths 320, 390, 1280 px with no horizontal scroll. A map is
  never the only way to get an answer: every map result also exists as a list.
- **Program boundaries.** Nothing here is advising, diagnosis, counseling or crisis service, and nothing reaches
  SPILL case content.
- **Student-maintainable.** Every feed has a named owning role, a documented refresh, a visible "last updated", a
  failure state that keeps the last good data, and a runbook entry in `docs/ARCHITECTURE.md` before release.
- **Cost.** No new subscriptions or vendor accounts (24 Oct ruling, item 23). Each feed's build/function cost is
  estimated against the allowance before it is enabled.
- **Wording** follows `WORDING-RULES.md`; no helper text that repeats what the control says.

---

## EXPLORE-HUB · Explore Campus hub (WORK item 40)

- **Target:** public website (`www.badgersupports.org`). New page plus links from existing pages.
- **Scope:** one central Explore Campus page that gathers A (events), C (Resource Finder), F (classes), G
  (academic support navigator) and I (bus routes), each also embedded or linked where students already look:
  `resources.json` (C, G), `btw-navigating-housing.json` and `housing-hub.json` (I), `get-involved.json` and
  `home.json` (A, "Find Your People"), `btw-support-networks.json` (A, G). Reuse existing blocks and the menu
  model (ARCHITECTURE, "The menu"); the hub is a page made of blocks, editable through the existing editor (item 15).
- **Data source:** none of its own; it renders the tools below.
- **Dependencies:** at least one of A, C, F, G, I built; item 15/16 editing; item 7 image inventory for approved photos.
- **Student-facing behavior:** a short page with one card per tool, each card naming what it does in one line and
  its source. Tools that are not yet live do not appear (no "coming soon" placeholders).
- **Safeguards:** shared rules above. No tracking of which tools a visitor uses beyond the existing item-22 analytics
  dictionary.
- **Review:** page wording and photo selection reviewed by Nicholas (owner taste ruling, `overnight: no`).
- **Accept:**
  1. `/explore/` (or the path Nicholas picks) renders only tools that are live, each linking to its official source.
  2. Each integration point above links to the matching tool and back to the hub; no orphan pages in the routes table.
  3. Every photograph on the page resolves to an approved entry in `media/manifest.json`.
  4. `node ops/check.mjs --browser` passes, including keyboard, 320/390/1280 widths and 200% zoom.
- **Status:** Proposed / Not Implemented.

## EXPLORE-A-EVENTS · Campus Events Explorer (WORK item 41)

- **Target:** public website (Explore Campus, Get Involved, Home).
- **Data sources:** UW Events API (https://today.wisc.edu/api-docs/); Wisconsin Union event calendar
  (https://union.wisc.edu/events-and-activities/event-calendar) and its feed
  (https://union.wisc.edu/events-and-activities/event-calendar/feed_1); Badger Supports programs from Connect's
  existing events export (item 29/30; `ops/connect-feed.mjs`).
- **Scope:**
  1. Combine UW Events and **all available** Wisconsin Union events in one explorer. Read the whole Union feed, not a
     curated subset; record the count read against the count shown so a silent drop is visible.
  2. Deduplicate listings that appear in both feeds (stable key from normalized title + start instant + venue;
     keep both source links on the merged card).
  3. Interest-based explorer and searchable calendar, with **calendar and list views**, filtering by interests, event
     categories and dates.
  4. A highlighted **Find Your People** collection (clubs, communities, social and identity-based gatherings), defined
     by an editable category/interest mapping, not by hand-picked events.
  5. Automatic refresh of public event data on the existing ≤30-minute public-content cadence (item 34); a failed
     refresh keeps the last good data and shows its "last updated" time.
  6. Each card shows the organizer and a link to the source listing.
  7. External events are visibly distinct from Badger Supports programs (label and source line, not colour alone).
  8. Cost, cancellation and availability appear **only when the source states them**; otherwise the field is absent.
     No inferred "free", "sold out" or "cancelled".
  9. Useful loading, empty ("No events match these filters" with a clear reset) and error states.
- **Dependencies / verification before build:** read the UW Events API documentation and terms (rate limits,
  attribution, caching, permitted reuse); confirm the Union feed's format, completeness and terms; confirm time-zone
  handling against PUBLIC-EVENT-TIME-INSTANTS (Connect) so instants are not shifted; decide build-time vs function
  fetch from cost (item 23).
- **Student-facing behavior:** pick interests or browse; switch calendar/list; open an event to see time, place,
  organizer, source and official link.
- **Safeguards:** no sign-up or RSVP data handled here (links out to the organizer); no personal data stored;
  feed text sanitized as untrusted input; accessible calendar grid with a list equivalent.
- **Review:** the Find Your People category mapping and any interest names are reviewed by Engagement student
  staff before release. Event content itself is not re-approved (public, automatic).
- **Accept:**
  1. A fixture with an event present in both feeds renders one card with both source links.
  2. Fixture counts: every Union event in the fixture feed is either shown or listed in the build log with a reason.
  3. A fixture event with no cost field shows no cost; one with a stated cost shows it with its source.
  4. Feed failure fixture: last good data stays, "last updated" shows its time, the error is announced politely.
  5. Calendar and list views show the same filtered set; filters combine and reset; keyboard and screen reader pass.
  6. Badger Supports programs and external events are distinguishable with CSS disabled.
- **Status:** Proposed / Not Implemented.

## EXPLORE-C-RESOURCE-FINDER · Enhanced Resource Finder, public half (WORK item 42)

- **Target:** public website `resources.json` and the item-21 resource viewer; Connect owns the shared library
  (companion entry in `QUEUE.md`).
- **Data sources:** Connect's approved resource export (existing); approved UW KnowledgeBase articles
  (https://kb.wisc.edu/kbGuide/71945 describes the KB) carried as Connect resource records with source metadata
  (EXPLORE-X).
- **Scope:** one searchable Resource Finder combining existing Badger Supports resources and approved KB articles;
  each result labelled by source and publisher, with the official article link and its review information
  (reviewed on / reviewed by role, not by name). Existing organizational descriptions and the item-21 viewer
  (Report a Problem, Suggest a Resource, Suggest an Update) are preserved; the site never edits a resource itself.
- **Dependencies:** EXPLORE-X identifiers and source fields in Connect's export; EXPLORE-D approval queue; item 21
  activation; WORK owner action 14 (live entries Connect lacks).
- **Student-facing behavior:** one search box and filters; results show title, short description, "Source: UW–Madison
  KnowledgeBase" or "Badger Supports", publisher, last reviewed date and an official link.
- **Safeguards:** search terms are not logged server-side or sent to analytics; no live call to the KB from the
  visitor's browser is required (data comes from the approved export).
- **Review:** only Connect-approved entries are shown; the site cannot add one.
- **Accept:**
  1. A fixture export with one Badger Supports resource and one approved KB article shows both, correctly labelled.
  2. A KB record without approval status `approved` is not rendered.
  3. Existing resource descriptions render byte-identical to before.
  4. 320/390/1280 and keyboard/screen-reader checks pass; result count announced.
- **Status:** Approved 2026-11-11; public half built 2026-11-11 (branch `explore-b-2026-11`):
  cards carry a source line with publisher and last-reviewed date and link to the official
  page; a record whose source is not approved is never drawn, and records with no source
  draw exactly as before. The remainder (Connect's EXPLORE-X/C/D) is approved and with
  Connect Session 13.

## EXPLORE-F-CLASSES · Discover Classes by Interest (WORK item 43)

- **Target:** public website, Explore Campus.
- **Data source:** UW Course Search (https://public.enroll.wisc.edu/search) and the JSON it calls. **The API is
  undocumented**: suitability, terms of use, rate limits and stability must be verified, and permission sought from
  the Office of the Registrar if the terms are unclear, before any production use.
- **Scope:**
  1. Interest-based discovery with at least creativity, music, languages, nature and community, mapped to subjects /
     attributes by an editable mapping.
  2. Retrieve **published course-section offerings**, not catalog entries.
  3. Include courses with verified offerings in the past academic year, plus verified current or upcoming offerings.
  4. Handle term-specific courses (fall-only, spring-only, summer) correctly: the term shown is the term the section
     was actually published for.
  5. Show the most recent verified term offered.
  6. Distinguish **recently offered** from **currently or prospectively available** sections (separate label and
     grouping).
  7. Never imply an earlier offering guarantees a future one; course cards stay concise and carry **no explanatory
     helper text** about future uncertainty — the label alone does the work.
  8. Every card links to the course in official UW Course Search.
- **Dependencies / verification:** API terms and stability check recorded in `docs/research/`; term-code mapping
  verified against at least one fall-only and one spring-only course; refresh cadence and cost (item 23).
- **Student-facing behavior:** choose an interest, see concise cards (course, title, credits, label "Offered Spring
  2026" or "Open for Fall 2026"), follow the link to enroll through UW.
- **Safeguards:** no collection of schedules, grades, enrollment records or NetIDs; no sign-in; no advising claims.
- **Review:** the interest-to-subject mapping is reviewed by student staff before release; offerings refresh
  automatically.
- **Accept:**
  1. Fixture: a fall-only course last offered in the previous fall shows "recently offered" with that term, not as
     available now.
  2. Fixture: a course with a published upcoming section shows as available with that term.
  3. A catalog-only course with no published section in the window is excluded.
  4. No card contains future-uncertainty helper text; each links to UW Course Search.
  5. The API verification note exists and Nicholas has accepted it before the production switch.
- **Status:** Approved 2026-11-11; built 2026-11-11 (branch `explore-b-2026-11`); production switch
  **on 2026-11-12** (branch `item43-switch-2026-11-12`). Accept 5's permission condition was superseded
  by the owner's ruling of 12 Nov 2026: permission is no longer sought; the pull writes unflagged data.

## EXPLORE-G-ACADEMIC-NAV · Academic Support Navigator (WORK item 44)

- **Target:** public website, Explore Campus and the relevant resource pages.
- **Data source:** the shared approved resource library (Connect; EXPLORE-X), filtered to academic topics.
- **Scope:** a guided navigator of a few simple questions (topic first: academic advising, tutoring,
  accommodations, study skills, course difficulties) that ends on approved university resources and their official
  contacts, plus a direct path to the full Resource Finder (EXPLORE-C) at every step.
- **Dependencies:** EXPLORE-C and EXPLORE-X; question tree stored as editable content (item 15).
- **Student-facing behavior:** answer two or three choices, see two to five matching resources with official links;
  Back and Start Over work; "See all resources" always present.
- **Safeguards:** choice-based answers only, no free-text personal data; answers kept in page state only, not
  stored or sent to analytics; framed as finding resources, **not** individualized academic advising, diagnosis or
  clinical support; crisis resources reachable as they are elsewhere on the site.
- **Review:** the question tree and its resource mapping are approved by authorized student staff before release.
- **Accept:**
  1. Every leaf of the question tree resolves to at least one approved resource id; a test fails on an unknown id.
  2. Network capture shows no request carrying the visitor's answers.
  3. The full Resource Finder link is reachable from every step by keyboard.
  4. Wording review confirms no advising/diagnosis language.
- **Status:** Approved 2026-11-11; built 2026-11-11 (branch `explore-b-2026-11`). The tree
  needs its student-staff review before release; the library holds no general
  academic-advising record, and the tree claims none.

## EXPLORE-I-BUS-ROUTES · Housing-to-Campus Bus Route Explorer (WORK item 45)

- **Target:** public website, Navigating Housing (`btw-navigating-housing.json`, `housing-hub.json`).
- **Data sources:** Madison Metro GTFS static data
  (https://www.cityofmadison.com/metro/business/information-for-developers); OpenStreetMap tiles/data; UW campus
  building location data (source and licence to be confirmed).
- **Scope:**
  1. Enter and compare **several prospective housing addresses side by side**.
  2. Select **several UW academic buildings** as destinations.
  3. Show nearby Metro stops and routes on a simplified OpenStreetMap-based map, with a list equivalent.
  4. Determine from GTFS route topology whether each route actually reaches the vicinity of the selected building.
  5. Classify each address–building pair as **direct**, **transfer required** or **no suitable connection**.
  6. Show approximate walking distances: address → stop, and stop → building.
  7. **No** commute-time calculation, departure or arrival times, schedules or live predictions.
  8. A route that cannot be verified is not labelled available.
- **Dependencies / verification before build:** Metro GTFS licence and attribution terms; OSM attribution and tile
  usage policy (or a self-hosted/simplified base map); campus building coordinates source and licence; geocoding
  approach that does not send addresses to a third party without disclosure (prefer a server-side geocoder within
  allowance, or a documented provider whose terms permit it); route-topology verification against at least three
  known pairs.
- **Student-facing behavior:** type addresses, pick buildings, read a comparison table (per address × building:
  direct route numbers / transfer / none, walking distances), with the map as an aid.
- **Safeguards:** addresses are **not retained** by default (no server log, no storage, no analytics); any future
  Metro developer API key stays server-side in Netlify environment variables, never in the repository or frontend;
  map attribution displayed; table works without the map.
- **Review:** Nicholas approves the data-source verification note before production; building list reviewed by
  student staff.
- **Accept:**
  1. Fixture GTFS: a pair served by one route reads "direct"; a pair needing two routes reads "transfer"; an
     unserved pair reads "no suitable connection".
  2. A route missing from verified topology is never shown as available.
  3. No time, schedule or prediction field appears anywhere in the output or payload.
  4. Network and function logs show no stored address; secret scan finds no Metro key in `dist/` or git.
  5. OSM and Metro attribution visible; table fully usable with the map hidden and by keyboard.
- **Status:** Proposed / Not Implemented.

## CHANGELOG-PUBLIC-RECONCILE · Public website change history (WORK item 46)

- **Target:** public website.
- **Source found (10 Nov 2026):** the prepared change list is the 7 Nov package, copied to
  `Admin/Handoffs/active/VERSION-HISTORY/` (original in Nicholas's Downloads). Its website history is commit `b4658bd`
  ("history: check version notes before handoff"), on base `8e7e220`, writing `docs/VERSION-HISTORY.md`.
  `Public-changelog.md` is its reading copy; `public-review/review.json` is its review ledger.
- **Done 10 Nov:** the bundle's branch was imported into this repository as the local branch
  `bss/local-version-history` (Nicholas's ruling). Nothing was pushed. `main` holds later commits not covered by it;
  measure with `git rev-list --count 8e7e220..main`.
- **Scope:** open the branch with `open_public.py` (see the package README); extend the history and ledger over
  `8e7e220..main` with `npm run history:start -- --base 8e7e220` and `npm run history:check`; rebase onto `main`;
  commit with `[skip netlify]`. Keep a Changelog form; no invented dates, deploys or tags.
- **Shared standard:** the website, Connect and SPILL keep separate changelogs in one common format (Keep a
  Changelog, audience groups where useful), as the package already sets out.
- **Accept:** `npm run history:check` passes on the rebased commit; every dated release matches a recorded Netlify
  deploy; nothing duplicates WORK.md's queue.
- **Status:** Proposed / Not Implemented.

## VERSION-HISTORY-GATE-PUBLIC · Release check for the website history (WORK item 47)

- **Scope:** register the package's history check in the website's release-candidate command (`--version-history`),
  per `shared/RUNBOOK.md`. The installer writes a required step into the root agent instructions.
- **Approval:** Nicholas sees the exact instruction diff before it is installed (his ruling, 10 Nov 2026).
- **Accept:** removing a commit disposition makes the candidate check fail; restoring it makes it pass.
- **Status:** Proposed / Not Implemented. Depends on item 46.
