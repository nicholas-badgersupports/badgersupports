import test from "node:test";
import assert from "node:assert/strict";
import { rowsBetween, nextDated } from "../src/render/events.mjs";
import { mapEvents } from "../ops/connect-feed.mjs";
import { eventState } from "../src/shared/event-state.mjs";
import { eventIcs } from "../src/render/ics.mjs";

const source = (date, start, end, extra = {}) => ({ recurring: [], dated: [{ id: "clock", title: "Example Night", date, start, end, ...extra }] });
const row = (...args) => rowsBetween(source(...args), args[0], 1)[0];
const utc = value => new Date(value).toISOString();

test("Chicago conversion uses the event hour on both transition days", () => {
  for (const [date, start, end, a, b] of [
    ["2026-03-08", "00:30", "03:30", "2026-03-08T06:30:00.000Z", "2026-03-08T08:30:00.000Z"],
    ["2026-11-01", "00:30", "02:30", "2026-11-01T05:30:00.000Z", "2026-11-01T08:30:00.000Z"],
  ]) {
    const r = row(date, start, end);
    assert.equal(utc(r.startsAt), a); assert.equal(utc(r.endsAt), b);
    assert.equal(eventState(r, Date.parse(a) - 1), "upcoming");
    assert.equal(eventState(r, Date.parse(a)), "happening");
    assert.equal(eventState(r, Date.parse(b)), "ended");
    const ics = eventIcs(r, { origin: "https://example.org", stamp: "20260101T000000Z" });
    assert.ok(ics.includes(`DTSTART:${a.replace(/[-:]/g, "").replace(".000", "")}`));
    assert.ok(ics.includes(`DTEND:${b.replace(/[-:]/g, "").replace(".000", "")}`));
  }
});

test("dated producer instants survive mapping and disambiguate a repeated hour", () => {
  const r = { id: "repeat", title: "Example Night", date: "2026-11-01", start: "01:15", end: "01:45", startUtc: "2026-11-01T07:15:00Z", endUtc: "2026-11-01T07:45:00Z" };
  const { events } = mapEvents({ events: [r] }, { types: {}, rooms: [] });
  const mapped = rowsBetween(events, r.date, 1)[0];
  assert.equal(utc(mapped.startsAt), "2026-11-01T07:15:00.000Z");
  assert.equal(utc(mapped.endsAt), "2026-11-01T07:45:00.000Z");
  assert.equal(eventState(mapped, Date.parse("2026-11-01T07:30:00Z")), "happening");
  assert.equal(nextDated(events, r.date, 1, null, Date.parse("2026-11-01T07:45:00Z")).length, 0);
});

test("weekly repeated-hour conversion follows the producer's earlier occurrence", () => {
  const r = rowsBetween({ dated: [], recurring: [{ id: "week", title: "Example Group", weekday: 0, start: "01:15", end: "01:45" }] }, "2026-11-01", 1)[0];
  assert.equal(utc(r.startsAt), "2026-11-01T06:15:00.000Z");
  assert.equal(utc(r.endsAt), "2026-11-01T06:45:00.000Z");
});

test("nonexistent and mismatched producer times cannot invent lifecycle or calendar instants", () => {
  const r = row("2026-03-08", "02:30", "03:30", { startUtc: "2026-03-08T07:30:00Z" });
  assert.equal(r.startsAt, null);
  assert.equal(eventState(r, Date.parse("2026-03-08T08:00:00Z")), "unknown");
  assert.throws(() => eventIcs(r, { origin: "https://example.org", stamp: "20260101T000000Z" }));
  const mismatch = row("2026-11-03", "17:00", "18:00", { startUtc: "2026-11-03T17:00:00Z" });
  assert.equal(utc(mismatch.startsAt), "2026-11-03T23:00:00.000Z");
});

test("a missing or reversed end cannot create a misleading calendar file", () => {
  for (const r of [row("2026-11-03", "17:00", null), row("2026-11-03", "18:00", "17:00"), row("2026-11-03", "17:00", "17:00")]) {
    assert.equal(eventState(r, Date.parse("2026-11-03T23:30:00Z")), "unknown");
    assert.throws(() => eventIcs(r, { origin: "https://example.org", stamp: "20260101T000000Z" }));
  }
});

test("a multiday row keeps its original start instant on later days", () => {
  const events = source("2026-10-31", "17:00", "02:30", { endDate: "2026-11-01" });
  const r = rowsBetween(events, "2026-11-01", 1)[0];
  assert.equal(utc(r.startsAt), "2026-10-31T22:00:00.000Z");
  assert.equal(utc(r.endsAt), "2026-11-01T08:30:00.000Z");
  assert.equal(eventState(r, Date.parse("2026-11-01T07:00:00Z")), "happening");
});

test("repeated-hour events are ordered by instant instead of their wall-clock labels", () => {
  const events = { recurring: [], dated: [
    { id: "earlier", title: "Earlier Visit", date: "2026-11-01", start: "01:45", end: "02:30", startUtc: "2026-11-01T06:45:00Z" },
    { id: "later", title: "Later Visit", date: "2026-11-01", start: "01:15", end: "02:30", startUtc: "2026-11-01T07:15:00Z" },
  ] };
  assert.deepEqual(rowsBetween(events, "2026-11-01", 1).map(x => x.event), ["earlier", "later"]);
  assert.equal(nextDated(events, "2026-11-01", 1, null, Date.parse("2026-11-01T06:00:00Z"))[0].event, "earlier");
});
