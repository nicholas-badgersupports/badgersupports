# Design

How the site looks, and where each choice comes from. Every value named here lives in
`src/styles/tokens.css`. When this page and that file disagree, the file is right and this page is out of date.

## Sources

| Source | What it gives |
|---|---|
| style.badgersupports.org, v1.0 | the brand: red `#B60000`, cream `#F2EBE1`, charcoal `#393737`, Montserrat |
| Connect's `tokens.css` | the family resemblance (`../../MASTER-PROMPT.md` §1): the deeper red `#8F0000`, paper `#FAF7F2`, the line and rule neutrals, the 7 px card radius, the ledge shadow, motion durations, Baloo 2 and Caveat, self-hosted fonts |
| Connect's signed-out rule | a page nobody is signed in to uses brand red and the neutrals only, with no ownership hue (owner, 20 Oct 2026, `DECISIONS.md` Round 5) |
| Badger SPILL | icon presses (`src/styles/motion.css`), one main button per screen, every word editable |

SPILL's blue, its cow and its type are not used here (`../../MASTER-PROMPT.md` §3).

## Colour

Brand red and neutrals, and nothing else on the page itself.

| Token | Value | Use |
|---|---|---|
| `--red` | `#B60000` | the hero, the door band, the event hero, links, the go pill's border and badge |
| `--red-deep` | `#8F0000` | ledges under cream buttons on red, the closing call band |
| `--cream` / `--cream-soft` | `#F2EBE1` / `#F7F1E8` | type and buttons on red; soft bands |
| `--paper` / `--paper-deep` | `#FAF7F2` / `#F0EAE0` | the page; quieter bands and date blocks |
| `--ink` / `--muted` | `#393737` / `#5C5755` | text |
| `--line` / `--rule-strong` | `#E8E0D4` / `#CDBBA2` | dotted rules, hairlines, the ledge |
| `--red-tint` | `#FBECEC` | the ring round a person's photo and the marker stripe under a role |

Three small families sit outside that and each has one job:

- **Wall of Support paper**, `--note-1` to `--note-6`: the notes on the wall and nowhere else.
- **Status**, `--danger`, `--ok` and their tints: form errors and confirmations.
- **Focus**, `--focus-ring` (`#1F5E86`) on light grounds and `--focus-on-red` (cream) on red.

Program hues (one colour per program, with an accent bar) were removed on 20 Oct 2026, because Connect's signed-out
pages do not use them. `test/pages.test.mjs` fails if one comes back. Gate 3 of `npm run check` fails on any colour
literal outside `tokens.css`, so a new colour starts as a token.

## Type

| Role | Face | Token |
|---|---|---|
| Headings, numbers, the hero | Baloo 2 | `--font-display` |
| Everything else | Montserrat | `--font-body` |
| The "you" in the hero, wall notes | Caveat | `--font-note` |

The scale runs from `--fs-small` (0.9375 rem, 15 px) to `--fs-h1` (`clamp(3.25rem, …, 6.25rem)`). Display lines
are set tight (`--lh-display: .92`) and body text loose (`--lh-body: 1.6`), with a 62-character measure.

**Nothing a person reads is below 14 px.** Gate 3 reads every `font` and `font-size` in `src/styles/` and fails
under 14 px.

All six font files are in `assets/fonts/`, each with its OFL licence, loaded by `@font-face` with
`font-display: swap`. Nothing is requested from Google Fonts.

## Shape

Radius is a scale by element class:

| Element | Radius |
|---|---|
| Cards, photos in a card | `--r-card`, 7 px |
| Inputs | `--r-input`, 5 px |
| Chips, the go pill | `--r-chip`, a full pill |
| Bands, strips, header, footer | square |
| People and the hero network | circles |

Depth comes from a **ledge**: a flat 3 px rule-coloured line under a card or button (`--ledge`), from Connect. There
are no soft drop shadows on cards. Only the open menu and the wall notes have a soft shadow.

## Surfaces

- **Paper grain** on `body`: two radial dot patterns at 7 px and 11 px, offset from each other. It is the one
  texture on the site.
- **Dotted rules**: `--dot-line` is a soft border and `--dot-line-strong` divides two halves of one thing. Both come
  from Connect's sign-in round.
- **Ruled paper** under form headings.

Each element gets one of these treatments, never two.

## Buttons and links

| Thing | Class | Rule |
|---|---|---|
| The main button | `.btn.btn--big` | One per screen (SPILL row 132). On the homepage it is **Get involved**; on Craft nights it is **Drop in**, repeated at the closing call a screen apart. At least 60 px tall |
| Other buttons | `.btn` | Red on light grounds; on red grounds (hero, room card, closing call) they turn cream with a dark ledge |
| A link that takes you somewhere | `.go` | A cream pill with a 2 px red border and a round red badge holding the icon. It lifts on its ledge when you point at it and presses down when you press it. 44 px tall |
| Door tiles on Get involved | `.door-go` | The same pill, inside a tile that is all one link |
| Drop in on an event | `.go` | The same pill, with the pin icon |

On a phone, the buttons in a page head, a feature or a closing call stretch to full width, within thumb reach
(`DECISIONS.md`, Round 6).

Pending links (to a page this rebuild has not built yet) go to the live Google Sites page and carry `data-pending`.
None is ever `#`.

## Brand marks

`assets/brand/` holds four files:

- `bss-lockup-red.png` and `bss-lockup-white.png`: the lockup for light and red grounds.
- `bss-hand-red.png` and `bss-hand-cream.png`: the hand alone.

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
| A link | `"https://…"` | a photo anywhere on the web |
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
- a Drive folder;
- a link longer than 2000 characters;
- `alt` that is not text, or `focal` that is not two numbers from 0 to 100.

Fetching adds a 25 MB ceiling and a 30-second timeout.

**Open, proposed:** an allow-list of photo hosts (Drive, the organisation's own sites) for production builds. Today
any public `https` host is fetched (`../WORK.md`; `../../MASTER-PROMPT.md` §11).

### Frames

Photos sit in plain crops and circles: no tilted frames, tape, stacked "polaroids" or drop shadows. The owner said
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

Once the repository holds the release, a fresh clone of that commit replaces the first `rsync`. Today the last line
refuses, because 39 items are still on the live site. The deploy waits for the Netlify project (`../WORK.md`, owner
action 9). `netlify.toml`'s build command is the prototype build, so a release must not be rebuilt with it.

## Motion

The moves follow SPILL's icon presses and Connect's durations (`--t-fast` 120 ms, `--t` 160 ms, `--t-slow` 200 ms,
one ease-out curve).

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
| Home | a red hero with a network of photo circles around "you"; the week's events with Drop in; four workshop activities, one per Canva deck; the Wall of Support; a mood check-in |
| Get involved | doors on a red band, each a photo tile that is all one link |
| Rooms and directions | the Hub first, as a red card with its photo; the other rooms as tickets under "Event rooms" |
| A room | numbered route steps beside a red card holding the address and the Drop in times |
| Craft nights | in sections: a red event hero with the next night and Drop in; what to expect; the schedule; recent nights in photos; a closing call; the accessibility line (Round 6) |
| Peer support groups | what a group is, in the live page's words; the Hub directions; the reel, which loads only after Play |
| Our team | groups of people cards, from Connect's opt-in profiles (fictional samples until the export exists) |
| Forms | two columns: the ruled form head beside the questions |

Every page is checked at 1280, 390 and 320 px by `npm run shots`. Nothing may scroll sideways at 320.
