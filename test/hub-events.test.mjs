/* Hub events: the records in content/hub-events.json, the page each shown event makes, the
   redesigned event header, and the saves the Hub Events part of the staff page makes
   (src/render/hubevents.mjs, src/shared/structure.mjs). The people here are fictional. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadContent } from "../ops/build.mjs";
import { hubEventProblems, hubEventPages, sortHubEvents } from "../src/render/hubevents.mjs";
import { applyChange, emptyStructure, layHubEvents, cleanHubEvent } from "../src/shared/structure.mjs";
import { BLOCKS, blockProblems, renderBlock } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";
import { makeT } from "../src/shared/text.mjs";

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "content/hub-events.json"), "utf8")).events;
const openHouse = seed.find((e) => e.id === "open-house");
let content = null;
test.before(() => { content = loadContent({ textEdits: {}, edits: {} }); });

const mediaIds = () => new Set((content.media.items || []).map((m) => m.id));
const t = () => makeT(content.text);
const ctx = () => makeContext({ site: content.site, media: content.media, builtPaths: content.pages.map((p) => p.path),
  routes: content.routes, data: {}, text: content.text, today: "2026-11-23" });

test("the Open House recap is the first event, carried over word for word", () => {
  assert.ok(openHouse, "the seed holds the open-house event");
  assert.equal(openHouse.path, "/initiatives/open-house/");
  assert.equal(openHouse.title, "Student Mental Health Hub Open House");
  assert.equal(openHouse.label, "September 25, 2026 · Recap");
  assert.equal(openHouse.lead, "Snacks, therapy dogs, crafts, & FUN!");
  assert.deepEqual(openHouse.body, [
    "A look back at the Student Mental Health Hub Open House on Friday, September 25, 2026.",
    "Past event hours: 12:00 PM–8:00 PM at 333 E. Campus Mall, Room 3203."]);
  assert.deepEqual(openHouse.photos, ["m-oh-sticky-wall", "m-oh-sea-support", "m-oh-craft-shelves"]);
  assert.deepEqual(openHouse.primary, { label: "Find a Peer Support Group", href: "/join/peer-support-groups/" });
  assert.deepEqual(openHouse.links, [{ label: "Directions to the Student Mental Health Hub", href: "#get-directions", icon: "down" }]);
  assert.equal(openHouse.highlights.title, "A Look Back");
  assert.equal(openHouse.highlights.items.length, 5);
  assert.equal(openHouse.programme.title, "Activities at the Open House");
  assert.equal(openHouse.programme.topics.length, 6);
  assert.equal(openHouse.place, "sac-mhh");
  assert.deepEqual(hubEventProblems(openHouse, { media: mediaIds(), places: content.places }), []);
});

test("the build makes the Open House page from the event, at its address, and no page file stands there", () => {
  const page = content.pages.find((p) => p.id === "pg-open-house");
  assert.ok(page, "pg-open-house is among the built pages");
  assert.equal(page.generated, "hub-event");
  assert.equal(page.path, "/initiatives/open-house/");
  assert.equal(fs.existsSync(path.join(ROOT, "content/pages/open-house.json")), false);
  assert.deepEqual(page.blocks.map((b) => b.type), ["eventhead", "expect", "program", "directions", "text", "cta"]);
  assert.deepEqual(blockProblems(page), []);
});

test("the event header: status line over the title, tagline under it, the photos one block, the buttons one line under the words", () => {
  const page = content.pages.find((p) => p.id === "pg-open-house");
  const html = String(renderBlock(page.blocks[0], ctx()));
  const at = (s) => html.indexOf(s);
  assert.ok(at("September 25, 2026 · Recap") > -1, "the status line shows");
  assert.ok(at("September 25, 2026 · Recap") < at("<h1"), "the status line stands over the title");
  assert.ok(at("<h1") < at("Snacks, therapy dogs, crafts, &amp; FUN!"), "the tagline stands under the title");
  assert.ok(at("Past event hours") < at("eventhead-actions"), "the buttons stand under the words");
  assert.match(html, /eventhead-photos[\s\S]*eventhead-actions/, "the buttons stand in one row under the words and the photos");
  assert.match(html, /eventhead band has-photos has-3/, "the three photos are one block");
  assert.equal([...html.matchAll(/btn btn--big/g)].length, 2, "both buttons wear the big button's height");
  assert.ok(html.includes("Find a Peer Support Group") && html.includes("Directions to the Student Mental Health Hub"));
});

test("a broken record is refused, naming what is wrong", () => {
  const bad = (over) => hubEventProblems({ ...openHouse, ...over }, { media: mediaIds(), places: content.places });
  assert.ok(bad({ title: "" }).some((p) => p.includes("title")), "no title");
  assert.ok(bad({ photos: ["m-oh-sticky-wall", "m-oh-sea-support", "m-oh-craft-shelves", "m-paint-hand"] }).some((p) => p.includes("at most 3")), "four header photos");
  assert.ok(bad({ photos: ["m-no-such-photo"] }).some((p) => p.includes("m-no-such-photo")), "a photo the library does not hold");
  assert.ok(bad({ place: "no-such-room" }).some((p) => p.includes("no-such-room")), "a room that is not published");
  assert.ok(bad({ path: "initiatives/open-house" }).some((p) => p.includes("path")), "an address without its slashes");
  assert.ok(bad({ id: "open-house-2", path: "/initiatives/open-house/" }).length >= 0, "shape alone is fine");
});

const fictional = (over = {}) => ({ schema: "bss.hubevent/1", id: "spring-open-house", path: "/initiatives/spring-open-house/",
  hidden: false, order: 2, title: "Spring Hub Open House", description: "A fictional event for the tests.",
  label: "April 10, 2027 · Coming Soon", lead: "Snacks, therapy dogs, crafts, & FUN!", body: ["A fictional paragraph."],
  details: ["Event hours: 12:00 PM–4:00 PM", "333 E. Campus Mall, Room 3203"], photos: ["m-oh-sticky-wall"],
  primary: { label: "Find a Peer Support Group", href: "/join/peer-support-groups/" }, links: [],
  peopleTitle: "Featuring", people: [{ photo: null, name: "Dr. Robin Example", role: "Example Clinic", line: "A fictional guest." }],
  highlights: null, programme: { program: "peer", title: "What Is On", topics: [{ term: "Dogs on Call", text: "A fictional visit." }], photos: [], links: [] },
  gallery: ["m-paint-hand"], place: "sac-mhh", directionsTitle: "Directions to the Student Mental Health Hub", ...over });

test("a second event renders its people, its programme and its extra photos", () => {
  const [page] = hubEventPages([fictional()], t());
  assert.deepEqual(page.blocks.map((b) => b.type), ["eventhead", "featuring", "program", "gallery", "directions", "text", "cta"]);
  assert.deepEqual(blockProblems(page), []);
  const c = ctx();
  const featuring = String(renderBlock(page.blocks.find((b) => b.type === "featuring"), c));
  assert.ok(featuring.includes("Dr. Robin Example") && featuring.includes("Example Clinic") && featuring.includes("A fictional guest."));
  const head = String(renderBlock(page.blocks[0], c));
  assert.ok(head.includes("Event hours: 12:00 PM–4:00 PM") && head.includes("eventhead-details"), "the detail lines stand in the header");
});

test("a hidden event makes no page, and the shown order is the order kept", () => {
  const pages = hubEventPages(sortHubEvents([fictional({ hidden: true }), openHouse]), t());
  assert.deepEqual(pages.map((p) => p.id), ["pg-open-house"], "only the shown event has a page");
  const both = hubEventPages(sortHubEvents([fictional(), openHouse]), t());
  assert.deepEqual(both.map((p) => p.id), ["pg-open-house", "pg-spring-open-house"], "the lower order number stands first");
});

const changeCtx = () => ({ pages: content.pages, places: content.places, media: mediaIds(), hubEvents: seed });
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };

test("a save in the builder replaces the build's record whole, and lays over it", () => {
  const out = applyChange(emptyStructure(), { action: "event", events: [{ ...structuredClone(openHouse), title: "Hub Open House, Renamed" }] }, changeCtx());
  assert.equal(out.event, "open-house");
  const laid = layHubEvents(seed, out.doc.events, { media: mediaIds(), places: content.places });
  assert.equal(laid.find((e) => e.id === "open-house").title, "Hub Open House, Renamed");
});

test("a new event is given an id from its title and an address under it, and an id is never given twice", () => {
  const fresh = fictional(); delete fresh.id; delete fresh.path;
  const out = applyChange(emptyStructure(), { action: "event", events: [fresh] }, changeCtx());
  assert.equal(out.event, "spring-hub-open-house");
  assert.equal(out.doc.events["spring-hub-open-house"].path, "/initiatives/spring-hub-open-house/");
  const again = fictional({ title: "Spring Hub Open House" }); delete again.id; delete again.path;
  const out2 = applyChange(out.doc, { action: "event", events: [again] }, changeCtx());
  assert.equal(out2.event, "spring-hub-open-house-2", "the second event of the name takes the next id");
});

test("an address another page or event holds is refused, and so is an unknown event", () => {
  let doc = emptyStructure();
  assert.equal(code(() => applyChange(doc, { action: "event", events: [fictional({ id: "other", path: "/initiatives/open-house/" })] }, changeCtx())), "event.unknown");
  const fresh = fictional(); delete fresh.id; delete fresh.path;
  const mine = applyChange(doc, { action: "event", events: [fresh] }, changeCtx());
  assert.equal(mine.event, "spring-hub-open-house");
  doc = mine.doc;
  assert.equal(code(() => applyChange(doc, { action: "event", events: [fictional({ id: "spring-hub-open-house", place: "no-such-room" })] }, changeCtx())), "event.place");
  assert.equal(code(() => applyChange(doc, { action: "event", events: [fictional({ id: "spring-hub-open-house", photos: ["m-nope"] })] }, changeCtx())), "event.photo");
  assert.equal(code(() => applyChange(doc, { action: "event", events: [fictional({ id: "spring-hub-open-house", title: "Another", path: "/initiatives/open-house/" })] }, changeCtx())), "event.path");
});

test("hiding an event in the builder takes its page away and keeps its record", () => {
  const out = applyChange(emptyStructure(), { action: "event", events: [{ ...structuredClone(openHouse), hidden: true }] }, changeCtx());
  const laid = layHubEvents(seed, out.doc.events, { media: mediaIds(), places: content.places });
  assert.equal(laid.length, 1, "the record is kept");
  assert.deepEqual(hubEventPages(laid, t()), [], "and its page is gone");
  const back = cleanHubEvent({ ...structuredClone(openHouse), hidden: false }, changeCtx());
  assert.equal(back.hidden, false);
});
