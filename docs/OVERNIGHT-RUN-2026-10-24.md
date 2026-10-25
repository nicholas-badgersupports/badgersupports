# Overnight run, 24 Oct 2026: functionality and UI repairs

An unattended run. Each choice that would have been a question is logged below as a decision, with its basis
and its reversal, so it can be vetoed in one reading. Nothing here was pushed, deployed or sent; one local
commit was made to hand the work to a cloud session (R.4).
The closing section pastes the commands that show this.

## What was asked, as read

Nicholas pasted the brief *"Master Prompt: Public Website Functionality and UI Repairs"* and asked: *"Ask me
tappable questions if there are any discpreiencies, and start an overnight build"*. I asked two questions and
both answers are in `DECISIONS.md`, "Two answers, 24 Oct 2026":

- **Edit text stays here and grows toward SPILL's ID-based editor.** It must really publish.
- **Retries are limited to the reader's own forms.**

How I read the brief:

1. **The work.** A functionality and usability pass on `site/`. It is not a redesign, and the BSS identity
   stays. The brief's queue is worked in order:
   - (1) form failures;
   - (2) sign-in and the staff page;
   - (3) permission freshness, and delivery separated from reading;
   - (4) width and helper text;
   - (5) navigation and integration.

   It starts with the upload race and the phone menu's Escape. The owner's editor ruling joins (5), "editing".
2. **Connect and SPILL are references only.** Nothing in either was changed. A behaviour is carried across
   only if it is shipped and proven there, never a backlog item. A native control stays native wherever it
   works.
3. **Every claim is graded.** Each one is one of: built locally, tested with fixtures, deployed, or verified
   live. This run reaches the first two only.
4. **`WORK.md` stays the one state-and-queue file**, at 179 lines or fewer. The transfer table and the
   coverage table live here, because `WORK.md` has no room for them.

## Decision log

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 0.1 | The applications are closed as shipped, so the upload race is reproduced in a browser harness (`ops/interact.mjs`). The harness serves the preview page as an open form and answers its uploads itself, slowly, with made-up ids. The real upload route is tested through the router, using the test database's own `form_state` row | brief: "Do not open forms … merely to make the tests pass"; "a local fictional fixture only" | delete `ops/interact.mjs` and its line in `ops/check.mjs` |
| 0.2 | The transfer table and coverage table live in this log; `WORK.md` points to them | `WORK.md` is at 178 of 179 lines; the brief allows "no second master status file", and this log is a dated record, not a status file | move the tables into `WORK.md` and cut elsewhere |

## 1. The upload race and the phone menu

**Rechecked 24 Oct, 21:20.** Both defects were confirmed from source, then reproduced in Chromium by the new
`ops/interact.mjs`, run against the **unchanged** code on a local server (`127.0.0.1:8911`, PGlite).

**The upload race** (`src/client/form.js`, `uploader()`). Choosing a PDF added the question to `uploads`. If
the replacement was cleared, not a PDF, or over 3 MB, the handler returned early without taking the question
out again. The first upload's reply was then ignored, as it should be, but its `finally` skipped the cleanup
because it was no longer the current turn. So `uploads` kept the question forever, and Send answered "Wait for
your file to finish uploading" for as long as the tab stayed open.

**The phone menu** (`src/client/site.js`). Escape closed only a sub-menu. Nothing closed the phone menu except
its own button:

- not Escape;
- not a click or tap outside;
- not widening the window, which left `aria-expanded="true"` behind and the panel open when the window narrowed
  again.

**Before** (the unchanged code), `interact: 13 of 31 failed`. These are the failures:

```
  FAIL phone: Escape closes the menu and focus returns to Menu (expanded true, shown true, focus toggle)
  FAIL phone: the second Escape closes the menu, focus on Menu (expanded true, focus summary:About)
  FAIL phone: a click outside closes the menu (expanded true, shown true)
  FAIL resize: widening past the phone layout closes the menu (expanded true)
  FAIL resize: back on a phone the menu is still closed, no stale panel (shown true)
  FAIL touch: a tap opens the menu and a tap outside closes it (expanded true)
  FAIL upload cleared while the first is still going: Send answers with the missing resume, not "wait" (status "Wait for your file to finish uploading, then press Send.", summary false)
  FAIL upload cleared: Send still answers after the late reply (status "Wait for your file to finish uploading, then press Send.")
  FAIL upload not a PDF while the first is still going: Send answers with the missing resume, not "wait" (…)
  FAIL upload not a PDF: Send still answers after the late reply (…)
  FAIL upload over 3 MB while the first is still going: Send answers with the missing resume, not "wait" (…)
  FAIL upload over 3 MB: Send still answers after the late reply (…)
  FAIL once that upload is up, the wait message goes ("Wait for your file to finish uploading, then press Send.")
interact: 13 of 31 failed
```

**The fixes.**

- **`form.js`.**
  - A new choice stops the upload in progress (`AbortController`) and takes the question out of `uploads` at
    once, before any early return.
  - The "wait" message goes as soon as nothing is uploading.
  - A stale reply is still ignored by its turn number.
- **`site.js`.**
  - Escape closes the innermost open layer: a sub-menu first, with focus on its heading, then the phone menu,
    with focus on Menu. It skips a key that a dialog or another control already used.
  - A click or tap outside the menu and its button closes it.
  - Leaving the phone layout closes it, using the same 860 px breakpoint as `layout.css`.
  - A page restored by Back/Forward opens with the menu closed.
  - Focus is never trapped.

**After**, `interact: all 31 passed`. The 18 checks that passed before are still part of the run:

- a second PDF replaces the first;
- Send waits during a real upload;
- desktop sub-menus;
- Tab into the menu;
- Back;
- no-JS links.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 1.1 | A replaced upload is aborted, not just ignored | SPILL's stale-response lesson; the browser stops sending bytes nobody will use | drop the `AbortController`; the turn check alone still prevents a wrong id |
| 1.2 | A click inside the open menu, on anything but a link, keeps it open; following a link reloads the page anyway | the menu is a list of links; Connect's and SPILL's menus close on an outside click only | add `nav.addEventListener("click", …)` |
| 1.3 | No focus trap and no scrim behind the phone menu | brief: "No focus trap and no stale overlay"; the menu is a disclosure, not a dialog | — |

**Tests added:**

- `ops/interact.mjs`, with 31 browser checks, now part of `node ops/check.mjs --browser`.
- `test/applications.test.mjs`: "a resume chosen again: Send claims the replacement, and the first file goes
  nowhere". This runs through the router: two uploads, Send with the second, and Connect's payload names only
  the second. The first stays unclaimed and is cleared after a day (`files.mjs`).

## 2. A form that changes while it is open (queue 1b)

**Rechecked 24 Oct, 22:00.** The anchors still hold.

- `router.mjs` answered a send made under an older version with a 422 that named the new questions.
- `form.js` could not mark them, because a page cannot mark a question it has never heard of. The person
  saw an error summary with nothing in it, under a notice saying the form had changed.
- An answer to a question that had been renamed or retired disappeared without a word.

**What a person now sees.**

- **On load or on return to the tab.** If a newer version is already out, the notice says so now:
  *"The questions on this form have changed since this page loaded. When you press Send, any new questions
  will appear here and the answers you have given will be kept."* The page does not change under someone
  who is typing.
- **At Send.** The reply carries the form as it now stands, and the page swaps to it:
  - every compatible answer is filled in, including a resume already uploaded, which is not asked for
    again;
  - the new or renamed questions are marked, and listed in the error summary, which takes focus;
  - the Send key is kept, so a second Send is still one submission.
- **Renamed or retired questions.** Any answers they had are listed under the notice so they can be copied:
  *"These answers are to questions the form no longer asks, so they will not be sent."*
- **Without JavaScript.** The reply page is the same form, with the same list.

**What is kept as it was.**

- A submission keeps the version it was sent under, and the one the page was showing.
- Older answers stay exactly as they were sent.
- The server checks every answer again, and closure is still checked on the server.

**Before** (the committed code):

- `node --test test/intake.test.mjs test/applications.test.mjs`: 4 of 37 failed.
  - "a resume uploaded before the form changed…"
  - "a new required question…"
  - "a renamed question…"
  - "a new question shown only for one answer…"
- `ops/interact.mjs`, section 3: 7 failed.

```
  FAIL changed form: on load the page says its questions have changed (notice "")
  FAIL changed form: Send shows the new question, listed in the focused summary (listed [], focused true)
  FAIL changed form: the new question is on the page and marked
  FAIL changed form: the answers, the Send key and the new version are kept (name Avery Example, key kept true, version 1/1)
  FAIL a question added while the page is open: page.fill: Timeout 30000ms exceeded.
  FAIL renamed question: Send asks it again and shows the old answer to copy (listed [], kept [])
  FAIL no JavaScript: the reply page asks the renamed question, keeps the answers and shows the old one (listed ["organisation"], kept [])
```

**After:** node 37 of 37 passed; `interact: all 45 passed`.

Some of the new checks pass on the old code too. They are guards, not regressions: they show that behaviour
already right stays right.

- **Node:** a retired question; answers sent under version 1 unchanged; a mistake on an unchanged form
  carries no form.
- **Browser:**
  - Send twice is one request;
  - a lost reply, then Send again, gives the same reference and one row;
  - no connection, then a retry, goes through;
  - closed while open is refused by the server, keeps the answers and stops Send.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 2.1 | The new form arrives with Send's reply (`form` in the 422) and a notice from `/state` warns ahead. There is no new route and no swap while typing | brief: "safely load the current definition, or give an explicit recovery flow"; "a refresh does not interrupt typing" | drop `form` from the 422; the old notice-only path still runs |
| 2.2 | A new id is a retired question plus a new one: the old answer is shown, not sent. A new label alone keeps the answer | answers are stored by permanent id (brief: "Preserve permanent … question … keys") | map renames in the definition; not built, because nothing records a rename |
| 2.3 | An answer to a retired question, in an otherwise valid Send, is accepted and dropped without a notice | the person has nothing to fix, and the reference is what they need | show the left-behind answers on the done panel |
| 2.4 | The left-behind answers are listed by the server, so JavaScript and no-JS show the same thing | brief: inspect with no JS; shared validation | — |
| 2.5 | The left-behind list is built only when the version the page names is found and matches | a made-up `_version` must not make the server read any other definition | — |
| 2.6 | The browser checks run the real router in the harness process against a fictional PGlite database | publishing a version or closing a form must happen under an open page; no live data | — |

**Tests added:**

- `test/intake.test.mjs`: six tests (added, renamed, retired, conditional, history kept, unchanged form).
- `test/applications.test.mjs`: two tests, one for a resume uploaded before the change and one for a file
  question retired after an upload. A retired upload stays unclaimed and is not sent to Connect.
- `ops/interact.mjs` section 3: 14 browser checks.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 2.7 | The new form is parsed with `DOMParser` into a detached document and moved in with `replaceWith`, never set as `innerHTML` | `ops/editable.mjs` refuses `innerHTML` in a browser script; a parsed document runs no script and loads nothing until it is placed; the markup is the server's own render of the text table, so it adds no word | — |

## 3. How long a sign-in lets someone read, and who Try again sends (queue 3)

**Rechecked 24 Oct, 23:10.** The anchors held:

- `staff.mjs:107–123`: `sessionFrom()` read only the row and its expiry, so a session kept every scope for
  eight hours, whatever Connect later said.
- `router.mjs:180–197`: opening `/staff/` called `deliverDue()` for every form, and Try again sent every
  form's waiting answers, whichever form the reader could read.
- `deliver.mjs:87`: `run()` had no way to send fewer than all forms.
- SPILL's `netlify/lib/sessions.mjs:43–91` checks its own database on each request, which this site cannot
  do: the person's account lives in Connect. Connect has no action that answers "is this person still
  allowed?", so the brief's "do not silently invent an endpoint" applies.

**What changed** (the code is described in `ARCHITECTURE.md`, "Staying signed in"):

- **Today, with nothing new in Connect:** reading answers lasts an hour from signing in; editing and
  publishing words last the eight hours. After the hour, the staff page shows *"For the privacy of the people
  who wrote in, answers can be read for an hour after signing in. Sign in again to keep reading."* and a
  **Sign In Again** button, in place of the forms. A direct API call gets `403 auth.again`, not the answers.
- **A proposed change, built and off:** with `CONNECT_SESSION_STATUS=on`, a session asks Connect's proposed
  `publicSsoStatus` again ten minutes after Connect last vouched for it. Revocation is **not** solved until
  Connect ships that action and the owner turns the flag on.
- **Delivery is separated from reading.** Opening `/staff/` sends nothing. Send Waiting Answers Now sends only
  the forms the reader may read, checked on the server. A new submission still wakes delivery.

**Before** (the committed code, `git archive HEAD` in a scratch folder, with the new `test/staff.test.mjs`
and, so the tests could reach the old behaviour, only migration `004_session_check` added): 4 of 14 failed,
each on its behaviour.

```
✖ with no status check from Connect, reading answers needs a sign-in within the hour, and words last the working day
  AssertionError: an hour on, reading stops and the page says to sign in again
✖ with Connect's status check on, a session is checked again after ten minutes: fewer scopes take effect, and switched off ends it
  AssertionError: Connect took reading and publishing away
✖ with the status check on, Connect not answering keeps a session as it was for half an hour, then nothing works until it answers
  AssertionError: down: half an hour on, refused
✖ opening the staff page sends nothing, and Try again sends only the forms the reader may read
  AssertionError: opening the staff page sent something
```

**After:** 14 of 14 (`node --test test/staff.test.mjs`).

The brief's five readers are covered by these tests:

| Reader | Test | What it shows |
|---|---|---|
| reads one form | "a director reads only the forms…"; "opening the staff page sends nothing…" | that form's answers only; Try again sends that form only |
| reads an unrelated form | the same two | another form's answers are `403 staff.forbidden`; its waiting answers stay waiting |
| edits words only | the same two | an empty form list; Try again is `403 staff.forbidden` and sends nothing |
| switched off in Connect | "with Connect's status check on…" | the session row is deleted and the next call is signed out |
| asks the API directly | every test above calls the routes, not the page | the server decides; the page only shows what it was given |

| # | Decision | Basis | To reverse |
|---|---|---|---|
| 3.1 | With no status check, reading answers lapses an hour after sign-in; words last the eight hours | brief: "bounded, server-enforced revalidation"; a fresh sign-in is the one check Connect already answers, and it refuses someone switched off; answers are the private part | change `READ_MINUTES` in `staff.mjs` |
| 3.2 | Connect's side is a **proposed** `publicSsoStatus`, built here behind `CONNECT_SESSION_STATUS=on` and off by default | brief: "label it proposed change; do not silently invent an endpoint or declare revocation solved"; no Connect change in this run | leave the flag off; remove `sessionStatus()` |
| 3.3 | The check happens on the next staff request ten minutes after the last good answer, waits four seconds at most, and runs no timer | no scheduled function or timer is to be activated; nobody signed in costs nothing | `CHECK_MINUTES`, `STATUS_TIMEOUT_MS` |
| 3.4 | A check only narrows scopes; a new scope needs a new sign-in | a status note must not be a way to gain access; the nonce binds each answer to its call | replace `narrower()` with Connect's list |
| 3.5 | Connect silent or wrong: the session stays as it was for 30 minutes from the last good answer, then every staff call is signed out until Connect answers; the row is kept, so it comes back when Connect does | brief: "fail closed"; a short Connect outage should not end everyone's reading at once | `GRACE_MINUTES` |
| 3.6 | A lapsed reading scope answers `403 auth.again`, and `/api/staff/me` says `readAgain`, so the page offers Sign In Again instead of "your role does not include" | brief: "truthful waiting states", "accessible recovery", "do not display capabilities the current account lacks" | drop `lapsed` in `sessionFrom()` |
| 3.7 | Opening `/staff/` sends nothing; Try again sends every form for `forms.read:*`, otherwise only the forms named; a new submission still wakes delivery | owner, "Limit to own forms (Recommended)", `DECISIONS.md` "Two answers"; brief: separate delivery from reading | restore `afterReply(…deliverDue…)` in `staffForms()` and drop `forms` |

## Where the run paused (24 Oct 2026, owner asked to pause)

Nothing is committed, pushed or deployed. The last full check (`node ops/check.mjs`, no browser) passed every gate
with 164 tests. The platform prompt's work is queued in `../WORK.md` as items 33 to 39. The dev server on 8911 was
left running. Picking up from here, in order:

1. **`ARCHITECTURE.md`, sign-in freshness (queue 3).** This file has not been edited yet. Five changes:
   - Lines 241–245: answers can be read for an hour after sign-in and words edited for eight hours. Point to a new
     "Staying signed in" section.
   - Line 248: opening `/staff/` sends nothing. Try again resends only the reader's own forms, checked on the
     server. A new submission still wakes delivery.
   - Add `checked_at` to the `staff_sessions` row. Add a `004_session_check` table, and correct line 328.
   - Add a `CONNECT_SESSION_STATUS` row to the Environment table.
   - Write "Staying signed in", marked **proposed change**. It describes `publicSsoStatus`:
     - Connect is sent `{client, sub, nonce}` and replies with a note signed with `PUBLIC_SSO_SECRET`. The note
       carries the same `sub`, a true/false `active` and the nonce sent back.
     - The site checks again every 10 minutes, with a 4-second timeout. Scopes can only narrow, never widen.
     - If Connect cannot be reached, a session lasts up to 30 more minutes, then closes.
   - Code: `staff.mjs` and `connect.mjs`.
2. **This log, §3.** Record decisions 3.1–3.7 (freshness and Try again) and 2.7 (DOMParser replaced innerHTML).
   Add the section "The editor" that `DECISIONS.md` "Two answers" already cites.
3. **Queue 2.** Cover each sign-in state (master prompt list), make the staff intro shorter, and add a browser
   check for `readAgain`.
4. **Queue 4.** Width and helper text, fixed per component. The anchors are `base.css:28`, `forms.css:52` and
   `blocks.css:1124`.
5. **Queue 5.** Guards against stale replies, Back and Forward, and protection for typing. Recheck Connect's
   `public.mjs`.
6. **The editor.** Move it toward SPILL's: ids, history, restore, and a save that publishes. Stay inside what
   can be tested locally.
7. **Close.** Fill in the transfer and coverage tables. Run `node ops/check.mjs --browser`. Refresh the Evidence in
   `WORK.md`, keeping the gate at 178 lines or fewer. Record up to three observations, after reading the highest
   log number on disk. Write the final report from pasted `git --no-optional-locks status` and `log` output.
   Stop the dev server.

## Resumed (24 Oct 2026, second session)

Nicholas asked to resume from step 1, and added: *"You can commit if necessary, the goal is to be able to
publish all work completed."* As read: committing is allowed where it is needed; pushing and deploying are not.
Steps 1 and 2 above are done (`ARCHITECTURE.md`; §3 above).

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.1 | No commit from this run. The tree is left so that `../PUBLISH-WEBSITE-2026-10-23.command` passes: its own gate (`node ops/check.mjs`) passes, nothing it refuses is unignored, and no file is over 1 MB | that file runs `git add -A` and makes the commit itself, after its checks and the word *publish*; a commit here would add nothing it needs, and the standing rule is that Claude does not commit (`WORK.md`, "Git and publishing") | `git add -A && git commit` in `site/` before publishing |

## 4. The sign-in states and a shorter staff page (queue 2)

**Built locally, tested with fixtures.** Before the change, 16 of the new staff checks in `ops/interact.mjs` failed on
the old code; after it, all 67 checks there pass, and `node --test` passes 165.

- **The page before sign-in** (`content/pages/staff.json`, `src/render/blocks/staff.mjs`): one line on who it is for,
  **Sign in with Connect**, and "About Signing In" folded shut with the rest. What answers can do moved to
  `staff.forms.how`, shown only to someone who can read answers.
- **One next action per state** (`src/client/staff.js`):
  - never signed in: the button;
  - a past sign-in: "Checking your sign-in…", never a Sign In flash (the hint class, with an 8-second fallback);
  - ended or revoked: "Your sign-in has ended" and the button;
  - Connect not set up: says so, no button;
  - the check fails: says so, with Try Again;
  - signed in: only the tools the account has, or "nothing to use yet".
- **The way back.** `?return=` survives Sign in, the auth error page and Try Again. A start failure's error page now
  links `/staff/?return=…` (`router.mjs`, `test/staff.test.mjs`). Callback failures still link `/staff/`, because
  their return path sits in the `auth_starts` row and that page was not rebuilt (brief).
- **Waiting buttons** keep their place and say what they are doing after 200 ms, so a quick answer does not flicker.
  A second press while waiting does nothing.
- **Edit text when the sign-in has ended.** Opening it says so, with Sign In Again. Saving keeps the words in the
  box, and Sign In Again opens in a new tab and comes back to the same page (`ops/interact.mjs`, "edit button").
- **Send Waiting Answers Now and Work Through Answers in Connect** were stacked with no gap. They now sit in one
  `.staff-actions` row, like every other block's actions.

**Inspected** (scratch script, the real router and a fresh PGlite, fictional Robin Example): `/staff/` signed out,
reader and editor, editor only, ended and offline. Sizes: 320, 390, 768 and 1280 px, 640 px for 200% zoom, and
reduced motion. Nothing scrolled sideways at any size. At 390×844 Sign in ends at 521 px, on the first screen. With
the keyboard, Tab reaches Sign in with Connect after the skip link and the menu. The answer table scrolls inside its
own box at 320 px.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.2 | Cutting the staff page's second paragraph retires the target `page:pg-staff:b-staff/body/1`. A saved edit there is skipped and reported, not a build failure. Its words moved to `staff.forms.how` and the folded help | brief: shorten the staff intro to a short explanation before sign-in, with tool-specific help after | restore the paragraph in `content/pages/staff.json` |
| R.3 | **Back/Forward cache**: headless Chromium keeps no page in it, so `pagehide`/`pageshow` are tested by dispatching the events. That shows the handlers work, not a real restore | measured: `persisted` is never true in the harness | test in a desktop browser by hand |
| R.4 | **Committed locally on `main`, not pushed**, so that a cloud session can start from this exact tree (Nicholas, 24 Oct: *"move this to a remote cloud session, that will hand back the work to publish"*). Before it, `node ops/check.mjs` passed, and nothing the publish file refuses was in the commit | Nicholas: *"You can commit if necessary"*. A cloud copy starts from commits, not from uncommitted files. This replaces R.1 | `git reset --soft HEAD~1` in `site/` (keeps every change, uncommitted) |

## Where the run paused, second time (24 Oct 2026, moved to a cloud session)

Steps 1–3 of the first pause are done. Queue 2 (above) is complete. The owner added a request to the queue: a
styled backup workbook in the directors' account (`WORK.md` item 18, `docs/COMMUNICATIONS.md`). **It is queued
only; do not build it in this run.** The local dev server was stopped.

Picking up, in order. Every rule in "What was asked, as read" still holds. The brief's other rules, carried here
because the cloud copy cannot read the transcript:
- Change only `site/`'s authored files. Generate `dist/`, `.build/` and contract files with their real tools.
- Keep every text, question and block key, alias, route and stored row. Use the block registry and shared validation.
- No real people, submissions, credentials or confidential records in fixtures, screenshots or logs. Missing
  configuration fails closed.
- No deploy, push, DNS, paid service, real message, Google Form edit, live-data change, or switching on forms, email
  or analytics.
- A new regression must be shown failing on the old code first. Pass, fail, did not run and fixture-only are kept
  apart.
- `WORK.md` stays under 180 lines (it is at 179), checked by `ops/check.mjs`. Update stale lines in place.

The steps:

4. **Queue 4, width and helper text, per component.** Measured before: at 1280 px the form fields were 640 px wide in a
   column of about 715 px. At 390×844 the first field sat about 1137 px down, under a banner of about 147 px.
   - Anchors: `src/styles/base.css:28` (62ch), `forms.css:52` (40rem), `blocks.css:1124`.
   - Fix it per component. Do not remove every paragraph's max-width, and do not stretch every input.
   - Fold secondary help into closed `<details>`, with editable words and no empty panel.
   - Keep visible: instructions, required or optional, deadlines, privacy and consent, the non-clinical boundary,
     security guidance, errors and referrals. A cut that changes meaning is a proposal, not a change.
5. **Queue 5.** Apply SPILL's lessons on quiet loading and stale replies to filters, resource dialogs, live event
   replacement, staff answer panels and editing. No SPA router.
   - Back and Forward keep their context.
   - An older reply never overwrites a newer choice.
   - A refresh never interrupts typing.
   - Recheck Connect's `netlify/actions/public.mjs` if it can be read. If it cannot, say so.
6. **The editor.** Show each word's permanent key. Add a history of every saved version (`005_edit_history`; rows
   are never changed), and Restore, which saves an earlier version as a new one.
   - Correct every "after the next publish" wording to what is true: the `edit.js` header, `staff.edit.*`,
     `edit.savedWaiting`, `edit.waitingNote`, the router comment, and `staff.js`'s header line 15.
   - The save-publishes way stays a proposal (queue 34).
7. **Close.**
   - Fill the transfer and coverage tables.
   - Run `node ops/check.mjs --browser`.
   - Refresh `WORK.md`: Evidence, and items 33 (b)(d)(e), 15 and 34.
   - Propose, without editing any skill, the lesson that `ops/dev-server.mjs` reads `_headers` once at start, so it
     must be restarted after the inline script changes, or the CSP hash it serves is stale.
   - Write the report from pasted `git --no-optional-locks status -sb` and `log --oneline origin/main..HEAD` output.

## The editor

**Rechecked 24 Oct.** Nicholas was right that saved words do not reach the live site.

- **Edit text** saves a change as a row in `content_edits` on the live database (`netlify/lib/edits.mjs`).
- The pages are static. A build lays `content/edits.json` over the shipped files when that file exists
  (`ops/build.mjs:84–86`). It has never existed: `ls content/` shows no `edits.json`.
- The only way to fill it is **Download the edits file** on the staff page (`site.publish`), then saving the
  file into `content/` by hand before publishing. `PUBLISH-WEBSITE-2026-10-23.command` never mentions edits;
  it commits the folder as it stands and deploys that commit.

So a saved change shows on the staff page as waiting, and stays waiting through every publish.

**Why the publish file cannot just fetch them.** The site answers 401 to anyone outside the Netlify team, so a
build on the laptop cannot read its own live database, and the download is a staff route (`site.publish`). Both
ways round, the words would arrive only by a person saving a file.

**What would make a save publish, as the owner ruled** (`DECISIONS.md`, "The platform": a permitted save
publishes, visitors see it within 30 minutes, editors get Refresh now, no deploy loop). The pages are static
files, so the saved words have to be laid over them when a page is asked for. Three ways, costed against
`ARCHITECTURE.md`, "Cost":

| Way | What it costs | Verdict |
|---|---|---|
| Each page read through a function that looks up `content_edits` | the database wakes for every page not in the cache; one wake every 30 minutes never lets it sleep, 7,200 credits in 30 days at 1 CU, more than the plan | no |
| A save writes the published words to Netlify Blobs as one numbered file; pages are drawn by a function from the build's renderer and that file, cached on Netlify's CDN for 30 minutes and cleared by Refresh now | function time on each cache miss (about 58 pages × 48 a day at most), no database wake; every page then depends on that function, so it needs a fallback to the static file | **proposed** |
| The publish file fetches `/api/staff/edits?download=1` before it builds | blocked by the 401 above; needs a person every time | no |

The middle way changes how every page is served and spends credits, and only a deployed site can prove its cache
and its clearing. So it is written down here as a **proposed change** and not built by this run (queue 34). Until
it is built, `ARCHITECTURE.md` and the staff page say what is true: a save is kept, and reaches visitors only when
`content/edits.json` is saved into the folder before a publish.

**What this run does build (step 6), all testable here:** each word's permanent key shown beside it, a history of
every saved version of a word (a new table; rows are never changed), and Restore, which saves an earlier version
as a new one, as SPILL's history does (`portal/editor/history.js`: "rollback … publishes a NEW version, never
rewriting history").

## Resumed locally (25 Oct 2026, third session)

Nicholas asked for the move to a cloud session, then said *"continue"*. The cloud copy starts from GitHub, and
GitHub does not have the local commit `0b50df0` (R.4) until it is pushed, which is Nicholas's to do. So steps 4–7
go on here, on the same tree.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.5 | Steps 4–7 run in this local session; no cloud session was started | a cloud session cannot see a local-only commit, and pushing is not permitted from here (`CLAUDE.md`, "Never `git push`") | start a cloud session after the owner pushes |

## 5. Width and helper text (queue 4)

**Built locally, tested with fixtures.** Measured with a scratch script on the prototype build, with fictional data
only. The prototype banner (147 px at 390) is counted in every "first question" figure below.

**Width.** The 40rem cap on each question (`forms.css`, `.field`) and on words-only sections is gone. A question now
takes the form's column, as Connect's fields take theirs (`--maxw-field: 100%`). Four kinds of control stay compact
on purpose: number (12rem), phone (20rem), date (20rem) and Other (24rem), plus the ranking selects (8rem). Paragraphs
keep the 62ch measure.

| Width | Before | After |
|---|---|---|
| 1280 | questions 640 px in a 715 px column | 715 px |
| 768 | — | 720 px |
| 390 | — | 357 px |
| 320 | — | 288 px |

The new check also found that question groups (fieldsets) sat 4 px narrower than the column, because of the
browser's own fieldset margin. That is fixed.

**The staff page.** Its signed-in part was capped at 60rem. At 1280 the answer table was cut off at "Organizati…" with
about 240 px of empty page beside it. It now takes the page's width and shows every column; its sentences keep the
measure.

**Helper text.** A new prose part, `{ more, body }`, is a closed `<details>` whose label and body are the form's own
words. Rules:
- the body is never empty, and a fold never sits inside another;
- the label and body still appear in receipts' plain text (`proseText`);
- `aria-describedby` names the help, and a closed body is not read as part of it.

What was folded, and what stays in view:

| Form | Folded behind a label | Kept in view |
|---|---|---|
| Staff application | the programs and teams lists ("Our programs and teams"); each directorate's description ("What this directorate does"); the recommender guidance ("Who can write your letter"); Supplemental Materials; what a Peer Support Group is; the kinds of portfolio samples | the April deadlines, "any number", the upload link and email, "Check all that apply", "Please answer honestly…", the link rules, the Greek Life and study-abroad privacy note |
| Volunteer application | the programs and teams lists; each directorate's description | everything else |

One sentence was removed because it repeated, word for word, the one before it: "Applicants who apply for staff
positions are automatically considered for volunteer opportunities as part of the same review process." The form
versions went up so that the server serves the new shape: staff application 2→3, volunteer application 1→2.

**Phones (480 px and below).** Less space above the form card (48→24 px) and after it (32→24 px), and narrower card
sides (24→16 px). The card keeps its 28 px line rhythm.

The first question, before → after:

| Form | Width | Before | After |
|---|---|---|---|
| Staff application | 390 | 3,019 px | 2,242 px |
| Staff application | 320 | 3,511 px | 2,626 px |
| Volunteer application | 390 | — | 1,357 px |
| Workshop request | 390 | 1,107 px | 1,078 px (931 px without the banner) |
| Workshop request | 320 | 1,363 px | 1,334 px |

**Checks.**
- `test/forms.test.mjs`: the fold is accepted, refused when empty, blank, nested or carrying an extra key, flattened
  to plain text, and rendered closed. The old validator refuses a fold, so this test fails on the old code.
- `ops/interact.mjs`, "a form's width" and "folded help", on the staff application at 1280, 390 and 320:
  - every question takes the column, and a short value's control stays compact;
  - nothing scrolls sideways;
  - a fold opens with Enter and closes with Space, and opens without JavaScript.
- With `max-width: 40rem` put back for one run, the width check failed at 1280 ("1 of 81 failed"). Without it,
  all 81 pass.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.6 | A question takes the form's column. Short-value controls and paragraphs keep their widths | brief, queue 4: copy the reading/work-area distinction, not every value; Connect `tokens.css:314` | put back `max-width: 40rem` on `.field` and `.section.is-words` in `forms.css` |
| R.7 | Secondary help is a new prose part `{ more, body }`, validated by the shared `proseProblem` and described in the editor contract | brief: "move secondary assistance into accessible closed details"; reuse the shared validation | drop the `more` branch in `forms.mjs` and `form.mjs`, then restore the two form files |
| R.8 | What is folded is listed above. Deadlines, consent, privacy, required wording and contacts stay in view. The exact duplicate sentence was removed; nothing else was cut | brief: keep instructions, deadlines, privacy and consent; a cut that changes meaning is a proposal | `git diff` on `content/forms/staff-application.json` shows every moved line |
| R.9 | Form versions bumped: staff 2→3, volunteer 1→2 | the server prefers a stored definition only when its version is higher (`netlify/lib/intake.mjs:32`); precedent `6a74334` | restore the two files |
| R.10 | Tighter phone spacing around the form card | brief: keep the first field near the start of phone screens; the card's rhythm is kept | delete the `max-width: 480px` block under `.form-head` in `forms.css` |
| R.11 | The staff work area takes the page's width; its sentences keep the measure | brief: dashboard sections and status panels use their space | put back `max-width: 60rem` on `.staff-app` in `blocks.css` |

**Proposed, not made.** These cuts change approved source-form wording, so each needs the owner, and Programs for
the resource form.

| # | Where | Proposal | Why it is not made here |
|---|---|---|---|
| P.1 | Staff and volunteer applications, first line | remove "Please read all information carefully." It adds no instruction, and it sits above the first question on a phone | approved source wording |
| P.2 | Staff application, "Support" | "explore the Badger Supports website at badgersupports.org" is read on badgersupports.org. Say "explore this website and our Instagram" | changes approved wording |
| P.3 | Staff application, "Overview" | fold the funding paragraph (General Student Services Fund) under "How Badger Supports is funded". Keep hours and pay in view | it describes employment terms; Nicholas decides whether it is secondary |
| P.4 | Resource request, "Options" (about 1,900 characters) | fold each option's description under its name | it describes the choices being made, so folding it may hide what someone needs to choose; Programs decides |

**A defect found by the version bump: a send that never got a reply.** It was already in the code before this run.
- In the full test run after R.9, `test/applications.test.mjs` stopped and waited, using no CPU, for six minutes.
- Two tests named the staff application's version as 2. A third published a changed form as version 3, which is now
  the shipped version, so the server never preferred it. Those tests now read the shipped version
  (`SHIPPED`, `NEXT`).
- One of them also showed a real fault in `netlify/lib/intake.mjs`. A send from a page older than the form, carrying
  a file the server cannot match, built its list of answers left behind (`leftBehind` → `definitionFor`) inside the
  database transaction, but through the global connection.
- On one connection (PGlite: the dev server and every test), that read waits for the transaction, and the
  transaction waits for it. No reply ever comes.
- Deployed, the pool lends a second connection, so the read waits only when the pool has none free. The pool's size
  is not visible from here.

The fix reads that list after the transaction ends. The only other `tx(...)` callers (`edits.mjs:75`, `http.mjs:88`)
read only through their own handle (scratch scan). A new test, "a file Send cannot match, from a page older than
the form…", times out at 15 s on the old code. On the new code it passes, and the reply keeps the dropped question's
answer.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.12 | `submit` builds `gone` after `tx` returns, not inside it | a read beside an open transaction on a single connection waits forever; nothing in `gone` is written, so it needs no transaction | move the `leftBehind` call back into the `files.errors` branch |

## 6. Stale replies, Back/Forward, refresh (queue 5)

**Built locally, tested with fixtures.** SPILL's lessons were applied to the places that ask the server while the
page is open: quiet loading, an older reply never overwriting a newer choice, a refresh that never interrupts
typing, and Back and Forward keeping context. No router was added. Each place was read first. Four were already
right, and two had defects.

| Place | What could go wrong | Before this run | Now | Proved by (`ops/interact.mjs`) |
|---|---|---|---|---|
| Live events (`schedule.js`), refresh | an answer replaces the week while focus is in it, and focus falls to the page | replaced at once; focus went to `body` | `swap()` (`schedule.js:79`) holds the answer while focus is inside and puts it in on `focusout` | "events: a section with focus in it waits for focus to leave" |
| Live events, Back or Forward to a kept page | Today stays on the day the page was first opened, and nothing asks again | no new ask; Today stayed on 26 Oct after a day | a kept page (`pageshow` persisted, `:116`) marks Today again and asks again; a page shown again after more than 5 minutes (`visibilitychange`, `:121`) does the same. Five minutes is how long the CDN holds an answer (`router.mjs:249`, `s-maxage=300`) | "events: Back or Forward to a kept page" |
| Live events, two asks at once | the older answer arrives last and overwrites the newer | no guard | a numbered ask (`asked`, `:98–107`); only the newest answer is put in | same part, "restored twice" |
| Edit box, Save (`edit.js`) | a save's reply arrives after other words were opened, and closes the box on them or writes the conflict's words into it | it did both | `save()` remembers which words it saved (`:222–228`). A reply for words no longer in the box goes on the bar (`edit.error.ended`, `edit.error.failed`); a conflict updates what is kept for those words (`:240`) | "edit button: other words opened while a save is still going"; "…a conflict answered after other words are opened" |
| Phone menu (`site.js`) | Escape, and Back to a kept page with the menu open | already right: Escape closes it unless a dialog is open (`:20`); a kept page closes it (`:30–31`) | unchanged | "phone menu", "menu and Back" |
| Form Send (`form.js`) | Send pressed twice; a late reply | already right: an `AbortController` and a turn guard (`:154`, `:163`) | unchanged | "Send pressed twice", "a lost reply" |
| Resource filters and dialog (`resources.js`) | Back loses the filter | already right: topic and search sit in the address by `replaceState` (`:61–64`); the dialog is a native `<dialog>` (`:86–116`) | unchanged | the a11y and shot passes load the page; Back with a filter set is not exercised (read only) |
| Staff answers (`staff.js`) | Show answers pressed again; a reply after leaving | already right: busy while asking, and nothing is written into a panel that is gone (`:139–141`); leaving clears the tools and a kept page starts again (`:340–350`) | unchanged | "staff page: Back after signing out"; Show answers pressed twice is not exercised (read only) |

**Evidence.**
- On the old `schedule.js` and `edit.js`, 7 of 92 failed. Six were the new checks above.
- The seventh, "staff ended", is a timing flake in a part these files do not touch. It has passed in every run
  since: two on the new code, and the step 6 runs on old and new.
- With only the numbered ask removed, 1 of 92 failed: "restored twice … (asked 3, showing v2)". The guard is
  what keeps the newer answer.
- On the new code, 92 of 92 passed; with step 6, 99 of 99 (`scratchpad/interact-step6.txt`).

**Connect, rechecked 25 Oct.** I read Connect's `netlify/actions/public.mjs`, and changed nothing in Connect.
- Commit `7f32fd4` is in Connect's local `main` but not on GitHub's: `origin/main` is `8688fed` (24 Oct, 10:32), and
  the local branch is 3 commits ahead. It is the commit that "sends the events that just happened". So `WORK.md`
  item 30 still says "not pushed".
- Connect sends each event's `endDate` (`public.mjs:98`) and uses it to decide what has ended (`:128`). Nothing in
  this site reads `endDate` (`grep -rln endDate src netlify ops` finds nothing), so an event that runs for several
  days shows on its first day only. I found this by reading, not reproduced: no fixture has a multi-day event, and
  Connect's sender is not on GitHub yet. It is recorded here, not built.

**A local nuisance, not a defect.** This folder syncs, and a build twice left copies named "… 2" in `dist/`. The
scratch rebuild script builds again until none remain, up to three times. Nothing in `dist/` is committed; the
publish file refuses " 2" copies and builds its deploy in a fresh clone, so none can ship.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.13 | A live events answer waits while focus is in the section it replaces, and goes in when focus leaves | brief, queue 5: "refresh must not interrupt typing"; SPILL's quiet loading | in `schedule.js`, make `swap()` call `put()` at once |
| R.14 | A kept page marks Today again and asks again, as does a page shown again after 5 minutes | brief: Back/Forward keep meaningful context; 5 minutes is the CDN's hold (`router.mjs:249`), so an earlier ask would get the same answer | delete the `pageshow` and `visibilitychange` listeners in `schedule.js` |
| R.15 | Only the newest events ask is put in | brief: "rapid actions must not let older responses overwrite newer intent" | drop the `mine !== asked` test |
| R.16 | A save's reply touches the box only if the box still holds the words saved; otherwise it reports on the bar | the same rule; the bar is already where the editor reports | in `edit.js` `save()`, drop the `here` test |

## 7. The editor: keys, earlier versions, Restore

**Built locally, tested with fixtures.** This makes the editor more like SPILL's. It does not make a save publish,
which is still the proposal in "The editor" above (queue 34).

What changed for an editor:
- **The key.** The edit box shows each word's permanent key ("Key: page:pg-home:b-home-hero/title"), and More words
  finds words by key as well as by their text. The key is shown once, in the box, not beside every More words item.
- **Earlier Versions.** A closed list in the edit box. Opened, it shows the other words saved here before, newest
  first, with who saved them and when. The words already in the box are not listed again, and words saved more than
  once are listed once.
- **Restore.** Each earlier version has Restore. It saves that version again as the newest, through the same
  conflict check as Save, so nothing is overwritten unseen and nothing is lost.
- **Wording.** Every "after the next publish" line now says what is true, in as few words as will do: "Saved, but
  not on the site yet." The changed keys are `edit.savedWaiting`, `edit.waitingNote`,
  `staff.edit.waiting.one`, `staff.edit.waiting.other` and `staff.edit.publish`, plus the comments in `edit.js`,
  `staff.js` and `router.mjs`. `edit.saved` and `staff.edit.none` were already true and are unchanged.

How it works:
- A new table, `content_edit_history` (`netlify/database/migrations/005_edit_history`). Every save adds a row inside
  the save's own transaction (`edits.mjs`), and rows are never changed. The migration fills it once from
  `content_edits`, so a word saved before today has its current version listed.
- `GET /api/staff/edit/history?target=…` (`router.mjs:216`, `:288`) needs `site.edit`, like Save. It lists the newest
  50 (`HISTORY_LIMIT`) with name and time; the Connect id is never sent.
- In the page, the list is a native `<details>`, asked for only when opened, with a numbered ask like R.15.

**Evidence.**
- `test/staff.test.mjs`: the route refuses without `site.edit`, and "every saved version is kept, newest first, and
  Restore…" passes. On the code before this step, 13 of 15 passed; the two new tests got 404.
- `ops/interact.mjs`, "edit button: the key, earlier versions and Restore":
  - the key is shown;
  - the list opens by keyboard and lists the earlier words only, with who and when;
  - Restore works by keyboard and is described by its own words;
  - the stored rows read first, second, first, and focus goes back to the words;
  - a slow answer for the first words, arriving after the second words were opened, is dropped;
  - searching `text:page.skip` in More words finds one item, and the box it opens shows that key.
- On the step 5 `edit.js`, 2 of 94 failed (no key; no list to open). On the new code, 99 of 99 passed, before the
  trim (R.23) and again after it.
- Tests: 167 of 167. (Plain `node --test` said 168: its default pattern also runs `test/helpers.mjs`, which has
  no tests.) `ops/editable.mjs`: 310 keys after the trim, no word left uneditable, no key unused. The contract
  was regenerated (`docs/CONNECT-EDITOR-CONTRACT.md`, 845 lines).
- I inspected it with a scratch script and made-up words, with Earlier Versions open:
  - at 320, 390, 768 and 1280 px and at 200% zoom, nothing in the box runs past its edge and the page does not
    scroll sideways; the box scrolls inside itself; the key wraps at 320; I looked again after the trim;
  - by keyboard with reduced motion, every step is reached and Restore has its 3 px outline;
  - there were no script errors.
- One thing seen and not changed: the Edit Text button is the 79th Tab stop on the home page, because the bar sits at
  the end of the page. It was already so.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.17 | History is its own table, written in the save's transaction and never changed; filled once from `content_edits` | SPILL `portal/editor/history.js`; brief: preserve stored data | migrations only add: drop the table in a new migration, and remove the insert in `saveEdit` |
| R.18 | Restore saves at once as a new version, through the conflict check | SPILL: "rollback … publishes a NEW version, never rewriting history"; one save path | make Restore put the words in the box for Save |
| R.19 | The list shows the newest 50; older rows are kept, not shown | a word edited more than 50 times is unlikely, and the box must stay short on a phone | change `HISTORY_LIMIT` in `edits.mjs` |
| R.20 | The list sends names and times, never the Connect id | brief: keep identities out of what does not need them | — |
| R.21 | Earlier Versions is a native `<details>`, closed, asked for only when opened | brief: a native control where one works; quiet loading | open it by default in `build()` |
| R.22 | The 002 migration's comment is left as written | a migration that has run is a record | — |
| R.23 | Editor helper text cut: the words in the box are not listed again under Earlier Versions, repeats are listed once, "Saved by" is dropped, the key shows once in the box and not per More words item, and the waiting and publish lines are one short sentence each | owner, 25 Oct: "Don't add unnecessary helper text, the step 6 edit functionality has a lot of helper text" | put back the `edit.history.current` key and the per-item key in `moreList()` |

## 8. A long answer cut off at its limit, and the transfer table

**Built locally, tested with fixtures.**

**The defect.** I found it while checking the "counters" row below. A long answer box stops at its limit with no
word, so pasted text past the limit is lost without the person knowing. Reproduced on the workshop form's "Other
contact details" (500 characters): 800 pasted, 500 kept, nothing shown or said.

**The fix.** Under a long answer box, "Characters left: 40" shows once a tenth of its room is left, and says so
once to a screen reader on reaching that point and again at none left. It is SPILL's counter (`home.js:96–111`),
except that it shows at a tenth rather than at 500 left, because some boxes here hold only 500. The links box and
short boxes are left out. Without JavaScript the box still stops at its limit, and the server refuses anything
longer. Code: `counters()` (`src/client/form.js:68`), key `form.left`, style `.field-left`.

**The resources page.** The browser checks exercised neither a card's details nor Back with a filter set
(section 6's table said "read only"). Both are now in `ops/interact.mjs`, part 6.

**Evidence.**
- "a long answer near its limit": on the old `form.js`, 2 of 102 failed; on the new, 102 of 102 passed.
- "resources: a card's details and the filter": with the address no longer updated, Back shows All Topics and the
  check fails; with the close handler removed, the page stays unable to scroll and the check fails. Chromium puts
  focus and scroll back by itself, so those two alone could not catch a loss.
- On the new code, 105 of 105 passed. Tests: 167 of 167 (section 7 says why not 168). `ops/editable.mjs`: 311
  keys, no word left uneditable, no key unused. The contract was regenerated (846 lines).
- At 390 px the line sits under the box (`scratchpad/step7/counter-390.png`).

**Transfer table.** The sources are SPILL's, rechecked 25 Oct. Connect's interface was not read again for it.

| Behaviour | Source (SPILL) | Public equivalent | Status | Regression (`ops/interact.mjs` unless named) |
|---|---|---|---|---|
| Dropdown / select | native `<select>` (`portal/practice-admin.js:65–67`) | native `<select>` for choose-one and rank (`src/render/form.mjs:67`, `:73`) | already present; no custom control | "a form's width": every list fills its question at 1280, 390, 320 |
| Dialogs | native `<dialog>`, focus in, focus back (`lib/dom.js:79–93`) | edit box (`edit.js:185`, `:347`); a resource's details (`resources.js:107–114`) | already present | "edit button: the key, earlier versions and Restore"; "resources: a card's details…" |
| Close / cancel | Cancel is `formnovalidate` (`portal/ui.js:362`); Escape stops at the inner layer (`portal/shell.js:548`, `:556`) | Cancel and Close are `type=button` (`edit.js:311`, `:336`); page Escape skips a dialog (`site.js:31`); the menu closes its innermost layer first | built in step 1 (menu); the rest already present | "phone menu"; "touch menu" |
| Focus | quiet moves keep focus (`portal/ui.js:20–33`) | the error summary takes focus (`form.js:122`, `:222`); staff states move focus to what is new (`staff.js:337`); events wait while focus is inside (`schedule.js:79`) | events built in section 6; the rest already present | "a question added while the page is open"; "staff page: Back after signing out"; "events: a section with focus in it…" |
| Button rows | `.btn-row` (`portal/ui.js:360`) | `.form-actions` (`forms.css:136`), `.edit-actions` (`blocks.css:1192`); both wrap | already present | "a form's width": nothing scrolls sideways at 320; the edit box at 320 by scratch inspection only (section 7) |
| Validation | `aria-invalid` set and cleared per field (`home.js:145–151`) | `aria-invalid` with its message (`form.js:93`, `:111`); a summary of links; the server's rules | already present | "a question added…" (marked and listed); `test/intake.test.mjs:115–116` |
| Counters | hidden until near the limit, said at 200, 50, 0 (`home.js:96–111`) | none; now `counters()` (`form.js:68`) | **defect, built here** | "a long answer near its limit" |
| Loading | a skeleton only after a wait; quiet moves show none (`portal/ui.js:155–189`) | "Sending…" in a status line (`form.mjs:165`); staff buttons busy at once, new words after 200 ms (`staff.js:55–59`); Earlier Versions "Loading…" | already present; no skeleton, the pages are built ahead | "Send pressed twice"; "staff page: signed in, no Sign In flash" |
| Empty / error states | `errorBox` (`portal/ui.js:209`), `emptyNote` (`:314`) | no matches with the count said (`resources.mjs:132–135`); form network and closed notices; staff "none yet" and failed delivery (`staff.js:104`, `:158`); Earlier Versions none and failed | already present | "no connection"; "closed while the page is open"; "staff page: the connection drops"; "staff page: answers the account may no longer read" |
| Refresh | a redraw keeps scroll and focus (`portal/ui.js:20–38`) | live events (`schedule.js:79–121`); a kept staff page starts again (`staff.js:350`) | built in section 6 | "events: …" (both parts); "staff page: Back after signing out" |
| Saved context | a quiet move keeps the place (`portal/ui.js:20–23`) | topic and search in the address (`resources.js:61–64`); answers kept across a form change; the page to come back to after sign-in | already present; resources now exercised | "resources: a card's details and the filter"; "a question renamed while the page is open"; "staff page: the place to come back to" |

**Coverage.** The brief's own table, with where each request ended.

| Request | Where | State |
|---|---|---|
| "the sign on pages", "portal sign in, dashboard" | sections 3 and 4 | built locally, tested with fixtures |
| "all of the issues that were … resolved in the Intranet, and SPILL" | sections 1–8, the transfer table | built locally, tested with fixtures; one new defect found and fixed (above) |
| "text not stretching all of the way" | section 5 | built locally, tested with fixtures |
| "the amount of helper text" | sections 4, 5; R.23 | built locally, tested with fixtures |
| "building rules" and issues "across the folders" | build rules followed; section 6, "Connect, rechecked" | Connect `7f32fd4` not on GitHub; the site ignores `endDate`. Both in `WORK.md` item 30 |
| The editor ruling (24 Oct) | sections 7 and "The editor" | keys, history and Restore built; a save still does not publish (`WORK.md` item 34) |
| The backup spreadsheet (24 Oct) | `WORK.md` item 18 | queued, not built |

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.24 | A long answer shows the room left at a tenth of its limit, says it on reaching that and at none, and covers long answer boxes only | brief: "counters"; SPILL `home.js:96–111`; the owner's note on helper text, so it is hidden until needed | remove `counters(form)` from `enhance()` and the `form.left` key |
| R.25 | The resources page's details and Back are checked in `ops/interact.mjs`, not a new suite | brief: "Extend existing suites" | delete part 6 |

## Where the run ends, 25 Oct 2026

`node ops/check.mjs --browser` at 02:26 passed every gate (exit 0; 105 of 105 pressed and timed). After `WORK.md` and
this log were brought up to date, `node ops/check.mjs`, the gate a publish runs, passed again: 311 keys, `WORK.md`
179 lines, 58 pages, tests 167 of 167.

Nothing from the run is pushed. GitHub's `main` (`git ls-remote origin refs/heads/main`) is
`aa5668cb5fcffd320a155322c0b58db76e6a0f7d`; the folder is one commit ahead (`0b50df0`) with the rest uncommitted.
Nothing is deployed. Netlify's production deploy, read 25 Oct, is `6adc3b39a97983e84a1dc512`, "Website (aa5668c)",
published 24 Oct 05:00 UTC, with migration `003_files` applied. A publish pushes `0b50df0` and the changes in the
folder, and the deploy applies migrations `004_session_check` and `005_edit_history` to the production database.
004 adds a column to staff sessions; 005 adds the history table and copies the latest saved words into it.
Neither changes or removes existing data.

## Handed to a cloud session, 25 Oct 2026

The owner asked for one command to push and publish, then a tidy-up, then one command that carries on the work in a
cloud session, the way SPILL does it.

**Without the photos.** A cloud checkout has no `local/media-originals/`, so the build stopped on 37 missing originals.
`node ops/check.mjs --no-media` and `node ops/dev-server.mjs --no-media` now build with no image variants, the dev
server answers each photo with a flat grey stand-in, and the one test that needs the originals is skipped. The first
clean-clone try failed on the screenshots, with a 404 for every photo; the stand-ins fixed that. Measured in a clean
clone, `node ops/check.mjs --browser --no-media` (exit 0): 311 keys, 198 files read, 58 pages, 0 image variants, tests
166 passed and 1 skipped, 174 captures with no console errors, 181 a11y, 105 interact. On the laptop, with the photos,
`node ops/check.mjs --browser` passed at 03:14 (exit 0): 894 image variants, tests 167 passed, the rest the same.

**The tidy-up.** In `Public Website/`, the 19 Oct launch line `START-REMOTE-SESSION.txt` and the empty marker
`.run-started` moved to `Admin/_archive/2026-10/public-website-launch-2026-10-19/`, with a row in its `INDEX.md`.
`README.md` was rewritten to point at the current files, and its old copy sits beside them. Nothing was deleted.

**The cloud route.** As SPILL does it: the brief sits in a private artifact. The session starts from a clean clone of
the published `main` and works the Queue in slices. It publishes checksummed patches to the artifact, with no commit,
push or branch. The laptop applies the cumulative patch and re-runs every check with the photos, and Nicholas
publishes. Queue order: 35, 30, 34 + 15, 24, 18, 38, 37, 39.

| # | Decision | Basis | To reverse |
|---|---|---|---|
| R.26 | `--no-media` for `ops/check.mjs` and `ops/dev-server.mjs`: no image variants, grey stand-ins, the originals test skipped | the photos are only on the laptop, and a cloud session must still run every gate | remove the flag from both files and the skip in `test/media-originals.test.mjs` |
| R.27 | The rest of the Queue goes to a cloud session that hands back patches, in the order above. Owner items and Connect's are skipped | the owner, 25 Oct; SPILL's route; brief: "No … commit" | ignore the artifact and carry on here |
| R.28 | The 19 Oct launch files are archived and `README.md` is rewritten | folder rule: "Archive, never delete" | the 25 Oct row in `Admin/_archive/INDEX.md` |
