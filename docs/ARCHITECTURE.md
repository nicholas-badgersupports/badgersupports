# Architecture

How the site is built and served, what the API does, where data lives, and what is not built yet. Every claim
names the file that makes it true. **Nothing here runs deployed.** The Netlify project `badgersupports-public` exists (20 Oct 2026,
renamed the same day) with no build, database or function; a draft of the built pages sits behind Netlify's team
sign-in. `../PUBLIC-SITE-SETUP-2026-10-20/` file 6 puts the prototype build at `badgersupports-public.netlify.app`
with its database, but has not run. So every statement about Netlify's function and database describes what the
configuration asks for, not something seen running.

## The pieces

| Piece | File | What it is |
|---|---|---|
| The build | `ops/build.mjs` | turns `content/` into static pages in `dist/`, plus `.build/server.json` (what the API needs) and `.build/report.json` (what was built) |
| The API | `netlify/functions/api.mjs` → `netlify/lib/router.mjs` | one function, served at `/api/*` on the same origin as the pages |
| The database | `netlify/lib/db.mjs`, `netlify/database/migrations/` | Postgres: PGlite on a laptop, Netlify Database when deployed |
| Connect | `netlify/lib/connect.mjs`, `staff.mjs`, `deliver.mjs`, `edits.mjs` | the only code that talks to Badger Supports Connect: staff sign-in, handing each submission to Connect, and the words staff change with the edit button |
| The local rig | `ops/dev-server.mjs` | serves `dist/` with `_headers` and `_redirects` applied as Netlify would, and sends `/api/*` into the real function. It talks to no network |
| The gates | `ops/check.mjs` | `npm run check`; ends in a one-line verdict (`README.md`) |

`netlify.toml` asks for `node ops/build.mjs --production --fetch-media` in the production context and the
**prototype** build (fixtures in, every page `noindex`) everywhere else. It publishes `dist/`, bundles functions with
esbuild, includes `.build/server.json` and the migrations in the function, and keeps PGlite, Playwright, axe-core and
sharp out of the bundle (`!node_modules/@electric-sql/**`). The owner's publish file runs it on the laptop through
the Netlify CLI; the repository is never linked to Netlify. Since 23 Oct 2026 the production build reads Connect's
public events and resources when it runs (`ops/connect-feed.mjs`). Netlify gives no secret to a build run on a
laptop, so the publish file passes `PUBLIC_SITE_SERVICE_SECRET` from the owner's keys file; the address and key id
come from the project. If Connect cannot be read, nothing is built and the deploy online stays.

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

`--production` reads Connect's public event and resource lists as it builds (`ops/connect-feed.mjs`) and
refuses a hand-typed fixture for either; if Connect cannot be read, nothing is built. Two sources have no
export yet, so a production build shows neither sample:

- the Wall of Support renders nothing until the moderated source exists (`PUBLIC-RESOURCES-AND-WALL`);
- the team page shows its words without people until Connect's public profile export exists
  (`PUBLIC-TEAM-PROFILES-2026-10-20`).

It then refuses, after rendering, anything that still leans on the live site (`cutoverProblems()`): a live
address in `content/routes.json` with no page here and no alias to one, and a link to a page this site does not
build. The new site takes over the live site's own address, so either would answer "not found" after the switch.
The prototype only lists them (`.build/report.json`; `research/ROUTES.md`).

`netlify.toml` names `--production` as the build, so the owner's `../PUBLISH-WEBSITE-2026-10-23.command`
runs it on the laptop. Nothing in this repository runs it, and Claude never runs that file.

### What it writes

| Output | Notes |
|---|---|
| `dist/<path>/index.html` | one per page, room (`/directions/<id>/`) and public profile |
| `dist/assets/css/site.<hash>.css` | tokens, base, layout, blocks, forms, motion, then generated focal-point and mood rules |
| `dist/assets/js/<hash>/` | the client modules, under one hash of all of them; a page loads only what its blocks declare |
| `dist/media/` | photo variants (`ops/media.mjs`) |
| `dist/calendar/<event>.ics` | one per upcoming dated event |
| `dist/_headers`, `dist/_redirects`, `dist/robots.txt` | below |
| `.build/server.json` | schema `bss.server/1`: site, routes, built paths, forms, mood options, media, text, form pages, and the event blocks the API renders again ("Events between publishes") |
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

The build of 20 Oct 2026 wrote 17 redirects, held none back and left no pending pages (`research/ROUTES.md`).

## The API

### Routes and tiers

Every route declares a tier, and `router.mjs` throws at load if one does not. A forgotten wrapper cannot ship a
private read in public, because there are no wrappers (the `netlify-backend-local-first` skill).

| Route | Method | Path | Tier |
|---|---|---|---|
| health | GET | `/api/health` | public |
| formState | GET | `/api/forms/<key>/state` | public |
| formSubmit | POST | `/api/forms/<key>/submit` | public |
| formFile | POST | `/api/forms/<key>/files?q=<question>` | public |
| eventsPage | GET | `/api/events/<page id>` | public |
| eventCalendar | GET | `/api/calendar/<event>.ics` | public |
| moodRead | GET | `/api/mood` | public |
| moodTap | POST | `/api/mood` | public |
| authStart | GET | `/api/auth/start` | public |
| authCallback | GET | `/api/auth/callback` | public |
| authSignOut | POST | `/api/auth/signout` | public |
| authStatus | GET | `/api/auth/status` | public |
| staffMe | GET | `/api/staff/me` | director |
| staffForms | GET | `/api/staff/forms` | director |
| staffSubmissions | GET | `/api/staff/forms/<key>/submissions` | director |
| staffRetry | POST | `/api/staff/outbox/retry` | director |
| editSource | GET | `/api/staff/edit/source` | director |
| editSave | POST | `/api/staff/edit/save` | director |
| editsFile | GET | `/api/staff/edits` | director |
| staffAny | any | `/api/staff/…` | director |

- **public**: anyone. A POST must come from this site, and is rate-limited. Sign-in is public because it is how a
  session starts; its routes share a limit of 30 an hour per connection. `/api/auth/status` always answers 200, so
  the staff page can ask whether anyone is signed in without the browser logging a refusal for every visitor.
- **director**: someone signed in through Connect ("Staff sign-in", below). The tier proves a session; each route
  then checks its scope: `forms.read:<key>` (or `forms.read:*`) to read a form's answers, `site.edit` to change
  words, `site.publish` to download saved changes for a publish. A super admin sets which tiers carry which scope in
  Connect (Admin > Website Forms, `adminSetPublicSitePermissions`); a super admin always has all of them. Without a session, `requireDirector()` answers 401 with `configured`, which tells `/staff/` whether
  signing in can work on this copy at all.

### What every request goes through

1. No path matches: 404 `not.found`. A path matches with the wrong method: 405.
2. A POST whose `Sec-Fetch-Site` is not `same-origin` or `none`, or whose `Origin` is another site: 403
   `origin.refused`. A request with neither header passes, and still meets the rate limit and validation.
3. The director tier: 401 without a session; 403 `staff.forbidden` without the route's scope.
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

### Events between publishes

A page built from Connect's events carries `data-refresh="events"` when it has a block that declares `refresh`
(schedule, events, event hero, directions, and program when it lists upcoming events). As it loads,
`src/client/schedule.js` asks `/api/events/<page id>` and swaps in what changed: only the `data-live` parts where a
block has them, otherwise the section; an empty answer hides the section. If the ask fails, the page stays as published.

`netlify/lib/live-events.mjs` answers with the build's own renderer, from what the build wrote into `server.json`
(`events`: each page's refreshing blocks, the places, the programs, Connect's reading rules; no key) and Connect's
`publicEvents` now. A warm function asks Connect at most once a minute. The CDN holds an answer five minutes, and
ten more while it refetches; a browser one minute. When Connect cannot be read the answer is the publish's list,
held half a minute. Calendar buttons on these pages open `/api/calendar/<event>.ics`, made the same way; an event
gone since the page loaded gets a short page saying so. Both routes refuse a query string, so nobody can ask past
the cache. A prototype build answers from its fixtures and never calls Connect. A block that was not on the
published page cannot appear before the next publish.

## Intake

`netlify/lib/intake.mjs`.

**Which definition.** The shipped definition in `content/forms/`, unless a newer version is published in
`form_versions`. A definition that fails `definitionProblems()` answers 503 `form.broken` rather than guess.

**Open or closed.** The switch row in `form_state` wins over the definition's own `state`. A form with no questions
is closed. The closed message comes from the switch row, else from the definition. Both applications ship
closed (`DECISIONS.md` §4); a prototype build gives each a preview page at `/forms/<key>/preview/` that checks
answers and sends nothing.

**A submission**, in order:

1. Closed: refused with `form.closed`.
2. The hidden `_website` field filled: a thank-you, and nothing stored.
3. Answers checked by `validateAnswers()`, the same code the browser runs. A file answer must name an upload
   for that question, not yet claimed, or it is refused as `file-missing`.
4. An idempotency key: the client's `_key`, or else a hash of the form, version, answers and the Chicago date.
   The same answers sent twice in a day are one submission.
5. One transaction:
   - the submission, with a reference like `WR-7K2M-QX9D` (a prefix, then eight characters of Crockford-style
     base32);
   - a `received` event;
   - its uploads claimed, and each file answer turned into its name, size and SHA-256 (never its bytes);
   - outbox rows `connect.ingest` and `sheets.backup`;
   - a `mail.receipt` row, **held** as `sender-unverified`, only when the form is not anonymous, its receipt is
     `on` and the person gave an email. No form has its receipt `on`.

A second identical submission returns the first one's reference.

**Files** (`netlify/lib/files.mjs`). A file question takes one PDF of at most 3 MB. The browser sends it to
`/api/forms/<key>/files` as soon as it is chosen, so a refusal is said at once: the form closed (409), not a file
question (404), not a PDF by type or by its first bytes (415), too big (413). All but the last two are decided
before a byte is read. The reply is an id; Send carries only that. Nothing serves a file back: there is no route out.
An upload nobody claimed is deleted after a day. Twenty uploads an hour per form per connection.

**Rate limits.** Forms: 10 an hour per form per connection. Mood: 30 an hour. Files: 20 an hour. The connection is an HMAC of the
address with `RATE_SALT`, cut to 32 characters. It is kept only in `rate_limits`, and windows older than a day are cleared at the next write. **No address is stored
with a submission.**

**Mood.** `netlify/lib/mood.mjs` adds one to a count for the day and the mood. Nothing records who tapped, and
nothing is sent to analytics.

## Staff sign-in and Connect

**Signing in** (`netlify/lib/staff.mjs`). This site keeps no accounts, passwords or roster. `/api/auth/start` sets a
random state in a ten-minute cookie, keeps a PKCE verifier and nonce in `auth_starts`, and sends the browser to
Connect's `public-sso.html` with the state and the verifier's hash in the fragment. The director signs in there as
they always do. Connect sends them back to `/api/auth/callback` with a one-time code; the state must match the cookie
and a start not yet used, and the code is traded server to server for a note Connect signs with `PUBLIC_SSO_SECRET`
(`connect.mjs`, `verifyAssertion()`). The note gives Connect's own id for the person, their first name (empty when
Connect's setting says not to share first names) and their scopes. A row in `staff_sessions`, keyed by a hash of the cookie, keeps it for **eight hours**. The cookies are
HttpOnly, `SameSite=Lax`, and `__Host-` on https. A third cookie, `bss_staff_hint`, says only that someone signed
in on this browser, so pages know to load the edit button; every staff call checks the real session. Signing out
ends this site's session only; someone switched off in Connect keeps one already open here until it ends, and
cannot start another.

**Handing a submission to Connect** (`deliver.mjs`). After a submission is saved and the reply sent, the function
sends due `connect.ingest` rows to Connect's Website Forms queue, signed with `PUBLIC_SITE_SERVICE_SECRET`. Opening
`/staff/` sends anything still waiting. A failure backs off and is retried; "Send waiting answers now" on the staff page
forces it. An anonymous form carries only what it asked, flagged anonymous (`ingestPayload()`). A form with files
adds a `files` list (question, id, name, size, SHA-256), and a column holding a confidential answer is marked
`confidential`. Each answer is sent as words ("1. Programs"); one chosen from options also comes in `optionIds`,
because labels can be edited. Connect's ingest drops all three extras today (Exchange `APPLICATION-FILES-HANDOVER`). The `sheets.backup` and
`mail.receipt` rows are still not sent.

**The staff page** (`answers.mjs`) leaves out every question marked `confidential` (work study, commitments): the
form rules send those to Connect only, where who may read them is set.

**The edit button** (`edits.mjs`, `src/client/edit.js`). A signed-in person with `site.edit` sees **Edit text** at
the bottom right of any page. A change is a row in `content_edits`, the latest per place, with the words it
replaced. The shipped files stay the floor. On the local rig a save rebuilds the pages at once; deployed, a change
waits for the next build, which lays `/api/staff/edits?download=1` (saved as `content/edits.json`) over the files.
That download needs `site.publish`.

**Trying it on a laptop.** `PORT=8901 node ops/dev-server.mjs --connect=http://127.0.0.1:8903` signs in and
delivers through a local Connect rig (`PORT=8903 node ops/dev.mjs --seed` in the intranet folder), with that rig's
demo keys. Three things the rig needs: open it at `127.0.0.1`, never `localhost`, or its same-site check fails;
the site must be on 8899 or 8901, the two returns it accepts; and its seeded account must change its password
before it may sign in anywhere else. A script calling the rig's `/api` must send an `Origin` header, or it is
refused. `../PUBLIC-SITE-SETUP-2026-10-20/` file 5 does all of this on a copy of Connect outside the synced
folder. **This is a local rig with demo keys and in-memory databases, not a live connection.**

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
idempotent, and `bss_migrations` records which ran. `001_intake`:

| Table | Holds |
|---|---|
| `form_state` | the on/off switch per form, its closed message, and who changed it |
| `form_versions` | published definitions, by form and version |
| `submissions` | reference, form, version shown and version submitted, answers, anonymous flag, status (`new`, `in_review`, `done`, `spam`, `withdrawn`). Nothing that identifies the sender's connection |
| `submission_events` | what happened to a submission, by whom (an opaque Connect id) |
| `outbox` | work that leaves the site: kind, a unique dedupe key, state (`pending`, `held`, `sent`, `failed`, `cancelled`), attempts, next try, last error |
| `mood_daily` | a count per day per mood |
| `rate_limits` | a count per bucket per window |

`002_staff`:

| Table | Holds |
|---|---|
| `auth_starts` | a sign-in gone to Connect and not yet back, keyed by a hash of its state; used once, ten minutes |
| `staff_sessions` | a signed-in person, keyed by a hash of the cookie: Connect's id, first name, scopes, expiry |
| `content_edits` | a word changed with the edit button: place, words, the words replaced, who and when |

`003_files`:

| Table | Holds |
|---|---|
| `uploads` | one PDF: its id, form, question, name, size (1 byte to 3 MB), SHA-256 and bytes; the submission that claimed it, when, and when Connect confirmed it |

**The migrations guard** (`netlify/plugins/migrations-guard`, Badger SPILL's, run from `netlify.toml`). Netlify
applies only the migrations a deploy carries, and a deploy carries only what its "Netlify Database setup" step copied
into `.netlify/internal/db/migrations`. On 16 October 2026 three of Badger SPILL's builds skipped that step and
published code ahead of the database. Here the build runs on the laptop, through Netlify's command line, and the step
ran on both publishes (the logs of 20 and 23 October, `~/Builds/badgersupports-live-*.log`, list `001_intake` and
`002_staff`). The guard checks it every time: after the build, any migration not copied, or copied with different
SQL, stops the deploy before it publishes, and the site online stays as it was. Measured 23 October against the
23 October build folder: it passes, and with `003_files` added and not copied it stops naming it
(`test/migrations-guard.test.mjs`). The next publish is the first to add a migration (`003_files`).

## What is not built

| Piece | State | Waits on |
|---|---|---|
| Connect's half | built in the intranet working tree, uncommitted: `publicsite.mjs`, migration `032_public_site`, `public-sso.html` | the owner running Connect's `_xfer/Public website setup` files: 1 saves the 17 files, 2 sets the keys and the one allowed return (`badgersupports-public.netlify.app`) in both projects, 3 publishes |
| Receipts and the Sheets backup | `mail.receipt` and `sheets.backup` rows are written; nothing sends them. The backup must skip `confidential` columns | a verified sender, the Sheets backup design (`COMMUNICATIONS.md`) |
| Application files reaching Connect | stored and claimed here; `delivered_at` is never set | Connect fetching them by id (Exchange `APPLICATION-FILES-HANDOVER`) |
| Publishing edits | saved edits wait in the database; a build lays them over the files | a deployed site with a database (file 6); who may publish is `site.publish`, set by a super admin |
| Opening and closing forms from Connect | the switch row works; nothing in Connect writes it | `PUBLIC-SITE-FORMS` |
| Wall, team | samples in the prototype; a production build shows neither | `PUBLIC-RESOURCES-AND-WALL`, `PUBLIC-TEAM-PROFILES-2026-10-20` |
| Recent events | a production build lists none: Connect's public export holds upcoming events only. The site reads a `recent` list when Connect sends one (`ops/connect-feed.mjs`) | Exchange `PUBLIC-EVENTS-RECENT-2026-10-23`; `../WORK.md` item 30 |
| The resource viewer | not started | `PUBLIC-RESOURCES-AND-WALL`; `../../MASTER-PROMPT.md` §8 |

**Single owner, proposed.** This site owns its submission rows, and hands Connect a copy through the outbox.
Connect's copy is what the team works from. Nothing here copies Connect's roster (`../../MASTER-PROMPT.md` §5).

## Photos at build time

Each photo is encoded at build time and served from this site (`DESIGN.md`, "Photos").

- **Built on the laptop** (owner, 20 Oct 2026). Library originals live in the gitignored `local/media-originals/`.
  23 of the 34 come from the shared Drive and have no address the build can fetch, so a release is built on the
  laptop. A build anywhere else stops before encoding and lists every missing original (`ops/media.mjs`;
  `DESIGN.md`, "Building away from the laptop").
- A photo given by link is fetched on every build on a fresh machine, with a 25 MB ceiling and a 30-second
  timeout.
- **Production fetches from a fixed list of hosts** (built 23 Oct 2026): Google Drive and the organisation's own
  sites (`PHOTO_HOSTS`, `src/render/media.mjs`), every redirect checked against the same list (`DESIGN.md`).

## Environment

| Variable | Needed for | Without it |
|---|---|---|
| `NETLIFY_DB_URL` or `NETLIFY_DATABASE_URL` | the database when deployed | 503 `config.missing` |
| `RATE_SALT` | rate limits when deployed | 503 `config.missing` on every rate-limited request |
| `CONNECT_URL` | sign-in and delivery: Connect's origin | sign-in says "not set up"; submissions wait in the outbox |
| `PUBLIC_SITE_SERVICE_KEY_ID`, `PUBLIC_SITE_SERVICE_SECRET` | signing calls to Connect; the pair Connect lists in its `PUBLIC_SITE_SERVICE_KEYS` | as above |
| `PUBLIC_SSO_SECRET` | checking Connect's sign-in note; the same value Connect signs with | as above |
| `LOCAL_DB`, `LOCAL_DB_DIR` | the local rig and tests only | — |

None has been set: the project was created empty on 20 Oct 2026. Set values never go in a file here.

## Cost

**Read from Netlify on 20 and 23 Oct 2026**, with the Netlify connector and Netlify's billing pages. The team is
on Pro, 3,000 credits a month, and **three projects draw on them**: this site, `badgerspill` (badgerspill.org) and
`badger-supports-intranet` (home.badgersupports.org). Running out pauses all three until the next period or a
purchase. Auto recharge is off unless a Team Owner turns it on; Pro can buy 1,500 credits for $10, and bought
credits roll over ([Credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/),
[How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)).

| Meter | Credits | Source |
|---|---|---|
| Production deploy | 15 each | How credits work |
| Deploy preview, branch deploy, failed deploy, rollback | 0 | How credits work |
| Bandwidth, web and database | 20 a GB | How credits work |
| Web requests | 2 per 10,000 | How credits work |
| Function compute | 10 a GB-hour (run time × memory) | How credits work |
| Database compute | 10 a compute-unit-hour while awake, at least 1 CU; auto-scale 1 to 4 CU by default | [Database billing](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/) |
| Form submissions, build minutes | 0 | How credits work |

**The database is the meter to watch.** It sleeps after 5 idle minutes and wakes on the next query
([Sleep on inactivity](https://docs.netlify.com/build/data-and-storage/netlify-database/configure-sleep-on-inactivity/)),
so it costs the time it is awake, not the number of queries: each separate wake is at least 5 minutes, about
0.8 credits, and a database that never sleeps is 720 CU-hours, **7,200 credits in 30 days at 1 CU**, more than the
plan. Here it wakes for a form page (the state check as the form loads, `src/client/form.js`), a send, an upload,
a mood tap, a sign-in and the staff pages. `/api/events` and `/api/calendar` read Connect and the build's
`server.json`, never the database; `/api/health` reads nothing. There is no scheduled function.

**Measured, 16 to 23 Oct 2026** (Netlify observability, 7 days; the site is behind Netlify's sign-in, so this is
staff traffic, not visitors): 953 requests, 9.1 MB, 34 of them to the function, which ran in 5 of the week's
2,016 five-minute windows. From the build: the home page's first view is 371 KB (53 KB of HTML, CSS and
JavaScript gzipped; 11 photos at 640 px AVIF, 318 KB), the fonts 72 KB, and assets are cached for a year.

**A month, modelled.** The prices are Netlify's; the traffic is an assumption until the site is public.

| | Quiet month | Busy month (recruiting) |
|---|---|---|
| Assumed | 3,000 page views, 300 form pages, 60 sends, 2 publishes | 20,000 page views, 2,000 form pages, 400 sends, 8 publishes |
| Bandwidth, 0.4 MB a view with nothing cached | 1.2 GB: 24 | 8 GB: 160 |
| Requests, 20 a view | 60,000: 12 | 400,000: 80 |
| Function | under 5 | at most 35 (below) |
| Database, every form page its own wake | at most 300 | at most 2,000 |
| Publishes, 15 each | 30 | 120 |
| **This site** | **at most about 370** | **at most about 2,400** |

The CDN holds `/api/events` five minutes, so six refreshing pages viewed without a pause cost at most 51,840 calls
in 30 days: about 35 credits at 0.24 s and 1 GB. Netlify's pages give no default function memory; 1 GB is assumed.

**The other two projects are the larger risk.** In the 24 hours to 21:45 on 23 Oct, badgerspill's `worker` ran
every five minutes and its `sync` every thirty, a server called its `/api/service` about every 36 seconds, and a
server called the intranet's `/api` every one to three minutes. Every hour of the 7 days before shows the same. If
those calls query a database, it never sleeps: 7,200 credits each in 30 days at 1 CU. The three sites were serving
on 23 Oct, so the team had not run out; that fits databases that sleep or credits that were bought, and only
Netlify's Billing → Usage tells which. Bandwidth, requests and functions are small: the same week projects to about
35, 79 and 150 credits in 30 days for the three together (functions at 1 GB and their median run time). Left for
the intranet session in `Admin/Handoffs/Exchange/to-intranet/NETLIFY-DATABASE-AWAKE-2026-10-23.md`.

What keeps this site's usage bounded, and what would cut it further:

- the pages are static; hashed assets and photos are cached for a year;
- photos are encoded once, at build time, at fixed widths, from a fixed list of hosts; nothing resizes on request;
- `/api/events` is held by the CDN and refuses a query string, so nobody can ask past the cache;
- sleep on inactivity stays at its default, 5 minutes, the shortest Netlify offers;
- **recommended, not done:** check a form's state when the visitor first types in it, not as it loads, so a page
  view alone never wakes the database. The busy month's database line falls from 2,000 to about 400, since sends
  and uploads still wake it. The server still decides at Send;
- **owner settings:** set this database's auto-scale maximum to 1 CU, so a burst cannot cost four times as much;
  decide on auto recharge; read Billing → Usage weekly while the site is new. Netlify offers no alert on credits
  except an AI usage limit.

**Not verified:** how many production deploys the three projects make (the connector cannot list deploys); what
each database used; the functions' memory; what a draft deploy costs (the billing pages do not name drafts);
database storage, which the billing page (14 Aug 2026) says is billed no earlier than 1 July 2026, with no rate
given. `../../MASTER-PROMPT.md` §11 holds any claim about those until it is read from Netlify.
