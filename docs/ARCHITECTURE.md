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
public events and resources when it runs (`ops/connect-feed.mjs`). Netlify gives a build run on a laptop only a short
stand-in for a secret, so the publish file passes the key from the owner's keys file as `PUBLISH_SERVICE_SECRET`, a
name Netlify does not hold; the address and key id come from the project. If Connect cannot be read, nothing is built and the deploy online stays.

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
| signinQuotes | GET | `/api/signin-quotes` | public |
| staffMe | GET | `/api/staff/me` | director |
| staffForms | GET | `/api/staff/forms` | director |
| staffSubmissions | GET | `/api/staff/forms/<key>/submissions` | director |
| staffRetry | POST | `/api/staff/outbox/retry` | director |
| editSource | GET | `/api/staff/edit/source` | director |
| editSave | POST | `/api/staff/edit/save` | director |
| editsFile | GET | `/api/staff/edits` | director |
| refresh | POST | `/api/staff/refresh` | director |
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

**Owner revision · 30 October 2026 — built and published the same day (`a78d13e`, WORK item 20).** What
this site does is in "This site's half" at the end of this section; the rules it follows are these. Connect GOOGLE-SIGNIN and `docs/signin-rebuild/SPEC.md`/`DECISIONS.md` queue common behavior for its
ordinary sign-in and credential-entry `public-sso.html`/`spill-sso.html` doors, sharing `sso-door.js`: one email field
plus Sign In launches Google when enabled, with hints for exact `wisc.edu`/`badgersupports.org`. An accessible logo
control reveals the ordinary password route for this visit; refresh/new visit resets it. Google off/missing
configuration restores passwords. This applies to sign-in logos, not this website's header or invitation/setup pages.

Connect verifies the signed identity, permitted hd/domain, email, audience, expiry and nonce; the entered and returned
addresses may differ only as approved addresses already attached to the same active existing person. Multiple
verified Google subjects may bind to that person, never another person. No new account, role or automatic alias.
Google-derived sessions skip password-only setup/change gates, including Connect public authorize/token/status
checks, while terms, current status and grants remain. Public still verifies state, nonce, signature, audience,
expiry, PKCE, allowed return and scopes on the server; authenticated provider/availability metadata prevents a
disabled Google route from being reused. Preserve existing freshness, scope narrowing and revocation boundaries.

Google authentication belongs on Connect: add no Google SDK/client or account/password store to this public site,
and keep its restrictive CSP. Queue removal of ordinary `/staff/` About Signing In help and the matching Connect
warning/help; consume the same optional quote list/switch owned in Connect Settings, never a local writable copy.
Bulk plain-text entries, safe rendering, one selection per page load stable while typing; off/empty/unavailable means
no quote/help and never blocks sign-in. No approved starter quotes. Future consumer anchors: `content/pages/staff.json`,
`src/render/blocks/staff.mjs`, `netlify/lib/staff.mjs`, `netlify/lib/connect.mjs` and `test/staff.test.mjs`.
The password-seeded rig below is password-flow evidence, not a Google test. The tests are stand-ins for Connect; Nicholas
reported a real Google round trip before Connect's Google switch went on (30 Oct 2026).

**This site's half (built 30 Oct 2026, local).** The help under the button is gone from `content/pages/staff.json` and
`blocks/staff.mjs` (its two fields with it). `GET /api/signin-quotes` (router, public, `no-store`) returns Connect's
`publicSigninQuotes` list, read by `signinQuotes()` in `connect.mjs` at most every five minutes and `[]` on any
failure; `staff.js` picks one per page load into `[data-staff-quote]` and shows it only beside the Sign in button.
`verifyAssertion()` returns the signed note's `method` (`password` when absent); `finishSignIn()` keeps it in
`staff_sessions.method` (migration 007); `sessionFrom()` sends it with each status check, so a Google-opened session
ends here once Connect's Google route is off. With `CONNECT_SESSION_STATUS` off nothing asks, and a Google-opened
session lasts its normal life: switching Google off in Connect does not reach this site until the flag is on.
Tests: `test/staff.test.mjs`, two tests named for Google and quotes.

**Signing in** (`netlify/lib/staff.mjs`). This site keeps no accounts, passwords or roster. `/api/auth/start` sets a
random state in a ten-minute cookie, keeps a PKCE verifier and nonce in `auth_starts`, and sends the browser to
Connect's `public-sso.html` with the state and the verifier's hash in the fragment. The director signs in there as
they always do. Connect sends them back to `/api/auth/callback` with a one-time code; the state must match the cookie
and a start not yet used, and the code is traded server to server for a note Connect signs with `PUBLIC_SSO_SECRET`
(`connect.mjs`, `verifyAssertion()`). The note gives Connect's own id for the person, their first name (empty when
Connect's setting says not to share first names) and their scopes. A row in `staff_sessions`, keyed by a hash of the cookie, keeps it for **eight hours**. The cookies are
HttpOnly, `SameSite=Lax`, and `__Host-` on https. A third cookie, `bss_staff_hint`, says only that someone signed
in on this browser, so pages know to load the edit button; every staff call checks the real session. Signing out
ends this site's session only. **Reading answers lasts an hour from signing in** (built 24 Oct 2026); after that
the staff page asks for a fresh sign-in, while editing and publishing words last the eight hours. Someone switched
off in Connect cannot sign in again, and so loses the answers within the hour. "Staying signed in", below, has the
proposed change that would make a session follow Connect within minutes.

**Handing a submission to Connect** (`deliver.mjs`). After a submission is saved and the reply sent, the function
sends due `connect.ingest` rows to Connect's Website Forms queue, signed with `PUBLIC_SITE_SERVICE_SECRET`. Since 25
Oct 2026 (built locally): a worker claims its rows in one statement (`006_outbox_claims`), so two instances never
send one row; a failed row waits 2, 4, 8, then 15 minutes at most; `runOutbox()` is what a scheduled function would
call every 15 minutes, so a due retry happens within 30, and it reads when work is next due from a note outside the
database, so an idle run never wakes it. The schedule is not registered (owner action, `COMMUNICATIONS.md`). Opening
`/staff/` only reads; it sends nothing (owner ruling, 24 Oct 2026). A failure backs off and is retried by the next
submission. **Send waiting answers now** on the staff page sends at once, and only the forms that reader may read, checked on the
server (`staffRetry()`, `router.mjs`): every form for `forms.read:*`, otherwise the forms named. Someone else's
waiting answers stay where they are. An anonymous form carries only what it asked, flagged anonymous (`ingestPayload()`). A form with files
adds a `files` list (question, id, name, size, SHA-256), and a column holding a confidential answer is marked
`confidential`. Each answer is sent as words ("1. Programs"); one chosen from options also comes in `optionIds`,
because labels can be edited. Connect's ingest drops all three extras today (Exchange `APPLICATION-FILES-HANDOVER`). The `sheets.backup` and
`mail.receipt` rows are still not sent.

**The staff page** (`answers.mjs`) leaves out every question marked `confidential` (work study, commitments): the
form rules send those to Connect only, where who may read them is set.

**The edit button** (`edits.mjs`, `src/client/edit.js`). A signed-in person with `site.edit` sees **Edit text** at
the bottom right of any page. A change is a row in `content_edits`, the latest per place, with the words it
replaced. The shipped files stay the floor. Since 25 Oct 2026 (built locally, not deployed) a save publishes:
"Publishing a save", above. `/api/staff/edits?download=1` is the same words as a file a build can lay over the
files (`content/edits.json`); it needs `site.publish`.

**Trying it on a laptop.** `PORT=8901 node ops/dev-server.mjs --connect=http://127.0.0.1:8903` signs in and
delivers through a local Connect rig (`PORT=8903 node ops/dev.mjs --seed` in the intranet folder), with that rig's
demo keys. Three things the rig needs: open it at `127.0.0.1`, never `localhost`, or its same-site check fails;
the site must be on 8899 or 8901, the two returns it accepts; and its seeded account must change its password
before it may sign in anywhere else. A script calling the rig's `/api` must send an `Origin` header, or it is
refused. `../PUBLIC-SITE-SETUP-2026-10-20/` file 5 does all of this on a copy of Connect outside the synced
folder. **This is a local rig with demo keys and in-memory databases, not a live connection.**

### Staying signed in

**Source check, 30 Oct 2026: Connect's `publicSsoStatus` is built locally, not verified live.** Its action is in
Connect's `netlify/actions/publicsite.mjs`; SIGNIN-PARITY progress records the 25 Oct implementation and fixture
checks. This site's half was built 24 Oct and stays off until `CONNECT_SESSION_STATUS=on`: `sessionFrom()` in
`staff.mjs`, `sessionStatus()` in `connect.mjs`, tests in `test/staff.test.mjs`. Published availability was not checked
here; the owner must verify Connect's live action before switching on this existing freshness feature (WORK item 20).

*History, 24 Oct:* this paragraph formerly said Connect had no action yet and its half was not written. That was
the then-current dependency, not a present claim. The protocol and flag-off behavior below remain; queued Google
provider changes are not implemented and do not prove production freshness.

**What this site sends.** Ten minutes after Connect last vouched for a session (`checked_at`), the next staff
request makes one call, signed as every other: `{ action: "publicSsoStatus", client: "badgersupports-public", sub,
nonce, method }`, where `sub` is Connect's id from the sign-in note, `method` is how that note's Connect session was
opened (30 Oct) and `nonce` is new for that call. It waits four seconds
at most, because a staff request is waiting on it.

**What Connect would answer.** `{ assertion, sig }`, as `publicSsoToken` does: a note signed with
`PUBLIC_SSO_SECRET`, with `v: 1`, `aud: "badgersupports-public"`, the same `sub`, the same `nonce`, an `exp` still
ahead, an `iat` no more than a minute ahead, a `name`, a `scopes` list and `active`. Unlike a sign-in note,
`active: false` is a good answer: it means switched off.

**What this site does with it.**
- Active: the session keeps only what both notes allow. A check can take a scope away and never adds one; a new
  scope needs a new sign-in. `scopes`, `name` and `checked_at` are written back.
- Switched off, or nothing left: the session row is deleted and the request is answered as signed out.
- No answer, or one that does not check out (signature, `sub`, nonce, audience, time): the session stays as it was
  until 30 minutes after Connect's last good answer. After that every staff call is answered as signed out, until
  Connect answers again. Nothing is let through on a guess.
- Flag off (today): no call. `forms.read:` scopes lapse an hour after sign-in; the router answers `auth.again` and
  the staff page offers a fresh sign-in. `site.edit` and `site.publish` last the eight hours.

**What this does not solve.** Until Connect ships the action and the owner sets the flag, someone switched off in
Connect keeps reading answers here for up to an hour, and editing and publishing words for up to eight. With the
flag on and no action in Connect, every session stops working half an hour after sign-in, so the flag goes on only
after Connect's half is published.

## Publishing a save (proposed, 25 Oct 2026; built locally in slices)

The owner's ruling of 24 Oct ("The platform", `DECISIONS.md`): a permitted save publishes; visitors see it within 30
minutes, in the HTML and in the feeds; editors get Refresh now; no deploy loop. The run of 24 Oct costed three ways
(`OVERNIGHT-RUN-2026-10-24.md`, "The editor") and proposed the second. This is that way, built on what is here.

**The published revision.** A save that passes its checks writes the word to `content_edits` and its history, as now,
in one transaction. Then the full set of saved words becomes the next **published revision**: one numbered JSON
document `{ n, at, edits }` in a small store outside the database (`netlify/lib/published.mjs`). Deployed, the store
is Netlify Blobs; locally and in the tests it is memory. A save never grants `site.publish` and approves no form
decision or bulk message. If the store cannot be written, the save is kept, the editor is told it is not on the site
yet, and Refresh now tries again.

**Pages.** A page function (`netlify/functions/pages.mjs`) answers every page address. It renders the page with the
build's own renderer from what the build wrote (`.build/server.json`, now carrying every page's blocks and data) with
the current revision laid over it, exactly as a build lays `content/edits.json`. With no saved words it gives the
build's page byte for byte. It never reads the database. If the revision or the render fails, it answers the
build's own file, held one minute, so a fault is never cached for long.

**Every cache, at most 30 minutes.**

| Layer | Holds | Bound |
|---|---|---|
| The page function's copy of the revision | one JSON document | 60 s |
| Netlify's CDN, page HTML | `Netlify-CDN-Cache-Control: public, durable, s-maxage=1500, stale-while-revalidate=300` | 30 min |
| The browser, page HTML | `Cache-Control: public, max-age=0, must-revalidate` | 0 |
| `/api/events/<page>` | five minutes, ten more while it refetches; the browser one | 16 min |
| `/api/calendar/<event>.ics` | the same | 16 min |
| Private and sign-in answers (`/api/staff/*`, `/api/auth/*`, forms) | `no-store` | never cached |

The cache key ignores every query string but `topic` and `return` (`Netlify-Vary: query=topic|return`) and no
cookie or header, so a visitor cannot ask past the cache. Each page is tagged `page` and `page:<id>`.

**Refresh now** (`POST /api/staff/refresh`): for a signed-in person holding `site.edit` or `site.publish`, checked on
the server; JSON only and same-origin, so a page elsewhere cannot send it; at most six an hour per person and one a
minute for the site. It publishes the revision again if the last write failed, drops the held Connect list, and
purges the tags `page` and `events`. Deployed, the purge is Netlify's (`purgeCache` in `@netlify/functions`); locally
it is recorded, nothing more.

**What the editor sees.** The staff page says changes may take up to 30 minutes, and when the site last updated
(the revision's time), or that the last update failed and why. New text keys; the wording is a proposal.

**The feeds.** `/api/events` and `/api/calendar` render with the same revision's words.

**Every field.** A saved value need not be a word: links, library photos, icons, layout choices, on/off, numbers,
dates and the video are targets too, each checked by its kind (`src/shared/edits.mjs`, `valueProblem`) on save and
again when laid over a page. What stays out, and why: `research/EDITABLE-INVENTORY-2026-10-25.md`.

**Cost, modelled.** No database read on a page view. A page renders on a CDN miss: at most one per page per 25
minutes from the durable cache, about 58 × 58 = 3,400 a day, under 5 credits a month at 50 ms and 1 GB. Blobs is
listed in every plan; whether its reads draw credits is **not verified** (Netlify's docs could not be read from the
cloud session). After a deploy, tagged pages may stay up to 30 minutes old, which is inside the bound.

**What it needs from the owner.** Two packages, exact-pinned (`@netlify/blobs`, `@netlify/functions`), the page
function's lines in `netlify.toml`, and one deploy. Until then a deployed save behaves as today: kept, not
published, and said so.

## Crawlers and abuse (25 Oct 2026, cloud run §6)

**What limits each public route** (`netlify/lib/http.mjs`, `router.mjs`):

| Route | Before any database work | Budget |
|---|---|---|
| any | a path and method that match a route, else 404/405; a POST from another site refused | — |
| form send | body ≤ 64 KiB, JSON or URL-encoded | 40 an hour per form per address (was 10: a class behind one campus address was refused from the 11th) |
| file upload | type and declared length checked first; reading stops at 3 MB | 20 an hour per form per address |
| form state | no query string | none; the CDN holds it a minute, so a burst does not wake the database |
| events, calendar | no query string; never the database | CDN five minutes |
| mood | body checked | 30 an hour per address |
| sign-in start and return | — | 30 an hour per address, its own budget |
| pages | the page function never reads the database; one cache key per page | CDN 30 minutes |

**Whose address.** Only the platform's: Netlify gives the function `context.ip`. A forwarding header, a user agent,
a `From` address or an email in a form buys nothing; with no address, all requests count as one. Counters keep a
keyed hash of the address, never the address. A refusal is 429 with `Retry-After` and `{"ok":false,"error":"rate.limited"}`.

**Crawlers.** `robots.txt` asks for a working email in the HTTP `From` header and points at `/crawlers/`, which says
the same and that the address is taken as given, never as proof. It disallows only `/staff/` and `/api/`, and
names no other private address; the sitemap lists every indexable page. robots.txt is a request, not access
control (RFC 9309 §3): every private answer is refused on the server.

**Not collected: the `From` contact.** Recording it would mean writing something for page requests, which today
write nothing and wake no database, or reading Netlify's request logs, whose export is not available to this
project as far as could be read (unverified: it needs the Netlify UI). So the policy asks, and nothing records.

**Netlify's own rate limiting, proposed, not enabled.** Netlify offers code-based rate limits on functions (plan
limits apply; unverified for this team). The smallest useful rule, for the owner to add to `netlify/functions/api.mjs`'s
`config` after reading the plan's entitlement (the property names are as remembered from Netlify's docs, which
could not be read from the cloud session: check them first):

```js
rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] },
```

Checklist: read the plan's rate-limit entitlement in the Netlify UI; add the line; deploy; read the deploy's rule
validation; send a short burst from one address and see 429; watch a week of logs for real visitors refused.
Rollback: remove the line and deploy. The site's own limits above stay either way.

## What Netlify already includes (25 Oct 2026, cloud run §8; a map, nothing switched on)

Read from this repository and from the prices already recorded under "Cost" (`How credits work`). Netlify's
documentation and the project's UI could not be read from the cloud session, so anything that needs them says so.
**Used** = in this repository's configuration or code; **built locally** = code here, not deployed; **available** =
the platform offers it and nothing here uses it; **unknown** = needs the Netlify UI.

| Capability | State | Evidence | Cost, as recorded |
|---|---|---|---|
| Search and filtering | used: the resources page filters in the browser; no site-wide search | `src/client/resources.js` | none |
| Static search over the pages | available, not built: an index written at build time | — | none beyond bandwidth |
| Events and calendar files | used: from Connect at build, refreshed between publishes | `ops/connect-feed.mjs`, `netlify/lib/live-events.mjs` | functions, CDN-held |
| Waitlists, sign-ups | Connect's, not this site's | `DECISIONS.md`, one owner per fact | — |
| Staff self-service | used: sign-in through Connect, the staff page, the editor | `netlify/lib/staff.mjs`, `edits.mjs` | database while staff use it |
| Forms | used: the custom intake, authoritative | `netlify/lib/intake.mjs` | database wake per form page and send |
| Netlify Forms | available, not used; a pilot is proposed below | — | form submissions 0 credits; the posting function's time |
| Publishing | built locally: a save is the published revision | "Publishing a save" | Blobs (unknown), function on a CDN miss |
| Approvals | Connect's (decisions, bulk mail) | `COMMUNICATIONS.md` | — |
| Web Analytics | reported on by the owner (24 Oct); scope and billing **unknown**, needs the UI | `WORK.md` item 22 | unknown |
| Rate limits, firewall | available, not enabled; proposed rule and checklist under "Crawlers and abuse"; plan entitlement **unknown** | — | unknown |
| Deploy previews | available; not used by the laptop publish | `netlify.toml` | 0 credits |
| Rollback | available in the UI | — | 0 credits |
| Headers and cache rules | used: `_headers`, `_redirects`, `Netlify-CDN-Cache-Control`, cache tags | `ops/build.mjs`, `netlify/lib/pages.mjs` | none |
| Secret scanning | Netlify's runs in Netlify builds; this site builds on the laptop through the CLI, so whether it runs is **unknown**; this run searched the tree and history by hand (run log §7) | — | none |
| Edge Functions | available, not used: no request needs filtering before the CDN | — | metered |
| Identity | not used; staff identity is Connect's (owner). Whether Netlify Identity is still offered is **unknown** here | `DECISIONS.md` §1 | — |
| Blobs | built locally as the revision store and the outbox's note | `netlify/lib/published.mjs` | **unknown** whether reads draw credits |
| Scheduled functions | built locally, not registered: the outbox runner | `netlify/lib/deliver.mjs`, `COMMUNICATIONS.md` | function time; database only when work is due |
| Observability | used read-only by an earlier run (requests, function runs) | `ARCHITECTURE.md`, "Cost" | none |
| Extensions | none installed; one local build plugin, the migrations guard | `netlify.toml` | — |

**Netlify Forms: a proposal at most.** The custom intake stays the one record. If the owner wants a second, lower
risk trail, the smallest pilot is a metadata-only envelope for the anonymous programming feedback: the outbox
(not the browser) posts `{ ref, form, receivedAt }` to a fixed Netlify form, with no answers, and Netlify's own
notifications off. It records that a submission arrived, not what it said, so it cannot restore an answer; and it
shares Netlify's failures. Recommended: not now.

**Lighthouse, local only** (mobile, the local rig, photos as grey stand-ins, no compression, so speed figures are
indicative): accessibility 99–100, best practices 100, SEO 69 on every page only because the prototype is `noindex`
on purpose; performance 72 (home), 85 (resources), 92 (craft nights), 94 (workshop request). The audits name one
shared stylesheet blocking first paint (73–88 KB unused on a page) and, on the home page, 670 ms of blocking script.
Findings for the owner's design review, not changed here.

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
| `staff_sessions` | a signed-in person, keyed by a hash of the cookie: Connect's id, first name, scopes, expiry, and `checked_at` (from `004_session_check`) |
| `content_edits` | a word changed with the edit button: place, words, the words replaced, who and when |

`003_files`:

| Table | Holds |
|---|---|
| `uploads` | one PDF: its id, form, question, name, size (1 byte to 3 MB), SHA-256 and bytes; the submission that claimed it, when, and when Connect confirmed it |

`006_outbox_claims` (built 25 Oct 2026, cloud run; applied by the next deploy):

| Table | Holds |
|---|---|
| `outbox` | adds `claim_until` and `claim_token`: the worker sending a row, and until when; another worker skips it (`netlify/lib/deliver.mjs`, `claim()`) |

`004_session_check` (built 24 Oct 2026):

| Table | Holds |
|---|---|
| `staff_sessions` | adds `checked_at`: when Connect last vouched for the session's scopes, at sign-in or at its latest status answer. A row from before has none and counts from `created_at` |

**The migrations guard** (`netlify/plugins/migrations-guard`, Badger SPILL's, run from `netlify.toml`). Netlify
applies only the migrations a deploy carries, and a deploy carries only what its "Netlify Database setup" step copied
into `.netlify/internal/db/migrations`. On 16 October 2026 three of Badger SPILL's builds skipped that step and
published code ahead of the database. Here the build runs on the laptop, through Netlify's command line, and the step
ran on both publishes (the logs of 20 and 23 October, `~/Builds/badgersupports-live-*.log`, list `001_intake` and
`002_staff`). The guard checks it every time: after the build, any migration not copied, or copied with different
SQL, stops the deploy before it publishes, and the site online stays as it was. Measured 23 October against the
23 October build folder: it passes, and with `003_files` added and not copied it stops naming it
(`test/migrations-guard.test.mjs`). Publishes from 23 October on carry `003_files`; the next carries
`004_session_check` as well, and the guard checks both the same way.

## What is not built

| Piece | State | Waits on |
|---|---|---|
| Connect's half | built in the intranet working tree, uncommitted: `publicsite.mjs`, migration `032_public_site`, `public-sso.html` | the owner running Connect's `_xfer/Public website setup` files: 1 saves the 17 files, 2 sets the keys and the one allowed return (`badgersupports-public.netlify.app`) in both projects, 3 publishes |
| Receipts and the Sheets backup | built locally 25 Oct 2026 (`deliver.mjs`, `backup.mjs`), tested against a fake Connect and a fake Sheets API; off until set up | Connect's `publicReceipt` (proposed), `RECEIPT_SENDER`, the workbook and its service account, the scheduled function (owner actions) |
| Application files reaching Connect | stored and claimed here; `delivered_at` is never set | Connect fetching them by id (Exchange `APPLICATION-FILES-HANDOVER`) |
| Publishing edits | built locally 25 Oct 2026: a save is the published revision, drawn by the page function ("Publishing a save") | the two packages, the function's lines in `netlify.toml` and a deploy (owner actions) |
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
| `CONNECT_SESSION_STATUS` | `on` once Connect answers `publicSsoStatus` ("Staying signed in", a proposed change) | reading answers lasts an hour from signing in |
| `RECEIPT_SENDER` | the verified sender of receipts, an `@badgersupports.org` address; set by the owner once Connect's mail path accepts it (`publicReceipt`, proposed) | receipts stay held as `sender-unverified` |
| `BACKUP_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT` | the directors' backup workbook and the service account it is shared with (`netlify/lib/backup.mjs`) | backup rows wait |
| `BACKUP_CONFIDENTIAL` | `include` puts confidential answers in the workbook | they are left out (the default, a question for the owner) |
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
