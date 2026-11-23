/* The Wall of Support's fill: the six approved defaults a production build
   stands in behind Connect's approved notes — all six when the list comes
   back empty, fewer as real notes take their places, and none once approved
   notes fill the wall (ops/wall-defaults.mjs). */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { WALL_DEFAULT_NOTES, wallWithDefaults } from "../ops/wall-defaults.mjs";

/* The six, word for word as the "Notes" tab of "WEB Tech Dashboard" holds
   them (rows 5, 7, 19, 23, 37, 49), approved by Nicholas on 13 Nov 2026. */
const APPROVED = [
  "You belong here",
  "You're not alone!",
  "The world is better with you in it",
  "Be kind to yourself",
  "It gets better, I promise",
  "Your feelings are valid",
];

test("the defaults are the six approved notes, word for word, in the order approved", () => {
  assert.deepEqual(WALL_DEFAULT_NOTES, APPROVED);
});

test("an empty or absent list falls back to the defaults, which are not samples", () => {
  for (const wall of [null, undefined, {}, { notes: [] }, { notes: ["", "  "] }, { notes: [null] }]) {
    const out = wallWithDefaults(wall);
    assert.deepEqual(out.notes, APPROVED);
    assert.equal(out.fixture, false, "real notes from the wall's own sheet carry no sample label");
  }
});

test("a short list stands first and the defaults fill the places left", () => {
  const one = { schema: "bss.wall-fixture/1", fixture: false, source: "connect", notes: ["A fictional approved note."] };
  const filled = wallWithDefaults(one);
  assert.deepEqual(filled.notes, ["A fictional approved note.", ...APPROVED], "one real note and all six defaults: the fullest the wall can stand");
  assert.equal(filled.source, "connect", "the wall is still Connect's list, filled out");
  assert.equal(filled.fixture, false);
  const three = { ...one, notes: ["One.", "Two.", "Three."] };
  assert.deepEqual(wallWithDefaults(three).notes, ["One.", "Two.", "Three.", ...APPROVED.slice(0, 5)], "three real notes leave five places, taken by the first five defaults");
});

test("a list at or over the display count is returned untouched: no default joins it", () => {
  const eight = { schema: "bss.wall-fixture/1", fixture: false, source: "connect", notes: ["1.", "2.", "3.", "4.", "5.", "6.", "7.", "8."] };
  assert.equal(wallWithDefaults(eight), eight);
  const ten = { ...eight, notes: [...eight.notes, "9.", "10."] };
  assert.equal(wallWithDefaults(ten), ten);
});

test("a real note carrying a default's words keeps that default off the wall", () => {
  const wall = { schema: "bss.wall-fixture/1", fixture: false, source: "connect", notes: ["You belong here"] };
  const out = wallWithDefaults(wall);
  assert.equal(out.notes.filter((n) => n === "You belong here").length, 1, "the words stand once, as the real note");
  assert.equal(out.notes.length, 6, "the other five defaults fill behind it");
});

/* A production build against a fictional Connect, in the shape the alumni
   tests use: the only thing that changes between builds is the wall reply. */
function fakeConnect(wallNotes) {
  const resources = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fixtures/resources.json"), "utf8")).resources;
  return {
    url: "https://home.badgersupports.org", keyId: "fixture", secret: "x".repeat(40),
    fetch: async (url, init) => ({
      json: async () => ({
        publicAlumniHistory: { ok: true, schema: "bss.alumni-history/1", groups: [] },
        publicEvents: { ok: true, schema: 1, events: [], weekly: [] },
        publicResourceExport: { ok: true, schema: 1, resources },
        publicTeam: { ok: true, schema: "bss.team/1", people: [] },
        publicWallNotes: { ok: true, schema: "bss.wall/1", notes: wallNotes },
      }[JSON.parse(init.body).action]),
    }),
  };
}

const unescape = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const wallNotesOn = (html) => {
  const wall = html.match(/<section class="wall band"[\s\S]*?<\/section>/);
  assert.ok(wall, "the home page carries the wall");
  return [...wall[0].matchAll(/<li class="note">([^<]*)<\/li>/g)].map((m) => unescape(m[1]));
};

async function productionHome(wallNotes, dir) {
  const out = path.join(ROOT, "local", dir);
  await build({ production: true, connectConfig: fakeConnect(wallNotes), out, serverDir: path.join(out, "_server"), media: false, today: "2026-11-13" });
  return fs.readFileSync(path.join(out, "index.html"), "utf8");
}

test("a production build whose Connect wall comes back empty publishes the six defaults", async () => {
  const shown = wallNotesOn(await productionHome([], "test-wall-defaults"));
  assert.deepEqual([...shown].sort(), [...APPROVED].sort(), "every default is on the wall");
});

test("a production build with two notes from Connect shows those and the defaults filling the wall", async () => {
  const html = await productionHome([{ id: "n1", text: "A fictional approved note." }, { id: "n2", text: "Another fictional approved note." }], "test-wall-feed");
  const shown = wallNotesOn(html);
  assert.equal(shown.length, 8, "the wall stands full at its display count");
  assert.deepEqual([...shown].sort(), ["A fictional approved note.", "Another fictional approved note.", ...APPROVED].sort(), "both real notes and all six defaults stand");
});

test("a production build whose Connect notes fill the wall shows none of the defaults", async () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `n${i + 1}`, text: `Fictional approved note ${i + 1}.` }));
  const html = await productionHome(many, "test-wall-full");
  assert.equal(wallNotesOn(html).length, 8, "the wall shows its display count");
  for (const d of APPROVED) assert.ok(!html.includes(d.replace(/'/g, "&#39;")), `the default "${d}" stays out once real notes fill the wall`);
});
