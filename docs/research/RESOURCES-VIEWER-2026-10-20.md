# The resource list: one page for the four live ones, 2026-10-20

The live site has four resource pages: General, Basic Needs, Health and Identity Based. This site has
one, `/resources/`, built from Connect's own resource records and drawn as Connect's Find a Resource
card. The four old addresses send a visitor to the same list with a topic chosen (`_redirects`, 301).
The moderated viewer, with Report a Problem, Suggest a Resource and Suggest an Update, is queue item 21
and is not built.

Sources: the live pages, crawled 19 Oct 2026; Connect's shipped catalog,
`../BSS Intranet Transfer v23/repo/netlify/lib/builtin-resources.mjs` (source date 1 Aug 2026), read
only; Connect's card code, `repo/assets/js/app.js` (`findCardHTML`, `findMoreHTML`).

## The list a director is asked to approve

`content/fixtures/resources.json` holds Connect's records for the resources the live pages list,
projected exactly as Connect's `projectResource()` projects them for the public. It is a sample, says so
on the page, and stops `--production`. When Connect publishes a list a director has approved, the block's
source changes and nothing else does.

The owner approved this list and its "email us" address, directors@badgersupports.org, on 20 Oct 2026. It
stays marked as a sample until a director approves the records in Connect and Connect publishes them.

Each live entry was matched to a Connect record by its link, then by its name, and the misses were
checked by hand.

| Live page | Entries matched | Old address now opens |
|---|---|---|
| General | 14 | `/resources/?topic=general` (no topic of that name, so the whole list) |
| Basic Needs | 29 | `/resources/?topic=basic-needs` |
| Health | 26 | `/resources/?topic=health`, which is an alias of Mental Health & Wellbeing |
| Identity Based | 17 | `/resources/?topic=identity-based`, an alias of Community & Involvement |
| **All four** | **86 different records** | 45 on campus, 29 in Madison, 12 national |

The list is sorted on campus first, then Madison, then national, and by name within each.

## Live entries with no Connect record

These are on the live pages and not in the sample, because Connect has no record for them. Each needs a
director's decision: add it to Connect, or let it go. Still open after the owner's approval of 20 Oct.

- **Basic Needs**: the Food Resource Map (an embedded map, not a resource); the Catholic Multicultural
  Center Food Pantry; Mount Zion Baptist Church.
- **Health**: Sankofa Behavioral & Community Health; the Mental Health Services Student Advisory Board.
- **Links inside a matched entry** that point deeper than Connect's record does: Togetherall, Thrive, the
  UHS stalking and sexual-assault pages, violence prevention, the UW suicide-prevention training, UHS
  remote-health videos, and AA Madison's "about AA" page. Connect's record for the same service links
  another page of it: the UHS service's main page, or AA Madison's meeting list.

## Topics

The block's sixteen topics are Connect's sixteen categories, with Connect's labels
(`content/pages/resources.json`). A topic no record carries is not offered, so with the sample list
Transportation and Research & Creative Work do not show. Two topics also answer to an old page's word:
`health` opens Mental Health & Wellbeing and `identity-based` opens Community & Involvement. An unknown
word shows everything, which is why `general` needs no alias.

## Differences from the live pages, for the owner

| What | Live | Here | Why |
|---|---|---|---|
| Feedback address | "email us" opens a Gmail address on General and Identity Based, and hello@ on the other two | directors@badgersupports.org, as on the rest of this site | one address for one list; the FAQ calls directors@ the primary one. Approved by the owner, 20 Oct |
| 988 Suicide & Crisis Lifeline | the entry gives "Call:" and the Lifeline's old toll-free number | Connect's record: call or text 988 | the old number still forwards, but 988 is the number the Lifeline publishes |
| Crisis line in the page head | "608-265-5600 (option 9)" | the same words; the link dials 608-265-5600 | a phone link cannot choose a menu option, so the visitor still presses 9 |
| Buttons | links called "Here" | one button per card, Connect's label rules, never a call | below |
| Search and topics | none | search first, then the topics, Connect's order; on a phone the topics are one sliding row | below |

## Card rules, and where they differ from Connect

- **The button** keeps the record's own label unless that label is empty, starts with "Call", holds a
  phone number or is longer than eighteen characters; then it says View Details. That is Connect's rule.
  This site adds one: a label for a call, a text or an email ("Text 988", "Email Slow Food UW") also says
  View Details, because the button always opens a web page here. The number or address stays on the
  card. A record with no https address has no button. Connect could adopt the same rule.
- **Numbers spelt in letters** ("414-939-HOPE") dial each letter as its keypad digit. Connect's link keeps
  digits only and would dial six of them. This is a fix Connect could take too.
- **Additional Details** leaves out a line that repeats or begins one already shown, as Connect does.
- **One record's wording reads wrongly.** The UHS 24/7 crisis line's summary in Connect says "Get
  licensed mental health professionals provide immediate crisis support…". The card shows it as Connect
  holds it. The fix belongs in Connect, by a director.

## Things to know before trusting the sample

- **The runtime catalog may differ.** Connect can hold a newer resource list in its database that wins
  over the shipped file (the root `CLAUDE.md`: "a repo file is the floor, not the fact"). The sample is
  the shipped floor of 1 Aug 2026.
- **The privacy check** does not look for addresses or phone numbers in `content/fixtures/resources.json`,
  because every one there is a public service's own line; it still looks for credentials. It also allows
  the email list's subscribe address, which the organisation prints on its own form (`ops/check.mjs`).
- **Suggest a Resource** already exists as a Google Form, the Badger Supports Resource Request Form (its
  question text is in the corpus). Item 21 decides whether it moves into Connect with the other two
  reports.
