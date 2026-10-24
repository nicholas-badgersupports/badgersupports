# Engagement map

The route a student takes for each task in `../../../MASTER-PROMPT.md` §3, where it leaves this site, and how
the link says so. §3 asks for it word for word: "Recommend how students find peer groups, craft nights/events,
program requests, volunteering/leadership opportunities, and resources. Clearly identify when a link goes to
Connect and preserve context. Director sign-in remains secondary."

The measure is a task finished, not time on the site: the number of clicks to the page that does the job, and
whether the words of each link say where it goes.

## Measured

Two builds, read on 23 Oct 2026 by a script kept outside this repository (it reads the built HTML: every link
on every page, with its words, its address and its class, then counts clicks from `/` along header, menu, page
and footer links).

| Build | What it is | Pages | Pages at 0 / 1 / 2 / 3 clicks from `/` | Not reached from `/` |
|---|---|---|---|---|
| Live | `--production` against the test suite's fake Connect, its date fixed at 20 Oct 2026 (`test/connect-feed.test.mjs`, written to `local/test-build-connect/`) | 37 | 1 / 27 / 7 / 1 | `/404.html` |
| Preview | `dist/`, the ordinary build with the hand-typed fixtures | 58 | 1 / 28 / 20 / 1 | `/404.html` and the 7 form previews at `/forms/<key>/preview/`, which nothing links on purpose |

Every page a task starts on is one click from `/`, by the header menu. The only page three clicks deep is the
University Square directory (`/initiatives/university-square/`, reached from Referral Cards by way of the
Student Activity Center directory). The extra pages two clicks deep in the preview are the fourteen example team
profiles, which the live build does not have until Connect exports the team (`WORK.md` item 19).

The counts were taken before the two fixes below. Both fixes change only words and one self-link; no route
changed.

## The tasks

The words in quotation marks are the words of the link, from `content/`. "Out" means the arrow out of a box
that the site puts on every link that leaves it (`src/render/context.mjs`, `link()`); it shows on buttons, on
"go" links, on the Get Involved doors and on the SPILL card on the home page.

### Peer support groups

| Step | Where | Clicks |
|---|---|---|
| Header menu "Peer Support Groups", or "Join Us for a Group" on the home page, or a timetable row | `/join/peer-support-groups/` | 1 |
| The timetable on the page, then "Get Directions" for the Hub | `#get-directions` on the same page | 1 |

Leaves for: Google Maps ("Open in Maps", out), the SAC's hours ("SAC hours", out), an Instagram reel ("Watch on
Instagram", out) and Badger SPILL ("Write Your SPILL", "How Badger SPILL Works", both out). To ask for a new
group: "Request a Peer Support Group" goes to Request a Program, a page of this site, and from there to a
Google Form (below).

Nothing on the way goes to Connect.

### Craft nights and events

| Step | Where | Clicks |
|---|---|---|
| Header menu "Craft Nights", or "Craft Night Schedule" on the home page, or a timetable row | `/join/craft-nights/` | 1 |
| "Drop In: <night>" | the room's directions page | 2 |
| "Add to Calendar: <night>" | an `.ics` file from this site (`/api/calendar/…`) | 2 |
| "Fill Out Our Form" (feedback) | `/forms/programming-feedback/` | 2 |

The page links nowhere else. In the live build the feedback page shows the Google Form's button ("Fill Out Our
Form", out), because the site's own form opens only when Programs sees answers in Connect (`WORK.md` item 31).

Since the owner's 23 Oct message the timetable has no link to "All events on Badger Supports Connect". The times
come from Connect as the site builds and again as each page loads (`netlify/lib/live-events.mjs`); a student
never has to go there to read them.

### Program requests and workshops

| Step | Where | Clicks |
|---|---|---|
| Header menu "Request a Program" | `/request-a-program/` | 1 |
| "Request a Workshop" (from the home page, Request a Program or Workshops) | `/forms/workshop-request/` | 1 or 2 |
| On it, "Fill Out Our Form" | the Google Form (out) | 2 or 3 |
| "Request a Peer Support Group" or "Request a Volunteer Training" | one Google Form (out) | 2 |

Both links on Request a Program go to **the same Google Form**, and a student who chose "Peer Support Group" on
the page is asked again, inside the form, what kind of request it is. That is the one place where the site
loses context it already has (recommendation 3).

Workshops (`/join/request-a-workshop/`) adds "Request Volunteer Training Here!" (the same Google Form, out), the
feedback form, and two email addresses, `directors@` and `accessibility@`.

### Volunteering, leadership and the email list

| Step | Where | Clicks |
|---|---|---|
| Header menu "Get Involved", the home page's "Get Involved" button, or a door on the home page | `/join/get-involved/` | 1 |
| The Volunteer door ("Express Interest", out) or "Express Interest & Apply Here" (out) | the volunteer Google Form | 2 |
| "View Our Application" (out) | the staff Google Form | 2 |
| "Become a Student Supporter" (out) | Badger SPILL's Get Involved page | 2 |
| Header menu "Email List" or the Email List door | `/join/email-list/`, then "Join Our Email List" (Google Form, out) | 1, then 2 |

The site's own volunteer, staff and letter forms are built and closed, each with a preview
(`WORK.md` item 14); until one opens, its Google Form is the live route.

### Resources

Header menu "Resources", one click. The page holds 86 resource cards: 86 links leave the site, 27 are email
addresses, 119 stay on it. Each card's button leaves the site with the out arrow. 82 of the 86 buttons said
"View Details"; the other four name the action ("View FoodShare", "Book The Open Seat", "Book Uwill",
"Book Space To Heal").

## Connect

**No link a student sees goes to Connect**, in either build: no page carries a `data-connect` link. The last one
was "All events on Badger Supports Connect", which the owner asked on 23 Oct to remove.

Director sign-in is the last link of the footer, "Director Sign-In", which opens `/staff/`; its one button, "Sign
in with Connect", names Connect in its words. It is in no menu and on no task page. §3's "secondary" holds.

The site is ready for a Connect link if one comes back: `link()` gives any address on Connect's origin
(`content/site.json`, `connectOrigin`) `data-connect` and a screen-reader note, "(opens Badger Supports
Connect)". A sighted student sees only the out arrow every other site gets (recommendation 1).

## Fixed in this run

1. **A page no longer links to itself.** The Hub's "Next Here" list on the peer page named "Peer support group"
   twice as a link to the page the student was reading. Such an event is now named, not linked, in the built page
   and in the copy each page asks for as it loads (`ctx.here()`, `src/render/context.mjs`; the directions and
   schedule blocks). The same event on the Hub's own directions page stays a link. Test:
   `test/live-events.test.mjs`, "an event on the page it would link to is named, not linked"; with the fix
   taken out, it fails.
2. **Each "View Details" says whose details.** A screen reader that lists the page's links heard "View Details"
   82 times. Each now reads "View Details: <resource>"; the added words are for screen readers only, so the
   card looks as it did. A button whose words already name the action is unchanged. Test:
   `test/resources.test.mjs`.

## Recommendations

| # | Recommendation | Why | Source |
|---|---|---|---|
| 1 | When a student link to Connect returns, its **visible** words name Connect ("Sign up on Badger Supports Connect"), not only the screen-reader note | The out arrow looks the same for Connect, Google, Instagram and the UHS crisis line. A student who must sign in should know before the click | WCAG 2.4.4; GOV.UK, Links |
| 2 | Links that open a Google Form say so ("Apply on Google Forms"), until the site's own form replaces each | "Fill Out Our Form" and "Express Interest & Apply Here" read as this site's form; the student lands on Google's | GOV.UK, Links; NN/g, information scent |
| 3 | "Request a Peer Support Group" and "Request a Volunteer Training" carry the choice into the form: a pre-filled Google Form link now, and `?request_type=` on the site's own form (`content/forms/program-request.json`, `request_type`) when it opens | Both buttons reach the same form, which asks again. §3: "preserve context" | NN/g, information scent |
| 4 | Keep links in the same tab | Every link on both builds already does: none has `target="_blank"` | NN/g, new tabs; GOV.UK, Links |
| 5 | Judge depth by scent, not a click count | Every task is one click from `/`; what fails a student is a vague label, not a third click | NN/g, the 3-click rule |

Recommendations 1 to 3 change the owner's words or a Google Form link, so they are the owner's call; all of the
words are in `content/text.json` and the pages, editable with Edit text.

**Considered and not taken:** GOV.UK advises "Do not use an external link icon". The site keeps its out arrow:
it is the owner's design, used on every exit, and it adds to the words rather than replacing them.

**Seen, not changed:** a resource card with a phone number links it twice, once on the card and once inside
its details.

## Sources

Read on 23 Oct 2026. Each quotation was checked against the page.

- W3C, WCAG 2.2 Understanding 2.4.4, Link Purpose (In Context),
  https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html: the context of a link includes its
  paragraph, list item and table cell; "It is also a best practice for links with different purposes and
  destinations to have different link text."
- W3C, technique G128, https://www.w3.org/WAI/WCAG22/Techniques/general/G128: "Disabling the link provides
  information to all users that it is the currently selected topic."
- GOV.UK Design System, Links, https://design-system.service.gov.uk/styles/links/: "If it's an external link
  to a non-government website, make that clear in the link text. … Do not use an external link icon." and
  "Avoid opening links in a new tab or window. It can be disorienting - and can cause accessibility problems for
  people who cannot visually perceive that the new tab has opened."
- Nielsen Norman Group, Nielsen and Kaley, 27 Sep 2020, https://www.nngroup.com/articles/new-browser-windows-and-tabs/:
  "For the most part, always open links in the same browser tab or window."
- Nielsen Norman Group, Laubheimer, 11 Aug 2019, https://www.nngroup.com/articles/3-click-rule/: "the 3-click
  rule is an arbitrary rule of thumb that is not backed by data"; "Ensure that menu items have names with strong
  information scent and avoid vague, unfamiliar, or branded terms."
- Nielsen Norman Group, Budiu, 2 Feb 2020, https://www.nngroup.com/articles/information-scent/: users choose the
  link with the strongest scent, "a mix of cues that they get from the link label, the context in which the link
  is shown, and their prior experiences."
