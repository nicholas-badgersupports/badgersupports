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
  assert.equal(sourceProblems("x.mjs", 'const a = html`<p>${t("x.y")}</p>`;').length, 0);
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
