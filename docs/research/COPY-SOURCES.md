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

Of the 195 new strings, 84 are interface words in `content/text.json`, such as "Skip to content" and
button and field labels. Most of the rest are page titles, meta descriptions and form mechanics.

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

## Words this site wrote, and why

Each of these is editable in Connect. To replace one, the owner edits it; the build does not care where
the words came from.

| Kind | Examples | Why it could not come from existing material |
|---|---|---|
| Page titles and meta descriptions | "Peer support groups — Badger Supports" | Google Sites set none; search results need them |
| Navigation and section labels | "Rooms and directions", "FAQ", "drop in this week", "coming up", "how a group goes", "good to know", "Associate Directors" | new pages and sections the old site did not have |
| Schedule formatting | "Mon–Thu, 5–6 PM · Mon also 7–8 PM" | the live page gives the same times as a sentence; a fact row needs the short form |
| Workshop previews | goals, activity prompts, bingo cells, the self-advocacy scenario, housing terms | cut down from the deck slides to fit an interactive card. The decks are the source, but the cuts are new wording |
| Form mechanics | closed messages, confirmations, section titles such as "About the session", "First choice" | the Google Forms have no closed state, and their confirmation is Google's |
| Not found and director sign-in | "we couldn't find that page" and the sign-in explanation | pages the old site did not have |
| Crisis line | `site.json` `supportLine` | it states the scope ("peer support, not a crisis service"); the numbers are the live site's |
| Interface words | "Skip to content", "(opens Badger Supports Connect)", "Play the reel" | controls the old site did not have |
| A room name | "Multipurpose Room" (draft place) | there is no live directions page for it yet (WORK.md) |

## Keeping it this way

- New copy starts from the live page or a deck. Write new words only for a control or a page that is
  new, and record the reason here.
- Re-run `node ops/provenance.mjs <corpus-folder>` after a copy change. A string that moves from verbatim
  to new needs a reason.
- Never add a quote, a testimonial or a number that Badger Supports has not published ("if it doesn't
  exist, the section doesn't exist").
