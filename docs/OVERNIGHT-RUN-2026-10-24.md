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
