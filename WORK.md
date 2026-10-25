# Work

Where the rebuild of www.badgersupports.org stands, what is left in order, and what only the owner can do. The
brief is `../MASTER-PROMPT.md`. Updated 24 Oct 2026. `node ops/check.mjs` keeps this file under 180 lines.

## Where it stands

**Current slice: 1** (research, identity, usability). On 23 Oct the owner asked for the **live site, connected to
Connect**, more colour, a cohesive design and **no departure from the brand** (Decisions). Silence is not approval.
Every person named in `content/` is fictional; real team members appear only through their own Connect profile.

| | State on 23 Oct 2026 |
|---|---|
| Built locally | **The live build** (`--production`, what a publish now runs): 37 pages, its events and resources read from Connect as it builds, forms closed and linking their Google Forms, no team or wall until Connect exports them. **The prototype** (fixtures, noindex): 58 pages, adding 14 fictional team pages and 7 form previews. 27 block types; 5 native forms (both applications and the letter closed, with PDF uploads); the intake API on PGlite; SPILL's moving logo; staff sign-in through Connect, answers handed to Connect, **Edit text** |
| Tested | `node ops/check.mjs --browser`: see "Evidence". Connect's feed against a fake Connect (`test/connect-feed.test.mjs`); the rest against a local rig with demo keys (setup file 5): not a live connection. A quick, source-only security audit, 23 Oct (run log §13; its report is kept outside the repository) |
| Committed | `aa5668c` on GitHub `main`, `nicholas-badgersupports/badgersupports` (a public repository): the owner's publish, 23 Oct 23:59. 24 Oct: the run's work is one local commit on top, not pushed (run log R.4) |
| Deployed | **production**: `d12f205` on 20 Oct at `badgersupports-public.netlify.app`, with migrations 001–002; Connect's `7681b68` with migration 032. The publish of 23 Oct deploys `f6cd97f` the same way; this session has not read that deploy |
| Verified live | Netlify's deploy records only (both `ready`, migrations applied). The site answers **401** (team sign-in on all projects), so no session can read it. Forms and sign-in not yet tried live |

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

`node ops/check.mjs --browser`, 23 Oct 2026 at 22:38, after the audit's fix (exit 0): every word editable (289 text keys,
69 source files); the editor contract current; colours from `tokens.css`, no text under 14px; nothing private (194 files
read); the build, 58 pages, 894 image variants, 0 links to the live site, 0 redirects waiting; tests 151 passed, 0 failed;
174 captures, no console errors or sideways scroll; 181 a11y and form checks passed (`local/shots/`). Every live address
is answered; `--production` builds against a fake Connect (37 pages). 24 Oct: `docs/OVERNIGHT-RUN-2026-10-24.md`.
**Not run:** anything against a deployed site or the live Connect (only a local rig with demo keys, file 5); email;
the Sheets backup; the §12 tests that need them (below, item 24).

## Blockers

1. **Not tried live.** The site is behind Netlify's team sign-in, so sign-in, delivery to Website Forms and Edit text
   have passed only on a local rig (setup file 5); nor is it read whether the live API answers `ok`, not 503 `config.missing`.
2. **The live build needs Connect.** CONNECT_URL and the two `PUBLIC_SITE_SERVICE_*` keys must reach the build, not
   only the functions; without them a publish stops with "Nothing was built" and the last deploy stays.
3. **Releases come from the laptop**, in a new folder outside the synced one: only it has the 23 Drive originals,
   and the synced `dist/` holds conflict copies that cannot be deleted here (`docs/DESIGN.md`).
5. **Connect exports** for the Wall of Support and the team do not exist, so the live build shows neither (item 19).
6. **Cost**: prices read 23 Oct (`docs/ARCHITECTURE.md`, "Cost"); what each database used is in Billing → Usage only.
7. **The privacy policy** still names Google Sites, Analytics and Forms: the owner's and a legal review before launch.
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

Each item names its acceptance test; numbers stay, because other files cite them. **Done** 20 Oct: 2 (Our Team), 3 (photo
source), 5 (entrance photos), 8 (rooms), 11 (live pages; two 301s). **Done** 23 Oct (run log): 4 (photo hosts, §11), 6
(engagement; recommendations 1–3 are the owner's words), 9 (blocks, §5), 10 (migrations, §4), 12 (mailing list, closed,
§6), 13 (forms #1, #2, #4, closed, §3; #8 waits for a PDF, Google answers 401), 14 (applications, letter, closed, previews
at `/forms/<key>/preview/`; to open one: a page, a routes row, the door link, `open`), 27, 28, 32 (colour; SPILL's lessons,
§10), 29 (events between publishes, §7). **Added 24 Oct, queued only:** 33–39, from the brief, `PUBLIC-PLATFORM-PROMPT-2026-10-24.md`
(P1–P5) and `PUBLIC-EXCHANGE-AND-SECURITY-PROMPT-2026-10-24.md` (X1–X4). P2 extends 15 and 16; P3, 18; P5, 22 and 23.

1. **Owner review of the design** → changes made, screenshots re-read at 1280, 390 and 320 px.
7. **Live image inventory** (§11): 43 saved 20 Oct; 10 left to the owner, 28 more listed → each approved one fetched.
15. **Editor and publishing** → **words done** 20 Oct (Edit text, `test/staff.test.mjs`); grants set by a super admin. 24 Oct:
    grows toward SPILL's (keys shown, every word listed, history, restore); **a permitted save publishes**. P2 → every field
    (links, media, forms, navigation, sections, layouts, settings) saved live with grants, conflicts, immutable history,
    restore, sanitising, keyboard use; a refused save keeps the edit; a form change keeps its submissions. Needs 34, 16.
16. **Connect: drafts, preview, restore; add, duplicate, reorder, retire pages** (`PUBLIC-SITE-EDITOR-REVISIONS`), in Connect and the live editor (P2).
17. **Connect: forms** (`PUBLIC-SITE-FORMS`; answers reach Website Forms, **done** 20 Oct). Still → the switch opens and closes
    a form with no deploy; the server refuses a stale tab. Recount its "34 passing tests" first (`docs/COMMUNICATIONS.md`).
18. **Outbox and backup** (`PUBLIC-SITE-EMAIL-AND-BACKUP`) → one submission, one Connect record, one test receipt, one sheet
    row; a retry makes no second. `cellText()` is not yet called; the backup skips columns marked `confidential`. P3 →
    claims, leases and idempotency across instances; a due retry within 30 minutes (now up to six hours, `deliver.mjs`);
    unknown outcomes reconciled, never sent twice; receipts send themselves; decisions and bulk mail wait for a
    director's approval of that version; nothing automatic from an anonymous form. Needs Connect's sender contract.
    **Owner, 24 Oct:** a styled directors' workbook: Start Here, Dashboard, a tab per form (`docs/COMMUNICATIONS.md`).
19. **Connect: exports**: events and resources **done** 23 Oct (`test/connect-feed.test.mjs`). Still → the team
    (`PUBLIC-TEAM-PROFILES`) and the wall (`PUBLIC-RESOURCES-AND-WALL`); a person appears only from their own profile.
20. ~~Director sign-in~~ **built** 20 Oct (`PUBLIC-SITE-SSO`; §5). Since 24 Oct answers can be read for an hour after
    sign-in; Connect's `publicSsoStatus` is proposed, not built, so revocation is not solved (`docs/ARCHITECTURE.md`).
21. **Resource viewer** (§8) → one viewer with Report a Problem, Suggest a Resource and Suggest an Update, moderated.
22. **Analytics** (Q1; §9) → an event dictionary; exclusions before any tag loads; no Connect identity; network read.
    Netlify Web Analytics, reported on 24 Oct → verified per project and in billing; no other collector.
23. ~~Netlify~~ keys and database 20 Oct; **cost plan** 23 Oct (`docs/ARCHITECTURE.md`, Cost; owner action 15). Waits for a yes
    → check form state at first keystroke. No new subscriptions (24 Oct): every change is costed against the allowance.
24. **The §12 tests that need a server or Connect**: closed-form stale tabs, duplicate submits, version changes,
    denied access, retries and outages, revocation, staff-only caching, analytics leakage, editor to public page.
25. **Before the switch**: shortlinks, the six subdomains, the ribbons path, the privacy policy, mobile performance,
    redirects, SEO and accessibility checked on a preview; a handoff and a reversible switch plan.
26. **The one-week promise** on the workshop confirmation → confirmed by Programs, or removed.
30. ~~Past craft nights~~ **answered** 24 Oct: Connect sends `recent` (its `7f32fd4`, not pushed); the site already reads
    it (`ops/connect-feed.mjs`) and shows the list once Connect is published.
31. **Open the workshop and feedback forms** on the live site once Programs sees answers in Connect (owner's call).
33. **Functionality and UI pass** (24 Oct brief; `docs/OVERNIGHT-RUN-2026-10-24.md`) → (a) form failures **built**; (b) the
    sign-in states and a shorter staff page **built**; (c) access freshness **built**; (d) width and helper text, per component;
    (e) stale replies, Back/Forward, no refresh under typing. Each closes on a run-log regression shown failing first.
34. **Publishing and refresh** (P1) → a permitted save is the published revision, seen within 30 minutes in HTML and feeds;
    a notice, the last good update, Refresh now (editors only, checked, bounded); no query string forces a refresh;
    failures shown; SEO and no-JS checked. Needs 15, 16, 29; no deploy loop.
35. **No decorative coloured bars** (P4) → `.form-head`'s 8px accent top (`src/styles/forms.css:12`) and kin on any edge,
    pseudo-element, strip or SVG go neutral; `test/pages.test.mjs`'s side-bar check covers every edge; focus, selected,
    status and charts keep colour; screenshots before and after.
36. **A `to-public/` inbox** (X1) → the Exchange README and `../../CLAUDE.md` name three sessions; sibling handoffs; "Commit;
    don't push" corrected; a fictional item found in all three. Outside `site/`, so it waits for the owner's go-ahead.
37. **Clean delivered files** (X2; P4) → HTML, CSS, JS, MJS, SVG minified by a parser before hashing (raw copies today,
    `ops/build.mjs`); CSP hashes, imports, edit keys, licences kept; a list of what ships; no maps; payload measured.
38. **Crawlers and abuse** (X3) → `netlify/lib/http.mjs` limits audited; layered controls; robots and sitemap; a crawler's
    `From` contact is unverified; no invented collector.
39. **Netlify features already included** (P5; X4) → a capability map, its first approved slice end to end; static search if
    needed; Lighthouse; extensions listed; Netlify Forms a costed supplement; no paid middleware; Edge, Identity evaluated.

## Git and publishing

`site/` is git, `main`, pushed to the public `nicholas-badgersupports/badgersupports`. Only the owner commits, pushes
and publishes, with `../PUBLISH-WEBSITE-2026-10-23.command`. A session reads git with `git --no-optional-locks` and
never pushes (24 Oct: one local commit for a cloud session, run log R.4). Never link it to Netlify: a Netlify build creates a database.

## Exchange

`../../Admin/Handoffs/Exchange/`. Answered (`done/`): the eight `PUBLIC-*` of 20 Oct, the invites; 24 Oct `PUBLIC-EVENTS-RECENT`,
`PUBLIC-EVENT-IDS-AND-SIGN-IN`, `NETLIFY-DATABASE-AWAKE`. Open in `to-intranet/`: `APPLICATION-FORMS-*` (in progress),
`APPLICATION-FILES-HANDOVER`, `RECOMMENDATION-LETTERS-INTO-CONNECT`, `PUBLIC-EMAIL-LIST-STATES`. No `to-public/` yet (36).
