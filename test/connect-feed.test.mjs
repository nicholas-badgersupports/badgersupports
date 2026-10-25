/* Connect's public lists as the site's events and resources (ops/connect-feed.mjs), read at build
   time through a fake Connect. Every event here is fictional; the resources are the shipped fixture's. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT, loadContent } from "../ops/build.mjs";
import { TEAM_PATH } from "../src/render/team.mjs";
import { feedConfig, feedConfigGaps, feedRuleProblems, mapEvents, mapResources, readConnectFeed, readFeedRules, roomFor } from "../ops/connect-feed.mjs";
import { BLOCKS } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";

const RULES = readFeedRules(ROOT);
const RESOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fixtures/resources.json"), "utf8"));
const TEXT = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text).map(([k, v]) => [k, v.text]));
const WHO = "who-ticked-it-xq7";

const EVENTS = {
  ok: true, schema: 1, version: "ev-1", tz: "America/Chicago", today: "2026-10-20", until: "2026-12-15", unchanged: false,
  weekly: [
    { id: "w1", title: "Example directorate", weekday: 1, start: "17:00", end: "18:00", room: "", from: null, until: null, skip: [] },
    { id: "w2", title: "Example directorate", weekday: 3, start: "18:00", end: "19:00", room: "SAC Caucus Room", from: null, until: null, skip: [] },
  ],
  events: [
    { id: "e1", type: "craft", title: "Craft night: paint an example", short: "Paint an example", date: "2026-10-21", endDate: "2026-10-21", start: "17:30", end: "19:30", room: "SAC Caucus Room", full: true },
    { id: "e2", type: "outreach", title: "Dogs on Call at Example Hall", short: "", date: "2026-10-22", endDate: "2026-10-22", start: "12:00", end: "14:00", room: "Example Hall lounge", full: false },
    { id: "e3", type: "hub", title: "Housing Hub drop-in", short: "", date: "2026-10-23", endDate: "2026-10-23", start: "13:00", end: "15:00", room: "Student Mental Health Hub, Student Activity Center 3203", full: false },
    { id: "e4", type: "workshop", title: "Example workshop with no time yet", short: "", date: "2026-10-24", endDate: "2026-10-24", start: "", end: "", room: "", full: false },
  ],
};
const RESOURCE_REPLY = { ok: true, schema: 1, catalogVersion: "cat-1", sourceUpdatedAt: RESOURCES.sourceUpdatedAt, publication: { updatedBy: WHO }, unchanged: false, resources: RESOURCES.resources };

/* A fake Connect: answers the two public actions and records what it was sent. */
function fakeConnect({ events = EVENTS, resources = RESOURCE_REPLY, fail = null } = {}) {
  const calls = [];
  return {
    calls,
    cfg: {
      url: "https://connect.test", keyId: "test-key", secret: "x".repeat(40),
      fetch: async (url, init) => {
        calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        if (fail === "unreachable") throw new Error("offline");
        const action = JSON.parse(init.body).action;
        return { json: async () => (fail === "refused" ? { ok: false } : action === "publicEvents" ? events : resources) };
      },
    },
  };
}

const section = (page, id) => {
  const m = page.match(new RegExp(`<section [^>]*data-block="${id}"[^>]*>([\\s\\S]*?)</section>`));
  assert.ok(m, `section ${id}`);
  return m[0];
};

test("the rules file names only rooms the site has", () => {
  assert.deepEqual(feedRuleProblems(RULES, loadContent().places), []);
  assert.match(feedRuleProblems({ ...RULES, rooms: [{ place: "nowhere", words: ["x"] }] }, loadContent().places).join(), /"nowhere" is not a room/);
  assert.match(feedRuleProblems({ ...RULES, types: { craft: { program: "knitting" } } }, {}).join(), /program is peer, craft/);
});

test("Connect's room words find the site's room, whole words only, longest phrase first", () => {
  assert.equal(roomFor(RULES, "Student Mental Health Hub, Student Activity Center 3203"), "sac-mhh");
  assert.equal(roomFor(RULES, "SAC Caucus Room"), "sac-caucus");
  assert.equal(roomFor(RULES, "Tripp Commons"), "memorial-union-tripp");
  assert.equal(roomFor(RULES, "Strippcommons"), null, "part of a word is not the word");
  assert.equal(roomFor(RULES, "Hearing Room"), null, "a room name shared by other buildings needs the building");
  const two = { rooms: [{ place: "a", words: ["hub"] }, { place: "b", words: ["mental health hub"] }] };
  assert.equal(roomFor(two, "The Mental Health Hub"), "b");
});

test("events become rows: program by type, series by title, room by words, and nothing is a sign-up", () => {
  const { events, dropped } = mapEvents(EVENTS, RULES);
  const by = Object.fromEntries(events.dated.map((e) => [e.id, e]));
  assert.deepEqual(Object.keys(by), ["connect-e1", "connect-e2", "connect-e3"]);
  assert.deepEqual(dropped, ["event e4 (2026-10-24): no start time"]);

  assert.equal(by["connect-e1"].program, "craft");
  assert.equal(by["connect-e1"].href, "/join/craft-nights");
  assert.equal(by["connect-e1"].place, "sac-caucus");
  assert.equal(by["connect-e1"].signup, "none", "a full event is full of volunteers, not closed to visitors");
  assert.equal(by["connect-e1"].short, "Paint an example");

  assert.equal(by["connect-e2"].series, "dogs-on-call");
  assert.equal(by["connect-e2"].program, "other");
  assert.equal(by["connect-e2"].href, "/initiatives/dogs-on-call");
  assert.equal(by["connect-e2"].short, "Dogs on Call at Example Hall", "no short title: the title");
  assert.deepEqual(events.rooms[by["connect-e2"].place], { name: "Example Hall lounge", detail: "", href: null }, "words that name no room are shown as written, unlinked");

  assert.equal(by["connect-e3"].series, "housing-hub");
  assert.equal(by["connect-e3"].place, "sac-mhh");

  assert.deepEqual(events.recurring.map((r) => [r.id, r.program, r.title, r.weekday, r.place, r.href]), [
    ["connect-weekly-w1", "peer", "Peer support group", 1, "sac-mhh", "/join/peer-support-groups"],
    ["connect-weekly-w2", "peer", "Peer support group", 3, "sac-caucus", "/join/peer-support-groups"],
  ], "a weekly group with no room meets at the Hub");
  assert.equal(events.fixture, false);
});

test("a bad row is left out and named, never guessed", () => {
  const { events, dropped } = mapEvents({ events: [{ id: "a", title: "T", date: "next week", start: "17:00" }, { id: "b", title: "", date: "2026-10-21", start: "17:00" }], weekly: [{ id: "c", weekday: 9, start: "17:00" }] }, RULES);
  assert.deepEqual(events.dated, []);
  assert.deepEqual(events.recurring, []);
  assert.equal(dropped.length, 3);
});

test("an event id that cannot be a calendar file name is left out, never written outside the site", () => {
  const ev = (id) => ({ id, title: "T", date: "2026-10-21", start: "17:00" });
  const { events, dropped } = mapEvents({ events: [ev("x/../../../escape"), ev("1\r\nATTACH:https://example.invalid/x"), ev("a.b"), ev("x".repeat(113)), ev("ok_Id-1")], weekly: [] }, RULES);
  assert.deepEqual(events.dated.map((r) => r.id), ["connect-ok_Id-1"]);
  assert.equal(dropped.length, 4);
  assert.ok(dropped.every((d) => !/[\r\n]/.test(d)), "a dropped id is named without its line breaks");
});

test("resources keep Connect's list and never who approved it", () => {
  const out = mapResources(RESOURCE_REPLY);
  assert.equal(out.resources.length, RESOURCES.resources.length);
  assert.equal(out.fixture, false);
  assert.doesNotMatch(JSON.stringify(out), new RegExp(WHO));
});

test("reading Connect: signed, and a problem in words when it cannot", async () => {
  const ok = fakeConnect();
  const feed = await readConnectFeed(ok.cfg, RULES);
  assert.equal(feed.problem, undefined);
  assert.deepEqual(ok.calls.map((c) => c.body.action), ["publicEvents", "publicResourceExport"]);
  for (const c of ok.calls) {
    assert.equal(c.url, "https://connect.test/api");
    assert.equal(c.headers["x-public-key-id"], "test-key");
    assert.match(c.headers["x-public-signature"], /^[A-Za-z0-9_-]{43}$/);
  }
  assert.deepEqual(feed.version, { events: "ev-1", resources: "cat-1" });

  assert.match((await readConnectFeed(null, RULES)).problem, /CONNECT_URL/);
  assert.match((await readConnectFeed(fakeConnect({ fail: "unreachable" }).cfg, RULES)).problem, /connect\.unreachable/);
  assert.match((await readConnectFeed(fakeConnect({ fail: "refused" }).cfg, RULES)).problem, /connect\.refused/);
  assert.match((await readConnectFeed(fakeConnect({ events: { ok: true, schema: 2 } }).cfg, RULES)).problem, /schema 1/);

  assert.match((await readConnectFeed(null, RULES, { CONNECT_URL: "https://connect.test", PUBLIC_SITE_SERVICE_KEY_ID: "k" })).problem, /\(PUBLIC_SITE_SERVICE_SECRET is missing/);
  assert.deepEqual(feedConfigGaps({}), ["CONNECT_URL is missing", "PUBLIC_SITE_SERVICE_KEY_ID is missing", "PUBLIC_SITE_SERVICE_SECRET is missing (on the laptop the publish file passes it as PUBLISH_SERVICE_SECRET)"]);
  assert.deepEqual(feedConfigGaps({ CONNECT_URL: "https://connect.test/a", PUBLIC_SITE_SERVICE_KEY_ID: "k", PUBLIC_SITE_SERVICE_SECRET: "short" }), ["CONNECT_URL is not an address such as https://connect.example.org", "PUBLIC_SITE_SERVICE_SECRET is shorter than 32 characters (on the laptop the publish file passes it as PUBLISH_SERVICE_SECRET)"]);
  assert.deepEqual(feedConfigGaps({ PUBLIC_SITE_SERVICE_SECRET: "y".repeat(32), PUBLISH_SERVICE_SECRET: "short" }).slice(-1), ["PUBLIC_SITE_SERVICE_SECRET is shorter than 32 characters"]);
  assert.doesNotMatch(feedConfigGaps({ PUBLIC_SITE_SERVICE_SECRET: "short-secret-value" }).join(" "), /short-secret-value/);
  assert.deepEqual(feedConfigGaps({ CONNECT_URL: "https://connect.test/", PUBLIC_SITE_SERVICE_KEY_ID: "k", PUBLIC_SITE_SERVICE_SECRET: "y".repeat(32) }), []);
  assert.equal(feedConfig({}), null);
  // Netlify's short stand-in for a secret loses to the key the publish file passes under its own name.
  const laptop = { CONNECT_URL: "https://connect.test", PUBLIC_SITE_SERVICE_KEY_ID: "k", PUBLIC_SITE_SERVICE_SECRET: "stand-in" };
  assert.equal(feedConfig(laptop), null);
  assert.equal(feedConfig({ ...laptop, PUBLISH_SERVICE_SECRET: "p".repeat(64) }).secret, "p".repeat(64));
  assert.deepEqual(feedConfigGaps({ ...laptop, PUBLISH_SERVICE_SECRET: "p".repeat(64) }), []);
  assert.equal(feedConfig({ CONNECT_URL: "https://connect.test", PUBLIC_SITE_SERVICE_KEY_ID: "k", PUBLIC_SITE_SERVICE_SECRET: "short" }), null);
  assert.equal(feedConfig({ CONNECT_URL: "https://connect.test/", PUBLIC_SITE_SERVICE_KEY_ID: "k", PUBLIC_SITE_SERVICE_SECRET: "y".repeat(32) }).url, "https://connect.test");
});

test("Connect's recent events fill a page's Recent list; a Connect that sends none leaves it hidden", () => {
  const night = (id, date, title) => ({ id, type: "craft", title, short: "", date, endDate: date, start: "17:30", end: "19:30", room: "SAC Caucus Room", full: false });
  const recent = [night("r1", "2026-10-14", "Craft night: an example that happened"), night("r2", "2026-10-20", "Craft night: dated today"), { ...EVENTS.events[0] }];
  const { events, dropped } = mapEvents({ ...EVENTS, recent }, RULES);
  assert.deepEqual(events.dated.map((e) => e.id), ["connect-e1", "connect-e2", "connect-e3", "connect-r1"]);
  assert.ok(dropped.includes("event r2 (2026-10-20): listed as recent but not before today"));
  assert.ok(dropped.includes("event e1 (2026-10-21): listed twice"));

  const block = { id: "b-cn-recent", type: "events", title: "Recent Craft Nights", source: "events", program: "craft", show: "recent", recent: 4 };
  const render = (src) => String(BLOCKS.events.render(block, makeContext({ site: {}, media: { items: [] }, data: { events: { ...src, places: {} } }, text: TEXT, today: "2026-10-20" })));
  const shown = render(events);
  assert.match(shown, /an example that happened/);
  assert.match(shown, /class="evcard is-recent"/);
  assert.doesNotMatch(shown, /evcard-cal|paint an example/i, "a night that happened has no calendar button, and nothing to come is listed");
  assert.equal(render(mapEvents(EVENTS, RULES).events), '<section data-block="b-cn-recent" hidden></section>');
});

test("a week with nothing on says so", () => {
  const ctx = makeContext({ site: {}, media: { items: [] }, data: { events: { recurring: [], dated: [], places: {} } }, text: TEXT, today: "2026-10-20" });
  const out = String(BLOCKS.schedule.render({ id: "b-x", type: "schedule", title: "This week", source: "events" }, ctx));
  assert.match(out, /class="week-empty"/);
  assert.ok(out.includes(TEXT["schedule.none"]));
  assert.doesNotMatch(out, /class="days"/);
});

test("a production build with no way to reach Connect builds nothing and leaves the last build alone", async () => {
  const out = path.join(ROOT, "local", "test-build-noconnect");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "keep.txt"), "the last build");
  await assert.rejects(build({ production: true, connectConfig: null, out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-20" }), /Connect: .*Nothing was built/);
  await assert.rejects(build({ production: true, connectConfig: fakeConnect({ fail: "unreachable" }).cfg, out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-20" }), /Nothing was built/);
  assert.equal(fs.readFileSync(path.join(out, "keep.txt"), "utf8"), "the last build");
});

test("the published site shows Connect's events, each page its own, and no sample people or notes", async () => {
  const out = path.join(ROOT, "local", "test-build-connect");
  const said = [];
  const report = await build({ production: true, connectConfig: fakeConnect().cfg, out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-20", log: (s) => said.push(s) });
  const read = (p) => fs.readFileSync(path.join(out, p), "utf8");
  assert.deepEqual({ ...report.connect, dropped: report.connect.dropped.length }, { events: 3, weekly: 2, resources: RESOURCES.resources.length, dropped: 1, version: { events: "ev-1", resources: "cat-1" } });
  assert.ok(said.some((s) => s.includes("left out event e4")), "the build says what it left out");

  const week = section(read("index.html"), "b-home-week");
  assert.match(week, /Paint an example|Craft night: paint an example/);
  assert.match(week, /Dogs on Call at Example Hall/);
  assert.match(week, /Example Hall lounge/);
  assert.doesNotMatch(week, /href="[^"]*Example Hall/, "an unknown room has no link");
  assert.match(week, /Peer support group/);
  assert.doesNotMatch(week, /make a bracelet/i, "nothing from the hand-typed list");

  const dogs = section(read("initiatives/dogs-on-call/index.html"), "b-dc-hero");
  assert.match(dogs, /Dogs on Call at Example Hall/);
  assert.doesNotMatch(dogs, /Housing Hub|paint an example/i, "the page's own series only");
  const housing = section(read("initiatives/housing-hub/index.html"), "b-hh-hero");
  assert.match(housing, /Housing Hub drop-in/);
  assert.doesNotMatch(housing, /Dogs on Call/);
  assert.match(section(read("join/craft-nights/index.html"), "b-cn-hero"), /Paint an example/);

  for (const p of report.pages) {
    const file = p.path.endsWith(".html") ? p.path.slice(1) : path.join(p.path, "index.html");
    assert.doesNotMatch(read(file), new RegExp(WHO), `${p.path}: who approved the list`);
  }
  assert.ok(!report.pages.some((p) => p.path.startsWith(TEAM_PATH) && p.path !== TEAM_PATH), "no sample person has a page");
  const prototype = loadContent();
  assert.ok(prototype.pages.some((p) => p.path.startsWith(TEAM_PATH) && p.path !== TEAM_PATH), "(the prototype has them, so the check above means something)");

  // With nobody published, the team page says so once, and an empty group's heading is left out.
  const team = read(path.join(TEAM_PATH.slice(1), "index.html"));
  assert.equal(team.match(/class="team-none"/g)?.length, 1);
  assert.doesNotMatch(team, /Advisors &amp; Campus Partners<\/h2>/);

  // The live site, not a prototype: no notice saying so, and open to search engines.
  assert.doesNotMatch(read("index.html"), /class="proto"|noindex/);
  assert.doesNotMatch(read("robots.txt"), /Disallow: \/\s*$/m);
  // Crawler policy (X3): robots.txt asks for a From address and points at the page that says so; it names no
  // private address beyond the two whole areas, and the sitemap lists the policy page.
  const robots = read("robots.txt");
  assert.match(robots, /^# Crawlers: please send a working email address in the HTTP From header \(https:\/\/[^)]+\/crawlers\/\)\.$/m);
  assert.deepEqual(robots.match(/^Disallow: .*$/gm), ["Disallow: /staff/", "Disallow: /api/"]);
  assert.match(read("sitemap.xml"), /<loc>[^<]+\/crawlers\/<\/loc>/);
  assert.match(read("crawlers/index.html"), /HTTP From header/);
});

/* Connect sends each event's endDate (Exchange PUBLIC-EVENTS-RECENT-2026-10-23; run log §6). An event that runs over
   several days shows on each of them, names its dates, and leaves once its last day is over. */
test("an event over several days shows on each day it runs, names its dates, and leaves once it has ended", async () => {
  const weekend = { id: "e5", type: "craft", title: "Craft night: an example weekend", short: "An example weekend", date: "2026-10-23", endDate: "2026-10-25", start: "10:00", end: "16:00", room: "SAC Caucus Room", full: false };
  const { events, dropped } = mapEvents({ ...EVENTS, events: [weekend] }, RULES);
  assert.deepEqual(dropped, []);
  assert.equal(events.dated[0].endDate, "2026-10-25");

  const ctx = (today) => makeContext({ site: {}, media: { items: [] }, data: { events: { ...events, places: {} } }, text: TEXT, today });
  const week = String(BLOCKS.schedule.render({ id: "b-w", type: "schedule", title: "This week", source: "events" }, ctx("2026-10-24")));
  const days = [...week.matchAll(/<li class="day[^"]*" data-date="([\d-]+)">[\s\S]*?<\/ul><\/div><\/li>/g)].filter((m) => /An example weekend|an example weekend/i.test(m[0])).map((m) => m[1]);
  assert.deepEqual(days, ["2026-10-24", "2026-10-25"], "on each day it still runs, from today");
  assert.match(week, /data-ends="2026-10-25T16:00:00-05:00"/, "it ends on its last day");
  const across = String(BLOCKS.schedule.render({ id: "b-w", type: "schedule", title: "This week", source: "events" }, ctx("2026-10-17")));
  assert.equal(across.match(/An example weekend/gi)?.length, 1, "one that starts in the week and ends after it is in the week, not again under Coming Up");

  const cards = (today) => String(BLOCKS.events.render({ id: "b-c", type: "events", title: "Craft", source: "events", program: "craft" }, ctx(today)));
  const during = cards("2026-10-24");
  assert.match(during, /class="evcard"[^>]*data-ends="2026-10-25T16:00:00-05:00"/, "still to come on its second day");
  assert.ok(during.includes(`${TEXT["date.dow.5"]} ${TEXT["date.mon.9"]} 23`) && during.includes(`${TEXT["date.dow.0"]} ${TEXT["date.mon.9"]} 25`), "the card names its first and last day");
  assert.match(during, /today-tag/, "its second day is today");
  assert.doesNotMatch(cards("2026-10-26"), /class="evcard"[^>]*data-ends/, "gone from what is to come the day after it ends");
  assert.match(cards("2026-10-26"), /An example weekend/, "and listed with what has happened");
  assert.doesNotMatch(String(BLOCKS.events.render({ id: "b-c", type: "events", title: "Craft", source: "events", program: "craft", show: "recent" }, ctx("2026-10-25"))), /An example weekend/, "not recent while it still runs");

  // Connect's `recent` list: an event still running is not recent yet.
  const notOver = mapEvents({ ...EVENTS, today: "2026-10-24", events: [], recent: [weekend] }, RULES);
  assert.deepEqual(notOver.dropped, ["event e5 (2026-10-23): listed as recent but not over before today"]);
  // An end before the start, or a month away, is not believed: the event shows on its first day, and the build says so.
  const odd = mapEvents({ ...EVENTS, events: [{ ...weekend, endDate: "2026-10-20" }, { ...weekend, id: "e6", endDate: "2027-01-10" }] }, RULES);
  assert.deepEqual(odd.events.dated.map((e) => e.endDate), [undefined, undefined]);
  assert.equal(odd.dropped.length, 2);
  assert.match(odd.dropped.join(" "), /e5 .*end date 2026-10-20 .*first day only/);

  // The published files: a calendar file that ends on the last day, written while the event still runs.
  const out = path.join(ROOT, "local", "test-build-connect-days");
  await build({ production: true, connectConfig: fakeConnect({ events: { ...EVENTS, today: "2026-10-24", events: [weekend] } }).cfg, out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-24", log: () => {} });
  const ics = fs.readFileSync(path.join(out, "calendar", "connect-e5.ics"), "utf8");
  assert.match(ics, /DTSTART:20261023T150000Z/);
  assert.match(ics, /DTEND:20261025T210000Z/);
});
