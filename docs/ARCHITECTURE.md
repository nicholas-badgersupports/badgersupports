# Architecture

How the site is built and served, what the API does, where data lives, and what is not built yet. Every claim
names the file that makes it true. **Nothing here is deployed**: no Netlify project exists for this site, so
every statement about Netlify describes what the configuration asks for, not something seen running.

## The pieces

| Piece | File | What it is |
|---|---|---|
| The build | `ops/build.mjs` | turns `content/` into static pages in `dist/`, plus `.build/server.json` (what the API needs) and `.build/report.json` (what was built) |
| The API | `netlify/functions/api.mjs` → `netlify/lib/router.mjs` | one function, served at `/api/*` on the same origin as the pages |
| The database | `netlify/lib/db.mjs`, `netlify/database/migrations/` | Postgres: PGlite on a laptop, Netlify Database when deployed |
| The local rig | `ops/dev-server.mjs` | serves `dist/` with `_headers` and `_redirects` applied as Netlify would, and sends `/api/*` into the real function. It talks to no network |
| The gates | `ops/check.mjs` | `npm run check`; ends in a one-line verdict (`README.md`) |

`netlify.toml` asks for `node ops/build.mjs --fetch-media`, publishes `dist/`, bundles functions with esbuild,
includes `.build/server.json` and the migrations in the function, and keeps PGlite, Playwright, axe-core and
sharp out of the bundle. Its build is the **prototype** build: fixtures in, every page `noindex`.

## The build

### What it refuses

`loadContent()` checks everything before anything is written, and the build stops on the first list of
problems. It checks:

- every page: schema `bss.page/1`, an id matching `pg-…` and unique, a path made of lower-case segments ending
  in `/` and unique, a title;
- every block against its declaration in `src/render/registry.mjs` (ids `b-…`, required fields, field types);
- every photo slot with `photoProblems()` (`DESIGN.md`, "Photos"), every icon name, every text key;
- every room against `src/render/places.mjs`, and every directions block against a published room;
- every form against `src/shared/forms.mjs` (question ids `q-…`), and every form or door that names a form;
- events, the team and its groups, and that room and people pages do not collide with a page's path.

`--production` adds three refusals, one per fixture still in use:

- the event timetable needs Connect's public event export (Exchange request `PUBLIC-EVENTS-EXPORT`);
- the Wall of Support needs the moderated source (`PUBLIC-RESOURCES-AND-WALL`);
- the team needs Connect's public profile export (`PUBLIC-TEAM-PROFILES-2026-10-20`).

It then refuses, after rendering, anything that still leans on the live site (`cutoverProblems()`): a live
address in `content/routes.json` with no page here and no alias to one, and a link to a page this site does not
build. The new site takes over the live site's own address, so either would answer "not found" after the switch.
The prototype only lists them (`.build/report.json`; `research/ROUTES.md`).

Nothing runs `--production` yet.

### What it writes

| Output | Notes |
|---|---|
| `dist/<path>/index.html` | one per page, room (`/directions/<id>/`) and public profile |
| `dist/assets/css/site.<hash>.css` | tokens, base, layout, blocks, forms, motion, then generated focal-point and mood rules |
| `dist/assets/js/<hash>/` | the client modules, under one hash of all of them; a page loads only what its blocks declare |
| `dist/media/` | photo variants (`ops/media.mjs`) |
| `dist/calendar/<event>.ics` | one per upcoming dated event |
| `dist/_headers`, `dist/_redirects`, `dist/robots.txt` | below |
| `.build/server.json` | schema `bss.server/1`: site, routes, built paths, forms, mood options, media, text, form pages |
| `.build/report.json` | the date, each page, the calendar files, CSS, script and photo sizes, linked photos, pending links, waiting redirects |

`--text-edits=FILE` lays published text edits (`{ key: text }`) over `content/text.json`, as Connect's publish
would. `--today=` pins the date that decides which events are upcoming.

`robots.txt` disallows everything in the prototype. In production it disallows `/staff/` and `/api/` and points
at a `sitemap.xml` of every page that is not `noindex`.

### Headers

From `headersFile()` in `ops/build.mjs`, on every path:

- **Content-Security-Policy**: `default-src 'self'`; scripts from `'self'` plus the hash of the one inline script;
  styles, images (and `data:`), fonts and `connect-src` from `'self'`; `frame-src https://www.instagram.com` (the
  reel, which loads only after Play); `form-action 'self'`; `frame-ancestors 'none'`; `base-uri 'none'`;
  `object-src 'none'`. No inline style, so focal points are classes, not `style` attributes.
- `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; a `Permissions-Policy`
  turning off camera, microphone, geolocation, payment and USB; `Cross-Origin-Opener-Policy: same-origin`.
- In the prototype, `X-Robots-Tag: noindex`.

Hashed CSS, JS and media are cached for a year as immutable; fonts and brand marks for a week; calendar files for
an hour, as `text/calendar`.

### Redirects and pending links

An old address gets a 301 **only once its new page is built**. Until then it is reported as waiting, and links to
it go to the live page:

- `redirectsFile()` writes a redirect for each route in `content/routes.json` marked `redirect` (or `replace`
  with a new path) whose target exists in `dist/`. Old `/resources/*` pages map to `/resources/?topic=…`. Page
  aliases follow, then the team's, so a member's own old address wins.
- `resolveLink()` (`src/render/context.mjs`) sends a link to an unbuilt internal page to the same path on the
  live site, marked `data-pending`. No link is ever `#`.

The last build wrote 9 redirects, held 6 back and left 16 pending pages (`research/ROUTES.md`).

## The API

### Routes and tiers

Every route declares a tier, and `router.mjs` throws at load if one does not. A forgotten wrapper cannot ship a
private read in public, because there are no wrappers (the `netlify-backend-local-first` skill).

| Route | Method | Path | Tier |
|---|---|---|---|
| health | GET | `/api/health` | public |
| formState | GET | `/api/forms/<key>/state` | public |
| formSubmit | POST | `/api/forms/<key>/submit` | public |
| moodRead | GET | `/api/mood` | public |
| moodTap | POST | `/api/mood` | public |
| staffSubmissions | GET | `/api/staff/forms/<key>/submissions` | director |
| staffAny | any | `/api/staff/…` | director |

- **public**: anyone. A POST must come from this site, and is rate-limited.
- **director**: a director or admin signed in through Connect, reading only the forms their claims name. Connect
  single sign-on does not exist, so `requireDirector()` answers **401 to everyone**. `/staff/` is a page saying
  so. The design waits on Exchange request `PUBLIC-SITE-SSO` and `../../MASTER-PROMPT.md` §5.

### What every request goes through

1. No path matches: 404 `not.found`. A path matches with the wrong method: 405.
2. A POST whose `Sec-Fetch-Site` is not `same-origin` or `none`, or whose `Origin` is another site: 403
   `origin.refused`. A request with neither header passes, and still meets the rate limit and validation.
3. The director tier: 401, as above.
4. Bodies: at most 64 KiB (413), JSON or URL-encoded only (415), valid JSON (400).
5. Errors: a known error answers with its own status and code; a missing database or salt answers 503
   `config.missing`; anything else 500 `server.error`. A request that wants JSON, or any `/api/staff` path, gets
   JSON; a browser form post gets an HTML page.

Every API response is `Cache-Control: no-store` with `nosniff`. API pages are `noindex` and carry no analytics.

### Forms without JavaScript

A form posts as a plain HTML form, and every answer is a page:

| Outcome | Status | The person sees |
|---|---|---|
| Received | 200 | a thank-you with their reference |
| Closed while they were filling it in | 409 | the closed message, with their answers given back to keep |
| An answer is invalid | 422 | the form again with their answers and the errors; if the questions changed meanwhile, a notice saying so |
| Too many tries | 429 | the form again with their answers |

With JavaScript, `src/client/form.js` posts JSON and shows the same outcomes in place.

## Intake

`netlify/lib/intake.mjs`.

**Which definition.** The shipped definition in `content/forms/`, unless a newer version is published in
`form_versions`. A definition that fails `definitionProblems()` answers 503 `form.broken` rather than guess.

**Open or closed.** The switch row in `form_state` wins over the definition's own `state`. A form with no questions
is closed. The closed message comes from the switch row, else from the definition. The staff application ships
closed (`DECISIONS.md` §4).

**A submission**, in order:

1. Closed: refused with `form.closed`.
2. The hidden `_website` field filled: a thank-you, and nothing stored.
3. Answers checked by `validateAnswers()`, the same code the browser runs.
4. An idempotency key: the client's `_key`, or else a hash of the form, version, answers and the Chicago date.
   The same answers sent twice in a day are one submission.
5. One transaction:
   - the submission, with a reference like `WR-7K2M-QX9D` (a prefix, then eight characters of Crockford-style
     base32);
   - a `received` event;
   - outbox rows `connect.ingest` and `sheets.backup`;
   - a `mail.receipt` row, **held** as `sender-unverified`, only when the form is not anonymous, its receipt is
     `on` and the person gave an email. No form has its receipt `on`.

A second identical submission returns the first one's reference.

**Rate limits.** Forms: 10 an hour per form per connection. Mood: 30 an hour. The connection is an HMAC of the
address with `RATE_SALT`, cut to 32 characters. It is kept only in `rate_limits`, and windows older than a day are cleared at the next write. **No address is stored
with a submission.**

**Mood.** `netlify/lib/mood.mjs` adds one to a count for the day and the mood. Nothing records who tapped, and
nothing is sent to analytics.

## The database

### One seam, two engines

`createAdapter()` in `netlify/lib/db.mjs` picks:

| When | Engine | Migrations |
|---|---|---|
| `LOCAL_DB=pglite` (the dev server and every test) | PGlite, Postgres compiled to WebAssembly, in-process; in memory, or in `LOCAL_DB_DIR` | applied on boot |
| `NETLIFY_DB_URL` or `NETLIFY_DATABASE_URL` set | `@netlify/database` | applied by Netlify Database on deploy; the function never runs them |
| neither | none | every API call answers 503 `config.missing` (`test/intake.test.mjs`) |

Above the seam the code is the same, so a passing local run is evidence about production rather than about a test
double. Each test suite gets a fresh PGlite, so one suite's rate limits never fail the next.

`tx()` retries a transaction up to three times on a serialization failure or deadlock. Nothing that leaves the
database (mail, a fetch) happens inside one. That is what the outbox is for.

### Migrations

Numbered folders, `netlify/database/migrations/<NNN_name>/migration.sql`, the layout Badger SPILL uses. Each is
idempotent, and `bss_migrations` records which ran. There is one, `001_intake`:

| Table | Holds |
|---|---|
| `form_state` | the on/off switch per form, its closed message, and who changed it |
| `form_versions` | published definitions, by form and version |
| `submissions` | reference, form, version shown and version submitted, answers, anonymous flag, status (`new`, `in_review`, `done`, `spam`, `withdrawn`). Nothing that identifies the sender's connection |
| `submission_events` | what happened to a submission, by whom (an opaque Connect id) |
| `outbox` | work that leaves the site: kind, a unique dedupe key, state (`pending`, `held`, `sent`, `failed`, `cancelled`), attempts, next try, last error |
| `mood_daily` | a count per day per mood |
| `rate_limits` | a count per bucket per window |

**To verify before the first deploy.** Badger SPILL found that Netlify's own Git builds skip migrations while a
platform flag is off, and added `netlify/plugins/migrations-guard` to fail such a build. This site has no guard yet.
Whether the same holds here is unchecked (`../WORK.md`).

## What is not built

| Piece | State | Waits on |
|---|---|---|
| The outbox worker | rows are written; nothing sends them | an agreed Connect ingestion contract, a verified sender, the Sheets backup design (`COMMUNICATIONS.md`) |
| Director sign-in | every staff route answers 401 | Connect single sign-on (`PUBLIC-SITE-SSO`) |
| Editing in Connect | the build accepts published text edits; nothing publishes them | the editor (`PUBLIC-SITE-EDITOR`; the fields are in `CONNECT-EDITOR-CONTRACT.md`) |
| Events, wall, team | fictional fixtures | Connect's exports (above) |
| The resource viewer | not started | `PUBLIC-RESOURCES-AND-WALL`; `../../MASTER-PROMPT.md` §8 |

**Single owner, proposed.** Until Connect's ingestion contract is agreed, this site owns its submission rows, and
Connect reads them through the outbox. Nothing here copies Connect's roster (`../../MASTER-PROMPT.md` §5).

## Photos at build time

Each photo is encoded at build time and served from this site (`DESIGN.md`, "Photos").

- **Built on the laptop** (owner, 20 Oct 2026). Library originals live in the gitignored `local/media-originals/`.
  23 of the 34 come from the shared Drive and have no address the build can fetch, so a release is built on the
  laptop. A build anywhere else stops before encoding and lists every missing original (`ops/media.mjs`;
  `DESIGN.md`, "Building away from the laptop").
- A photo given by link is fetched on every build on a fresh machine, with a 25 MB ceiling and a 30-second
  timeout.
- **Open, proposed.** An allow-list of photo hosts for production builds. Today any public `https` host is fetched.

## Environment

| Variable | Needed for | Without it |
|---|---|---|
| `NETLIFY_DB_URL` or `NETLIFY_DATABASE_URL` | the database when deployed | 503 `config.missing` |
| `RATE_SALT` | rate limits when deployed | 503 `config.missing` on every rate-limited request |
| `LOCAL_DB`, `LOCAL_DB_DIR` | the local rig and tests only | — |

None is set anywhere, because no project exists. Set values never go in a file here.

## Cost

**Unverified.** No Netlify project exists, and nobody has read the account's plan. `../../MASTER-PROMPT.md` §11 asks
that no cost claim be made until the account, plan and current pricing are read from Netlify itself, and that
older claims that reads or previews are free not be repeated. What the design does to keep usage bounded:

- the pages are static, and hashed assets are cached for a year;
- photos are encoded once at fixed widths, with no resizing on request;
- the function runs only for form posts, the form state, mood taps and health;
- there is one function and one small database.

Each of these is a design choice, not a measured saving.
