# Communications

**Only the hand-off to Connect leaves this site.** A submission is stored in the site's own database, and the work
of carrying it onward is written down beside it as rows in an outbox. After the reply, `netlify/lib/deliver.mjs`
sends its `connect.ingest` row to Connect's Website Forms. Receipts and the backup workbook are built and switched
off, so no email has been sent and no spreadsheet exists; no schedule runs the outbox (below).

This page records what happens today, which public forms exist and who is proposed to own them, and a plan for
email and the backup spreadsheet. Everything after "What happens to a submission today" is a **proposal**
(`../../MASTER-PROMPT.md` §7) until the owner approves it.

## The public forms

Observed on 19 Oct 2026 from public views only; no response was opened or submitted (`../../FORM-AUDIT.md`). The
scope rule is the owner's (`DECISIONS.md` §1): public forms are rebuilt here, internal workflows stay in Connect,
and SPILL's forms stay with SPILL.

| # | Workflow | Live today | In this rebuild |
|---|---|---|---|
| 1 | Resource request | a Google Form behind the "Request" link in every footer | **built closed** (23 Oct), from Google's public view, its words kept; previewed at `/forms/resource-request/preview/`. The Colors of Support page still links the Google Form; the rebuild's footer does not link it. It asks for materials, so it is not the resource viewer's Suggest a Resource (§8), which is still not built |
| 2 | Peer group, volunteer training or collaboration request | a Google Form from `/request-a-program` and `/join/peer-support-groups` | **built closed** (23 Oct), one form as Google has it; previewed at `/forms/program-request/preview/`. Request a Program and Request a Workshop still link the Google Form |
| 3 | Workshop request | a Google Form from `/join/request-a-workshop` | **built**: `/forms/workshop-request/` |
| 4 | Referral card design survey | a Google Form from `/initiatives/referral-cards` | **built closed** (23 Oct); previewed at `/forms/referral-card-survey/preview/`. Referral Cards still links the Google Form |
| 5 | Mailing list | a Google Form, and a whole-page embed at `/join/email-list` | **built closed** (23 Oct), from Google's public view; previewed at `/forms/email-list/preview/`. The Email List page still links the Google Form. See "The mailing list" |
| 6 | Staff application | a closed Google Form | **built closed**, all 11 sections (23 Oct), from the 21 Oct transcription (`Admin/Handoffs/HANDOFF-APPLICATIONS-AND-INVITES-2026-10-21.md`): its closing message shows on Get involved, and a prototype build previews it at `/forms/staff-application/preview/` |
| 7 | Volunteer application | a Google Form that answers 401 signed out, because Google requires sign-in on a form with uploads | **built closed**, all 9 sections (23 Oct), same handoff; previewed at `/forms/volunteer-application/preview/`. Get involved still links to the Google Form |
| 8 | Alumni testimonial | a Google Form that answered 401 | not built: still 401 signed out on 23 Oct, so its questions cannot be read from here. To investigate (publication consent, a missing sign-up embed) |
| 9 | Programming feedback | a Google Form behind `feedback.badgersupports.org` | **built**: `/forms/programming-feedback/`, anonymous |
| 10 | Letter of referral / recommendation | a closed Google Form behind `recommend.badgersupports.org` (via `forms.gle/WC3ihM2Ahqz8jC6T7`), linked from the staff application | **built closed** (23 Oct), from a PDF of the form Nicholas supplied; previewed at `/forms/recommendation-letter/preview/` |

The audit's whole-directory check also found internal, personnel and SPILL forms whose questions load publicly.
That they load is not a reason to publish them here.

## The forms built

From `content/forms/*.json`. A form's `workflow` block names where its submissions go; none of it is wired to
anything outside this site yet.

| Form | State | Anonymous | Connect queue | Owner | Receipt | Backup |
|---|---|---|---|---|---|---|
| `workshop-request` | open here; **closed at launch** | no | `programs.workshop-requests` | Programs | proposed | proposed |
| `programming-feedback` | open here; **closed at launch** | yes | `programs.feedback` | Programs | none | proposed |
| `staff-application` | **closed** | no | `hiring.applications` | Executive | proposed | proposed |
| `volunteer-application` | **closed** | no | `hiring.volunteer-applications` (proposed) | Executive | proposed | proposed |
| `recommendation-letter` | **closed** | no | `hiring.recommendations` (proposed) | Executive | proposed | proposed |
| `resource-request` | **closed** | no | `engagement.resource-requests` (proposed) | Engagement | proposed | proposed |
| `program-request` | **closed** | no | `programs.program-requests` (proposed) | Programs | proposed | proposed |
| `referral-card-survey` | **closed** | no | `programs.referral-card-ideas` (proposed) | Programs | none | proposed |
| `email-list` | **closed** | no | `executive.email-list` (proposed) | Executive | none | proposed |
| `resource-problem` | **closed** until Connect files it | yes | `resources.suggestions` (asked of Connect) | Resource-editing directors | none | proposed |
| `resource-update` | **closed** until Connect files it | yes | `resources.suggestions` (asked of Connect) | Resource-editing directors | none | proposed |
| `resource-suggestion` | **closed** until Connect files it | yes | `resources.suggestions` (asked of Connect) | Resource-editing directors | none | proposed |

The two applications ask for a resume (and the staff one a cover letter) as one PDF of at most 3 MB, kept on
this site until Connect takes it (`docs/ARCHITECTURE.md`, "Files"). Answers about work study and commitments are
marked `confidential`: they go to Connect only, never to the staff page here or the backup. The letter form takes a
recommender's letter the same way, as one PDF; nothing on it is marked confidential, and who reads letters is a
Connect permission. Connect accepts only a resume and a cover letter today (Exchange request
`RECOMMENDATION-LETTERS-INTO-CONNECT-2026-10-23`).

**At launch** (owner, 20 Oct 2026): `--production` and `--launch` builds serve every open form closed, its page
showing one button, "Fill Out Our Form", to the Google Form it replaces (`launchForms()` and `googleFormUrl()` in
`src/shared/forms.mjs`; `test/launch.test.mjs`). The server reads the same closed definitions. A form already
closed keeps its own message.

The three request forms (23 Oct) take their owners from Connect's directorate pages: Google titles the resource
request "COMM", and Communications work sits with Engagement (`docs/directorates/engagement.md` in Connect); the
program request is "PROG"; Connect files the Referral Cards initiative under Programs (`programs.md`). Each keeps
Google's required answers, including four on the program request that read as optional (their `review` notes).

The queue names and owners are proposals: Connect has no Forms area yet (Exchange request `PUBLIC-SITE-FORMS`).
A switch row in the database (`form_state`) wins over a form's shipped `state`, so Connect can open or close a
form without a deploy once it can write that row. **Gap:** a page built closed stays closed in the browser until
the next build (`src/client/form.js` can close a form but not open one), so opening a launch-closed form takes a
switch row and a rebuild.

## What happens to a submission today

In `netlify/lib/intake.mjs`:

1. The answers are checked against the form's questions. A form whose hidden trap field was filled answers
   `ok` with a reference and **stores nothing** (the `_website` trap). A resend of a submission already stored answers with
   the first reference and stores nothing new (`idem_key`).
2. **One transaction** writes, together:
   - the submission (`submissions`), its answers keyed by stable question id, with no record of who sent it
     or from where;
   - a `received` event (`submission_events`);
   - an outbox row `connect.ingest`, state `pending`;
   - an outbox row `sheets.backup`, state `pending`;
   - an outbox row `mail.receipt`, state **`held`**, reason `sender-unverified`, but only where the form is not
     anonymous, its `workflow.receipt` is `on`, and an email answer exists (`mail.receipt`). **No form has `on` today**,
     so no receipt row is written.
3. Only after the commit does the server answer `ok` with the reference, such as `WR-` and two groups of four
   characters for a workshop request (`newRef()`).

Each outbox row carries `dedupe_key` = `<kind>:<reference>`, which the table holds unique
(`netlify/database/migrations/001_intake/migration.sql`). A retry cannot queue the same work twice. The table
also allows `mail.notify`; nothing writes one.

**Only the Connect row is sent** (20 Oct 2026). `netlify/lib/deliver.mjs` hands each `connect.ingest` row to
Connect's Website Forms, and a director signed in at `/staff/` reads the latest answers (`ARCHITECTURE.md`, "Staff
sign-in and Connect"). `sheets.backup` and `mail.receipt` rows stay `pending` or `held`. This has run only against a
local Connect rig: Connect's half (`publicFormIngest`) is in its production source, but nothing has been sent to it
live (`../WORK.md`, Blocker 1), so the forms still launch closed (above).

## Proposal: who gets told what

The communications matrix asked for by §7. Template names follow Exchange request
`PUBLIC-SITE-EMAIL-AND-BACKUP`: `public.<form>.receipt` and `public.<form>.notify`.

| Form | Message | To | From | When | Status |
|---|---|---|---|---|---|
| Workshop request | receipt | the address given in the form | `directors@badgersupports.org` | once stored | proposed; held until the sender is confirmed |
| Workshop request | notify | Programs | Connect | the submission appears in Connect's queue | proposed; whether Programs also wants an email is theirs to say |
| Programming feedback | receipt | nobody | | | **none**: the form is anonymous and asks for no address |
| Programming feedback | notify | Programs | Connect | as above | proposed |
| Staff application | receipt | the applicant | `directors@badgersupports.org` | once stored | proposed; the form is closed |
| Staff application | notify | Executive | Connect | as above | proposed |
| Volunteer application | receipt, notify | as the staff application | | | proposed; the form is closed |
| Resource request | receipt, notify | the address given; Engagement | as the workshop request | | proposed; the form is closed |
| Program request | receipt, notify | the address given; Programs | as the workshop request | | proposed; the form is closed |
| Referral card survey | receipt | nobody | | | **none**: the address it asks for is for news of the project, not a receipt |
| Referral card survey | notify | Programs | Connect | as above | proposed; the form is closed |

The rules this keeps:

- **The sender.** `directors@badgersupports.org` is proposed. Nicholas's own account is never the fallback
  (§7). Until the owner confirms the sender and Connect's send action exists, receipts are written `held`.
- **Mail goes through Connect's mail path**, not from this site. Connect answers each send with its message
  id, and the outbox row records it. "Sent" means accepted by the mail service, not read.
- **No promise about how fast anyone replies.** The rebuild adds none. The workshop request's confirmation
  says the team will reach out "within one week". That is the Google Form's own wording, kept word for word,
  and nobody has confirmed it with Programs (the form's `review` note; `../WORK.md`).
- **Anonymous stays anonymous.** An anonymous form never asks for an address, so it never gets a receipt. No
  submission records the sender's connection, for any form. The rate limit counts by a keyed hash of the
  connection in its own table, kept apart from submissions; rows over a day old are deleted at the next count
  (`rateLimit()` in `netlify/lib/http.mjs`).

## Built locally, 25 Oct 2026: delivery, receipts and the backup workbook

Built in the cloud run (`docs/OVERNIGHT-RUN-2026-10-24.md`, "Cloud run" §5), tested against a fake Connect and a
fake Sheets API only. **Nothing is switched on**: no schedule is registered, no sender is set, no workbook exists.

- **Delivery** (`netlify/lib/deliver.mjs`): claims, so two instances never send one row; waits of 2, 4, 8, then 15
  minutes; an answer lost on the way back is sent again with the same reference, and Connect keeps one.
- **Receipts**: a `mail.receipt` row stays `held` until the owner sets `RECEIPT_SENDER` to a verified
  `@badgersupports.org` sender; then it goes to Connect's mail path with its dedupe key (Connect's `publicReceipt`
  is **proposed**, an Exchange request). Never for an anonymous form.
- **The workbook** (`netlify/lib/backup.mjs`): Start Here, Dashboard (counts only) and one tab per form, found by
  developer metadata, in the brand's cream and ink with a frozen header, every cell through `cellText()`, each
  answer written once by its reference. Confidential answers are left out unless `BACKUP_CONFIDENTIAL=include`.
  It **pushes** through the Sheets API with a service account, not the pull script proposed below: the brief asked
  for it against a fake Sheets API, and a push needs no new door into the site. Which one ships is the owner's call.
- **To switch on**, in order: deploy (applies `006_outbox_claims`); Connect ships `publicReceipt`; set
  `RECEIPT_SENDER`; create the workbook in the directors' account, share it with a service account, set
  `BACKUP_SPREADSHEET_ID` and `GOOGLE_SERVICE_ACCOUNT`; add `netlify/functions/outbox.mjs`:

  ```js
  import { runOutbox } from "../lib/deliver.mjs";
  export default async () => { await runOutbox(); return new Response(null, { status: 204 }); };
  export const config = { schedule: "*/15 * * * *" };
  ```

## Proposal: the backup spreadsheet

From Exchange request `PUBLIC-SITE-EMAIL-AND-BACKUP`. **Owner, 24 Oct 2026:** "a backup styled spreadsheet in the
directors account that has all of the forms answers, one tab for each form, as well as a dashboard and a landing
page". Read as one Google Sheets workbook owned by `directors@badgersupports.org` (to confirm: `WORK.md` owner
action 5), queued under `WORK.md` item 18. **Nothing of it is built.**

**The pattern already exists in Connect**, and this follows it rather than inventing another: Connect's volunteer
backup workbook (`BSS Intranet Transfer v23/tools/apps-script/volunteer-backup.gs`, read 24 Oct as reference only)
is an Apps Script bound to a workbook in the directors' account, `@OnlyCurrentDoc`, which every 30 minutes asks the
site for what changed behind one key (`VOL_BACKUP_KEY`), writes a Dashboard, an About tab and one tab per event,
finds its own tabs by hidden developer metadata rather than by name, acknowledges what it wrote, and is one way only.
The same here, proposed:

- **Start Here** (the landing page): what the file is (a copy; Connect's Website Forms is where answers are worked
  through), who may open it (directors by name, never "Anyone with the link"), that confidential answers are not in
  it, when it was last confirmed and the last problem met, and a link to each form's tab and to Connect. Its words
  are site text keys, so they are editable like every other word.
- **Dashboard**: one line per form: open or closed, answers in all, in the last 7 and 30 days, the latest, and
  how many wait or failed to reach Connect. Counts only, never answer text.
- **One tab per form**, found by the form key in developer metadata so a renamed tab is still found: Reference,
  Received, Version, then the columns below.
- **Styled** from `src/styles/tokens.css`: a frozen header row in the site's cream with ink text, the title in the
  accent red, banded rows, dates as dates, a filter on. No coloured edge bars (the 24 Oct ruling).
- **The site's half** (a proposed change, not an endpoint that exists): one door behind its own key, answering as
  if it did not exist until the key is set, `no-store`, rate limited, handing rows changed since a cursor and taking
  an acknowledgement that turns the matching `sheets.backup` outbox rows `sent`. Pulling means the site holds no
  Google credential and the workbook can open no other file. Setting the key and installing the script are the
  owner's, as in Connect's `docs/VOLUNTEER-SIGNUPS.md` §3.
- **Open:** whether the backup belongs in Connect instead, beside the volunteer one (Connect holds every answer the
  site delivered; the site's own copy also holds those Connect never received).

The rules the backup keeps either way:

- **One spreadsheet, one tab per form.** Columns come from `answerColumns()` in `src/shared/forms.mjs`: one
  per question id, in order, across every published version, so a renamed or retired question keeps its column.
- **Formula guard.** `cellText()` in the same file puts an apostrophe in front of any answer that starts with
  `=`, `+`, `-`, `@`, a tab or a carriage return, because answers are untrusted. Tested in
  `test/forms.test.mjs`, "a spreadsheet cell can never start a formula". Both are called by the workbook writer (`netlify/lib/backup.mjs`, 25 Oct 2026).
- **Out of the request path.** The worker writes rows later, never while the visitor waits.
- **Idempotent.** A row is keyed by its reference; the worker writes it only if that reference is not in the
  tab already.
- **The checkpoint moves only on success.** An outbox row turns `sent` only after the write is confirmed. A
  failed write leaves it `pending`, adds one to `attempts`, records `last_error` and sets a later `next_at`.
- **A health line**, shown in Connect: last run, rows waiting, rows failed. Never answer text.

## The mailing list

The live form asks for one email address. Its instructions describe joining a Wisconsin Google Group by
sending a subscription email and replying to the confirmation. The audit's point stands: recording that form
does **not** prove anyone is on the list.

A rebuilt request must keep three states apart: **request received**, **confirmation pending** and
**subscribed**. Only the Google Group knows the last one. List membership is owned by one system, and that is
not this site (`content/routes.json`). How the request reaches the Group is not yet verified.

**Built closed** (23 Oct, `content/forms/email-list.json`, run log §6). The site's part is the first state only:

- It asks Google's one question, the email address, and shows Google's four steps for joining by email, with
  the address as a link.
- Its thank-you page says the request is received and that the person is **not on the list yet**; it never says
  they are subscribed (`test/applications.test.mjs`).
- It sends no receipt (`workflow.receipt: "none"`), so the site never emails an address no one has confirmed.
- The request goes to Connect as an answer like any other, queue `executive.email-list` (proposed). Recording
  *confirmation pending* and *subscribed* against it is Connect's (Exchange request
  `PUBLIC-EMAIL-LIST-STATES-2026-10-23`). Owner Executive, from the "EXEC" at the start of Google's form name.

## Not checked

- Whether any live Google Form sends a confirmation email, writes to a sheet or runs a script. The public
  inspection verified none of these (`../../FORM-AUDIT.md`).
- Whether `directors@badgersupports.org` can send through Connect's mail path.
- How fast any team replies to a request.
- How the mailing-list form reaches the Google Group today.

The owner's actions for this page are in `../WORK.md`.
