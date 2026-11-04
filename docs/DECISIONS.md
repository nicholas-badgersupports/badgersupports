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
| **Proposed 25 Oct 2026 (queue 34)**: a permitted save becomes the next numbered published revision, kept outside the database (Netlify Blobs deployed, memory locally) | the owner's "a save publishes" with no deploy loop and no database wake on a page view (`ARCHITECTURE.md`, "Publishing a save") | keep saves waiting for the edits file; delete `netlify/lib/published.mjs` |
| **Proposed 25 Oct 2026**: one page function renders every page from the build's renderer and the revision, cached by the CDN for at most 30 minutes, falling back to the build's file | the owner's 30-minute bound; P §4's "extend the existing full-HTML rendering"; no JavaScript needed to see a change | remove the function's lines from `netlify.toml`; the static pages answer again |
| **Proposed 25 Oct 2026**: Refresh now needs `site.edit` or `site.publish`, is JSON and same-origin only, six an hour per person and one a minute for the site, and purges only the `page` and `events` tags | the owner's "editors and directors"; never inferred from a title; bounded and targeted | change `REFRESH_*` in `router.mjs` |
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

## 30 October 2026 · shared sign-in rules (Owner; queued, not implemented)

The owner asked that the shared SSO-page rules and Public Website folder reflect the revised Google sign-in queue.
This supersedes password-first/help/password-setup requirements only for the future Google route; existing built
sign-in, authorization and password fallback remain until implemented. WORK item 20 is the queue, not a new tracker.

| Decision | Queued behavior and boundary | Source |
|---|---|---|
| Email-first Google; logo password override | Connect owns Google authentication and `public-sso.html`/shared `sso-door.js`. Exact wisc.edu/badgersupports.org emails hint account selection; Google may still prompt. Clicking the sign-in logo reveals the password route for this visit; Google off/missing configuration restores passwords. No public header-logo behavior, Google SDK/client or second account/password store is added here. Entered/verified returned addresses must already belong to the same active approved person; multiple verified Google subjects for that person are permitted. No new account, alias, merge, role or access. Signed audience/scopes/state/nonce/PKCE/return validation, grants and server checks remain; Google skips password-only setup/change gates in Connect's authorize/token/status paths. | Nicholas, 30 Oct 2026: passwordless default and clarified same-person matching; corrected the fallback to "just be able to click the logo"; requested updating shared SSO rules and this Public Website folder. Queue/rule changes only. |
| Shared optional sign-in quotes | Remove matching ordinary `/staff/` About Signing In help and Connect's warning/help. Connect Settings owns one quote list/visibility switch, bulk plain-text lines, safe rendering and once-per-load selection stable while typing; Public consumes the shared delivery and has no writable duplicate. Off/empty/unavailable shows no quote/help and never blocks sign-in. No approved starter library. | Nicholas, 30 Oct 2026: optional quotes, bulk entry and one shared list/switch; carried to the Public sign-in consumer under the shared-page ruling. |

Source correction recorded separately from the queued feature: on 30 Oct, Connect's local action and SIGNIN-PARITY
25 Oct record establish that `publicSsoStatus` is built locally. Production availability and a real Google SSO
round trip remain unverified; the existing flag stays the owner's. No application code, live setting or deploy changed.

**Built locally, 30 Oct 2026 (same day; not published).** The two queued rows above are built on this
site's side as `docs/ARCHITECTURE.md` "This site's half" records: help removed, Connect's quote shown, the session's
`method` kept and sent with the status check. Evidence is stand-in tests only (`test/staff.test.mjs`); no real Google.

**Live, 30 Oct 2026.** Published as `a78d13e`, with migration 007 and `CONNECT_SESSION_STATUS=on`, so switching Google
off in Connect now reaches staff sessions here at their next ten-minute check. It carried another session's tested fix
for Connect's resource timestamp, which the production build needed.

## 30 October 2026 · the team and the Wall (Owner)

His answers to the three questions at the end of the item 19 report, quoted. They settle the decisions Connect's
20 Oct replies to `PUBLIC-TEAM-PROFILES` and `PUBLIC-RESOURCES-AND-WALL` were waiting for.

| Question | Answer | Effect |
|---|---|---|
| May a public profile show a personal email, or only an @badgersupports.org one? | "@badgersupports.org or @wisc.edu" | `src/render/team.mjs` accepts both; any other address stops the publish |
| Who reviews public profiles, Wall of Support notes and public resource suggestions before anything goes public or changes? | "Resource-editing directors" | Connect's to build, for profiles and Wall notes (Exchange `PUBLIC-TEAM-PROFILES-2026-10-30`, `PUBLIC-WALL-OF-SUPPORT-2026-10-30`) and for item 21's suggestions |
| Consent words on the public-profile switch, and a release sentence on the photo upload? | "No words, stop having so much helper text" | neither carries consent or release text |


## 30 October 2026 · the resource reports (item 21; proposals, made in the session)

Report a Problem, Suggest an Update and Suggest a Resource are three anonymous native forms, built **closed**. Nicholas's
queue asked for Connect's Suggest an Update store rather than a second one, and his answer above names its reviewers.

| Call | Why | To reverse |
|---|---|---|
| The three are forms in the one intake (`content/forms/resource-*.json`), not a new endpoint | the intake already has the switch, the per-connection limit, the trap field, one row per press and the outbox to Connect | a dedicated route and outbox kind |
| Connect is asked to file them in `resource_suggestions` by form key, through `publicFormIngest` | one store and one screen for resource-editing directors; no new signing (Exchange `PUBLIC-RESOURCE-SUGGESTIONS-2026-10-30`) | Connect names another action; one call changes |
| They stay closed until Connect replies that its live site files them | Connect's `publicFormIngest` takes any form key, so an open form would land in Website Forms | open each with its switch, after the reply |
| A `resource` question type: one resource from the list the viewer shows, written in by the build (`withResources()`) | the form and the viewer offer the same resources; Connect receives the id and the name. Resource ids do not fit option ids | a short answer with the resource's name |
| The resource is chosen from the address (`?resource=`) by the page's script | a card's link opens its form with the resource chosen; without a script the person chooses it | drop `data-from-address` |
| Report a Problem and Suggest an Update sit in each card's Additional Details; Suggest a Resource is one link under the list | 172 more links on the cards would crowd them; every card has Additional Details | move the row into `.res-foot` |
| No contact question on any of the three | anonymous; "none of the three stores who sent it unless they chose to say" (20 Oct item); a director cannot reply | add an optional email question |
| Suggest an Update offers Connect's fields except Full Description, which the public card does not show; `act_url` stands for `actUrl` | option ids are lower case | add `long` |
| The three pages are not indexed and load no analytics | they carry anonymous reports | `noindex: false`, `analytics: "public"` |

## 30 October 2026 · before the switch (item 25; proposals, made in the session)

The checks, the blockers and the switch plan are in `SWITCH.md`.

| Call | Why | To reverse |
|---|---|---|
| Checked on a production build in the local rig, against a fake Connect | Deploy Previews are off, production answers 401, and a real build needs Connect's key | run the same checks on the live site after the switch |
| The switch changes only the `www` CNAME; the nameservers, the bare domain's forward and the 52 forwards stay | fewest records touched, and one record to set back | point the bare domain at Netlify as well |
| Mendota Lodge, `redirectFor()`, the www sign-in callback and public production are blockers in the plan, not fixed here | item 25 asks for checks and a plan; Mendota is the owner's call; a code change needs its own gate | fix them inside item 25 |
| Shortlinks that leave www are named by kind, not address | they open internal Docs, Sheets and Drive folders, and this repository is public | list their targets |
| Lighthouse ran behind a compressing proxy | Netlify compresses text and the rig does not | measure without the proxy |

## 30 October 2026 · redirects in the page function (queue item 3a; routine calls, made in the session)

Asked for by the owner on 30 Oct, answering item 25: `redirectFor()` learns the splat and the optional `/`, and Mendota
Lodge is retired with a 301.

| Call | Why | To reverse |
|---|---|---|
| Mendota Lodge's old address goes to `/directions/` | the old `/operations/directions/<room>` addresses go to their room under `/directions/`; with no Mendota page, the list of rooms is the nearest page that still helps | point its row in `content/routes.json` at another page |
| `redirectFor()` copies Netlify's matcher, case and all, rather than a looser rule | the answer must be the same whichever of `_redirects` and the page function Netlify runs first; checked against `netlify-redirector` 0.5.0, the matcher Netlify's command line uses | match without regard to case |
| A target's `:splat` is not filled in | no line uses one; the comment above `redirectFor()` says so | fill it in, with a test |
| The page function's own 301 that adds a final `/` sends the address back encoded | the cross-check found that an address with a letter outside Latin-1 and no final `/` (`/initiatives/ribbons-…x`) threw while building its header | send the decoded address, which throws again |
| No Connect deploy for the www sign-in address | the switch waits for Connect's team export, and that arrives with a Connect deploy; a deploy just for this costs 15 credits | press Trigger deploy on Connect's project |
| The owner's steps are double-click files in `../../SWITCH-SETUP-2026-10-30/` (laptop only) | three of the steps are his, two in Netlify's pages | follow `SWITCH.md` by hand |

## 30 October 2026 · the docs pass and malformed addresses (queue item 4a; routine calls, made in the session)

Asked for by the owner on 30 Oct, answering the item 3a report: correct each document that disagrees with the code, and
answer a malformed %-escape with the 404 page.

| Call | Why | To reverse |
|---|---|---|
| A malformed address keeps its redirect lines; only the page and the slash 301 are refused | Netlify's matcher (`netlify-redirector` 0.5.0) still sends `/about/our-team/directors/%E0/` to its group and matches nothing else; the rig now agrees on all 60 malformed forms tried | skip `redirectFor()` too, and the team catch-alls answer 404 where the page function runs first |
| Migration `001_intake`'s stale comment is left as it is; `ARCHITECTURE.md` § Migrations says so | an applied migration is a record of what ran; whether Netlify checks its bytes on a later deploy was not checked | edit the comment, after checking that |
| Line numbers in `ANALYTICS.md` and `COMMUNICATIONS.md` became names (`announce()`, `idem_key`, a test's title) | most had moved; a name survives an edit above it | write line numbers again |
| The lists of form keys and `none` blocks in `ANALYTICS.md` point at their source | each had fallen behind the code (three keys of twelve, two blocks of six) | list them again by hand |

## 30 October 2026 · team profiles on by default (queue item 4c; Owner, then routine calls made in the session)

His answers, given with buttons, quoted. For profiles they replace "Resource-editing directors" as the reviewer in "the
team and the Wall" above; Wall of Support notes and resource suggestions keep that answer. Sent to Connect as Exchange
`to-intranet/PUBLIC-TEAM-PROFILES-DEFAULT-ON-2026-10-30.md`.

| Question | Answer | Effect |
|---|---|---|
| Who is included by default | "Everyone, each can opt out, all student supporters either have to opt in to be dispalyed, or if they hold anothe rrole at Badger Supports they should opt in to display their student supporter status" | Connect's to set: a profile is in `publicTeam` with `published: true` unless its owner turns it off. The reader is unchanged; it counts only `published: true` (`mapTeam`) |
| Approval | "No approval, there is a notification in admin of changes that were made" | no approval step; Connect's Admin notification of changes is the oversight |
| Notice to members | "No notice" | nothing is sent before the team page turns on |

| Call | Why | To reverse |
|---|---|---|
| `team.none` reads "Profiles of our directors, staff and volunteers will appear here." | the old sentence said each person chooses to share theirs, and profiles are now shared unless turned off | restore the old text in `content/text.json`, run `node ops/contract.mjs`, drop the test's choice assertion |
| The website does not check Student Supporter status itself | `bss.team/1` has no field for that choice; the amendment asks Connect to name one | add the check to `mapTeam` once Connect names the field |
| "opt-in" is taken out of the docs, notes and comments that describe the team now; the 20 Oct record in § 2 is left as written | a dated record says what was decided then | put the word back |

## 30 October 2026 · the form switch (queue item 5, WORK item 17; Owner, then routine calls made in the session)

His answer, given with a button on 30 Oct: the open/close switch lives on the website's staff page (`/staff/`), and
Connect's "Who May Do What on the Website" grants who may use it. Sent to Connect as Exchange
`to-intranet/PUBLIC-FORM-SWITCH-GRANT-2026-10-30.md`. The "34 passing tests" in item 17 is Connect's count from
`PUBLIC-SITE-FORMS` (20 Oct), not this suite's.

| Call | Why | To reverse |
|---|---|---|
| The scope is `forms.switch:<key>`, with `forms.switch:*` for every form | matches `forms.read:<key>`, and `can()` already reads `kind:*` | rename it in `router.mjs`, `answers.mjs` and the Exchange item |
| Every Open asks a second time, not only an application's; the server refuses Open without the form's key as `confirm` | the 20 Oct design asks it of applications, and one rule cannot miss a new application; Close stays one press | ask only for forms in Connect's hiring queues |
| A switch row drops the launch build's Google Form link | a form a director closed is not taking answers; pointing people at a Google Form nobody may be watching loses them silently | keep `elsewhere` in `currentForm()` when the row says closed |
| The page function reads the database for pages that show a form's state (5 form pages, Home and Get Involved), fresh each draw | a value held in one instance could be drawn into a page the CDN then keeps for 25 minutes | hold it, and accept the lag |
| Someone who may switch a form but not read it sees its title and switch, no counts | counts are about answers, which their role does not read | show counts to switchers |
| The row records the Connect id, not the name | an id does not change; Connect maps it to a person | store `who.name` beside it |

## 31 October 2026 · pages: drafts, preview, restore (queue item 6, WORK item 16; Owner, then routine calls made in the session)

His answer, given with a button on 31 Oct, to "A save already publishes at once. So what should a draft be?": **"New
pages only"**. A new or copied page stays hidden, previewable at desktop and phone width, until someone with publish
rights puts it on; edits to live pages keep publishing on save. How it is built: `ARCHITECTURE.md`, "Pages: drafts,
preview, restore". The 20 Oct Exchange item `PUBLIC-SITE-EDITOR-REVISIONS` asked Connect to build this; Connect
declined it then, and the editor has since moved to this site (24 Oct, above), so this site built it.

| Call | Why | To reverse |
|---|---|---|
| `site.edit` adds and copies drafts, previews, and changes titles, search descriptions and a draft's address; `site.publish` puts a page on, retires a live page, moves a live page, changes the menu and brings back a version | the charter's "do not widen access by default": anything that changes what visitors can reach stays with the higher grant; no new scope, so Connect's grant screen needs no change | `scopeFor()` in `netlify/lib/structure.mjs` |
| Every structure version and every published revision is kept; the staff page lists the newest 50 | his "archive, never delete" rule; the edit history already keeps every row | nothing to reverse; a retention limit would delete rows in `site_structure` and keys `revisions/<n>` |
| A retired page answers a 301 to a page the publisher names, or the 404 page; its id and addresses are never given again | the 20 Oct item: "never a different page under the same id"; old links keep landing | `layStructure()` and `newPath()` in `src/shared/structure.mjs` |
| A moved page's old address answers a 301 to the new one | printed and shared links keep working | drop `oldPaths` from the move in `applyChange()` |
| Restoring a version retires a page made since it, rather than dropping it | an id is never given twice; nothing is deleted | `restoredDoc()` in `netlify/lib/structure.mjs` |
| The home page, the 404 page, the staff page, rooms, people and form previews cannot be copied, moved or retired here | the site cannot do without the first three; the rest are drawn from their own records | `FIXED_PAGES` and `changeable()` in `src/shared/structure.mjs` |
| A copy's blocks get new ids (`b-<page>-<n>`); a block with no anchor keeps its old id as its anchor | the 20 Oct item: ids are never reused; the page's own `#` links keep landing | `copyBlocks()` |
| `frame-src` gains `'self'`, so the staff page can frame the preview; only the preview answer allows framing (`frame-ancestors 'self'`) | a preview at two widths needs a frame; every other answer keeps `frame-ancestors 'none'` | drop `'self'` from `cspHeader()` and open the preview in a tab only |
| Each structure change clears every page and feed (`page`, `events`) | the menu is on every page, and a 404 answer for a new page's address is cached under `page` | narrow `publishAll()` in `router.mjs` |
| The edits file a build downloads leaves out made pages' words | a build does not know those pages; they live in the published revision | `editsFile()` in `netlify/lib/edits.mjs` |

## 31 October 2026 · sections within a page (queue item 7, WORK item 15, first slice; routine calls made in the session)

The rest of P2 starts with sections: add, copy, reorder, retire and put back, on the staff page, saved live like a page
change. His 31 Oct answer for pages ("a draft is a new page only; edits to live pages keep publishing on save") decides
that a section change on a live page publishes at once. How it is built: `ARCHITECTURE.md`, "Sections within a page".

| Call | Why | To reverse |
|---|---|---|
| `site.edit` adds, copies, reorders and puts back a section; retiring one from a live page takes `site.publish`; on a draft `site.edit` retires | a section is words on a page, as a save is; taking content off a live page mirrors retiring the page; no new scope | `scopeFor()` in `netlify/lib/structure.mjs` |
| A new section is a Text section with its heading and words typed in the form; any other kind comes by copying one that exists | a live page publishes on save, so a new section can carry no placeholder words; the edit-layer rule: structure changes clone, they do not invent layouts | `sectionAdd` in `sectionChange()`, `src/shared/structure.mjs` |
| Only sections drawn from their own words copy (no data source, no script: announcement, text, questions, what to expect, call to action, photo cards, word cloud, directory) | a copy of an events, form, team or resources section would draw the same records twice, and some carry scripts that expect one per page | `copyable()` |
| A copy gets `<id>-c<n>` and every id inside it gets `-c<n>`; its anchor is dropped | ids are never given twice; questions, cards and directory groups draw their ids into the page | `copySection()` |
| A page's opening keeps its place and is not copied or retired | the page head is the page's title and first words; a page without one reads as broken | `isOpening()` and `HEADS` |
| A section that a link on the site lands on is refused retirement, naming no link; the editor changes the link first | a retired section would leave the link landing on nothing (edit-layer: hide the references with it) | `linkedTo()` |
| A retired section keeps its record and comes back with Put back where it was | his "archive, never delete" rule; the page menu's "taken off, only back by Restore" gap is not repeated | `sectionBack` and `withRetired()` |
| The 404 page and the staff page keep their sections; the home page's may change | the home page is the page most edited; the other two are the site's own workings | `SECTION_FIXED` |
| Restoring a version keeps a section made since as retired | an id is never given twice, so its history never attaches to another section | `restoredDoc()` in `netlify/lib/structure.mjs` |

## 31 October 2026 · stale words after a save (queue item 8; routine calls made in the session)

His item of 31 Oct: the edit button could put old words back into the cache. Two causes, both fixed. Each running copy
of the page function held the published revision for a minute, so after a save cleared a page, a copy holding the old
revision could draw the old words into the CDN for up to 30 minutes. And a save of a word on one page cleared that
page but not its event answer (`/api/events/<page>`), which the page's script swaps in, words and all, and the CDN
kept for up to 15 minutes. How it is built: `ARCHITECTURE.md`, "Publishing a save", "Every cache".

| Call | Why | To reverse |
|---|---|---|
| The revision is read from the store at every draw; no running copy holds it | a held revision outlives the clearing and is drawn into a page the CDN keeps 30 minutes (Admin log ADM-448); the read happens only on a CDN miss | put a hold back in `currentRevision()` in `netlify/lib/published.mjs`, and accept that lag |
| A page's event answer carries `events:<page>` beside `events`; a save of a word on that page clears `page:<page>` and `events:<page>` together | the answer carries the page's saved words; clearing every feed for one page's word would ask Connect again for every page | drop the tag in `eventsPage()` and the second entry in `tagsFor()`, `netlify/lib/router.mjs` |
| Every page-word save clears `events:<page>`, whether or not the page has event blocks | clearing a tag nothing carries does nothing; one rule needs no list of which pages have events | narrow `tagsFor()` to the pages in `serverContent().events.pages` |

## 31 October 2026 · a menu entry put back (item 15, second slice; routine calls made in the session)

Before this, an entry taken off the menu came back only by restoring an earlier version: the Menu part listed the
entries on the menu and the server refused any other. How it is built: `ARCHITECTURE.md`, "The menu".

| Call | Why | To reverse |
|---|---|---|
| Put Back returns an entry to the end of its own group, not to the place it held | the menu stores an order, not where an entry once stood; at the end it is seen at once, and Up and Down then place it | `putBack()` in `src/client/staff.js` |
| A made entry records the group it was put on the site in (`entries[id].group`) | the Menu part moves an entry within its level only, so without it a made entry could not get back into its group | drop `group` in the `publish` case and in `offMenu()`, `src/shared/structure.mjs` |
| A group taken off comes back with its entries that are off, listed once, inside it | a group with no entries draws nothing (`layMenu()` drops it) | `offMenu()` |
| An entry whose page is a draft, retired or gone is not offered, and the server refuses it | putting it back would draw nothing, or a link to the 404 page | `link()` in `offMenu()` |
| Put Back changes the list in the browser; Save the Menu publishes it | one save for the menu, one version and one clearing, as Take Off already works | send `menu` from `putBack()` |

## 31 October 2026 · the site's settings (item 15, third slice; Owner, then routine calls made in the session)

His rulings of 31 Oct: the site's name, search description and accessibility email become editable live by a
publisher (`site.publish`) on the staff page; the addresses and the language stay a change in the files. Every page
title gets the name when the page is drawn (first on the home page, last on every other); the description is the home
page's and the starting description of a page made on the staff page; the email is the footer's accessibility
address. How it is built: `ARCHITECTURE.md`, "Site settings".

The description the home page carried in `content/pages/home.json` ("Free, student-led peer support groups, craft
nights and wellness workshops at UW–Madison.") moved into `content/site.json`, so the home page draws the same words
as before. The text `site.json` held, which no page drew, is retired: "Badger Supports is a student-led peer support
community at UW–Madison: drop-in peer support groups, craft nights and wellness workshops."

| Call | Why | To reverse |
|---|---|---|
| The settings live in the structure document, changed by the action `settings` through `POST /api/staff/pages`, `site.publish` for draft and live alike | one version, one conflict check, one history and Restore for everything the staff page publishes; every page's title and footer change, so it is a publisher's | `scopeFor()` in `netlify/lib/structure.mjs`; drop `settings` from `PAGE_ACTIONS` in `router.mjs` |
| A settings change clears `page` and `events`, and Restore brings back the revision's settings | every page's title and footer change; a version is the whole site as it was | narrow `publishAll()` in `router.mjs`; drop `settings` in `restoredDoc()` |
| Titles are stored without the name (34 page files, three text keys, pages made on the staff page) and `pageTitle()` adds it when a page is drawn | a change of name must reach every title; with nothing saved every page draws its title as before (`settings-build-identity`) | put " — Badger Supports" back in the files and keys, and `pageTitle()` returns `page.title` |
| A title ending " — " and the build's or the current name has it taken off before the name is added (the home page: a leading "<name> — ") | a page made before this, and a title line saved with the edit button, still carry the name; it is drawn once | `bareTitle()` in `src/shared/structure.mjs` |
| The home page draws the site's description; `home.json` holds none | one place for the words search engines show for the home page | put the line back in `home.json` and have `pageDescription()` in `layout.mjs` return `page.description` |
| The name: a page title's check, at most 60 characters, no "—"; the description: a page description's check, and it may be empty; the email: one address, lower-cased, ≤ 254; any other field, or none, is refused 422 | the dash is what joins the name to a title, so a name holding it could not be told from a title; the brief's limits | `SETTING_CHECKS` and `settingsChange()` in `src/shared/structure.mjs` |
| A save of some settings keeps the others saved | the staff page saves all three at once, but the server takes fewer | `settingsChange()`: replace instead of merge |
| A saved setting is checked again when laid; one that fails keeps the file's value | as a saved word is checked again when laid (`valueProblem`) | `laySettings()` |
| Pages the API draws itself (no-script form replies, the mood reply, a sign-in failure, the error page, an event gone) draw the published name and address too, from the revision; when it cannot be read, the file's. The mood, sign-in and error pages had no name in their titles before | "every title"; a page about a failure still draws | `renderContext()` and `settingsNow()` in `router.mjs` |
| Footer words with no address draw a space, then the address linked; words that already hold the current address are split on it | the words stay as typed with the edit button, and the address is never drawn twice | `accessibility()` in `layout.mjs` |
| The header's wordmark, the other lines that name the site, the calendar files' `PRODID` and the five page files that hold the accessibility address stay as written | the wordmark is a word for the edit button; the rest are words and links of their own; `PRODID` names the program that wrote the file | none needed; each line changes with the edit button |
| The pages list carries `site` (the three as drawn now) and `settings` (only the keys saved) | the Site Settings part fills its fields from them | `pagesList()` in `netlify/lib/structure.mjs` |
| Site Settings sits after the menu, in the pages part, shown only with `site.publish`; one Save Settings sends all three with a version token; a refusal shows in the part's own box above its fields and keeps what was typed | the menu's pattern, with the refusal where the button is; nothing typed is lost | `settingsPart()` in `src/client/staff.js` |
| A stale settings save is refused 409 with the version now and the three settings as saved at it (`site`). The fields keep what was typed; under each field whose saved value differs from what the fields started with, "Saved since you opened this page: …" (an empty one as "(none)"), and the part says someone saved settings since. Only then does the part's token move to that version, so Save Settings again is a knowing replacement, and a save that lands clears the lines. Replaces the first build's behaviour, in which the pages' conflict words showed and the next press silently saved over the other person's values | his item of 31 Oct: the pages' message was false here, and a second press overwrote values nobody had seen | `stale()` in `changeStructure()`, `netlify/lib/structure.mjs`; `saveSettings()` in `src/client/staff.js` |
| The settings part keeps its own version token beside the pages part's, with the values it stands for. A list drawn again moves it only when its settings are those values; a 409 whose settings are already seen, or back to what the fields started with (another part's change), is sent again once with the new token | one shared token moved by a settings refusal would make the pages list look current when it is not; a refusal with nothing new to show would only ask for a second press | `seen`, `syncSettings()` and the `again` retry in `saveSettings()` |

## 31 October 2026 · rooms' words and photos (item 15, fourth slice; Owner, then routine calls made in the session)

His answer of 31 Oct, given with a button: a publisher changes each room's **words and photos**: name, short, building,
where, address, each step's text and each step's photo, and the note. Adding or taking down a room, its id, aliases,
published flag, links, and the number and order of its steps stay a change in the files. How it is built:
`ARCHITECTURE.md`, "Rooms".

| Call | Why | To reverse |
|---|---|---|
| `site.publish` only, for the list (`GET /api/staff/rooms`) and every room change | his question asked what a publisher may change; access is not widened to `site.edit` by default | `scopeFor()` in `netlify/lib/structure.mjs` and `roomsRoute()` in `router.mjs` |
| The words live in the structure document (`rooms`), changed by the action `room` with the version token: 409 when stale, a new `site_structure` row, the next revision, `page` and `events` cleared; Restore brings them back | one version, one conflict check, one history and Restore for everything the staff page publishes; a room's words show on its page, the list of rooms and every event held there | drop `room` from `PAGE_ACTIONS` in `router.mjs`; narrow `publishAll()` |
| The saved words are laid over the room records before anything draws a room: the page function (`composeSite`), `/api/events` and `/api/calendar`; the build never lays a revision | every place a room's name or address shows follows it; with nothing saved every page is the build's | `layRooms()` in `src/shared/structure.mjs`; its callers in `src/render/site.mjs` and `netlify/lib/live-events.mjs` |
| Limits: name and building 80 characters, short name 60, where in the building 120, address 200, note and a step's words 600; each also checked as a saved page word is | the longest values in the files are a note of 119 characters and a step of 114, a name of 25; the name and short name sit in headings and cards, so they stay short | `ROOM_LIMITS` and `STEP_TEXT_MAX` in `src/shared/structure.mjs` |
| A step's photo is a library photo (the edit button's photo check) or none; a link is refused | the photo is drawn at its own shape, so a map is never cropped; a link would need the laptop's build to fetch it | `stepPhoto()` |
| A room's own photo, arrival photo and kind stay in the files | his list names each step's photo only | add them to the fields `roomChange()` takes and `roomFields()` shows |
| A note can be added or changed, not emptied | an empty word is refused, as on a page; taking a note away is a change in the files | allow "" for `note` in `roomChange()` and draw no note for it |
| An unknown room is refused 422 (`room.unknown`), an unknown step `room.step`, any other field `room.field`, a step order among them | the ruling keeps a room's shape in the files; the brief asked 422 for each | `roomChange()` |
| Only the fields that differ from the room as last known saved are sent and kept; a later save of one field keeps the others | a field nobody changed keeps following the file | `changed()` in `src/client/staff.js`; `roomChange()` merges |
| Rooms is its own part after the pages, one room open at a time, with its own version token and the values it stands for; a stale save shows under each changed field what was saved since, the token moves only with those lines, so Save Room again is a knowing replacement; a 409 with nothing new is sent again once | Site Settings' pattern (ADM-458); one shared token would make the pages list look current when it is not | `roomsSection()` in `src/client/staff.js` |
| A step's photo is a labelled choice of library photos with a small picture of the one chosen | the edit button's photo control is a typed id with no picker to call | `roomForm()` |
| A room saved redraws the pages list, so the pages part's token stays the newest | otherwise the user's next page change would be refused as someone else's | `pagesChanged` in `src/client/staff.js` |
| The line under a changed field reuses Site Settings' words ("Saved since you opened this page: …", "(none)") | one fact, one place to edit it | give Rooms keys of its own in `content/text.json` |

## 2 November 2026 · the gaps item 8 left (queue item 9; routine calls made in the session)

His item of 31 Oct, given with a button: all three gaps item 8 left. A copy that read the revision just before a save
could still answer after the save's clearing; Refresh now dropped Connect's list in the copy that took it only; and the
browser kept a page's event answer a minute. How it is built: `ARCHITECTURE.md`, "Every cache" and "Refresh now".

| Call | Why | To reverse |
|---|---|---|
| Every publish clears its tags a second time 5 seconds after the first: a saved word, a pages change (settings, rooms, the menu, sections), a restore and Refresh now | the race is the same for every publish; Netlify's synchronous limit is 60 seconds and `waitUntil` work runs inside it and is billed as run time (Netlify docs, Functions API and Functions configuration, read 2 Nov), so a short pause covers ordinary draws for little run time | change `SECOND_CLEAR_MS`, or call `purgeTags` for `clearTags` in `router.mjs` |
| The second clearing runs only where Netlify gives `waitUntil` | a local server has no CDN to clear, and without it the work could outlive the function unseen | call `afterReply` without the `waitUntil` check in `clearTags` |
| A form's switch clears once | the item names saves; the server goes by the switch at every send, so a stale page cannot let an answer in | use `clearTags` in `formSwitch` |
| Refresh now writes a new token beside the revision; a copy compares its held list's token at every events answer and calendar file | one read of the store per answer the CDN did not already hold; a token is equal or not, so no copy's clock matters | drop `forgetToken()` from `eventsNow` and call `forgetEvents()` in `refreshRoute` |
| When the token cannot be read, a copy uses the list it holds | asking Connect on every answer while the store is down would load Connect; the same store holds the revision, so Refresh now reports it as `publish.unavailable` | treat an unreadable token as changed in `eventsNow` |
| The browser keeps no event answer and no calendar file (`Cache-Control: public, max-age=0, must-revalidate`); the CDN's five minutes and half a minute stand | the item names the event blocks; the calendar files share the constant, and a saved room name reaches them too | give `eventCalendar` its own `cache-control` in `router.mjs` |

## 2 November 2026 · the publish file installs what the lockfile names (queue item 11; routine calls made in the session)

His item of 31 Oct, given with a button. The publish file copied the laptop's `node_modules` into each deploy and never
installed (Admin log ADM-461), so a dependency change reached a deploy only by hand; and its first step stated a time
estimate. How it is built: `ARCHITECTURE.md`, "The pieces" and the paragraph under it.

| Call | Why | To reverse |
|---|---|---|
| The comparison is a script in the repository (`ops/deps-match.mjs`), tested with the gate; the publish file calls it | logic in a `.command` file outside the repository is tested by nothing | put the comparison inline in the publish file |
| It reads each installed `package.json` against `package-lock.json`, not npm's own record (`node_modules/.package-lock.json`) | the installed files are what the deploy copies; npm's record does not see a hand-changed folder | compare with `node_modules/.package-lock.json` |
| A package the lockfile marks optional may be absent; installed, it must be the locked version; anything extra at the top of `node_modules` is a difference | npm on the Mac left out `@img/sharp-wasm32`, `@emnapi/runtime` and a nested `pglite`, which the lockfile gives no `os` or `cpu` and which npm on Linux installed, so a rule built from the lockfile's `os` and `cpu` would have run `npm ci` on every publish and then stopped; a leftover package would ship in the deploy | require optional packages in `depsDiffer()`, or drop the extras loop |
| It installs with `npm ci`, only when the comparison finds a difference, and stops when the result does not read back as matching | `npm ci` installs exactly the lockfile and removes anything else; skipping it when nothing differs keeps a quiet publish quiet | run `npm ci` on every publish |
| A failed `npm ci` stops the publish before the checks; the folder it half-emptied is reinstalled by the next run | nothing is saved, sent or put online with a broken folder | none needed |

## 2 November 2026 · the build names event types the rules do not (queue item 12; routine calls made in the session)

His item of 2 Nov, given with a button: "the build warns by name when Connect uses an event type that
content/connect-feed.json does not name". Such an event fell to Other with no word in the build's log, which hid a
craft night (item 4b). How it is built: `ARCHITECTURE.md`, the paragraph under "The pieces".

| Call | Why | To reverse |
|---|---|---|
| Every production build prints one warning line per unnamed type, with the count, the program each event was shown as and the event ids; the build's log gets the same lines | a line behind `--verbose` is the silence the item names; the ids let a reader find the events in Connect | print them only under `--verbose` in `ops/build.mjs` |
| An event its series placed is listed too | the type is still unnamed, and the next event of that type may have no series | list only the events shown as `otherProgram` |
| It warns and builds; it never stops the build | the events still show, as Other; stopping would keep a whole publish back for one label | throw in `build()` when `unnamed` is not empty |
| A type is cut to 40 characters, and an empty one reads "(no type)" | the line is for a person; Connect's ids are short | change `slice(0, 40)` in `mapEvents()` |

## 2 November 2026 · Put Back for a retired page (queue item 13; routine calls made in the session)

His item of 2 Nov, given with a button: "a retired page can be put back without undoing later changes, as menu entries
can". Retire had no inverse: a retired page's card offered Copy only, and Restore brought it back only with every later
change undone. How it is built: `ARCHITECTURE.md`, "Put Back".

| Call | Why | To reverse |
|---|---|---|
| Put Back returns the page to the state it was retired from, recorded by Retire from now on | it undoes the retirement and nothing else, as Put Back does for a menu entry | return every page live in `backTo()` |
| A record that does not say returns a build page live and a page made here as a draft; this covers pages a restore retired | a build page is always live unless retired; a made page's earlier state is unknown, and a draft shows nothing to visitors until a publisher puts it on | change the fallback in `backTo()` |
| Back on the site needs `site.publish`; back as a draft needs `site.edit` | the same line Retire draws: what visitors can reach is a publisher's | change `scopeFor()`'s `putBack` case |
| The card asks first, with a Yes button, as Retire does | putting a page back on the site changes what visitors see at once | open the action without the question in `card()` |
| A page retired again with no destination answers the 404 page; the earlier destination is not kept | a second retirement is a new choice | keep `retiredTo` in the `putBack` case |

## 2 November 2026 · Retire at phone width, and a retired section's words (queue item 14; routine calls made in the session)

His item of 2 Nov, given with a button: "the Retire button stays on one line at phone width, and a retired section's
words leave the Edit Text list". At 390 px a section row's Retire button wrapped to its own line under the arrows and
Copy, and the edit button's list for a page still offered a retired section's words under More words.

| Call | Why | To reverse |
|---|---|---|
| Under 40rem a section row's buttons get narrower sides (`--s3`), at least 44 px wide, labels never broken; the words stay as they are | his words are kept and every button stays a 44 px target; ↑ ↓ Copy Retire then fit the line under the name | delete the `.staff-sections li > .btn` rule in `blocks.css`'s 40rem query |
| Only the sections list changes; the menu's rows keep their buttons on the line under the name | the item names Retire on a section row; the menu's rows were not asked about | add `.staff-menu li > .btn` to the same rule |
| The server's list for a page (`editSource`) leaves the retired section's words out, so Edit Text and More words never offer them | it is the one list the edit button draws from; Put Back returns the words with the section | drop the `retired` filter in `editSource()` |
| A save already open on those words is still taken | refusing would lose typing for a section that can come back; nothing reaches visitors while it is retired | refuse in `saveEdit()` when the target's section is retired |

## 2 November 2026 · the address bar after Sign in with Connect (queue item 15; routine calls made in the session)

His item of 2 Nov, given with a button: "the address bar drops ?code=…&state= after Sign in with Connect". Seen 31 Oct: the
bar kept `/staff/?code=…&state=…` though `finishSignIn` answers a 302 to `/staff/`.

The cause, read on the live site (deploy `6ae91d6b`, a browser with no staff session, so nothing was deleted): a `POST
/api/auth/signout?probe=item15&x=1`, whose answer is a 303 to `/staff/`, arrived at `/staff/?probe=item15&x=1`; the same call
with no query arrived at `/staff/`. Netlify puts a request's query on a function's redirect that has none of its own. Netlify
staff describe the same rule for proxy rules and say a Location with a query of its own is left alone
(answers.netlify.com/t/31604, /t/95642; posters there report that Netlify's CLI does not do it). The rig passed the
handler's Location through untouched, so no check could see it. Not read live: a Location with a
query of its own from a function, and where the query goes when the Location has a fragment.

| Call | Why | To reverse |
|---|---|---|
| The page's inline script takes `code` and `state` off the address, only in a browser holding `bss_staff_hint`, and only when both are there; the rest of the query stays | a redirect cannot take the query off (Netlify would put it back, and a redirect from `/staff/?code…` to `/staff/` would loop); the inline script runs first on every page Sign in can come back to, with no new words | delete the `var u=…` part of `INLINE_JS` in `src/render/layout.mjs` |
| The callback stays a 302 rather than a page that moves on by itself | a page in between adds words and a step for the same result; with the script, the history entry the redirect made has its address replaced, so no entry keeps the code | answer the callback with a page carrying `<meta http-equiv="refresh">` |
| The rig puts the request's query on a function's redirect that has none, in the dev server and in the browser suite's API stand-in (`netlifyLocation()`) | a check that runs where Netlify's rule does not hold cannot see this defect; the browser check refuses to pass if the redirect it sent lacks the query | drop the `netlifyLocation` calls in `ops/dev-server.mjs` and `ops/interact.mjs` |
| The query goes before a fragment in the rig's model | where Netlify puts it is not known; this is how a URL is put together | change `netlifyLocation()` when it is read live |

## 2 November 2026 · past events' words at full contrast (queue item 24; routine calls made in the session)

His item of 2 Nov, given with a button: "Queue it before item 16". An ended event was marked by fading its whole row
(`opacity: .55`) or card (`.6`). With the clock past an event's end, axe failed every word in it, not only the time the
suite reported: the time and name 2.97:1, the place, its link and the Ended tag 2.5:1, a card's date and room 3.26 and 3.71.
The suite judged "ended" by the browser's real clock, so the same build failed after 6 PM on a Monday and passed earlier.

| Call | Why | To reverse |
|---|---|---|
| An ended row keeps full strength; its time and name drop to `--muted` at regular weight; the Ended tag and the missing Drop in stay | the muted ink measures above 4.5 on the darkest ground; colour alone was hard to see beside the bold rows (screenshot read at 1280 and 390 px), weight makes it plain | restore `.ev.is-past { opacity: .55; }` in `src/styles/blocks.css` (fails contrast) |
| An ended card keeps full strength; its red date and its name take `--muted`; the featured card keeps its red date | the card already loses its buttons and says Ended; a grey date is the card's own "over" sign | restore `.evcard.is-past { opacity: .6; }` |
| `ops/a11y.mjs` holds the browser's clock a minute after the first listed event ends, for every page; then each page with events again, a minute after its last | ended and coming events are both measured whatever the hour; every event view is measured ended | drop `setFixedTime` and the second loop in `ops/a11y.mjs` |
| The suite fails a page whose clock is not the held one, a run with no ended or no coming event, and a selector that differs from `schedule.js`'s | a held clock no content reaches measures nothing | delete those three checks |
| The suite names every element a rule failed, not the first | item 24 was queued as "the time" because only the first was printed | print `nodes[0]` again |

## 2 November 2026 · the Resources Escape check waits for the dialog's close (queue item 16; routine call made in the session)

His item of 2 Nov, given with a button: "Queue as item 16". `ops/interact.mjs` read the page straight after pressing Escape.
The dialog closes at once, but its close event, which unpins the page and scrolls it back, runs as a later task, so on a busy
machine the check saw the page still pinned.

| Call | Why | To reverse |
|---|---|---|
| The check waits for the dialog's close event, with a 3-second bound that only a dialog which never closes reaches | the bound is the one wait the suite needs to prove a non-event; it ends early on the event itself | read the state straight after the key press again |

## 2 November 2026 · the browser suites keep their whole report, and check.mjs reads each one's tally (queue item 20; routine calls made in the session)

His item of 2 Nov, given with a button: "Queue after item 16". The three browser suites called `process.exit()` straight after
printing; `check.mjs` reads them through a pipe, which a child writes asynchronously, so the end of a report could be lost,
its tally included, and `check.mjs` judged the suite by its exit status alone. Each suite now ends through `ops/finish.mjs`, and
`ops/suites.mjs` holds the three suites and how `check.mjs` reads a report.

| Call | Why | To reverse |
|---|---|---|
| `check.mjs`, `editable.mjs` and `build.mjs` end through `finish()` too | each prints a report and then exits, the same loss in any pipe | put `process.exit(…)` back in each |
| The remaining `process.exit()` calls in `ops/` are on a closed list in `test/suites.test.mjs`, each printing a line or a few | a pipe takes a short message whole; a new call off the list fails the test | delete the list and its test |
| `shots.mjs`'s last line reads `shots: all N passed — …` or `shots: F of N failed (…)` | all three suites now end in one tally form that `check.mjs` can read | the old two lines, and the shots pattern in `ops/suites.mjs` |
| `check.mjs` also fails a suite whose tally differs from the result lines that arrived, or whose exit status disagrees with its tally | a tally is a claim about what ran; both are checked against what arrived | delete those two checks in `judgeSuite` |

## 2 November 2026 · no dot before an ended event's "Ended" on a phone (queue item 25; routine calls made in the session)

His answer of 2 Nov, given with a button: "Keep the dot on desktop only". On a phone an event row is one column, its sign-up
cell wraps, and "Ended" started its own line with its dot ("· Ended").

| Call | Why | To reverse |
|---|---|---|
| "On a phone" is the one-column event layout, 860 px and narrower | the dot started a line only there; the desktop cell never wraps | move the two rules to another width |
| There, "Ended" always takes its own line | without the dot, sign-up words before it ("No Sign-Up") would run into it; an ended row hides its Drop in, so today it stands alone | delete `display: block` in that block |


## 3 November 2026 · Connect delivery and incomplete profiles (Owner; queued, not built)

Source: Nicholas's queue-intake interview in Codex, 3 November 2026. He expressly requested **queue updates only**.
This records future work and makes no code, switch, deployment, sending or account change.

- **Priority one:** get Connect information onto the public website, starting with team profiles that are not
  appearing. His answer: “Update automatically, I should be able to select in the settings waht the required public
  profile fields are, right now something is blocking any profiels from reaching”. Public WORK item 19 is first;
  Connect companion is CONNECT-PUBLIC-DELIVERY-P1.
- **Incomplete profiles still publish.** His later answer settles how the required fields work: “if the public
  profile details are missing, have notifications or prompts until the information is complete, it should still
  get published to the public website even if details are missing”. Settings requirements measure completeness and
  drive prompts/reminders, not approval or publication blocking. This supersedes earlier profile-field validation
  to the extent it hides an eligible profile or stops the whole website because its details are incomplete.
- **Preserve visibility and privacy.** Existing default-public/opt-out, Student Supporter-only opt-in, and dual-role
  supporter-disclosure choices remain. Missing optional display elements are omitted; no biography, credentials,
  photo or other personal fact is invented. Public display fields stay separate from private roster/payroll/access
  data and SPILL cases. Existing uploaded-photo/public-contact restrictions remain.
- **Automatic updates:** retain the agreed refresh bound, within 30 minutes, and authorized Refresh Now. Finish the
  export/consumer connection and explain failures; do not require a manual publish or paid build for each profile edit.
  Verify existing events/resources/approved Wall paths as part of delivery; team profiles are the first finish line,
  not authorization to add unrelated new content types.
- **Website Forms:** Connect's screen needs a truthful state and useful action, distinguishing no answers, filters,
  closed forms, permissions, connection trouble and failed loads. Verify website submission delivery rather than
  treating an empty list as a successful connection. Coordinate existing WORK items 17 and 21 with Connect ADMIN-A6.
- **Report notifications:** resource and bug report alerts and member subscriptions/reminders are controlled through
  customizable Connect Settings. Nicholas named nicholas@badgersupports.org for report alerts and
  directors@badgersupports.org as sender. Connect owns preferences, sending and delivery; do not add a second public
  mail mechanism. Opening forms or enabling sending is outside this queue update.
- **Shared sign-in:** Connect owns the change from Opening Google to Authenticating in its ordinary and shared SSO
  doors (CONNECT-AUTHENTICATING). This does not independently rewrite this site's other sign-in wording.

Read-only evidence: Connect's `netlify/actions/public.mjs` and this site's `ops/connect-feed.mjs` already contain the
export and consumer. `content/connect-feed.json` still has team/wall off. Exchange
`to-public/CONNECT-SESSION3-LIVE-2026-11-02.md` reports Connect published in `b9d7ebd` and the website's pickup at
23:00 Chicago; it explicitly did not call the production exports. Verify actual current availability when the queued
work is selected. Local/fixture proof, a reported deployment and independent live verification are different claims.

Accept: eligible complete/incomplete profiles and saved edits reach the rendered site automatically within the
agreed refresh window; completion requirements prompt without suppressing; hidden/private data stays absent; one
incomplete profile cannot stop other content. Record the actual export/consumer state and remaining live actions.


## 3 November 2026 · Authorized queue implementation and Claude verification

Nicholas authorized building as much of the public website queue as practical, beginning with Connect team delivery,
in a separate working copy with fresh baseline checks. Codex does not publish; Claude verifies the resulting candidate
before the release. This supersedes the earlier audit-only phase for application implementation.

Implementation choices (delegated, not new Board policy): keep the existing site identity and layout; accept valid public
identities with incomplete optional display fields; isolate corrupt identity rows; never derive private fields or supporter
consent. Refresh approved catalogues through the existing publication store, use a bounded same-origin photo proxy,
and prevent immutable-page fallback from reviving a withdrawn profile. Personal fallback is limited to 30 minutes and
stale personal HTML receives no new cache lease. Resources/events retain last-good approved reads. These choices are
reversible in the candidate branch; no live setting, sender, subscription, roster, form opening or domain was changed.

The Wall form remains closed and uses the existing anonymous intake, moderation, idempotency and backup policy.
Consumer-required resource fields cannot be hidden, made optional, retyped or replaced with sender questions. Peer day
cards retain their photos/position while times and each room follow approved occurrences. Other-answer inputs preserve
their indent within their question width. Static card sections retain Copy; dynamic source cards are not copyable.

Alumni remains email-first for former BSS/BSN and SPILL staff, supporters, volunteers and leaders. The existing email-list
route is reused; the restricted testimonial link is removed from this email-only page. This does not create an alumni
subscription destination, restore unapproved historical data, or prove real enrollment/delivery. Those remain in the
queue and release checks. Newly proposed policy text remains a draft, and the existing publication/cutover boundaries
still apply where Nicholas has not changed them.

The final local gate exposed a sign-in hint race: the edit module can clear the cookie before the staff module reads
it. The staff page now also reads its captured initial hint, preserving the ended-session message without granting
access. Prototype event cards load the local clock without calling Connect. Resource-suggestion definitions retain
an explicit single-link limit, and photo responses are bounded by origin/path, raster type and byte size. These are
delegated correctness fixes; the source-bound handoff records their tests and the final gate outcome.

An overlapping unpublished Connect candidate supplies a content-version photo query. The public proxy accepts only
its exact optional `v` content hash, preserves it and adds a separate bounded refresh bucket; arbitrary or repeated
parameters remain refused. A frozen fictional producer fixture covers sparse profiles and this photo shape. This is
candidate pairing evidence, not a live-export claim. Preserve both public candidates and reconcile their reviewed
changes in a new integration tree; do not overlay one working folder onto the other.

## 3 November continuation (Owner scope; delegated implementation)

Nicholas requested continued priority-order implementation in a separate working copy, fixing check failures and leaving a handoff for Claude to verify and publish. Codex is not to publish. Existing form, mail, permissions, personal-data and domain boundaries remain.

This continuation selectively reconciles the paired Connect team's runtime module with the broader public candidate, adds the closed shared email request route, prepares a disabled runtime alumni history component, preserves topic choices through workshop links, improves ended/ongoing event behavior and corrects verified public destinations. Existing block IDs and manual override paths are retained. Source-backed copy and proposed stewardship/page-purpose records refine the current design. The alumni status review resolves eight former members and one onboarding-only exclusion; actual display subset approval and a current appointment recheck remain separate. No real alumni roster is committed.

Verification belongs to the dated shared handoff and its source manifest; local fictional tests do not prove live delivery, CDN invalidation, enrollment or publication. Pre-transition/repeated-hour DST conversion remains a queue limitation. No new policy, owner role or approval ceremony is established by these implementation choices.


## 3 November 2026 · Continued local public build (canonical 30–37/62)

Nicholas requested continued building through badger-build-handoff, preserving the tested candidate and using a separate working copy, without publication. The previous candidate and other dirty trees remain protected.

| Routine implementation choice | Basis | Reversal / limit |
|---|---|---|
| Preserve dated source startUtc/endUtc only when they round-trip to the supplied Chicago date and minute | Connect already projects these public fields; the consumer discarded them | Revert the consumer mapping; do not reinterpret mismatched source timestamps |
| Resolve weekly wall times at the event hour; use the earlier occurrence for a repeated hour when no exact instant exists | Matches the existing producer convention; noon offsets are wrong before the switch | Change the resolver only with a coordinated source contract; an exact valid producer timestamp still wins |
| Leave nonexistent times unresolved; offer time confirmation rather than attendance/calendar actions | A source wall time in the spring gap has no matching instant | Student source owner corrects the event; no false duration or future time is invented |
| Retain each multiday event's original start, and order resolved repeated-hour rows by instant | All views and calendar files must describe the same event | Revert row/order changes; regression checks demonstrate the failure |
| Home's existing When/Where fields point to its current timetable | Avoids static promises contradicting approved schedule changes while retaining field paths | Restore wording in those same fields only after deliberately resolving schedule ownership |
| Add early program choices and request context using existing blocks | Canonical 34–37: attend, request and written support are distinct tasks | Restore the same page fields/links; no backend or intake store changes |

Existing word and typed-edit target paths remain stable. Saved overrides continue to win at their existing scope; actual live overrides were not read. The local migration record separates URL disposition, content and whole-task acceptance. Current recruitment/pay/hours, approved alumni display data, mail enrollment, privacy review and cutover remain outside this local proof.


## 3 November 2026 · FAQ and first visit (canonical 39–40)

Nicholas requested resuming the saved build-d working copy, preserving tested candidate 6be6f13, finishing testing and calibration, and updating the same shared handoff. This remains local implementation; no push or publication.

FAQ display groups reference original question IDs instead of moving answer arrays, preserving saved edits and question anchors. Answer actions lead to the schedule, program, room or contact relevant to the question. Question validation rejects hidden, missing or repeated references and unsafe addresses; section copies remap question references independently of group IDs. Linked generated group and expectations anchors protect their sections from retirement. These are reversible implementation choices within the authorized refinement, not new program or governance policy.

The peer introduction uses current event occurrences and their actual room directions. Empty, unavailable, unresolved-time and missing-room states offer the appropriate updates/contact action. A short ordered arrival walkthrough and an optional native expectations disclosure retain the existing peer block order, activity/day photos, reel consent, non-clinical boundary and existing edit targets. Saved overrides continue at their original scope; their live contents were not read.

The shared source review records governing text and current correspondence supporting drop-in visits, check-in/activity, access contact and UHS consultation. No fixed group count, unconditional confidentiality/late-arrival promise or numeric accommodation cutoff was established. Broader affiliation wording remains the existing source-verification dependency; the approved Equity statement is unchanged. Exact test results, source fingerprints and recovery files belong in the shared PUBLIC-SITE handoff.


## 3 November 2026 · Craft Night visit and recap (canonical 41)

Nicholas authorized item41 in a separate working copy, preserving8aac3d8 and6be6f13, with testing/fixes and the same handoff updated. No push or publication is authorized for this batch.

The Craft page retains its purple identity, source-driven hero/current room/calendar, existing block IDs, original word/value targets and people photos. Stable jumps lead to practical expectations, a captioned look back and the existing suggestion route. The archived Nostalgic Crafts and planter images were already approved in the library and used on this page; their supported captions avoid claiming to show the latest event. Whole-image recap proportions preserve the people rather than imposing a portrait crop.

Current public invitations support free/drop-in attendance, no registration/experience, and the access email. They do not establish that all future materials are supplied or a universal funding promise. Conflicting three-day/five-day access messages are not a verified governing deadline; contact-only wording replaces the five-day sentence at the same saved target. The shared source review records the dated evidence and draft limitations. No new program policy is created.

Shared event heroes/lists use the existing stale status to withhold unconfirmed current attendance/calendar links and offer contact/updates, while preserving historical recaps. Raw last-good feed storage, retry/cache timing and direct calendar fallback retain their existing behavior. A missing room offers a location question. Common section anchors also work for copied pages and quiet CTAs. These are delegated implementation choices within the usable Craft refinement, not new owner rulings. The source-bound handoff holds the exact tests, recovery and remaining source-owner/live limits.


## 3 November 2026 · Public consumer reconciliation (local only)

The CONNECT-TEAM-CONSUMER-MERGE request authorizes reconciliation of the unpublished consumer with the Public owner's
completed Craft candidate. Runtime-only profiles, current eligibility, the existing catalogue/event pipeline,
4 MiB photo limits, matching photo identity, HEAD support and no-store failures remain. Optional compatibility
aliases are validated public team addresses; current canonical pages take precedence and ambiguous aliases choose
nobody. The current producer exports no credentials or ordering field, so those fields remain excluded. Missing
names keep the existing Team Member heading and use Contact This Person when a public contact exists. Revision or
team-preview rendering failure returns a private-safe unavailable response. This is local implementation, not
live-export verification or activation; existing export settings are inherited without a flag change.
