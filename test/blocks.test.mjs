/* The block contract (docs/EXTENDING.md, "What a block declares"): a block reads only the data sources it
   declares, its own stylesheet is one it names, and any block can be dated. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { blockStyles } from "../ops/build.mjs";
import { BLOCKS, blockProblems, liveBlocks, renderBlock } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";

const context = (data) => makeContext({ site: {}, media: { items: [] }, data, text: {}, today: "2026-10-20" });

test("a block that reads a data source it did not declare stops the build, naming the block and the source (calibration)", () => {
  BLOCKS.probe = { type: "probe", data: ["events"], render: (b, ctx) => `${ctx.data.events.length} ${ctx.data.team.length}` };
  try {
    const ctx = context({ events: [1, 2], team: [3] });
    const data = ctx.data;
    assert.throws(() => renderBlock({ id: "b-probe", type: "probe" }, ctx), /block b-probe \(probe\) reads ctx\.data\.team, which probe does not declare: add "team" to its data list/);
    assert.equal(ctx.data, data, "the data is put back after a refused render");
    BLOCKS.probe.render = (b, c) => ("team" in c.data ? "yes" : "no");
    assert.throws(() => renderBlock({ id: "b-probe", type: "probe" }, ctx), /reads ctx\.data\.team/, "asking whether a source is there is a read");
    BLOCKS.probe.data = ["events", "team"];
    assert.equal(renderBlock({ id: "b-probe", type: "probe" }, ctx), "yes");
    BLOCKS.probe.render = (b, c) => `${c.data.events.length} ${c.data.team.length}`;
    assert.equal(renderBlock({ id: "b-probe", type: "probe" }, ctx), "2 1");
  } finally {
    delete BLOCKS.probe;
  }
});

test("the context a block sees is the build's own object, so a once-per-build note stays once", () => {
  let seen = null;
  BLOCKS.probe = { type: "probe", data: [], render: (b, ctx) => { seen = ctx; return ""; } };
  try {
    const ctx = context({});
    renderBlock({ id: "b-probe", type: "probe" }, ctx);
    assert.equal(seen, ctx);
  } finally {
    delete BLOCKS.probe;
  }
});

test("every block's declared sources are ones the build provides", () => {
  // ops/build.mjs, where ctx is made; docs/EXTENDING.md lists the same.
  const provided = ["events", "wallNotes", "wallSample", "team", "teamSample", "mood", "forms", "places", "resources", "resourcesSample", "resourcesUpdated"];
  for (const b of Object.values(BLOCKS)) for (const d of b.data) assert.ok(provided.includes(d), `${b.type} declares ${d}`);
});

const page = (blocks) => ({ id: "pg-probe", blocks });
const text = (extra) => ({ id: "b-dated", type: "text", body: ["Words."], ...extra });

test("any block can carry startsOn and endsOn, written YYYY-MM-DD, the first not after the last", () => {
  assert.deepEqual(blockProblems(page([text({ startsOn: "2026-11-01", endsOn: "2026-11-10" })])), []);
  assert.deepEqual(blockProblems(page([text({ endsOn: "2026-11-10" })])), []);
  assert.deepEqual(blockProblems(page([text({ startsOn: "2026-13-01" })])), ["pg-probe.b-dated: startsOn must be a date written YYYY-MM-DD"]);
  assert.deepEqual(blockProblems(page([text({ endsOn: "10 Nov" })])), ["pg-probe.b-dated: endsOn must be a date written YYYY-MM-DD"]);
  assert.deepEqual(blockProblems(page([text({ startsOn: "2026-11-10", endsOn: "2026-11-01" })])), ["pg-probe.b-dated: startsOn is after endsOn, so the block would never show"]);
  assert.deepEqual(blockProblems(page([text({ showsFrom: "2026-11-01" })])), ['pg-probe.b-dated: text has no field "showsFrom"']);
});

test("a dated block shows from its first day to its last, both included", () => {
  const p = page([text({ startsOn: "2026-11-01", endsOn: "2026-11-10" })]);
  for (const [day, shown] of [["2026-10-31", 0], ["2026-11-01", 1], ["2026-11-10", 1], ["2026-11-11", 0]]) {
    assert.equal(liveBlocks(p, day).length, shown, day);
  }
  assert.equal(liveBlocks(page([text({ enabled: false, startsOn: "2026-11-01" })]), "2026-11-05").length, 0, "off wins over dates");
});

test("a block's own stylesheet is one it names: a missing file or an orphaned one stops the build (calibration)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bss-block-styles-"));
  fs.writeFileSync(path.join(dir, "wall.css"), ".wall {}");
  const blocks = { text: { type: "text" }, wall: { type: "wall", styles: "wall.css" } };
  assert.deepEqual(blockStyles(dir, blocks), ["blocks/wall.css"]);
  blocks.mood = { type: "mood", styles: "mood.css" };
  assert.throws(() => blockStyles(dir, blocks), /block mood names styles mood\.css, which is not in src\/styles\/blocks\//);
  delete blocks.mood;
  fs.writeFileSync(path.join(dir, "stray.css"), ".stray {}");
  assert.throws(() => blockStyles(dir, blocks), /src\/styles\/blocks\/stray\.css belongs to no block/);
});

test("the shipped block stylesheets all belong to a block, and go in after blocks.css in the library's order", () => {
  const files = blockStyles();
  assert.deepEqual(files, Object.values(BLOCKS).filter((b) => b.styles).map((b) => `blocks/${b.styles}`));
  assert.ok(files.length >= 4, files.join());
});
