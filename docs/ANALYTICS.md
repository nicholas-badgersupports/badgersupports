# Analytics

**The forwarder is built, and the production build now carries the id.** The owner decided on 11 Nov 2026
that the site carries Google Analytics (queue item 22; `DECISIONS.md`), and on 13 Nov 2026 that it is let
through (the morning review's C-21). The forwarder below is built and tested (`src/client/analytics.js`,
`test/analytics.test.mjs`): a build measures only when it is given the verified property's measurement id
(`GA_MEASUREMENT_ID`). The production publish build is given it in `netlify.toml` (the production context's
environment), so the published site measures; prototype and preview builds are given none and still send
nothing to Google or anyone else. Until that change is published, the live site still sends nothing. There is **no consent step**: on a public page the tag loads as the page
loads, as it does on the organisation's existing Google site (owner, 11 Nov 2026). This corrects the
consent-first wording recorded earlier the same day, in this project and in the Session 12 handoff.

Nothing on this page is a statement that any law or policy is met.

## The live site today

| Fact | Source |
|---|---|
| The live homepage carries the GA4 tag `G-XVT9XWRVQ5` | `../../INVESTIGATION.md`, "Analytics and Netlify" |
| 71 of the 73 crawled pages carry it. The two without it are the two team-member addresses that answered 404 | this rebuild's crawl (`research/ROUTES.md`) |
| The property, its data stream, retention, Google signals and linked destinations are **not verified** | the Analytics connector asked for reauthentication |
| Collection itself is not verified | as above |

Traffic figures from the old site are not a baseline for the new one. Nobody has read them, and what they counted is
unknown.

## What the rebuild does today

**The tag loads on a configured build's public pages.** The forwarder rides on every page and does
nothing without its configuration island (below); the production build carries one. The Content Security Policy allows Google's hosts only in a configured build (`ops/build.mjs`
`cspHeader`): an unconfigured build allows scripts from this site only, so a page cannot load Google's tag
even by mistake.

**The hooks are already in place**, so the plan below needs no change to any page or block:

| Hook | What it says | Where |
|---|---|---|
| `<body data-analytics>` | `public` by default; `none` on `/staff/`, the not-found page and every page the API renders (form outcomes without JavaScript) | `<body>` in `src/render/layout.mjs`; `content/pages/staff.json`; `content/pages/not-found.json`; `analytics: "none"` in `netlify/lib/router.mjs` |
| A block's `analytics` field | `page` (the block may emit events from the dictionary below, nothing else) or `none` (it emits nothing). Each block declares its own; `CONNECT-EDITOR-CONTRACT.md`, which the gate keeps current, lists every block's value | the header of `src/render/registry.mjs`; each block's file in `src/render/blocks/` |
| `data-analytics="off"` on the mood check-in's section | a marker a forwarder can test without knowing which block it is in | `src/render/blocks/mood.mjs`; `test/build.test.mjs`, "the mood check-in is excluded from analytics" |
| The `bss:analytics` event | `form.js` announces `form_start` on the first input into a form and `form_submit_success` only once the server answered that the submission was stored. The detail is `{ name, form }`, where `form` is the form's key | `announce()` in `src/client/form.js` |

**The forwarder listens to `bss:analytics`** and passes an announcement on only when the dictionary below
names it and every value is on its closed list. Until a build is configured, it still goes nowhere.

The mood check-in keeps its own daily counts in the site's database (`mood_daily`). That count is not
analytics: it holds one number per mood per day, and `netlify/lib/mood.mjs` sends nothing out.

## The event dictionary

Every event the site may send, with every parameter it may carry. Anything not in this table is dropped.

| Event | When | Parameters | Status |
|---|---|---|---|
| `page_view` | a page whose `<body>` says `data-analytics="public"` opens | `page_path`: the path only, no query string and no `#` | sent by the forwarder, once a build is configured |
| `form_start` | the first input into a form | `form`: one of the form keys in `content/forms/` | announced by `form.js`; forwarded under the same condition |
| `form_submit_success` | the server stored the submission | `form`, as above | announced by `form.js`; forwarded under the same condition |
| `drop_in` | a Drop in link is pressed | `place`: a place id from `content/places/` | the forwarder accepts it; nothing announces it yet |
| `calendar_add` | an Add to calendar link is pressed | none | the forwarder accepts it; nothing announces it yet |
| `reel_play` | the reel's Play button is pressed | none | the forwarder accepts it; nothing announces it yet. The reel has had no Play button since Session 11, so this event may never fire |

Form keys: the `key` of each file in `content/forms/` (`ls content/forms/`).

### Durable success

`form_submit_success` counts stored submissions, not presses of a button: it fires after `res.ok && body.ok`,
and the server answers `ok` only after the submission's transaction has committed (`ARCHITECTURE.md`, "Intake").
A rejected, closed, rate-limited or failed submission sends nothing. Two other cases also answer `ok`
(`netlify/lib/intake.mjs`, its `idem_key` and `_website` checks): a resend of a submission already stored, which stores nothing new, and a
form whose hidden trap field was filled, which stores nothing at all. So the event can count a little high; the
database cannot.

It still undercounts. A visitor without JavaScript submits through the API, and the page that answers them is
`none`. **The full count is the database's**: one row in `submissions` per stored submission. Analytics shows
the share of visitors who start a form and finish it; the database says how many finished. Connect's per-form
queue (Exchange request `PUBLIC-SITE-FORMS`) would list those rows. A count per form per day is not part of that
request yet.

## The forwarder

One small script of this site's own, `src/client/analytics.js`, on every page. It is the only
thing that may load Google's tag, and it decides before loading it.

1. **Read its configuration.** The build bakes the measurement id and the two closed lists (form keys,
   place ids) into the page as a `bss-analytics` island, and only when the build was given an id with a
   measurement id's shape (`GA_MEASUREMENT_ID`; `ops/build.mjs`, `analyticsConfig`). No island, or an id
   that fails the shape check in the script itself: nothing happens on the page.
2. **Read the page's own label.** If `document.body.dataset.analytics` is anything but `public`, stop.
   No request to Google is made on that page.
3. **Refuse the private paths.** Stop on `/staff/` (where sign-in happens) and `/api/`. These pages also
   carry `none`; the path check is a second lock in case one does not. The resource viewer's page carries
   `none`, so the label refuses it.
4. **Only then load the tag**, configured to send no page view of its own. Send `page_view` by hand, with the
   path stripped of its query string and `#`. URL tokens and filters never leave the page.
5. **Forward `bss:analytics` events through the dictionary.** An unknown name is dropped. A parameter not listed
   for that event is dropped. A value outside its closed list (a form key, a place id) ends the event.
6. **Never set** a user id, a Connect account id, a name, an email address, a reference such as `WR-…`, an
   answer, or any free text. None of these is in the dictionary, so step 5 already drops them; the rule is
   written here so that nobody adds one.

The one step in the earlier plan the build does not take: nothing inside `[data-analytics="off"]` can
announce an event today — `form.js` announces on the document, not from inside a section, and the only
`off` section is the mood check-in, whose block is `none` and whose script announces nothing.

### What switching it on takes

- **A verified property.** The id a build carries must be the organisation's own GA4 property. The owner
  supplied `G-XVT9XWRVQ5` directly on 12 Nov 2026; his supplying it is the verification the build relies
  on. Reading the property's settings and figures through the Analytics connector still needs the owner's
  reauthentication.
- **Enhanced measurement on** in the GA4 data stream (owner's ruling, 12 Nov 2026, superseding the earlier
  off position recorded here). It collects form interactions, site search terms and outbound clicks on its
  own, beyond the forwarder's dictionary below. This is a property setting in the GA console; the build
  does not control it.
- **The id reaches the publish build** as `GA_MEASUREMENT_ID`, set in `netlify.toml` for the production
  context (13 Nov 2026); the publish file's Netlify CLI deploy applies that context's environment to the
  build it runs. With it set, the build also widens the CSP
  by Google's own list for the GA4 tag (its CSP guide): `script-src` gains `https://*.googletagmanager.com`;
  `img-src` gains `https://*.google-analytics.com` and `https://*.googletagmanager.com`; `connect-src` gains
  those two and `https://*.analytics.google.com`. Without it, none of those hosts is allowed.
- **Tests** (`test/analytics.test.mjs`): the dictionary fed every forbidden parameter expects nothing out;
  the label and path checks; a build with no id carries no island and allows no Google host; a build with
  one carries both, and the staff page's `none` label still stands. A browser test that watches the
  network on the private pages is still owed: the suites' builds are unconfigured, so no request can be
  made there, and a configured browser run needs the verified id first.

## What the exclusions cover

From `../../MASTER-PROMPT.md` §9, and where each one is held:

| Never sent | Held by |
|---|---|
| Private pages: `/staff/`, sign-in, the API's pages | the page's `none` label, then the path check |
| Resource-viewer activity | the viewer's page carries `none` when it is built |
| Mood check-in taps | the block is `none`; its section is `off`; `mood.js` announces nothing |
| Answers and free text | `form.js` announces only the form's key |
| Names, email addresses, references, record ids | not in the dictionary |
| URL tokens and query strings | `page_path` is the path alone |
| Any Connect identity | no user id is ever set |

## Not checked

- Whether the GA4 property collects anything today. Reading it through the connector needs the owner's
  reauthentication.
- What, if anything, the old site's tag recorded beyond page views.
- The cost of any analytics product. None is proposed here beyond the existing GA4 property.

The owner's question, with its recommended answer, is in `../WORK.md`.
