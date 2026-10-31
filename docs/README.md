# www.badgersupports.org — the rebuild

A static website built from versioned content, with native forms and one small API. It is meant to
replace the Google Sites site at https://www.badgersupports.org. **It is a prototype.** Nothing here is
deployed: the Netlify configuration (`netlify.toml`) is not connected to any Netlify project, and no
DNS points at it.

The owner's brief is `../../MASTER-PROMPT.md`, beside this repository and not in it, as are `FORM-AUDIT.md` and
`INVESTIGATION.md`. The decisions it rests on are in `DECISIONS.md`, and the
work still open is in `../WORK.md`.

## Commands

Run from `site/`. Node 22 or later.

| Command | What it does |
|---|---|
| `npm run build` | `node ops/build.mjs`: the prototype build into `dist/`. Fixtures allowed, every page `noindex`. Writes `.build/report.json` |
| `node ops/build.mjs --production` | refuses to build while any fixture is in use (events, wall notes, team), or while any live address or link still depends on the live site (`docs/research/ROUTES.md`). Nothing runs it yet |
| `node ops/build.mjs --no-media` | skips the image variants |
| `npm run dev` | `node ops/dev-server.mjs`: builds, then serves `dist/` and the `/api` function (default port 8899; `PORT=` to change, `--no-build` to serve the last build, `--today=YYYY-MM-DD` to pin the date) |
| `npm test` | every suite in `test/` (`node --test`, one at a time) |
| `npm run check` | the gates in order, ending in a one-line verdict. `--browser` adds screenshots and the accessibility scan |
| `npm run shots` | screenshots of every built page at 1280, 390 and 320 px into `local/shots/`, from a running server (`BASE=http://127.0.0.1:<port>`) |
| `npm run a11y` | axe-core over every built page |
| `npm run editable` | lists any word the code prints that is not a text key in `content/` (the answer must be zero) |
| `npm run contract` | regenerates `docs/CONNECT-EDITOR-CONTRACT.md` from the block declarations |
| `npm run media:fetch` | fetches photos given by link into `local/media-links/` |
| `npm run capture-live` | `<outDir> <path> …`: screenshots and image measurements of live pages, read only |

`node ops/provenance.mjs <corpus-folder>` compares every visible string with Badger Supports' own
material (see `research/COPY-SOURCES.md`). The corpus is not in this repository.

## What `npm run check` runs

1. **editable**: no visible string outside `content/`.
2. **contract**: `docs/CONNECT-EDITOR-CONTRACT.md` matches the block declarations.
3. **tokens**: no colour literal outside `src/styles/tokens.css`, and no text below 14 px.
4. **privacy**: every text file in the repository, these docs included, is scanned for an email
   address outside the allowed domains, a phone number other than the published crisis and UHS
   numbers, anything shaped like a credential, and any individual staff profile address.
5. **WORK.md**: exists and is under 180 lines.
6. **build**: the prototype build.
7. **tests**: `npm test`.
8. **browser** (`--browser` only): screenshots and the axe scan against a server the check starts itself.

A gate's result is its printed line, not the exit code. Read the output.

## Folders

```
site/
├── content/          everything a visitor reads: pages, forms, rooms, text, site settings
│   ├── pages/        one JSON file per page, made of blocks
│   ├── forms/        native form definitions (bss.form/1)
│   ├── places/       rooms and directions
│   ├── fixtures/     fictional events, wall notes and team, for the prototype only
│   ├── widgets/      the mood check-in's options and replies
│   ├── routes.json   every live address and what happens to it (research/ROUTES.md)
│   ├── site.json     name, navigation, footer, crisis line
│   └── text.json     interface words (buttons, labels, messages)
├── src/
│   ├── render/       the page builder: layout, blocks/, media, places, team, events, calendar files
│   ├── client/       small browser modules, loaded only by the pages whose blocks need them
│   ├── shared/       code both the browser and the server run (form rules, text)
│   └── styles/       tokens, base, layout, blocks, forms, motion
├── netlify/
│   ├── functions/    api.mjs, the one function, served at /api
│   ├── lib/          router (with access tiers), db, intake, mood, content, http
│   └── database/     numbered migrations
├── media/            manifest.json: photo metadata only, never the photos
├── assets/           fonts and brand marks
├── ops/              build, dev server, checks, screenshots, media
├── test/             node:test suites
├── docs/             these documents
├── local/            gitignored: photo originals, caches, test builds, screenshots
└── dist/             gitignored: the built site
```

## Prototype and production

The prototype build reads three fixtures. Every person, wall note and event in them is fictional:

- `content/fixtures/events.json`: craft nights and peer support groups. Connect's public events
  export will replace it (Exchange request `PUBLIC-EVENTS-EXPORT`).
- `content/fixtures/wall-notes.json`: Wall of Support notes.
- `content/fixtures/team.json`: the team page. Connect's public profiles will replace it
  (Exchange request `PUBLIC-TEAM-PROFILES-2026-10-20`).

Every page the prototype builds carries `noindex`. `--production` refuses to build until each fixture
has a real source and nothing still depends on the live site.

## The repository is public

The GitHub repository is public, so:

- Photo originals stay in `local/media-originals/`, which is gitignored. `media/manifest.json` holds
  metadata only, and the shared Drive folder is named without its address.
- Real names never go into `content/`, the fixtures, the tests or the docs. The team comes from
  Connect at build time.
- No form responses, credentials or keys belong in any file here. The privacy gate enforces the
  patterns it can recognise. The rest is a rule.

## Other documents

| File | About |
|---|---|
| `DECISIONS.md` | the owner's rulings, dated, and the choices this rebuild made in their absence |
| `DESIGN.md` | tokens, type, colour, photos, motion |
| `ARCHITECTURE.md` | static build, the API, the database, the outbox, cost |
| `ANALYTICS.md` | what the live site measures, what this one emits, and what it never collects |
| `COMMUNICATIONS.md` | each form: who receives it, what is sent and from where, and the Sheets backup |
| `EXTENDING.md` | adding a page, and adding a block |
| `CONNECT-EDITOR-CONTRACT.md` | generated: every block's fields, for the editor in Connect |
| `research/ROUTES.md` | every live address and its disposition |
| `research/COPY-SOURCES.md` | where the words come from |
