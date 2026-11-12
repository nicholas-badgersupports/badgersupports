/* The feeling check-in's set: the build's (content/widgets/mood.json), the publisher's saved set
   in Site Settings (structure.mjs), and the block that draws a feeling as its emoji over its word. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { applyChange, emptyStructure, layMood, isProblem } from "../src/shared/structure.mjs";
import moodBlock from "../src/render/blocks/mood.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BUILD_SET = JSON.parse(fs.readFileSync(path.join(ROOT, "content/widgets/mood.json"), "utf8"));
const CTX = { pages: [], site: {}, authored: new Set(), redirected: () => false };
const save = (settings) => applyChange(emptyStructure(), { action: "settings", settings }, CTX).doc.settings;

const ONE = { id: "okay", emoji: "🙂", label: "Okay", color: "#185FA5", messages: ["One step at a time."] };

test("a saved set is checked and tidied: colours lower-cased, words cleaned, shape kept", () => {
  const s = save({ moodCheckin: { moods: [{ ...ONE, label: "  Okay  " }] } });
  assert.deepEqual(s.moodCheckin, { moods: [{ id: "okay", emoji: "🙂", label: "Okay", color: "#185fa5", messages: ["One step at a time."] }] });
});

test("a saved set replaces the build's whole list, and keeps the line after a tap", () => {
  const laid = layMood(BUILD_SET, { moodCheckin: { moods: [ONE] } });
  assert.deepEqual(laid.moods, [{ ...ONE, color: "#185fa5" }]);
  assert.equal(laid.after, BUILD_SET.after);
});

test("no saved set, or one that no longer passes, keeps the build's set", () => {
  assert.equal(layMood(BUILD_SET, null), BUILD_SET);
  assert.equal(layMood(BUILD_SET, {}), BUILD_SET);
  assert.equal(layMood(BUILD_SET, { moodCheckin: { moods: [] } }), BUILD_SET);
});

test("a set that breaks the rules is refused as settings.mood", () => {
  const bad = [
    { moods: [] },                                                    // none at all
    { moods: Array.from({ length: 9 }, (_, i) => ({ ...ONE, id: `m${i}` })) }, // more than eight
    { moods: [{ ...ONE, color: "blue" }] },                           // not a colour
    { moods: [{ ...ONE, color: "#12345" }] },                         // not six hex digits
    { moods: [{ ...ONE, emoji: "" }] },                               // no emoji
    { moods: [{ ...ONE, emoji: "<b>🙂</b>" }] },                      // markup, not an emoji
    { moods: [{ ...ONE, label: " " }] },                              // no word
    { moods: [{ ...ONE, label: "x".repeat(41) }] },                   // too long a word
    { moods: [{ ...ONE, messages: [] }] },                            // nothing to answer with
    { moods: [{ ...ONE, messages: ["fine", ""] }] },                  // an empty reply line
    { moods: [ONE, ONE] },                                            // the same id twice
    { moods: [{ ...ONE, id: "Not An Id" }] },                         // an id the counts cannot be kept under
    { moods: [{ ...ONE, link: "/somewhere/" }] },                     // a field the set does not have
    { moods: [ONE], extra: true },                                    // a field beside the list
  ];
  for (const moodCheckin of bad) {
    assert.throws(() => save({ moodCheckin }), (e) => isProblem(e) && e.code === "settings.mood", JSON.stringify(moodCheckin).slice(0, 60));
  }
});

test("the build's own set, as it ships, passes the check unchanged but for its colours' case", () => {
  const s = save({ moodCheckin: { moods: BUILD_SET.moods } });
  assert.equal(s.moodCheckin.moods.length, 5);
  assert.deepEqual(s.moodCheckin.moods.map((m) => m.id), BUILD_SET.moods.map((m) => m.id));
});

test("the block draws each feeling as its emoji over its word, naming its colour", () => {
  const out = String(moodBlock.render({ id: "b-mood", title: "How are you feeling today?" }, { data: { mood: BUILD_SET } }));
  const buttons = [...out.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 5);
  assert.match(out, /<span class="e" aria-hidden="true">😓<\/span><span class="mood-label">Burnt out<\/span>/);
  assert.match(buttons[0], /data-color="#a40000"/);
  assert.doesNotMatch(out, /\sstyle=/, "the markup carries no inline style");
});
