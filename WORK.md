# Work

Where the rebuild of www.badgersupports.org stands, what is left in order, and what only the owner can do. The
brief is `../MASTER-PROMPT.md`. Updated 20 Oct 2026. Gate 5 of `node ops/check.mjs` keeps this file under 180 lines.

## Where it stands

**Current slice: 1** (research, identity, usability), built for review. The owner has not yet reviewed the design,
and §12 holds wider implementation until they do. Silence is not approval.

| | State on 20 Oct 2026 |
|---|---|
| Built locally | 33 pages: 12 page files, 7 published rooms, 14 fictional team-member pages; 23 block types; 3 native forms; the intake API on PGlite; Badger SPILL's moving logo; staff sign-in through Connect, answers handed to Connect, and an **Edit text** button (both halves built; neither live) |
| Tested with fixtures | `node ops/check.mjs --browser`: see "Evidence". End to end against a local Connect rig with demo keys (setup file 5): not a live connection |
| Committed | `ed4ac3a` on GitHub `main`, `nicholas-badgersupports/badgersupports` (a public repository); about 45 changed paths since, uncommitted |
| Deployed | a **draft** of `ed4ac3a` at `prototype--badgersupports-public.netlify.app` (project renamed 20 Oct): no build, database or function. **Nothing in production** |
| Verified live | **nothing**: the draft is behind Netlify's team sign-in, so no session can read it. The uploaded build was checked in `~/Builds` |

Every name of a person in `content/` is fictional. Real team members appear only through their own Connect profile,
which does not exist yet.

## Slice 1 against §12

| §12 asks for | State | Where |
|---|---|---|
| Route map with dispositions | done: 39 routes; 9 redirects written, 6 waiting | `docs/research/ROUTES.md`, `content/routes.json` |
| Form map, unknown settings listed | done: 9 public workflows; settings not seen are listed | `docs/COMMUNICATIONS.md`, `../FORM-AUDIT.md` |
| Asset map | **partial**: the 34-photo library has size, hash, crop and source; the live images on the rebuilt Hub, rooms, Peer Groups and Get Involved pages are listed with sizes, bytes and skips. The other live pages' images are not | `media/manifest.json`, `docs/research/LIVE-IMAGES-2026-10-20.md` |
| Engagement recommendations, source-backed | **partial**: general principles with sources in `../INVESTIGATION.md`; craft nights' with sources in `docs/DECISIONS.md` Round 6. No per-task map for the five §3 tasks | queue item 6 |
| Responsive homepage prototype | built: 1280, 390 and 320 px | `content/pages/home.json` |
| One native form | built: workshop request; also programming feedback (anonymous) and staff application (closed) | `content/forms/` |
| Reasons by visitor task | in each round's notes | `docs/DECISIONS.md` |

## Decisions

The owner's rulings, quoted, are in `docs/DECISIONS.md`, Rounds 1–7 and the three sets of answers. The newest win:

- **Content** (20 Oct 2026): the live pages' content is restored where it was dropped (Peer Groups' day cards and
  activities; Get Involved's hiring steps, volunteer bullets and Equal Opportunity line). Our Team mirrors the live
  grid: big red capital group headings, no clipart, four square photos a row, role above, name below in red.
- **Room photos** (20 Oct 2026): the 16 listed live images are approved and saved; any other download is listed
  for the owner's OK first. The LCM banner photo stays for now.
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
| 1 Every visible word editable | passed: 226 text keys over 63 source files |
| 1b Editor contract current | passed |
| 3 Tokens and type floor | passed: colours only from `tokens.css`; no text under 14 px |
| 4 Privacy | passed: 144 files read |
| 5 This file | passed: 179 lines |
| 6 Build | passed: 33 pages, 645 image variants, 16 links to the live site, 6 redirects waiting |
| 7 Tests | 95 passed, 0 failed |
| 8 Browser: screenshots and accessibility | 99 screenshots, no console errors, no sideways scroll; 106 accessibility and form checks passed |

Screenshots are in `local/shots/` (gitignored). `node ops/build.mjs --production` refuses, as it should: 39 items
are still on the live site (`docs/research/ROUTES.md`, "The switch").

**Not run:** anything against a deployed site or the live Connect (only a local rig with demo keys, file 5); email;
the Sheets backup; the §12 tests that need them (below, item 24).

## Blockers

1. **Neither half is live.** Sign-in, delivery to Website Forms and Edit text pass against a local rig. Connect's
   half goes with its setup files 1–3 (save, keys, publish), then the site's with files 1, 2 and 6.
2. **Production builds refuse** while 23 live addresses have no page and 16 links still point at the live site.
3. **Releases come from the laptop**, in a new folder outside the synced one: only it has the 23 Drive originals,
   and the synced `dist/` holds conflict copies that cannot be deleted here (`docs/DESIGN.md`).
4. **No Netlify database or settings yet**: Connect's file 2 sets the keys, the site's file 6 makes the database.
   Until then the API answers 503 `config.missing`.
5. **Connect exports** for events, the Wall of Support and the team do not exist; those blocks show fixtures.
6. **Cost is partly verified** (`docs/ARCHITECTURE.md`, "Cost"): what a draft and the database cost is not stated.
7. **The privacy policy** needs the owner's and a legal review before launch.
8. **Analytics is off.** The GA4 property is unverified; the connector asked to reauthenticate.

## Owner actions

1. **Review the design**: `local/shots/`, or `npm run dev` and open the site. Say what to change.
2. **Confirm the photo release**: that the people pictured agreed to their photos being used.
3. **Answer the questions below** (Q1, Q2). Q3 and Q4 were answered 20 Oct (see Decisions).
4. Confirm `directors@badgersupports.org` as the sender of receipts.
5. Name who owns the backup spreadsheet.
6. Ask Programs whether they want an email for each submission, and whether "within one week" holds.
7. Say how a mailing-list request reaches the Google Group today.
8. Reauthenticate the Analytics connector so the GA4 property can be checked, and answer Q1.
9. **Put it online**: the order is in `../PUBLIC-SITE-SETUP-2026-10-20/0 - Read me first.md`. Who may see it is yours.
10. Say whether Little Hearts, Student Activity Center, University Square and Leadership are current.
11. Leave `feedback.badgersupports.org` on its Google Form; point it at `/forms/programming-feedback/` (a DNS
    change) only once that form opens here.
12. Check why the volunteer interest Google Form answered 401 to a signed-out visitor.
13. Try sign-in, forms, Edit text and who may do what on this Mac with setup file 5.

## Open questions, with recommended answers

**Q1. GA4.** Recommended: keep the tag off until the property is verified with enhanced measurement off, then
**load it only after a visitor agrees** (`docs/ANALYTICS.md`).

**Q2. A retired "investigate" page.** Recommended: a 301 to the nearest page that exists, written in
`content/routes.json`. The build has no "gone" answer (proposal).

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
7. **Live image inventory** (§11): the 16 are saved → the other live pages' images listed the same way, for approval.
8. ~~Draft rooms~~ **done** 20 Oct (Q4): all seven rooms published (`test/places.test.mjs`).
9. **Block contract**: enforce `data`; dates on every block; each block's own stylesheet (`docs/EXTENDING.md`).
10. **Migrations guard**: check whether Netlify's own Git builds skip this site's migrations, as SPILL's did; if so,
    add the guard (`docs/ARCHITECTURE.md`).
11. **Pages still on the live site**, one at a time, until `--production` builds: the 23 addresses and 16 links in
    `docs/research/ROUTES.md`, the four resource 301s with them.
12. **Mailing list (#5)** → a native request that keeps "received", "confirmation pending" and "subscribed" apart.
13. **Forms #1, #2, #4 and #8** → native, editable, toggleable, closed by default (`docs/COMMUNICATIONS.md`).
14. **Volunteer interest (#7)** → after owner action 12, rebuilt natively or linked as it is.
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
23. **Netlify** → settings and database **ready to run** 20 Oct (Connect's file 2, the site's file 6). Still → a cost plan.
24. **The §12 tests that need a server or Connect**: closed-form stale tabs, duplicate submits, version changes,
    denied access, retries and outages, revocation, staff-only caching, analytics leakage, editor to public page.
25. **Before the switch**: shortlinks and the six subdomains checked; the ribbons path tested on a deploy preview;
    the privacy policy reviewed; mobile performance measured; redirects, SEO and accessibility verified on a
    preview; an operational handoff and a reversible switch plan; `netlify.toml`'s command changed to the production build.
26. **The one-week promise** on the workshop confirmation → confirmed by Programs, or removed.

## Git and publishing

`site/` is git, `main`, pushed to the public `nicholas-badgersupports/badgersupports`. Only the owner commits,
pushes and puts drafts online, with `../PUBLIC-SITE-SETUP-2026-10-20/`. A session reads git with
`git --no-optional-locks` and never runs `add`, `commit` or `push`: a lock it leaves cannot be deleted from its
side and blocks the next commit. Never link the repository to Netlify: a Netlify build creates a database.

## Exchange

The eight `PUBLIC-*` requests are answered, in `../../Admin/Handoffs/Exchange/done/`: events and resources exported;
the rest declined until the owner decides. The owner then asked for sign-in, forms and editing directly (20 Oct), so
both halves were built. Connect's is uncommitted in its tree; its `_xfer/Public website setup` file 1 saves exactly
those 17 files, pinned by hash. Note to that session: `to-intranet/PUBLIC-SITE-SSO-AND-FORMS-BUILT-2026-10-20.md`.
