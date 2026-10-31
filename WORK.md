# Work

Where the rebuild of www.badgersupports.org stands, what is left in order, and what only the owner can do. The
brief is `../MASTER-PROMPT.md`. Updated 31 Oct 2026. `node ops/check.mjs` keeps this file under 180 lines.

## Where it stands

**Current slice: 1** (research, identity, usability). On 23 Oct the owner asked for the **live site, connected to
Connect**, more colour, a cohesive design and **no departure from the brand** (Decisions). Silence is not approval.
Every person named in `content/` is fictional; real team members appear only through their own Connect profile.

| | State on 25 Oct 2026 |
|---|---|
| Built locally | **The live build** (`--production`, what a publish now runs): 37 pages, its events and resources read from Connect as it builds, forms closed and linking their Google Forms, no team or wall until Connect exports them. **The prototype** (fixtures, noindex): 58 pages, adding 14 fictional team pages and 7 form previews. 27 block types; 5 native forms (both applications and the letter closed, with PDF uploads); the intake API on PGlite; SPILL's moving logo; staff sign-in through Connect, answers handed to Connect, **Edit text**. 24–25 Oct (run log §1–8): upload race and failure states, phone menu, a form changed while open, sign-in states and access freshness, width and helper text, stale replies and Back/Forward, the editor's keys, earlier versions and Restore, characters left |
| Tested | `node ops/check.mjs --browser`: see "Evidence". Connect's feed against a fake Connect (`test/connect-feed.test.mjs`); the rest against a local rig with demo keys (setup file 5): not a live connection. A quick, source-only security audit, 23 Oct (run log §13; its report is kept outside the repository) |
| Committed | GitHub `main`, `nicholas-badgersupports/badgersupports` (a public repository), is `1aaf44a` (`git ls-remote`, 31 Oct; item 16), not yet published; production is `b880da4` (Deployed). `9bf0ed5`, the owner's publish of 25 Oct 11:36, holds the 24–25 Oct run and the 25 Oct cloud run (run log, "Cloud run"; migration 006); the editor patch `3106704` followed it |
| Deployed | Read from Netlify 31 Oct (read-only): production is `b880da4` (deploy `6ae57e7e`, `ready`, published 31 Oct 05:38 UTC from the laptop; no migration pending; functions `api` and `pages`). `2fc83bd` was deploy `6ae5698d`. `a78d13e` was deploy `6ae4da91` (`007_staff_method` applied by it). `9bf0ed5` was deploy `6ade3037` (25 Oct, with its packages; migrations 001–006). Connect's production is `860a37f` (deploy `6ae52ec0`, 30 Oct 23:57 UTC, no migrations) |
| Verified live | Netlify's deploy records only (`ready`, migrations applied). The site answers **401** (team sign-in on all projects), so no session can read it. Forms and sign-in not yet tried live |

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

The owner's rulings, quoted, are in `docs/DECISIONS.md`, Rounds 1–7 and the sets of answers; the newest win. Everything
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

Cloud run, 31 Oct 2026, item 15's first slice (sections), without the photos (`node ops/check.mjs --browser --no-media` on `1aaf44a` plus the
slice; Chromium 153 in place of the pinned one; exit 0, 17 min): 518 text keys over 75 files, every word editable; the editor contract current;
colours from tokens, no text under 14px; nothing private (222 files read); 65 pages; delivered files clean (104); tests 227 passed, 0 failed, 1 skipped
(the photos); 195 captures, no console errors or sideways scroll; a11y and forms passed; 148 pressed and timed, 8 new "sections:" among them. The four
"item 15" tests failed first on `1aaf44a` (`_work/badgersupports/item7-fail-first-2026-10-31.txt`); 15 guard breaks each caught by name. All local or fixture.
**Not run:** anything deployed or live (Netlify, Blobs, the CDN, Connect, Google, mail); the photos; the pinned Chromium.

## Blockers

1. **Not tried live.** The site is behind Netlify's team sign-in, so sign-in, delivery to Website Forms and Edit text
   have passed only on a local rig (setup file 5); nor is it read whether the live API answers `ok`, not 503 `config.missing`.
2. **The live build needs Connect.** CONNECT_URL and the two `PUBLIC_SITE_SERVICE_*` keys must reach the build, not
   only the functions; without them a publish stops with "Nothing was built" and the last deploy stays.
3. **Releases come from the laptop**, in a new folder outside the synced one: only it has the 23 Drive originals,
   and the synced `dist/` holds conflict copies that cannot be deleted here (`docs/DESIGN.md`).
5. **Connect** has no Wall or team export (item 19) and does not file the three resource forms (item 21): off, and closed.
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

1. **Owner review of the design** → changes made, screenshots re-read at 1280, 390 and 320 px.
7. **Live image inventory** (§11): 43 saved 20 Oct; 10 left to the owner, 28 more listed → each approved one fetched.
15. **Editor and publishing** → **words done** 20 Oct; 25 Oct: every field a value, earlier versions, Restore, a save that publishes **shipped** in `9bf0ed5`. P2 → every field
    (links, media, forms, navigation, sections, layouts, settings) saved live with grants, conflicts, immutable history, restore, sanitising, keyboard use;
    a refused save keeps the edit; a form change keeps its submissions. Needs 34, 16. **Sections built** 31 Oct on `/staff/` (add, copy, reorder, retire, put back; ARCHITECTURE,
    "Sections"); not deployed. Left: rooms, the site's own settings, a menu entry put back (`research/EDITABLE-INVENTORY-2026-10-25.md`).
16. **Connect: drafts, preview, restore; add, duplicate, reorder, retire pages** (`PUBLIC-SITE-EDITOR-REVISIONS`), in Connect and the live editor (P2). **Built** 31 Oct on `/staff/` (a draft is a new page only, his answer; `docs/ARCHITECTURE.md`, "Pages"; migration 008); not deployed. Connect: card words only (Exchange `PUBLIC-SITE-PAGES`).
17. **Connect: forms** (`PUBLIC-SITE-FORMS`; answers reach Website Forms, **done** 20 Oct). The switch **built** 30 Oct: Open (asked
    twice) and Close on `/staff/` for `forms.switch:<key>`, on the page with no deploy; a stale tab refused (`test/intake.test.mjs`). Waits for Connect's grant (Exchange `PUBLIC-FORM-SWITCH-GRANT`). "34 passing tests" was Connect's count.
18. **Outbox and backup** (`PUBLIC-SITE-EMAIL-AND-BACKUP`) → **shipped, switched off**, in `9bf0ed5` (cloud run §5): claims across instances
    (migration 006), waits ≤15 min, unknown outcomes resent under one key, an idle run never wakes the database; receipts
    once a sender is verified; the workbook (Start Here, Dashboard, a tab per form, `cellText()`), fake Sheets only. One
    submission → one record, receipt, row. Off until: Connect's `publicReceipt`, the sender, the workbook and its account,
    the schedule (owner, `docs/COMMUNICATIONS.md`). Confidential answers left out unless the owner says (R.46).
    Decisions and bulk mail stay Connect's, behind a director's approval.
19. **Connect: exports**: events and resources **done** 23 Oct; team and wall read against a fake Connect, off (`exports`), 30 Oct
    (`test/connect-feed.test.mjs`). Still → Connect's `publicTeam`, `publicWallNotes` (Exchange, 30 Oct); a person appears only from their own profile, public unless they turn it off (DECISIONS, 4c).
20. ~~Director sign-in~~ **built** 20 Oct (`PUBLIC-SITE-SSO`; §5). Connect's `publicSsoStatus` is on Connect's GitHub `main`
    and in its production `202b88f` (read 30 Oct); not tried live. **Google sign-in consumer live 30 Oct, a78d13e** (Connect GOOGLE-SIGNIN): no `/staff/`
    help; Connect's shared quote (`/api/signin-quotes`); sessions keep `method` (migration 007) for the status check. No Google code here.
21. **Resource viewer** (§8) → one viewer with Report a Problem, Suggest a Resource and Suggest an Update, moderated. **Built closed** 30 Oct (`docs/DECISIONS.md`); waits for Connect.
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

`site/` is git, `main`, pushed to the public `nicholas-badgersupports/badgersupports`. Only the owner commits, pushes
and publishes, with `../PUBLISH-WEBSITE-2026-10-23.command`. A session reads git with `git --no-optional-locks` and
never pushes (24 Oct: one local commit, `0b50df0`, run log R.4). After a publish, a cloud session works from GitHub `main` and hands back patches, never commits (run log R.27). The 25 Oct cloud run's patch was published as `9bf0ed5`. Never link it to Netlify: a Netlify build creates a database.

## Exchange

`../../Admin/Handoffs/Exchange/`. **This session's inbox is `to-public/`** (item 36): list it at the start and before finishing. Answered (`done/`): the eight `PUBLIC-*` of 20 Oct, the invites; 24 Oct `PUBLIC-EVENTS-RECENT`,
`PUBLIC-EVENT-IDS-AND-SIGN-IN`, `NETLIFY-DATABASE-AWAKE`; 25 Oct, in Connect's `73cf3cf`: `APPLICATION-FORMS-*`, `APPLICATION-FILES-HANDOVER`, `RECOMMENDATION-LETTERS-INTO-CONNECT`, `PUBLIC-EMAIL-LIST-STATES`; 30 Oct, from SPILL: `SPILL-CRAWLER-CONTACT` (`/crawlers/` now speaks for this site only).
Their replies say migration 035 "applies on publish": `73cf3cf` is in Connect's production `202b88f`, whose deploy applied only 036, so 035 ran before it (inferred from the deploy record, not read). SPILL answered its inbox registration. Open from this session: Connect's inbox registration; item 19's `PUBLIC-TEAM-PROFILES-2026-10-30`, `PUBLIC-WALL-OF-SUPPORT-2026-10-30`; item 21's `PUBLIC-RESOURCE-SUGGESTIONS-2026-10-30` (30 Oct); item 17's `PUBLIC-FORM-SWITCH-GRANT-2026-10-30`; item 16's `PUBLIC-SITE-PAGES-2026-10-31`. Owed by Connect: its XSEC-1 handoffs.
