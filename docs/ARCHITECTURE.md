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

`netlify.toml` asks for `node ops/build.mjs --fetch-media`, publishes `dist/`, bundles functions with esbuild,
includes `.build/server.json` and the migrations in the function, and keeps PGlite, Playwright, axe-core and
sharp out of the bundle (`!node_modules/@electric-sql/**`). Its build is the **prototype** build: fixtures in, every
page `noindex`. Setup file 6 runs it on the laptop through the Netlify CLI; the repository is never linked to Netlify.

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
forces it. An anonymous form carries only what it asked, flagged anonymous (`ingestPayload()`). The `sheets.backup` and
`mail.receipt` rows are still not sent.

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

**To verify before the first deploy.** Badger SPILL found that Netlify's own Git builds skip migrations while a
platform flag is off, and added `netlify/plugins/migrations-guard` to fail such a build. This site has no guard yet.
Whether the same holds here is unchecked (`../WORK.md`).

## What is not built

| Piece | State | Waits on |
|---|---|---|
| Connect's half | built in the intranet working tree, uncommitted: `publicsite.mjs`, migration `032_public_site`, `public-sso.html` | the owner running Connect's `_xfer/Public website setup` files: 1 saves the 17 files, 2 sets the keys and the one allowed return (`badgersupports-public.netlify.app`) in both projects, 3 publishes |
| Receipts and the Sheets backup | `mail.receipt` and `sheets.backup` rows are written; nothing sends them | a verified sender, the Sheets backup design (`COMMUNICATIONS.md`) |
| Publishing edits | saved edits wait in the database; a build lays them over the files | a deployed site with a database (file 6); who may publish is `site.publish`, set by a super admin |
| Opening and closing forms from Connect | the switch row works; nothing in Connect writes it | `PUBLIC-SITE-FORMS` |
| Events, wall, team | fictional fixtures | Connect's exports (above) |
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
- **Open, proposed.** An allow-list of photo hosts for production builds. Today any public `https` host is fetched.

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

**Read from Netlify on 20 Oct 2026.** The team is on Pro, 3,000 credits a month (the plan read with the Netlify
connector; [Credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).
A production deploy costs 15 credits; deploy previews, branch deploys and failed deploys cost 0; bandwidth is 20
credits a GB and web requests 2 per 10,000 ([How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)).
Running out pauses every project on the team. **Not verified:** what a draft deploy costs (the billing pages do
not name drafts) and what the database and function cost in use; `../../MASTER-PROMPT.md` §11 holds any claim
about those until it is read from Netlify. What the design does to keep usage bounded:

- the pages are static, and hashed assets are cached for a year;
- photos are encoded once at fixed widths, with no resizing on request;
- the function runs only for form posts, the form state, mood taps and health;
- there is one function and one small database.

Each of these is a design choice, not a measured saving.
