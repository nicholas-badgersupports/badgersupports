/* Event cards and the craft nights page. The page is in sections: a red hero with the next night
   and its one big button, what to expect, the schedule after it, the nights that have happened as
   photos, and a closing call. Every event here is fictional. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { BLOCKS } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";

const OUT = path.join(ROOT, "local", "test-build-events");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const section = (page, id) => {
  const m = page.match(new RegExp(`<section [^>]*data-block="${id}"[^>]*>([\\s\\S]*?)</section>`));
  assert.ok(m, `section ${id}`);
  return m[0];
};

const TEXT = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text).map(([k, v]) => [k, v.text]));
const fixtureContext = (src) => makeContext({ site: {}, media: { items: [] }, data: { events: src }, text: TEXT, today: "2026-10-20" });
const PLACES = { "x-room": { name: "Example Room", detail: "Example Hall" } };

test.before(async () => {
  await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

test("the craft nights page is in sections, in order", () => {
  const page = read("join/craft-nights/index.html");
  const order = [...page.matchAll(/<section [^>]*data-block="(b-cn-[a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["b-cn-hero", "b-cn-expect", "b-cn-next", "b-cn-recent", "b-cn-cta", "b-cn-access"]);
  assert.equal([...page.matchAll(/<h1[ >]/g)].length, 1, "one h1, the hero's");
});

test("the hero carries the next night with the page's one big button, Drop in to the room", () => {
  const hero = section(read("join/craft-nights/index.html"), "b-cn-hero");
  assert.match(hero, /<h1 id="b-cn-hero-h">Craft Nights<\/h1>/);
  assert.match(hero, /<article class="evcard is-feature"[^>]*data-date="2026-10-20"/);
  assert.match(hero, /<span class="today-tag">/);
  assert.match(hero, /<a href="\/directions\/sac-caucus\/" class="btn btn--big">/);
  assert.match(hero, /<a class="go" href="\/calendar\/craft-2026-10-20\.ics">/);
  assert.ok(fs.existsSync(path.join(OUT, "calendar/craft-2026-10-20.ics")));
  assert.equal([...hero.matchAll(/<img /g)].length, 3, "three photos of people beside it");
  assert.doesNotMatch(hero, /No sign-up/);
});

test("the schedule after the hero leaves out the night the hero shows", () => {
  const next = section(read("join/craft-nights/index.html"), "b-cn-next");
  assert.doesNotMatch(next, /craft-2026-10-20/);
  assert.match(next, /href="\/calendar\/craft-2026-11-18\.ics"/);
  assert.match(next, /<a href="\/directions\/memorial-union-tripp\/" class="drop">/, "a night in a room with a page drops in to it");
  assert.doesNotMatch(next, /class="btn btn--big"/, "one big button on the page's first screen, not one per card");
});

test("the nights that have happened are their photos, with no actions", () => {
  const recent = section(read("join/craft-nights/index.html"), "b-cn-recent");
  const list = recent.match(/<ol class="evcards evcards--recent"[^>]*>([\s\S]*?)<\/ol>/)[1];
  assert.equal([...list.matchAll(/<li class="evshot"/g)].length, 4);
  assert.equal([...list.matchAll(/<img /g)].length, 4);
  assert.doesNotMatch(list, /evcard-row|\.ics/);
  assert.match(list, /<span class="evshot-date" aria-hidden="true">WED OCT 14<\/span>Decorate a Planter<span class="sr-only">, Wednesday, October 14<\/span>/i);
  assert.ok(!fs.existsSync(path.join(OUT, "calendar/craft-2026-10-14.ics")), "no calendar file for a night that has happened");
});

test("what to expect has its points, and the page closes on one big button", () => {
  const page = read("join/craft-nights/index.html");
  const expect = section(page, "b-cn-expect");
  assert.equal([...expect.matchAll(/<li>/g)].length, 3);
  assert.equal([...expect.matchAll(/class="ic expect-ic"/g)].length, 3);
  const cta = section(page, "b-cn-cta");
  assert.match(cta, /<a href="\/forms\/programming-feedback\/" class="btn btn--big">/);
  assert.match(cta, /class="go go--light"[^>]*>[\s\S]*?Join Our Email List/);
  assert.equal([...cta.matchAll(/class="btn btn--big"/g)].length, 1);
});

test("no event card carries a program colour", () => {
  for (const p of ["join/craft-nights/index.html", "index.html"]) assert.doesNotMatch(read(p), /class="[^"]*\b(?:program|prog)-(?:peer|craft|workshops|other)\b/, p);
});

test("a recent night with no photo keeps a small card, and a block with no photos has no mosaic", () => {
  const src = {
    places: PLACES,
    dated: [
      { id: "x-past", program: "craft", title: "Example Night", date: "2026-10-01", start: "17:30", end: "19:00", place: "x-room" },
      { id: "x-next", program: "craft", title: "Example Night Two", date: "2026-10-30", start: "17:30", end: "19:00", place: "x-room" },
    ],
  };
  const out = String(BLOCKS.events.render({ id: "b-x", type: "events", title: "Example nights", source: "events", program: "craft" }, fixtureContext(src)));
  assert.doesNotMatch(out, /has-mosaic|evlist-mosaic|evshot/);
  assert.match(out, /<li class="evcard is-recent"/);
  assert.match(out, /href="\/calendar\/x-next\.ics"/);
});

test("a split list with nothing to show renders nothing, and a hero with nothing coming says so", () => {
  const only = (date) => ({ places: PLACES, dated: [{ id: "x-1", program: "craft", title: "Example Night", date, start: "17:30", end: "19:00", place: "x-room" }] });
  const future = fixtureContext(only("2026-11-01"));
  assert.equal(String(BLOCKS.events.render({ id: "b-x", type: "events", title: "Recent", source: "events", program: "craft", show: "recent" }, future)), "");
  assert.equal(String(BLOCKS.events.render({ id: "b-x", type: "events", title: "Schedule", source: "events", program: "craft", show: "upcoming", skip: 1 }, future)), "");
  assert.match(String(BLOCKS.events.render({ id: "b-x", type: "events", title: "Schedule", source: "events", program: "craft", show: "upcoming" }, future)),
    /<span class="evcard-chip"><svg class="ic" data-i="pin"[^>]*>(?:(?!<\/svg>)[\s\S])*<\/svg>Drop in<\/span>/, "a room with no page yet keeps the words, unlinked");
  const past = fixtureContext(only("2026-10-01"));
  const hero = String(BLOCKS.eventhero.render({ id: "b-x", type: "eventhero", title: "Example Nights", source: "events", program: "craft" }, past));
  assert.match(hero, /<p class="evlist-none">/);
  assert.doesNotMatch(hero, /is-feature|btn--big/);
});
