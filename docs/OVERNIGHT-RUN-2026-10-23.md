# Overnight run, 23 Oct 2026

An unattended run. Every choice that would have been a question is recorded below as a decision, with its
basis and how to reverse it, so it can be vetoed in one reading. Nothing here was committed, pushed, deployed
or sent; the closing section pastes the commands that show it.

## What was asked, as read

Nicholas, about 02:50: *"continue working … run in overnight mode to do as much as you can do. If you run out
of things to do, do this: https://github.com/cloudflare/security-audit-skill"*, with a PDF of the Google Form
**Letter of Referral / Recommendation Submission**. At about 03:05: *"auto continue when you run out of usage."*

Read as:

1. The PDF answers the open question in the staff application's decision 7, which form
   `recommend.badgersupports.org` opens. Build that form natively, **closed**, the way the two applications were
   built on 23 Oct: a definition, a preview page on the prototype, tests, and a request to Connect.
2. Then work the `WORK.md` queue items that do not wait on the owner, each with its acceptance test.
3. If the queue runs dry, audit the site with Cloudflare's security-audit skill. Read only: findings and fixes
   inside `site/`, never a push or a deploy.
4. Auto-continue: a job in this session fires every hour at :17, while the session is idle, and restarts the
   run from this log. It is gone when Claude exits and expires after 7 days. The run's last line here says
   when it is finished, and the job then deletes itself.

## Log

### 1. The letter of referral / recommendation form (`content/forms/recommendation-letter.json`)

Checked before building, from public views only (no response opened):
`recommend.badgersupports.org` → 302 `forms.gle/WC3ihM2Ahqz8jC6T7` → 302 the Google Form published as
`1FAIpQLSdbwnoLzhEcrffbAWias6lWOT1RD5WmOGSDEWE6CnBqB_Kx4Q`, title "Letter of Referral / Recommendation
Submission", which answers `closedform` today. The PDF is the same form.

| Decision | Basis | To reverse |
|---|---|---|
| Key `recommendation-letter`, references `RL-`; ships **closed**, previewed at `/forms/recommendation-letter/preview/` | the applications' pattern (decision 12): nothing opens by accident | rename the file and its `key`; open it in Connect |
| Google's one free-text "Your Contact Information (Email / Phone #.)" becomes a required **email** and an optional **phone** | `workshop-request`'s split of the same question, so a receipt can be sent and Connect can match on email | replace both with one `long` question "Your Contact Information" |
| The letter is **one PDF, at most 3 MB**. Google allowed "PDF or Document"; the help says a letter in another format can be emailed to hiring@badgersupports.org | the file type the site already checks byte by byte; the email route is the staff form's own wording | add a Word type to `QUESTION_TYPES.file` and to the server's byte check (`netlify/lib/files.mjs`) |
| Copy slips corrected: "contex" → "context", "Letter or Referral" → "Letter of Referral". Google's capitals kept | handoff decision 10 (correct slips, keep the originals in the source note) | edit the two strings |
| Google's link on "Badger Supports" in the intro is left out | a paragraph carries no links here, and the site's own header links home | add a `links` part |
| Two section headings, "About you" and "Your letter"; Google's form has none | every section needs a title, and one heading repeating the form's title reads twice | rename or merge the sections |
| The closed message is ours: letters open with the staff application; questions and letters to hiring@badgersupports.org | the staff form's "Referrers / Recommenders may also email letters to hiring@badgersupports.org" | edit `closedMessage` |
| Connect queue `hiring.recommendations`, owner Executive, receipt and backup proposed | the applications' queues are `hiring.*` and owned by Executive | edit `workflow` |
| No answer is marked confidential | no ruling says a letter is; who may read it is a Connect permission (`forms.read:recommendation-letter`) | add `"confidential": true` to `letter` |
| The staff form's decision 7 note now records the answer; its links to `recommend.badgersupports.org` stay | the address still opens the Google Form, and should 301 to the native form once it opens | — |
| A request to Connect: `Exchange/to-intranet/RECOMMENDATION-LETTERS-INTO-CONNECT-2026-10-23.md` | Connect whitelists files to `resume` and `cover_letter` today, so a letter would be dropped | withdraw the request |

### 2. The live site, connected to Connect; colour; design (Nicholas's third message, 23 Oct)

*"I don't need it to be a protype for review, have it be the lvie site, I want it to be actually connected to
Connect. Also get rid of the Drop in this week button, as well as all events on badger supports connect. … I also
want the entire thign to be more cohesively designed … look at the lessons of Badger SPILL … peer support gorups
should be green, craft nights should be purple."* Added to `WORK.md` as items 27–31, and worked first.

**A correction to note.** "Get rid of … all events on badger supports connect" is read as **the link** under the
home timetable labelled "All events on Badger Supports Connect", which is removed, beside the hero's "Drop in this
week" button. It is **not** read as deleting events in Connect: nothing in Connect was opened, changed or deleted,
and the timetable itself stays, now filled from Connect. If you meant something else, say so and it is one edit.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 2.1 | The hero's "Drop in this week" button and the timetable's "All events on Badger Supports Connect" link are removed (`content/pages/home.json`). The heading "drop in this week" and each row's own "Drop in" stay | the message names the two links; a row's "Drop in" is how a visitor finds the room | put back `secondary` on the hero and `connect` on the schedule block |
| 2.2 | **A publish now builds the live site**: `netlify.toml` gives the production context `node ops/build.mjs --production`, which reads Connect's `publicEvents` and `publicResourceExport` as it builds. The prototype build (fixtures, banner, noindex) stays for local work and previews | "have it be the live site … actually connected to Connect"; the publish file already deploys `--context production` | drop `[context.production]` from `netlify.toml` |
| 2.3 | If Connect cannot be read, **nothing is built** and the deploy already online stays | a live site showing hand-typed times is what the message objects to | let `--production` fall back to the fixtures in `ops/build.mjs` |
| 2.4 | A room is matched by whole words, longest phrase first (`content/connect-feed.json`); a room that matches nothing shows in Connect's own words, unlinked | Connect's rooms are free text; a wrong link is worse than none | add the phrase to `rooms` |
| 2.5 | Connect's weekly groups are titled "Peer support group" and, with no room, placed at the Student Mental Health Hub | the live peer support page; Connect titles them with the directorate's name | edit `weekly` in `content/connect-feed.json` |
| 2.6 | An event's type names its program (craft → craft nights, peergroup → peer support, workshop → workshops, anything else → other); words in its title name a series (Dogs on Call, Housing Hub) | Connect's own types; the two series pages listed their own events | edit `types` or `series` |
| 2.7 | An event with no start time is left out; Connect's `full` is ignored | a timetable row needs a time; `full` means enough volunteers, not "don't come" | `ops/connect-feed.mjs`, `mapEvents` |
| 2.8 | The live build shows no Wall of Support notes and no team until Connect exports them; Our Team says profiles appear as each person shares theirs (`team.none`) | fictional people must not reach the live site; a person appears only from their own profile (item 19) | — (needs Connect's exports) |
| 2.9 | An empty week says "Nothing is on the calendar this week." and that groups and craft nights show as soon as they are scheduled (`schedule.none`, `schedule.noneMore`, editable) | Connect may list nothing; SPILL's lesson that empty states are designed | edit the two text keys |
| 2.10 | The craft page's "recent nights" list is empty on the live site: Connect sends today onward only | the feed's own window | item 30 |
| 2.11 | Forms stay closed on the live site, each linking its Google Form | owner, 20 Oct ("launch closed") | item 31 |
| 2.12 | **Colour**: green `#266F46` (deep `#1B5636`, tint `#E2F1E6`, wash `#CFE7D5`) for peer support; purple `#6E3FA6` (deep `#4E2B7A`, tint `#E9E1F5`, wash `#DED3F0`) for craft nights. Every pairing used is AA: cream on each 5.2 and 6.1; each on paper 5.7 and 6.7, on its own wash 4.7 and 5.0 | the message; contrast measured with WCAG's formula | change the tokens in `src/styles/tokens.css` |
| 2.13 | Workshops and everything else stay brand red; the header, nav, announcement bar and footer are red on every page | only two programs were named; Connect's signed-out frame is red (Round 5) | add a `--workshops` set and its `[data-program]` scope |
| 2.14 | Colour is **scoped**, not repainted: blocks draw in `--accent*`, and `data-program` on a page's `<main>` (its new `"program"` field), a program section, an event hero, an events list or a timetable row turns it green or purple. A home circle and a Get involved door take the colour of where they link | one rule for every block, so no block can drift; editors set one word per page | set `program` back to nothing; `git diff src/styles` shows the swap |
| 2.15 | On the home hero the circles' rings and tag ledges stay red (they belong to the red ground); only each tag's icon badge turns green or purple | a green ring on a red ground reads as a mistake | `src/styles/blocks.css`, `.hub-photo` and `.hub-tag` |
| 2.16 | Still no coloured bar down any side; colour sits in fills, headings, buttons and tints | Round 7, unchanged by the message | — |

**Item 28, one design (Badger SPILL's lessons).** Read from `Badger SPILL/badger-spill/docs/DECISIONS.md` and its
`site/assets`, read only. The eight lessons taken are written up in `docs/DESIGN.md`, "Lessons from Badger SPILL".

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 2.17 | **Heading bands with two waves.** An inner page's heading (`pagehead`) stands on a pale band of its colour, a program's page (`eventhero`, a `program` with an h1) on its full colour, and each band ends in SPILL's double wave (`src/render/wave.mjs`, the same paths as SPILL's `waves.js`). The homepage has none | SPILL: an information page opens on a pastel band with two waves; the homepage does not | remove `has-wave` and `${wave()}` from `pagehead.mjs`, `eventhero.mjs` and `program.mjs`; delete `src/render/wave.mjs`; remove the "heading bands" section of `blocks.css` and `--wave-h` in `tokens.css` |
| 2.18 | **Cards are flat, with a border; only what can be pressed stands on a ledge.** Every card, photo and panel rule in `blocks.css` and `forms.css` loses its ledge (35 edits, each listed in the script below); empty lists and the Hub callout become a pale panel of the page's colour. Buttons, pills and the go pill keep theirs. A test holds it (`test/pages.test.mjs`, "only what can be pressed stands on a ledge") | SPILL's `.card` is flat with a border, and a shadow there means "press me" | `python3 local/flatten-cards-2026-10-23.py . --reverse` from `site/` (dry run checked: every pair matches once), **before** undoing 2.19 |
| 2.19 | **The dotted rules are solid.** `--dot-line` → `--hairline` (2px solid), `--dot-line-strong` → `--rule-line` (2px solid, was 3px), `--dot-line-on-red` → `--hairline-on-red` (2px solid, .3 alpha, was .45); every use renamed in `blocks.css`, `forms.css` and `layout.css`. The paper grain stays | SPILL's rules are solid; dotted rules beside flat bordered cards read as two systems | after 2.18: `sed -i '' -e 's/--hairline-on-red/--dot-line-on-red/g' -e 's/--rule-line/--dot-line-strong/g' -e 's/--hairline/--dot-line/g'` on the three files and `tokens.css`, then set the values back to `2px dotted var(--line)`, `3px dotted var(--rule-strong)` and `2px dotted rgba(242, 235, 225, .45)` |
| 2.20 | **Title Case for every heading, button, label and link**, 165 strings in `content/` and `text.json`; sentences, questions, colon labels, the wordmark, the tagline, what Connect sends and addresses keep their case. Six test strings follow | owner, 10 Oct, for SPILL ("Title Case everywhere"); the rule and its small words are in `docs/DESIGN.md`, "Heading case" | `local/TITLECASE-REVERSE-2026-10-23.tsv` lists each key, old and new: apply new → old with `local/titlecase-apply-2026-10-23.py`, then `git diff test/` shows the six strings |
| 2.21 | **The craft hero gives its card more room**: main column 1.2fr beside the photos (was 1.05fr), and the big button's side padding 2rem, so Drop In and Add to Calendar share a row at 1280 px | SPILL: neighbouring buttons share a row; one main button per screen | 1.2fr → 1.05fr in `.eventhero.has-photos .wrap`; remove `.feature-actions .btn--big` |
| 2.22 | **Narrow phones** (checked at 390 and 320 px): under 361 px the SPILL card on the home hero stacks its logo above its words; the room's building and floor sit on a line under the room's name (`.where-detail`) instead of after a dot that could start a line; a no-break space keeps AM/PM with its hour (`timeRange`) | the 320 px screenshots: "Write Your SPILL" broke over two lines, a line began with "·", and "PM" stood alone | remove the `max-width: 360px` rule; in `eventhero.mjs` put back `` ` · ${detail}` `` and remove `.where-detail`; in `src/render/events.mjs` put a plain space before each AM/PM |
| 2.23 | **Empty states are designed**: Our Team with no published profiles says so on a pale panel of the page's colour (`.team-none`), as the empty week and the empty resource list already do | SPILL: an empty state is a styled panel, never grey words | `.team-none` back to `max-width: var(--measure); margin: var(--s3) auto 0; font-size: 1.125rem; color: var(--muted);` |
| 2.24 | **Motion under a second**: the hand's wave is .9s on press (was 1.1s) and .95s once on the hero button (was 1.4s); every other move was already under a second | SPILL: a move that plays once ends inside a second | `src/styles/motion.css`, the two `i-wave` durations |
| 2.25 | **`docs/DESIGN.md` rewritten** to the design as built: the SPILL lessons, colour by program, heading case, shape, surfaces, the button set, motion and each page's shape. Every claim was checked against the built pages | a design file that describes another design is how the site drifted | `git diff docs/DESIGN.md` |

Checked for item 28: `node ops/check.mjs --browser`, every gate passed: 286 editable keys, the contract regenerated (the Title Case words), 125 tests, 162 screenshots with no console error or sideways scroll, all 169 accessibility and form checks. One check had pinned the skip link's words, which are editable; it now finds the link by its target (`ops/a11y.mjs`). Screenshots read at 1280, 390 and 320 px (in scratch): the bands and waves, the flat cards, the craft hero's two buttons on one row, the SPILL card stacked at 320 px, and Our Team's empty panel (drawn into the prototype's page, since only the live build has no team).

Checked: `node ops/check.mjs`, every gate passed, 124 tests; the program test now holds green and purple and a red
frame (`test/pages.test.mjs`). Screenshots at 1280 px (in the session's scratch folder, not the repository, since
they show real students): the peer page green throughout, the craft page's hero band purple, the home timetable's
rows green, red or purple by program, the hero's three badges green, red and purple.

### 3. Forms #1, #2 and #4, native and closed (`WORK.md` item 13)

Read before building, from Google's public respondent view only (23 Oct; no response, sheet, setting or script
opened): #1 the resource request (`forms.gle/GgfggAR7nRVSXrZPA`), #2 the program request, #4 the referral card
survey (`forms.gle/eYdEzbosWkjfUQyN8`). #8, the alumni testimonial, still answers **401** signed out, so its
questions cannot be read from here.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 3.1 | Built as `resource-request` (refs `RR-`), `program-request` (`PR-`) and `referral-card-survey` (`RCS-`), each **closed**, previewed at `/forms/<key>/preview/`. Every title, intro, label, help line and option is Google's, word for word | item 13; launch closed (owner, 20 Oct); the letter form's practice (§1) | remove the three files from `content/forms/` and their entries in the two tests |
| 3.2 | The pages keep linking the Google Forms: Colors of Support (#1), Request a Program and Request a Workshop (#2), Referral Cards (#4) | a link to a closed form would offer nothing | once a form opens, point its page's link at `/forms/<key>/` |
| 3.3 | Section titles are ours: "About You" and Google's own "Options" (#1), "About You" and "Your Request" (#2), "Your Card Idea" (#4). Google's three forms are each one page | every section needs a title; the letter form's practice | edit each section's `title` |
| 3.4 | **Required as Google has it**, including four on #2 that read as optional ("(if applicable)", "(if known)", the accommodation question, "Anything else") and #4's notification email, which reads as a choice. Each carries a `review` note | the questions are Google's; what to require is Programs' call | `"required": false` on the question |
| 3.5 | The email questions check that an address is an address; none refuses one outside wisc.edu | Google's are short-answer boxes that check nothing | `"type": "short"` |
| 3.6 | #1's four photos of the materials are left out | the form model takes no picture, and the photos are not in the library | add them to the page that links the form |
| 3.7 | #1's timelines become the help under "I am requesting", read before choosing; its thanks become the confirmation. The timelines are not confirmed | Google's closing block sits above Submit, where it is read too late | move the list back to the confirmation, or edit it |
| 3.8 | #2's and #4's closing blocks are their confirmations. #2's pin emoji is left out; #4's "the Badger Support's" reads "the Badger Supports" | the confirmation is where thanks show; the letter form's slip practice (§1) | edit `confirmation` |
| 3.9 | #4's "Other" stays a plain choice with no box, and "select up to 3" is not enforced | as Google has it | `"allowOther": true`; `"maxSelected": 3` |
| 3.10 | Owners: #1 **Engagement** (`engagement.resource-requests`), #2 **Programs** (`programs.program-requests`), #4 **Programs** (`programs.referral-card-ideas`). Queue names are proposals, like every queue | Google's titles say "COMM" and "PROG"; Connect's `docs/directorates/engagement.md` holds Communications, and `programs.md` holds Referral Cards (read only) | edit `workflow` |
| 3.11 | #4 sends no receipt; #1 and #2 have one proposed | #4's address is asked for news of the project | `"receipt": "proposed"` |
| 3.12 | #8 is not built | its questions cannot be read without signing in | build it from a PDF of the form, as the letter was |

Checked: a script compared every Google-sourced string in the three files with Google's page text (126 strings;
one differs, the corrected slip), and each question's required flag with Google's (25 of 25 match). The rules pass
closed and open, and the browser's copy of each form carries no note. Two tests added (`test/applications.test.mjs`,
the request forms; `test/pages.test.mjs`, their previews). Previews screenshotted at 1280 and 390 px, no sideways
scroll. `docs/COMMUNICATIONS.md` now lists eight forms built.

### 4. The migrations guard (`WORK.md` item 10)

The item said: add Badger SPILL's guard if this site's builds skip migrations as SPILL's did. Read first: the site has
no Git builds (the repo is never linked), and both publishes ran on the laptop through Netlify's command line. Their
logs (`~/Builds/badgersupports-live-d12f205.log`, `…-f6cd97f.log`) show Netlify's "Netlify Database setup" step ran
and copied `001_intake` and `002_staff`. The deployed API never runs migrations itself (`netlify/lib/db.mjs`), and
this run added `003_files`, so the next publish is the first that must carry a new one.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 4.1 | Built the guard anyway: `netlify/plugins/migrations-guard` (SPILL's `check.js` and `index.js`, its message pointing at the owner's publish file), run from `netlify.toml` | the step that copies migrations is a platform setting SPILL saw switched off; the next publish adds one; a stopped deploy leaves the site as it was | delete the `[[plugins]]` lines in `netlify.toml` |
| 4.2 | No after-the-fact schema check (SPILL's `schema-check.mjs`, `GET /api/health` "behind") | the site's health route is public, and naming tables there tells strangers about the database | add it behind a staff route if wanted |

Checked: `test/migrations-guard.test.mjs` (5 tests), including that Netlify takes exactly the migrations the local rig
applies. Run against the 23 October build folder in `~/Builds` (read only): it passes; with this tree's `003_files`
added and not copied, it stops and names it. Not run inside a Netlify build: that happens only at the owner's next
publish, and its log should then say "Migrations guard: all 3 migrations are packed for this deploy."

### 5. Block contract (`WORK.md` item 9)

`docs/EXTENDING.md` listed three gaps between what a block declares and what the build holds it to. All three are
closed; the table in "What a block declares" now says how each is held.

- **`data` is enforced.** Four blocks read sources they had not declared and now declare them: `resources`
  (`resourcesSample`, `resourcesUpdated`), `wall` (`wallSample`), `team` and `person` (`teamSample`). Every block
  renders through `renderBlock()` (`src/render/registry.mjs`), which gives it a `ctx.data` that stops the build on
  any other source, naming the block and the source, and puts the full data back afterwards.
- **Any block can be dated.** `startsOn` and `endsOn` join `id`, `type`, `enabled` and `anchor` as fields every
  block may carry (`COMMON_FIELDS`). The build refuses a date that is not a real day (`2026-13-01`) and a start
  after the end. `announcement` no longer declares them itself. No page uses them yet.
- **A block can have its own stylesheet.** A block names a file in `src/styles/blocks/` as `styles`; the build
  adds it right after `blocks.css`, in the order of `BLOCKS`, and stops on a named file that is missing or a file
  there that no block names (`blockStyles()`, `ops/build.mjs`). `wall`, `directory`, `words` and `mood` moved; the
  rest stay in `blocks.css`.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 5.1 | Enforce by wrapping `ctx.data` in a Proxy for one block's render, not by building a fresh `ctx` per block | `team.mjs` keeps a WeakSet keyed on `ctx` so its sample note is written once per build; a new object per block would write it on every block | in `src/render/layout.mjs`, call `BLOCKS[b.type].render(b, ctx)` again instead of `renderBlock(b, ctx)` |
| 5.2 | Asking whether a source is there (`"team" in ctx.data`) counts as reading it | otherwise a block could branch on another block's data without declaring it, which is the dependency the contract exists to show | drop the `has` trap in `renderBlock()` |
| 5.3 | Dates take effect when the site is built, not at midnight | the site is static; a change on the day needs a scheduled build or a browser check, which is `WORK.md` item 29. The contract and `EXTENDING.md` say so in plain words | none needed; item 29 is the follow-on |
| 5.4 | Dates are both included and read in Chicago time | `liveBlocks()` already compared `today` from the build's Chicago date; `announcement` worked that way before | change the comparison in `liveBlocks()` |
| 5.5 | Moved four blocks' rules, not all of them | those four are self-contained; the others share rules (`.sample-note` is used by four blocks) and a move of all of `blocks.css` (1,282 lines) in one unattended run is a risk to every page for no visible gain. The rest move when each block is next worked on (`EXTENDING.md` §4) | move a file's rules back into `blocks.css` under their heading and drop its `styles` line |

**How the move was checked.** Computed styles for every element on 57 pages at 1280, 390 and 320 px (171 page
views, 55,368 elements) were taken from the build before the move, twice, and from the build after it, and compared
property by property. Two builds before the move differ in 5 elements, all the same: the margins of the footer's
`.wrap` at 1280 px flip between 0 and 32 px from one run to the next. Before against after differs in 6 elements,
all that same footer margin and nothing else. The tool is in scratch, not the repository.

Two tests that hold SPILL's flat-card and no-side-bar rules read `src/styles/` one folder deep, so they would have
missed the moved rules; they now read every stylesheet below it. `test/blocks.test.mjs` is new (7 tests): a planted
block that reads an undeclared source stops the build, before and after it declares it; the build's own `ctx`
reaches the block; every declared source is one the build provides; the date rules; a missing and an orphaned block
stylesheet. `npm test`: 138 tests, 138 pass.

### 6. The mailing list (#5), native and closed (`WORK.md` item 12)

Read before building, from Google's public respondent view only (23 Oct; no response, sheet, setting or script
opened): "Join Our Email List" (`forms.gle/THmnT9QCdeeaoZx38`). One required question, the email address, then
Google's four numbered steps for joining the Google Group by email, then "All set! Click submit!".

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 6.1 | Built as `email-list` (refs `EL-`), **closed**, previewed at `/forms/email-list/preview/`; the Email List page keeps linking the Google Form | item 12; launch closed (owner, 20 Oct); practice 3.2 | remove `content/forms/email-list.json` and its entries in the two tests |
| 6.2 | The site records only **received**. Its thank-you page says so and says the person is not on the list yet; a test refuses any wording that says they are | `docs/COMMUNICATIONS.md`, "The mailing list": only the Google Group knows who is subscribed | edit `confirmation`, and the test in `test/applications.test.mjs` |
| 6.3 | No receipt | the site would be emailing an address nobody has confirmed, which is what the Group's own confirmation exists to stop | `"receipt": "proposed"` |
| 6.4 | Google's four steps are words on a second page, numbered as Google has them; "CLICK HERE to send an email to …" reads as the Email List page's "Send an email to …", with the address as a link under the steps; Google's bold asterisks on "Do not use…" are dropped; "All set! Click submit!" is dropped | a link says where it goes; the page and the form now say the same; the button says Send | edit the section's `intro` |
| 6.5 | Section titles: "Your Email" is ours; "Add Yourself (Optional)" is Google's "(OPTIONAL)" in Title Case, as the page has it | every section needs a title (practice 3.3) | edit each section's `title` |
| 6.6 | Owner **Executive**, queue `executive.email-list` (a proposal) | Google's form name starts "EXEC"; Connect keeps only the leaders' list (`netlify/actions/newsletters.mjs`, read only) | edit `workflow` |
| 6.7 | Asked Connect to hold the other states, by a new request in `to-intranet/`: `PUBLIC-EMAIL-LIST-STATES-2026-10-23.md` | "confirmation pending" and "subscribed" are set by a person who checks the Group, and Website Forms has only new, seen, done and archived (`publicsite.mjs:70`, read only) | move the request to `done/` with a "withdrawn" reply |

Checked: the word script compared every Google-sourced string with Google's page (13 strings; the one that
differs is step 3, without Google's bold asterisks; the four that are ours are the confirmation). The rules pass
closed and open. A new test holds the thank-you page to "not on the list yet" and refuses wording that says the
person is on the list, added, subscribed or welcomed; it was calibrated against four such sentences, each refused.
The request-form and preview tests now include `email-list`. Preview screenshotted at 1280 and 390 px, no sideways
scroll. `npm test`: 139 tests, 139 pass. `docs/COMMUNICATIONS.md` lists nine forms built.

### 7. Events between publishes (`WORK.md` item 29)

A page built from Connect's events was right on the day it was published and drifted after. It now asks again as it
loads: `/api/events/<page id>` answers the page's event blocks, rendered by the build's own renderer from Connect's
list now, and `src/client/schedule.js` swaps in what changed. An event a director ticks, moves or takes off in Connect
shows on the site within about five minutes, with no publish. When anything fails, the page stays as published.

- **What answers** (`netlify/lib/live-events.mjs`). The build writes into `server.json` each page's event blocks, the
  program sections they read, the places and the rules Connect's list is read by (`eventsForServer()`,
  `ops/build.mjs`); no key. The function makes the build's own signed `publicEvents` call, at most once a minute
  while warm, and renders the blocks for today in Chicago. With nothing changed in Connect, each block is the
  published page's markup byte for byte (tested).
- **Which pages ask.** A block declares `refresh` (schedule, events, event hero, directions; program when it lists
  upcoming events); a page built from Connect with one of them carries `data-refresh="events"` and loads
  `schedule.js`. The prototype never asks.
- **Calendar buttons** on a page built from Connect open `/api/calendar/<event>.ics`, made from the list now. An event
  gone since the page loaded gets a short page that says so and links the timetable (`calendar.gone.*`, three new
  text keys). The build still writes `/calendar/<event>.ics`, and the prototype still links them.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 7.1 | A cached read of Connect through the API, not a scheduled rebuild | only the owner publishes (`WORK.md`, "Git and publishing"); a scheduled build would deploy without them, and releases need the laptop's photo originals (Blocker 3). The API publishes nothing | drop the two routes in `netlify/lib/router.mjs` and `refresh` from the five blocks; pages then stay as published |
| 7.2 | The function renders with the build's own renderer, not a list the browser draws | one renderer: every word from `text.json` and its edits, Connect's strings escaped by `html`, and an answer identical to the page when nothing changed. A browser renderer would be a second copy of five blocks | none sensible short of 7.1's reversal |
| 7.3 | CDN five minutes plus ten stale-while-revalidate; browser one minute; a warm function asks Connect at most once a minute | "shows without a publish" (item 29) at a cost to Connect of about one call per CDN refresh | `LIVE_CACHE` in `router.mjs`; `FRESH_MS` in `live-events.mjs` |
| 7.4 | When Connect cannot be read, the answer is the publish's list, held half a minute, and the function logs it | the visitor sees what they would have seen anyway, and the site recovers within half a minute | `STALE_CACHE`, `FAILED_MS`; or throw in `eventsNow()` |
| 7.5 | A query string on either route is refused (400) | the CDN keys on the full address, so `?x` would ask past the cache to Connect | `noQuery()` in `router.mjs` |
| 7.6 | Every calendar link on a page built from Connect goes to the API | a written file is right only until the event moves; the API's file is the build's text (tested) | `calendarHref()` in `src/render/ics.mjs` |
| 7.7 | The browser swaps only a block's `data-live` parts where it has them (the event hero's next event, the directions page's next event, a program's upcoming list) and only those that changed; elsewhere the section, when it differs; an empty answer hides it | the words and photos around a live part change only with a publish, and `strip.js` may have moved them | `swap()` in `src/client/schedule.js` |
| 7.8 | An events list split by month that has nothing to show publishes an empty hidden section | the browser can only fill a block the page has, so an event added later needs a place | `src/render/blocks/events.mjs` |
| 7.9 | The answer is parsed with `DOMParser`, not `innerHTML` | `ops/editable.mjs` refuses `.innerHTML =` in a browser module; `DOMParser` makes a separate document where nothing loads or runs until placed | none needed |

**Known limits.** A block that was not on the published page (switched off, or dated to start later) cannot appear
without a publish; one dated to end disappears. A list block without live parts (`events`) is replaced whole when
it changes, so its photos load again. A director in Edit text loses the edit markers in a swapped part until the
page reloads. After midnight a cached answer can lag by about fifteen minutes; `mark()` still fades ended events and
moves Today as the page loads. Connect sends today onward only, so a "recent" list on a page built from Connect
stays empty (item 30). **Not tried against the live Connect or Netlify's CDN.**

**Security.** Both routes are public and read only, and answer only what a page built now would show, from
Connect's public list; no database, no session, no key in `server.json` (tested). A page id must be `pg-…` and
one with event blocks (`Object.hasOwn`, so `constructor` is not one); an event id is at most 120 of `A–Z a–z 0–9 _ -`;
anything but GET is 405.

Checked: `test/live-events.test.mjs` (new, 7 tests: byte-for-byte with nothing changed; an event added and one
taken off; one Connect call a minute; the publish's list when Connect fails; the prototype never calls; the calendar
file and its gone page; the refusals). `test/events.test.mjs` holds the empty hidden section. In a browser
(Playwright, scratch), the craft nights and home pages built from a fake Connect, answered with a later list: the
event added later became Next Up, the one taken off left, the photos stayed (6 and 17), no script error; with the
API answering 500 both stayed as published. `npm test`: 146 tests, 146 pass. `node ops/check.mjs`: every gate
passes, after `node ops/contract.mjs` added the three keys to the editor contract.

### 8. Recent craft nights (`WORK.md` item 30): asked of Connect

Connect's `publicEvents` sends today onward only, so "Recent Craft Nights" is always empty on a page built from
Connect, and the page hides it. Asked Connect for the last few, in a new Exchange item:
`Admin/Handoffs/Exchange/to-intranet/PUBLIC-EVENTS-RECENT-2026-10-23.md` (added; nothing else in Exchange touched).

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 8.1 | Ask for a separate `recent` list, not past events in `events` | Connect sorts `events` and keeps the first 60, so past ones would push later ones off (`public.mjs`, read only) | rewrite the item before Connect picks it up |
| 8.2 | Same selection and projection as `events`, ended before today, started in the last 42 days, at most 12 | nothing new crosses; four per program across a three-week break | the numbers in the item |
| 8.3 | The site reads `recent` now; a row dated today or later, or listed twice, is dropped and named | the site needs no further change when Connect sends it; until then the list stays hidden as before | the `recent` lines in `mapEvents()` |
| 8.4 | Kept the list on the page rather than taking it off | the owner wanted more on the page, not less; hidden while empty costs nothing | drop `b-cn-recent` from `content/pages/craft-nights.json` |

Checked: `test/connect-feed.test.mjs` (new test: recent rows map and fill the list, a row dated today and a repeated
id are dropped, a Connect that sends none leaves the hidden section), 10 of 10 pass.

### 9. The engagement map (`WORK.md` item 6)

`docs/research/ENGAGEMENT-2026-10-23.md`: for each §3 task, the route, the clicks, where it leaves and how the link
says so, measured on the live build (`local/test-build-connect`, 37 pages) and the preview (`dist/`, 58 pages) with a
script kept in scratch. Every task page is one click from `/`; no student link goes to Connect; director sign-in is
the footer's last link.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 9.1 | An event on the page its link would open is named, not linked ("Next Here" on the peer page linked to itself twice) | W3C G128; the student is already there | drop `ctx.here()` from `directions.mjs` and `schedule.mjs` |
| 9.2 | "View Details" carries the resource's name for screen readers only; the card looks as it did | WCAG 2.4.4: 82 identical link texts on one page | `button()` in `src/render/blocks/resources.mjs` |
| 9.3 | Naming Connect and Google Forms in visible link words, and carrying the request type into the form, left as recommendations | they change the owner's words or a Google Form link | — |
| 9.4 | Kept the out arrow, against GOV.UK's "Do not use an external link icon" | the owner's design, on every exit, beside the words | `link()` in `src/render/context.mjs` |

`ctx.path` is the page being rendered; the build, `server.json` and `netlify/lib/live-events.mjs` all pass it, so a
page refreshed from Connect as it loads keeps the same rule.

Checked: `test/live-events.test.mjs`, new test "an event on the page it would link to is named, not linked": the
peer page, before and after a refresh, names the roomless weekly group without a link, and the Hub's directions page
still links it. With the directions fix taken out, the test fails; the file was put back. `test/resources.test.mjs`:
two new assertions. `npm test`: 148 tests, 148 pass.

### 10. Keeping to the brand (Nicholas, 23 Oct: *"the website doesn't really use the badger supports style guide at style.badgersupports.org, be careful not to deviate from the badger supports brand"*)

Read as: the brand wins wherever this run's design (§2, after SPILL's lessons) or Connect's family look differs
from it. Sources, in order: style.badgersupports.org (v1.0), then the brand design system in
`Admin/Design/Badger Supports design system` (read only; two fonts' licence and two CC0 papers copied out of it).
SPILL's lessons are kept in the brand's terms. `docs/DESIGN.md` is rewritten to describe the result; its
"Sources" and "Lessons from Badger SPILL" tables say which rule came from where.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 10.1 | **Montserrat only**: `h1`, `h2`, the hero, the wordmark and tile titles in 800, uppercase, tight; body 400–700. Baloo 2 and Caveat leave the build, moved (not deleted) to `local/retired-fonts-2026-10-23/` | the guide sets every web word in Montserrat; the design system's `DisplayHeading` (Montserrat heaviest, uppercase, tight) is "the main headline on 37 of the 80 reference pieces. Reach for it first" | `--font-display`, `--fw-display` in `tokens.css`; the `h1, h2` rule in `base.css`; put the three files back in `assets/fonts/` |
| 10.2 | The hero's title shows **BADGER SUPPORTS** in capitals, by CSS; its source stays "badger supports". The header's lockup stays lowercase, and the tagline stays lowercase | `DisplayHeading` on the posters; the lockup and the tagline are written lowercase by the brand | `.hero h1 { text-transform: none }` |
| 10.3 | The brand's colours: red `#B60000`, cream `#F2EBE1`, charcoal, khaki; peer green, craft lilac ("purple") and workshops blue from the brand rainbow, each deepened until text on it passes AA. Links `#304674` | the guide's palette and rainbow; the owner's green and purple (§2) | the token table in `tokens.css`; `test/pages.test.mjs` holds green and purple, and axe (`ops/a11y.mjs`) the contrast |
| 10.4 | **Paper, never a flat fill**: cream under the coldpress paper at a 70% veil; a coloured block (hero, footer, announcement, event hero, closing call) on the crumpled paper under its colour at 50%. Cards, header and fields stay white and plain. The dotted grain is gone | the design system's "never a flat fill" and its `paper.css`; both papers are ambientCG CC0 (`assets/brand/TEXTURES-LICENCE.txt`); its Pexels and Unsplash papers stay out of this public repository | replace the four `--tex-*` tokens with flat colours |
| 10.5 | **Flat buttons**: `.btn`, the go pill, Drop In, mood and "what would you say" choices lose their ledge and darken under a pointer. SPILL's ledged pills stay on SPILL's card and band | the design system's `Button` (flat pill); "Shadow is an option, never a default. 72 of 80 pieces carry none" | the ledge rules as they were at `f6cd97f` (`git show f6cd97f:src/styles/base.css`) |
| 10.6 | A whole tile that is one link or choice (a Get Involved door, a room ticket, a "say" choice) carries the guide's softest lift; info cards are flat with a 2 px line | the style guide page's own white card and lift; the flat-card test in `test/pages.test.mjs` | `--lift` on `.door-link`, `.ticket-link`, `.say` in `blocks.css` |
| 10.7 | Nothing tilted except the wall notes, which float over the page with their shadow | the brand's cards sit square; a note on a wall is the one thing pinned | `rotate` on the sticker and caption rules |
| 10.8 | **Waves off**: the page head, the event hero and a program's page end square | the wave is SPILL's mark; the brand's bands run edge to edge | re-add `${wave()}` in the three blocks and the `.has-wave` rules |
| 10.9 | Corners on the design system's scale: panels 32 px, cards and photos 20 px, inputs 8 px, pills | the design system's radius scale; Connect's 7 px goes | `--r-*` in `tokens.css` |
| 10.10 | Header white with the red wordmark; the announcement bar and footer textured red | the guide page's own white header; the brand red where a band runs edge to edge | `.site-header`, `.announce`, `.site-footer` in `layout.css` |
| 10.11 | The form head is the guide's white card, flat, with an 8 px top in its colour; its title is sized to the card (`min(2.125rem, 9.4cqi)`) so RECOMMENDATION never breaks mid-word | the guide's card; the flat-card test failed with a shadow on it; at 320 px a fixed size broke "RECOMMENDATIO / N" | a fixed `clamp()` on `.form-head h1` |
| 10.12 | On a phone the wordmark scales (`clamp(1rem, …, 1.6rem)`) so Menu stays beside it at 320 px | the header wrapped at 320 px with the capitals | delete the rule in `layout.css` |
| 10.13 | The accessibility check strips the papers and darkens each light ground to the paper's darkest measured tone (×0.95) before axe reads it | axe cannot read colour through an image; the worst case a line of text can sit on | the block in `ops/a11y.mjs` |

More Sugar, the brand's Canva headline face, is licensed and has no web version: it is not in the repository or on
the site, and nothing imitates it.

Checked: `npm test`, 148 of 148, including "only what can be pressed stands on a ledge" and "peer support wears green and craft nights purple"; the
browser gates (screenshots at 1280, 390 and 320 px; axe on every page at all three) in the Evidence table of
`WORK.md`. Screenshots that show students are kept in scratch, not in the repository.

### 11. Photo host allow-list (queue item 4)

Read as: a production build fetches a pasted photo link only from a fixed list of hosts. The list mirrors
Connect's `IMG_HOSTS` (`netlify/lib/store.mjs` in the intranet repo, read only) and `MASTER-PROMPT.md` §11:
"Bound allowed sizes and remote origins". No content uses a photo link today: all 58 pages' photos are library
ids. So nothing that builds now changes.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 11.1 | **`PHOTO_HOSTS`**: `drive.google.com`, `docs.google.com`, `googleusercontent.com`, `badgersupports.org`, `supportbadgers.org`, `badgerspill.org`. Each matches itself and its subdomains, never a lookalike (`evilbadgersupports.org`, `badgersupports.org.example.com`) | Connect's four hosts, widened by the two Drive addresses a file link uses (Drive's thumbnail redirects once to `lh3.googleusercontent.com`, measured 23 Oct; Google Sites images are on `lh7-us.googleusercontent.com`) and by Badger SPILL's own site, which the pages link to. `DESIGN.md` had proposed "Drive, the organisation's own sites" | edit the list in `src/render/media.mjs`; the contract and the docs read it from there |
| 11.2 | A constant, not a setting | Connect's comment on its own list: "THE HOST LIST IS A CONSTANT AND NOT A SETTING" | none needed: a host is added by a one-line change and a review |
| 11.3 | Only `--production` refuses another host; a laptop build fetches from any public `https` host | the private-address rule already works this way; an editor can try a photo before it is moved to Drive | drop `production &&` from the rule in `photoProblems()` |
| 11.4 | **Redirects are followed one hop at a time, at most five**, and in production each hop must be `https`, carry no user name or password, not be private, and be on the list. Before this, `fetch` followed redirects without looking | an allowed host could otherwise hand the fetch to any server; Drive needs one hop | `redirect: "follow"` in `fetchLink()` (`ops/media.mjs`) |
| 11.5 | The refusal names the host and says what to do: put the photo in Google Drive, share it as "Anyone with the link" and paste its link | the editor who pasted it is the one who reads the message | the message in `photoProblems()` |
| 11.6 | The editor contract (`docs/CONNECT-EDITOR-CONTRACT.md`, generated by `ops/contract.mjs`) lists the hosts and asks Connect's editor to refuse others at paste time. No Exchange note: Connect's `setPhoto` hosts are already a subset, so nothing on Connect's side breaks | the contract is how the site tells Connect its rules; `check.mjs` holds it current | the two lines in `ops/contract.mjs` |

Not covered: a public host name that resolves to a private address would pass. A build on Netlify cannot reach
such an address in any case, and checking it means resolving every host before fetching. Written in `DESIGN.md`.

Checked: `test/media-links.test.mjs`, two new tests. The first is "a published build takes a link only from
Google Drive and the organisation's own sites": eight allowed links, five refused hosts, and a laptop preview that
still fetches from anywhere. The second is "a redirect is followed one hop at a time, and a published build checks
every hop", run against a server on 127.0.0.1 only: a relative redirect is followed; a loop stops after five hops; a
redirect to `file:` is refused; in production, redirects to `http`, to another host and to a private address are
refused, and nothing refused is kept. `npm test`: 150 of 150. `node ops/check.mjs`: every gate passed. The first run
of the build gate stopped once with `ENOTEMPTY` while clearing `dist/` straight after `npm test`. Run again alone, it
passed. Not reproduced, and recorded here in case it returns.

### 12. Netlify cost plan (queue item 23)

Read as: `MASTER-PROMPT.md` §11 asks for the actual account, plan and current pricing before any claim about cost.
So the plan is built from three things read on 23 Oct: Netlify's own billing pages, the team as the Netlify
connector shows it, and seven days of Netlify observability for each of the three projects on the team. What
cannot be read from here is named as such. It replaces "Cost" in `docs/ARCHITECTURE.md`; WORK.md item 23, blocker
6 and owner action 15 point at it.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 12.1 | **Prices only from Netlify's pages**, each linked in the section with the date read: How credits work (updated 12 Aug 2026), Credit-based pricing plans, Database billing (14 Aug 2026), Sleep on inactivity | §11; the 20 Oct section had left the database and function unpriced | the section as it was: `git show HEAD:docs/ARCHITECTURE.md` |
| 12.2 | **The database is named the meter to watch.** It bills by the time it is awake (at least 1 CU, at least 5 minutes a wake), so a database that never sleeps is 7,200 credits in 30 days, more than the plan's 3,000 | Database billing and Sleep on inactivity; the arithmetic is 30 × 24 × 10 | none needed: a reading of Netlify's prices |
| 12.3 | **What wakes this site's database, read from the code**: the form-state check as a form loads (`src/client/form.js` `checkState`, two queries in `netlify/lib/intake.mjs` `currentForm`), a send, an upload, a mood tap, a sign-in and the staff pages. `/api/events`, `/api/calendar` and `/api/health` never touch it; there is no scheduled function | `netlify/lib/router.mjs` and `netlify/lib/live-events.mjs`, which imports no database module | none needed |
| 12.4 | The 20 Oct bullet "the function runs only for form posts, the form state, mood taps and health" is corrected: it also answers events, the calendar, sign-in and staff | the router's route list | none needed |
| 12.5 | **A modelled month, quiet and busy**, with the traffic marked as assumed: at most about 370 and 2,400 credits for this site | measured page weight (371 KB first view) and request counts from the build; Netlify's prices; the traffic is a guess until the site is public | edit the table in "Cost" |
| 12.6 | Function memory taken as 1 GB | Netlify's pages state no default; 1 GB makes the function line a ceiling, not a floor | replace 1 GB in the section once Netlify shows the memory |
| 12.7 | **The other two projects named as the larger risk**: badgerspill's `worker` every 5 minutes and `sync` every 30, its `/api/service` about every 36 s, and the intranet's `/api` every one to three minutes, every hour for 7 days | Netlify observability, read only. Neither repository was read: this task is the public site's, and `../../CLAUDE.md` keeps each session in its own repository | delete the paragraph |
| 12.8 | **An Exchange item, not a change**: `to-intranet/NETLIFY-DATABASE-AWAKE-2026-10-23.md` asks whether those calls query the database, and who makes them. Nothing goes to `to-spill/` | this run may only add files to `to-intranet/`; the SPILL question waits for Nicholas | move the item to `done/` with "withdrawn" as its reply |
| 12.9 | **Recommended, not made**: check a form's state at the visitor's first keystroke, not as it loads, so a page view alone never wakes the database (busy month: 2,000 → about 400) | it changes when a visitor learns a form is closed, which is the owner's to weigh against cost; the server still decides at Send either way | not made, so nothing to reverse |
| 12.10 | **Owner settings, recommended, not touched**: this database's auto-scale maximum at 1 CU; auto recharge decided; Billing → Usage read weekly while the site is new; sleep left at 5 minutes | spending money and team settings are in the pause set; the connector's `initialize-database` would create a database and was not called; no environment variable was read | none needed |

Observed and left alone: on 22 Oct around 14:06 UTC the public project received 374 requests for the path
`/[object URL]`, every one answered 401 by Netlify's team sign-in, 0.38 MB in all. That is a script turning an
object into a link by mistake. The string is in neither the site's code nor Netlify's own toolbar script, so the
origin is unknown. It cost almost nothing and did not reach the function.

Not covered: what each project actually used (Billing → Usage; the connector has no reader for it, and Netlify's
"Monitor credit usage" page returned 404 on 23 Oct); how many production deploys the three projects make; whether
the intranet's and SPILL's databases sleep; the functions' memory; what a draft deploy costs; the database storage
rate, which Netlify says is billed no earlier than 1 July 2026 and does not state.

Checked: `node ops/check.mjs` after the edits; every gate passed, WORK.md at 179 lines by the gate's count (it
counts the empty string after the last newline). The first run after adding owner action 15 failed that gate at
180, so blockers 4 and 6 were shortened to one line each; nothing in them was dropped that item 23 does not hold.

### 13. Security audit (step 3 of the request)

Read as: Cloudflare's security-audit skill (at `c1c8a8c`), quick profile, over the whole of `site/` as it stands:
`f6cd97f` plus this run's unpublished work, which the next publish ships. Read only. No target code ran, and no
request went to badgersupports.org, Connect, Netlify or GitHub. Fixes only inside `site/`. The hunter wave ran
17:14–17:36 in the first session, which then hit its usage limit. Items 4 and 23 (§11, §12) were made after it.
This session resumed the audit at 22:05 and closed it at 22:27.

**Where the record is.** `~/security-audit-skill/badger-supports-public-site/run-1/` on the laptop: `REPORT.md` (start
here), `NEEDS-VALIDATION.md`, `FINDINGS-DETAIL.md`, and the machine records `findings.json` and
`coverage-ledger.json`. It is outside the repository on purpose (13.1).

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 13.1 | **The audit's record stays outside `site/`**, and this section names its leads only by kind | `site/` is pushed to a public GitHub repository, so a report in it would publish the open leads with the next push | copy `REPORT.md` into `docs/` once its leads are closed |
| 13.2 | **Resumed from the run directory, not rerun**: the four returned hunters stood, and the fifth's complete result was consolidated | the skill keeps its state in the run directory for this; a rerun would spend the budget again on the same tree | start a run 2 |
| 13.3 | **The tree's change after the hunt is on the record** (item 4, 21:36–21:40, the photo fetch). Every verifier and the critic judged the current tree and were told of it. One rejection rests on that change, and the report says so | an audit of a tree that moved under it must say which reading each verdict used | none needed |
| 13.4 | **Verifiers ran beside the critic**, one fresh verifier per candidate | in the quick profile a gap the critic finds becomes a deferred unit, never a new candidate, so no verdict waits on it | none needed |
| 13.5 | **The two event-id candidates kept as two records**: one is the build's file writer, the other the calendar file's text | different sinks, each missing its own control; the verifiers concluded the same. One fix closes both (13.9) | merge them in `findings.json` and rerun both validators |
| 13.6 | **The critic's 3 new units and 1 reassignment recorded as deferred, not hunted** | the quick profile runs no second wave; 15 of 16 agent calls were spent | a run 2 on the standard profile |
| 13.7 | **`run_status: complete`** | the skill's test: every candidate has an independent final verdict, every kept record passed Phase 5, and both validators pass. It means the quick profile's steps all ran, not that coverage settled, and `REPORT.md` §1 and §7 say so | set `partial` in `run-metadata.json` |
| 13.8 | **No severity on any lead, and `confirmed` not reached** | `confirmed` needs a local run in an OS-enforced sandbox, and this Mac has no memory or process limit to give one | none needed: a rerun on a host with one |
| 13.9 | **Made after the audit, 22:25**: `mapEvents` leaves out any dated or recent Connect event whose id is not `^[A-Za-z0-9_-]{1,112}$`, and the publish log names each one. Weekly ids are not checked | the pattern the live calendar route already enforces (`netlify/lib/router.mjs`, `eventCalendar`), less the 8 characters of `connect-`. Weekly ids never become a file name, and checking them could drop every weekly group. `live-events.mjs` reuses `mapEvents`, so the live API gets it too | delete `EVENT_ID` and its one check in `ops/connect-feed.mjs`, and the test "an event id that cannot be a calendar file name is left out, never written outside the site" |
| 13.10 | **The two records stand as audited**, `needs_validation` against the tree before 13.9; no verifier checked the fix | a verdict is about the tree it read; the report says the fix came after | a run 2 re-verifies both |
| 13.11 | **Not made: the third lead's fix**, a limit on stored uploads | it needs two choices only the owner can make, how many bytes and what a student sees at the limit. Every form with a file question ships closed | not made |
| 13.12 | **Not made: the hardening notes** (`REPORT.md` §6, 36) | none shows a boundary crossed, and each changes behaviour the owner or Connect relies on; a batch of unreviewed security changes overnight is a larger risk than the list | pick notes from §6 and make them |
| 13.13 | **An Exchange item, not a change**: `to-intranet/PUBLIC-EVENT-IDS-AND-SIGN-IN-2026-10-23.md` asks which characters an event id can hold (so 13.9 drops nothing real) and how Connect holds its half of sign-in | both are Connect's code; this run may only add files to `to-intranet/` and did not read Connect's repository | move it to `done/` with "withdrawn" as its reply |

Found: **0 confirmed, 3 needing validation, 2 rejected.** Two of the three open leads are the event-id pair that
13.9 closes in the source. The third is 13.11. Neither rejection needs anything.

Not covered: 5 of 30 units. Connect's half of sign-in is blocked on Connect (13.13). Four were deferred by the
critic (13.6). `REPORT.md` §1 names all five. The photo fetch code from item 4 is among them: it came after the hunt
and has not been reviewed.

Checked: the skill's validators, `PASS: 5 findings valid` and `PASS: 30 coverage units valid`. After 13.9,
`node --test test/connect-feed.test.mjs`: 11 of 11; `npm test`: 151 of 151; `node ops/check.mjs --browser`:
"everything passed, in the browser too" (289 text keys, 194 files read, 58 pages, 174 captures, 181 a11y checks).

**For the owner.** After the next publish, look in its log for `connect: left out event`. Each such line is an
event that Connect made public and the site did not show, because of 13.9.

**The queue is dry.** Every item left waits on someone outside this run:

| Item | Waits on |
|---|---|
| 1 | the owner's review of the design |
| 7 | the owner's yes or no to each listed image |
| 13 (#8) | a PDF of the form: Google answers 401 |
| 15, 16 | the owner's decision on editing pages, then Connect (`PUBLIC-SITE-EDITOR`, `-REVISIONS`) |
| 17, 18, 19 | Connect: the form switch, the outbox and backup, the team and wall exports |
| 21 | Connect: a moderation queue, and its resource viewer extracted as a public module (`MASTER-PROMPT.md` §8) |
| 22 | Q1, the owner's |
| 23 | the owner's yes to checking form state at the first keystroke (12.9) |
| 24, 25 | a deployed site or preview, and the live Connect |
| 26 | Programs |
| 30 | Connect's reply (`PUBLIC-EVENTS-RECENT`) |
| 31 | the owner's call |

## Closing

Read back between 22:44 and 22:50 CDT on 23 Oct, from the places that would show it, not from memory of the run.
The run began at 02:50 CDT (07:50 UTC).

| # | Decision | Basis | To reverse |
|---|---|---|---|
| C.1 | **Each "did not" rests on two reads**: the outside system's state, and the run's own tool calls counted from its transcripts | a host shows what is current, not what was tried: a draft deploy or a sent email leaves the current deploy and `HEAD` as they were | none needed |
| C.2 | **The mailbox read is given as a count only** | this file is pushed to a public repository, and the sent folder names real people | search Gmail for `in:sent after:2026/10/23` |
| C.3 | **Two dev servers left running**: both are Badger SPILL's, started 16 and 20 Oct from `badger-spill/` | not this run's, and not this repository's | stop them from the SPILL session |

**Not committed and not pushed.** `site/` is at `f6cd97f`, the owner's publish at 01:17, and GitHub's `main` is
the same commit. The reflog's newest entry is that commit, nothing is ahead of GitHub, and the 113 changed paths
are uncommitted. Because `site/` is level with GitHub, there is nothing to push by hand; the publish file commits
and pushes.

```
--- git --no-optional-locks -C site log --oneline -3
f6cd97f Public website: publish
d12f205 Public website: update for review
ed4ac3a Public website rebuild: prototype for review
--- rev-parse --abbrev-ref @{u};  rev-parse HEAD @{u}
origin/main
f6cd97fc1dd4e06e04b7ef1a134cb40a36924a9d
f6cd97fc1dd4e06e04b7ef1a134cb40a36924a9d
--- log --oneline @{u}..HEAD | wc -l
       0
--- reflog -5 --date=iso
f6cd97f HEAD@{2026-10-23 01:17:36 -0500}: commit: Public website: publish
d12f205 HEAD@{2026-10-20 17:51:47 -0500}: commit: Public website: update for review
ed4ac3a HEAD@{2026-10-20 13:54:20 -0500}: commit (initial): Public website rebuild: prototype for review
--- ls-remote origin refs/heads/main
f6cd97fc1dd4e06e04b7ef1a134cb40a36924a9d	refs/heads/main
--- status --short | wc -l
     113
--- ls site/.git/index.lock
ls: site/.git/index.lock: No such file or directory
```

**Not deployed.** Netlify's current production deploy of `badgersupports-public` is still the owner's publish of
`f6cd97f`, made from the command line 92 minutes before the run began.

```
--- get-projects "badgersupports-public"
"currentDeploy":{"state":"current","currentDeploy":{"id":"6adafc0ef2ba4733573cd5ec","state":"ready"}}
--- get-deploy-for-site 6adafc0ef2ba4733573cd5ec
"state":"ready", "title":"Website (f6cd97f)", "context":"production", "deploy_source":"cli",
"created_at":"2026-10-23T06:17:50.110Z", "published_at":"2026-10-23T06:18:30.195Z", "error_message":null
```

**No email sent.** The sent folder does hold 3 messages from the run's hours. The run called no Gmail tool that
sends, replies, forwards or drafts. Its one Gmail call was the read that produced this count (tool calls, below).

```
--- Gmail search_threads "in:sent after:2026/10/22", metadata only, 22:47 CDT
5 threads, no further page; 3 sent messages dated after 07:50 UTC on 23 Oct:
12:03Z, 12:03Z, 23:45Z (recipients and subjects withheld, C.2)
```

**No Google Form changed.** No form in Drive changed after the run began. The same search from 1 Sep returns
forms, so the query works; one of them is the recommendation form, last changed at 07:49:26 UTC (02:49 CDT), a
minute before the request that attached its PDF. The run has no tool that edits a form, and it used no browser.

```
--- Drive search_files: mimeType = form and modifiedTime > '2026-10-23T07:50:00Z'
{}
--- Drive search_files: mimeType = form and modifiedTime > '2026-09-01T00:00:00Z'
a page of 5 forms (more pages exist), among them
2026-10-23T07:49:26.985Z  LIVE Letter of Referral / Recommendation Submission
```

**The run's own calls.** Both sessions of the run and their 15 helpers, read from the transcripts at 22:50 CDT.
Every tool that reaches outside this Mac is a reader. A checker looked for any command that runs `git` add,
commit, push, merge, rebase, reset, tag, stash, checkout, switch or restore; runs `netlify` deploy, link, init,
env:set or db; or runs the publish file. It was tested first on 9 commands that do (all 9 caught) and 6 that only
mention them (none flagged). On the run it flagged one command. Read in full, that command is an `ls` that found
the publish file and a `grep` of its lines; nothing ran it.

```
2648 tool calls: Bash 1992, Read 372, Edit 144, Write 43, Netlify observability reader 27, Agent 15,
ToolSearch 14, SubagentHandback 14, WebFetch 10, Skill 4, Netlify project reader 3, Netlify team reader 2,
Drive search_files 2, CronCreate 1, WebSearch 1, ReadNotifications 1, Netlify deploy reader 1,
Gmail search_threads 1, Drive list_recent_files 1
--- commands that run git writes, netlify writes or the publish file
0   (1 flagged, read in full: f=$(ls "$P"/PUBLISH-WEBSITE-2026-10-23.command …); grep -n "deploy\|--prod…" "$f")
```

**Exchange: new files in `to-intranet/` only.** The run wrote five new files there and edited each only right
after creating it. It wrote nothing else in `Exchange/`. Three files in `done/` changed during the run's hours
(11:39 and 21:28); none of the run's write calls names them, so the other sessions made those changes.

| Made (CDT) | `to-intranet/` |
|---|---|
| 03:01 | `RECOMMENDATION-LETTERS-INTO-CONNECT-2026-10-23.md` (§1) |
| 11:33 | `PUBLIC-EMAIL-LIST-STATES-2026-10-23.md` (§6) |
| 12:21 | `PUBLIC-EVENTS-RECENT-2026-10-23.md` (§8) |
| 21:58 | `NETLIFY-DATABASE-AWAKE-2026-10-23.md` (§12) |
| 22:36 | `PUBLIC-EVENT-IDS-AND-SIGN-IN-2026-10-23.md` (13.13) |

**Left as found.** The site's dev server is stopped, and nothing listens on 8917. The last full check, at 22:38
after 13.9, passed in the browser too (§13, "Checked").

**For the owner, next:**

1. Read this log. Veto any decision you disagree with; its last column says how to undo it.
2. Read the audit, `~/security-audit-skill/badger-supports-public-site/run-1/REPORT.md`. One choice in it is
   yours: 13.11, how many bytes of uploads to keep and what a student sees at the limit.
3. Before the next publish: owner action 9 in `WORK.md` (Connect's Public Website List). Corrected after the run: this
   line first also said to give Connect's variables **Builds** scope. That was wrong; Netlify gives no secret to a
   build run on a laptop, so the 23:36 publish stopped, and the publish file now passes the key itself.
4. When you are ready, publish with `PUBLISH-WEBSITE-2026-10-23.command`. It checks, commits, pushes and deploys,
   and it ships the 113 uncommitted paths. Then look in its log for `connect: left out event` (13.9).
5. `WORK.md`, "Exchange", lists what is still open with Connect, including `PUBLIC-EVENT-IDS-AND-SIGN-IN` (13.13).

**Check, then the auto-continue job deleted.** `node ops/check.mjs` passed at 22:53 after this section was written
(exit 0, "everything passed"; WORK.md 179 lines). Then the hourly job that resumed the run was deleted:

```
--- CronList
7eadab8d — Every hour at :17 (recurring) [session-only], next run Oct 23 10:54pm: Auto-continue (Nicholas asked on 23 Oct 2026 that the overnight run resume by i…
--- CronDelete 7eadab8d
Cancelled job 7eadab8d.
--- CronList
No scheduled jobs.
```

**The run is finished**, 23 Oct 2026, 22:54 CDT. Its auto-continue job is deleted (above).
