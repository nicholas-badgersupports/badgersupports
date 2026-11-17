/* Site-wide search (queue item 39, slice 39-A): the build's index of the public pages and the
   search page it feeds. The matching itself runs in the visitor's browser
   (src/client/search.js); the interact suite presses it there. The menu leads to the page
   since the owner's ruling of 16 Nov 2026 (WORK.md item 57), and stands there as a
   magnifier, its word kept for the phone menu (item 58); the menu tests below hold that. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, loadContent, searchIndex, ROOT } from "../ops/build.mjs";

const TODAY = "2026-10-20";
const content = loadContent({ edits: {} });
const index = searchIndex(content, { today: TODAY });
const byPath = new Map(index.map((p) => [p.path, p]));

test("the index covers the public pages, home and a room's own page among them", () => {
  assert.ok(byPath.has("/"), "the home page is indexed");
  assert.ok(byPath.has("/resources/"), "the resources page is indexed");
  assert.ok(byPath.has("/directions/lcm/"), "a room's page is indexed");
  assert.ok(index.length >= 40, `the index holds the site (got ${index.length})`);
  for (const p of index) {
    assert.ok(p.path.startsWith("/"), `${p.path}: an address on this site`);
    /* A page's own address ends at its directory; a resource's address is the Resources
       page with the resource's name as the search there (QOL proposal 1). */
    assert.ok(p.path.endsWith("/") || p.path.startsWith("/resources/?q="), `${p.path}: a page address, or a resource's`);
    assert.ok(p.title.trim(), `${p.path}: a title`);
    assert.equal(typeof p.text, "string", `${p.path}: words`);
  }
});

test("the index carries the resources as their own results (QOL proposal 1)", () => {
  const found = index.filter((p) => p.path.startsWith("/resources/?q="));
  assert.ok(found.length >= 40, `the resources are indexed (got ${found.length})`);
  const pantry = found.find((p) => p.title === "Fritz Food Pantry");
  assert.ok(pantry, "a named resource is its own result");
  assert.equal(pantry.path, `/resources/?q=${encodeURIComponent("Fritz Food Pantry")}`, "the result lands on the resource on the Resources page");
  assert.ok(pantry.text.includes("groceries"), "the result carries what the resource is");
});

test("a phrase that is only in one room's directions finds that room and nothing else", () => {
  const hits = index.filter((p) => p.text.includes("You Belong"));
  assert.deepEqual(hits.map((p) => p.path), ["/directions/lcm/"], "the LCM room's own words are on its page's entry only");
});

test("a person's page carries their public profile's words", () => {
  const person = index.find((p) => p.path.startsWith("/about/our-team/") && p.path !== "/about/our-team/");
  assert.ok(person, "a profile page is indexed");
  assert.ok(person.text.includes("sample profile"), `${person.path}: the profile's bio is in its words`);
});

test("what stays out stays out: the staff page, the 404 page, previews and the search page itself", () => {
  assert.ok(!byPath.has("/staff/"), "the staff page is noindex and out");
  assert.ok(!byPath.has("/search/"), "the search page does not index itself");
  assert.ok(!index.some((p) => p.path.includes("/preview/")), "form previews are out");
  assert.ok(!index.some((p) => p.path.endsWith(".html")), "the 404 page is out");
});

test("the menu leads to the search page, last in the menu (owner ruling, 16 Nov 2026)", () => {
  /* Supersedes the 11 Nov 2026 ruling this test pinned: the owner ruled on 16 Nov 2026
     (quality-of-life audit, Public item 1) that Search joins the navigation. */
  const flat = content.site.nav.flatMap((i) => [i, ...(i.children || [])]);
  assert.equal(flat.filter((i) => i.href === "/search/").length, 1, "one menu item points at /search/");
  const last = content.site.nav[content.site.nav.length - 1];
  assert.equal(last.label, "Search", "Search stands last in the menu");
  assert.equal(last.href, "/search/", "the last menu item is the search page");
});

const OUT = path.join(ROOT, "local", "test-search");
let report;
test.before(async () => {
  report = await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: TODAY });
});

test("the build writes the index as its own file, and the search page renders no results before a query", () => {
  const written = JSON.parse(fs.readFileSync(path.join(OUT, "search-index.json"), "utf8"));
  assert.equal(written.schema, "bss.search-index/1");
  assert.equal(written.pages.length, report.search, "the file holds what the report counts");
  assert.deepEqual(written.pages.map((p) => p.path), index.map((p) => p.path), "the file is the index");
  const html = fs.readFileSync(path.join(OUT, "search", "index.html"), "utf8");
  assert.match(html, /Site Search/, "the search block is on the page");
  assert.match(html, /data-search/, "the page carries the search box's marker");
  /* The index stays data the search reads (search-index.json), not page content: no Every
     Page list stands on the page, and the index's own addresses are not rendered as links
     (the few that appear are the site's ordinary navigation and footer links). */
  assert.ok(!html.includes("data-srch-all"), "no Every Page list is rendered");
  assert.ok(!html.includes("Every Page"), "no Every Page heading is rendered");
  const listed = written.pages.filter((p) => html.includes(`href="${p.path}"`));
  assert.ok(listed.length < written.pages.length / 2, `the page does not render the index as links (${listed.length} of ${written.pages.length} addresses appear, from navigation and the footer)`);
  assert.ok(!html.includes('href="/directions/lcm/"'), "a room's page is not listed before a query");
  /* Try Again stands on the page only hidden, offered when a load has actually failed. */
  assert.match(html, /data-srch-again hidden/, "the Try Again row starts hidden");
});

test("every page's menu carries Search as its magnifier, and the search page itself still builds", () => {
  /* The owner ruled on 16 Nov 2026 (quality-of-life audit, Public item 1) that Search joins
     the navigation, superseding the earlier ruling this test pinned (WORK.md item 39); the
     same evening he ruled it stands in the header as a magnifier, its word kept in the
     link for the phone menu's list and as the link's name (WORK.md item 58). */
  const home = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
  assert.match(home, /<a class="nav-search" href="\/search\/" aria-label="Search">/, "the home page's menu carries the search icon link");
  assert.match(home, /data-i="search"/, "the home page's menu carries the magnifier");
  assert.match(home, /<span class="nav-search-word">Search<\/span>/, "the word stands in the link for the phone menu");
  const room = fs.readFileSync(path.join(OUT, "directions", "lcm", "index.html"), "utf8");
  assert.match(room, /<a class="nav-search" href="\/search\/" aria-label="Search">/, "a room page's menu carries the search icon link");
  assert.ok(fs.existsSync(path.join(OUT, "search", "index.html")), "the search page is still built at /search/");
});

test("the header carries no help link and no Explore entry (owner rulings, 16 Nov 2026)", () => {
  /* The "Need help now?" header link and the Explore menu entry both arrived with item 57
     and both came out on the owner's direct instruction the same evening (WORK.md item 58):
     the Resources page and the Explore pages themselves are untouched. */
  const flat = content.site.nav.flatMap((i) => [i, ...(i.children || [])]);
  assert.ok(!flat.some((i) => i.href === "/explore/"), "no menu item points at /explore/");
  const home = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
  const header = home.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
  assert.ok(!header.includes("header-help"), "no help link stands in the header");
  assert.ok(!header.includes("Need help now?"), "the help link's words are gone from the header");
  assert.ok(!header.includes(">Explore<"), "Explore is not in the header menu");
});
