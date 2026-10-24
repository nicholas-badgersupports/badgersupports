# Work

Where the rebuild of www.badgersupports.org stands, what is left in order, and what only the owner can do. The
brief is `../MASTER-PROMPT.md`. Updated 23 Oct 2026. `node ops/check.mjs` keeps this file under 180 lines.

## Where it stands

**Current slice: 1** (research, identity, usability). On 23 Oct the owner asked for the **live site, connected to
Connect**, more colour, a cohesive design and **no departure from the brand** (Decisions). Silence is not approval.

| | State on 23 Oct 2026 |
|---|---|
| Built locally | **The live build** (`--production`, what a publish now runs): 37 pages, its events and resources read from Connect as it builds, forms closed and linking their Google Forms, no team or wall until Connect exports them. **The prototype** (fixtures, noindex): 58 pages, adding 14 fictional team pages and 7 form previews. 27 block types; 5 native forms (both applications and the letter closed, with PDF uploads); the intake API on PGlite; SPILL's moving logo; staff sign-in through Connect, answers handed to Connect, **Edit text** |
| Tested | `node ops/check.mjs --browser`: see "Evidence". Connect's feed against a fake Connect (`test/connect-feed.test.mjs`); the rest against a local rig with demo keys (setup file 5): not a live connection. A quick, source-only security audit, 23 Oct (run log §13; its report is kept outside the repository) |
| Committed | `f6cd97f` on GitHub `main`, `nicholas-badgersupports/badgersupports` (a public repository): the owner's publish, 23 Oct 01:17. Connect's half is its `7681b68`. Everything since (the applications, the letter form, Connect's feed; 47 paths) is not committed |
| Deployed | **production**: `d12f205` on 20 Oct at `badgersupports-public.netlify.app`, with migrations 001–002; Connect's `7681b68` with migration 032. The publish of 23 Oct deploys `f6cd97f` the same way; this session has not read that deploy |
| Verified live | Netlify's deploy records only (both `ready`, migrations applied). The site answers **401** (team sign-in on all projects), so no session can read it. Forms and sign-in not yet tried live |

Every name of a person in `content/` is fictional. Real team members appear only through their own Connect profile, which does not exist yet.

## Slice 1 against §12

| §12 asks for | State | Where |
|---|---|---|
| Route map with dispositions | done: 39 routes; 17 redirects written, 0 waiting | `docs/research/ROUTES.md`, `content/routes.json` |
| Form map, unknown settings listed | done: 9 public workflows; settings not seen are listed | `docs/COMMUNICATIONS.md`, `../FORM-AUDIT.md` |
| Asset map | done: the manifest's 79 entries (34 library photos, 43 live images, 2 derived maps) have size, hash, crop and source. Of the other live pages' 117 images, the 27 recommended are saved (20 Oct) and 10 are the owner's call; the two rebuilt hidden pages' 28 are listed, none recommended | `media/manifest.json`, `docs/research/LIVE-IMAGES-2026-10-20.md` |
| Engagement recommendations, source-backed | **partial**: general principles with sources in `../INVESTIGATION.md`; craft nights' with sources in `docs/DECISIONS.md` Round 6. No per-task map for the five §3 tasks | queue item 6 |
| Responsive homepage prototype | built: 1280, 390 and 320 px | `content/pages/home.json` |
| One native form | built: workshop request; also programming feedback (anonymous), both applications and the recommendation letter (closed; a preview page each) | `content/forms/` |
| Reasons by visitor task | in each round's notes | `docs/DECISIONS.md` |

## Decisions

The owner's rulings, quoted, are in `docs/DECISIONS.md`, Rounds 1–7 and the four sets of answers. The newest win:

- **Content** (20 Oct 2026): the live pages' content is restored where it was dropped (Peer Groups' day cards and
  activities; Get Involved's hiring steps, volunteer bullets and Equal Opportunity line). Our Team mirrors the live
  grid: big red capital group headings, no clipart, four square photos a row, role above, name below in red.
- **Live photos and pages** (20 Oct 2026): 43 live images are approved and saved; any other download is listed
  for the owner's OK first; the LCM banner photo stays. SAC and University Square are rebuilt, out of the menu as
  live; Little Hearts and Leadership 301. Connect's 86 resource records are approved; "email us" is directors@.
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
- **Photos** (20 Oct 2026): faces are wanted; name tags, QR codes, phone screens and UW marks are allowed; pick on
  quality; every photo slot can be swapped by link.
- **Colour** (23 Oct 2026, superseding Round 5): peer support groups green, craft nights purple, "more color in
  places", from the brand rainbow. Still no coloured bar down any side (Round 7); rules are solid (23 Oct).
- **Words**: the live site's and the decks' own wording wherever a match exists (`docs/research/COPY-SOURCES.md`).
- **The Hub** is the one place people find us; the other rooms are event rooms (Round 4). Seven rooms are in
  use, all published: Hearing and Multipurpose take the Caucus steps with their own map, Marquee and Tripp show
  their address only (20 Oct 2026; `docs/research/EVENT-ROOMS-2026-10-20.md`).

Everything else this session chose is a **proposal**, listed in `docs/DECISIONS.md` §4.

## Evidence

From `node ops/check.mjs --browser`, run 23 Oct 2026 at 22:38 after the audit's fix (exit 0):

| Gate | Result |
|---|---|
| every word is editable | passed: 289 text keys over 69 source files |
| the Connect editor contract is current | passed |
| colours come from tokens.css · no text under 14px | passed, both |
| nothing private in the repository | passed: 194 files read |
| WORK.md under 180 lines | passed: 179 lines |
| the build | passed: 58 pages, 894 image variants, 0 links to the live site, 0 redirects waiting |
| tests | 151 passed, 0 failed |
| screenshots and page weight · accessibility and the real forms | 174 captures, no console errors, no sideways scroll; all 181 a11y and form checks passed |

Screenshots: `local/shots/`. Every live address is answered; `--production` builds against a fake Connect (37 pages).

**Not run:** anything against a deployed site or the live Connect (only a local rig with demo keys, file 5); email;
the Sheets backup; the §12 tests that need them (below, item 24).

## Blockers

1. **Not tried live.** Both halves went online 20 Oct, but the site is behind Netlify's team sign-in, so sign-in,
   delivery to Website Forms and Edit text have passed only against a local rig (setup file 5).
2. **The live build needs Connect.** CONNECT_URL and the two `PUBLIC_SITE_SERVICE_*` keys must reach the build, not
   only the functions; without them a publish stops with "Nothing was built" and the last deploy stays.
3. **Releases come from the laptop**, in a new folder outside the synced one: only it has the 23 Drive originals,
   and the synced `dist/` holds conflict copies that cannot be deleted here (`docs/DESIGN.md`).
4. **The live API is unread**: whether it answers `ok`, not 503 `config.missing` (keys set 20 Oct, item 23); it answers 401.
5. **Connect exports** for the Wall of Support and the team do not exist, so the live build shows neither. Events
   and resources come from Connect (23 Oct); they show only what a director ticked in Connect.
6. **Cost**: prices read 23 Oct (`docs/ARCHITECTURE.md`, "Cost"); what each database used is in Billing → Usage only.
7. **The privacy policy** still names Google Sites, Analytics and Forms: the owner's and a legal review before launch.
8. **Analytics is off.** The GA4 property is unverified; the connector asked to reauthenticate.

## Owner actions

1. **Review the design**: `local/shots/`, or `npm run dev` and open the site. Say what to change.
2. **Photos**: confirm the release (that the people pictured agreed to their photos being used), and say yes or no
   to the 10 live images left to you and the SAC ribbon heap (`docs/research/LIVE-IMAGES-2026-10-20.md`).
3. **Answer the questions below.** Q2 to Q4 were answered 20 Oct (see Decisions).
4. Confirm `directors@badgersupports.org` as the sender of receipts (you approved it as the resources' "email us").
5. Name who owns the backup spreadsheet.
6. Ask Programs whether they want an email for each submission, and whether "within one week" holds.
7. Say how a mailing-list request reaches the Google Group today.
8. Reauthenticate the Analytics connector so the GA4 property can be checked, and answer Q1.
9. **Publish**: open `../PUBLISH-WEBSITE-2026-10-23.command`, type `publish`. Who may see it is yours: team-only now.
   It builds the live site. First: in Connect, Admin › Resources › Public Website List, tick the event types and
   weekly groups to show; in Netlify, give Connect's three variables **Builds** scope. Its log names events left out (run log 13.9).
11. Leave `feedback.badgersupports.org` on its Google Form; point it at `/forms/programming-feedback/` (a DNS
    change) only once that form opens here.
13. Signed in to Netlify, try the live site: a test form, staff sign-in, the answer in Connect, Edit text.
14. Resources: add or drop each live entry Connect lacks (`docs/research/RESOURCES-VIEWER-2026-10-20.md`).
15. **Netlify credits**: read Billing → Usage for all three projects; cap this database at 1 CU; decide auto recharge.

## Open questions, with recommended answers

**Q1. GA4.** Recommended: keep the tag off until the property is verified with enhanced measurement off, then
**load it only after a visitor agrees** (`docs/ANALYTICS.md`).

## Queue, in order

Each item names its acceptance test. **From the owner's 23 Oct messages: 27 to 29 and 32 done, 30 asked of Connect, 31 the owner's.** Numbers
stay as they were, because other files cite them. Done 20 Oct: 2 (Our Team, `test/team.test.mjs`), 3 (photo source,
`test/media-originals.test.mjs`), 5 (entrance photos), 8 (rooms, `test/places.test.mjs`), 11 (live pages; two 301s).

1. **Owner review of the design** → changes made, screenshots re-read at 1280, 390 and 320 px.
4. ~~Photo host allow-list~~ **built** 23 Oct: Drive and the organisation's sites only, every redirect checked (run log §11).
6. ~~Engagement map~~ **done** 23 Oct: `docs/research/ENGAGEMENT-2026-10-23.md`. No student link goes to Connect;
   two fixes (no page links to itself; each "View Details" names its resource). Recommendations 1–3 are the owner's words.
7. **Live image inventory** (§11): 43 saved 20 Oct; 10 left to the owner, 28 more listed → each approved one fetched.
9. ~~Block contract~~ **built** 23 Oct: `data` enforced, dates on any block, block stylesheets (run log §5; `test/blocks.test.mjs`).
10. ~~Migrations guard~~ **built** 23 Oct: SPILL's plugin stops a deploy that did not pack every migration (run log §4).
12. ~~Mailing list (#5)~~ **built closed** 23 Oct: the site records "received" only; Connect asked for the rest (run log §6).
13. ~~Forms #1, #2, #4~~ **built closed** 23 Oct (run log §3). #8 waits: Google answers 401, so it needs a PDF.
14. ~~Applications (#6, #7) and the letter (#10)~~ **built** 23 Oct, closed, previews at `/forms/<key>/preview/`
    (`test/applications.test.mjs`; `docs/OVERNIGHT-RUN-2026-10-23.md`). To open one: a page, a routes row, the door link, `open`.
15. **Editor and publishing** → **words done** 20 Oct (Edit text, `test/staff.test.mjs`); who edits and publishes is
    set by a super admin. Pages are open (Exchange `PUBLIC-SITE-EDITOR`, declined until the owner decides).
16. **Connect: drafts, preview, restore; add, duplicate, reorder, retire pages** (`PUBLIC-SITE-EDITOR-REVISIONS`).
17. **Connect: forms** (`PUBLIC-SITE-FORMS`; answers reach Website Forms, **done** 20 Oct). Still → the switch opens and closes
    a form with no deploy; the server refuses a stale tab. Recount its "34 passing tests" first (`docs/COMMUNICATIONS.md`).
18. **Outbox and backup** (`PUBLIC-SITE-EMAIL-AND-BACKUP`) → one submission, one Connect record, one test receipt, one sheet
    row; a retry makes no second. `cellText()` is not yet called; the backup skips columns marked `confidential`.
19. **Connect: exports**: events and resources **done** 23 Oct (`test/connect-feed.test.mjs`). Still → the team
    (`PUBLIC-TEAM-PROFILES`) and the wall (`PUBLIC-RESOURCES-AND-WALL`); a person appears only from their own profile.
20. ~~Director sign-in~~ **built** 20 Oct (`PUBLIC-SITE-SSO`; §5); revocation takes up to eight hours (`docs/ARCHITECTURE.md`).
21. **Resource viewer** (§8) → one viewer with Report a Problem, Suggest a Resource and Suggest an Update, moderated.
22. **Analytics** (Q1; §9) → an event dictionary; exclusions before any tag loads; no Connect identity; network read.
23. ~~Netlify~~ keys and database 20 Oct; **cost plan** 23 Oct (`docs/ARCHITECTURE.md`, Cost; owner action 15). Waits for a yes → check form state at first keystroke.
24. **The §12 tests that need a server or Connect**: closed-form stale tabs, duplicate submits, version changes,
    denied access, retries and outages, revocation, staff-only caching, analytics leakage, editor to public page.
25. **Before the switch**: shortlinks, the six subdomains, the ribbons path, the privacy policy, mobile performance,
    redirects, SEO and accessibility checked on a preview; a handoff and a reversible switch plan.
26. **The one-week promise** on the workshop confirmation → confirmed by Programs, or removed.
27. ~~Colour~~ **done** 23 Oct: peer green, craft purple, AA tokens (`test/pages.test.mjs`; run log 2.12–2.16).
28. ~~A cohesive design by SPILL's lessons~~ **done** 23 Oct (run log 2.17–2.25), then put in the brand's terms (32).
29. ~~Events between publishes~~ **built** 23 Oct: a page built from Connect asks `/api/events/<page>` as it loads, so
    an event ticked in Connect shows in about five minutes without a publish (run log §7; `test/live-events.test.mjs`).
30. **Past craft nights** → **asked** 23 Oct (Exchange `PUBLIC-EVENTS-RECENT-2026-10-23`): Connect to send `recent`;
    the site reads it already (`ops/connect-feed.mjs`) and hides the list until it comes. Done when the reply is in.
31. **Open the workshop and feedback forms** on the live site once Programs sees answers in Connect (owner's call).
32. ~~Keep to the brand~~ **done** 23 Oct: style.badgersupports.org and its design system (run log §10, `docs/DESIGN.md`).

## Git and publishing

`site/` is git, `main`, pushed to the public `nicholas-badgersupports/badgersupports`. Only the owner commits, pushes
and publishes, with `../PUBLISH-WEBSITE-2026-10-23.command`. A session reads git with `git --no-optional-locks` and
never runs `add`, `commit` or `push`. Never link the repository to Netlify: a Netlify build creates a database.

## Exchange

The eight `PUBLIC-*` requests of 20 Oct and the invites are answered (`../../Admin/Handoffs/Exchange/done/`). Open in
`to-intranet/`: `APPLICATION-FORMS-*` (21 Oct, in progress) and, from 23 Oct, `APPLICATION-FILES-HANDOVER`,
`RECOMMENDATION-LETTERS-INTO-CONNECT`, `PUBLIC-EMAIL-LIST-STATES`, `PUBLIC-EVENTS-RECENT`, `NETLIFY-DATABASE-AWAKE`, `PUBLIC-EVENT-IDS-AND-SIGN-IN`.
