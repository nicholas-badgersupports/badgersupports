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
import { handlePage, siteNow, useDist, PAGE_CACHE } from "../netlify/lib/pages.mjs";
import { useStore, memoryStore, currentRevision, publishRevision } from "../netlify/lib/published.mjs";
import { eventSections, forgetEvents } from "../netlify/lib/live-events.mjs";
import { freshPglite, useAdapter, many } from "../netlify/lib/db.mjs";
import { editEntry, editSource, editsFile, saveEdit, waitingCount } from "../netlify/lib/edits.mjs";
import { pageStrings, siteStrings, textStrings } from "../src/shared/edits.mjs";

const OUT = path.join(ROOT, "local", "test-build-published");
const TODAY = "2026-10-20";
await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: TODAY, edits: {} });
const SERVER = JSON.parse(fs.readFileSync(path.join(OUT, "_server", "server.json"), "utf8"));
const SAVED_OUT = path.join(ROOT, "local", "test-build-preserved-words");
// This build deliberately reads the real shipped edits file, rather than an isolated empty fixture.
await build({ out: SAVED_OUT, serverDir: path.join(SAVED_OUT, "_server"), media: false, today: TODAY });
const SAVED_SERVER = JSON.parse(fs.readFileSync(path.join(SAVED_OUT, "_server", "server.json"), "utf8"));
const SAVED_EDITS = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "edits.json"), "utf8")).edits;
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const HERO = "page:pg-home:b-home-hero/title";
const words = (site) => new Map([
  ...site.pages.flatMap(pageStrings), ...siteStrings(site.site), ...textStrings(site.text),
].map(s => [s.target, s.value]));

/* Each case: the build's content, its files, and a store holding `revision` (or nothing). */
async function given(revision = null, { server = SERVER, out = OUT } = {}) {
  useAdapter(await freshPglite()); // the pages that show a form read its switch
  useContent(server);
  useDist(out);
  const store = memoryStore();
  if (revision) await store.set("current", { schema: "bss.revision/1", at: "2026-10-20T15:00:00.000Z", by: "Robin", stamp: revision.n, ...revision });
  useStore(store);
  forgetEvents();
  return store;
}
const get = (p, init = {}) => handlePage(new Request(`http://site.test${p}`, init), { today: TODAY, now: Date.parse(`${TODAY}T12:00:00Z`) });

test("shipped saved words survive no revision and agree with the editor and its export", async () => {
  await given(null, { server: SAVED_SERVER, out: SAVED_OUT });
  assert.ok(Object.keys(SAVED_EDITS).length, "the release carries saved wording");
  assert.deepEqual(SAVED_SERVER.render.builtEdits, SAVED_EDITS);
  const shown = words(await siteNow({ catalogues: false }));
  for (const [target, value] of Object.entries(SAVED_EDITS)) {
    assert.equal(shown.get(target), value, target);
    const entry = await editEntry(target);
    assert.equal(entry.shown, value, target);
    assert.equal(entry.current, value, target);
    assert.equal(entry.original, SAVED_SERVER.editable[target].floor, "source remains available for Restore");
    assert.equal(entry.waiting, false, target);
    const pageId = target.startsWith("page:") ? target.split(":")[1] : "pg-home";
    assert.equal((await editSource(pageId)).find(e => e.target === target).current, value, target);
  }
  for (const p of ["/", "/join/peer-support-groups/"]) {
    const response = await get(p);
    assert.equal(response.headers.get("x-bss-revision"), "0", "dynamic rendering, not a static-file failure fallback");
    assert.equal(await response.text(), fs.readFileSync(path.join(SAVED_OUT, p, "index.html"), "utf8"), p);
  }
  assert.deepEqual((await editsFile()).edits, SAVED_EDITS);
  assert.equal(await waitingCount(), 0);
});

test("restoring shipped saved words publishes an authoritative empty revision and keeps the source wording", async () => {
  await given(null, { server: SAVED_SERVER, out: SAVED_OUT });
  const who = { sub: "fictional-editor", name: "Fictional Editor" };
  for (const [target, value] of Object.entries(SAVED_EDITS)) {
    const entry = await editEntry(target);
    await saveEdit(who, { target, expected: value, value: entry.original });
  }
  await publishRevision(who, { now: new Date("2026-10-20T12:01:00Z") });
  assert.deepEqual((await currentRevision()).edits, {}, "a present empty revision must not reapply shipped edits");
  const rows = await many("SELECT target, value FROM content_edits");
  assert.equal(rows.length, Object.keys(SAVED_EDITS).length);
  const shown = words(await siteNow({ catalogues: false }));
  for (const { target, value } of rows) {
    assert.equal(value, SAVED_SERVER.editable[target].floor, target);
    assert.equal(shown.get(target), value, target);
    assert.equal((await editEntry(target)).current, value, target);
  }
  assert.deepEqual((await editsFile()).edits, {});
  assert.equal(await waitingCount(), 0);
  for (const p of ["/", "/join/peer-support-groups/"]) {
    const response = await get(p);
    assert.equal(response.headers.get("x-bss-revision"), "1");
    assert.equal(await response.text(), read(path.join(p, "index.html")), p);
  }
});

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

/* An address whose %-escapes do not decode names no page. It answers the 404 page, with or without its final "/",
   whether the page is drawn or the build's file answers; never the home page. A catch-all line still takes it, as
   Netlify's matcher does, so the answer does not depend on which of the two runs first. */
test("an address whose %-escapes do not decode is the 404 page, never the home page", async () => {
  const MALFORMED = ["/%E0%A4", "/%E0%A4/", "/%", "/about/%FF/", "/about/faq%E0", "/home/%E0"];
  const notFound = read("404.html");
  const home = read("index.html");
  await given();
  for (const p of MALFORMED) {
    const r = await get(`${p}?topic=x`);
    assert.equal(r.status, 404, p);
    assert.equal(r.headers.get("location"), null, p);
    const body = await r.text();
    assert.notEqual(body, home, p);
    assert.equal(body, notFound, p);
  }
  assert.equal((await get("/%E0%A4", { method: "HEAD" })).status, 404, "HEAD");
  for (const p of ["/about/our-team/directors/%E0/", "/about/our-team/directors/%E0"]) {
    const r = await get(p);
    assert.equal(r.status, 301, p);
    assert.equal(r.headers.get("location"), "/about/our-team/", p);
  }
  useStore({ kind: "broken", get: async () => { throw new Error("store down"); }, set: async () => {} });
  const was = console.error;
  console.error = () => {};
  try {
    for (const p of MALFORMED) {
      const r = await get(p);
      assert.equal(r.status, 404, `${p}, from the build's file`);
      assert.equal(await r.text(), notFound, `${p}, from the build's file`);
    }
  } finally { console.error = was; }
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
  const r = await eventSections("pg-home", { today: TODAY, now: Date.parse(`${TODAY}T12:00:00Z`) });
  const all = Object.values(r.blocks).join("");
  assert.match(all, />Come By</);
  assert.doesNotMatch(all, />Drop In</);
  assert.match(await (await get("/")).text(), />Come By</, "and the page itself agrees");
});

/* Each running copy of the page function draws pages, and a save is published by whichever copy took it. The store
   is the one thing they share. A copy that drew a page before another copy's save must draw the next one from the
   store, or it puts the old words back into a cache the save has just cleared. Here this process is the copy that
   drew, and the other copy's save is the store moving to the next revision. */
test("item 8: a page drawn after another copy publishes shows the new words, in the page and in its event blocks", async () => {
  const WEEK = "page:pg-home:b-home-week/title";
  const store = await given({ n: 1, edits: { [HERO]: "the words before the save", [WEEK]: "The Week Before" } });
  const before = await get("/");
  assert.match(await before.text(), /the words before the save/);
  assert.equal(before.headers.get("x-bss-revision"), "1");
  assert.match(Object.values((await eventSections("pg-home", { today: TODAY, now: Date.parse(`${TODAY}T12:00:00Z`) })).blocks).join(""), /The Week Before/);

  await store.set("current", { schema: "bss.revision/1", n: 2, at: "2026-10-20T15:05:00.000Z", by: "Robin", stamp: 2, edits: { [HERO]: "the words after the save", [WEEK]: "The Week After" } });

  const after = await get("/");
  const home = await after.text();
  assert.equal(after.headers.get("x-bss-revision"), "2", "drawn from the revision the store holds now");
  assert.match(home, /the words after the save/);
  assert.doesNotMatch(home, /the words before the save/);
  const blocks = Object.values((await eventSections("pg-home", { today: TODAY, now: Date.parse(`${TODAY}T12:00:00Z`) })).blocks).join("");
  assert.match(blocks, /The Week After/, "the event blocks the page's script asks for again");
  assert.doesNotMatch(blocks, /The Week Before/);
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

test("a form's switch that cannot be read: the page keeps its published words, draws the form as built, and is held a minute", async () => {
  await given({ n: 4, edits: { [HERO]: "badger supports, still here" } });
  useAdapter({ query: async () => { throw Object.assign(new Error("down"), { code: "db.down" }); } });
  const res = await get("/");
  assert.equal(res.status, 200);
  const home = await res.text();
  assert.match(home, /badger supports, still here/, "the published words stay");
  assert.doesNotMatch(home, /chip--closed/, "the staff application's door as built: open, no Closed tag");
  assert.equal(res.headers.get("netlify-cdn-cache-control"), "public, s-maxage=60");
  assert.equal(res.headers.get("x-bss-revision"), "4");
  const faq = await get("/about/faq/");
  assert.equal(faq.headers.get("netlify-cdn-cache-control"), PAGE_CACHE["netlify-cdn-cache-control"], "a page with no form never asks");
});
