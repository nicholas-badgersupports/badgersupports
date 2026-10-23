# Communications

**Nothing leaves this site yet.** No email has been sent, no spreadsheet exists and nothing reaches Connect. A
submission is stored in the site's own database, and the work of carrying it onward is written down beside it
as rows in an outbox. No worker reads the outbox: it is not built.

This page records what happens today, which public forms exist and who is proposed to own them, and a plan for
email and the backup spreadsheet. Everything after "What happens to a submission today" is a **proposal**
(`../../MASTER-PROMPT.md` §7) until the owner approves it.

## The public forms

Observed on 19 Oct 2026 from public views only; no response was opened or submitted (`../../FORM-AUDIT.md`). The
scope rule is the owner's (`DECISIONS.md` §1): public forms are rebuilt here, internal workflows stay in Connect,
and SPILL's forms stay with SPILL.

| # | Workflow | Live today | In this rebuild |
|---|---|---|---|
| 1 | Resource request | a Google Form behind the "Request" link in every footer | not built, and the rebuild's footer does not link it. Proposed: it becomes the resource viewer's Suggest a Resource (§8), also not built |
| 2 | Peer group, volunteer training or collaboration request | a Google Form from `/request-a-program` and `/join/peer-support-groups` | not built; to become native forms (`content/routes.json`) |
| 3 | Workshop request | a Google Form from `/join/request-a-workshop` | **built**: `/forms/workshop-request/` |
| 4 | Referral card design survey | a Google Form from `/initiatives/referral-cards` | not built; to be rebuilt natively |
| 5 | Mailing list | a Google Form, and a whole-page embed at `/join/email-list` | not built; links go to the live page. See "The mailing list" |
| 6 | Staff application | a closed Google Form | **built closed**: its closing message shows on Get involved. Questions transcribed 21 Oct, not yet built (`Admin/Handoffs/HANDOFF-APPLICATIONS-AND-INVITES-2026-10-21.md`) |
| 7 | Volunteer application | a Google Form that answers 401 signed out, because Google requires sign-in on a form with uploads | not built; Get involved links to the Google Form as it is. Questions transcribed 21 Oct, same handoff |
| 8 | Alumni testimonial | a Google Form that answered 401 | not built; to investigate (publication consent, a missing sign-up embed) |
| 9 | Programming feedback | a Google Form behind `feedback.badgersupports.org` | **built**: `/forms/programming-feedback/`, anonymous |

The audit's whole-directory check also found internal, personnel and SPILL forms whose questions load publicly.
That they load is not a reason to publish them here.

## The three forms built

From `content/forms/*.json`. A form's `workflow` block names where its submissions go; none of it is wired to
anything outside this site yet.

| Form | State | Anonymous | Connect queue | Owner | Receipt | Backup |
|---|---|---|---|---|---|---|
| `workshop-request` | open here; **closed at launch** | no | `programs.workshop-requests` | Programs | proposed | proposed |
| `programming-feedback` | open here; **closed at launch** | yes | `programs.feedback` | Programs | none | proposed |
| `staff-application` | **closed** | no | `hiring.applications` | Executive | proposed | proposed |

**At launch** (owner, 20 Oct 2026): `--production` and `--launch` builds serve every open form closed, its page
showing one button, "Fill Out Our Form", to the Google Form it replaces (`launchForms()` and `googleFormUrl()` in
`src/shared/forms.mjs`; `test/launch.test.mjs`). The server reads the same closed definitions. A form already
closed keeps its own message.

The queue names and owners are proposals: Connect has no Forms area yet (Exchange request `PUBLIC-SITE-FORMS`).
A switch row in the database (`form_state`) wins over a form's shipped `state`, so Connect can open or close a
form without a deploy once it can write that row. **Gap:** a page built closed stays closed in the browser until
the next build (`src/client/form.js` can close a form but not open one), so opening a launch-closed form takes a
switch row and a rebuild.

## What happens to a submission today

In `netlify/lib/intake.mjs`:

1. The answers are checked against the form's questions. A form whose hidden trap field was filled answers
   `ok` with a reference and **stores nothing** (`:74`). A resend of a submission already stored answers with
   the first reference and stores nothing new (`:88`).
2. **One transaction** writes, together:
   - the submission (`submissions`), its answers keyed by stable question id, with no record of who sent it
     or from where;
   - a `received` event (`submission_events`);
   - an outbox row `connect.ingest`, state `pending`;
   - an outbox row `sheets.backup`, state `pending`;
   - an outbox row `mail.receipt`, state **`held`**, reason `sender-unverified`, but only where the form is not
     anonymous, its `workflow.receipt` is `on`, and an email answer exists (`:107`). **No form has `on` today**,
     so no receipt row is written.
3. Only after the commit does the server answer `ok` with the reference, such as `WR-` and two groups of four
   characters for a workshop request (`:39`).

Each outbox row carries `dedupe_key` = `<kind>:<reference>`, which the table holds unique
(`netlify/database/migrations/001_intake/migration.sql`). A retry cannot queue the same work twice. The table
also allows `mail.notify`; nothing writes one.

**Only the Connect row is sent** (20 Oct 2026). `netlify/lib/deliver.mjs` hands each `connect.ingest` row to
Connect's Website Forms, and a director signed in at `/staff/` reads the latest answers (`ARCHITECTURE.md`, "Staff
sign-in and Connect"). `sheets.backup` and `mail.receipt` rows stay `pending` or `held`. This has run only against a
local Connect rig: Connect's half is unpushed and no secret is set, so the forms still launch closed (above).

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
  (`netlify/lib/http.mjs:67`).

## Proposal: the backup spreadsheet

From Exchange request `PUBLIC-SITE-EMAIL-AND-BACKUP`. The owner names who owns the spreadsheet.

- **One spreadsheet, one tab per form.** Columns come from `answerColumns()` in `src/shared/forms.mjs`: one
  per question id, in order, across every published version, so a renamed or retired question keeps its column.
- **Formula guard.** `cellText()` in the same file puts an apostrophe in front of any answer that starts with
  `=`, `+`, `-`, `@`, a tab or a carriage return, because answers are untrusted. Tested in
  `test/forms.test.mjs:58`. Neither function is called by running code yet.
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

## Not checked

- Whether any live Google Form sends a confirmation email, writes to a sheet or runs a script. The public
  inspection verified none of these (`../../FORM-AUDIT.md`).
- Whether `directors@badgersupports.org` can send through Connect's mail path.
- How fast any team replies to a request.
- How the mailing-list form reaches the Google Group today.

The owner's actions for this page are in `../WORK.md`.
