# Queue history — moved out of WORK.md, 10 Nov 2026

Moved by Session 12 (queue cleanup) so `WORK.md` stays within its 180-line limit. Nothing here was
deleted from the record: each block below is the verbatim text WORK.md carried before the move. The
pre-cleanup WORK.md is also in git (commit `a73a260` and earlier) and copied to
`_work/badgersupports/session12-2026-11-10/WORK-before-cleanup-2026-11-10.md`.

## Queue item 19 (full entry)

19. **PRIORITY ONE · Complete Connect → public website delivery** (queued 3 Nov; Connect CONNECT-PUBLIC-DELIVERY-P1; Decisions, 3 Nov).
    Finish the existing connection, starting with team profiles. Publish eligible profiles even when incomplete; configurable required fields prompt/remind, never block publication. Preserve opt-out/supporter disclosure and public-field restrictions; invent no facts. Local photo/order candidate: see the existing PUBLIC-SITE handoff.
    Accept: verify the live export/consumer against Connect's 2 Nov handoff; saved changes arrive automatically within 30 minutes, incomplete profiles render without stopping other content, and private data stays absent. Verify existing events/resources/Wall paths too. No switch changes in this queue update.

## Queue item 15 (full entry)

15. **Editor and publishing** → **words done** 20 Oct; 25 Oct: every field a value, earlier versions, Restore, a save that publishes **shipped** in `9bf0ed5`. P2 → every field
    (links, media, forms, navigation, sections, layouts, settings) saved live with grants, conflicts, immutable history, restore, sanitising, keyboard use;
    a refused save keeps the edit; a form change keeps its submissions. Needs 34, 16. **Sections** (add, copy, reorder, retire, put back; ARCHITECTURE,
    "Sections") **shipped** in `598ce71`. **Retire on one line at 390 px, and a retired section's words out of Edit Text** (queue item 14; DECISIONS) `d58d97e`, published in deploy `6ae92dab` (2 Nov). **Stale words after a save** (queue item 8; DECISIONS) **shipped** in `db64dd7`. **A menu entry put back** (ARCHITECTURE, "The menu"), **the site's settings** and **rooms' words and photos** (ARCHITECTURE, "Site settings", "Rooms") **shipped** in `96b32cd`, `fe8684a` and `bf83919` (deploy `6ae66fa0`). **The gaps item 8 left** (queue item 9; DECISIONS): every publish clears again after a pause, Refresh now reaches every running copy, the browser keeps no event answer; `860e70c`, published in deploy `6ae91d6b` (2 Nov).

## Queue item 16 (full entry)

16. **Connect: drafts, preview, restore; add, duplicate, reorder, retire pages** (`PUBLIC-SITE-EDITOR-REVISIONS`), in Connect and the live editor (P2). **Shipped** in `1aaf44a` (a draft is a new page only, his answer; `docs/ARCHITECTURE.md`, "Pages"; migration 008 applied). **Put Back for a retired page** (queue item 13; ARCHITECTURE, "Put Back") `0e6f374`, published in deploy `6ae91d6b` (2 Nov). Connect: card words only (Exchange `PUBLIC-SITE-PAGES`).

## Queue item 18 (full entry)

18. **Outbox and backup** (`PUBLIC-SITE-EMAIL-AND-BACKUP`) → **shipped, switched off**, in `9bf0ed5` (cloud run §5): claims across instances
    (migration 006), waits ≤15 min, unknown outcomes resent under one key, an idle run never wakes the database; receipts
    once a sender is verified; the workbook (Start Here, Dashboard, a tab per form, `cellText()`), fake Sheets only. One
    submission → one record, receipt, row. Off until: Connect's `publicReceipt`, the sender, the workbook and its account,
    the schedule (owner, `docs/COMMUNICATIONS.md`). Confidential answers left out unless the owner says (R.46).
    Decisions and bulk mail stay Connect's, behind a director's approval.

## Queue item 20 (full entry)

20. ~~Director sign-in~~ **built** 20 Oct (`PUBLIC-SITE-SSO`; §5). Connect's `publicSsoStatus` is on Connect's GitHub `main`
    and in its production `202b88f` (read 30 Oct); not tried live. **Google sign-in consumer live 30 Oct, a78d13e** (Connect GOOGLE-SIGNIN): no `/staff/`
    help; Connect's shared quote (`/api/signin-quotes`); sessions keep `method` (migration 007) for the status check. No Google code here. **The address after signing in** (queue item 15; DECISIONS; ARCHITECTURE, "Signing in"): Netlify puts the callback's query on its redirect (read live 2 Nov); the inline script takes `code` and `state` off; committed and pushed 2 Nov, not deployed.

## Queue item 21 (full entry)

21. **Resource viewer** (§8) → one viewer with Report a Problem, Suggest a Resource and Suggest an Update, moderated. **Built closed** 30 Oct; Connect reports ingestion published 2 Nov: verify delivery before website activation. Queued 3 Nov: clear form/connection state and next actions (ADMIN-A6); report alerts configured in Connect Settings, not a new public mail engine.

## Queue item 22 (full entry)

22. **Analytics** (Q1; §9) → an event dictionary; exclusions before any tag loads; no Connect identity; network read.
    Netlify Web Analytics, reported on 24 Oct → verified per project and in billing; no other collector.

## Queue item 23 (full entry)

23. ~~Netlify~~ keys and database 20 Oct; **cost plan** 23 Oct (`docs/ARCHITECTURE.md`, Cost; owner action 15). Waits for a yes
    → check form state at first keystroke. No new subscriptions (24 Oct): every change is costed against the allowance.

## Queue item 24 (full entry)

24. ~~The §12 server tests~~ **mapped, shipped** in `9bf0ed5` (cloud run §4): each scenario has a fixture test; three new
    (staff-only caching, analytics leakage, editor to public page). Revocation stays Connect's (`publicSsoStatus`, item 20).

## Queue item 30 (full entry)

30. ~~Past craft nights~~ **answered** 24 Oct: Connect sends `recent` (its `7f32fd4`, now in its production `202b88f`); the site reads it
    (`ops/connect-feed.mjs`). `endDate` **shipped** in `9bf0ed5` (cloud run §2): an event over several days shows on each day, names its dates, leaves after its last.

## Queue item 33 (full entry)

33. **Functionality and UI pass** (24 Oct brief; `docs/OVERNIGHT-RUN-2026-10-24.md`) → (a) form failures **built**; (b) the
    sign-in states and a shorter staff page **built**; (c) access freshness **built**; (d) width and helper text **built** (§5, §8);
    (e) stale replies, Back/Forward, no refresh under typing **built** (§6). All **shipped** in `9bf0ed5`, each on a regression shown failing first.

## Queue item 34 (full entry)

34. **Publishing and refresh** (P1) → slices 1–6 **shipped** in `9bf0ed5` (cloud run §3): a save is the published revision,
    drawn by a page function with every cache ≤30 min; the notice, last update, Refresh now; no query forces it. Its two
    packages and `netlify.toml` went live with it. Slice 7 **shipped** in `9bf0ed5`: links, photos, choices, on/off, numbers, dates (inventory in `docs/research/`); photos and link addresses opened from the page, each value named, **shipped** in `3106704`.

## Queue item 35 (full entry)

35. ~~No decorative coloured bars~~ **shipped** in `9bf0ed5` (cloud run §1): `.form-head`'s 8px accent top is gone; `test/pages.test.mjs`
    checks every edge, longhand, inset shadow, painted pseudo-element, gradient and SVG strip, and failed first on `.form-head`;
    focus, selected, status and charts keep colour (R.31). Screenshots before and after in the cloud artifact.

## Queue item 36 (full entry)

36. **A `to-public/` inbox** (X1) → the Exchange README and `../../CLAUDE.md` name three sessions; sibling handoffs; "Commit;
    don't push" corrected; a fictional item found in all three. **Registered** 30 Oct (owner's go-ahead that day): the inbox, a pointer in `CLAUDE.md` and `AGENTS.md`, a registration item in each sibling's inbox; still → Connect's and SPILL's own pointers, theirs to make.

## Queue item 37 (full entry)

37. ~~Clean delivered files~~ **shipped** in `9bf0ed5` (cloud run §7): CSS and scripts minified by parsers before hashing; `dist/`
    ships only its list; a gate catches planted notes, maps and stray files; payload −33% gzip; its packages went live with it.

## Queue item 38 (full entry)

38. ~~Crawlers and abuse~~ **shipped** in `9bf0ed5` (cloud run §6): limits audited; only the platform's address counts; 40 sends
    an hour per form per address; 429 with Retry-After; form state cached a minute; `/crawlers/` and robots ask for `From`, not collected.

## Queue preamble (Done / Added lists)

Each item names its acceptance test; numbers stay, because other files cite them. **Shipped**: in a commit the owner published whose Netlify deploy reads `ready` (Deployed, above); not tried live (Blocker 1). **Done** 20 Oct: 2 (Our Team), 3 (photo
source), 5 (entrance photos), 8 (rooms), 11 (live pages; two 301s). **Done** 23 Oct (run log): 4 (photo hosts, §11), 6
(engagement; recommendations 1–3 are the owner's words), 9 (blocks, §5), 10 (migrations, §4), 12 (mailing list, closed,
§6), 13 (forms #1, #2, #4, closed, §3; #8 waits for a PDF, Google answers 401), 14 (applications, letter, closed, previews
at `/forms/<key>/preview/`; to open one: a page, a routes row, the door link, `open`), 27, 28, 32 (colour; SPILL's lessons,
§10), 29 (events between publishes, §7). **Added 24 Oct, queued only:** 33–39, from the brief, `../PUBLIC-PLATFORM-PROMPT-2026-10-24.md`
(P1–P5) and `../PUBLIC-EXCHANGE-AND-SECURITY-PROMPT-2026-10-24.md` (X1–X4). P2 extends 15 and 16; P3, 18; P5, 22 and 23.
**Added 10 Nov, queued only:** 40–47 (Explore Campus, the change history and its check); full entries in `docs/EXPLORE-CAMPUS-QUEUE-2026-11-10.md`. No relative priority assigned; item 19 stays first.


## Evidence paragraphs (Continuation candidate; Cloud runs, 2 Nov 2026)

Continuation candidate: separate `codex/public-queue-2026-11-03-e` tree; Craft Night practical guidance and captioned recap, grouped FAQ answers, current-room first visits, runtime-only team, closed shared email request, disabled alumni history, workshop context and event lifecycle corrections. Current checks/limits live in the shared PUBLIC-SITE handoff. No push/publication.

Cloud runs, 2 Nov 2026, 21:55 and 22:29 Chicago, queue items 20 (the suites' cut reports) and 25 (no dot before Ended on a phone), without the photos (`node ops/check.mjs --browser --no-media` on `bf89c25` plus the change;
Chromium 1243, linked; exit 0): 564 text keys over 75 files; the editor contract current; colours from tokens, no text under 14px; nothing private (228 files); 65 pages; delivered files clean (104); tests 265 passed, 0 failed,
1 skipped (the photos); shots all 195; a11y all 231; interact all 169, each judged by its tally line against the result lines that arrived. Item 20: before the fix a 20,001-line report ending in `process.exit()` reached `check.mjs` cut to
between 614 and 1,815 lines (seven readings), exit 0, and passed; seven guard breaks each failed alone. Item 25: the new check failed first at 390 and 320 px; four CSS breaks each failed alone. DECISIONS, 2 Nov. All local or fixture.

## WORK.md state table — Committed / Deployed / Verified live rows (moved 11 Nov 2026, Session 14)

Moved verbatim from the "State on 25 Oct 2026" table in WORK.md, under the Session 12 handoff's proposed-archive list. The Built locally and Tested rows stay in WORK.md; the pointer there says where these went.

| Committed | GitHub `main`, `nicholas-badgersupports/badgersupports` (a public repository), holds queue item 15 (`3cc7c52`) and item 24 (past events at full contrast, the commit after it), pushed 2 Nov, not yet published; everything to `892b171` (items 14 and 19) published, Deployed. Before them: `8604262` (queue item 10, sharp 0.35.5, after item 15's menu `96b32cd`, settings `fe8684a` and rooms `bf83919`); GitHub's Dependabot lists 0 open alerts and the three sharp alerts closed as fixed (read 2 Nov). Before them: `db64dd7` (queue item 8), `598ce71`, `1aaf44a`. `9bf0ed5`, the owner's publish of 25 Oct 11:36, holds the 24–25 Oct run and the 25 Oct cloud run (run log, "Cloud run"; migration 006); the editor patch `3106704` followed it |
| Deployed | Read from Netlify 2 Nov (read-only): production is `892b171` (deploy `6ae92dab`, `ready`, published 3 Nov 00:41 UTC from the laptop, titled "Website (892b171)"; no migrations; functions `api` and `pages`). `0e6f374` was deploy `6ae91d6b`. `8604262` was deploy `6ae66fa0`. `db64dd7` was deploy `6ae5aeae` (`008_site_structure` applied). `b880da4` was deploy `6ae57e7e`; `2fc83bd` was deploy `6ae5698d`. `a78d13e` was deploy `6ae4da91` (`007_staff_method` applied by it). `9bf0ed5` was deploy `6ade3037` (25 Oct, with its packages; migrations 001–006). Connect's production is deploy `6ae80763` (2 Nov; its commit not read here) |
| Verified live | Read signed in to Netlify, 2 Nov, read only: the home page's title and description; a room's page (`/directions/sac-mhh/`) with its words, next events and photos, each photo answering 200; Netlify no longer injects RUM, only its team HUD for a signed-in member, whose inline script and style the CSP refuses. While the team login is on, the page's own `/api/events/<page>` ask gets Netlify's login page (401), because `schedule.js` sends no cookie; visitors after the switch are not affected. `/staff/` not read (Connect's sign-in had lapsed). Read signed in to Netlify and Connect, 31 Oct, read only: `/staff/` lists 34 pages and a page's Sections opens; the home page carries `x-bss-revision: 4`. The site's CSP refuses Netlify's injected RUM script's reports and an inline script and style that are not the site's own, on every page. Forms not yet tried live |
