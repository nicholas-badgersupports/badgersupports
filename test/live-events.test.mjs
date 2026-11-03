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
import * as liveEvents from "../netlify/lib/live-events.mjs";
import { eventSections, calendarFile, forgetEvents } from "../netlify/lib/live-events.mjs";
import { useStore, memoryStore, noteGet } from "../netlify/lib/published.mjs";
import { chicagoOffset } from "../src/render/events.mjs";
import { chicagoDate } from "../src/render/context.mjs";
import { handlePage, previewResponse } from "../netlify/lib/pages.mjs";

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
await build({ production: true, feedRules: { ...JSON.parse(fs.readFileSync(path.join(ROOT, "content/connect-feed.json"))), exports: { team: false, wall: false } }, connectConfig: fakeConnect(PUBLISHED).cfg, out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: TODAY });
await build({ out: FIXTURE_OUT, serverDir: path.join(FIXTURE_OUT, "_server"), media: false, today: TODAY });
const server = (out) => JSON.parse(fs.readFileSync(path.join(out, "_server", "server.json"), "utf8"));
const LIVE = server(OUT);
const FIXTURE = server(FIXTURE_OUT);
const read = (out, p) => fs.readFileSync(path.join(out, p), "utf8");

const get = (p, headers = { accept: "application/json" }) => handle(new Request(ORIGIN + p, { headers }));

/* Each case starts with the Connect build's content, the given Connect, nothing held, and an empty store. */
function given(connect, content = LIVE) {
  useContent(content);
  useConnect(connect.cfg);
  forgetEvents();
  useStore(memoryStore());
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
  assert.match(read(FIXTURE_OUT, "join/peer-support-groups/index.html"), /schedule\.js/, "prototype day cards still mark ended groups without requesting Connect");
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

test("peer day cards follow changed weekly times and rooms, then removal, without a publish", async () => {
  const feed = structuredClone(PUBLISHED);
  const connect = fakeConnect(feed);
  given(connect);
  const cards = async () => {
    const reply = await eventSections("pg-peer-groups", { today: TODAY });
    assert.equal(reply.stale, false);
    assert.equal(typeof reply.blocks["b-pg-days"], "string");
    return reply.blocks["b-pg-days"];
  };
  assert.match(await cards(), /SAC Caucus Room/);
  feed.version = "ev-peer-moved";
  feed.weekly = [{ ...feed.weekly[0], start: "12:15", end: "13:45", room: "SAC Hearing Room" }];
  forgetEvents();
  const moved = await cards();
  assert.match(moved, /12:15–1:45/);
  assert.match(moved, /SAC Hearing Room/);
  assert.match(moved, /href="\/directions\/sac-hearing\/"/);
  assert.doesNotMatch(moved, /SAC Caucus Room|Student Mental Health Hub|T17:00:00/);
  feed.version = "ev-peer-removed";
  feed.weekly = [];
  forgetEvents();
  const empty = await cards();
  assert.ok(empty.includes(TEXT["schedule.weekEmpty"]));
  assert.match(empty, /href="\/join\/email-list\/"/);
  assert.doesNotMatch(empty, /class="card-list"|class="ev"/);
  assert.deepEqual(connect.calls, ["publicEvents", "publicEvents", "publicEvents"]);
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
  assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
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

test("when Connect cannot be read attendance is unavailable and the fallback is held half a minute", async () => {
  const connect = fakeConnect(LATER, { fail: true });
  given(connect);
  const res = await quietly(() => get("/api/events/pg-craft-nights"));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("netlify-cdn-cache-control"), "public, s-maxage=30");
  const all = Object.values((await res.json()).blocks).join("");
  assert.match(all, /couldn’t confirm the current event schedule/);
  assert.doesNotMatch(all, /Example night one|added later|href="[^\"]*calendar\//);
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
  assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(await res.text(), read(OUT, "calendar/connect-e1.ics"));
  assert.equal((await calendarFile("connect-e2")).stale, false);

  const gone = await get("/api/calendar/connect-e9.ics", { accept: "text/html" });
  assert.equal(gone.status, 404);
  assert.match(gone.headers.get("content-type"), /^text\/html/);
  const page = await gone.text();
  assert.ok(page.includes(TEXT["calendar.gone.title"]));
  assert.match(page, /<a href="\/">/);
});

/* The page's script swaps these blocks in, words and all, so a save on that page must be able to clear this answer
   by a tag of its own (router.mjs, tagsFor). The calendar files carry no saved words and keep the shared tag. */
test("item 8: a page's event answer carries the page's own tag, from Connect or from the published list", async () => {
  given(fakeConnect(PUBLISHED));
  for (const pageId of ["pg-home", "pg-craft-nights"]) {
    const res = await get(`/api/events/${pageId}`);
    assert.equal(res.status, 200, pageId);
    assert.equal(res.headers.get("netlify-cache-tag"), `events,events:${pageId}`, pageId);
  }
  assert.equal((await get("/api/calendar/connect-e1.ics", {})).headers.get("netlify-cache-tag"), "events");
  given(fakeConnect(LATER, { fail: true }));
  const stale = await quietly(() => get("/api/events/pg-home"));
  assert.equal(stale.headers.get("netlify-cdn-cache-control"), "public, s-maxage=30", "(the published list)");
  assert.equal(stale.headers.get("netlify-cache-tag"), "events,events:pg-home");
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

test("an event that began yesterday and ends tomorrow is still coming up, between publishes and in its calendar file", async () => {
  const days = { id: "e4", type: "craft", title: "Example weekend", short: "", date: day(-1), endDate: day(1), start: "10:00", end: "16:00", room: "SAC Caucus Room", full: false };
  given(fakeConnect(reply([days])));
  const all = Object.values((await eventSections("pg-craft-nights", { today: TODAY })).blocks).join("");
  assert.match(all, /Example weekend/);
  assert.match(all, new RegExp(`data-until="${day(1)}"`));
  const res = await get("/api/calendar/connect-e4.ics", {});
  assert.equal(res.status, 200);
  assert.match(await res.text(), new RegExp(`DTEND:${day(1).replace(/-/g, "")}T`));
});

test("unknown event times cannot create calendar files in the build or current API", async () => {
  const event = { ...craft("unknown-time", "Example Unknown Duration", 1), end: null };
  const cfg = fakeConnect(reply([event]));
  given(cfg);
  assert.equal(await calendarFile("connect-unknown-time", { today: TODAY }), null);
  const out = path.join(ROOT, "local", "test-build-unknown-time");
  const report = await build({ production: true, feedRules: { ...JSON.parse(fs.readFileSync(path.join(ROOT, "content/connect-feed.json"))), exports: { team: false, wall: false } }, connectConfig: cfg.cfg, out, serverDir: path.join(out, "_server"), media: false, today: TODAY });
  assert.deepEqual(report.calendar, []);
  assert.ok(!fs.existsSync(path.join(out, "calendar", "connect-unknown-time.ics")));
  assert.doesNotMatch(read(out, "join/craft-nights/index.html"), /href="[^"]*calendar\/connect-unknown-time\.ics/);
});

/* Each running copy of the API holds Connect's list up to a minute. Refresh now runs in one copy; every other copy must
   ask Connect again, or it draws the list from before the refresh into the answers the refresh has just cleared. This
   file's import is the copy that took Refresh now, and a second import of the same module is another copy: the store is
   the one thing they share. */
test("item 9 (b): after Refresh now in one copy, another copy asks Connect again and shows Connect's list now", async () => {
  const other = await import("../netlify/lib/live-events.mjs?copy=other");
  const before = fakeConnect(PUBLISHED);
  given(before);
  other.forgetEvents();
  const shows = async (copy) => Object.values((await copy.eventSections("pg-craft-nights", { today: TODAY })).blocks).join("");
  assert.match(await shows(other), /Example night one/, "the other copy holds the published list");
  assert.match(await shows(liveEvents), /Example night one/);
  assert.equal(before.calls.length, 2, "each copy asked Connect once");

  const after = fakeConnect(LATER);
  useConnect(after.cfg);
  await liveEvents.forgetEventsEverywhere();
  const now = await shows(other);
  assert.match(now, /Example night added later/, "the other copy shows Connect's list as it is after the refresh");
  assert.doesNotMatch(now, /Example night one/);
  assert.deepEqual(after.calls, ["publicEvents"], "it asked Connect once");
  await shows(other);
  assert.deepEqual(after.calls, ["publicEvents"], "and then holds the new list as before");
});

/* The note lives in the revision's store. When that store cannot be read, a copy keeps using the list it holds, so
   Connect is asked no more often than before. */
test("item 9 (b): when the refresh note cannot be read, a copy uses the list it holds and asks Connect no more often", async () => {
  const connect = fakeConnect(PUBLISHED);
  given(connect);
  const store = memoryStore();
  let down = false;
  useStore({ kind: "flaky", get: (k) => (down ? Promise.reject(new Error("store down")) : store.get(k)), set: (k, v) => store.set(k, v) });
  await eventSections("pg-home", { today: TODAY });
  down = true;
  const r = await quietly(() => eventSections("pg-craft-nights", { today: TODAY }));
  assert.match(Object.values(r.blocks).join(""), /Example night one/);
  await quietly(() => eventSections("pg-home", { today: TODAY }));
  assert.deepEqual(connect.calls, ["publicEvents"], "asked once in the minute, as before");
});

/* The browser asks the CDN each time, so a reload after a save or Refresh now shows the answer the CDN holds now, never
   one the browser kept from before. */
test("item 9 (c): the browser keeps no event answer or calendar file, from Connect's list or from the published one", async () => {
  given(fakeConnect(PUBLISHED));
  for (const [p, headers] of [["/api/events/pg-home", undefined], ["/api/calendar/connect-e1.ics", {}]]) {
    const res = await get(p, headers);
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate", p);
    assert.match(res.headers.get("netlify-cdn-cache-control"), /s-maxage=300/, `${p}: the CDN still holds it five minutes`);
  }
  given(fakeConnect(LATER, { fail: true }));
  const stale = await quietly(() => get("/api/events/pg-home"));
  assert.equal(stale.headers.get("cache-control"), "public, max-age=0, must-revalidate", "(the published list)");
  assert.equal(stale.headers.get("netlify-cdn-cache-control"), "public, s-maxage=30", "the CDN still holds it half a minute");
});

test("item 17: an outage uses the last successful public read even in another cold instance", async () => {
  given(fakeConnect(LATER));
  const before = await eventSections("pg-craft-nights", { today: TODAY });
  assert.match(Object.values(before.blocks).join(""), /Example night added later/);
  assert.match(JSON.stringify((await noteGet("events-last-good")).events), /Example night added later/, "the raw last-good source remains available for historical use");
  useConnect(fakeConnect(PUBLISHED, { fail: true }).cfg);
  const cold = await import("../netlify/lib/live-events.mjs?cold-last-good");
  const after = await quietly(() => cold.eventSections("pg-craft-nights", { today: TODAY }));
  assert.equal(after.stale, true);
  assert.match(Object.values(after.blocks).join(""), /couldn’t confirm the current event schedule/);
  assert.doesNotMatch(Object.values(after.blocks).join(""), /href="[^\"]*calendar\//);
  assert.doesNotMatch(Object.values(after.blocks).join(""), /Example night one/);
});

test("server-rendered event pages and private previews read current Connect events without JavaScript", async () => {
  given(fakeConnect(LATER));
  let res = await handlePage(new Request(ORIGIN + "/join/craft-nights/"), { today: TODAY });
  assert.equal(res.status, 200);
  let body = await res.text();
  assert.match(body, /Example night added later/);
  assert.doesNotMatch(body, /Example night one/);
  res = await previewResponse("pg-craft-nights", { edits: {}, structure: null, today: TODAY });
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(await res.text(), /Example night added later/);
  useConnect(fakeConnect(PUBLISHED, { fail: true }).cfg);forgetEvents();
  res = await quietly(() => handlePage(new Request(ORIGIN + "/join/craft-nights/"), { today: TODAY }));
  assert.equal(res.headers.get("cache-control"), "no-store");
  body = await res.text();assert.match(body, /couldn’t confirm the current event schedule/);
  assert.doesNotMatch(body.match(/<article[^>]*data-live="next"[\s\S]*?<\/article>/)?.[0] || "", /calendar\//);
});

test("exact end moves today's event out of the live hero and calendar file", async () => {
  given(fakeConnect(reply([craft("e1", "Example ended today", 0),craft("e2", "Example tomorrow", 1)])));
  const now=Date.parse(`${TODAY}T19:30:00${chicagoOffset(TODAY)}`);
  const r=await eventSections("pg-craft-nights",{today:TODAY,now});
  const hero=Object.values(r.blocks).find(b=>b.includes('class="eventhero'));
  assert.doesNotMatch(hero,/Example ended today/);assert.match(hero,/Example tomorrow/);
  assert.equal(await calendarFile("connect-e1",{today:TODAY,now}),null);
});


test("peer first-visit actions use current rooms in refresh, initial HTML and private preview", async () => {
  const changed = { ...reply([]), weekly: [{ id: "peer-visit", title: "Example Peer Visit", weekday: new Date(`${TODAY}T12:00:00Z`).getUTCDay(), start: "17:00", end: "18:00", room: "SAC Caucus Room", from: null, until: null, skip: [] }] };
  const now = Date.parse(`${TODAY}T12:00:00${chicagoOffset(TODAY)}`);
  given(fakeConnect(changed));
  const first = html => html.match(/<div data-live="visit">([\s\S]*?)<\/article><\/div>/)?.[1] || "";
  const r = await eventSections("pg-peer-groups", { today: TODAY, now });
  assert.match(first(r.blocks["b-pg-intro"]), /href="\/directions\/sac-caucus\/"/);
  let res = await handlePage(new Request(ORIGIN + "/join/peer-support-groups/"), { today: TODAY, now });
  assert.equal(res.status, 200);
  assert.match(first(await res.text()), /href="\/directions\/sac-caucus\/"/);
  res = await previewResponse("pg-peer-groups", { edits: {}, structure: null, today: TODAY, now });
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(first(await res.text()), /href="\/directions\/sac-caucus\/"/);
  const ended = await eventSections("pg-peer-groups", { today: TODAY, now: Date.parse(`${TODAY}T18:00:00${chicagoOffset(TODAY)}`) });
  assert.doesNotMatch(ended.blocks["b-pg-intro"], /class="btn visit-action"/);
});

test("peer empty and unavailable schedules remain distinct across API and no-JS HTML", async () => {
  const now = Date.parse(`${TODAY}T12:00:00${chicagoOffset(TODAY)}`);
  given(fakeConnect({ ...reply([]), weekly: [] }));
  const empty = await get("/api/events/pg-peer-groups");
  assert.match((await empty.json()).blocks["b-pg-intro"], /No upcoming peer support group/);
  given(fakeConnect(PUBLISHED, { fail: true }));
  const stale = await quietly(() => eventSections("pg-peer-groups", { today: TODAY, now }));
  assert.equal(stale.stale, true);
  assert.match(stale.blocks["b-pg-intro"], /couldn’t confirm the current schedule/);
  assert.doesNotMatch(stale.blocks["b-pg-intro"], /class="btn visit-action"/);
  const res = await quietly(() => handlePage(new Request(ORIGIN + "/join/peer-support-groups/"), { today: TODAY, now }));
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(await res.text(), /couldn’t confirm the current schedule/);
});


test("Craft current room and calendar agree in API, no-JS HTML and private preview", async () => {
  given(fakeConnect(reply([craft("craft-visit", "Example Craft Visit", 1)])));
  const r = await eventSections("pg-craft-nights", { today: TODAY });
  const hero = r.blocks["b-cn-hero"];
  assert.match(hero, /href="\/directions\/sac-caucus\/" class="btn btn--big"/);
  assert.match(hero, /href="\/api\/calendar\/connect-craft-visit.ics"/);
  const file = await get("/api/calendar/connect-craft-visit.ics", {});
  const ics = await file.text();assert.equal(file.status, 200);assert.match(ics, /SUMMARY:Example Craft Visit/);assert.match(ics, /LOCATION:.*Caucus/);
  let res = await handlePage(new Request(ORIGIN + "/join/craft-nights/"), { today: TODAY });
  assert.match(await res.text(), /href="\/directions\/sac-caucus\/" class="btn btn--big"/);
  res = await previewResponse("pg-craft-nights", { edits: {}, structure: null, today: TODAY });
  assert.equal(res.headers.get("cache-control"), "no-store");assert.match(await res.text(), /href="\/directions\/sac-caucus\/" class="btn btn--big"/);
});

test("Craft unavailable visits recover to current actions while private previews remain honest", async () => {
  given(fakeConnect(PUBLISHED, { fail: true }));
  let r = await quietly(() => eventSections("pg-craft-nights", { today: TODAY }));
  assert.equal(r.stale, true);assert.match(r.blocks["b-cn-hero"], /couldn’t confirm/);assert.doesNotMatch(r.blocks["b-cn-hero"], /href="[^\"]*calendar\/|class="btn btn--big"/);
  let res = await quietly(() => previewResponse("pg-craft-nights", { edits: {}, structure: null, today: TODAY }));
  assert.match(await res.text(), /couldn’t confirm the current event schedule/);
  useConnect(fakeConnect(LATER).cfg);forgetEvents();r = await eventSections("pg-craft-nights", { today: TODAY });
  assert.equal(r.stale, false);assert.match(r.blocks["b-cn-hero"], /Example night added later/);assert.match(r.blocks["b-cn-hero"], /href="\/api\/calendar\/connect-e3.ics"/);
});
