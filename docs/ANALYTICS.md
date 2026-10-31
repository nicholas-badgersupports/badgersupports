# Analytics

**Nothing is measured yet.** The rebuild loads no analytics tag and sends nothing to Google or anyone else. This
page records what the live site has, the hooks this rebuild already carries, and a plan for turning measurement on.
The plan is a **proposal** and needs the owner's approval (`../../MASTER-PROMPT.md` §9; `DECISIONS.md` §4).

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

**No tag.** The Content Security Policy allows scripts from this site only (`script-src 'self'`, in
`ops/build.mjs` `headersFile`). A page cannot load Google's tag even by mistake until that header changes.

**The hooks are already in place**, so the plan below needs no change to any page or block:

| Hook | What it says | Where |
|---|---|---|
| `<body data-analytics>` | `public` by default; `none` on `/staff/`, the not-found page and every page the API renders (form outcomes without JavaScript) | `<body>` in `src/render/layout.mjs`; `content/pages/staff.json`; `content/pages/not-found.json`; `analytics: "none"` in `netlify/lib/router.mjs` |
| A block's `analytics` field | `page` (the block may emit events from the dictionary below, nothing else) or `none` (it emits nothing). Each block declares its own; `CONNECT-EDITOR-CONTRACT.md`, which the gate keeps current, lists every block's value | the header of `src/render/registry.mjs`; each block's file in `src/render/blocks/` |
| `data-analytics="off"` on the mood check-in's section | a marker a forwarder can test without knowing which block it is in | `src/render/blocks/mood.mjs`; `test/build.test.mjs`, "the mood check-in is excluded from analytics" |
| The `bss:analytics` event | `form.js` announces `form_start` on the first input into a form and `form_submit_success` only once the server answered that the submission was stored. The detail is `{ name, form }`, where `form` is the form's key | `announce()` in `src/client/form.js` |

**Nothing listens to `bss:analytics` yet.** The event goes nowhere.

The mood check-in keeps its own daily counts in the site's database (`mood_daily`). That count is not
analytics: it holds one number per mood per day, and `netlify/lib/mood.mjs` sends nothing out.

## Proposal: the event dictionary

Every event the site may send, with every parameter it may carry. Anything not in this table is dropped.

| Event | When | Parameters | Status |
|---|---|---|---|
| `page_view` | a page whose `<body>` says `data-analytics="public"` opens | `page_path`: the path only, no query string and no `#` | proposed |
| `form_start` | the first input into a form | `form`: one of the form keys in `content/forms/` | announced by `form.js`; not forwarded |
| `form_submit_success` | the server stored the submission | `form`, as above | announced by `form.js`; not forwarded |
| `drop_in` | a Drop in link is pressed | `place`: a place id from `content/places/` | proposed, not announced |
| `calendar_add` | an Add to calendar link is pressed | none | proposed, not announced |
| `reel_play` | the reel's Play button is pressed | none | proposed, not announced |

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

## Proposal: the forwarder

One small script of this site's own, `src/client/analytics.js` (**not built**), on every page. It is the only
thing that may load Google's tag, and it decides before loading it.

1. **Read the page's own label first.** If `document.body.dataset.analytics` is anything but `public`, stop.
   No request to Google is made on that page.
2. **Refuse the private paths.** Stop on `/staff/`, `/api/`, any sign-in path, and the resource viewer once it
   exists. These pages also carry `none`; the path check is a second lock in case one does not.
3. **Only then load the tag**, configured to send no page view of its own. Send `page_view` by hand, with the
   path stripped of its query string and `#`. URL tokens and filters never leave the page.
4. **Forward `bss:analytics` events through the dictionary.** An unknown name is dropped. A parameter not listed
   for that event is dropped. A value outside its closed list (a form key, a place id) is dropped.
5. **Ignore anything inside `[data-analytics="off"]`**, and anything from a block declared `none`.
6. **Never set** a user id, a Connect account id, a name, an email address, a reference such as `WR-…`, an
   answer, or any free text. None of these is in the dictionary, so step 4 already drops them; the rule is
   written here so that nobody adds one.

### What it would take

- **The CSP** gains Google's tag hosts in `script-src` and `connect-src`. Take the list from Google's own CSP
  guide when this is built, not from this page.
- **Enhanced measurement off** in the GA4 data stream. It collects form interactions, site search terms and
  outbound clicks on its own, and those would bypass every rule above. This is a property setting; whether it
  is on today is not verified.
- **A decision on asking first.** Either the tag loads only after a visitor agrees, or it loads on public pages
  without asking. This is the owner's call. Either way the steps above run first.
- **Tests:** a browser test that opens `/staff/`, the not-found page, a form outcome page and the mood check-in,
  and fails on any request to a host other than this site; and a unit test that feeds the forwarder every
  forbidden parameter and expects nothing out.

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

- Whether the GA4 property collects anything today, and its settings. The connector needs reauthentication.
- Whether enhanced measurement is on.
- What, if anything, the old site's tag recorded beyond page views.
- The cost of any analytics product. None is proposed here beyond the existing GA4 property.

The owner's question, with its recommended answer, is in `../WORK.md`.
