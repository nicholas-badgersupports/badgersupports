/* The events between publishes (netlify/lib/live-events.mjs): a page built from Connect's list asks
   for its event blocks again and gets them rendered from Connect's list now. Built once through a
   fake Connect, then asked through the router as a browser would. Every event here is fictional. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { useContent } from "../netlify/lib/content.mjs";
import { useConnect } from "../netlify/lib/connect.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { eventSections, calendarFile, forgetEvents } from "../netlify/lib/live-events.mjs";
import { chicagoDate } from "../src/render/context.mjs";

const ORIGIN = "http://site.test";
const TODAY = chicagoDate();
const day = (n) => new Date(Date.parse(`${TODAY}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const RESOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fixtures/resources.json"), "utf8"));
const TEXT = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text).map(([k, v]) => [k, v.text]));

const craft = (id, title, n) => ({ id, type: "craft", title, short: "", date: day(n), endDate: day(n), start: "17:30", end: "19:30", room: "SAC Caucus Room", full: false });
const reply = (events) => ({
  ok: true, schema: 1, version: "ev-live", tz: "America/Chicago", today: TODAY, until: day(56), unchanged: false,
  weekly: [
    { id: "w1", title: "Example directorate", weekday: 1, start: "17:00", end: "18:00", room: "SAC Caucus Room", from: null, until: null, skip: [] },
    // A weekly group with no room meets at the Hub (content/connect-feed.json), whose directions the peer page carries.
    { id: "w2", title: "Another example directorate", weekday: 3, start: "17:00", end: "18:00", room: null, from: null, until: null, skip: [] },
  ],
  events,
});
const PUBLISHED = reply([craft("e1", "Example night one", 1), craft("e2", "Example night two", 8)]);
const LATER = reply([craft("e2", "Example night two", 8), craft("e3", "Example night added later", 3)]);

/* A fake Connect that answers with `events` and counts how often it was asked for them. */
function fakeConnect(events, { fail = false } = {}) {
  const calls = [];
  return {
    calls,
    cfg: {
      url: "https://connect.test", keyId: "test-key", secret: "x".repeat(40),
      fetch: async (url, init) => {
        const action = JSON.parse(init.body).action;
        calls.push(action);
        if (fail) throw new Error("offline");
        return { json: async () => (action === "publicEvents" ? events : { ok: true, schema: 1, catalogVersion: "cat-1", sourceUpdatedAt: RESOURCES.sourceUpdatedAt, publication: {}, unchanged: false, resources: RESOURCES.resources }) };
      },
    },
  };
}

const OUT = path.join(ROOT, "local", "test-build-live");
const FIXTURE_OUT = path.join(ROOT, "local", "test-build-live-fixture");
await build({ production: true, connectConfig: fakeConnect(PUBLISHED).cfg, out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: TODAY });
await build({ out: FIXTURE_OUT, serverDir: path.join(FIXTURE_OUT, "_server"), media: false, today: TODAY });
const server = (out) => JSON.parse(fs.readFileSync(path.join(out, "_server", "server.json"), "utf8"));
const LIVE = server(OUT);
const FIXTURE = server(FIXTURE_OUT);
const read = (out, p) => fs.readFileSync(path.join(out, p), "utf8");

const get = (p, headers = { accept: "application/json" }) => handle(new Request(ORIGIN + p, { headers }));

/* Each case starts with the Connect build's content, the given Connect, and nothing held. */
function given(connect, content = LIVE) {
  useContent(content);
  useConnect(connect.cfg);
  forgetEvents();
}

/* Connect being unreachable is said on stderr; the cases that cause it keep the test output clean. */
async function quietly(fn) {
  const was = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = was; }
}

test.after(() => { useConnect(null); forgetEvents(); });

test("pages built from Connect's list ask for it again, and their calendar buttons open the API's file", () => {
  assert.match(read(OUT, "index.html"), /<body[^>]* data-refresh="events"/);
  const craft = read(OUT, "join/craft-nights/index.html");
  assert.match(craft, /<body[^>]* data-refresh="events"/);
  assert.match(craft, /href="\/api\/calendar\/connect-e1\.ics"/);
  assert.doesNotMatch(craft, /href="\/calendar\//);
  assert.doesNotMatch(read(OUT, "about/what-we-do/index.html"), /data-refresh/, "a page with no event block never asks");
  assert.doesNotMatch(read(FIXTURE_OUT, "join/craft-nights/index.html"), /data-refresh|\/api\/calendar\//, "a prototype never asks");
  assert.ok(fs.existsSync(path.join(OUT, "calendar", "connect-e1.ics")), "the publish still writes its calendar files");
  assert.ok(!Object.hasOwn(LIVE.events.pages, "pg-about-what-we-do"));
  assert.ok(!JSON.stringify(LIVE.events).includes("test-key"), "no key in what the API reads");
});

test("with nothing changed in Connect, each block is what the publish wrote, byte for byte", async () => {
  const connect = fakeConnect(PUBLISHED);
  given(connect);
  for (const [pageId, file] of [["pg-home", "index.html"], ["pg-craft-nights", "join/craft-nights/index.html"]]) {
    const r = await eventSections(pageId, { today: TODAY });
    const page = read(OUT, file);
    assert.ok(Object.keys(r.blocks).length, pageId);
    for (const [id, markup] of Object.entries(r.blocks)) {
      if (markup) assert.ok(page.includes(markup), `${pageId} ${id} is as published`);
      else assert.doesNotMatch(page, new RegExp(`data-block="${id}"`), `${pageId} ${id} was not published either`);
    }
  }
  const home = await eventSections("pg-home", { today: TODAY });
  assert.ok("b-home-week" in home.blocks && "b-home-craft" in home.blocks);
  assert.ok(!("b-home-wall" in home.blocks), "only the blocks that show events");
  assert.deepEqual(connect.calls, ["publicEvents"], "asked once for both pages");
});

test("an event on the page it would link to is named, not linked: the page never links to itself, before or after a refresh", async () => {
  given(fakeConnect(PUBLISHED));
  const main = (html) => html.match(/<main[\s\S]*<\/main>/)[0];
  const peer = main(read(OUT, "join/peer-support-groups/index.html"));
  assert.match(peer, /<strong>Peer support group<\/strong>/, "the Hub's next events still name the group");
  assert.doesNotMatch(peer, /href="\/join\/peer-support-groups\/"/);
  const live = Object.values((await eventSections("pg-peer-groups", { today: TODAY })).blocks).join("");
  assert.match(live, /<strong>Peer support group<\/strong>/);
  assert.doesNotMatch(live, /href="\/join\/peer-support-groups\/"/);
  assert.match(main(read(OUT, "directions/sac-mhh/index.html")), /<a href="\/join\/peer-support-groups\/">Peer support group<\/a>/, "the room's own page still links to the group");
});

test("an event added and one taken off in Connect show without a publish, and Connect is asked once a minute", async () => {
  const connect = fakeConnect(LATER);
  given(connect);
  const res = await get("/api/events/pg-craft-nights");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "public, max-age=60");
  assert.match(res.headers.get("netlify-cdn-cache-control"), /s-maxage=300/);
  assert.match(res.headers.get("content-type"), /^application\/json/);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.today, TODAY);
  const all = Object.values(body.blocks).join("");
  assert.match(all, /Example night added later/);
  assert.doesNotMatch(all, /Example night one/);
  assert.match(all, /href="\/api\/calendar\/connect-e3\.ics"/);

  await get("/api/events/pg-home");
  assert.deepEqual(connect.calls, ["publicEvents"], "a second page in the same minute is not a second call");
  await eventSections("pg-home", { now: Date.now() + 61_000 });
  assert.deepEqual(connect.calls, ["publicEvents", "publicEvents"], "a minute later it asks again");
});

test("when Connect cannot be read the page gets the published list, held half a minute", async () => {
  const connect = fakeConnect(LATER, { fail: true });
  given(connect);
  const res = await quietly(() => get("/api/events/pg-craft-nights"));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("netlify-cdn-cache-control"), "public, s-maxage=30");
  const all = Object.values((await res.json()).blocks).join("");
  assert.match(all, /Example night one/);
  assert.doesNotMatch(all, /added later/);
  await quietly(() => eventSections("pg-home", { now: Date.now() + 10_000 }));
  assert.equal(connect.calls.length, 1, "not asked again within half a minute");
  await quietly(() => eventSections("pg-home", { now: Date.now() + 31_000 }));
  assert.equal(connect.calls.length, 2);
});

test("a prototype answers from its own list and never calls Connect", async () => {
  const connect = fakeConnect(LATER);
  given(connect, FIXTURE);
  const r = await eventSections("pg-home", { today: TODAY });
  assert.equal(r.stale, false);
  assert.deepEqual(connect.calls, []);
  assert.doesNotMatch(Object.values(r.blocks).join(""), /\/api\/calendar\//);
});

test("the calendar route gives the file the publish wrote, and a friendly page for an event that is gone", async () => {
  given(fakeConnect(PUBLISHED));
  const res = await get("/api/calendar/connect-e1.ics", {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/calendar; charset=utf-8");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("cache-control"), "public, max-age=60");
  assert.equal(await res.text(), read(OUT, "calendar/connect-e1.ics"));
  assert.equal((await calendarFile("connect-e2")).stale, false);

  const gone = await get("/api/calendar/connect-e9.ics", { accept: "text/html" });
  assert.equal(gone.status, 404);
  assert.match(gone.headers.get("content-type"), /^text\/html/);
  const page = await gone.text();
  assert.ok(page.includes(TEXT["calendar.gone.title"]));
  assert.match(page, /<a href="\/">/);
});

test("the routes refuse a query string, a page with no events and anything but GET", async () => {
  given(fakeConnect(PUBLISHED));
  const asked = async (p, init) => {
    const res = await handle(new Request(ORIGIN + p, { headers: { accept: "application/json" }, ...init }));
    return [res.status, (await res.json()).error];
  };
  assert.deepEqual(await asked("/api/events/pg-home?fresh=1"), [400, "query.refused"]);
  assert.deepEqual(await asked("/api/calendar/connect-e1.ics?x"), [400, "query.refused"]);
  assert.deepEqual(await asked("/api/events/pg-about-what-we-do"), [404, "not.found"]);
  assert.deepEqual(await asked("/api/events/pg-nowhere"), [404, "not.found"]);
  assert.deepEqual(await asked("/api/events/constructor"), [404, "not.found"]);
  assert.deepEqual(await asked("/api/events/pg-home", { method: "POST", body: "{}" }), [405, "method.not-allowed"]);
  const unknown = await get("/api/events/pg-nowhere", {});
  assert.match(unknown.headers.get("content-type"), /^application\/json/, "the events route answers a script, so its errors are JSON");
});
