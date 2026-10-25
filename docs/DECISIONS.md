# Decisions

Three kinds of entry, each labelled:

- **Owner**: Nicholas decided it. Dated, and quoted where the words exist. The newest dated ruling wins.
- **Rule**: inherited from a written rule of Badger Supports Connect or Badger SPILL, as the brief asks
  ("a family resemblance to Connect and SPILL").
- **Delegated**: this rebuild chose it because nobody had. Each one is a proposal; the owner can overturn it,
  and the last column says what that would take.

## 1. The brief, 19 Oct 2026 (Owner)

From `../../MASTER-PROMPT.md` §1. These came from Nicholas directly.

| Area | Ruling | Where it shows |
|---|---|---|
| Design | "Match the identity, improve layouts now." Keep the deep reds, with a family resemblance to Connect and SPILL. "Lots of trust will be lost if it looks like an AI slop site." | `DESIGN.md`; the tokens come from style.badgersupports.org and Connect |
| Public login | Bare bones: directors and admins see submissions from the forms they are authorised for. Visitors go to Connect for events. No member portal | `/staff/` signs in through Connect and shows the latest answers to a director (`netlify/lib/staff.mjs`); live once Connect's half is pushed |
| Editing | Through Connect. The public signed-in view is a reading surface with links to Manage in Connect. **Superseded for editing on 24 Oct 2026** (below, "Two answers, 24 Oct"): the editor stays on this site | every block declares its fields (`CONNECT-EDITOR-CONTRACT.md`); the editor is Exchange request `PUBLIC-SITE-EDITOR` |
| Form scope | Public forms are rebuilt here; internal workflows stay in Connect; SPILL's forms stay with SPILL | `COMMUNICATIONS.md` |
| Form controls | Closed forms are built too. Every form has an on/off switch and editable questions; an application must not open by accident | each form ships with a `state`; the database switch (`form_state`) wins; the staff application ships `closed` |
| Engagement | Research, recommend, and show a homepage prototype first | the homepage, then the pages below as the owner reviewed it |

## 2. Review rounds

### Round 1, night of 19–20 Oct 2026 (Owner)

> "I want get involved to be the big button, there is not a clear call to action in the design and alot of text.
> There should be clear pages for getting directions … There should be an option to add roms and directions"

- Get involved is the hero's one big button; "Drop in this week" was the quieter second link until the owner
  removed it on 23 Oct 2026 (below, "23 Oct: the live site").
- Rooms became records in `content/places/`, one file each. The build makes `/directions/` and
  `/directions/<id>/` from them. Adding a room means adding a record.
- Text was cut and the photo frames were dropped, after the owner said they "give off AI-vibes". Photos now sit
  in plain crops and circles.

### Round 2, night of 19–20 Oct 2026 (Owner)

> "this grid looks like slop … get rid of all of the empty spaces … Alot of the pages look very boring and very
> similar to each other."

- The hero is now a network of photo circles around "you", taken from the Support Networks workshop deck.
- Four workshop previews became small activities on the homepage, one per deck: network, bingo, choose and
  flip. Each still works as plain links without a script.
- Links and icons got a one-time animation when pressed or hovered (`src/styles/motion.css`), after SPILL's
  icons. Nothing replays on its own.
- Each kind of page got its own shape:
  - Get involved: doors on red.
  - The room list: tickets.
  - A room: a route beside a red card.
  - Forms: two columns.

### Round 3, night of 19–20 Oct 2026 (Owner)

> "Instead of no sign up, there should be a button that somebody can click that's like Drop In, that gies them
> direction to the student mental health hub"

- Every event in the week carries a **Drop in** link. A peer support group opens `/join/peer-support-groups/`;
  any other event opens its room's page.
- The peer support groups page says what a group is, in the live page's words, and then gives the Hub
  directions.
- The Instagram reel is a still with a Play button. Nothing loads from Instagram until it is pressed, and the
  CSP allows only that frame (`test/pages.test.mjs`).

### Round 4, 20 Oct 2026 (Owner)

> "The only place people can find us right now is the student mental health hub, the othe rlocations are just
> event rooms … Try to only have text that is currently on the website or some other badger supports material"

- Go links, door actions and Drop in share one cream pill style.
- `/directions/` leads with the Hub; the other rooms sit under "Event rooms".
- The hand mark carries its heart again. It is the brand's own `bss-hand-cream`/`bss-hand-red` file, the only
  versions that have one.
- Workshop text was cut to the decks' own wording, with fewer examples, and centred.
- The hero circles drift and the bubbles float, slowly, and not at all for anyone who asks for less motion.
  **This conflicts with a Connect rule** (section 3) and is listed in `../WORK.md`.
- The copy was replaced with live-site and deck wording wherever a match existed (`research/COPY-SOURCES.md`).
- A craft-nights event list was built from a fixture shaped like Connect's event cards, with a calendar file
  per event.
- Recent photos were picked from the shared Drive.

### Round 5, 20 Oct 2026 (Owner)

> "The craft night section and its colored bars are not used on connect, don't use them … this entire website
> needs to be photo centric"

- Every program hue and accent bar was removed (see "Colour" in section 3).
- The about pages were rebuilt: `/about/what-we-do/`, `/about/faq/` and `/about/our-team/`.
- The team comes from opt-in public profiles on Connect accounts. Until Connect's export exists, the prototype
  shows fictional people with monogram cards (Exchange request `PUBLIC-TEAM-PROFILES-2026-10-20`).
- Photos now lead the hero, the program sections, the Hub card, the workshops and Get involved.

Later the same day:

> "we want photos with faces in them. That is preferable, people need to be able to visualize being apart of
> Badger supports and attending an event"

> "Don't invent rules, these are allowed: name tags, QR codes, phone screens, and UW marks. If there are issues I
> will remove them. Allow all photos to be swapped out via link"

- Photos are picked on quality, and faces are wanted.
- This **overrides the web-design-system skill's floor of "no UW–Madison marks"** for this site. The rebuild
  adds no photo rule of its own.
- Every photo slot takes either a manifest id or an `https` link (`DESIGN.md`, "Photos";
  `test/media-links.test.mjs`).
- Owner action: confirm that the people pictured agreed to their photos being used (`../WORK.md`).

### Round 6, 20 Oct 2026 (Owner)

> "The craft night page feels uninspired like the entire thing is one page, it's not broken up well, nor is there
> a clear call to action. Try to look at what are some best practices and implement"

The page was split into sections:

1. A red event hero: the next night as a card with the page's big button (Drop in), Add to calendar as a quieter
   pill, and three photos.
2. What to expect, in the live What We Do wording.
3. The schedule, with the hero's night left out.
4. Recent nights as photos.
5. A closing call: the feedback form, with the email list as a pill.
6. The accessibility line.

The practice it follows, from practitioner sources read on 20 Oct 2026:

| Practice | Sources |
|---|---|
| One primary call near the top, repeated at the close | CXL; Smart Insights; WPForms |
| Date, time and place beside the call | prototypr, on recurring-event cards |
| Full-width sections whose headings carry the message | Framer; parachutedesign.ca; McGill's digital design toolkit |
| A "what to expect" section for first-timers | Eric Holscher's "Welcome Wagon"; MemberSuite; Associations Now; eventplanner.net |
| Full-width buttons in thumb reach on a phone | Conversion Sciences; Growthsuite |

### Round 7, 20 Oct 2026 (Owner)

> "I don't like this colored bar option, it isn't what we normally have."

The card in the owner's screenshot, the Hub with a green tint and a dark bar down its left side, was from an earlier
build. The Round 5 sweep had removed the program hues, but three plain bars down the side of an element were still
there. Each now uses one of Connect's own patterns:

| Element | Was | Now |
|---|---|---|
| The Hub card beside "drop in this week" | a filled block | a dotted edge on paper, as Connect's `.edge-dot` callout |
| A form's notice | a 5px ink bar on cream | a dotted box |
| A question with an error | a 4px red bar beside it | the control itself turns red, as Connect's `.ctl[aria-invalid]` |
| The "not therapy" note a program block can carry (none does yet) | a bar beside it | a quiet line under a dotted rule |

`test/pages.test.mjs` now fails on any solid side border or inset side shadow; it caught a bar put back on purpose.

### Three answers, 20 Oct 2026 (Owner)

Each was chosen from the options this session wrote in `../WORK.md`; the owner picked the recommended one each time.

| Question | Answer | Built |
|---|---|---|
| How do production builds get the Drive photos? | "Build on the laptop" | a build without an original stops before encoding and lists every missing one (`ops/media.mjs`; `DESIGN.md`, "Building away from the laptop") |
| Are the native forms open at launch? | "Closed, linking the Google Form" | `--launch`, and every `--production` build, closes each open form; its page shows its title and intro, then Fill Out Our Form as the page's big button, to the Google Form it replaces, in one centred column (`src/shared/forms.mjs` `launchForms`; `COMMUNICATIONS.md`) |
| The hero's drifting circles | "Add a pause button" | a Pause button beside the circles; it plays again on a second press (`src/client/hero.js`) |

### Three more answers, 20 Oct 2026 (Owner)

Asked after the owner compared every built page with the live site. The owner picked the recommended option for the
first and third questions, and answered the second without changing it.

| Question | Answer | Built |
|---|---|---|
| How should Our Team look? | "Mirror live grid": big red capital group headings with no clipart, four square photos a row, the role above and the name below in red | built 20 Oct: people still come only from Connect profiles (`src/render/blocks/team.mjs`, `test/team.test.mjs`) |
| May the room photos come from the live site? | "Yes, download from live": each file is listed for the owner's OK first, with its name, page and size | nothing downloaded yet; the 16 files are listed in `research/LIVE-IMAGES-2026-10-20.md` (9.6 MB); the Hub entrance photo is left out for its clipart figure and the LCM banner is flagged |
| What next? | "Restore dropped content": Peer Groups' day cards and activity photos; Get Involved's hiring steps as a list, the volunteer bullets and the Equal Opportunity line. Then Our Team | Peer Groups keeps the live page's order (the `cards` and `words` blocks); Get Involved's hiring steps, volunteer bullets and Equal Opportunity line are back. Activity cards show their icons until the live activity images are approved for download |

### Answers on photos and rooms, 20 Oct 2026 (Owner)

Asked after the room survey in `research/EVENT-ROOMS-2026-10-20.md`. The owner picked the recommended option for
the first two and wrote the third.

| Question | Answer | Built |
|---|---|---|
| The 16 live images listed for download | "Approve all 16" | all 16 saved to `local/media-originals/`, metadata only in `media/manifest.json`; room steps, the Hub's map and inside view, Peer Groups' day cards and activities, Get Involved's two photos |
| The LCM banner photo, with clipart-style figures on the banner | "Keep for now" | kept; swappable by link like every photo |
| The four draft rooms | "Hearing Room and Multipurpose room can use the Caucus room steps, edit the image of the map to show where the rooms are. Show addresses only for Marquee and Tripp" | all seven rooms published. Hearing and Multipurpose: the Caucus steps, each with its own copy of the floor plan, orange moved onto the room (`ops/room-map.mjs`). Marquee and Tripp: the address card alone, centred. A step photo keeps its own shape, so a map is never cut at its edges |

### Answers on the remaining pages, 20 Oct 2026 (Owner)

Asked after the 16 remaining pages were built. The owner picked the recommended option for the first and third,
and wrote the second. Little Hearts and Leadership were asked about once the rest was built (last row).

| Question | Answer | Built |
|---|---|---|
| The 27 recommended live images | "Yes, all 27" | all 27 saved to `local/media-originals/` (18.2 MB), metadata only in `media/manifest.json`, placed on 10 pages. The 10 left to the owner's call are not downloaded (`research/LIVE-IMAGES-2026-10-20.md`) |
| The four hidden live pages | "Rebuild SAC and University Square" | both built at their live addresses and left out of the menu, as live, with the new `directory` block. Little Hearts and Leadership were asked about next (`research/ROUTES.md`) |
| Connect's 86 resource records, with directors@badgersupports.org as the list's "email us" | "Approve it" | recorded. The list stays marked a sample until a director approves the records in Connect; the five live entries Connect lacks still wait (`research/RESOURCES-VIEWER-2026-10-20.md`) |
| Little Hearts and Leadership | "Redirect both" | a 301 each: Little Hearts to the Hub (`/directions/sac-mhh/`), where the hearts are picked up; Leadership, which said only that recruitment is paused, to Get involved. No live address is left without an answer (`research/ROUTES.md`) |

### The live site, 23 Oct 2026 (Owner)

> "I don't need it to be a protype for review, have it be the lvie site, I want it to be actually connected to
> Connect. Also get rid of the Drop in this week button, as well as all events on badger supports connect."

> "I also want the entire thign to be more cohesively designed … look at the lessons of Badger SPILL to see how
> thign should go. I also want more color in palces, peer support gorups should be green, craft nights should be
> purple."

- **Connected to Connect.** The production build reads Connect's public events and approved resources when it
  runs (`ops/connect-feed.mjs`, `content/connect-feed.json`, `test/connect-feed.test.mjs`). An event shows only
  if a director ticked it in Connect, Admin › Resources › Public Website List. If Connect cannot be read, nothing
  is built, so the deploy already online stays.
- **The live build.** `netlify.toml`'s production context runs `--production`: no prototype notice, pages
  indexable, a real `robots.txt` and sitemap, and the forms closed with a link to each Google Form, as the launch
  ruling of 20 Oct says. The Wall of Support and the team have no Connect export yet, so the live build shows
  neither the notes nor the fictional people.
- **Removed:** the hero's "Drop in this week" link and the "All events on Badger Supports Connect" link under the
  timetable. "All events on badger supports connect" was read as that link, not as an instruction to delete
  events; nothing in Connect was touched. To put either back, restore its entry in `content/pages/home.json`.
- **Colour** supersedes Rounds 5 and 7 for the two programs: peer support groups are green and craft nights
  purple. Round 7's "no coloured bar down any side" still holds; the colour goes in fills and tints.
- **Design**: SPILL's lessons (`DESIGN.md`, "Lessons from Badger SPILL") applied across the pages.

### Two answers, 24 Oct 2026 (Owner)

Asked at the start of the run in `OVERNIGHT-RUN-2026-10-24.md`, as tappable questions.

> Edit text: "It's approved here, I also want it to be expanded, the current edit features seem super limited,
> and I don't think it actually publishes? Try to have it be more similar to the SPILL editing, with the ID
> system. It seems really limited and beginner like comapred to the other editing systems."

> Retries: "Limit to own forms (Recommended)".

- **The editor stays on the public site** and grows toward Badger SPILL's: each word shown with its permanent
  key, every word on the page listed, drafts, publish as a numbered version, history and restore. This supersedes
  §1's "Editing: through Connect" for editing; Connect still holds who may edit and who may publish (`site.edit`,
  `site.publish`, set by a super admin, 20 Oct). Nicholas was right that saved words did not reach the live site:
  the publish file never read them (`OVERNIGHT-RUN-2026-10-24.md`, "The editor").
- **Retries are limited to the reader's own forms.** Opening the staff page sends nothing. Try again resends only
  the forms that person may read, checked on the server. A new submission still wakes delivery. No Connect change.

### The platform, 24 Oct 2026 (Owner)

From §2, "Decisions from Nicholas", of the prompt *"Public Website — Editable Publishing, Reliable Workflows, and Lean
Platform Growth"* (`PUBLIC-PLATFORM-PROMPT-2026-10-24.md`, in Nicholas's Codex outputs, kept unchanged). Nicholas asked
for it to be merged into the queue. It is queued, not built: `WORK.md` items 15, 16, 18, 20, 22, 23 and 33–39.

- **A permitted, valid save publishes**, with no second Publish step. Permissions, version history, conflict checks,
  restore and audit stay. Nobody gains `site.publish` this way, and a save approves no decision or bulk message.
  This replaces the separate publish step for permitted content, in "Two answers" above ("drafts, publish as a
  numbered version") and in §1.
- **Everything is editable**, both from Connect and from the live-site editor: words, links, media, forms,
  navigation, sections and layouts, and feature settings. A field left out is a listed gap, not fixed content.
- **Public events, resources and content may take up to 30 minutes to appear.** The page says so, and shows the last
  successful update. Authorised editors and directors get **Refresh now**. Visitors get the published copy.
- **A failed routine delivery is retried within 30 minutes**, without waiting for a visitor. Routine receipts and
  alerts may send by themselves. Decisions and bulk mail need a director's preview and explicit approval.
- **No new subscriptions**: no trials, upgrades, plan changes, auto-recharge changes or new vendor accounts.
- **Netlify Web Analytics** is reported as on. It is to be verified per project and in billing. It does not approve
  GA4 or any other collector.
- **No decorative coloured bars**: "the rounded red strip across the top of a white card". None in any colour, on
  any edge, on any page now or later.
  - This widens Round 7's "no coloured bar down any side" to every edge.
  - The first is `.form-head`'s `border-top: 8px solid var(--accent)` (`src/styles/forms.css:12`).
  - Colour that means something stays: focus, selected, status and charts.
  - It applies to this site only; the sibling projects are not restyled.

## 3. Rules carried over (Rule)

| Rule | From | Here |
|---|---|---|
| Colour: brand red and the neutrals, plus green for peer support groups and purple for craft nights (owner, 23 Oct 2026, superseding the sign-in round's "no ownership hue") | Connect design; the owner | the program hues are tokens; no coloured side bar (`test/pages.test.mjs`) |
| No text below 14 px | Connect design, type floor | gate 3 of `npm run check` |
| One main (filled) button per screen | SPILL row 132; Connect's card | `btn--big`, one per screen. Craft nights repeats its call at the close, a screen apart |
| Every visible word is editable | SPILL, 17 Oct 2026; and the owner here, 19 Oct 2026 | gate 1 (`editable`) |
| Solid rules and paper grain, one surface treatment per element; cards flat with a border, a ledge only on what can be pressed (23 Oct 2026, Badger SPILL's lesson; the rules were dotted until then) | Connect design, sign-in round; SPILL's `.card` | `--hairline`, `--rule-line`, the grain on `body`; `test/pages.test.mjs` |
| Nothing loops on resting content | Connect design, Motion | **broken on purpose** by the owner's Round 4 request: the hero drift and float loop (`src/styles/blocks.css`), with the Pause button the owner chose on 20 Oct 2026 (WCAG 2.2.2) |
| Real people never in the repository | SPILL, "Never"; this repository is public | fictional fixtures; the privacy gate |
| Fail closed when configuration is missing | SPILL, "Never" | `netlify/lib/db.mjs` answers 503 `config.missing` |
| Every route declares its access tier | Connect's backend practice | `netlify/lib/router.mjs` refuses to load an untiered route |

## 4. Delegated decisions (proposals)

| Decision | Why | To overturn |
|---|---|---|
| A static build in plain Node: no framework and no client bundle | the pages are content; less to maintain and audit; each page loads only the scripts its blocks declare | a rewrite of `src/render/`; the content files keep their shape |
| Node 22 or later | the current LTS line; `netlify.toml` pins it | change `NODE_VERSION` |
| One function at `/api/*`, with a tier on every route | same origin as the pages, so no CORS and room for a cookie session | `ARCHITECTURE.md` |
| PGlite locally and Netlify Database when deployed, running the same migrations | a local run is evidence about production (`netlify-backend-local-first`) | `netlify/lib/db.mjs` |
| A deploy that did not pack every migration stops before it publishes (Badger SPILL's guard) | the deployed API never migrates by itself; SPILL published code ahead of its database on 16 Oct 2026 | remove the `[[plugins]]` lines in `netlify.toml` |
| A block reads only the data it declares, any block may carry `startsOn` / `endsOn`, and a block may name its own stylesheet; the build stops on each breach | §10's contract held by the build, not by a reader; dates act at the next build (`WORK.md` item 29); four blocks' styles moved, the rest when next worked on (`OVERNIGHT-RUN-2026-10-23.md` §5) | `renderBlock()` and `COMMON_FIELDS` in `src/render/registry.mjs`; `blockStyles()` in `ops/build.mjs` |
| A strict CSP with no third-party script; the reel frame loads only on Play | the old site loaded Google's scripts on every page | `ops/build.mjs` `headersFile` |
| No Google Analytics in the rebuild yet | §9 asks for the exclusions to be enforced before any tag loads; that plan needs approval | `ANALYTICS.md` |
| Built pages end in `/`. An old address 301s only once its new page exists; until then links go to the live page | no dead links during a page-by-page migration | `ops/build.mjs` `redirectsFile` |
| A person's page is `/about/our-team/<slug>/`. The old group addresses 301 to the team page, and a member's own old address can be an alias | the group is a role that changes, and the slug is the member's own | `research/ROUTES.md` |
| The Hub is the one "find us" place; the other rooms are event rooms | the owner's Round 4 words, turned into a place `kind` | `content/places/*.json` |
| Drop in on a room with no directions page shows the room's name unlinked | a link that leads nowhere would break trust | `src/render/blocks/schedule.mjs` |
| Fonts are self-hosted, with their OFL licence | no request to Google Fonts; the CSP stays `'self'` | `assets/fonts/` |
| Photo originals stay in the gitignored `local/`, and the manifest holds metadata only. The Drive folder is named but never linked | the repository is public | `media/manifest.json` |
| Receipts are queued as held (`sender-unverified`) until a sender is verified; `directors@badgersupports.org` is the proposed sender | §7: Nicholas's own account is never the fallback | `COMMUNICATIONS.md` |
| The staff application ships closed, with its Fall 2026 message | an application must not open by accident | flip the switch in Connect once it exists |
| The letter of referral / recommendation form (`recommend.badgersupports.org`) ships closed, with Google's words; its contact question splits into a required email and an optional phone, and the letter is one PDF of at most 3 MB, other formats by email to hiring@ (23 Oct, unattended: every choice in `OVERNIGHT-RUN-2026-10-23.md`) | an application's pieces must not open by accident; the workshop request split the same question; the site checks PDFs only | `content/forms/recommendation-letter.json` |
| The resource request, the program request and the referral card survey (forms #1, #2, #4) ship closed, with Google's words and Google's required answers; owners Engagement, Programs and Programs; the pages keep linking the Google Forms until each opens (23 Oct, unattended: run log §3) | launch closed (owner, 20 Oct); Google's "COMM" and "PROG" titles and Connect's directorate pages name the owners | `content/forms/resource-request.json`, `program-request.json`, `referral-card-survey.json` |
| The mailing list (form #5) ships closed with Google's question and steps; its thank-you page says the request is received and the person is not on the list yet, and it sends no receipt; owner Executive (23 Oct, unattended: run log §6) | only the Google Group knows who is subscribed (`COMMUNICATIONS.md`, "The mailing list"); Google's form name starts "EXEC" | `content/forms/email-list.json`; Exchange `PUBLIC-EMAIL-LIST-STATES-2026-10-23` |
| One design, by Badger SPILL's lessons: heading bands with two waves, flat cards, solid rules, Title Case, styled empty states, motion under a second (23 Oct, unattended: decisions 2.17 to 2.25 in `OVERNIGHT-RUN-2026-10-23.md`) | the owner asked for the site to feel of a piece and to follow SPILL | each decision's own reversal in the run log |
| Between publishes, a page built from Connect asks `/api/events/<page>` for its event blocks, rendered by the build's renderer from Connect's list now and held five minutes by the CDN; its calendar buttons open `/api/calendar/<event>.ics`; when Connect cannot be read the published list stays (23 Oct, unattended: decisions 7.1 to 7.9 in `OVERNIGHT-RUN-2026-10-23.md`) | an event ticked in Connect shows without a publish, and nothing is deployed without the owner, as a scheduled rebuild would | drop the two routes in `netlify/lib/router.mjs` and `refresh` from the blocks |
| The four live resource pages become one `/resources/`, and each old address 301s to it with its topic | one list with search; the old addresses keep working | `content/routes.json`; `research/RESOURCES-VIEWER-2026-10-20.md` |
| A resource card's button says View Details when its label would call, text or email; the number or address stays on the card | the button always opens the record's web page, so a label that promises a call would mislead | `src/render/blocks/resources.mjs` |
| A number spelt in letters ("414-939-HOPE") dials each letter as its keypad digit | Connect's link keeps digits only and would dial six | `src/render/blocks/resources.mjs` |
| On a phone the resource topics are one sliding row, after the search | the list starts higher on a small screen | `src/styles/blocks.css` |
| The 988 Suicide & Crisis Lifeline entry gives 988, call or text (Connect's record), not the live page's old toll-free number | 988 is the number the Lifeline publishes | `content/fixtures/resources.json` |
| The featured event card, once its event has ended, stays at full strength and drops "Next up" | faded on the red band, its date turned pink and unreadable | `src/styles/blocks.css` |
| Press shows each article's outlet, title and date, without the live excerpts | the excerpts name real people, and this repository is public | `content/pages/press.json` |
| Alumni leaves out the live year-by-year list of leadership alumni | it names real people | `content/pages/alumni.json` |
| Behind the Workshop credits the 2025 to 2026 Programs Team, not the student who made each deck, and shows no portraits | they name and show real people | `content/pages/btw-*.json` |
| The ribbons' 14 causes are typed from the "Take a Ribbon!" card | the live page's list is a picture | `content/pages/ribbons.json` |
| A slide or a referral card is shown whole, never cropped: the call-to-action's `whole` field and the cards block's `whole` variant | a circle or a crop would cut the words in the picture | `src/render/blocks/cta.mjs`, `cards.mjs` |
| A building's or a block's directory is its own block, `directory`: groups in order, each place with its own name, address and link | a card has one link, and a floor of the Student Activity Center has up to four offices with their own | `src/render/blocks/directory.mjs` |
| Student Activity Center and University Square correct two live spellings: "Financial" (live: "Finanical") and "Milio's Sandwiches" (live: "Milo"), after the shop's own link and photo | they are typos | `content/pages/student-activity-center.json`, `university-square.json` |
| A page whose live form is a Google Form keeps linking it until its native form exists (alumni, email list, referral cards, ribbons, request a program, and request a workshop's volunteer training) | the native forms launch closed (Launch, 20 Oct 2026); a native form for each is queue items 12–14 | each page's `content/pages/*.json` |
