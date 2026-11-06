# Badger Supports website — development

A static website built from versioned content, with native forms and an API. This guide describes
local development commands and the repository layout. A checkout or local build does not establish
the current deployment, domain configuration or release status.

See [Architecture](ARCHITECTURE.md) for the build and runtime, and [Extending the site](EXTENDING.md)
for adding pages and block types.

## Commands

Run from the repository root. Node 22 or later; install dependencies with `npm ci`.

| Command | What it does |
|---|---|
| `npm run build` | `node ops/build.mjs`: the prototype build into `dist/`. Fixtures allowed, every page `noindex`. Writes `.build/report.json` |
| `node ops/build.mjs --production` | reads the configured public feeds and refuses sample event/resource data or unresolved cutover links. Requires production configuration; see [The build](ARCHITECTURE.md#the-build) |
| `node ops/build.mjs --no-media` | skips the image variants |
| `npm run dev` | `node ops/dev-server.mjs`: builds, then serves the built assets, rendered pages and `/api` routes (default port 8899; `PORT=` to change, `--no-build` to serve the last build, `--today=YYYY-MM-DD` to pin the date) |
| `npm test` | every suite in `test/` (`node --test`, one at a time) |
| `npm run check` | the gates in order, ending in a one-line verdict. `--browser` adds screenshots and the accessibility scan |
| `npm run shots` | screenshots of every built page at 1280, 390 and 320 px into `local/shots/`, from a running server (`BASE=http://127.0.0.1:<port>`) |
| `npm run a11y` | axe-core over every built page |
| `npm run editable` | lists any word the code prints that is not a text key in `content/` (the answer must be zero) |
| `npm run contract` | regenerates `docs/CONNECT-EDITOR-CONTRACT.md` from the block declarations |
| `npm run media:fetch` | fetches photos given by link into `local/media-links/` |
| `npm run capture-live` | `<outDir> <path> …`: screenshots and image measurements of live pages, read only |

`node ops/provenance.mjs <corpus-folder>` compares every visible string with Badger Supports' own
material (see [Copy sources](research/COPY-SOURCES.md)). The corpus is not in this repository.

## What `npm run check` runs

1. **editable**: no visible string outside `content/`.
2. **contract**: `docs/CONNECT-EDITOR-CONTRACT.md` matches the block declarations.
3. **tokens**: no colour literal outside `src/styles/tokens.css`, and no text below 14 px.
4. **privacy**: every text file in the repository, these docs included, is scanned for an email
   address outside the allowed domains, a phone number other than the published crisis and UHS
   numbers, anything shaped like a credential, and any individual staff profile address.
5. **WORK.md**: exists and is under 180 lines.
6. **build**: the prototype build.
7. **delivered files**: built output contains only the allowed files, without source notes or maps.
8. **tests**: `npm test`.
9. **browser** (`--browser` only): screenshots and the axe scan against a server the check starts itself.

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

The local prototype uses fictional events, wall notes and team profiles from `content/fixtures/`.
Its pages carry `noindex`.

The production build reads configured public feeds for events and resources and refuses their
hand-typed fixtures. It does not use sample team profiles or wall notes in production; enabled
exports supply those records. It also refuses unresolved cutover links. These are build rules,
not evidence that a particular source version has been deployed. See [The build](ARCHITECTURE.md#the-build).

## The repository is public

The GitHub repository is public, so:

- Photo originals stay in `local/media-originals/`, which is gitignored. `media/manifest.json` holds
  metadata only, and the shared Drive folder is named without its address.
- Real names never go into `content/`, the fixtures, the tests or the docs. The team comes from
  Connect at runtime; production builds do not serialize people.
- No form responses, credentials or keys belong in any file here. The privacy gate enforces the
  patterns it can recognise. The rest is a rule.

## Other documents

| File | About |
|---|---|
| [DESIGN.md](DESIGN.md) | tokens, type, colour, photos, motion |
| [ARCHITECTURE.md](ARCHITECTURE.md) | static build, the API, the database, the outbox, cost |
| [ANALYTICS.md](ANALYTICS.md) | what the live site measures, what this one emits, and what it never collects |
| [COMMUNICATIONS.md](COMMUNICATIONS.md) | each form: who receives it, what is sent and from where, and the Sheets backup |
| [EXTENDING.md](EXTENDING.md) | adding a page, and adding a block |
| [research/ROUTES.md](research/ROUTES.md) | every live address and its disposition |
| [research/COPY-SOURCES.md](research/COPY-SOURCES.md) | where the words come from |
