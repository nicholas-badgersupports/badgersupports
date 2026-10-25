# Design

How the site looks, and where each choice comes from. Every value named here lives in
`src/styles/tokens.css`. When this page and that file disagree, the file is right and this page is out of date.

## Sources

| Source | What it gives |
|---|---|
| style.badgersupports.org, v1.0 | the brand, and the first word on any look: red `#B60000`, cream `#F2EBE1`, charcoal `#393737`, khaki and blue; the light and dark rainbow; Montserrat for every word on the web; round corners; a paper texture under every ground, never a flat fill; contrast 4.5:1 and 44 px targets. Its own page's CSS gives the white card on the cream with a 1 px line `#E2D8C6` and the softest lift, and the uppercase 800 eyebrow |
| The brand design system (`Admin/Design/Badger Supports design system`, read only) | the radius scale (8, 20, 32, pill); the poster headline, `DisplayHeading`: Montserrat at its heaviest, uppercase and tight, "reach for it first"; the flat pill `Button` with no shadow; the two CC0 paper textures (`assets/brand/TEXTURES-LICENCE.txt`) |
| The owner, 23 Oct 2026 | "be careful not to deviate from the badger supports brand": where the brand and an earlier choice on this page disagreed, the brand won (`OVERNIGHT-RUN-2026-10-23.md`, "Brand alignment") |
| Connect's `tokens.css` | the family resemblance (`../../MASTER-PROMPT.md` §1): motion durations and self-hosted fonts. Its deeper red, paper, 7 px radius, Baloo 2 and Caveat were replaced by the brand's on 23 Oct 2026 |
| Connect's signed-out rule | the frame (header, footer, announcements) is brand red and the neutrals on every page (owner, 20 Oct 2026, `DECISIONS.md` Round 5) |
| The owner, 23 Oct 2026 | "peer support groups should be green, craft nights should be purple": two program colours, taken from the brand's rainbow (the peer green and the craft lilac), in fills and tints, never as a side bar |
| Badger SPILL, `docs/DECISIONS.md` | the owner, 23 Oct 2026: "look at the lessons of Badger SPILL". The lessons taken are listed under [Lessons from Badger SPILL](#lessons-from-badger-spill); icon presses (`src/styles/motion.css`) and every word editable came earlier |

SPILL's blue, its cow, its ledged pills and its wave appear only where SPILL itself is named: its card in the
homepage hero, its band and its link in the footer. Its type and the rest of its palette are not used here
(`../../MASTER-PROMPT.md` §3: not "wholesale"). SPILL is a sub-brand; its marks are its own.

## Lessons from Badger SPILL

Read from `Badger SPILL/badger-spill/docs/DECISIONS.md` on 23 Oct 2026 and applied the same day (queue item 28;
each change and how to reverse it is in `OVERNIGHT-RUN-2026-10-23.md` §2). Later that day the owner asked that
nothing deviate from the brand, so three lessons were carried out in the brand's own terms instead of SPILL's:
the ledge, the wave and the display face (marked below).

| Lesson | Here |
|---|---|
| **One heading case.** Labels, headings, buttons, links, tabs and statuses are Title Case, small words lower (SPILL's owner rule, 10 Oct 2026). The brand's headline then shows `h1` and `h2` in capitals | [Heading case](#heading-case) below |
| **One card.** White on the cream, flat, with a 2 px line (`--line`) and the brand's panel radius. A card is not a button; while a link inside it has focus its edge takes the section's colour | `.evcard`, `.res-card`, `.staff-form`, the form head |
| **What can be pressed looks pressable.** *In the brand's terms:* SPILL marks it with a 3 px ledge; the brand's `Button` is a flat pill. Here every button and link-pill is a pill in the section's colour and nothing stands on a ledge, except SPILL's own pills where SPILL is named | [Shape](#shape) |
| **One button set.** The filled main button, the outlined go pill and the Drop In pill, all on the section's colour. One main button per screen; a second action sits beside it as a pill, not a second filled button | [Buttons and links](#buttons-and-links) |
| **Banded sections.** An inner page's heading stands on a pale band of its colour, on paper; a program's own page takes the full colour; the homepage has none. *In the brand's terms:* the band ends square; SPILL's two waves at its foot are SPILL's mark and were taken off | [Surfaces](#surfaces) |
| **Styled empty states.** Nothing coming up, no resources, no team yet: each is said in words on a pale panel of the section's colour, never left as a blank or a grey line | `.week-empty`, `.evlist-none`, `.res-none`, `.team-none` |
| **Motion under a second.** Every one-off move ends within a second; the hero's slow drift is the one loop, and it has a Pause button | [Motion](#motion) |
| **A loud voice for titles only.** *In the brand's terms:* not a second face but Montserrat at 800 in capitals for headings, the hero and numbers; everything a person reads at length is Montserrat at 400 to 700 | [Type](#type) |

## Colour

Brand red and neutrals for the frame of every page; inside it, each program wears its own colour from the brand's
rainbow: the peer green, the craft lilac (the owner's "purple") and the workshops blue.

| Token | Value | Use |
|---|---|---|
| `--red` | `#B60000` | the wordmark, the hero, the announcement bar and footer, and the accent anywhere no program is named |
| `--red-deep` | `#920000` | hover and press on red; never a fill at rest |
| `--red-tint` / `--red-wash` | `#FADFDA` | the brand's light red at 20% over white: empty states, callouts, the band under an inner page's heading |
| `--cream` / `--cream-soft` | `#F2EBE1` / `#F7F2EA` | the page; type and buttons on a coloured ground; a table head or a quiet note |
| `--paper` / `--paper-deep` | `#FFFFFF` / `#EDE6DA` | a card, the header and a field, white as on the style guide's own page; a second band to alternate to |
| `--ink` / `--muted` | `#393737` / `#544F4B` | text |
| `--line` / `--rule-strong` | `#E2D8C6` / `#CEC2A8` | the style guide's card line, and the hairline between list items; the rule between two halves of one thing |
| `--khaki` | `#A99A6F` | decoration only; as text it fails 4.5 on the cream |
| `--link` | `#304674` | links: the brand's are blue, and the workshops blue holds 4.5 on every ground here (the brand blue `#0479A8` only on white) |
| `--peer` / `-deep` / `-light` / `-tint` | `#346B4F` / `#2A563F` / `#71AF7D` / `#DDEEE1` | peer support groups |
| `--craft` / `-deep` / `-light` / `-tint` | `#4F4F7D` / `#3F3F64` / `#A7A7D8` / `#E8E8F5` | craft nights |
| `--workshops` / `-deep` / `-light` / `-tint` | `#304674` / `#26385D` / `#98BAD5` / `#DCEAF3` | workshops |

In each program set the dark shade is the colour (text, buttons, small details), as the brand's rainbow uses it; the
light shade is for a big fill; the tint is the light shade at about a quarter over white. Each `-wash` equals its
`-tint` today and is kept as its own token so a band can part from a callout later.

**How a section picks its colour.** The blocks draw in `--accent`, `--accent-deep`, `--accent-light`, `--accent-tint`
and `--accent-wash`, never in `--red` directly. `[data-program="peer"]`, `"craft"` and `"workshops"` (in `tokens.css`)
point those at that program's set for everything inside; the nearest one wins. A page sets it with `"program"` in its
JSON (it lands on `<main>`); a program section, an event hero, an events list and a timetable row set it from their
own `program`; a homepage circle or a Get Involved door takes the colour of the page or section its link goes to.
Anything else stays red. `layout.css` (header, nav, announcement bar, footer) never uses `--accent`, so the frame is
red everywhere, and `test/pages.test.mjs` holds both rules.

Each set is used the same way in every colour: the colour for fills, links and headings; the deep one for hover and
press; the tint for an empty state or a callout; the wash for the band under a heading. Every program colour carries
cream text at AA, sits at AA as text on white and on its own textured tint (the measures are in `tokens.css`).

Four small families sit outside that and each has one job:

- **Badger SPILL**, `--spill` and its companions: SPILL's card in the hero, its band and its footer link, and nowhere else.
- **Wall of Support paper**, `--note-1` to `--note-6`, tints of the brand's light rainbow: the notes on the wall and nowhere else.
- **Status**, `--danger` (the brand's dark orange, `#AF4129`), `--ok` (the peer green) and their tints: form errors
  and confirmations. Danger's words sit on white or its tint, never on the bare page (4.24 there).
- **Focus**, `--focus-ring` (`#304674`) on light grounds and `--focus-on-red` (cream) on a coloured ground.

Program hues were removed on 20 Oct 2026 and brought back on 23 Oct 2026 at the owner's word, as fills and tints
rather than the old accent bar, and moved onto the brand's rainbow the same day. No decorative bar on any edge, in any
colour (owner, 24 Oct 2026): an edge is `--hairline`, `--rule-line`, a route's dotted line, or nothing. Colour on an
edge means something: the page you are on, a selected tab, focus. `test/pages.test.mjs` fails on any other.
The gate "colours come from tokens.css" in `npm run check` fails on any colour literal outside `tokens.css`, so a new colour starts as a token.

### Paper

The brand's backgrounds are never a flat fill. Every ground is one of two CC0 paper textures (`assets/brand/`,
licence in `TEXTURES-LICENCE.txt`) multiplied into its colour and veiled with that colour:

| Ground | Token | Texture |
|---|---|---|
| The page, a quiet band | `--tex-ground`, `--tex-deep` | coldpress, under the cream or `--paper-deep` at a 70% veil |
| A band under a heading | `--tex-wash` | coldpress, under the section's wash at 70% |
| A coloured block (hero, footer, announcement, event hero, closing call) | `--tex-block` | crumpled, under the section's colour at 50% |

Each is used as `background: var(--tex-…); background-blend-mode: normal, multiply;`. Cards, the header and fields are
white and untextured, as on the style guide's own page. At a 70% veil the darkest point of the coldpress darkens a
ground to 95%, and every pairing in `tokens.css` is measured there; `ops/a11y.mjs` runs axe on each page with the
textures off and every light ground darkened to that point, so it checks the worst case a line of text can sit on.

## Type

Montserrat, and nothing else. The brand sets every web word in it; its headline face, More Sugar, is a licensed
Canva font with no web version and never ships here, and a third face is avoided.

| Role | Cut | Token |
|---|---|---|
| `h1` and `h2`, the hero, the wordmark, tile and card titles, big numbers | 800, uppercase, tight (`letter-spacing: -.01em`) | `--font-display`, `--fw-display` |
| The eyebrow over a heading, a page head's label | 800, uppercase, spaced (`.08em`) | `--font-body` |
| `h3`, buttons, links that act, labels | 700 | `--font-body` |
| A lead, a wall note, the nav | 600 | `--font-body` |
| Everything a person reads at length | 400 | `--font-body` |

`--font-display` is the same family as `--font-body`; it is kept as a name so a heading can be found in the CSS.
800 is the heaviest cut shipped; the design system's `DisplayHeading` asks for 900 (Black), and adding that file and
setting `--fw-display: 900` is the one change if the owner wants it heavier.

The scale runs from `--fs-small` (0.9375 rem, 15 px) to `--fs-h1` (`clamp(2.25rem, …, 4.5rem)`); an inner page's
title is `--fs-page`. Display lines are set tight (`--lh-display: .95`) and body text loose (`--lh-body: 1.6`), with a
62-character measure. A title that must fit whole is sized to its box: the form head's name is `min(2.125rem, 9.4cqi)`
of its card, because its longest word, RECOMMENDATION, is 10.4 em wide in capitals; on a phone the header's wordmark
scales with the screen (`clamp(1rem, …, 1.6rem)`) so the Menu button stays beside it at 320 px.

**Nothing a person reads is below 14 px.** The gate "no text under 14px" reads every `font` and `font-size` in
`src/styles/` and fails under 14 px.

The four Montserrat files (400, 600, 700, 800) are in `assets/fonts/` with their OFL licence, loaded by `@font-face`
with `font-display: swap`; the 400 and the 800 are preloaded (`src/render/layout.mjs`). Nothing is requested from Google Fonts. Baloo 2 and Caveat, which
this site used until 23 Oct 2026, are in `local/retired-fonts-2026-10-23/`, not in the build.

### Heading case

**Title Case** in the text for every label, heading, button, link, tab, status, form section and navigation item:
each word capitalised except the small ones (a, an, and, as, at, but, by, for, from, in, into, nor, of, on, or, per,
the, to, via, with) unless they open or close the line. "Get Involved", "Add to Calendar", "Privacy Policy and Terms".

The brand's headline then shows `h1`, `h2` and the display titles listed above in capitals, by CSS
(`text-transform: uppercase`). The words are not changed: a screen reader, a search engine and the editor all get the
Title Case text, and taking the rule out of `base.css` shows it again.

These stay as written:

- **Sentences**: help text, leads, notes, policy text, the confirmation messages.
- **Questions**, and form labels that end in a colon: first word capitalised only ("How are you feeling today?").
- **The wordmark**: "badger supports" in the header is lowercase, as the lockup writes it. The homepage hero's title
  holds the same lowercase words and shows them in the brand's capital headline, as the design system's posters set
  the name.
- **The tagline**, "peer support · education · community", lowercase, as the brand writes it.
- **What Connect sends.** An event's name is shown as Connect holds it ("Peer support group"), because the
  directors write it there.
- **An address**: an email or a web address in a pill.

The text was changed in place, so every string is still the live site's or Badger Supports' own (the wording rule,
`COPY-SOURCES.md`; provenance folds case). The 165 changes and their originals are in
`local/TITLECASE-REVERSE-2026-10-23.tsv`, which is gitignored.

## Shape

Corners are round, soft and never sharp (the brand). Radius is the design system's scale, by element class:

| Element | Radius |
|---|---|
| Cards that hold a block, info panels, photo cards, the form head, the Hub card, a door tile | `--r-panel`, 32 px |
| Smaller cards, photos in a row, the mood check-in's choices, notices, dialogs | `--r-card`, 20 px (the brand's default) |
| Inputs, a choice row in a form | `--r-input`, 8 px |
| Buttons, the go pill, Drop In, chips | a full pill (`--r-chip`; the go pill is 1.4 rem so it stays round when its words wrap) |
| Bands, strips, header, footer | square: they run edge to edge |
| People and the hero network | circles |

**Flat, as the brand.** A button is the design system's `Button`: a flat pill with no shadow, its deep shade under a
pointer. What can be pressed is known by its pill shape and its colour, not by a ledge (`--ledge` is still defined
because `test/pages.test.mjs` uses it to find one). Cards that hold things are flat with a 2 px line. Three kinds of
thing carry the style guide's own softest lift (`--lift`), because each is a whole tile that is one link or one choice:
a Get Involved door, a room ticket and a "what would you say" choice. The open menu, dialogs and the wall notes have
the deeper shadows (`--menu-shadow`, `--note-shadow`), because they float over the page; the wall notes keep their
small tilt for the same reason. Nothing else is tilted. The design system's own count: 72 of 80 pieces carry no
shadow, so a shadow is an option and never a default. SPILL's pills keep their ledge where SPILL is named.

## Surfaces

Each element gets one of these, never two:

- **Paper**: the cream under the coldpress texture ([Paper](#paper)), on `body`. A coloured block is the crumpled
  paper under its colour.
- **A heading band**: an inner page's heading on its textured wash (`--tex-wash`), ending square. A program's own
  page (craft nights) opens on its event hero in the full colour. The homepage has none.
- **A white card**: `--paper`, a 2 px `--line` and the panel radius, as on the style guide's own page.
- **A tint panel**: `--accent-tint`, no border, for an empty state and the Hub callout under the timetable.
- **A rule**: `--hairline` (1 px, `--line`) parts the items of one list; `--rule-line` (2 px, `--rule-strong`) parts
  two halves of one thing.

The form head is a white card, flat, with the same 2 px `--line` on every edge. Its 8 px top in the section's colour
went on 25 Oct 2026, under the owner's no-bar ruling of 24 Oct; Connect's ruled paper under it went with the brand
change of 23 Oct 2026.

## Buttons and links

| Thing | Class | Rule |
|---|---|---|
| The main button | `.btn.btn--big` | One per screen (SPILL row 132). On the homepage it is **Get Involved**; on Craft Nights it is **Drop In**, repeated at the closing call a screen apart. Filled in the section's colour, at least 60 px tall |
| Other buttons | `.btn` | Filled in the section's colour; on a coloured ground (hero, room card, closing call) they turn cream. `.btn--quiet` is the outlined one, for a form's second action |
| A link that takes you somewhere | `.go` | A white pill with a 2 px border and a round badge holding the icon, all in the section's colour. 44 px tall. On a coloured ground it is cream (`.go--light`) |
| Door tiles on Get Involved | `.door-go` | The same pill, inside a tile that is all one link |
| Drop In on a timetable row or event card | `.drop` | The same pill, smaller, with the pin badge first, in the event's program colour |
| Drop In with no directions page yet | `.evcard-chip` | The words on a grey chip, not a link |

The second action beside a main button (Add to Calendar beside Drop In) is a go pill, never a second filled button,
and the two sit side by side. On a phone the buttons in a page head, a feature or a closing call stretch to full
width, within thumb reach (`DECISIONS.md`, Round 6).

Pending links (to a page this rebuild has not built yet) go to the live Google Sites page and carry `data-pending`.
None is ever `#`.

## Brand marks

`assets/brand/` holds:

- `bss-lockup-red.png` and `bss-lockup-white.png`: the lockup for light and red grounds.
- `bss-hand-red.png` and `bss-hand-cream.png`: the hand alone.
- `paper-coldpress.jpg` and `paper-crumpled.jpg`, the brand's two CC0 papers ([Paper](#paper)), with
  `TEXTURES-LICENCE.txt`.
- `spill-logo-wide-*.webp`: SPILL's own logo, used only on its card (`src/render/spill.mjs`).

The hand is picked by the ground it sits on. `bss-hand-red.png` goes on cream and `bss-hand-cream.png` on red. These two are the only
hand files with the heart in them (Connect's design rule, measured there), and the owner asked for the heart back on
20 Oct 2026. The icon `hand` in `src/render/icons.mjs` uses them, not a drawing.

## Photos

Photos lead every kind of page (owner, 20 Oct 2026). **Faces are wanted**: people need to picture themselves at an
event. Name tags, QR codes, phone screens and UW marks are allowed. The rebuild adds no photo rule of its own and
picks on quality only. The owner removes what they object to.

**Owner action:** confirm that the people pictured agreed to their photos being used (`../WORK.md`).

### A photo slot

Any key named `photo`, `media` or `photos` in a page, room, event or place is a photo slot. It takes one of three
things:

| Form | Example | Meaning |
|---|---|---|
| A library id | `"m-people-welcome"` | a photo in `media/manifest.json` |
| A link | `"https://…"` | a photo in Google Drive or on the organisation's sites (a laptop preview: anywhere) |
| A link with details | `{ "link": "https://…", "alt": "…", "focal": [50, 30] }` | the same, with its description and the point a crop keeps in view |

So any photo can be swapped by pasting a link into the editor (`test/media-links.test.mjs`).

### What the build does with one

- A linked photo is **fetched once, at build time** (`ops/media.mjs`), cached in `local/media-links/` and served
  from this site like a library photo. A visitor's browser never asks the other site for it, and the CSP stays
  `img-src 'self'`.
- A Google Drive file link is rewritten to Drive's thumbnail address at 2400 px. A Drive **folder** link is refused
  with a message saying to copy the photo's own link.
- Each photo is encoded once into AVIF, WebP and JPEG at fixed widths: 360, 640, 960, 1280 and 1600 px, none
  wider than the original. No size is made on request. File names carry part of the original's hash, so a
  replaced photo gets new addresses.
- **Crops are CSS.** `object-fit: cover`, with the focal point written into the stylesheet by `mediaCss()`. One
  set of files serves every block, and moving the focal point needs no re-encode. The point is never written in a
  `style` attribute, so the CSP can refuse inline styles.

### What `photoProblems()` refuses

In `src/render/media.mjs`. The build stops on any of these:

- an id that is not in the manifest;
- a link that is not `https://` (plain `http://` is allowed only for a local address, and never in production);
- a link carrying a user name or password;
- in production, a link to a private address (`localhost`, 10/8, 127/8, 192.168/16, 172.16/12, 169.254/16,
  `.local`, `.internal`, any IPv6 literal);
- in production, a link on any host outside `PHOTO_HOSTS`: `drive.google.com`, `docs.google.com`,
  `googleusercontent.com`, `badgersupports.org`, `supportbadgers.org`, `badgerspill.org`, each with its subdomains;
- a Drive folder;
- a link longer than 2000 characters;
- `alt` that is not text, or `focal` that is not two numbers from 0 to 100.

Fetching adds a 25 MB ceiling and a 30-second timeout, and follows at most five redirects one at a time. A
production build holds every address a link redirects to to the same rules (`https`, not private, on the list), so
an allowed host cannot hand the fetch on. Drive's thumbnail address redirects once, to `lh3.googleusercontent.com`
(measured 23 Oct 2026).

**The host list is a constant, not a setting** (built 23 Oct 2026, run log §11), like Connect's `IMG_HOSTS`: a fetch
tells the other server a build ran, and a host nobody planned is a cost nobody planned (`../../MASTER-PROMPT.md`
§11). A laptop build without `--production` fetches from any public `https` host, so an editor can try a photo
before it is moved to Drive. Adding a host is a one-line change to `PHOTO_HOSTS` in `src/render/media.mjs`.
Not checked: what a host's name resolves to. A public name that points at a private address would pass.

### Frames

Photos sit in plain crops with the brand's soft corners (`--r-card`, 20 px; a photo that heads a panel takes the
panel's 32 px at its top) and in circles: no tilted frames, tape, stacked "polaroids" or drop shadows. The owner said
the earlier frames "give off AI-vibes" (Round 1). Where circles overlap, each wears a ring of the ground colour so the
join reads as a cut, not a frame.

### Where originals live

Originals are in `local/media-originals/`, which is gitignored, because the repository is public.
`media/manifest.json` holds only metadata: id, alt, focal point, size, hash and source. Drive photos name their
source as "Badger Supports shared Drive › 📸 Engagement › 🎥 Photos" and never link the folder.

Releases are built on the owner's laptop, which holds the originals (owner, 20 Oct 2026). 23 of the 34 library
photos come from the shared Drive, which no build machine can fetch, so a Netlify build from the repository fails on
them. That is expected.

### Building away from the laptop

A build that lacks an original stops before encoding anything and names every missing photo with its fix. A Drive
photo is copied from the synced Drive into `local/media-originals/` under its `localFile` name. A photo given by
link is fetched with `--fetch-media`. `test/media-originals.test.mjs` holds the build to this.

A release is built in a new, empty folder outside the synced folder, because the synced `dist/` holds conflict copies
("about 2", "assets 2") that cannot be deleted from here. A new folder each time means nothing has to be deleted.

```
DEST=~/Builds/badgersupports-site-YYYY-MM-DD
rsync -a --exclude /dist --exclude /.build --exclude /.netlify --exclude /node_modules --exclude /local ./ "$DEST/"
mkdir -p "$DEST/local" && rsync -a local/media-originals "$DEST/local/"
cd "$DEST" && npm ci && node ops/build.mjs --production
```

Once the repository holds the release, a fresh clone of that commit replaces the first `rsync`. The last line reads
Connect, so it needs Connect's three variables in the environment; without them it builds nothing. The deploy waits for the Netlify project (`../WORK.md`, owner
action 9). `netlify.toml`'s production context runs the production build (23 Oct 2026); its other contexts build the prototype.

## Motion

The moves follow SPILL's icon presses and Connect's durations (`--t-fast` 120 ms, `--t` 160 ms, `--t-slow` 200 ms,
one ease-out curve).

Every move that happens once ends within a second (SPILL's lesson); the hero's drift is the one loop.

- **Icon presses**: each icon moves once, in its own way, when its link is pointed at or pressed. The arrow leaves
  and comes back, the pin drops, the envelope's flap opens, the scissors snip and the hand waves.
  `src/client/site.js` adds `.i-press` and removes it when the move ends. The moves are in `src/styles/motion.css`.
- **Hello once**: the hero's circles arrive with a small bounce, the "you" fades in, and the big button's hand waves
  once, a beat after the page opens.
- **The one loop**: after arriving, the hero circles drift and the bubbles float, slowly and out of step, at 6 to 13
  seconds a cycle (`src/styles/blocks.css`). The owner asked for this on 20 Oct 2026. It breaks Connect's rule that
  nothing loops on resting content (`DECISIONS.md` §3). The same day the owner chose a **Pause** button for it,
  which meets WCAG 2.2.2. The button sits in the corner under the first circle. `src/client/hero.js` starts the
  drift and shows the button, so without JavaScript the circles arrive once and rest.
- **Less motion**: the last rule in `src/styles/base.css` turns every animation and transition off for anyone whose
  system asks for reduced motion.

## Page shapes

Each kind of page has its own shape, so that pages are not all alike (owner, Round 2):

| Page | Shape |
|---|---|
| Home | a red hero on crumpled paper, its title in the brand's capital headline, with a network of photo circles around "you", each in its program's colour, and SPILL's card; the week's events from Connect, each row's Drop In in its program's colour; four workshop activities, one per Canva deck; the Wall of Support; a mood check-in |
| Get involved | doors on a red band, each a photo tile that is all one link |
| Rooms and directions | the Hub first, as a red card with its photo; the other rooms as tickets |
| A room | numbered route steps beside a red card holding the address and the next events there |
| Craft nights | purple (the brand rainbow's lilac, deepened for text), in sections: an event hero in the full colour with the next night and Drop In; what to expect; the schedule; recent nights in photos (none on the live site until Connect sends past nights, item 30); a closing call; the accessibility line (Round 6) |
| Peer support groups | green: what a group is, in the live page's words, under a heading band; the Hub directions; the reel, which loads only after Play |
| Our team | groups of people cards, from Connect's opt-in profiles (fictional samples in the prototype; on the live site, until the export exists, a tint panel saying profiles appear as each person shares theirs) |
| Forms | two columns: the form head, a white card with its colour along the top, beside the questions |

Every page is checked at 1280, 390 and 320 px by `npm run shots`. Nothing may scroll sideways at 320.
