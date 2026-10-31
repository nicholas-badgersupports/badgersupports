/* The pages as published now (netlify/lib/pages.mjs): every page drawn by the build's renderer from the build's
   snapshot, with the published revision of saved words laid over it (netlify/lib/published.mjs). Built once
   from the fixtures; the revision is written straight into a memory store, as a save would. Fixture only:
   nothing here is a deployed cache. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { useContent } from "../netlify/lib/content.mjs";
import { handlePage, useDist, PAGE_CACHE } from "../netlify/lib/pages.mjs";
import { useStore, memoryStore, forgetRevision } from "../netlify/lib/published.mjs";
import { eventSections, forgetEvents } from "../netlify/lib/live-events.mjs";

const OUT = path.join(ROOT, "local", "test-build-published");
const TODAY = "2026-10-20";
await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: TODAY });
const SERVER = JSON.parse(fs.readFileSync(path.join(OUT, "_server", "server.json"), "utf8"));
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const HERO = "page:pg-home:b-home-hero/title";

/* Each case: the build's content, its files, and a store holding `revision` (or nothing). */
async function given(revision = null) {
  useContent(SERVER);
  useDist(OUT);
  const store = memoryStore();
  if (revision) await store.set("current", { schema: "bss.revision/1", at: "2026-10-20T15:00:00.000Z", by: "Robin", stamp: revision.n, ...revision });
  useStore(store);
  forgetEvents();
  return store;
}
const get = (p, init = {}) => handlePage(new Request(`http://site.test${p}`, init), { today: TODAY });

test("with nothing published, every page is the build's file, byte for byte", async () => {
  await given();
  const report = JSON.parse(fs.readFileSync(path.join(OUT, "_server", "report.json"), "utf8"));
  assert.ok(report.pages.length > 50);
  for (const p of report.pages) {
    const res = await get(p.path);
    assert.equal(res.status, 200, p.path);
    const file = p.path.endsWith(".html") ? p.path.slice(1) : path.join(p.path, "index.html");
    assert.equal(await res.text(), read(file), p.path);
  }
});

test("a published word is on the page, in its title and with JavaScript off, and nowhere it does not belong", async () => {
  await given({ n: 3, edits: { [HERO]: "badger supports, together", "site:nav/0/label": "What We Run" } });
  const home = await (await get("/")).text();
  assert.match(home, /badger supports, together/);
  assert.match(home, /What We Run/, "the menu on every page");
  const about = await (await get("/about/what-we-do/")).text();
  assert.match(about, /What We Run/);
  assert.doesNotMatch(about, /badger supports, together/);
  // The same document a crawler or a reader without JavaScript gets: canonical, robots and headings are the build's.
  const pick = (html) => [...html.matchAll(/<(link rel="canonical"[^>]*|meta name="robots"[^>]*|h1[^>]*)>/g)].map((m) => m[1]);
  assert.deepEqual(pick(about), pick(read("about/what-we-do/index.html")));
});

test("every cache is bounded: the CDN 30 minutes, the browser none, and no query string asks past it", async () => {
  await given({ n: 1, edits: {} });
  const res = await get("/about/faq/");
  const cdn = res.headers.get("netlify-cdn-cache-control");
  const [maxage, swr] = [Number(cdn.match(/s-maxage=(\d+)/)[1]), Number(cdn.match(/stale-while-revalidate=(\d+)/)[1])];
  assert.ok(maxage + swr <= 1800, "at most 30 minutes on the CDN, stale time included");
  assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(res.headers.get("netlify-vary"), "query=topic|return", "every other query string shares the cached page");
  assert.equal(res.headers.get("netlify-cache-tag"), "page,page:pg-about-faq");
  assert.equal(res.headers.get("x-bss-revision"), "1");
  // A visitor's query, header or cookie changes nothing about the answer.
  const forced = await get("/about/faq/?refresh=1&nocache=1", { headers: { "cache-control": "no-cache", pragma: "no-cache", cookie: "bss_staff_hint=1; bss_staff=made-up-session; __Host-bss_staff=made-up-session" } });
  assert.equal(await forced.text(), await res.clone().text());
  assert.deepEqual([...forced.headers], [...res.headers]);
});

test("the page carries the site's own security headers, as _headers gives a static file", async () => {
  await given();
  const res = await get("/");
  const block = read("_headers").split("\n\n")[0].split("\n").slice(1).map((l) => l.trim());
  for (const line of block) {
    const i = line.indexOf(":");
    assert.equal(res.headers.get(line.slice(0, i)), line.slice(i + 1).trim(), line.slice(0, i));
  }
});

test("an old address still moves, a page address gains its slash, and an unknown one is the 404 page", async () => {
  await given();
  const moved = read("_redirects").split("\n")[0].trim().split(/\s+/);
  const r = await get(moved[0]);
  assert.equal(r.status, Number(moved[2]));
  assert.equal(r.headers.get("location"), moved[1]);
  const slash = await get("/about/faq");
  assert.equal(slash.status, 301);
  assert.equal(slash.headers.get("location"), "/about/faq/");
  const none = await get("/no/such/page/");
  assert.equal(none.status, 404);
  assert.equal(await none.text(), read("404.html"));
  assert.equal((await get("/", { method: "POST" })).status, 405);
});

/* Netlify's matcher (netlify-redirector, the one its command line uses) takes a line's address with or without
   a final "/", and a "/*" line takes its folder, with or without the "/", and everything below it. The page
   function answers the same, so the result does not depend on which of the two Netlify runs first. */
test("every old address moves with or without its final slash, and a team catch-all takes everything below it", async () => {
  await given();
  const lines = read("_redirects").trim().split("\n").map((l) => l.trim().split(/\s+/));
  const tried = [];
  for (const [from, to, status] of lines) {
    const forms = from.endsWith("/*")
      ? [from.slice(0, -2), from.slice(0, -1), `${from.slice(0, -1)}made-up-person`, `${from.slice(0, -1)}made-up-person/`]
      : [from, `${from}/`];
    for (const f of forms) {
      const r = await get(f);
      assert.equal(r.status, Number(status), f);
      assert.equal(r.headers.get("location"), to, f);
      tried.push(f);
    }
  }
  const splats = lines.filter(([from]) => from.endsWith("/*")).length;
  assert.equal(tried.length, (lines.length - splats) * 2 + splats * 4, "every line was tried in every form");
  assert.ok(splats >= 4 && lines.length >= 17, `${lines.length} lines, ${splats} catch-alls`);
  // Not past them: a longer name is a different address.
  for (const near of ["/homex/", "/about/our-team/directorsx/", "/about/f-a-q/more/"]) assert.equal((await get(near)).status, 404, near);
});

test("an address with letters outside Latin-1 gains its slash, still encoded, instead of failing", async () => {
  await given();
  for (const p of ["/initiatives/ribbons-%E0%B1%A8%E0%A7%8Ex", "/caf%C3%A9"]) {
    const r = await get(`${p}?topic=x`);
    assert.equal(r.status, 301, p);
    assert.equal(r.headers.get("location"), `${p}/?topic=x`, p);
  }
});

test("Mendota Lodge's old address goes to the directions list", async () => {
  await given();
  assert.ok(read("_redirects").split("\n").includes("/operations/directions/mendota-lodge  /directions/  301"));
  const r = await get("/operations/directions/mendota-lodge");
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "/directions/");
});

test("when the revision cannot be read, the build's file answers, held a minute", async () => {
  await given();
  useStore({ kind: "broken", get: async () => { throw new Error("store down"); }, set: async () => {} });
  forgetRevision();
  const was = console.error;
  console.error = () => {};
  try {
    const res = await get("/about/faq/");
    assert.equal(res.status, 200);
    assert.equal(await res.text(), read("about/faq/index.html"));
    assert.equal(res.headers.get("netlify-cdn-cache-control"), "public, s-maxage=60");
    assert.equal(res.headers.get("x-bss-revision"), "build");
  } finally { console.error = was; }
  assert.notEqual(PAGE_CACHE["netlify-cdn-cache-control"], "public, s-maxage=60");
});

test("the event feeds print the published words, so a refresh never puts the build's back", async () => {
  await given({ n: 2, edits: { "text:schedule.dropIn": "Come By" } });
  const r = await eventSections("pg-home", { today: TODAY });
  const all = Object.values(r.blocks).join("");
  assert.match(all, />Come By</);
  assert.doesNotMatch(all, />Drop In</);
  assert.match(await (await get("/")).text(), />Come By</, "and the page itself agrees");
});

test("a published value that is not a word: a section switched off, a link, a photo, a layout", async () => {
  await given({ n: 4, edits: {
    "page:pg-home:b-home-announce/enabled": "false",
    "page:pg-home:b-home-hero/primary/href": "/about/what-we-do/",
    "page:pg-craft-nights:b-cn-next/show": "all",
  } });
  const built = read("index.html");
  assert.match(built, /data-block="b-home-announce"/, "(the build shows the announcement)");
  const home = await (await get("/")).text();
  assert.doesNotMatch(home, /data-block="b-home-announce"/, "switched off, the section is gone");
  const hero = home.match(/<section[^>]*data-block="b-home-hero"[\s\S]*?<\/section>/)[0];
  assert.match(hero, /href="\/about\/what-we-do\/"/);
  assert.notEqual(await (await get("/join/craft-nights/")).text(), read("join/craft-nights/index.html"), "a layout choice changes the page");
  // A value that fails its check is not laid over the page, whatever the store holds.
  await given({ n: 5, edits: { "page:pg-home:b-home-hero/primary/href": "javascript:alert(1)" } });
  assert.equal(await (await get("/")).text(), built);
});
