import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import { loadContent, ROOT } from "../ops/build.mjs";
import { makeContext } from "../src/render/context.mjs";
import { renderPage, pageTitle } from "../src/render/layout.mjs";
import { raw } from "../src/render/html.mjs";

const content = loadContent({ edits: {} });
const context = (site = content.site) => makeContext({
  site, text: content.text, prototype: false,
  assets: { css: "/example.css", js: {} },
});
const head = (page, site) => String(renderPage(context(site), page, { body: raw("<p>Example public content.</p>") })).split("</head>")[0];
const meta = (html, key) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];

test("public share previews use the existing brand asset with matching dimensions and editable words", async () => {
  const image = await sharp(path.join(ROOT, "assets/brand/bss-lockup-red.png")).metadata();
  const site = { ...content.site, name: "Example & Public" };
  const page = { id: "pg-example", path: "/example/", title: "Example page", description: "Example description." };
  const html = head(page, site);
  assert.equal(meta(html, "og:image"), `${site.origin}/assets/brand/bss-lockup-red.png`);
  assert.equal(meta(html, "og:image:width"), String(image.width));
  assert.equal(meta(html, "og:image:height"), String(image.height));
  assert.equal(meta(html, "og:image:type"), "image/png");
  assert.equal(meta(html, "og:image:alt"), "Example &amp; Public");
  assert.equal(meta(html, "twitter:card"), "summary_large_image");
  for (const field of ["title", "description", "image", "image:alt"]) {
    assert.equal(meta(html, `twitter:${field}`), meta(html, `og:${field}`), field);
  }
  assert.doesNotMatch(meta(html, "og:image"), /portrait|\/api\/|google|drive/);
});

test("explicitly noindex pages and private API responses receive no share image or Twitter card", () => {
  const pages = content.pages.filter(p => p.noindex);
  assert.ok(pages.length);
  pages.push({ id: "pg-api-example", path: "/api/example", title: "Example response", noindex: true });
  for (const page of pages) {
    const html = head(page);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.equal(meta(html, "og:image"), undefined, page.path);
    assert.equal(meta(html, "twitter:card"), undefined, page.path);
  }
});

for (const [form, landing] of [["pg-form-program-request", "pg-request-a-program"], ["pg-form-workshop-request", "pg-request-a-workshop"]]) {
  test(`${form} has distinct tab and share titles from its landing page`, () => {
    const page = content.pages.find(p => p.id === form);
    const other = content.pages.find(p => p.id === landing);
    assert.ok(page && other);
    assert.notEqual(pageTitle(page, content.site), pageTitle(other, content.site));
    assert.equal(meta(head(page), "og:title"), pageTitle(page, content.site));
  });
}

test("the public crawler guidance supplies a search and share description", () => {
  const page = content.pages.find(p => p.id === "pg-crawlers");
  assert.ok(page.description?.trim());
  assert.equal(meta(head(page), "description"), page.description);
  assert.equal(meta(head(page), "og:description"), page.description);
});
