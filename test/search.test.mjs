/* Site-wide search (queue item 39, slice 39-A): the build's index of the public pages, the
   search page it feeds, and the menu entry that leads to it. The matching itself runs in the
   visitor's browser (src/client/search.js); the interact suite presses it there. */

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
    assert.ok(p.path.startsWith("/") && p.path.endsWith("/"), `${p.path}: a page address`);
    assert.ok(p.title.trim(), `${p.path}: a title`);
    assert.equal(typeof p.text, "string", `${p.path}: words`);
  }
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

test("the menu leads to the search page", () => {
  const flat = content.site.nav.flatMap((i) => [i, ...(i.children || [])]);
  assert.ok(flat.some((i) => i.href === "/search/" && i.label === "Search"), "site.json's menu has Search");
});

const OUT = path.join(ROOT, "local", "test-search");
let report;
test.before(async () => {
  report = await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: TODAY });
});

test("the build writes the index as its own file, and the search page lists every page in it", () => {
  const written = JSON.parse(fs.readFileSync(path.join(OUT, "search-index.json"), "utf8"));
  assert.equal(written.schema, "bss.search-index/1");
  assert.equal(written.pages.length, report.search, "the file holds what the report counts");
  assert.deepEqual(written.pages.map((p) => p.path), index.map((p) => p.path), "the file is the index");
  const html = fs.readFileSync(path.join(OUT, "search", "index.html"), "utf8");
  assert.match(html, /Site Search/, "the search block is on the page");
  assert.match(html, /data-search/, "the page carries the search box's marker");
  for (const p of written.pages) assert.ok(html.includes(`href="${p.path}"`), `the page lists ${p.path} before the script runs`);
});

test("every page's menu carries Search, pointing at the built page", () => {
  const home = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
  assert.match(home, /<a href="\/search\/">Search<\/a>/, "the home page's menu has Search");
  const room = fs.readFileSync(path.join(OUT, "directions", "lcm", "index.html"), "utf8");
  assert.match(room, /<a href="\/search\/" aria-current="page">Search<\/a>|<a href="\/search\/">Search<\/a>/, "a room page's menu has Search");
});
