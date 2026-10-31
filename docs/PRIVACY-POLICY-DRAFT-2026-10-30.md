> **DRAFT for Nicholas and a legal review. Not published. Not legal advice.**
> `content/pages/privacy-policy.json` is unchanged. The page the site builds still describes Google Sites, Google
> Analytics and Google Forms. This draft describes what the production build (`--production`) serves, as read from
> this repository's code and docs. Words in [square brackets] are notes for the reviewer, not policy wording.
> "Sources for review" ties each fact to a file; "Gaps for Nicholas and the reviewer" lists what the repository
> does not settle.

# Privacy Policy

Effective date: [set when published]

## Who we are

Badger Supports runs this website, www.badgersupports.org. Badger Supports is a registered student organization
at the University of Wisconsin–Madison. It is an independent, dual-registered student organization with
University Health Services – Prevention.

In this policy, "we" means Badger Supports.

## The short version

- The site loads no analytics tag.
- If you only read pages, the site sets no cookies and stores nothing in your browser.
- Our host, Netlify, receives every request your browser makes, including your IP address.
- Every form on this site is closed right now. Two form pages send you to a Google Form instead.
- When a form opens here, your answers are stored in the site's own database and passed to Badger Supports
  Connect, our internal system. Your IP address is not stored with them.
- Nothing on our pages comes from another company, except an Instagram video that loads only when you press Play.
- Staff who sign in get cookies that keep them signed in for up to eight hours.

## When you visit

**Our host.** Netlify hosts the site, its server code and its database. Netlify receives each request your
browser makes. That includes your IP address (the number that identifies your connection on the internet), the
page you asked for, and the details browsers send with every request, such as the browser's name. Netlify keeps
records of requests, and people with access to the Netlify team that runs the site can view them.
[How long Netlify keeps them is a gap.]

**Reading pages writes nothing.** Our own code records nothing when you open a page. Pages are built ahead of
time, and the code that serves them never reads or writes the database.

**Everything comes from this site.** Each page loads its scripts, styles, fonts and pictures from
www.badgersupports.org only. The site's security settings stop pages from loading scripts from other sites. Photos
are copied onto the site when it is built, so your browser does not fetch them from Google Drive or anywhere else.

**Links to other sites.** When you follow a link to another site, your browser tells that site at most our site's
address, not the page you were on.

**No camera, microphone or location.** The site tells your browser that its pages may not use your camera,
microphone, location, payment or USB features.

**Resource search.** On the Resources page, the topic you pick and the words you type are added to the page's
address, so you can share the list. The search runs in your browser. Nothing is sent as you type. If you reload or
share that address, it reaches Netlify like any other page address.

**Event updates.** Pages that list events check for changes as they load. That check names only the page and sends
no cookies.

**Errors.** If something goes wrong in the site's server code, a description of the error is written to Netlify's
log for that code.

## Cookies and browser storage

**Visitors.** If you only read pages, this site sets no cookies. Its scripts do not use browser storage such as
localStorage or sessionStorage.

**Staff.** Three cookies are set only for Badger Supports staff who sign in at `/staff/`:

| Cookie | What it is for | How long |
|---|---|---|
| `__Host-bss_auth` | Checks that the sign-in coming back from Connect is the one that left | 10 minutes |
| `__Host-bss_staff` | Keeps you signed in. The database keeps only a scrambled copy | 8 hours, or until sign-out |
| `bss_staff_hint` | Says only "someone signed in here", so pages load Edit text | 8 hours, or until sign-out |

On the live site, all three are sent only over secure (https) connections. Page scripts cannot read the first two.

**Instagram.** The Peer Support Groups page has an Instagram video. Nothing from Instagram loads until you press
Play. Then Instagram's player loads, and Instagram may set its own cookies. The page says so under the button.

## Analytics

The site loads no analytics tag. It sends nothing to Google Analytics or any other analytics service. Its security
settings would stop an analytics script from loading.

Forms announce "form started" and "form sent" inside the page, for possible measurement later. Nothing listens to
these announcements, so they go nowhere.

[Reviewer note: the owner reported on 24 Oct 2026 that Netlify Web Analytics is on. That is not verified. If it is
on, this section must describe it.]

The old site on Google Sites carries a Google Analytics tag. Once this site takes over www, Google Analytics stops
counting visits to www.

## The mood check-in

The home page asks how you are feeling. When you tap a mood, your browser sends only which mood you chose. The site
adds one to that day's count for that mood. It does not record who tapped, which page they were on, or the time
beyond the day. After you tap, you see the day's totals. Mood taps are never sent to analytics.

## Limits on repeated use

To stop abuse, the site counts how often one connection sends a form, uploads a file, taps the mood check-in or
starts signing in, within each hour. For that count it keeps a scrambled code made from your IP address and a
secret key, with the name of the form or feature and the hour. It does not keep the IP address itself. These counts
are kept apart from form answers. Counts more than a day old are deleted the next time any count is written.

## Forms

**Right now every form on this site is closed.** The site's server refuses answers for every form.

- **Request a Workshop** and **Programming Feedback** show a "Fill Out Our Form" button. It takes you to the
  Google Form that the page replaces. What you enter there is handled by Google Forms, not by this site.
  [What happens to Google Form answers is a gap.]
- The other forms show a short message instead, usually with one of our email addresses.

**When a form on this site is open**, this is what happens to what you send:

1. Your answers are checked, then stored in the site's database. The record holds a reference code (you are shown
   it), the form and its version, your answers, whether the form is anonymous, a status, and the time it arrived.
2. The site does not store your IP address, your browser's details or any other record of where the answers came
   from, for any form.
3. The answers are then passed to Badger Supports Connect ("Connect"), our internal system at
   home.badgersupports.org, where the team responsible works through them. Connect receives the reference, the time
   it arrived, the form's questions and your answers. If Connect cannot be reached, the answers wait in the site's
   database and are sent later.
4. Nothing else is sent. Email receipts and a backup spreadsheet are built but switched off, so you get no email
   from the site. [If either is switched on, this policy must change first.]

Each form also has a hidden field that only automated spam programs fill in. If it is filled in, the site answers
as if it worked and stores nothing.

**Who can read answers.**

- **On this site:** a Badger Supports director who signs in and whose role in Connect lets them read that form.
  They see the 50 most recent answers to it, without confidential answers. The site does not record who looked.
- **In Connect:** whoever Connect's permissions allow. A super admin in Connect sets which roles may read each
  form's answers. Members do not read answers.

**Confidential answers.** The staff application asks about Federal Work Study eligibility and other commitments.
Those two answers are marked confidential. They go to Connect only. The staff page on this site never shows them,
and the backup spreadsheet (switched off) would leave them out unless a setting puts them in.

**Files.** The staff and volunteer applications ask for a resume, the staff application can also take a cover
letter, and the recommendation form takes a letter. Each is one PDF of at most 3 MB. A file is sent to the site as
soon as you choose it, before you press Send, and is stored in the site's database. Nothing on the site lets anyone
download a file back. If you choose a file but never send the form, the file is deleted once it is a day old, the
next time anyone uploads a file. A file sent with a form stays in the site's database. Connect is told the file's
name, size and fingerprint (a code that identifies that exact file), not the file itself.
[Nothing removes a sent file yet: see Gaps.]

**Anonymous forms.** Programming Feedback, Report a Problem, Suggest an Update and Suggest a Resource are anonymous
forms. They do not ask for an email address. Programming Feedback asks for your name only if you want to give it.
An anonymous form never sends a receipt. Connect receives only what the form asked, marked as anonymous. As with
every form, your IP address is not stored with your answers. The only trace of your connection is the scrambled
count under "Limits on repeated use", removed once it is more than a day old.

**What each form asks.** All of them are closed right now.

- **Request a Workshop:** your name, email, other contact details, organization or group, number of attendees,
  which workshop, and two choices of date and time. Now: a button to its Google Form.
- **Programming Feedback** (anonymous): your name if you want to give it, which program, and your feedback.
  Now: a button to its Google Form.
- **Staff Application:** eligibility and AI-use confirmations, email, preferred name, pronouns, phone, semesters at
  UW–Madison, about you, skills and preferences, hours, Federal Work Study eligibility and other commitments
  (both confidential), a resume and a cover letter (PDF), portfolio links, and comments.
- **Volunteer Application:** eligibility and AI-use confirmations, email, preferred name, pronouns, phone
  (optional), semesters at UW–Madison, about you, skills and preferences, experience and interest, a resume (PDF),
  and comments.
- **Letter of Referral / Recommendation:** the recommender's name, email and phone (optional), who the letter is
  for, and the letter (PDF).
- **Resource Request:** your @wisc.edu email, affiliation and logistics, what you are requesting, and comments.
- **Peer Support Group or Volunteer Training request:** your name, email, who the request is on behalf of,
  organization, request type, group size, dates, location, accessibility needs, and notes.
- **Referral Card Design Survey:** ideas for a resource referral card, and an email address for news of the
  project.
- **Join Our Email List:** your email address.
- **Report a Problem** (anonymous): which resource, and what is wrong.
- **Suggest an Update** (anonymous): which resource, what needs updating, and what it should say.
- **Suggest a Resource** (anonymous): a name, a website, and what the resource offers.

**The email list** is a Google Group. Sending the email-list form (once it opens) only tells us you asked. It does
not add you to the list, and the site sends you no email.

## Staff sign-in

The staff page, `/staff/`, is for Badger Supports directors. This site keeps no accounts, passwords or staff list.

- To sign in, you are sent to Connect's sign-in page and sign in there. Connect then tells this site, in a signed
  message: Connect's own ID code for you (one that means something only inside Connect), your first name (blank if
  Connect is set not to share first names), what you may do on this site, and whether you signed in to Connect with
  a password or with Google.
- The site keeps that for up to eight hours, in a session record named by a scrambled copy of your cookie. Unless
  the check below is on, reading form answers stops an hour after you sign in; you sign in again to keep reading.
- Signing out removes your session on this site. It does not sign you out of Connect.
- Session records past their eight hours are deleted the next time anyone starts signing in.
- This site has no Google sign-in code of its own. Google sign-in, where it is used, happens on Connect.
- A short quote may appear beside the Sign in button. The site fetches the list from Connect. Nothing about anyone
  is sent or received to show it.
- [A built check would ask Connect, ten minutes after its last answer, whether a signed-in person is still active,
  sending Connect's ID code for them. It runs only when a setting is on. Whether it is on is a gap.]

**Edit text.** A director allowed to edit can change words on the site. Each change is saved with the editor's
Connect ID code, their first name and the time. Earlier versions are kept so a change can be undone, and they are
never deleted. The published words also record the first name of the person who saved them.

## Who else receives information

- **Netlify** hosts the site. It receives every request to the site, with your IP address, and holds the site's
  database, server code and stored files.
- **Badger Supports Connect** (home.badgersupports.org, also hosted on Netlify) receives form answers when you send
  an open form, and handles sign-in when staff sign in.
- **Instagram** receives your browser's request for its video player, and may set cookies, only after you press
  Play on the video.
- **Google** receives what you enter in a Google Form, a room's address when you open a map link, and the email you
  send us (our email runs on Google Workspace). This happens only if you follow one of those links or email us.

No other company's scripts, fonts or pictures load on our pages.

**People shown on the site.** The live site shows no team member profiles and no Wall of Support notes yet. Event
listings come from Connect and include no contacts, volunteers or sign-ups.
[When Connect's team export is turned on, a person appears only from a profile they made public in Connect.]

## How long we keep things

| What | How long |
|---|---|
| Netlify's request and error logs | [Gap: not stated in this repository] |
| Form answers in the site's database | [Gap: nothing in the code deletes them] |
| Form answers in Connect | [Gap: Connect's to state] |
| A file chosen but never sent | Deleted once a day old, the next time anyone uploads a file |
| A file sent with a form | [Gap: nothing deletes it] |
| Counts for limits on repeated use | Deleted once more than a day old, the next time any count is written |
| Mood check-in counts (one number per mood per day, about no one) | [Gap: no end date] |
| A staff sign-in started but not finished | Usable for 10 minutes; removed at the next sign-in once a day has passed |
| A staff session | Up to 8 hours; deleted at sign-out, or at the next sign-in after it ends |
| Words changed with Edit text, with the editor's ID code and first name | Kept; never deleted |

## Your choices

- You can read every page without cookies.
- Every form is optional. Anonymous forms do not ask for an email address, and Programming Feedback's name
  question is optional.
- You can leave the Instagram video unplayed. Nothing from Instagram loads until you press Play.
- To ask what we hold about you, or to have it corrected or removed, email hello@badgersupports.org.
  [This promise comes from the current page. The site has no tool to correct or delete a submission: see Gaps.]

## Peer support, not a crisis service

Badger Supports is peer support, not a crisis service. Peer supporters are students, not clinicians, and our
services are not a substitute for professional medical or mental-health care. If you or a friend need help now,
call the UHS 24/7 crisis line at 608-265-5600 (option 9), call or text 988, or text HOME to 741741.

## Changes to this policy

If we change this policy, we will post the new version on this page with a new date.

## Contact us

Questions about this policy or your information:

- Email: hello@badgersupports.org
- Post: Badger Supports, Student Activity Center, 333 East Campus Mall, Suite 3203, Madison, WI 53715

---

## Production and the prototype (for the reviewer)

The policy above describes the production build. The prototype build, which every other context runs, differs:

| | Prototype | Production (what a publish serves) |
|---|---|---|
| Request a Workshop, Programming Feedback | open on this site | closed; a button to each one's Google Form |
| Closed forms | a preview page each, which checks answers and sends nothing | no preview pages |
| Team and Wall of Support | fictional sample people and notes | none, until Connect exports them |
| Events and resources | hand-typed fixtures | read from Connect when the site is built |
| Search engines | every page `noindex`; robots disallow all | robots disallow `/staff/` and `/api/` only |

## Sources for review

Paths are relative to the repository root, shortened as follows. `lib/` means `netlify/lib/`. `mig/001` means
`netlify/database/migrations/001_intake/migration.sql`, and `mig/002`, `mig/003` and `mig/005` the same for
`002_staff`, `003_files` and `005_edit_history`. `ARCHITECTURE.md`, `ANALYTICS.md`, `COMMUNICATIONS.md`,
`DECISIONS.md` and `SWITCH.md` are in `docs/`. `privacy-policy.json` is the current page, in `content/pages/`.
"Search" means a search of the named files found nothing to the contrary.

| Claim | Source |
|---|---|
| **Who we are** | |
| Registered student organization at UW–Madison | `privacy-policy.json:15` |
| Independent, dual-registered with UHS – Prevention | `content/site.json:231` |
| The site is www.badgersupports.org | `content/site.json:4` |
| **When you visit** | |
| Netlify hosts the pages, the function and the database | `ARCHITECTURE.md:14-16`, `:21-24`; `netlify.toml:25-26` |
| Netlify hands the function the visitor's IP address | `lib/http.mjs:75-82`; `ARCHITECTURE.md:436` |
| Requests carry headers such as the user agent | `lib/http.mjs:77-78` |
| Netlify keeps request records that team members can view | `ARCHITECTURE.md:446`, `:490`, `:648` |
| Page requests write nothing; the page function never reads the database | `ARCHITECTURE.md:434`, `:445-446` |
| Scripts, styles, fonts, images only from the site | `ops/build.mjs:350-358`; `src/render/layout.mjs:117-123` |
| Photos encoded at build time and served from the site | `ARCHITECTURE.md:593`, `:601-602`; `ops/build.mjs:356` |
| Other sites get at most the site's address | `ops/build.mjs:374` (`strict-origin-when-cross-origin`) |
| Camera, microphone, location, payment, USB turned off | `ops/build.mjs:375` |
| Resource search: in the address, run in the browser | `src/client/resources.js:1-6`, `:61-64`; `ARCHITECTURE.md:471` |
| Event refresh names the page and sends no cookies | `src/client/schedule.js:105`; `ARCHITECTURE.md:188-196` |
| Server errors written to the function log | `lib/router.mjs:408`; `lib/live-events.mjs:52`; `lib/pages.mjs:101` |
| **Cookies and browser storage** | |
| No browser storage in the site's scripts | search of `src/client/*.js` for localStorage, sessionStorage, indexedDB |
| The only cookies set are the staff ones | `lib/staff.mjs:78`, `:92`, `:123-127`, `:165` (search of `lib/`) |
| Cookie names | `lib/staff.mjs:42`, `:47` |
| Path, SameSite, HttpOnly, Secure on https | `lib/staff.mjs:44`, `:61-63` |
| Lifetimes: 10 minutes, 8 hours | `lib/staff.mjs:37-38`, `:92`, `:122-126` |
| The session cookie is kept only as a hash | `lib/staff.mjs:117-121`; `mig/002:21-30` |
| The hint loads the edit button | `lib/staff.mjs:16-18`; `src/client/site.js:78`; `src/render/layout.mjs:20` |
| Sign-out, or a refused staff call, clears them | `lib/staff.mjs:165`; `src/client/staff.js:281`, `edit.js:448` |
| Instagram only after Play | `src/client/embed.js:1-9`; `src/render/blocks/embed.mjs:1-5`; `ops/build.mjs:359-360` |
| The page warns that Instagram may set cookies | `content/text.json:113-116` |
| The reel is on Peer Support Groups | `content/pages/peer-support-groups.json:30` |
| **Analytics** | |
| No analytics tag; CSP would block one | `ANALYTICS.md:3-4`, `:23-24`; `ops/build.mjs:354`, `:358` |
| Form events are announced and nothing listens | `ANALYTICS.md:33-35`; `src/client/form.js` (`bss:analytics`) |
| Netlify Web Analytics reported on, not verified | `WORK.md:92-93`; `DECISIONS.md:254-255` |
| The old site's tag; Analytics stops counting www | `ANALYTICS.md:13`; `SWITCH.md:90` |
| **Mood check-in** | |
| On the home page | `content/pages/home.json:378` |
| The browser sends only the mood id | `src/client/mood.js:1-3`, `:17` |
| One count per day per mood; nothing records who | `lib/mood.mjs:1-2`, `:18-24`; `mig/001:77-83` |
| Excluded from analytics | `src/render/blocks/mood.mjs:14`, `:19`; `ANALYTICS.md:109` |
| **Limits on repeated use** | |
| Buckets for form, file, mood and sign-in, per hour | `lib/router.mjs:99`, `:133`, `:157`, `:172` |
| Keyed hash of the address, not the address | `lib/http.mjs:75-84` |
| Kept apart from submissions; older than a day deleted at the next write | `lib/http.mjs:91`; `mig/001:85-92` |
| **Forms** | |
| Production: every form closed; open ones link a Google Form | `src/shared/forms.mjs:59-70`; `ops/build.mjs:288-289` |
| The same, as a test of the production pages | `test/launch.test.mjs:22-30` |
| The server holds the same forms closed | `test/launch.test.mjs:32-37`; `lib/intake.mjs:91`; `ops/build.mjs:562` |
| Only the test harness writes a switch row | `ARCHITECTURE.md:583`; search (`ops/interact.mjs:479`) |
| "Fill Out Our Form" wording | `content/text.json:534-536` |
| Each closed form's message | `content/forms/*.json:9` |
| What a stored submission holds | `mig/001:31-45`; `lib/intake.mjs:119-123` |
| No connection or sender record with any submission | `mig/001:31-32`; `ARCHITECTURE.md:237-239` |
| Trap field: answered as success, nothing stored | `lib/intake.mjs:93-94` |
| Handed to Connect after the reply | `lib/router.mjs:109`; `lib/deliver.mjs:114-127`; `lib/connect.mjs:172-177` |
| What Connect receives | `lib/deliver.mjs:44-78` |
| Unreachable Connect: rows wait | `lib/deliver.mjs:19-20` |
| Receipts off: no form has receipt "on" | `lib/intake.mjs:134-136`; `content/forms/*.json` (`receipt`) |
| Receipts also wait for a verified sender | `lib/deliver.mjs:129-136` |
| Backup spreadsheet off until set up | `lib/backup.mjs:37-44`; `lib/deliver.mjs:154-158`; `COMMUNICATIONS.md:140` |
| Staff page: latest 50, by permission; no log of viewers | `lib/answers.mjs:1-5`, `:16`, `:52`; `lib/router.mjs:220` |
| A super admin in Connect sets who reads which form | `ARCHITECTURE.md:152-155`; `lib/staff.mjs:13-16` |
| Members do not read answers | `WORK.md:57` |
| Confidential: work study and commitments | `content/forms/staff-application.json:815-819`, `:834-838` |
| Confidential answers off the staff page | `lib/answers.mjs:55`, `:63`; `ARCHITECTURE.md:309-310` |
| Confidential answers out of the backup by default | `lib/backup.mjs:13-14`, `:46-53` |
| One PDF of at most 3 MB; sent as soon as chosen | `lib/files.mjs:1-5`; `mig/003:11-24`; `ARCHITECTURE.md:231-234` |
| No route serves a file back | `lib/files.mjs:5-6`; `mig/003:6-8` |
| Unclaimed upload deleted after a day, at the next upload | `lib/files.mjs:49` |
| A sent file stays | `lib/files.mjs:8-9`; `ARCHITECTURE.md:581`; search of `netlify/` for `delivered_at` |
| Connect gets name, size and SHA-256, never the bytes | `lib/deliver.mjs:61-64`; `ARCHITECTURE.md:224` |
| Which forms are anonymous | `content/forms/*.json:7` (`anonymous`) |
| Programming Feedback: name optional, no email | `content/forms/programming-feedback.json:11`, `:18` |
| No receipt for an anonymous form | `lib/intake.mjs:136`; `lib/deliver.mjs:141` |
| Anonymous payload carries only what was asked, flagged | `lib/deliver.mjs:45-46`, `:72`; `ARCHITECTURE.md:303` |
| Each form's questions and state | `content/forms/*.json` (`state` at line 8, `sections`) |
| Email list: a Google Group; no receipt | `COMMUNICATIONS.md:210-227`; `content/forms/email-list.json:67` |
| **Staff sign-in** | |
| No accounts, passwords or roster here | `lib/staff.mjs:1-2`; `mig/002:5-7`; `ARCHITECTURE.md:280` |
| Sign-in happens on Connect's page | `lib/staff.mjs:4-11`, `:91-92` |
| What Connect's note gives: id, first name, scopes, method | `lib/connect.mjs:122-137`; `lib/staff.mjs:119-121` |
| Connect ids are opaque | `mig/001:48`; `ARCHITECTURE.md:533` |
| First name blank when Connect is set not to share | `lib/staff.mjs:15-16`; `ARCHITECTURE.md:285-286` |
| Session 8 hours; reading answers 1 hour | `lib/staff.mjs:37-39`, `:141-145`; `ARCHITECTURE.md:289-290` |
| Sign-out ends this site's session only | `lib/staff.mjs:20`, `:161-166` |
| Expired sessions and starts deleted at the next sign-in start | `lib/staff.mjs:86-87` |
| No Google code on this site | `ARCHITECTURE.md:261` |
| Sign-in quotes: nothing about anyone sent | `lib/connect.mjs:150-152`; `ARCHITECTURE.md:271-273` |
| Status check: off unless set | `lib/connect.mjs:25-26`, `:44`; `lib/staff.mjs:141` |
| Status check sends Connect's id, a nonce, the method | `lib/connect.mjs:144-147`; `lib/staff.mjs:146-148` |
| Edit rows: id, first name, time; never deleted | `mig/002:32-43`; `mig/005:5-7`; `lib/edits.mjs:11-14`, `:104` |
| The published revision records the editor's first name | `lib/published.mjs:81` |
| **Who else receives information** | |
| Netlify Blobs holds the published revision | `lib/published.mjs:11-12` |
| Connect is home.badgersupports.org, on Netlify | `lib/connect.mjs:1`; `content/site.json:6`; `SWITCH.md:62` |
| Map links go to Google Maps with the room's address | `src/render/blocks/directions.mjs:17`, `:45` |
| Our email runs on Google Workspace | `SWITCH.md:60` |
| Events from Connect carry no contacts, volunteers or sign-ups | `ops/connect-feed.mjs:13-14` |
| No team or wall in production | `content/connect-feed.json:31-35`; `ops/build.mjs:272`, `:275` |
| Later, a person only from their own public profile | `ops/connect-feed.mjs:9-12`; `ARCHITECTURE.md:54-56` |
| **Choices, boundary, changes, contact** | |
| Requests to access, correct or delete go to hello@ | `privacy-policy.json:130` |
| Peer support, not a crisis service; the crisis lines | `content/site.json:131` |
| Peer supporters are students, not clinicians | `privacy-policy.json:104` |
| Changes posted on the page with a new date | `privacy-policy.json:185` |
| Contact email and postal address | `privacy-policy.json:194`; `content/site.json:230` |
| **Production and the prototype** | |
| Production context runs `--production`; others the prototype | `netlify.toml:21`, `:25-26`; `ARCHITECTURE.md:21-23` |
| Workshop and feedback open in the prototype | `content/forms/{workshop-request,programming-feedback}.json:8` |
| Preview pages only in the prototype | `ops/build.mjs:298`; `ARCHITECTURE.md:209-210` |
| Robots rules | `ops/build.mjs:551-553`; `ARCHITECTURE.md:83-84` |
| Production reads Connect's lists, refuses fixtures | `ops/build.mjs:283-287`; `ARCHITECTURE.md:45-47` |

## Gaps for Nicholas and the reviewer

1. How long are form submissions kept in the site's database, and who deletes them? No code deletes them.
2. How long is a PDF kept after it is sent with a form? Nothing sets `delivered_at` or removes the bytes.
3. How long does Netlify keep request logs and function logs, and who on the Netlify team can read them?
4. Is Netlify Web Analytics on for this project, what does it record, and how long does it keep it?
5. Does Netlify set any cookie of its own on the public site once team login is off?
6. Where are the Netlify Database and Netlify Blobs stored? The current page says the United States.
7. Should the policy name Netlify's own privacy policy, and Instagram's, as the current page names Google's?
8. How long does Connect keep the answers it receives, and does Connect have a privacy notice to link?
9. Until each form opens here, who reads the Google Form answers, where are they stored, and for how long?
10. Is hello@badgersupports.org the right privacy contact (not directors@), and is the postal address current?
11. Keep the promise to honour access, correction and deletion requests, when no tool here edits or deletes one?
12. Who would carry out such a request, in the site's database and in Connect?
13. What legal wording is wanted: the consent clause, UW policy, Wisconsin law, FERPA, state privacy laws?
14. Keep the under-13 (COPPA) section, and is any wording needed for students under 18?
15. Keep the current page's "we do not sell, rent or trade" promise and its legal and safety disclosure clauses?
16. Should the policy cover the photos of people on the site, and the consent behind them (owner action 2)?
17. Should the policy mention Google Search Console, which `docs/SWITCH.md` plans to use after the switch?
18. Should forms ask people not to put health or crisis details in their answers?
19. Is `CONNECT_SESSION_STATUS` on in production, so the status check sends Connect's id every ten minutes?
20. Are `RECEIPT_SENDER`, `BACKUP_SPREADSHEET_ID` and `GOOGLE_SERVICE_ACCOUNT` unset in production, as the docs say?
21. Who updates this policy before receipts, the backup spreadsheet, team profiles or the Wall of Support switch on?
22. Is the email list's Google Group run by UW (`g-groups.wisc.edu`), and whose policy covers membership?
23. On Suggest a Resource, does "Name" mean the resource's name or the person's? The form is marked anonymous.
24. Programming Feedback is marked anonymous but asks for an optional name. Is "anonymous" the right word?
25. Is a day of hashed connection counts, tagged with the form's name, acceptable for anonymous forms?
26. Does the policy need to cover Connect's sign-in page and Google sign-in, which happen on Connect, not here?
27. Keep a "Do Not Track" line? The site does no tracking that the signal would turn off.
28. What effective date goes on the page, and who records each later change?
