import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { definitionProblems, visibility, validateAnswers, readRaw, cellText, errorText, OTHER } from "../src/shared/forms.mjs";
import { makeT, resolveText } from "../src/shared/text.mjs";

const load = (k) => JSON.parse(fs.readFileSync(new URL(`../content/forms/${k}.json`, import.meta.url)));
const t = makeT(resolveText(JSON.parse(fs.readFileSync(new URL("../content/text.json", import.meta.url)))));

test("every shipped form definition passes the form rules", () => {
  for (const f of fs.readdirSync(new URL("../content/forms/", import.meta.url))) {
    assert.deepEqual(definitionProblems(load(f.replace(".json", ""))), [], f);
  }
});

test("a branch opens only for its answer, and a hidden branch's answers are dropped", () => {
  const def = load("programming-feedback");
  const vis = visibility(def, { category: "craft" });
  assert.ok(vis.sections.has("craft"));
  assert.ok(!vis.sections.has("workshop"));
  const r = validateAnswers(def, readRaw(def, { category: "craft", craft_activity: "bracelets_f26", craft_enjoyed: "The music.", ws_learned: "should be dropped" }));
  assert.equal(r.ok, true);
  assert.equal(r.answers.ws_learned, undefined);
  assert.equal(r.answers.craft_enjoyed, "The music.");
});

test("the general branch asks its own question (the Google Form skipped straight to submit)", () => {
  const def = load("programming-feedback");
  const r = validateAnswers(def, readRaw(def, { category: "general" }));
  assert.deepEqual(r.errors, { general_comment: "required" });
});

test("Other needs words, and an unknown option is refused", () => {
  const def = load("programming-feedback");
  const a = validateAnswers(def, readRaw(def, { category: "peer", peer_group: OTHER, peer_stood_out: "x" }));
  assert.equal(a.errors.peer_group, "other-missing");
  const b = validateAnswers(def, readRaw(def, { category: "peer", peer_group: "sunday", peer_stood_out: "x" }));
  assert.equal(b.errors.peer_group, "option-unknown");
});

test("numbers, emails and dates are checked by shape", () => {
  const def = load("workshop-request");
  const r = validateAnswers(def, readRaw(def, { attendees: "0", email: "not-an-address", option_1: "tomorrow" }));
  assert.equal(r.errors.attendees, "number-low");
  assert.equal(r.errors.email, "email-shape");
  assert.equal(r.errors.option_1, "datetime-shape");
});

test("error messages come from the text registry, with the question's label", () => {
  const q = { id: "name", type: "short", label: "Your name" };
  assert.equal(errorText("required", q, t), "Fill in “Your name”.");
  const edited = makeT(resolveText(JSON.parse(fs.readFileSync(new URL("../content/text.json", import.meta.url))), { "form.error.required": "Please answer “{{label}}”." }));
  assert.equal(errorText("required", q, edited), "Please answer “Your name”.");
});

test("a spreadsheet cell can never start a formula", () => {
  const def = load("workshop-request");
  assert.equal(cellText(def, "group_notes", "=HYPERLINK(\"http://x\")"), "'=HYPERLINK(\"http://x\")");
  assert.equal(cellText(def, "group_notes", "+1"), "'+1");
  assert.equal(cellText(def, "topics", ["housing"]), "Navigating housing");
});
