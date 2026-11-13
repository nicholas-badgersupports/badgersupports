/* The Wall of Support pull (ops/wall-notes.mjs): the checks that keep a bad answer
   from the sheet out of the content file, and the shape of the file it writes. */

import test from "node:test";
import assert from "node:assert/strict";
import { wallProblems, wallFile } from "../ops/wall-notes.mjs";

test("a clean list of notes passes", () => {
  assert.deepEqual(wallProblems(["You are valued", "Take a breath."]), []);
});

test("an answer with no list, an empty note, an over-long note or a repeat is refused", () => {
  assert.equal(wallProblems(null).length, 1);
  assert.equal(wallProblems([]).length, 1);
  assert.match(wallProblems(["Fine", "  "])[0], /empty/);
  assert.match(wallProblems(["x".repeat(281)])[0], /281 characters/);
  assert.match(wallProblems(["Same", "Same"])[0], /repeats/);
});

test("the file written is the wall content shape, marked as a pull, not a sample", () => {
  const f = wallFile(["You are valued"], "2026-11-12");
  assert.equal(f.schema, "bss.wall-fixture/1");
  assert.equal(f.fixture, false);
  assert.equal(f.label, null);
  assert.equal(f.sourceUpdatedAt, "2026-11-12");
  assert.deepEqual(f.notes, ["You are valued"]);
  assert.match(f.provenance, /WEB Tech Dashboard/);
});
