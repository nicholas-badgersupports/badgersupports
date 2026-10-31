# What can be edited on the site, 25 Oct 2026

The owner, 24 Oct 2026: "everything should be editable: words, links, media, forms, navigation, page sections and
layouts, and feature settings … A field left out is a listed gap, not fixed content" (`DECISIONS.md`, "The
platform"). This lists every value in the content and where it stands. Measured on 25 Oct 2026 in the cloud run
(fixture content, 30 page files), by walking every value of every block and of `content/site.json` and asking
`src/shared/edits.mjs` whether it is a target (`pageStrings`, `pageValues`, `siteStrings`, `siteValues`).

## Editable from the edit button, and published by a save

| What | Kind | Count | Checked on the server by |
|---|---|---|---|
| Words on pages | words | 796 | `editProblem`: no markup, no links, ≤ 2,000 characters, placeholders kept |
| Words in the menus, header and footer (`site.json`) | words | 52 | the same |
| Every line of `content/text.json` | words | 328, 57 of them with `{{placeholders}}` (listed under More words) | the same |
| Links on pages | link | 156 | `valueProblem`: a page of this site, `#anchor`, `mailto:`, `tel:`, or `https://` with no name or password |
| Links in the menus and footer | link | 41 values in `site.json`, links and on/off | the same |
| Photos | media | 110 | a photo id in the library |
| Icons | icon | 97 | one of the icons the site draws |
| Layout and feature choices (a section's variant, heading level, which events, a program's colour, a word's size, a workshop answer's tone) | choice | 69 | one of the field's own options |
| Sections and flags switched on or off | on/off | 13 | true or false |
| Numbers (how many events, days, …) | number | 11 | a whole number 0–99 |
| The dates a section shows | date | 1 | a real date |
| The Instagram video | video | 1 | an Instagram post or reel address (the one frame the security policy allows) |

Each of these keeps the editor's grants (`site.edit`), the conflict check, the history and Restore
(`content_edit_history`), and publishes like words (`ARCHITECTURE.md`, "Publishing a save").

## Not editable here, and why

| What | Count | Why, and where it belongs |
|---|---|---|
| Ids of blocks, list items, menu entries and topics | 83 on pages, 25 in `site.json` | permanent keys: every edit, history row and link to a section is addressed by them |
| References: which form, room, person, series, event source, anchor, group or category a block uses | 58 | permanent keys; changing one changes what the block is, not how it reads |
| The kind of a workshop's activity (network, bingo, choose, flip) | 4 | each kind has its own fields; changing it is a new block, not an edit |
| A photo by a new link | — | the build fetches and encodes a linked photo on the laptop (`DESIGN.md`, "Photos"); a page drawn between publishes cannot, and the security policy serves photos from this site only. A library photo can be chosen at once |
| The site's own settings (`name`, `origin`, `liveOrigin`, `connectOrigin`, `lang`, `description`, `footer.accessibilityEmail`) | 8 | addresses and identity the build and the security headers depend on; changed in the files and published |
| Adding, copying, reordering, retiring and putting back sections | — | **built 31 Oct** on the staff page (`ARCHITECTURE.md`, "Sections within a page"); a new section is a Text section, and sections drawing Connect's records or carrying a script are not copied. Pages themselves are built too: add, copy, move, retire, menu order ("Pages: drafts, preview, restore") |
| Putting a menu entry back once it is taken off | — | **built 31 Oct**: listed under Off the Menu on the staff page; Put Back returns it to its own group (`ARCHITECTURE.md`, "The menu") |
| Forms: questions, options, the open/closed switch | 9 forms | a form change is a new version that keeps its submissions; Connect owns the definitions and the switch (`WORK.md` item 17, `PUBLIC-SITE-FORMS`) |
| Rooms (`content/places/`) | 7 | each room is its own record and page; editing them here is a later slice |
| Events and resources | — | Connect's records; they reach the site from Connect (`ops/connect-feed.mjs`), never from this editor (one owner for each fact) |
