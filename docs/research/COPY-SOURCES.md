# Where the words come from

Nicholas, 20 Oct 2026: *"Try to only have text that is currently on the website or some other badger
supports material, keep the invented language as low as possible."*

Every string a visitor reads lives in `content/` and is editable (`node ops/editable.mjs`). This file
records where each one came from, so a reader can tell the organisation's own words from the words
this rebuild had to write.

## Method

`node ops/provenance.mjs <corpus-folder>` reads every shown string in `content/pages`, `content/forms`,
`content/places`, `content/widgets`, `content/site.json` and `content/text.json`. It compares each one
with the corpus after folding case, punctuation and dashes, and gives it one of four classes:

| Class | Meaning |
|---|---|
| verbatim | the whole string appears in Badger Supports material |
| assembled | every sentence appears, but the sentences come from more than one place |
| near | at least 60% of its three-word runs appear (trimmed or lightly re-cut) |
| new | written for this site |

The corpus has 217 files, and none of them are in this repository, because the live team pages name real
people:

- the live site, crawled on 19 Oct 2026: the page text, its embeds and the mood widget's messages;
- the text of the four workshop decks in Canva;
- the question text of the public Google Forms, which is form schemas only and no responses.

Files from the team pages are left out of the comparison.

| Run | Strings | verbatim | assembled | near | new |
|---|---|---|---|---|---|
| Before this pass (20 Oct 2026) | 636 | 382 | 3 | 28 | 223 |
| After this pass (20 Oct 2026) | 638 | 410 | 5 | 28 | 195 |
| After the 16 remaining pages (20 Oct 2026) | 1,275 | 869 | 6 | 53 | 347 |
| After Student Activity Center and University Square (20 Oct 2026) | 1,367 | 955 | 6 | 53 | 353 |

The last run also stops counting a resource topic's `category`, which is a machine id that no visitor
sees (`ops/provenance.mjs`, its skip list).

Of the 347 new strings, 170 are interface words in `content/text.json`, such as "Skip to content",
button and field labels and the resource list's controls. Most of the rest are page titles, meta
descriptions and form mechanics. The 16 pages built last add 32 new strings between them; eight of those
pages add none.

## Sources, by page

| Page or block | Source on the live site (crawl/main) or elsewhere |
|---|---|
| Home: announcement | `initiatives_housing_hub.md` (the Nov 10 panel) |
| Home: groups, mood widget | `join_peer_support_groups.md`, `home.md` |
| Home: craft nights | `join_craft_nights.md` |
| Home: workshops | `join_request_a_workshop.md`; the activities come from the decks (see below) |
| Home: involve | `join_get_involved.md`, `join_email_list.md` |
| Peer support groups | `join_peer_support_groups.md` (lead, body, check-in, activities, disclaimer, accessibility line); `about_mh_hub.md` (where); reel caption from the Instagram post |
| Get involved | `join_get_involved.md` (both roles, email list, all five FAQ questions and answers) |
| Craft nights | `join_craft_nights.md` (lead, past nights, access line); `about_what_we_do.md` (what to expect) |
| About: our team | `about_our_team.md`, lines 1–2 and 74–76 only (the heading, the leadership line, "Advisors & Campus Partners") |
| About: what we do, FAQ | `about_what_we_do.md`, `about_f_a_q.md` |
| Rooms and directions | `about_mh_hub.md`, `operations_directions_sac_caucus.md`, `operations_directions_lcm.md` |
| Forms | the Google Form question text (workshop request, programming feedback, staff application) |
| Footer address, crisis lines | the live footer; the crisis numbers from `resources_health.md` |
| Equity & belonging | `equity_belonging_equity_belonging.md`, the whole statement, word for word |
| Dogs on Call | `initiatives_dogs_on_call.md`; the visit dates are in the event fixture, typed from the same page |
| Navigating Housing in Madison | `initiatives_housing_hub.md` (every section, the panel and the resources); dates in the event fixture |
| Open house | `initiatives_open_house.md`; its countdown embed became the dated lead |
| Resource referral cards | `initiatives_referral_cards.md` |
| Colors of Support ribbons | `initiatives_ribbons.md`; the 14 causes are the words on the "Take a Ribbon!" card, live Peer groups image 8 (the page's own list is a picture) |
| Alumni | `join_alumni.md`, its first paragraph and links. The year-by-year list of leadership alumni is left out: it names real people |
| Email list | `join_email_list.md` and the "Join Our Email List" Google Form's text (`forms/MailingList.raw.json`), including its subscribe address |
| Request a workshop | `join_request_a_workshop.md`: every workshop, the FAQ, Testimonials & Feedback and the accommodation line |
| Behind the Workshop, three pages | each page's own `join_request_a_workshop_behind_the_workshop_*.md` |
| Request a program | `request_a_program.md`, `about_what_we_do.md`; the Badger SPILL band reuses the Peer groups page's words |
| Press | `operations_press.md`: the two outlets and each article's title |
| Privacy policy | `operations_privacy_policy.md`, all 15 sections word for word |
| Student Activity Center | `initiatives_student_activity_center.md`: every floor, office and link. The directory's heading, "Student Services Tower Directory", is the referral cards page's name for it. "Floor 11" counts as new only because the crawl runs it into the next line |
| University Square | `initiatives_university_square.md`: every place, address and link. Its heading is the Student Activity Center page's link to it. "View More" is dropped: the place's name is the link. The page's empty embed is left out |
| Resources | the live crisis line and feedback line from `resources_general.md` and `resources_health.md`; the cards are Connect's own records and Connect's card words (`../BSS Intranet Transfer v23/repo/assets/js/app.js`, `findCardHTML`); the topic names are Connect's category labels |

## Words this site wrote, and why

Each of these is editable in Connect. To replace one, the owner edits it; the build does not care where
the words came from.

| Kind | Examples | Why it could not come from existing material |
|---|---|---|
| Page titles and meta descriptions | "Peer support groups — Badger Supports" | Google Sites set none; search results need them |
| Navigation and section labels | "Rooms and directions", "FAQ", "drop in this week", "coming up", "how a group goes", "good to know", "Associate Directors" | new pages and sections the old site did not have |
| Schedule formatting | "Mon–Thu, 5–6 PM · Mon also 7–8 PM" | the live page gives the same times as a sentence; a fact row needs the short form |
| Press dates and buttons | "September 17, 2025", "Read the Article" | the live page shows each article as a picture and an excerpt with no date. The dates are read from each article's own address, and the excerpts are dropped because they name real people |
| Behind the Workshop | "The creator’s favorite slide is …", "developed in partnership with the 2025 to 2026 Badger Supports Programs Team" | the live pages name the student who made each deck. The names are left out and the work is credited to the team; the slide titles became the section headings |
| Workshop page relinks | "Request a workshop via our workshop request form.", the "Feedback Form" button | the live words say "via this form" and link a Google Form; here they name the native form they now open. The accommodation line's grammar is mended ("values", "is pleased", "Badger Supports workshop") |
| Resource list | "Browse by Topic", the counts, the search hint, "View Details" on a card whose record would call, text or email | the live pages are four lists with no search. The card words are Connect's; "View Details" in place of a call, text or email label is this site's rule (`src/render/blocks/resources.mjs`) |
| Resource topics | "Community & Involvement", "Child & Family Care", "Legal Services", "Technology" | Connect's category labels. They are Badger Supports material, but not in the corpus, so the tool counts them as new |
| Resources description | "General student resources, basic needs, health resources and identity based resources, on and off campus." | put together from the four live resources pages' titles |
| Workshop previews | goals, activity prompts, bingo cells, the self-advocacy scenario, housing terms | cut down from the deck slides to fit an interactive card. The decks are the source, but the cuts are new wording |
| Form mechanics | closed messages, confirmations, section titles such as "About the session", "First choice" | the Google Forms have no closed state, and their confirmation is Google's |
| Not found and director sign-in | "we couldn't find that page" and the sign-in explanation | pages the old site did not have |
| Crisis line | `site.json` `supportLine` | it states the scope ("peer support, not a crisis service"); the numbers are the live site's |
| Interface words | "Skip to content", "(opens Badger Supports Connect)", "Play the reel" | controls the old site did not have |
| Two corrected names | "Office of Student Financial Aid", "Milio's Sandwiches" | the live pages say "Finanical" and "Milo Sandwiches"; the shop's own link and photo say Milio's |
| A room name | "Multipurpose Room" (draft place) | there is no live directions page for it yet (WORK.md) |

## Keeping it this way

- New copy starts from the live page or a deck. Write new words only for a control or a page that is
  new, and record the reason here.
- Re-run `node ops/provenance.mjs <corpus-folder>` after a copy change. A string that moves from verbatim
  to new needs a reason.
- Never add a quote, a testimonial or a number that Badger Supports has not published ("if it doesn't
  exist, the section doesn't exist").
