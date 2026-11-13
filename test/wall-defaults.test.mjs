/* The Wall of Support's floor: the six approved defaults a production build
   stands in when Connect's approved list comes back empty, so the wall is
   never blank — and their complete absence when Connect sends any note
   (ops/wall-defaults.mjs). */

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

test("a list with any real note is returned untouched: the defaults never join it", () => {
  const wall = { schema: "bss.wall-fixture/1", fixture: false, source: "connect", notes: ["A fictional approved note."] };
  assert.equal(wallWithDefaults(wall), wall);
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

test("a production build with notes from Connect shows those and none of the defaults", async () => {
  const html = await productionHome([{ id: "n1", text: "A fictional approved note." }, { id: "n2", text: "Another fictional approved note." }], "test-wall-feed");
  assert.deepEqual(wallNotesOn(html).sort(), ["A fictional approved note.", "Another fictional approved note."]);
  for (const d of APPROVED) assert.ok(!html.includes(d.replace(/'/g, "&#39;")), `the default "${d}" stays out when Connect sends notes`);
});
