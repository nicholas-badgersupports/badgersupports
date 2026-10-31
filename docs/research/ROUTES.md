# Routes

What happens to each address of the live site, www.badgersupports.org, in this rebuild. The data is
`content/routes.json`; this page explains it. `../../../MASTER-PROMPT.md` §3 asks for the map: "Keep useful URLs
and deep links; account for historic resource paths and external referrals."

## Measured

A crawl of the live site on 19 Oct 2026 (Google Sites, signed out):

| | Addresses |
|---|---|
| Crawled | 73 |
| Answered 200 | 71: 33 site pages and 38 team-member pages |
| Answered 404 | 2: team-member addresses that live pages link to |
| Carry the GA4 tag `G-XVT9XWRVQ5` | all 71 that answered; neither 404 |

The crawl reached the homepage as `/home`. The 33 site pages are exactly the 33 live paths in
`content/routes.json` other than `/` and the team-member pattern. The crawl itself is kept outside this
repository, because the team pages name real people.

`../../../INVESTIGATION.md` reports an earlier audit that visited 60 internal addresses. This crawl is a separate
count, made by this session.

## The rules

From `content/routes.json`, word for word:

1. "A live address that is printed, shortlinked or deep-linked keeps working: either the same path, or a 301 to
   its replacement."
2. "Paths are written without a trailing slash when they name a live page, and with one when they name a page
   this site builds."
3. "Individual staff profile pages are counted here as one pattern, not listed: the names are kept out of this
   public repository (inventory: PEOPLE-ROUTES-2026-10-19.md, outside the repo)."

## The dispositions

The five words come from §3. A sixth, `new`, marks an address the live site never had. How this repository
uses them:

| Disposition | Routes | Means here |
|---|---|---|
| keep | 13 | the same address; the page is carried over |
| improve | 7 | the same address; the page is redesigned |
| replace | 11 | a new address or a new kind of page; the old address 301s to it |
| redirect | 4 | the live address itself is a quirk of Google Sites; it 301s to a plain one |
| investigate | 0 | no destination until the owner says whether the page is current |
| new | 4 | no live address |
| **total** | **39** | |

## Every route

"Built" means this site builds the page at the new path today: a file in `content/pages/`, or a room in
`content/places/` (each published room gets `/directions/<id>/`).

| Disposition | Live | New | Built | Note |
|---|---|---|---|---|
| improve | `/` | `/` | yes | The homepage |
| redirect | `/home` | `/` | yes | Google Sites' name for the homepage; linked from the live menu |
| improve | `/about/what-we-do` | `/about/what-we-do/` | yes | Each program in its own section, with its photos |
| improve | `/about/our-team` | `/about/our-team/` | yes | Fictional fixture people until Connect's export exists |
| replace | team-member pattern | `/about/our-team/<slug>/` | pattern | See "Team-member addresses" |
| redirect | `/about/f-a-q` | `/about/faq/` | yes | |
| replace | `/about/mh-hub` | `/directions/sac-mhh/` | yes | The Hub's room page, also shown on the peer support groups page |
| redirect | `/equity-belonging/equity-belonging` | `/about/equity-belonging/` | yes | A doubled path |
| keep | `/initiatives/dogs-on-call` | same, with `/` | yes | Visit dates from the event fixture, typed from the live page, until Connect's public export |
| keep | `/initiatives/housing-hub` | same | yes | Dates from the event fixture, as Dogs on Call |
| improve | `/initiatives/open-house` | same | yes | The countdown embed became a dated lead |
| keep | `/initiatives/referral-cards` | same | yes | Still links its Google Form; a native one is to come |
| redirect | `/initiatives/ribbons-౨ৎ` | `/initiatives/ribbons/` | yes | Two decorative non-Latin characters in the path |
| replace | `/initiatives/little-hearts` | `/directions/sac-mhh/` | yes | Not in the live menu. Retired 20 Oct 2026 at the owner's word: a 301 to the Hub, where the hearts are picked up |
| keep | `/initiatives/student-activity-center` | same, with `/` | yes | Not in the live menu, nor here. The Student Services Tower Directory, floor by floor; the referral cards link it. Rebuilt 20 Oct 2026 at the owner's word |
| keep | `/initiatives/university-square` | same, with `/` | yes | Not in the live menu, nor here. Each place on the square; the Student Activity Center page links it. Rebuilt 20 Oct 2026 at the owner's word |
| keep | `/join/alumni` | same | yes | Links its form, which is restricted to badgersupports.org accounts today. The live list of alumni names is left out |
| keep | `/join/craft-nights` | same | yes | |
| replace | `/join/email-list` | same | yes | Still the Google Form and the subscribe address; a native form is to replace them (`../COMMUNICATIONS.md`) |
| improve | `/join/get-involved` | same | yes | The header's and the homepage's Get involved button |
| replace | `/join/leadership` | `/join/get-involved/` | yes | Not in the live menu; says recruitment is paused. Retired 20 Oct 2026 at the owner's word: a 301 to Get involved |
| improve | `/join/peer-support-groups` | same | yes | |
| keep | `/join/request-a-workshop` | same | yes | Its Google Form is now `/forms/workshop-request/` |
| keep | three Behind the Workshop pages | same | yes | Under `/join/request-a-workshop/behind-the-workshop/`: support-networks, stress-management-self-care, navigating-housing. Not in the live menu |
| keep | `/operations/press` | same | yes | Each article's title and date; the excerpts are left out, because they name real people |
| improve | `/operations/privacy-policy` | same | yes | The live words, unchanged. They still describe Google Sites, Google Analytics and Google Forms: the owner's and a legal review before launch |
| replace | `/operations/directions/sac-caucus` | `/directions/sac-caucus/` | yes | A room record |
| replace | `/operations/directions/lcm` | `/directions/lcm/` | yes | A room record |
| keep | `/request-a-program` | same | yes | The peer group and volunteer training requests still open their Google Form |
| replace | `/resources/general`, `/basic-needs`, `/health`, `/identity-based` | `/resources/` | yes | Four rows: one list, and each old path 301s to `?topic=` (`RESOURCES-VIEWER-2026-10-20.md`) |
| new | | `/forms/workshop-request/` | yes | |
| new | | `/forms/programming-feedback/` | yes | Anonymous |
| new | | `/staff/` | yes | Refuses everyone until Connect sign-in exists |
| new | | `/directions/` | yes | Every published room |

## Team-member addresses

The live site has one page per team member, under one of four groups: advisors, directors, general-staff and
volunteers. The crawl found 40 such addresses: 38 answered 200 and 2 answered 404. None is listed in this
repository. The inventory is `PEOPLE-ROUTES-2026-10-19.md`, beside the repository and not in it.

- Each group's old addresses 301 to the team page: four catch-all lines, `/about/our-team/{group}/*`
  (`teamRedirects()`, `ops/build.mjs`).
- A person's new page comes only from their own opt-in profile on Connect. Nothing is copied from the old pages.
- A person's own old address can be carried as an alias on their profile. It is written before the
  catch-alls, so it wins.

## Redirects written today

`dist/_redirects`, built 20 Oct 2026, has 17 lines:

| From | To |
|---|---|
| `/home` | `/` |
| `/about/f-a-q` | `/about/faq/` |
| `/about/mh-hub` | `/directions/sac-mhh/` |
| `/equity-belonging/equity-belonging` | `/about/equity-belonging/` |
| `/initiatives/ribbons-%E0%B1%A8%E0%A7%8E` | `/initiatives/ribbons/` |
| `/initiatives/little-hearts` | `/directions/sac-mhh/` |
| `/join/leadership` | `/join/get-involved/` |
| `/operations/directions/sac-caucus` | `/directions/sac-caucus/` |
| `/operations/directions/lcm` | `/directions/lcm/` |
| `/resources/general` | `/resources/?topic=general` |
| `/resources/basic-needs` | `/resources/?topic=basic-needs` |
| `/resources/health` | `/resources/?topic=health` |
| `/resources/identity-based` | `/resources/?topic=identity-based` |
| `/about/our-team/{group}/*`, four lines | `/about/our-team/` |

Each line is a 301. The ribbons line is the live path percent-encoded.

## Redirects waiting for their page

A route marked `redirect`, or `replace` with a new path, writes its 301 only once the page at the new path is
built (`redirectsFile()`, `ops/build.mjs`). Until then it is listed in `.build/report.json` under
`redirectsWaiting`. None waits today.

## Links that still go to the live site

A link to a path this site does not build goes to the live page instead, marked `data-pending`
(`resolveLink()`, `src/render/context.mjs`). Today the build reports none. The last was the referral cards page's
"Student Services Tower Directory" link, answered when `/initiatives/student-activity-center/` was built on 20 Oct
2026. The test "links to pages not built yet go to the live site, never to a dead local path" checks the rule
with a made-up path.

## The switch

This site is to answer at the live site's own address. When it does, the live Google Sites pages stop
answering there. Two things would then break:

- a live address with no page here and no alias to one would answer "not found";
- a link marked `data-pending` would point at this site, at a page it does not have.

So `node ops/build.mjs --production` refuses to build while either remains (`cutoverProblems()`,
`ops/build.mjs`; the test "a production build refuses anything still left on the live site",
`test/build.test.mjs`). The prototype build does not run this check; its `.build/report.json` lists only the
pending links and the waiting redirects. Run against the content on 20 Oct 2026, the check found 39 in the
morning and finds none now:

| What is left | Count |
|---|---|
| Live addresses with no page | 0 |
| Links to pages not built | 0 |
| **Total** | **0** |

Every live address is answered: 34 by a page built here, of which 13 are reached through a 301. The
team-member pattern is not counted; its catch-alls answer it. Of the four hidden pages, the owner had Student
Activity Center and University Square rebuilt, and Little Hearts and Leadership retired with a 301 each (20 Oct).
A production build still refuses for another reason: the hand-typed fixtures, until Connect's exports exist.

A page the owner retires still needs an answer. The check has no "gone" disposition, so a retired page 301s to
a page that exists, as Little Hearts and Leadership do (the owner's choice, 20 Oct).

## Other badgersupports.org addresses the live pages link to

The crawl found links to six other addresses on the organisation's domain. No request was made to any of them.

| Address | Linked from |
|---|---|
| `win.badgersupports.org` | every page that answered, except `/join/email-list` |
| `insta.badgersupports.org` | every page that answered, except `/join/email-list` |
| `feedback.badgersupports.org` | `/join/craft-nights`, `/join/request-a-workshop` |
| `housing.badgersupports.org` | the homepage |
| `toolkit.badgersupports.org` | `/initiatives/housing-hub` |
| `apply.badgersupports.org` | `/initiatives/housing-hub` |

`../../../FORM-AUDIT.md` lists `feedback.badgersupports.org` as the programming feedback Google Form's address,
and `content/forms/programming-feedback.json` records it under `source.aliases`. Pointing it at
`/forms/programming-feedback/` is a DNS or forwarding change, and that is the owner's to make.

## Not checked

- ~~Where the six addresses above lead~~ and ~~shortlinks~~: read 30 Oct 2026, in `../SWITCH.md`. One shortlink,
  `mendota`, forwarded to a live page this map lacked; it has a row now, a 301 to `/directions/` (queue item 3a).
- **Links from outside the site**: search results, printed material, Instagram, Connect and old emails. No
  referrer data was read; the GA4 property is not verified (`../ANALYTICS.md`).
- **Whether Netlify matches the ribbons path** on its servers. Netlify's command-line matcher does (`../SWITCH.md`).
- **The live site after 19 Oct 2026.** A page added or renamed since then is not in this map.
- **The Google My Maps embed** on the live resources pages.
