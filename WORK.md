# Work

Where the rebuild of www.badgersupports.org stands, what is left in order, and what only the owner can do. The
brief is `../MASTER-PROMPT.md`. Updated 11 Nov 2026 (merge pass: the redesign pages and fixes, the forms redesign, Explore A and B and items 46–47 merged to `main`; earlier session detail in `docs/QUEUE-HISTORY-2026-11-10.md` and the session handoffs).

## Where it stands

**3 Nov publication:** production deploy `6aea8f7fac652627ab7a59db` is ready, titled "Website (01a1222)"; GitHub and canonical main match. Signed-in Home, real team/profile and a rendered portrait checked; all 13 native form-state endpoints report closed. All four workshop topic links retain matching Google prefill. Portrait HTTP status was not read. Owner flags team styling/order and image quality: two measured public portraits are 200 px, enlarged to about 269 px; the current main site uses larger sources. Layout/source-photo follow-up remains open; no live settings or submissions changed. The older dated table below is historical.
**Current slice: 1** (research, identity, usability). On 23 Oct the owner asked for the **live site, connected to
Connect**, more colour, a cohesive design and **no departure from the brand** (Decisions). Silence is not approval.
Every person named in `content/` is fictional; real team members appear only through their own Connect profile.

| | State on 25 Oct 2026 |
|---|---|
| Built locally | **The live build** (`--production`, what a publish now runs): 37 pages, its events and resources read from Connect as it builds, forms closed and linking their Google Forms, no team or wall until Connect exports them. **The prototype** (fixtures, noindex): 58 pages, adding 14 fictional team pages and 7 form previews. 27 block types; 5 native forms (both applications and the letter closed, with PDF uploads); the intake API on PGlite; SPILL's moving logo; staff sign-in through Connect, answers handed to Connect, **Edit text**. 24–25 Oct (run log §1–8): upload race and failure states, phone menu, a form changed while open, sign-in states and access freshness, width and helper text, stale replies and Back/Forward, the editor's keys, earlier versions and Restore, characters left |
| Tested | `node ops/check.mjs --browser`: see "Evidence". Connect's feed against a fake Connect (`test/connect-feed.test.mjs`); the rest against a local rig with demo keys (setup file 5): not a live connection. A quick, source-only security audit, 23 Oct (run log §13; its report is kept outside the repository) |

The Committed, Deployed and Verified live rows of this table are dated history; they moved to `docs/QUEUE-HISTORY-2026-11-10.md` on 11 Nov 2026 (Session 14). The header above them still reads 25 Oct because the two rows that stay were written then.

## Slice 1 against §12

| §12 asks for | State | Where |
|---|---|---|
| Route map with dispositions | done: 39 routes; 17 redirects written, 0 waiting | `docs/research/ROUTES.md`, `content/routes.json` |
| Form map, unknown settings listed | done: 9 public workflows; settings not seen are listed | `docs/COMMUNICATIONS.md`, `../FORM-AUDIT.md` |
| Asset map | done: the manifest's 79 entries (34 library photos, 43 live images, 2 derived maps) have size, hash, crop and source. Of the other live pages' 117 images, the 27 recommended are saved (20 Oct) and 10 are the owner's call; the two rebuilt hidden pages' 28 are listed, none recommended | `media/manifest.json`, `docs/research/LIVE-IMAGES-2026-10-20.md` |
| Engagement recommendations, source-backed | done 23 Oct: a per-task map for the five §3 tasks (queue item 6); general principles in `../INVESTIGATION.md` | `docs/research/ENGAGEMENT-2026-10-23.md` |
| Responsive homepage prototype | built: 1280, 390 and 320 px | `content/pages/home.json` |
| One native form | built: workshop request; also programming feedback (anonymous), both applications and the recommendation letter (closed; a preview page each) | `content/forms/` |
| Reasons by visitor task | in each round's notes | `docs/DECISIONS.md` |

## Decisions

The owner's rulings are in `docs/DECISIONS.md`; the newest win. Current rule index: `docs/ACTIVE-RULES.md`. Everything
else this session chose is a **proposal** (`docs/DECISIONS.md` §4).

- **Editing, delivery, platform** (24 Oct 2026; `docs/DECISIONS.md`, "Two answers", "The platform"): Edit text grows
  toward SPILL's and a permitted save publishes; everything is editable, here and in Connect; changes show within 30
  minutes, with Refresh now for editors; Try again resends only the reader's own forms; a failed delivery is retried
  within 30 minutes; decisions and bulk mail are approved first; no new subscriptions; Web Analytics, not GA4.
- **Content** (20 Oct 2026): the live pages' content is restored where it was dropped (Peer Groups' day cards and
  activities; Get Involved's hiring steps, volunteer bullets and Equal Opportunity line). Our Team mirrors the live
  grid: big red capital group headings, no clipart, four square photos a row, role above, name below in red.
- **Photos and live pages** (20 Oct 2026): faces are wanted; name tags, QR codes, phone screens and UW marks are allowed;
  pick on quality; every slot can be swapped by link. 43 live images are approved and saved; any other download is
  listed for the owner's OK first; the LCM banner photo stays. SAC and University Square are rebuilt, out of the menu
  as live; Little Hearts and Leadership 301. Connect's 86 resource records are approved; "email us" is directors@.
- **One photo, one place** (12 Nov 2026): a photo appears once on this site; a repeat use is replaced with a different Drive photo — audit and replacements in Admin/Handoffs/active/PUBLIC-SITE/PUBLIC-PHOTO-ONCE-HANDOFF-2026-11-12.md.
- **Launch** (20 Oct 2026): releases are built on the laptop, which holds the photo originals; the native forms
  launch closed, each page linking its Google Form; the hero's moving circles have a Pause button.
- **The live site, connected to Connect** (23 Oct 2026): a publish runs the production build, which reads Connect's
  public events and resources and builds nothing if it cannot. The hero's "Drop in this week" and the "All events
  on Badger Supports Connect" link are gone; nothing in Connect was touched. Supersedes "online first" (20 Oct).
- **Design** (23 Oct 2026): "more cohesively designed … look at the lessons of Badger SPILL", then "be careful not
  to deviate from the badger supports brand", which wins: style.badgersupports.org's Montserrat (800 capitals for
  titles), cream paper, round corners, flat pills; SPILL's lessons in the brand's terms (run log §10, `docs/DESIGN.md`).
- **Who may do what** (20 Oct): "adjusted in permissions by a super admin", as SPILL does. In Connect, per tier:
  sign-in, each form's answers, `site.edit`, `site.publish`; first names one setting. Members never read answers.
- **Colour** (23 Oct 2026, superseding Round 5): peer support groups green, craft nights purple, "more color in
  places", from the brand rainbow. **No decorative coloured bar on any edge** (24 Oct, widening Round 7); rules solid.
- **Words**: the live site's and the decks' own wording wherever a match exists (`docs/research/COPY-SOURCES.md`).
- **The Hub** is the one place people find us; the others are event rooms (Round 4). Seven rooms, all published: Hearing
  and Multipurpose take the Caucus steps with their own map, Marquee and Tripp show their address only (20 Oct 2026).
- **Room pages' “All Rooms” button** (12 Nov 2026): it stays removed — the redesign read the brief's “remove the 'Other Rooms We Use' button” as this crumb, and the owner confirmed that reading on 12 Nov 2026.

## Evidence
Continuation candidate of 3 Nov: its team order and photos part landed in `389fc77` (item 19); the rest stays a
separate `codex/public-queue-2026-11-03-e` tree, not merged. Cloud runs, 2 Nov 2026: items 20 and 25 verified;
full text of both paragraphs in `docs/QUEUE-HISTORY-2026-11-10.md`.
**Not run:** anything deployed or live (Netlify, Blobs, the CDN, Connect, Google, mail); the photos; the pinned Chromium. The merged-tree gate for the 11 Nov 2026 merge candidate: its one full run found two merge-caused failures, both fixed and re-verified by their targeted suites; the confirmation re-run was stopped at the owner's direction and the Session 17 publish file skips the checks step at his direction (11 Nov 2026) — each merged branch was gated on its own tree before merging. The browser gate and Explore B's viewport and keyboard passes ran post-publish on the merged tree, 11 Nov 2026 (PUBLIC-POST-PUBLISH-CHECKS-HANDOFF-2026-11-11): the standard gate passed in full (tests 493 passed, 1 skipped) and accessibility passed 246/246; those defects and the two suite expectations that predated the redesign (Craft's captioned-card count; the room-arrival part's jump anchors, which the section navigation replaced) were fixed on the checks branch the same night (PUBLIC-DEFECT-FIXES-HANDOFF-2026-11-11), and the full gate re-run there passed everything: tests 493 passed, 1 skipped; shots 210/210; accessibility 246/246; interact 827/827.

## Blockers

1. **Not tried live.** The site is behind Netlify's team sign-in, so sign-in, delivery to Website Forms and Edit text
   have passed only on a local rig (setup file 5); nor is it read whether the live API answers `ok`, not 503 `config.missing`.
2. **The live build needs Connect.** CONNECT_URL and the two `PUBLIC_SITE_SERVICE_*` keys must reach the build, not
   only the functions; without them a publish stops with "Nothing was built" and the last deploy stays.
3. **Releases come from the laptop**, in a new folder outside the synced one: only it has the 23 Drive originals,
   and the synced `dist/` holds conflict copies that cannot be deleted here (`docs/DESIGN.md`).
5. **Connect** reports exports/resource ingestion published in its 2 Nov handoff; website verification/consumer completion is still owed (priority item 19; item 21). Exports remain off and forms closed in this tree.
6. **Cost**: prices read 23 Oct (`docs/ARCHITECTURE.md`, "Cost"); what each database used is in Billing → Usage only.
7. **The privacy policy** page still names Google Sites, Analytics and Forms. The draft of what the site does now, `docs/PRIVACY-POLICY-DRAFT-2026-10-30.md` (`2bab970`), waits for the owner's and a legal review.
8. **Analytics measures nothing yet.** The forwarder is built and ships unconfigured; the GA4 property is unverified and the connector asked to reauthenticate.

## Owner actions

1. **Review the design**: `local/shots/`, or `npm run dev` and open the site. Say what to change.
2. ~~Photos: confirm the release~~ **closed** 10 Nov 2026: every Badger Supports Drive photo is approved, faces
   included (Nicholas; `docs/DESIGN.md`, Photos). Still yours: the 10 live images and the SAC ribbon heap (`docs/research/LIVE-IMAGES-2026-10-20.md`).
3. ~~Q1, GA4~~ **answered** 11 Nov 2026: Google Analytics, with **no consent step** — it loads on public pages as
   the page loads (`docs/ANALYTICS.md`). What remains is the property verification in action 8.
4. ~~Confirm the receipt sender~~ **confirmed** 11 Nov 2026: `directors@badgersupports.org`.
5. ~~Backup spreadsheet account~~ **confirmed** 11 Nov 2026: the workbook lives in `directors@badgersupports.org`.
6. Ask Programs whether they want an email for each submission, and whether "within one week" holds.
7. Say how a mailing-list request reaches the Google Group today.
8. Reauthenticate the Analytics connector so the GA4 property can be verified, and confirm enhanced measurement is off in its data stream.
9. **Publish**: open `../PUBLISH-WEBSITE-2026-10-23.command`, type `publish`. Who may see it is yours: team-only now.
   It builds the live site. First: in Connect, Admin › Resources › Public Website List, tick the event types and
   weekly groups to show. The file gives the build Connect's key itself. Its log names events left out (run log 13.9).
11. Point `feedback.badgersupports.org` at `/forms/programming-feedback/` (DNS) only once that form opens here; until then, its Google Form.
13. Signed in to Netlify, try the live site: a test form, staff sign-in, the answer in Connect, Edit text.
14. Resources: add or drop each live entry Connect lacks (`docs/research/RESOURCES-VIEWER-2026-10-20.md`).
15. **Netlify credits**: read Billing → Usage for all three projects; cap this database at 1 CU. Auto recharge stays off (24 Oct).

## Queue, in order

**Done** 20 Oct: 2, 3, 5, 8, 11. **Done** 23 Oct: 4, 6, 9, 10, 12, 13, 14, 27, 28, 29, 32 (run log). **Added 24 Oct,
queued only:** 33–39 (briefs of 24 Oct). **Added 10 Nov, queued only:** 40–47 (full entries in
`docs/EXPLORE-CAMPUS-QUEUE-2026-11-10.md`). Full original lists in `docs/QUEUE-HISTORY-2026-11-10.md`.
19. **PRIORITY ONE · Complete Connect → public website delivery** (queued 3 Nov; Connect CONNECT-PUBLIC-DELIVERY-P1; Decisions, 3 Nov).
    Website consumer verified locally 10 Nov (Session 12): Connect's `publicTeam`, `publicWallNotes` and `publicEvents` actions exist, this site's consumer reads them, team and wall exports are on in `content/connect-feed.json`, incomplete profiles render, private fields stay out, and Connect's team order and photos are honoured (`389fc77`). Remaining: live verification after a publish that carries Connect's keys. No switch changes in this queue update.
1. **Owner review of the design** → changes made, screenshots re-read at 1280, 390 and 320 px.
7. **Live image inventory** (§11): 43 saved 20 Oct; 10 left to the owner, 28 more listed → each approved one fetched.
15. ~~Editor and publishing~~ **closed** 11 Nov 2026 (Session 13): the P2 remainder was verified part by part against the editor's tests — every field kind, grants, conflicts, kept history and Restore, a refused save keeping the edit — and all of it is shipped. The mapping is in the Session 13 handoff; the full entry stays in `docs/QUEUE-HISTORY-2026-11-10.md`.
16. **Connect: drafts, preview, restore; add, duplicate, reorder, retire pages** (`PUBLIC-SITE-EDITOR-REVISIONS`). **Shipped** in `1aaf44a`; **Put Back for a retired page** `0e6f374`, published in deploy `6ae91d6b` (2 Nov). Connect side: the card words are **done** — Connect set them word for word in `d2512ba` (Exchange `PUBLIC-SITE-PAGES` and `PUBLIC-SITE-SECTIONS`, both in `done/`), and this session read them in Connect's publish branch on 11 Nov 2026 (Session 14). What remains is Connect's promised confirmation note to `to-public/` after Nicholas publishes Connect (Exchange `PUBLIC-SITE-PAGES-CARD-WORDS-2026-11-11`).
17. **Connect: forms** (`PUBLIC-SITE-FORMS`; answers reach Website Forms, **done** 20 Oct). The switch **built** 30 Oct: Open (asked
    twice) and Close on `/staff/` for `forms.switch:<key>`, on the page with no deploy; a stale tab refused (`test/intake.test.mjs`). Connect's grant is **built** in `d2512ba` (Exchange `PUBLIC-FORM-SWITCH-GRANT`, in `done/`): one `forms.switch:<key>` line per form on the "Who May Do What on the Website" card, a super admin's note carries `forms.switch:*`, and nothing is ticked for any tier until a super admin sets it. It goes live when Nicholas publishes Connect; a form added later needs a new line in Connect, asked for by an Exchange item. "34 passing tests" was Connect's count.
18. **Outbox and backup** (`PUBLIC-SITE-EMAIL-AND-BACKUP`) → **built, shipped switched off** in `9bf0ed5` (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`). Sender and workbook account **confirmed** 11 Nov 2026: `directors@badgersupports.org` for both. Activation waits on: Connect's `publicReceipt`, `RECEIPT_SENDER` set to the confirmed sender, the workbook created in that account and shared, and the schedule (owner, `docs/COMMUNICATIONS.md`).
20. **Director sign-in** (`PUBLIC-SITE-SSO`) → **built** 20 Oct; Google sign-in consumer live 30 Oct (`a78d13e`); the address-after-sign-in fix was committed and pushed 2 Nov and deploys with the next publish (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`). Not tried live end-to-end (Blocker 1).
21. **Resource viewer** (§8) → one viewer with Report a Problem, Suggest a Resource and Suggest an Update, moderated. **Built** 30 Oct; the three forms ship open (10 Nov). Connect reports ingestion published 2 Nov: delivery still to verify live before activation is claimed. Report alerts are configured in Connect Settings (ADMIN-A6), not a public mail engine.
22. **Analytics** → Google Analytics (owner, 11 Nov 2026; supersedes the 24 Oct Web-Analytics-only position). The forwarder is **built**: exclusions first, the dictionary only, no Connect identity, **no consent step**; it ships unconfigured, so nothing is measured. Activation: reauthenticate the Analytics connector, verify the property, confirm enhanced measurement is off, then give the publish build `GA_MEASUREMENT_ID` (`docs/ANALYTICS.md`). Web Analytics remainder, checked from local evidence 11 Nov 2026 (Session 14): every project's own documents record only the owner's 24 Oct report that he turned it on — not which projects it covers or whether it is billed — and Support Badgers is on GitHub Pages, not Netlify, so it has no Netlify Analytics to verify. The per-project state can only be read signed in to Netlify (each project → Analytics & metrics › Analytics; billing under Billing → Usage, owner action 15). Detail in the Session 14 handoff.
23. **Cost plan** → **done** 23 Oct (`docs/ARCHITECTURE.md`, Cost; owner action 15). Open tail: check form state at first keystroke — waits for the owner's yes. No new subscriptions (24 Oct).
24. ~~The §12 server tests~~ **shipped** in `9bf0ed5` (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`). Revocation stays Connect's (`publicSsoStatus`, item 20).
25. **Before the switch** → **checked** 30 Oct (`23afc2e`); plan and undo in `docs/SWITCH.md`. Mendota Lodge and a final `/` **fixed**,
    published in `2bab970` (queue 3a). Owed: www sign-in at Connect, the reviewed privacy policy, the owner's word; his steps: `../SWITCH-SETUP-2026-10-30/`. (Connect's team export stood on this line until 11 Nov 2026: item 19 covers the delivery and its live verification, so the line was a duplicate — Session 14, from the Session 12 proposed-archive list.)
26. **The one-week promise** on the workshop confirmation → **ruled by Programs, 11 Nov 2026 (relayed by Nicholas): remove the promise** — the workshop confirmation carries no response-time promise. Programs also ruled the same day: **yes to a per-submission email** — each workshop request sends Programs an email as it arrives. Both are **built and merged to main 11 Nov 2026** (forms redesign, merge pass): the confirmation carries no promise, and each workshop request queues one notice to Programs, held until the verified sender is set and Connect's `publicNotify` action lands — not yet live.
30. ~~Past craft nights~~ **shipped**: Connect sends `recent`, the site reads it, `endDate` shipped in `9bf0ed5` (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`).
31. **Form setup**: all permitted forms are configurable/openable through /staff/ → Set Up Forms; resource-choice validation is repaired and all 13 live journeys passed (shared public handoff, Nov 5). This staged candidate adds recommendation-cycle link context beside answers; Connect must support it first. No form opens automatically and no person is matched by name.
33. **Functionality and UI pass** (24 Oct brief) → **shipped** in `9bf0ed5`, each part on a regression shown failing first (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`).
34. **Publishing and refresh** (P1) → slices 1–7 **shipped** in `9bf0ed5` and `3106704` (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`).
35. ~~No decorative coloured bars~~ **shipped** in `9bf0ed5`; the guard is in `test/pages.test.mjs` (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`).
36. **A `to-public/` inbox** (X1) → **done for this site** 30 Oct: inbox registered, pointers in `CLAUDE.md` and `AGENTS.md` (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`). Connect's and SPILL's own pointers are theirs to make. Inbox checked 10 Nov (Session 12): empty.
37. ~~Clean delivered files~~ **shipped** in `9bf0ed5`; payload −33% gzip (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`).
38. ~~Crawlers and abuse~~ **shipped** in `9bf0ed5`: 40 sends an hour per form per address, 429 with Retry-After (full entry in `docs/QUEUE-HISTORY-2026-11-10.md`).
39. **Netlify features already included** (P5; X4) → map **done** 25 Oct (cloud run §8; `docs/ARCHITECTURE.md`): used, available,
    unknown; Lighthouse run locally; Netlify Forms pilot not recommended. First slice **approved by the owner 11 Nov 2026 and built**
    (Session 15): Slice 39-A, site-wide search — a `/search/` page that searches the public pages in the
    visitor's browser against the build's index (`search-index.json`); `/staff/`, `/api/` and form answers stay out. **Hidden from the
    navigation** (Session 16): the owner ruled on 11 Nov 2026 that Search does not appear in the menu; the page works at its address,
    unlinked from the navigation. The rest of the map waits.
40. **Explore Campus hub** (`EXPLORE-HUB`) → **built and merged to main 11 Nov 2026** (merge pass): `/explore/` gathers the
    built explorers as cards in `content/pages/explore.json`, linked from Home, Resources, Get Involved, Support Networks,
    Navigating Housing and the Housing Hub. The classes and academic support cards were appended at merge, as the hub was
    built for. Publish stays Nicholas's.
41. **Campus Events Explorer** (`EXPLORE-A-EVENTS`) → **built and merged to main 11 Nov 2026**: UW Events API plus the
    Union's full feed (the queue-named `feed_1` carries titles only; `docs/research/EXPLORE-FEEDS-VERIFICATION-2026-11-11.md`),
    deduplicated, Badger Supports programs from Connect's list, refreshed by `/api/campus-events` with the last good list
    kept. The Find Your People mapping (`content/explore/interests.json`) awaits Engagement staff review; the full browser
    gate ran post-publish on the merged tree (checks handoff); its Explore failures stand at items 43 and 45.
42. **Enhanced Resource Finder, public half** (`EXPLORE-C-RESOURCE-FINDER`; extends 21) → **built and merged to main
    11 Nov 2026**: source lines with publisher and review date, unapproved outside records never drawn. Connect side
    approved and with Connect Session 13.
43. **Discover Classes by Interest** (`EXPLORE-F-CLASSES`) → **built and merged to main 11 Nov 2026**; production
    switch **on 12 Nov 2026** — Nicholas's ruling of 12 Nov supersedes his 11 Nov ruling (permission was to be
    sought): permission is no longer sought, on his stated basis that others have built on this data without it. Post-publish verification (checks handoff): the page scrolls sideways at 390 (17px) and 320 (84px) — one pulled title in `content/fixtures/courses.json` (GEN&WS 539, `Health&Embodiment_FemnistPract`) is a single unbroken 336px word that sets the card column's width — and the page loads 1,867 KB at phone widths. The sideways scroll was fixed on the checks branch and merged to main 12 Nov 2026 with Nicholas's approval (defect-fixes handoff): the list's one column is capped at its own width and a title that arrives as one unbroken word breaks inside its card, its text unchanged; the page weight stands as recorded.
44. **Academic Support Navigator** (`EXPLORE-G-ACADEMIC-NAV`) → **built and merged to main 11 Nov 2026** at `/explore/academic-support/`; the tree needs its student-staff review before release.
45. **Housing-to-Campus Bus Route Explorer** (`EXPLORE-I-BUS-ROUTES`) → **built and merged to main 11 Nov 2026**: topology from the Metro GTFS (feed S072_202608240858) in `content/transit/topology.json`, 20 campus buildings from OpenStreetMap, `/api/geocode` and `/api/bus-routes`, **no times, schedules or predictions**; verification in `docs/research/EXPLORE-TRANSIT-VERIFICATION-2026-11-11.md`, approved by Nicholas 11 Nov 2026. On Navigating Housing the tool is signposted, not hosted (his ruling, 11 Nov 2026), so the workshop pages keep their no-collection rule. Post-publish verification (checks handoff): /explore/bus-routes/ scrolls sideways by 2px at 320 — the form's rows measure 281px from x=41 and end at x=322. Fixed on the checks branch and merged to main 12 Nov 2026 with the owner's approval (defect-fixes handoff): the form's one column is capped at its own width and the buildings fieldset may shrink below its widest line; the rows now end inside the form at 320.
46. **Change history** (`CHANGELOG-PUBLIC-RECONCILE`) → **built and merged to main 11 Nov 2026**: `docs/VERSION-HISTORY.md` imported byte-identical from the prepared branch and extended through the merge candidate, all in Unreleased.
47. **Version history check** (`VERSION-HISTORY-GATE-PUBLIC`) → **installed and merged to main 11 Nov 2026** (the exact diff Nicholas approved, `Admin/Handoffs/active/PUBLIC-ITEM-47-DIFF-2026-11-11.md`); `npm run history:check` run green on the merged tree in the merge pass.
48. **Drop In This Week photo carousel** → **built on `dropin-carousel-2026-11-12`** (off the timetable-container branch): five Hub photos as a carousel across the foot of the home timetable card, with buttons, dots and arrow keys; handoff `PUBLIC-DROPIN-CAROUSEL-HANDOFF-2026-11-12.md`.
49. **Email links copy first** (`EMAIL-COPY-FIRST`) → **built 12 Nov 2026** on branch `email-copy-2026-11-12` (approved by Nicholas from the preview the same day): pressing an email link copies the address and opens a popup saying so, with Copy again and Open in mail app; the mailto: is never followed uninvited, and without JavaScript the link stays a plain mailto:. Handoff: `Admin/Handoffs/active/PUBLIC-SITE/PUBLIC-EMAIL-COPY-HANDOFF-2026-11-12.md`. The owner's publish run owns merging and publishing.
50. **Safety Exit** (`SAFETY-EXIT-PUBLIC`) → **built on branch `safety-exit-2026-11-12`, not merged**: a pill at the header's right on every page — a plain link to the Safety Exit destination (Site Settings; default https://www.google.com/, and an unset, empty or invalid value falls back to it; a change takes effect on the next publish) — one press or three quick Escapes opens the destination in a new tab, replaces this page with it in this tab and tries to close the tab, never measured; the privacy policy says plainly what the button cannot do. Handoff: `Admin/Handoffs/active/PUBLIC-SITE/PUBLIC-SAFETY-EXIT-HANDOFF-2026-11-12.md`.
51. **Craft Nights gallery row** (`CRAFT-GALLERY-ROW`) → **built on branch `craft-row-2026-11-12`, not merged**: "Made at Past Craft Nights" stands in one row of smaller pictures by default (sideways-scrolling on a phone), with two Site Settings — Craft Nights Photos to Show (1–12, default six) and Craft Nights Gallery Layout (One Row / Grid) — taking effect on the next publish. Handoff: `Admin/Handoffs/active/PUBLIC-SITE/PUBLIC-CRAFT-ROW-HANDOFF-2026-11-12.md`. (The safety-exit branch also numbers its item 48; the merge pass renumbers one.)
52. **Catalogue pages load on first use** (`CATALOGUE-FIRST-USE`; audit C-23, approved by Nicholas 13 Nov 2026) → **built on branch `catalogue-first-use-2026-11-13`, not merged**: the classes page, the resource list and the Campus Events Explorer carry their first view in the page and fetch the rest of the catalogue from a data file beside the page (courses-data.json, resources-data.json, events-data.json) the first time a visitor opens, scrolls to, searches or filters into it — the site search's pattern, with its loading line and Try Again state. In the local build the classes page's HTML falls from 1,602,214 to 30,526 bytes. Handoff: `Admin/Handoffs/active/PUBLIC-SITE/PUBLIC-CATALOGUE-FIRST-USE-HANDOFF-2026-11-13.md`.

## Git and publishing

`site/` is git, `main`, pushed to the public `nicholas-badgersupports/badgersupports`. A session commits and pushes its own work (Nicholas, 2 Nov 2026), every commit carrying `[skip netlify]`; only the owner
publishes, with `../PUBLISH-WEBSITE-2026-10-23.command`, which first makes `node_modules` match `package-lock.json` (`ops/deps-match.mjs`, then `npm ci` when they differ). A session reads git with `git --no-optional-locks`.
The laptop's shell cannot push: a cloud clone pushes, then the laptop's `site/` is brought up to it (`git fetch`, `git merge --ff-only`). The 25 Oct cloud run's patch was published as `9bf0ed5`. Never link it to Netlify: a Netlify build creates a database.
On 12 Nov 2026 the owner approved merging `checks-2026-11-11` into `main` (the three post-publish defect fixes and two stale suite expectations); it merged the same day, and the owner publishes the merged head with the `../PUBLISH-MERGED-2026-11-12-NEXT/` file after he pushes `main`.
Event type names (12 Nov 2026): branch `event-type-names-2026-11-12` names the five Connect types the merged publish found unnamed (`dogsoncall`, `navigatinghousing`, `outreach`, `spill`, `tabling`) in `content/connect-feed.json`; built and tested, unmerged, and the names reach the live site at the next publish.
On 12 Nov 2026 the owner ruled that underlines are only for tappable links; branch link-underline-2026-11-12 removed the hover underlines from non-link controls (the resource and prose more summaries, and form step names) and from the unused ribbon-source style. Real links keep their underlines unchanged.

## Exchange
`../../Admin/Handoffs/Exchange/`. **This session's inbox is `to-public/`** (item 36): list it at the start and before finishing. Answered (`done/`): the eight `PUBLIC-*` of 20 Oct, the invites; 24 Oct `PUBLIC-EVENTS-RECENT`,
`PUBLIC-EVENT-IDS-AND-SIGN-IN`, `NETLIFY-DATABASE-AWAKE`; 25 Oct, in Connect's `73cf3cf`: `APPLICATION-FORMS-*`, `APPLICATION-FILES-HANDOVER`, `RECOMMENDATION-LETTERS-INTO-CONNECT`, `PUBLIC-EMAIL-LIST-STATES`; 30 Oct, from SPILL: `SPILL-CRAWLER-CONTACT` (`/crawlers/` now speaks for this site only).
Their replies say migration 035 "applies on publish": `73cf3cf` is in Connect's production `202b88f`, whose deploy applied only 036, so 035 ran before it (inferred from the deploy record, not read). SPILL answered its inbox registration. Open from this session: Connect's inbox registration; item 19's `PUBLIC-TEAM-PROFILES-2026-10-30`, `PUBLIC-WALL-OF-SUPPORT-2026-10-30`; item 21's `PUBLIC-RESOURCE-SUGGESTIONS-2026-10-30` (30 Oct); item 17's grant and item 16's card words are answered in `done/` (follow-up confirmation ask: `PUBLIC-SITE-PAGES-CARD-WORDS-2026-11-11`). Owed by Connect: its XSEC-1 handoffs.
Profile-photo speed (12 Nov 2026): branch profile-photo-speed-2026-11-12 @ 6a0d866 — right-sized WebP/AVIF variants through the bounded team-photo proxy (team page 14.6 MB -> 1.1 MB at DPR 2); three profile-layout options await owner pick. Handoff: Admin/Handoffs/active/PUBLIC-SITE/PUBLIC-PROFILE-PHOTO-SPEED-HANDOFF-2026-11-12.md.
