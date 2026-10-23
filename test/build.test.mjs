/* The built site: what the browser receives. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { build, ROOT, loadContent, cutoverProblems, redirectsFile } from "../ops/build.mjs";
import { INLINE_JS } from "../src/render/layout.mjs";
import { resolveLink } from "../src/render/context.mjs";

const OUT = path.join(ROOT, "local", "test-build");
let report;
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const pages = () => report.pages.map((p) => (p.path.endsWith(".html") ? p.path.slice(1) : path.join(p.path, "index.html")));

test.before(async () => {
  report = await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

test("the one inline script is the one the policy allows, and nothing styles inline", () => {
  const hash = crypto.createHash("sha256").update(INLINE_JS).digest("base64");
  assert.match(read("_headers"), new RegExp(`script-src 'self' 'sha256-${hash.replace(/[+/]/g, "\\$&")}'`));
  assert.match(read("_headers"), /style-src 'self';/);
  for (const p of pages()) {
    const html = read(p);
    assert.doesNotMatch(html, /\sstyle="/, `${p} has a style attribute`);
    assert.equal([...html.matchAll(/<script>/g)].length, 1, `${p}: one inline script`);
  }
});

test("every page has one h1, a title, no placeholder links, and the prototype is not for search engines", () => {
  for (const p of pages()) {
    const html = read(p);
    assert.equal([...html.matchAll(/<h1[\s>]/g)].length, 1, `${p}: one h1`);
    assert.match(html, /<title>[^<]+<\/title>/, `${p}: title`);
    assert.doesNotMatch(html, /href="#"/, `${p}: href="#"`);
    assert.match(html, /<meta name="robots" content="noindex">/, `${p}: noindex`);
  }
  assert.match(read("robots.txt"), /Disallow: \//);
});

test("the timetable shows the week from the build date, with today marked", () => {
  const html = read("index.html");
  assert.match(html, /data-date="2026-10-20"/);
  assert.match(html, /class="today-tag">Today</);
  assert.doesNotMatch(html, /data-date="2026-10-19"/, "yesterday is not listed");
});

test("the mood check-in is excluded from analytics and works without JavaScript", () => {
  const html = read("index.html");
  assert.match(html, /<section class="mood"[^>]*data-analytics="off"/);
  assert.match(html, /<form method="post" action="\/api\/mood"/);
});

test("a closed application shows its state, from the same switch the API reads", () => {
  assert.match(read("index.html"), /Applications closed/);
});

test("sample Wall notes say they are samples", () => {
  assert.match(read("index.html"), /Sample notes written for this prototype/);
});

test("links to pages not built yet go to the live site, never to a dead local path", () => {
  const html = read("index.html");
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const p = m[1].split("#")[0];
    if (p.startsWith("/assets/") || p.startsWith("/media/") || p === "/") continue;
    assert.ok(report.pages.some((x) => x.path === p), `local link to unbuilt ${p}`);
  }
  const card = read("initiatives/referral-cards/index.html");
  assert.match(card, /href="\/initiatives\/student-activity-center\/"/, "a page once left on the live site is linked here once it is built");
  const ctx = { site: { connectOrigin: "https://connect.example.org", liveOrigin: "https://www.badgersupports.org" }, builtPaths: new Set(["/"]), pendingLinks: new Set(), liveFor: new Map([["/initiatives/little-hearts/", "/initiatives/little-hearts"]]) };
  assert.deepEqual(resolveLink(ctx, "/initiatives/little-hearts/"), { href: "https://www.badgersupports.org/initiatives/little-hearts", pending: true }, "an unbuilt page is reached by its live address");
  assert.deepEqual([...ctx.pendingLinks], ["/initiatives/little-hearts/"]);
});

test("old addresses move only once their page exists", () => {
  const file = read("_redirects");
  assert.match(file, /^\/home {2}\/ {2}301$/m);
  assert.match(file, /^\/initiatives\/ribbons-%E0%B1%A8%E0%A7%8E {2}\/initiatives\/ribbons\/ {2}301$/m, "a renamed live page moves to its plain address");
  assert.match(file, /^\/resources\/health {2}\/resources\/\?topic=health {2}301$/m, "an old resource page opens its topic");
  const routes = [{ live: "/resources/health", path: "/resources/", disposition: "replace" }];
  const before = redirectsFile(routes, [], new Set());
  assert.equal(before.text.trim(), "");
  assert.deepEqual(before.waiting, ["/resources/health -> /resources/?topic=health"]);
  const after = redirectsFile(routes, [], new Set(["/resources/"]));
  assert.deepEqual(after.waiting, []);
});

test("a production build refuses hand-typed fixtures", () => {
  assert.throws(() => loadContent({ production: true }), /fixture/);
});

test("a production build refuses anything still left on the live site", () => {
  const content = loadContent();
  const builtPaths = content.pages.filter((p) => !p.file).map((p) => p.path);
  const left = cutoverProblems({ routes: content.routes, pages: content.pages, builtPaths, pendingLinks: report.pendingLinks.map((l) => l.path) });
  assert.deepEqual(left, [], "every live address is answered");
  assert.match(cutoverProblems({ routes: [{ live: "/x", path: null, disposition: "investigate" }], pages: [], builtPaths: [], pendingLinks: [] })[0], / \/x \(investigate\) has no page/, "an address with no destination yet");
  const retired = redirectsFile(content.routes, [], new Set(builtPaths)).text;
  assert.match(retired, /^\/initiatives\/little-hearts  \/directions\/sac-mhh\/  301$/m, "a retired page 301s to the page the owner named");
  assert.match(retired, /^\/join\/leadership  \/join\/get-involved\/  301$/m);
  assert.ok(!left.some((p) => p.includes("student-activity-center")), "a hidden page the owner kept is answered");
  assert.match(cutoverProblems({ routes: [], pages: [], builtPaths: [], pendingLinks: ["/x/"] })[0], / \/x\/, which/, "a link to a page not built");
  assert.ok(!left.some((p) => p.includes(" /resources/health ")), "an old resource page whose topic is built is answered");
  assert.ok(!left.some((p) => p.includes(" /about/mh-hub ")), "an old address whose page is built is answered");
  assert.ok(!left.some((p) => p.includes(" /home ")), "a redirect to a built page is answered");
  const one = [{ live: "/a", path: "/a/", disposition: "keep" }];
  assert.deepEqual(cutoverProblems({ routes: one, pages: [], builtPaths: ["/a/"], pendingLinks: [] }), []);
  assert.equal(cutoverProblems({ routes: one, pages: [], builtPaths: [], pendingLinks: [] }).length, 1);
  const moved = [{ live: "/b", path: "/c/", disposition: "replace" }];
  assert.match(cutoverProblems({ routes: moved, pages: [], builtPaths: [], pendingLinks: [] })[0], / \/b \(replace\) has no page/, "a redirect still waiting for its page");
});
