# Work

Where the rebuild of www.badgersupports.org stands, what is left in order, and what only the owner can do. The
brief is `../MASTER-PROMPT.md`. Updated 20 Oct 2026. Gate 5 of `node ops/check.mjs` keeps this file under 180 lines.

## Where it stands

**Current slice: 1** (research, identity, usability), built for review. The owner has not yet reviewed the design,
and §12 holds wider implementation until they do. Silence is not approval.

| | State on 20 Oct 2026 |
|---|---|
| Built locally | 51 pages: 30 page files, 7 published rooms, 14 fictional team-member pages; 27 block types; 3 native forms; the intake API on PGlite; Badger SPILL's moving logo; staff sign-in through Connect, answers handed to Connect, and an **Edit text** button (both halves live 20 Oct, behind Netlify's team sign-in) |
| Tested with fixtures | `node ops/check.mjs --browser`: see "Evidence". End to end against a local Connect rig with demo keys (setup file 5): not a live connection |
| Committed | `d12f205` on GitHub `main`, `nicholas-badgersupports/badgersupports` (a public repository). Connect's half is its `7681b68`. The 18 pages built later on 20 Oct, and the 27 photos' manifest entries, are not committed |
| Deployed | **production**, 20 Oct: `d12f205` at `badgersupports-public.netlify.app` with its database (migrations 001–002) and function. Connect's `7681b68` 2 minutes earlier, with migration 032 |
| Verified live | Netlify's deploy records only (both `ready`, migrations applied). The site answers **401** (team sign-in on all projects), so no session can read it. Forms and sign-in not yet tried live |

Every name of a person in `content/` is fictional. Real team members appear only through their own Connect profile,
which does not exist yet.

## Slice 1 against §12

| §12 asks for | State | Where |
|---|---|---|
| Route map with dispositions | done: 39 routes; 17 redirects written, 0 waiting | `docs/research/ROUTES.md`, `content/routes.json` |
| Form map, unknown settings listed | done: 9 public workflows; settings not seen are listed | `docs/COMMUNICATIONS.md`, `../FORM-AUDIT.md` |
| Asset map | done: the manifest's 79 entries (34 library photos, 43 live images, 2 derived maps) have size, hash, crop and source. Of the other live pages' 117 images, the 27 recommended are saved (20 Oct) and 10 are the owner's call; the two rebuilt hidden pages' 28 are listed, none recommended | `media/manifest.json`, `docs/research/LIVE-IMAGES-2026-10-20.md` |
| Engagement recommendations, source-backed | **partial**: general principles with sources in `../INVESTIGATION.md`; craft nights' with sources in `docs/DECISIONS.md` Round 6. No per-task map for the five §3 tasks | queue item 6 |
| Responsive homepage prototype | built: 1280, 390 and 320 px | `content/pages/home.json` |
| One native form | built: workshop request; also programming feedback (anonymous) and staff application (closed) | `content/forms/` |
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
- **Online first at `badgersupports-public.netlify.app`** (20 Oct): the prototype build, noindex, with the workshop
  and feedback forms open and native. The staff application stays closed by its own content (hiring is closed).
- **Who may do what** (20 Oct): "adjusted in permissions by a super admin", as SPILL does. In Connect, per tier:
  sign-in, each form's answers, `site.edit`, `site.publish`; first names one setting. Members never read answers.
- **Photos** (20 Oct 2026): faces are wanted; name tags, QR codes, phone screens and UW marks are allowed; pick on
  quality; every photo slot can be swapped by link.
- **Colour**: brand red and the neutrals only. No program hues and no coloured bar down any side; edges are
  dotted, as on Connect (Rounds 5 and 7).
- **Words**: the live site's and the decks' own wording wherever a match exists (`docs/research/COPY-SOURCES.md`).
- **The Hub** is the one place people find us; the other rooms are event rooms (Round 4). Seven rooms are in
  use, all published: Hearing and Multipurpose take the Caucus steps with their own map, Marquee and Tripp show
  their address only (20 Oct 2026; `docs/research/EVENT-ROOMS-2026-10-20.md`).

Everything else this session chose is a **proposal**, listed in `docs/DECISIONS.md` §4.

## Evidence

From `node ops/check.mjs --browser`, run 20 Oct 2026 after this file was written:

| Gate | Result |
|---|---|
| 1 Every visible word editable | passed: 258 text keys over 66 source files |
| 1b Editor contract current | passed |
| 3 Tokens and type floor | passed: colours only from `tokens.css`; no text under 14 px |
| 4 Privacy | passed: 168 files read |
| 5 This file | passed: 179 lines |
| 6 Build | passed: 51 pages, 894 image variants, 0 links to the live site, 0 redirects waiting |
| 7 Tests | 101 passed, 0 failed |
| 8 Browser: screenshots and accessibility | 153 screenshots, no console errors, no sideways scroll; 160 accessibility and form checks passed |

Screenshots: `local/shots/`. Every live address is answered; `--production` still refuses the fixtures (blocker 5).

**Not run:** anything against a deployed site or the live Connect (only a local rig with demo keys, file 5); email;
the Sheets backup; the §12 tests that need them (below, item 24).

## Blockers

1. **Not tried live.** Both halves went online 20 Oct, but the site is behind Netlify's team sign-in, so sign-in,
   delivery to Website Forms and Edit text have passed only against a local rig (setup file 5).
2. **Production builds refuse** the hand-typed fixtures until Connect's exports exist (5); all live addresses answer.
3. **Releases come from the laptop**, in a new folder outside the synced one: only it has the 23 Drive originals,
   and the synced `dist/` holds conflict copies that cannot be deleted here (`docs/DESIGN.md`).
4. **Keys set and database made** 20 Oct (Connect's file 2, the site's file 6). Whether the live API answers `ok`, not
   503 `config.missing`, is unread: the address answers 401 to a session.
5. **Connect exports** for events, resources, the Wall of Support and the team do not exist; those blocks show fixtures.
6. **Cost is partly verified** (`docs/ARCHITECTURE.md`, "Cost"): what a draft and the database cost is not stated.
7. **The privacy policy** still names Google Sites, Analytics and Forms: the owner's and a legal review before launch.
8. **Analytics is off.** The GA4 property is unverified; the connector asked to reauthenticate.

## Owner actions

1. **Review the design**: `local/shots/`, or `npm run dev` and open the site. Say what to change.
2. **Photos**: confirm the release (that the people pictured agreed to their photos being used), and say yes or no
   to the 10 live images left to you and the SAC ribbon heap (`docs/research/LIVE-IMAGES-2026-10-20.md`).
3. **Answer the questions below** (Q1, Q2). Q3 and Q4 were answered 20 Oct (see Decisions).
4. Confirm `directors@badgersupports.org` as the sender of receipts (you approved it as the resources' "email us").
5. Name who owns the backup spreadsheet.
6. Ask Programs whether they want an email for each submission, and whether "within one week" holds.
7. Say how a mailing-list request reaches the Google Group today.
8. Reauthenticate the Analytics connector so the GA4 property can be checked, and answer Q1.
9. **Publish**: open `../PUBLISH-WEBSITE-2026-10-23.command`, type `publish`. Who may see it is yours: team-only now.
10. ~~Little Hearts and Leadership~~ answered 20 Oct: a 301 each (Q2).
11. Leave `feedback.badgersupports.org` on its Google Form; point it at `/forms/programming-feedback/` (a DNS
    change) only once that form opens here.
12. ~~Volunteer form's 401~~ answered 21 Oct: Google requires sign-in for uploads. Both forms transcribed (`../../Admin/Handoffs/HANDOFF-APPLICATIONS-AND-INVITES-2026-10-21.md`).
13. Signed in to Netlify, try the live site: a test form, staff sign-in, the answer in Connect, Edit text.
14. Resources: add or drop each live entry Connect lacks (`docs/research/RESOURCES-VIEWER-2026-10-20.md`).

## Open questions, with recommended answers

**Q1. GA4.** Recommended: keep the tag off until the property is verified with enhanced measurement off, then
**load it only after a visitor agrees** (`docs/ANALYTICS.md`).

**Q2. Little Hearts and Leadership.** Answered 20 Oct: a 301 each, to the Hub (`/directions/sac-mhh/`) and Get involved.

## Queue, in order

Each item names its acceptance test. Items 1–9 are Slice 1 and 2 work that does not wait on Connect.

1. **Owner review of the design** → changes made, screenshots re-read at 1280, 390 and 320 px.
2. ~~Our Team mirrors the live grid~~ **done** 20 Oct (`test/team.test.mjs`).
3. ~~Photo source~~ **done** 20 Oct: without `local/` the build names every missing photo (`test/media-originals.test.mjs`).
4. **Photo host allow-list** (proposal) → a production build refuses a link to any other host (`docs/DESIGN.md`).
5. ~~Entrance photos~~ **done** 20 Oct: the SAC rooms, the Hub and LCM show the live entrance and map photos.
6. **Engagement map** → `docs/research/ENGAGEMENT.md`: for each §3 task (peer groups, craft nights and events,
   program requests, volunteering and leadership, resources) the route a student takes, where it leaves for
   Connect and how that is marked, each recommendation with a source. Director sign-in stays secondary.
7. **Live image inventory** (§11): 43 saved 20 Oct; 10 left to the owner, 28 more listed → each approved one fetched.
8. ~~Draft rooms~~ **done** 20 Oct (Q4): all seven rooms published (`test/places.test.mjs`).
9. **Block contract**: enforce `data`; dates on every block; each block's own stylesheet (`docs/EXTENDING.md`).
10. **Migrations guard**: check whether Netlify's own Git builds skip this site's migrations, as SPILL's did; if so,
    add the guard (`docs/ARCHITECTURE.md`).
11. ~~Pages still on the live site~~ **done** 20 Oct; Little Hearts and Leadership 301 to the Hub and Get involved.
12. **Mailing list (#5)** → a native request that keeps "received", "confirmation pending" and "subscribed" apart.
13. **Forms #1, #2, #4 and #8** → native, editable, toggleable, closed by default (`docs/COMMUNICATIONS.md`).
14. **Applications (#6, #7)** → native, closed, with PDF, rank, phone and link questions (handoff of owner action 12).
15. **Editor and publishing** → **words done** 20 Oct (Edit text, `test/staff.test.mjs`); who edits and publishes is
    set by a super admin. Pages are open (Exchange `PUBLIC-SITE-EDITOR`, declined until the owner decides).
16. **Connect: drafts, preview, restore; add, duplicate, reorder, retire pages** (`PUBLIC-SITE-EDITOR-REVISIONS`).
17. **Connect: forms** (`PUBLIC-SITE-FORMS`): answers reach Website Forms, **done** 20 Oct. Still → the switch row
    opens and closes a form with no deploy; a stale tab on a closed form is refused by the server. The item cites
    "34 passing tests"; recount first. A page built closed still needs a rebuild to open (`docs/COMMUNICATIONS.md`).
18. **Outbox worker and backup** (`PUBLIC-SITE-EMAIL-AND-BACKUP`; the Connect row **done** 20 Oct) → one submission
    makes one Connect record, one caught test receipt and one spreadsheet row, and a retry makes no second one.
    `answerColumns()` and `cellText()` in `src/shared/forms.mjs` are tested but not yet called.
19. **Connect: exports** (`PUBLIC-EVENTS-EXPORT`, `PUBLIC-TEAM-PROFILES`, `PUBLIC-RESOURCES-AND-WALL`) → fixtures
    replaced; a person appears only from their own opt-in profile.
20. ~~Director sign-in~~ **built** 20 Oct (`PUBLIC-SITE-SSO`; §5): PKCE, state, nonce, signed note, opaque id; live
    once both halves are published. Revocation ends a session within eight hours, not at once (`docs/ARCHITECTURE.md`).
21. **Resource viewer** (§8) → one viewer with Report a Problem, Suggest a Resource and Suggest an Update, moderated.
22. **Analytics** (Q1; §9) → an event dictionary, the exclusions enforced before any tag loads, no Connect identity
    sent, checked by reading the network requests.
23. **Netlify** → keys set and database made 20 Oct (Connect's file 2, the site's file 6). Still → a cost plan.
24. **The §12 tests that need a server or Connect**: closed-form stale tabs, duplicate submits, version changes,
    denied access, retries and outages, revocation, staff-only caching, analytics leakage, editor to public page.
25. **Before the switch**: shortlinks and the six subdomains checked; the ribbons path tested on a deploy preview;
    the privacy policy reviewed; mobile performance measured; redirects, SEO and accessibility verified on a
    preview; an operational handoff and a reversible switch plan; `netlify.toml`'s command changed to the production build.
26. **The one-week promise** on the workshop confirmation → confirmed by Programs, or removed.

## Git and publishing

`site/` is git, `main`, pushed to the public `nicholas-badgersupports/badgersupports`. Only the owner commits,
pushes and publishes, with `../PUBLISH-WEBSITE-2026-10-23.command` (one file, from 23 Oct). A session reads git with
`git --no-optional-locks` and never runs `add`, `commit` or `push`: a lock it leaves cannot be deleted from its
side and blocks the next commit. Never link the repository to Netlify: a Netlify build creates a database.

## Exchange

The eight `PUBLIC-*` requests are answered, in `../../Admin/Handoffs/Exchange/done/`: events and resources exported;
the rest declined until the owner decides. The owner then asked for sign-in, forms and editing directly (20 Oct), so
both halves were built. Connect's went in as `7681b68`: exactly the 17 pinned files plus MAP.md, saved by its
`_xfer/Public website setup` file 1. Note to that session: `to-intranet/PUBLIC-SITE-SSO-AND-FORMS-BUILT-2026-10-20.md`.
