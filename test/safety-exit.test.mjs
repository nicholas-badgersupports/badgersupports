/* The Safety Exit: a pill in the header of every built page, a plain link to Google, the
   script that makes a press open Google in a new tab, replace the page in this tab and try
   to close it (and counts three Escapes), and the privacy page's honest note about what
   the button cannot do. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { SAFETY_EXIT_DEFAULT, safetyExitHref, laySettings, applyChange, emptyStructure } from "../src/shared/structure.mjs";

const OUT = path.join(ROOT, "local", "test-build-safety-exit");
const TEXT = JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text;

const htmlFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === "_server" ? [] : htmlFiles(p);
  return e.name.endsWith(".html") ? [p] : [];
});

test.before(async () => {
  await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

test("the destination is Google, the same as the other two sites", () => {
  assert.equal(SAFETY_EXIT_DEFAULT, "https://www.google.com/");
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8"));
  assert.equal(site.safetyExitUrl, SAFETY_EXIT_DEFAULT, "the build's own setting carries the default");
});

test("a custom destination in the site's settings is the one the pill points at", () => {
  assert.equal(safetyExitHref({ safetyExitUrl: "https://example.org/leave" }), "https://example.org/leave");
  const site = { name: "Badger Supports", safetyExitUrl: SAFETY_EXIT_DEFAULT, footer: {} };
  laySettings(site, { safetyExitUrl: "https://example.org/leave" });
  assert.equal(site.safetyExitUrl, "https://example.org/leave");
  assert.equal(safetyExitHref(site), "https://example.org/leave", "the laid-over setting reaches the href the header draws");
});

test("an unset, empty or invalid destination falls back to Google", () => {
  for (const bad of [undefined, null, "", "   ", "not a url", "http://www.google.com/", "javascript:alert(1)", "https://", "https://exa mple.org/", 42]) {
    assert.equal(safetyExitHref({ safetyExitUrl: bad }), SAFETY_EXIT_DEFAULT, JSON.stringify(bad));
    const site = { name: "Badger Supports", safetyExitUrl: SAFETY_EXIT_DEFAULT, footer: {} };
    laySettings(site, { safetyExitUrl: bad });
    assert.equal(site.safetyExitUrl, SAFETY_EXIT_DEFAULT, `laid over: ${JSON.stringify(bad)}`);
  }
  assert.equal(safetyExitHref({}), SAFETY_EXIT_DEFAULT);
  assert.equal(safetyExitHref(null), SAFETY_EXIT_DEFAULT);
});

test("the destination saves through Site Settings, and a bad one is refused whole", () => {
  const ctx = { pages: [], site: {}, redirected: () => false, authored: new Set() };
  const saved = applyChange(emptyStructure(), { action: "settings", settings: { safetyExitUrl: "https://example.org/leave" } }, ctx);
  assert.equal(saved.doc.settings.safetyExitUrl, "https://example.org/leave");
  for (const bad of ["", "http://example.org/", "not a url", "javascript:alert(1)"]) {
    assert.throws(
      () => applyChange(emptyStructure(), { action: "settings", settings: { safetyExitUrl: bad } }, ctx),
      (e) => e.code === "settings.safetyExitUrl",
      JSON.stringify(bad),
    );
  }
});

test("every built page carries one Safety Exit pill, a plain link to Google", () => {
  const pages = htmlFiles(OUT);
  assert.ok(pages.length > 40, `built pages found (${pages.length})`);
  for (const p of pages) {
    const page = fs.readFileSync(p, "utf8");
    const pills = [...page.matchAll(/<a class="safety-exit" href="https:\/\/www\.google\.com\/" data-safety-exit>/g)];
    assert.equal(pills.length, 1, `${path.relative(OUT, p)}: one pill`);
    assert.ok(page.includes(`>${TEXT["header.safetyExit"].text}</span></a>`), `${path.relative(OUT, p)}: the label`);
    const header = page.slice(page.indexOf('<header class="site-header">'), page.indexOf("</header>"));
    assert.ok(header.includes("data-safety-exit"), `${path.relative(OUT, p)}: the pill sits in the header`);
  }
});

test("the privacy page says plainly what the button can and cannot do", () => {
  const page = fs.readFileSync(path.join(OUT, "operations/privacy-policy/index.html"), "utf8");
  assert.match(page, /replaces this page in your browser(?:'|&#39;)s Back history/);
  assert.match(page, /cannot erase your browser history, and no website can/);
  assert.match(page, /private or incognito window/);
});

test("the script opens a new tab, replaces the page, tries to close the tab, counts three Escapes, and measures nothing", () => {
  const src = fs.readFileSync(path.join(ROOT, "src/client/site.js"), "utf8");
  const exit = src.slice(src.indexOf("The Safety Exit"), src.indexOf("/* Icons move"));
  assert.match(exit, /window\.open\(/);
  assert.match(exit, /window\.location\.replace\(/);
  assert.match(exit, /window\.close\(\)/);
  assert.match(exit, /safetyExit\.addEventListener\("click"/);
  assert.match(exit, /escapes\.length >= 3/);
  assert.doesNotMatch(exit, /gtag|sendBeacon|analytics|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(exit, /confirm\(|beforeunload/);
});

test("the pill is styled as a pill in the brand red, at least 44px tall", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/styles/layout.css"), "utf8");
  const rule = css.slice(css.indexOf(".safety-exit {"), css.indexOf("}", css.indexOf(".safety-exit {")));
  assert.match(rule, /border-radius: var\(--r-chip\)/);
  assert.match(rule, /background: var\(--red\)/);
  assert.match(rule, /min-height: 44px/);
});
