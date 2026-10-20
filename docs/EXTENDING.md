# Extending the site

How to add a page and how to add a block, with one real example of each from this repository. This is the
developer side of `../../MASTER-PROMPT.md` §10. The editor side, what Connect would show an approved editor, is
`CONNECT-EDITOR-CONTRACT.md`, which `npm run contract` writes from the same declarations.

**Not built:** the Connect editor itself (drafts, previews, publishing and restoring revisions), Connect
sign-in, and any check of who may edit what. Today a page is a JSON file and a block is a module, and both
change by editing the repository. Connect's side is two Exchange requests: `PUBLIC-SITE-EDITOR` (the editor and publishing) and
`PUBLIC-SITE-EDITOR-REVISIONS` (drafts, preview, restore, and adding, duplicating, reordering and retiring pages).

## What a block declares

§10 asks that a code module declare its schema, renderer, assets, permissions, dependencies and analytics
behaviour. Here is where each one is, and how far the build holds it:

| §10 asks for | In the block's module | Held by |
|---|---|---|
| schema | `fields`: each field's type, `"!"` for required | the build refuses a page whose block lacks a required field or carries one not declared (`blockProblems()`, `src/render/registry.mjs`) |
| renderer | `render(block, ctx)`, returning `html`…`` | `src/render/html.mjs` escapes every value put into the template, except output of another `html`…`` and `raw()`, which the code uses only on strings it made itself |
| assets | `client`: an optional browser module in `src/client/` | the build stops if the file is not in `src/client/` (`ops/build.mjs`, where it copies the browser modules) and loads it only on pages that use the block |
| | styles | **not declared.** A block's rules go in the shared `src/styles/blocks.css` |
| dependencies | `data`: the named data sources it reads from `ctx.data` | **listed, not enforced.** The contract prints it; nothing stops a block reading another source |
| analytics behaviour | `analytics`: `page` or `none` | `ANALYTICS.md`. Nothing is sent today |
| permissions | none | **not declared.** No block reads a session. A per-block permission is a **proposal** that waits on Connect sign-in |
| | `loading`: `eager` or `lazy` | whether its photos may load before they are near the screen |

`ctx.data` holds `events`, `wallNotes`, `wallSample`, `team`, `teamSample`, `mood`, `forms` and `places`
(`ops/build.mjs`, where `ctx` is made).

**Editors never add code.** An editor fills a block's fields; they cannot write HTML or a script. Where a page
needs something from another site, it is a controlled embed: the `embed` block takes only an Instagram address,
shows a still and a Play button, and loads Instagram's player only after Play. The Content Security Policy allows
frames from `https://www.instagram.com` and nowhere else (`ops/build.mjs` `cspHeader`).

## Adding a page

Example: `content/pages/about-faq.json`, the FAQ page, built in this session.

1. **Write one file** in `content/pages/`. Every page has this shape:

   ```json
   {
     "schema": "bss.page/1",
     "id": "pg-about-faq",
     "path": "/about/faq/",
     "title": "Frequently Asked Questions — Badger Supports",
     "description": "…",
     "analytics": "public",
     "blocks": [ … ]
   }
   ```

   The build checks (`ops/build.mjs`, the page loop):
   - `id` is `pg-` and 2 to 60 of a–z, 0–9 and hyphens, and no other page has it;
   - `path` starts and ends with `/`, uses a–z, 0–9 and hyphens, and no other page has it;
   - there is a `title`.

   `analytics` is `public`, or `none` for a page that must never be measured. `"noindex": true` keeps a page
   out of search engines.

2. **Add blocks.** Each one is `{ "id": "b-…", "type": "…", …its fields }`. The FAQ page has a `pagehead`
   (`b-faq-head`) and `questions` blocks, each question `{ "id": "q-…", "q": "…", "a": "…" }`.
   - A block id is `b-` and 2 to 60 of a–z, 0–9 and hyphens, unique on its page.
   - A block may carry only its declared fields, plus `id`, `type`, `enabled` and `anchor`.
     `CONNECT-EDITOR-CONTRACT.md` lists every block's fields.
   - `"enabled": false` hides a block without deleting it.
   - `startsOn` and `endsOn` (dates) hide a block outside those dates, but only on a block that declares them.
     Today that is `announcement` alone.
   - Every `icon` must be one the site draws (the build lists them if one is not).
   - A photo slot takes a library id, an `https://` link, or `{ "link", "alt", "focal" }` (`DESIGN.md`, "A
     photo slot").

3. **Old addresses.** `"aliases": ["/old-path"]` makes each old address answer 301 to this page (the homepage
   has `"aliases": ["/home"]`). An old live address listed in `content/routes.json` whose new path is this
   page's turns live on its own (below).

4. **The menu** is separate. To list the page, add `{ "id", "label", "href" }` to a section's `children` in
   `content/site.json` `nav`. A page that is not in the menu still builds and can be linked.

What changes elsewhere without being edited:

- **Links.** Any link to this path that was going to the live Google Sites page (`data-pending`) now goes
  here (`resolveLink()`, `src/render/context.mjs`).
- **Redirects.** A route in `content/routes.json` marked `redirect`, or `replace` with a new path, writes its
  301 only once the page at its new path is built. Until then it is listed as waiting
  (`research/ROUTES.md`).

## Adding a block

Example: `pagehead`, the "Page opening" block that starts the about pages and the FAQ. It was added in this
session. These are every file it touched:

| File | What changed |
|---|---|
| `src/render/blocks/pagehead.mjs` | new: the module |
| `src/render/registry.mjs` | one `import` line, and `pagehead` added to `BLOCKS` |
| `src/styles/blocks.css` | its rules, under its own heading |
| `docs/CONNECT-EDITOR-CONTRACT.md` | regenerated by `npm run contract`, not written by hand |
| `content/pages/*.json` | the pages that use it |

No other block, and no other part of the build, changed. The one shared file is `blocks.css`.

### 1. The module

```js
import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";

export default {
  type: "pagehead",
  label: "Page opening",
  fields: { title: "text!", label: "text", lead: "text", body: "paragraphs",
            primary: "link", links: "link[]", photos: "media[]" },
  data: [],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    return html`<section class="pagehead band" aria-labelledby="${b.id}-h" data-block="${b.id}">…</section>`;
  },
};
```

The full file is `src/render/blocks/pagehead.mjs`.

- **`type`** is what a page writes in `blocks[].type`. **`label`** is what an editor sees.
- **`fields`** use the types in `ops/contract.mjs` (`FIELD_TYPES`): `text`, `paragraphs`, `list`, `link`,
  `link[]`, `media[]`, `termlist`, `rows`, `circles`, `droplinks`, `embed`, `workshops`, `qa`, `points`,
  `place`, `source`, `teamgroups`, `person`, `eventquery`, `number`, `boolean`, `choice:a|b` and `date`. A
  field type not on that list prints as its own name in the contract; add a plain-words line for it there.
- **Links** go through `link()` or `ctx.link()`, never a bare `<a href>`, so pending pages, Connect and other
  sites are marked the same way everywhere.
- **Photos** go through `picture()`, which serves the encoded sizes and the focal point.
- **The section** carries `data-block="${b.id}"` and an `aria-labelledby` pointing at its heading.

### 2. Words

Every word a visitor reads is editable (owner, 19 Oct 2026). A block gets its words from two places only:

- **its fields**, which the page supplies;
- **`ctx.t("key")`**, for words that belong to the block and not to one page, such as a button label. Each key
  is an entry in `content/text.json`:

  ```json
  "embed.play": { "group": "page", "text": "Play the reel", "where": "Button on an Instagram video; …" }
  ```

  `where` tells an editor where the words appear. `group` must be one of the groups declared at the top of the
  file. Words with `{{n}}` keep their placeholders through any edit, or the edit is refused and the shipped
  text is used.

`npm run editable` fails on words written into the template, into `aria-label`, `alt`, `title` or
`placeholder`, passed straight to `link()`, or used as a fallback after `||`, and on a `t("key")` that is not in
`content/text.json`.

### 3. A browser module (only if the block needs one)

Put it in `src/client/` and name it in `client`. The build copies it with a hashed address and adds it only to
pages that use the block. If it shows words, list its keys in `CLIENT_TEXT` in `src/shared/text.mjs`
(`"strip.js": ["strip.count"]`); the page then carries those keys and no others. The site's CSP allows scripts
from this site only.

### 4. Styles

Add the block's rules to `src/styles/blocks.css` under a heading of its own, using tokens from
`src/styles/tokens.css`. Gate 3 of `npm run check` refuses a colour literal outside `tokens.css` and any type
under 14 px. Give the block a shape of its own; the owner asked that pages not look alike (`DESIGN.md`, "Page
shapes").

### 5. Register and check

1. Import the module in `src/render/registry.mjs` and add it to the `BLOCKS` list.
2. `npm run contract` regenerates `docs/CONNECT-EDITOR-CONTRACT.md`. Gate 1b fails while it is stale.
3. `npm run editable`.
4. `npm test`. Add a test in `test/pages.test.mjs` when the block has a rule of its own.
5. `node ops/check.mjs --browser`. It builds, runs every test, takes screenshots at 1280, 390 and 320 px, and
   runs the accessibility check on every page. Read its output, not only its exit code.

## What is still to build

| Missing | Why it matters | Where it is asked |
|---|---|---|
| The Connect editor | editors cannot change a page without the repository | Exchange `PUBLIC-SITE-EDITOR` |
| Publishing | one versioned bundle that records who published it | Exchange `PUBLIC-SITE-EDITOR` |
| Drafts, preview, restore | §10 asks for revisions; today the repository's history is the only one | Exchange `PUBLIC-SITE-EDITOR-REVISIONS` |
| Connect sign-in | needed before any per-block or per-page permission | Exchange `PUBLIC-SITE-SSO` |
| Enforced `data` | a block can read a source it did not declare | `../WORK.md` |
| Dates on every block | `startsOn` and `endsOn` work only on `announcement` | `../WORK.md` |
| A block's own stylesheet | every block's rules share `blocks.css` | `../WORK.md` |
