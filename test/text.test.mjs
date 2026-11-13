import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { textProblems, resolveText } from "../src/shared/text.mjs";
import { editableReport, sourceProblems } from "../ops/editable.mjs";
import { build, ROOT } from "../ops/build.mjs";

const registry = JSON.parse(fs.readFileSync(new URL("../content/text.json", import.meta.url)));

test("the registry is well formed", () => {
  assert.deepEqual(textProblems(registry), []);
});

test("an edit cannot blank required text or drop a placeholder", () => {
  assert.ok(textProblems(registry, { "form.send": "  " }).some((p) => p.includes("cannot be published empty")));
  assert.ok(textProblems(registry, { "strip.count": "{{n}}" }).some((p) => p.includes("must keep {{total}}")));
  assert.ok(textProblems(registry, { "form.sendd": "x" }).some((p) => p.includes("not a text key")));
  const table = resolveText(registry, { "form.send": "", "form.rule": "", "header.menu": "Browse" });
  assert.equal(table["form.send"], "Send", "a blanked required text falls back to its default");
  assert.equal(table["form.rule"], "", "optional text may be published empty");
  assert.equal(table["header.menu"], "Browse");
});

test("no renderer, browser script or server reply carries a word of its own", () => {
  const r = editableReport();
  assert.deepEqual(r.problems, []);
});

test("the editable scan catches a planted word (calibration)", () => {
  assert.ok(sourceProblems("x.mjs", "const a = html`<p>Hello there</p>`;").length === 1);
  assert.ok(sourceProblems("x.mjs", 'const a = html`<button aria-label="Close menu"></button>`;').length === 1);
  assert.ok(sourceProblems("x.mjs", 'link(ctx, "/a", "Read more")').length === 1);
  assert.ok(sourceProblems("x.js", 'el.textContent = "Loading";', { client: true }).length === 1);
  assert.ok(sourceProblems("x.js", 'new DOMParser().parseFromString("<p>Hello there</p>", "text/html");', { client: true }).length === 1);
  assert.equal(sourceProblems("x.js", 'new DOMParser().parseFromString(markup, "text/html");', { client: true }).length, 0);
  assert.equal(sourceProblems("x.mjs", 'const a = html`<p>${t("x.y")}</p>`;').length, 0);
});

test("an attribute is not a word, and a word beside one is still caught (calibration, C-40)", () => {
  // A nested template that is only an attribute — cards.mjs's row layout — names no word a
  // visitor reads, and no longer fails the scan (the standing red decided under C-40).
  assert.equal(sourceProblems("x.mjs", 'const a = html`<ul${x ? html` tabindex="0"` : ""}></ul>`;').length, 0);
  // The same fragment beside real words: the words are still caught, once.
  assert.equal(sourceProblems("x.mjs", 'const a = html`<ul${x ? html` tabindex="0"` : ""}>Hello there</ul>`;').length, 1);
  // An attribute a person hears still fails, even as a bare fragment with no tag around it:
  // the fix is a category (assignments are markup), not a pass for attribute values.
  assert.equal(sourceProblems("x.mjs", 'const a = html` aria-label="Close menu"`;').length, 1);
});

test("a published text edit reaches the built page", async () => {
  const out = path.join(ROOT, "local", "test-build-text");
  await build({ out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-20", textEdits: { "form.send": "Send my request", "header.menu": "Browse" } });
  const form = fs.readFileSync(path.join(out, "forms/workshop-request/index.html"), "utf8");
  assert.match(form, />Send my request</);
  assert.match(form, />Browse</);
  const server = JSON.parse(fs.readFileSync(path.join(out, "_server/server.json"), "utf8"));
  assert.equal(server.text["form.send"], "Send my request", "the API renders with the same words");
});
