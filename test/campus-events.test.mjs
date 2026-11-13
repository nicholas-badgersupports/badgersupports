/* EXPLORE-A-EVENTS (WORK item 41): the two external feeds become explorer events, a listing in
 * both feeds renders once with both source links, a field the source does not state stays absent,
 * and a failed feed keeps the last good data (the failure half lives in the lib test below through
 * fetchCampusEvents' report). Fixtures are trimmed copies of the real feeds, read 11 Nov 2026. */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { parseUwEvent, parseUnionFeed, countUnionTitles, mergeCampusEvents, fromConnectRows, fetchCampusEvents, fixtureCampusEvents } from "../ops/campus-feed.mjs";
import { canonicalPlaceName } from "../src/shared/place-names.mjs";

const uwRows = JSON.parse(fs.readFileSync(new URL("./fixtures/campus-uw.json", import.meta.url), "utf8"));
const unionXml = fs.readFileSync(new URL("./fixtures/campus-union.xml", import.meta.url), "utf8");

test("the UW fixture parses: instants kept, unstated cost absent, stated cost kept", () => {
  const parsed = uwRows.map((r) => parseUwEvent(r));
  assert.ok(parsed.every((r) => r.event), JSON.stringify(parsed));
  const free = parsed.map((r) => r.event).find((e) => e.id === `uw-${uwRows[0].id}`);
  assert.equal(free.cost, null);
  const priced = parsed.map((r) => r.event).find((e) => e.cost);
  assert.ok(priced, "one fixture event states a cost");
  assert.equal(priced.cost, uwRows.find((r) => r.id === Number(priced.id.slice(3))).cost);
  for (const e of parsed.map((r) => r.event)) {
    assert.ok(Number.isFinite(Date.parse(e.start)), e.id);
    assert.equal(e.sources[0].source, "uw");
    assert.equal(e.status, null, "UW states no status, so none is shown");
  }
});

test("the Union fixture parses: sold out only where the source states it", () => {
  const { events, dropped } = parseUnionFeed(unionXml);
  assert.equal(dropped.length, 0, dropped.join("; "));
  assert.equal(events.length, 3);
  const sold = events.find((e) => e.status === "soldOut");
  assert.ok(sold, "the fixture has a sold-out event");
  assert.equal(sold.cost, "$210.00");
  const quiet = events.find((e) => e.title.startsWith("Thanksgiving"));
  assert.equal(quiet.status, null, "status None in the feed is no status on the card");
  assert.equal(quiet.cost, null, "an empty cost in the feed is no cost on the card");
  assert.ok(events.every((e) => Number.isFinite(Date.parse(e.start))));
});

test("a listing in both feeds renders one card with both source links", () => {
  const { events: union } = parseUnionFeed(unionXml);
  const u = union[0];
  const asUw = parseUwEvent({
    id: 999001, title: u.title, description: "", startDate8601: u.start, endDate8601: u.end,
    allDayEvent: false, cost: "", url: "https://today.wisc.edu/events/view/999001", sponsor: "Wisconsin Union",
    tags: [], location: u.place, building: { name: u.place },
  }).event;
  const { events } = mergeCampusEvents({ uw: [asUw], union: [u] }, { from: "2026-01-01", to: "2027-12-31" });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].sources.map((s) => s.source).sort(), ["union", "uw"]);
  assert.equal(events[0].cost, "$210.00", "the merged card keeps the cost the Union stated");
});

test("Badger Supports rows keep their own source and never merge into an external listing", () => {
  const rows = [{ event: "ev1", title: "Craft Night", short: "Craft Night", startsAt: "2026-11-12T18:00:00-06:00", endsAt: "2026-11-12T20:00:00-06:00", place: { name: "Student Mental Health Hub" }, href: "/craft-nights/", program: "craft", tagline: null }];
  const badger = fromConnectRows(rows);
  assert.equal(badger.length, 1);
  assert.equal(badger[0].badger, true);
  const { events } = mergeCampusEvents({ badger }, { from: "2026-11-01", to: "2026-12-31" });
  assert.equal(events.length, 1);
  assert.equal(events[0].sources[0].name, "Badger Supports");
});

test("the window keeps what runs into it and drops what is over", () => {
  const base = { id: "x", title: "Old", start: "2026-10-01T10:00:00-05:00", end: "2026-10-01T11:00:00-05:00", allDay: false, place: null, organizer: null, sources: [{ source: "uw", name: "UW", url: null }], cost: null, status: null, tags: [], categories: [], blurb: null, badger: false };
  const running = { ...base, id: "y", title: "Running", start: "2026-10-30T10:00:00-05:00", end: "2026-11-20T11:00:00-06:00" };
  const { events } = mergeCampusEvents({ uw: [base, running] }, { from: "2026-11-11", to: "2026-12-31" });
  assert.deepEqual(events.map((e) => e.id), ["y"]);
});

test("a failed feed is named in the report; both failing throws", async () => {
  const ok = async (url) => url.includes("today.wisc.edu")
    ? { ok: true, json: async () => uwRows }
    : { ok: true, text: async () => unionXml };
  const r = await fetchCampusEvents({ fetchImpl: ok, today: "2026-11-11" });
  assert.ok(r.events.length >= 3);
  assert.equal(r.report.read.unionTitles, 3);
  const oneDown = async (url) => { if (url.includes("union.wisc.edu") && url.endsWith("feed")) throw new Error("down"); return ok(url); };
  const r2 = await fetchCampusEvents({ fetchImpl: oneDown, today: "2026-11-11" });
  assert.ok(r2.report.dropped.some((d) => d.includes("Union feed could not be read")), r2.report.dropped.join("; "));
  await assert.rejects(() => fetchCampusEvents({ fetchImpl: async () => { throw new Error("down"); }, today: "2026-11-11" }));
});

test("the prototype fixture spans the three sources and starts today", () => {
  const events = fixtureCampusEvents("2026-11-11");
  assert.deepEqual([...new Set(events.flatMap((e) => e.sources.map((s) => s.source)))].sort(), ["badger", "union", "uw"]);
  assert.ok(events[0].start.startsWith("2026-11-11"));
});

test("feed_1's count is read from its titles", () => {
  assert.equal(countUnionTitles("<feed><event><event_title>A</event_title></event><event><event_title>B</event_title></event></feed>"), 2);
});

test("a place entered by its short name is the Student Mental Health Hub", () => {
  assert.equal(canonicalPlaceName("S-MHH"), "Student Mental Health Hub");
  assert.equal(canonicalPlaceName("smhh"), "Student Mental Health Hub");
  assert.equal(canonicalPlaceName("S-MHH, Student Activity Center"), "Student Mental Health Hub, Student Activity Center");
  assert.equal(canonicalPlaceName("Memorial Union"), "Memorial Union", "other places are as written");
  assert.equal(canonicalPlaceName(null), null, "no place stated stays no place");

  const at = (place) => parseUwEvent({
    id: 999002, title: "Example at the Hub", description: "", startDate8601: "2026-11-12T17:00:00-06:00", endDate8601: "2026-11-12T18:00:00-06:00",
    allDayEvent: false, cost: "", url: "", sponsor: "Example", tags: [], location: place, building: { name: place },
  }).event;
  const { events } = mergeCampusEvents({ uw: [at("S-MHH")] }, { from: "2026-11-01", to: "2026-12-31" });
  assert.equal(events.length, 1);
  assert.equal(events[0].place, "Student Mental Health Hub", "the merged list carries the full name");

  const both = mergeCampusEvents({ uw: [at("S-MHH"), at("Student Mental Health Hub")] }, { from: "2026-11-01", to: "2026-12-31" });
  assert.equal(both.events.length, 1, "the two writings of the one room are one listing");
});

/* The explorer block as rendered (events fixes, 12 Nov 2026): the list carries a Show More row
 * for the stepped reveal, a toggle that limits the list to Badger Supports' own events, and no
 * interest chip styled apart from the others. */
import { makeContext } from "../src/render/context.mjs";
import { renderBlock } from "../src/render/registry.mjs";
import { resolveText } from "../src/shared/text.mjs";

const registry = JSON.parse(fs.readFileSync(new URL("../content/text.json", import.meta.url), "utf8"));
const interestsFile = JSON.parse(fs.readFileSync(new URL("../content/explore/interests.json", import.meta.url), "utf8"));
const explorerHtml = () => {
  const ctx = makeContext({
    site: {}, media: { items: [] }, today: "2026-11-11",
    text: resolveText(registry),
    data: {
      campusEvents: { events: fixtureCampusEvents("2026-11-11"), updated: null, stale: false },
      campusInterests: interestsFile,
    },
  });
  return String(renderBlock({ id: "b-ce-explorer", type: "exploreevents", title: "What is on", count: 40 }, ctx));
};

test("the explorer renders a Show More row and a Badger Supports toggle, both at rest", () => {
  const out = explorerHtml();
  assert.match(out, /data-ce-more-row hidden/);
  assert.match(out, /<button type="button" class="btn ce-more-btn" data-ce-more>Show More<\/button>/);
  assert.match(out, /<button type="button" class="ce-badger-toggle" aria-pressed="false" data-ce-badger>All Badger Supports events<\/button>/);
});

test("Find Your People renders as a plain chip, styled no differently from its siblings", () => {
  const out = explorerHtml();
  assert.ok(!out.includes("ce-chip--people"), "no chip carries a special class");
  assert.match(out, /<button type="button" class="ce-chip" aria-pressed="false" data-ce-interest="people">Find Your People<\/button>/);
  const css = fs.readFileSync(new URL("../src/styles/blocks/exploreevents.css", import.meta.url), "utf8");
  assert.ok(!css.includes("ce-chip--people"), "the stylesheet holds no people-only chip rule");
});

test("the events the Badger Supports toggle gathers are the ones the feed marks as ours", () => {
  const out = explorerHtml();
  assert.equal((out.match(/cecard is-badger/g) || []).length, 1, "exactly the Connect-fed program renders as a Badger Supports card");
  assert.match(out, /Badger Supports program/);
  const own = fixtureCampusEvents("2026-11-11").filter((e) => e.badger);
  assert.deepEqual(own.map((e) => e.sources[0].source), ["badger"], "the toggle's set is the badger:true, source badger set");
});

test("the date block is a calendar square; today is a filled block plus a label in the meta line", () => {
  const out = explorerHtml();
  assert.match(out, /cecard-date is-today/, "today's block carries the filled state");
  assert.match(out, /<span class="cecard-today">Today<\/span>/, "the word Today sits in the card's meta line");
  assert.ok(!out.includes("today-tag"), "no tag is stuffed inside the date block");
  const css = fs.readFileSync(new URL("../src/styles/blocks/exploreevents.css", import.meta.url), "utf8");
  const rule = css.match(/\.cecard-date \{[^}]*\}/)[0];
  assert.match(rule, /border-radius: var\(--r-card\)/, "the block wears the card radius");
  assert.ok(!rule.includes("--r-chip"), "the stadium pill shape does not come back");
});

test("first use (C-23): the explorer's whole set rides in a data file beside the page, not an island in it", () => {
  const ctx = makeContext({
    site: {}, media: { items: [] }, today: "2026-11-11", path: "/explore/events/",
    text: resolveText(registry),
    data: {
      campusEvents: { events: fixtureCampusEvents("2026-11-11"), updated: null, stale: false },
      campusInterests: interestsFile,
    },
  });
  const out = String(renderBlock({ id: "b-ce-explorer", type: "exploreevents", title: "What is on", count: 40 }, ctx));
  assert.match(out, /data-ce-data="\/explore\/events\/events-data\.json"/, "the section names the file beside the page");
  assert.ok(!out.includes("b-ce-explorer-data"), "no JSON island rides in the page");
  assert.equal(ctx.deferred.length, 1, "one file is held back");
  assert.equal(ctx.deferred[0].file, "events-data.json");
  const payload = JSON.parse(ctx.deferred[0].body);
  assert.equal(payload.schema, "bss.events-data/1");
  assert.deepEqual(payload.events, fixtureCampusEvents("2026-11-11"), "the file carries the whole set the island carried");
  assert.deepEqual(payload.interests, interestsFile.interests);
  assert.equal(payload.updated, null);
  assert.equal(payload.stale, false);
  assert.equal(payload.today, "2026-11-11");
});
