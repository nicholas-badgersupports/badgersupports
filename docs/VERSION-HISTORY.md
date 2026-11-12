# Badger Supports Public version history

Software changes through November 11, 2026, for visitors, staff and maintainers. Dates use America/Chicago. Development periods describe work on the rebuild. Individual publication dates appear only where a deployment record supports them.

## Unreleased

Development from November 5 to November 11, 2026, checked into the repository and not yet published. A publication date will be recorded here when a deployment record supports one.

### Added

- A site-wide search page at `/search/` searches the public pages in the visitor's own browser against an index the build writes; staff pages, form previews and form answers are never indexed (Slice 39-A). By the owner's ruling of November 11, 2026 the menu carries no Search entry; the page answers at its address.

- A Google Analytics forwarder is built into the pages but ships unconfigured: it sends nothing until a publish build is given a verified property id, and it loads with no consent step, matching the existing Google site (item 22).

- Forms gained setup guides, and hiring forms can retain a recommendation across the hiring cycle; that retention depends on the paired Connect receiver. The resource directory gained Cost, Location and Access filters, presented as chips.

- An Explore Campus hub at `/explore/` gathers the site's explorer tools in one cards block and links to each; every tool names where its listings come from.

- The Campus Events Explorer at `/explore/events/` searches campus events and filters them by interest, category and date, in a calendar or a list. Listings come from UW–Madison Events and the Wisconsin Union, with Badger Supports programs from Connect labelled as ours; a cost or sold-out state appears only when a source states it.

- The Bus Route Explorer at `/explore/bus-routes/` compares up to five housing addresses against the campus buildings a visitor picks, and reports a direct bus, one transfer or no suitable connection, from Madison Metro's published route data. It shows no times, schedules or predictions, and an address typed into it is not kept. On Navigating Housing the tool is signposted, not hosted, so the workshop pages keep their no-collection rule.

- Discover Classes by Interest at `/explore/classes/` browses UW–Madison courses by interest from UW Course Search listings, each card labelled with its term. The course data was first pulled on November 11, 2026 as a labelled verification sample; on November 12, 2026 the owner ruled that Registrar permission need not be sought, and the tool went live on the production pull.

- The Academic Support Navigator at `/explore/academic-support/` walks a short question tree to the tutoring, accommodations and other academic support in the resource library, using the library's own cards. Its first screen states that it is not academic advising.

- A resource record that Connect exports with source data ends its card with the publisher and last-reviewed date and links to the official page, and shows only while its status is approved. Records without source data render exactly as before.

- A workshop request now queues one notice to Programs as it arrives. The notice is held until a verified sender is set and Connect's matching action is in place, and a request is never delayed or lost for want of it.

- The site's version history became a tracked record with a review gate: this file is the canonical history, and a release candidate is checked against it before publication (items 46 and 47).

### Changed

- The Peer Support Groups page: its Instagram reel now loads without a click and without the midterms caption; the header, join steps and expectations were reworked, and the peer and Hub photos come from the organisation's Drive library. The home hero leads with the peer circle, its pause control is a dot icon, and headings and cards keep whole words.

- What We Do presents four ways in, each in its programme colour; History draws its eras as one timeline; Navigating Housing opens with Before You Sign situations and a How It Works panel; Request a Program shows the programs at a glance with the request steps.

- The menu no longer lists Rooms, and the hub entry reads Mental Health Hub. A website problem reported from the FAQ now goes to the directors. Forms open by default, and hiring forms close on December 18, 2026. Form wording, legal documents and agreements read from Connect, and the alumni history reads Connect each time it is drawn.

- The privacy draft was updated to describe the site as it now ships: the Instagram embed as it loads, and the forms as they now work. It remains a draft, frozen for the owner's and legal review, and is not published.

- The public pages were redesigned within the standing brand: the footer drops its street address and its rooms-and-directions link, gives hello@badgersupports.org a prominent mail link, and makes the social links and the Director Sign-In 44-pixel icon buttons; the crisis strip keeps its exact wording, centred. Room pages navigate by an icon-led section list, and Directions stands side by side, so the page needs less scrolling.

- Peer Support Groups reads left to right: each day is one row, its sessions in aligned time, place and Get Directions columns, with a large Today tag on the day that is running and Next Up on the following one, both worked out from the visitor's real date. The photograph at the head of the drop-in section sits level with its heading instead of floating below a gap.

- Resources reveals its matching cards progressively — twelve at a time behind Show More, following search and filters — and safety and survivor-support cards are never held back by the reveal. Dogs on Call states "Every session is free and drop-in. All are welcome!" as a banner with its calendar button and its UHS Prevention line, and gains a Meet the Dogs photo row.

- What We Do leads with the full Fall 2026 training cohort photograph the owner chose, with dated group photographs beside it; Craft Nights gains a Made at Craft Nights gallery of eight photographs of past work; History's era years are set oversized on its timeline. No milestone, schedule or fact was added or changed.

- All 13 forms present as one centred sheet: the form's own title and introduction in the head, one card per question, and choice rows at least 44 pixels tall. A long form — at least two sections and ten questions — walks in named steps with progress, Back and Continue, and a Check Your Answers review; short forms stay on one page. No question, order, required status, endpoint, routing or access control changed.

- The FAQ's website-problem section is two paragraphs in place of four, keeping who triages a report and what to include; the Find the Resource to Correct link is removed, and the Email the Student Directors button remains.

### Fixed

- The screenshot checks count only the site's own console messages, so an embedded service's noise no longer fails a page.

## 2026-11-04 to 2026-11-05 — Development period — Form setup, file delivery and visitor pages

Development period. Netlify recorded five production publications on November 5, ending with the deployment titled `Website (8e7e220)` at 12:14 p.m. CST. The project still required team sign-in when checked on November 7. These records establish deployment to the protected Netlify site. [Production deployment](https://app.netlify.com/projects/badgersupports-public/deploys/6aecc774ba180a14b92fcb9b)

### Added

- Authorized staff can set wording, local opening and closing times, and deadlines for all 13 native forms from one setup wizard. Staff review changes before saving or opening a form. Back and Cancel preserve the existing settings. Manual closure takes precedence.

### Changed

- Directions distinguishes the Hub from event rooms, Ribbons offers 27 illustrated entries with keyboard and no-script details, and the Equity page keeps its approved statement alongside contact actions.

- The team directory starts loading the opening portraits earlier, prioritizes nearby images and can reuse eligible image bytes. A missing or withdrawn image falls back to initials. The timing comparisons used local fixtures.

- Maintainers can run the team compatibility checks in an isolated checkout. Testing a paired Connect export remains available when the producer fixture is supplied.

### Removed

- Removed external reference links from ribbon pop-ups and their no-script equivalents. Existing saved content fields remain compatible.

### Fixed

- Application and recommendation delivery now transfers the associated PDFs to Connect before reporting completion. Retries can complete an interrupted transfer without creating a second answer.

- The browser now accepts resources offered in the report and update forms. Only the public resource ID and name are sent to the browser. The server still rejects unknown choices.

Sources · [form-setup.test.mjs](../test/form-setup.test.mjs) · [pdf-delivery.test.mjs](../test/pdf-delivery.test.mjs) · [photo-loading.test.mjs](../test/photo-loading.test.mjs) · [PAGE-PURPOSE.md](PAGE-PURPOSE.md)

## 2026-11-03 — Development period — Events, visiting, workshops and team profiles

Development period. The November 3 evening production deployment was titled `Website (01a1222)`. Staff verified Home, a real team profile and workshop prefills. All 13 native form-state checks reported closed at that time. The later History, team-order and workshop-preview commits follow this deployment. [Publication record](../WORK.md) · [Netlify deployment](https://app.netlify.com/projects/badgersupports-public/deploys/6aea8f7fac652627ab7a59db)

### Added

- The site can refresh eligible team profiles, approved Wall notes and resource information from Connect between builds. A Wall submission route starts closed and subject to moderation. An email-list request route also starts closed. Historical alumni display requires an approved dataset and is disabled in the source configuration.

- First-time visitors can find peer-group expectations, current room directions and FAQ answers. Craft Nights separates upcoming visits from captioned photo recaps and offers a contact or update route when the next visit cannot be confirmed.

- Groups can compare four workshops, try text-accessible previews and carry a changeable topic choice into the native request or supported Google Form. The three Behind the Workshop pages offer activities without collecting answers.

- The About section gained an editable account of the organization’s history, linked from What We Do. Its eight eras can be read without JavaScript.

### Changed

- Events distinguish upcoming, ongoing and ended sessions. Calendar links retain valid source times across Chicago clock changes, and current attendance links are withheld when the feed is stale. Program request links preserve the selected option.

- Team pages use Connect’s public eligibility, groups, portrait and available display order. Sparse profiles keep their place, unranked records have a fallback and withdrawn records are withheld. Personal information stays out of the static build. Student Supporter recognition requires its separate opt-in.

- Updated navigation and next steps on the home, involvement, alumni, program and error pages. The alumni path leads to email updates. Staff have page-purpose and content-stewardship records for checking claims and preserving existing wording overrides.

Sources · [DECISIONS.md](DECISIONS.md) · [live-content.mjs](../netlify/lib/live-content.mjs) · [workshop-comparison.test.mjs](../test/workshop-comparison.test.mjs) · [history-page.test.mjs](../test/history-page.test.mjs)

## 2026-11-02 — Development period — Saved changes, recovery and release checks

Development period. The production deployment titled `Website (892b171)` was recorded at 6:41 p.m. CST on November 2 (00:41 UTC on November 3). Later changes that day are grouped here by development date. [Deployment chronology](../WORK.md)

### Added

- Staff can put back a retired page without rolling back later work. If the old record lacks its prior state, a staff-created page returns as a draft and a built-in page returns live. Retired sections disappear from editing choices, and the Retire control fits a phone.

- The Press page now includes The Daily Cardinal’s coverage of the housing panel.

### Changed

- Ended events retain readable contrast. The Ended label wraps cleanly on phones.

- Repository instructions assign routine Git handoffs to the builder and reserve the decision to publish for the owner.

### Fixed

- Saving or explicitly refreshing a page now clears stale wording and feed copies across running instances. Event responses no longer get an extra minute of stale browser caching.

- Maintainers can detect installed dependencies that disagree with the lockfile, including through linked paths, and see unmapped event types in build output. Browser checks wait for dialog closure and verify complete suite reports.

### Security

- After Connect staff sign-in, the browser removes temporary sign-in values from the address bar when JavaScript runs.

Sources · [DECISIONS.md](DECISIONS.md) · [deps-match.mjs](../ops/deps-match.mjs) · [suites.mjs](../ops/suites.mjs)

## 2026-10-30 to 2026-10-31 — Development period — Staff publishing, permissions and older addresses

Development period. WORK records protected production deployments for several of these revisions. The source evidence dates development where no matching publication timestamp was checked. [Deployment chronology](../WORK.md)

### Added

- Authorized staff can manage form availability, draft and preview new pages, copy or retire pages and sections, restore content, return menu items, and edit site settings and room photos. New pages stay hidden until a publisher enables them.

- Prepared Connect-backed team and moderated Wall feeds, initially disabled pending exports, and three closed forms for reporting, suggesting and updating resources. Profile guidance explains the normal public-profile choice and separate supporter recognition.

### Changed

- Staff sign-in follows Connect’s available methods and keeps the method used for the session. Resource update dates display the Chicago calendar day.

- Maintainers gained repository and wording instructions, a shared handoff route, a reversible domain-switch procedure and release-status labels that distinguish checked-in work from publication.

- Prepared draft privacy wording for owner and legal review before the domain switch. Its status as a draft matters to anyone relying on the public policy.

### Fixed

- Older links resolve with or without a trailing slash. Malformed addresses show the normal missing-page response. Craft nights reach the correct program page, and saved wording follows its key into other copies and feeds.

### Security

- Crawler guidance now applies only to this site. The image-processing dependency was updated to resolve the three high-severity dependency alerts recorded for the earlier version.

Sources · [DECISIONS.md](DECISIONS.md) · [SWITCH.md](SWITCH.md) · [structure.mjs](../netlify/lib/structure.mjs)

## 2026-10-23 to 2026-10-26 — Development period — First protected deployment and staff tools

Development period. The earliest production publication found is October 23 at 1:18 a.m. CDT, titled `Website (f6cd97f)`. A separate October 25 publication included the expanded editor and outbox. [Dated October 23 record](OVERNIGHT-RUN-2026-10-23.md) · [October 25 release evidence](../WORK.md)

### Added

- Added the program and workshop catalogue, workshop detail pages, searchable approved resources, alumni and mailing-list pages, housing, referral cards, ribbons, press, privacy and other previously mapped public destinations. Older addresses point to their replacements.

- The resource directory groups approved services, supports topic and text filtering, and keeps each resource’s details readable without scripts. Resource actions gained accessible names.

- The production build reads events selected for the public site and approved resources from Connect and stops if the required feed is unavailable. Event schedules can refresh between builds. Production omits fictional profiles and Wall notes and supplies indexable pages and a sitemap.

- Native staff, volunteer, recommendation and email-list workflows joined workshop requests and feedback. Launch kept native forms closed and offered configured Google alternatives. PDF handling limits access and leaves unfinished uploads eligible for cleanup.

- Authorized staff can edit published wording, photos and links on the page, inspect earlier versions and restore a revision. A valid permitted save publishes the change. Refresh Now lets staff request fresh content. Concurrent edit checks protect later saves.

- The delivery queue claims pending work across workers and retries with the same submission reference. Optional receipts, a directors’ Sheets backup and periodic retries require separate setup. Anonymous forms do not send a receipt.

### Changed

- Peer groups gained their green identity and Craft Nights its purple identity. Home simplified its actions and removed the secondary Drop in this week and All events on Connect links.

### Fixed

- A form changed during entry restores compatible answers, retains uploaded files and shows retired answers so the visitor can copy them. Replacing an upload uses the latest file. Phone menus, keyboard selection, Back navigation, multi-day events, field limits and delivery status now preserve the intended state.

### Security

- The staff page checks current access and restricts retries to the reader’s own forms. Form rate limits account for shared campus connections. Photos must come from approved sources. The build rejects missing migrations and excludes developer notes, source maps and unexpected files from the site.

Sources · [OVERNIGHT-RUN-2026-10-23.md](OVERNIGHT-RUN-2026-10-23.md) · [OVERNIGHT-RUN-2026-10-24.md](OVERNIGHT-RUN-2026-10-24.md) · [COMMUNICATIONS.md](COMMUNICATIONS.md)

## 2026-10-19 to 2026-10-20 — Development period — Rebuild brief and first review prototype

Development period. The owner’s October 19 brief and audit of the existing Google Sites site precede the first reachable commit on October 20. The initial work record identifies the rebuild as local at this point. The predecessor website’s own start date is unknown. [Brief](DECISIONS.md) · [Predecessor route inventory](research/ROUTES.md) · [First revision](https://github.com/nicholas-badgersupports/badgersupports/commit/ed4ac3a)

### Added

- Visitors reviewing the prototype could browse Home, Get Involved, peer groups, Craft Nights, workshops, room directions, the team and FAQs. Events had room links and calendar downloads. The prototype used fictional profiles and events.

- The first prototype included workshop requests, anonymous programming feedback and a closed staff application. Its local intake API, Connect-based staff sign-in, form-specific access and editing controls gave maintainers a way to test workflows before publication.

- The home-page mood check-in offered a reply and kept daily totals by mood. It excluded selections from analytics. External embedded content loaded only when a visitor pressed Play.

- The rebuild mapped old URLs, kept photo originals outside the public repository and introduced editable content blocks, provenance, privacy and accessibility checks. Visitors could pause hero motion, use reduced motion, and browse core links without JavaScript.

Sources · [DECISIONS.md](DECISIONS.md) · [README.md](README.md) · [ROUTES.md](research/ROUTES.md)

## Sources and coverage

The review covered the 70 commits reachable from the default branch through `8e7e220`, the October 19 brief and route audit, both October run records, later decisions and the available production records. The November 11, 2026 extension covers the 44 commits that followed on the same branch through `ed48843`; none of it carries a publication date, because no deployment record for it was checked. GitHub had no tags or releases. Repeated portrait-loading refinements are grouped, while repeated verification, test-only corrections and regenerated contracts are folded into the change they support. The November 5 hiring-cycle candidate (`9cede55`) has since joined this branch and stands in Unreleased; it still requires the paired Connect receiver and has no verified Public release. [Candidate](https://github.com/nicholas-badgersupports/badgersupports/commit/9cede55)

The complete revision history of the Google Sites predecessor and the maintainer’s laptop-only handoffs were unavailable. The November 7 project settings showed team sign-in for the Netlify site. Domain cutover, present form switches, live receipt and backup delivery, and acceptance of the final resource fix were not independently verified. Historical blockers in WORK.md describe the date of their checks. [Switch record](SWITCH.md) · [Latest production record](https://app.netlify.com/projects/badgersupports-public/deploys/6aecc774ba180a14b92fcb9b)

This history groups changes by their effect and keeps unreleased work first. Existing evidence supplies the dates and version labels. Pull-request summaries can help locate changes and need an implementation and publication check. [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · [Semantic Versioning](https://semver.org/spec/v2.0.0.html) · [GitHub release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
