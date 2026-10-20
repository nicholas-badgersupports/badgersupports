/* Rooms and directions: a room is one record, and the build does the rest. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { placeProblems, placePages, eventPlaces, eventPlaceProblems } from "../src/render/places.mjs";
import { esc } from "../src/render/html.mjs";

const OUT = path.join(ROOT, "local", "test-build-places");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const t = (key, vars) => `${key}:${JSON.stringify(vars)}`;

test.before(async () => {
  await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

test("every published room has its own page: one h1, the address, a map, the steps in order or none at all", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "content/places"))) {
    const room = JSON.parse(fs.readFileSync(path.join(ROOT, "content/places", f), "utf8"));
    const file = path.join("directions", room.id, "index.html");
    if (!room.published) {
      assert.equal(fs.existsSync(path.join(OUT, file)), false, `${room.id} is a draft and must have no page`);
      continue;
    }
    const html = read(file);
    assert.equal([...html.matchAll(/<h1[\s>]/g)].length, 1, `${room.id}: one h1`);
    assert.ok(html.includes(`>${esc(room.name)}</h1>`), `${room.id}: the room is the h1`);
    assert.ok(html.includes(`<address>${esc(room.address)}</address>`), `${room.id}: address`);
    assert.ok(html.includes(`https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(room.address)}`), `${room.id}: map link`);
    let at = 0;
    for (const s of room.steps) {
      const i = html.indexOf(esc(s.text), at);
      assert.ok(i > at, `${room.id}: step ${s.id} present and in order`);
      at = i;
    }
    if (!room.steps.length) assert.doesNotMatch(html, /dir-steps|dir-arrive/, `${room.id}: an address-only room shows no route`);
    if (room.arrivePhoto) assert.match(html, /class="dir-arrive-photo photo"/, `${room.id}: the arrival photo`);
  }
});

test("the old live addresses redirect to the new room pages", () => {
  const redirects = read("_redirects");
  assert.match(redirects, /^\/operations\/directions\/sac-caucus\s+\/directions\/sac-caucus\/\s+301$/m);
  assert.match(redirects, /^\/operations\/directions\/lcm\s+\/directions\/lcm\/\s+301$/m);
});

test("the room list shows every published room; events link to their room, and a draft's events link nowhere", () => {
  const list = read("directions/index.html");
  for (const id of ["sac-mhh", "sac-caucus", "sac-hearing", "sac-multipurpose", "lcm", "union-south-marquee", "memorial-union-tripp"]) {
    assert.match(list, new RegExp(`href="/directions/${id}/"`), id);
  }
  const home = read("index.html");
  assert.match(home, /<a href="\/directions\/sac-caucus\/">SAC Caucus Room<\/a>/, "a timetable row links its room");
  const shown = eventPlaces({
    "draft-room": { id: "draft-room", published: false, name: "Draft Room", building: "Example Hall", where: "2nd floor" },
  })["draft-room"];
  assert.deepEqual(shown, { name: "Draft Room", detail: "Example Hall, 2nd floor", href: null }, "an event at a draft room still names it, and links nowhere");
});

test("adding a room is adding a record: it becomes a page with a title from the text registry", () => {
  const rooms = {
    "new-room": { schema: "bss.place/1", id: "new-room", published: true, name: "Example Room", building: "Example Hall", address: "1 Example St", steps: [{ id: "s-in", text: "Go in." }], aliases: ["/old/example"] },
    "draft-room": { schema: "bss.place/1", id: "draft-room", published: false, name: "Draft Room", steps: [] },
  };
  const pages = placePages(rooms, t);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].path, "/directions/new-room/");
  assert.deepEqual(pages[0].aliases, ["/old/example"]);
  assert.deepEqual(pages[0].blocks, [{ id: "b-directions", type: "directions", place: "new-room" }]);
  assert.equal(pages[0].title, 'directions.pageTitle:{"place":"Example Room","building":"Example Hall"}');
  for (const r of Object.values(rooms)) assert.deepEqual(placeProblems(r), [], r.id);
});

test("a room cannot be published without an address, may be published with no steps, and an event cannot be held nowhere", () => {
  const base = { schema: "bss.place/1", id: "x-room", published: true, name: "X" };
  assert.deepEqual(placeProblems({ ...base, address: "1 Example St", steps: [] }), [], "address only is a whole room");
  assert.ok(placeProblems({ ...base, address: "1 Example St", steps: [], arrivePhoto: "m-x" }).some((p) => /needs at least one step/.test(p)), "an arrival photo ends a route");
  assert.ok(placeProblems({ ...base, address: "1 Example St", steps: [{ id: "s-a", text: "Go in." }], arrivePhoto: "m-none" }, { media: new Set() }).some((p) => /^arrivePhoto: .*not in media/.test(p)));
  assert.ok(placeProblems({ ...base, steps: [{ id: "s-a", text: "Go in." }] }).some((p) => /needs an address/.test(p)));
  assert.ok(placeProblems({ ...base, address: "1 Example St", steps: [{ id: "bad", text: "Go in." }] }).some((p) => /s-something/.test(p)));
  assert.ok(placeProblems({ ...base, address: "1 Example St", steps: [{ id: "s-a", text: "Go in.", photo: "m-none" }] }, { media: new Set() }).some((p) => /not in media/.test(p)));
  assert.deepEqual(eventPlaceProblems({ dated: [{ id: "e1", place: "nowhere" }] }, {}), ['e1 is held at "nowhere", which is not a room in content/places/']);
});
