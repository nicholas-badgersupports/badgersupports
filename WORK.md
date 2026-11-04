# Work

Where the rebuild of www.badgersupports.org stands, what is left in order, and what only the owner can do. The
brief is `../MASTER-PROMPT.md`. Updated 3 Nov 2026 after publication and signed-in read-only checks.

## Where it stands

**3 Nov publication:** production deploy `6aea8f7fac652627ab7a59db` is ready, titled "Website (01a1222)"; GitHub and canonical main match. Signed-in Home, real team/profile and a rendered portrait checked; all 13 native form-state endpoints report closed. All four workshop topic links retain matching Google prefill. Portrait HTTP status was not read. Owner flags team styling/order and image quality: two measured public portraits are 200 px, enlarged to about 269 px; the current main site uses larger sources. Layout/source-photo follow-up remains open; no live settings or submissions changed. The older dated table below is historical.
**Current slice: 1** (research, identity, usability). On 23 Oct the owner asked for the **live site, connected to
Connect**, more colour, a cohesive design and **no departure from the brand** (Decisions). Silence is not approval.
Every person named in `content/` is fictional; real team members appear only through their own Connect profile.

| | State on 25 Oct 2026 |
|---|---|
| Built locally | **The live build** (`--production`, what a publish now runs): 37 pages, its events and resources read from Connect as it builds, forms closed and linking their Google Forms, no team or wall until Connect exports them. **The prototype** (fixtures, noindex): 58 pages, adding 14 fictional team pages and 7 form previews. 27 block types; 5 native forms (both applications and the letter closed, with PDF uploads); the intake API on PGlite; SPILL's moving logo; staff sign-in through Connect, answers handed to Connect, **Edit text**. 24–25 Oct (run log §1–8): upload race and failure states, phone menu, a form changed while open, sign-in states and access freshness, width and helper text, stale replies and Back/Forward, the editor's keys, earlier versions and Restore, characters left |
| Tested | `node ops/check.mjs --browser`: see "Evidence". Connect's feed against a fake Connect (`test/connect-feed.test.mjs`); the rest against a local rig with demo keys (setup file 5): not a live connection. A quick, source-only security audit, 23 Oct (run log §13; its report is kept outside the repository) |
| Committed | GitHub `main`, `nicholas-badgersupports/badgersupports` (a public repository), holds queue item 15 (`3cc7c52`) and item 24 (past events at full contrast, the commit after it), pushed 2 Nov, not yet published; everything to `892b171` (items 14 and 19) published, Deployed. Before them: `8604262` (queue item 10, sharp 0.35.5, after item 15's menu `96b32cd`, settings `fe8684a` and rooms `bf83919`); GitHub's Dependabot lists 0 open alerts and the three sharp alerts closed as fixed (read 2 Nov). Before them: `db64dd7` (queue item 8), `598ce71`, `1aaf44a`. `9bf0ed5`, the owner's publish of 25 Oct 11:36, holds the 24–25 Oct run and the 25 Oct cloud run (run log, "Cloud run"; migration 006); the editor patch `3106704` followed it |
| Deployed | Read from Netlify 2 Nov (read-only): production is `892b171` (deploy `6ae92dab`, `ready`, published 3 Nov 00:41 UTC from the laptop, titled "Website (892b171)"; no migrations; functions `api` and `pages`). `0e6f374` was deploy `6ae91d6b`. `8604262` was deploy `6ae66fa0`. `db64dd7` was deploy `6ae5aeae` (`008_site_structure` applied). `b880da4` was deploy `6ae57e7e`; `2fc83bd` was deploy `6ae5698d`. `a78d13e` was deploy `6ae4da91` (`007_staff_method` applied by it). `9bf0ed5` was deploy `6ade3037` (25 Oct, with its packages; migrations 001–006). Connect's production is deploy `6ae80763` (2 Nov; its commit not read here) |
| Verified live | Read signed in to Netlify, 2 Nov, read only: the home page's title and description; a room's page (`/directions/sac-mhh/`) with its words, next events and photos, each photo answering 200; Netlify no longer injects RUM, only its team HUD for a signed-in member, whose inline script and style the CSP refuses. While the team login is on, the page's own `/api/events/<page>` ask gets Netlify's login page (401), because `schedule.js` sends no cookie; visitors after the switch are not affected. `/staff/` not read (Connect's sign-in had lapsed). Read signed in to Netlify and Connect, 31 Oct, read only: `/staff/` lists 34 pages and a page's Sections opens; the home page carries `x-bss-revision: 4`. The site's CSP refuses Netlify's injected RUM script's reports and an inline script and style that are not the site's own, on every page. Forms not yet tried live |

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

## Evidence
Continuation candidate: separate `codex/public-queue-2026-11-03-e` tree; Craft Night practical guidance and captioned recap, grouped FAQ answers, current-room first visits, runtime-only team, closed shared email request, disabled alumni history, workshop context and event lifecycle corrections. Current checks/limits live in the shared PUBLIC-SITE handoff. No push/publication.

Cloud runs, 2 Nov 2026, 21:55 and 22:29 Chicago, queue items 20 (the suites' cut reports) and 25 (no dot before Ended on a phone), without the photos (`node ops/check.mjs --browser --no-media` on `bf89c25` plus the change;
Chromium 1243, linked; exit 0): 564 text keys over 75 files; the editor contract current; colours from tokens, no text under 14px; nothing private (228 files); 65 pages; delivered files clean (104); tests 265 passed, 0 failed,
1 skipped (the photos); shots all 195; a11y all 231; interact all 169, each judged by its tally line against the result lines that arrived. Item 20: before the fix a 20,001-line report ending in `process.exit()` reached `check.mjs` cut to
between 614 and 1,815 lines (seven readings), exit 0, and passed; seven guard breaks each failed alone. Item 25: the new check failed first at 390 and 320 px; four CSS breaks each failed alone. DECISIONS, 2 Nov. All local or fixture.
**Not run:** anything deployed or live (Netlify, Blobs, the CDN, Connect, Google, mail); the photos; the pinned Chromium.

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
8. **Analytics is off.** The GA4 property is unverified; the connector asked to reauthenticate.

## Owner actions

1. **Review the design**: `local/shots/`, or `npm run dev` and open the site. Say what to change.
2. **Photos**: confirm the release (that the people pictured agreed to their photos being used), and say yes or no
   to the 10 live images left to you and the SAC ribbon heap (`docs/research/LIVE-IMAGES-2026-10-20.md`).
3. **Q1, GA4** (Q2–Q4 answered 20 Oct). Recommended: keep the tag off until the property is verified with enhanced
   measurement off, then **load it only after a visitor agrees** (`docs/ANALYTICS.md`). 24 Oct: Netlify Web Analytics
   is on (verify, item 22); that does not approve GA4.
4. Confirm `directors@badgersupports.org` as the sender of receipts (you approved it as the resources' "email us").
5. **Backup spreadsheet** (item 18): named 24 Oct as the directors' account. Confirm it is `directors@badgersupports.org`.
6. Ask Programs whether they want an email for each submission, and whether "within one week" holds.
7. Say how a mailing-list request reaches the Google Group today.
8. Reauthenticate the Analytics connector so the GA4 property can be checked, and answer Q1.
9. **Publish**: open `../PUBLISH-WEBSITE-2026-10-23.command`, type `publish`. Who may see it is yours: team-only now.
   It builds the live site. First: in Connect, Admin › Resources › Public Website List, tick the event types and
   weekly groups to show. The file gives the build Connect's key itself. Its log names events left out (run log 13.9).
11. Point `feedback.badgersupports.org` at `/forms/programming-feedback/` (DNS) only once that form opens here; until then, its Google Form.
13. Signed in to Netlify, try the live site: a test form, staff sign-in, the answer in Connect, Edit text.
14. Resources: add or drop each live entry Connect lacks (`docs/research/RESOURCES-VIEWER-2026-10-20.md`).
15. **Netlify credits**: read Billing → Usage for all three projects; cap this database at 1 CU. Auto recharge stays off (24 Oct).

## Queue, in order

Each item names its acceptance test; numbers stay, because other files cite them. **Shipped**: in a commit the owner published whose Netlify deploy reads `ready` (Deployed, above); not tried live (Blocker 1). **Done** 20 Oct: 2 (Our Team), 3 (photo
source), 5 (entrance photos), 8 (rooms), 11 (live pages; two 301s). **Done** 23 Oct (run log): 4 (photo hosts, §11), 6
(engagement; recommendations 1–3 are the owner's words), 9 (blocks, §5), 10 (migrations, §4), 12 (mailing list, closed,
§6), 13 (forms #1, #2, #4, closed, §3; #8 waits for a PDF, Google answers 401), 14 (applications, letter, closed, previews
at `/forms/<key>/preview/`; to open one: a page, a routes row, the door link, `open`), 27, 28, 32 (colour; SPILL's lessons,
§10), 29 (events between publishes, §7). **Added 24 Oct, queued only:** 33–39, from the brief, `../PUBLIC-PLATFORM-PROMPT-2026-10-24.md`
(P1–P5) and `../PUBLIC-EXCHANGE-AND-SECURITY-PROMPT-2026-10-24.md` (X1–X4). P2 extends 15 and 16; P3, 18; P5, 22 and 23.

19. **PRIORITY ONE · Complete Connect → public website delivery** (queued 3 Nov; Connect CONNECT-PUBLIC-DELIVERY-P1; Decisions, 3 Nov).
    Finish the existing connection, starting with team profiles. Publish eligible profiles even when incomplete; configurable required fields prompt/remind, never block publication. Preserve opt-out/supporter disclosure and public-field restrictions; invent no facts. Local photo/order candidate: see the existing PUBLIC-SITE handoff.
    Accept: verify the live export/consumer against Connect's 2 Nov handoff; saved changes arrive automatically within 30 minutes, incomplete profiles render without stopping other content, and private data stays absent. Verify existing events/resources/Wall paths too. No switch changes in this queue update.
1. **Owner review of the design** → changes made, screenshots re-read at 1280, 390 and 320 px.
7. **Live image inventory** (§11): 43 saved 20 Oct; 10 left to the owner, 28 more listed → each approved one fetched.
15. **Editor and publishing** → **words done** 20 Oct; 25 Oct: every field a value, earlier versions, Restore, a save that publishes **shipped** in `9bf0ed5`. P2 → every field
    (links, media, forms, navigation, sections, layouts, settings) saved live with grants, conflicts, immutable history, restore, sanitising, keyboard use;
    a refused save keeps the edit; a form change keeps its submissions. Needs 34, 16. **Sections** (add, copy, reorder, retire, put back; ARCHITECTURE,
    "Sections") **shipped** in `598ce71`. **Retire on one line at 390 px, and a retired section's words out of Edit Text** (queue item 14; DECISIONS) `d58d97e`, published in deploy `6ae92dab` (2 Nov). **Stale words after a save** (queue item 8; DECISIONS) **shipped** in `db64dd7`. **A menu entry put back** (ARCHITECTURE, "The menu"), **the site's settings** and **rooms' words and photos** (ARCHITECTURE, "Site settings", "Rooms") **shipped** in `96b32cd`, `fe8684a` and `bf83919` (deploy `6ae66fa0`). **The gaps item 8 left** (queue item 9; DECISIONS): every publish clears again after a pause, Refresh now reaches every running copy, the browser keeps no event answer; `860e70c`, published in deploy `6ae91d6b` (2 Nov).
16. **Connect: drafts, preview, restore; add, duplicate, reorder, retire pages** (`PUBLIC-SITE-EDITOR-REVISIONS`), in Connect and the live editor (P2). **Shipped** in `1aaf44a` (a draft is a new page only, his answer; `docs/ARCHITECTURE.md`, "Pages"; migration 008 applied). **Put Back for a retired page** (queue item 13; ARCHITECTURE, "Put Back") `0e6f374`, published in deploy `6ae91d6b` (2 Nov). Connect: card words only (Exchange `PUBLIC-SITE-PAGES`).
17. **Connect: forms** (`PUBLIC-SITE-FORMS`; answers reach Website Forms, **done** 20 Oct). The switch **built** 30 Oct: Open (asked
    twice) and Close on `/staff/` for `forms.switch:<key>`, on the page with no deploy; a stale tab refused (`test/intake.test.mjs`). Waits for Connect's grant (Exchange `PUBLIC-FORM-SWITCH-GRANT`). "34 passing tests" was Connect's count.
18. **Outbox and backup** (`PUBLIC-SITE-EMAIL-AND-BACKUP`) → **shipped, switched off**, in `9bf0ed5` (cloud run §5): claims across instances
    (migration 006), waits ≤15 min, unknown outcomes resent under one key, an idle run never wakes the database; receipts
    once a sender is verified; the workbook (Start Here, Dashboard, a tab per form, `cellText()`), fake Sheets only. One
    submission → one record, receipt, row. Off until: Connect's `publicReceipt`, the sender, the workbook and its account,
    the schedule (owner, `docs/COMMUNICATIONS.md`). Confidential answers left out unless the owner says (R.46).
    Decisions and bulk mail stay Connect's, behind a director's approval.
20. ~~Director sign-in~~ **built** 20 Oct (`PUBLIC-SITE-SSO`; §5). Connect's `publicSsoStatus` is on Connect's GitHub `main`
    and in its production `202b88f` (read 30 Oct); not tried live. **Google sign-in consumer live 30 Oct, a78d13e** (Connect GOOGLE-SIGNIN): no `/staff/`
    help; Connect's shared quote (`/api/signin-quotes`); sessions keep `method` (migration 007) for the status check. No Google code here. **The address after signing in** (queue item 15; DECISIONS; ARCHITECTURE, "Signing in"): Netlify puts the callback's query on its redirect (read live 2 Nov); the inline script takes `code` and `state` off; committed and pushed 2 Nov, not deployed.
21. **Resource viewer** (§8) → one viewer with Report a Problem, Suggest a Resource and Suggest an Update, moderated. **Built closed** 30 Oct; Connect reports ingestion published 2 Nov: verify delivery before website activation. Queued 3 Nov: clear form/connection state and next actions (ADMIN-A6); report alerts configured in Connect Settings, not a new public mail engine.
22. **Analytics** (Q1; §9) → an event dictionary; exclusions before any tag loads; no Connect identity; network read.
    Netlify Web Analytics, reported on 24 Oct → verified per project and in billing; no other collector.
23. ~~Netlify~~ keys and database 20 Oct; **cost plan** 23 Oct (`docs/ARCHITECTURE.md`, Cost; owner action 15). Waits for a yes
    → check form state at first keystroke. No new subscriptions (24 Oct): every change is costed against the allowance.
24. ~~The §12 server tests~~ **mapped, shipped** in `9bf0ed5` (cloud run §4): each scenario has a fixture test; three new
    (staff-only caching, analytics leakage, editor to public page). Revocation stays Connect's (`publicSsoStatus`, item 20).
25. **Before the switch** → **checked** 30 Oct (`23afc2e`); plan and undo in `docs/SWITCH.md`. Mendota Lodge and a final `/` **fixed**,
    published in `2bab970` (queue 3a). Owed: www sign-in at Connect, the reviewed privacy policy, Connect's team export, the owner's word; his steps: `../SWITCH-SETUP-2026-10-30/`.
26. **The one-week promise** on the workshop confirmation → confirmed by Programs, or removed.
30. ~~Past craft nights~~ **answered** 24 Oct: Connect sends `recent` (its `7f32fd4`, now in its production `202b88f`); the site reads it
    (`ops/connect-feed.mjs`). `endDate` **shipped** in `9bf0ed5` (cloud run §2): an event over several days shows on each day, names its dates, leaves after its last.
31. **Open the workshop and feedback forms** on the live site once Programs sees answers in Connect (owner's call).
33. **Functionality and UI pass** (24 Oct brief; `docs/OVERNIGHT-RUN-2026-10-24.md`) → (a) form failures **built**; (b) the
    sign-in states and a shorter staff page **built**; (c) access freshness **built**; (d) width and helper text **built** (§5, §8);
    (e) stale replies, Back/Forward, no refresh under typing **built** (§6). All **shipped** in `9bf0ed5`, each on a regression shown failing first.
34. **Publishing and refresh** (P1) → slices 1–6 **shipped** in `9bf0ed5` (cloud run §3): a save is the published revision,
    drawn by a page function with every cache ≤30 min; the notice, last update, Refresh now; no query forces it. Its two
    packages and `netlify.toml` went live with it. Slice 7 **shipped** in `9bf0ed5`: links, photos, choices, on/off, numbers, dates (inventory in `docs/research/`); photos and link addresses opened from the page, each value named, **shipped** in `3106704`.
35. ~~No decorative coloured bars~~ **shipped** in `9bf0ed5` (cloud run §1): `.form-head`'s 8px accent top is gone; `test/pages.test.mjs`
    checks every edge, longhand, inset shadow, painted pseudo-element, gradient and SVG strip, and failed first on `.form-head`;
    focus, selected, status and charts keep colour (R.31). Screenshots before and after in the cloud artifact.
36. **A `to-public/` inbox** (X1) → the Exchange README and `../../CLAUDE.md` name three sessions; sibling handoffs; "Commit;
    don't push" corrected; a fictional item found in all three. **Registered** 30 Oct (owner's go-ahead that day): the inbox, a pointer in `CLAUDE.md` and `AGENTS.md`, a registration item in each sibling's inbox; still → Connect's and SPILL's own pointers, theirs to make.
37. ~~Clean delivered files~~ **shipped** in `9bf0ed5` (cloud run §7): CSS and scripts minified by parsers before hashing; `dist/`
    ships only its list; a gate catches planted notes, maps and stray files; payload −33% gzip; its packages went live with it.
38. ~~Crawlers and abuse~~ **shipped** in `9bf0ed5` (cloud run §6): limits audited; only the platform's address counts; 40 sends
    an hour per form per address; 429 with Retry-After; form state cached a minute; `/crawlers/` and robots ask for `From`, not collected.
39. **Netlify features already included** (P5; X4) → map **done** 25 Oct (cloud run §8; `docs/ARCHITECTURE.md`): used, available,
    unknown; Lighthouse run locally; Netlify Forms pilot not recommended. Waits for the owner to approve a first slice.

## Git and publishing

`site/` is git, `main`, pushed to the public `nicholas-badgersupports/badgersupports`. A session commits and pushes its own work (Nicholas, 2 Nov 2026), every commit carrying `[skip netlify]`; only the owner
publishes, with `../PUBLISH-WEBSITE-2026-10-23.command`, which first makes `node_modules` match `package-lock.json` (`ops/deps-match.mjs`, then `npm ci` when they differ). A session reads git with `git --no-optional-locks`.
The laptop's shell cannot push: a cloud clone pushes, then the laptop's `site/` is brought up to it (`git fetch`, `git merge --ff-only`). The 25 Oct cloud run's patch was published as `9bf0ed5`. Never link it to Netlify: a Netlify build creates a database.
## Exchange
`../../Admin/Handoffs/Exchange/`. **This session's inbox is `to-public/`** (item 36): list it at the start and before finishing. Answered (`done/`): the eight `PUBLIC-*` of 20 Oct, the invites; 24 Oct `PUBLIC-EVENTS-RECENT`,
`PUBLIC-EVENT-IDS-AND-SIGN-IN`, `NETLIFY-DATABASE-AWAKE`; 25 Oct, in Connect's `73cf3cf`: `APPLICATION-FORMS-*`, `APPLICATION-FILES-HANDOVER`, `RECOMMENDATION-LETTERS-INTO-CONNECT`, `PUBLIC-EMAIL-LIST-STATES`; 30 Oct, from SPILL: `SPILL-CRAWLER-CONTACT` (`/crawlers/` now speaks for this site only).
Their replies say migration 035 "applies on publish": `73cf3cf` is in Connect's production `202b88f`, whose deploy applied only 036, so 035 ran before it (inferred from the deploy record, not read). SPILL answered its inbox registration. Open from this session: Connect's inbox registration; item 19's `PUBLIC-TEAM-PROFILES-2026-10-30`, `PUBLIC-WALL-OF-SUPPORT-2026-10-30`; item 21's `PUBLIC-RESOURCE-SUGGESTIONS-2026-10-30` (30 Oct); item 17's `PUBLIC-FORM-SWITCH-GRANT-2026-10-30`; item 16's `PUBLIC-SITE-PAGES-2026-10-31`. Owed by Connect: its XSEC-1 handoffs.
