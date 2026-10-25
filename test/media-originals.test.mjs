/* A build on a machine without local/ (owner, 20 Oct 2026: builds happen on the laptop, which has the
   originals): it stops before encoding anything and names every missing photo, with how to get it.
   Nothing here touches the network. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../ops/build.mjs";
import crypto from "node:crypto";
import { buildMedia, loadManifest, missingOriginals } from "../ops/media.mjs";
import { drawRoomMap, ROOM_MAPS } from "../ops/room-map.mjs";

const NOWHERE = path.join(ROOT, "local", "test-no-originals");
const OUT = path.join(ROOT, "local", "test-build-no-originals", "media");
const items = loadManifest().items;
const fromDrive = items.filter((i) => i.source.startsWith("drive:"));
const derived = items.filter((i) => i.source.startsWith("derived:"));
const ORIG = path.join(ROOT, "local", "media-originals");

test("every missing original is named, a Drive one with the Drive, a public one with --fetch-media, a drawn map with its script", () => {
  assert.ok(!fs.existsSync(NOWHERE));
  const lines = missingOriginals(items, { originalsDir: NOWHERE });
  assert.equal(lines.length, items.length);
  for (const [i, item] of items.entries()) {
    assert.ok(lines[i].startsWith(`${item.id}: `), item.id);
    assert.match(lines[i], item.source.startsWith("drive:") ? /synced Drive/ : item.source.startsWith("derived:") ? /room-map/ : /--fetch-media/, item.id);
  }
  assert.ok(fromDrive.length > 0 && fromDrive.length < items.length, "the library mixes Drive and public photos");
  assert.deepEqual(missingOriginals(items, { originalsDir: NOWHERE, fetchMissing: true }).map((l) => l.split(":")[0]), fromDrive.map((i) => i.id), "fetching cannot reach a Drive photo, and every drawn map's parent is public");
});

test("every drawn map has a recipe in ops/room-map.mjs, and the recipe reproduces the manifest's file", async () => {
  assert.ok(derived.length > 0);
  for (const item of derived) {
    const parent = items.find((p) => p.id === item.source.slice("derived:".length));
    assert.ok(parent && !parent.source.startsWith("derived:"), item.id);
    assert.equal(ROOM_MAPS[item.localFile]?.from, parent.localFile, item.id);
    assert.ok(items.indexOf(parent) < items.indexOf(item), `${item.id} comes after its parent`);
    const from = path.join(ORIG, parent.localFile);
    if (!fs.existsSync(from)) continue; // away from the laptop: the three lines above are all that can be checked
    const { png } = await drawRoomMap(fs.readFileSync(from), ROOM_MAPS[item.localFile]);
    assert.equal(crypto.createHash("sha256").update(png).digest("hex"), item.sha256, item.id);
  }
});

test("the build stops before encoding, with the whole list in one message", async () => {
  await assert.rejects(buildMedia(OUT, { originalsDir: NOWHERE }), (e) => {
    assert.match(e.message, new RegExp(`^${items.length} of ${items.length} photo originals are missing`));
    for (const item of items) assert.ok(e.message.includes(`\n  ${item.id}: `), item.id);
    return true;
  });
  assert.ok(!fs.existsSync(OUT), "nothing was written");
});

test("on the laptop, where local/ holds the originals, none is missing", { skip: process.env.NO_MEDIA === "1" && "away from the laptop (check --no-media)" }, () => {
  assert.deepEqual(missingOriginals(items), []);
});
