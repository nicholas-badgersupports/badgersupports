/* Forms open by default: every shipped definition is open, a published build serves each form as its
   definition says, and a shipped intake window closes a form on its own date. A director's switch
   and saved dates still win at Send and on the page (test/staff.test.mjs, test/intake.test.mjs). */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { googleFormUrl } from "../src/shared/forms.mjs";
import { servedForms, windowReason, windowProblems } from "../src/shared/form-window.mjs";

const OUT = path.join(ROOT, "local", "test-build-launch");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const google = (id) => `https://docs.google.com/forms/d/e/${id}/viewform`;
const KEYS = fs.readdirSync(path.join(ROOT, "content/forms")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const HIRING = ["staff-application", "volunteer-application", "recommendation-letter"];
let server;

test.before(async () => {
  await build({ launch: true, out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-11-10" });
  server = JSON.parse(read("_server/server.json"));
});

test("every shipped form definition is open", () => {
  for (const key of KEYS) assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, "content/forms", `${key}.json`), "utf8")).state, "open", key);
});

test("a published build serves each form open, with the form itself on its page and no Google Form detour", () => {
  for (const key of KEYS) {
    if (["resource-problem", "resource-update"].includes(key) && server.forms[key].state === "closed") continue; // closed only when the resource list is empty
    assert.equal(server.forms[key].state, "open", key);
  }
  for (const key of ["workshop-request", "programming-feedback", ...HIRING]) {
    const page = read(`forms/${key}/index.html`);
    assert.match(page, /<form[\s>]/, key);
    assert.doesNotMatch(page, /data-form-elsewhere/, key);
    const before = page.slice(0, page.search(/<form[\s>]/));
    assert.equal((before.match(/<details[\s>]/g) || []).length, (before.match(/<\/details>/g) || []).length, `${key}: the form is not behind a fold`);
  }
});

test("the hiring forms close at 11:59 PM Chicago on 18 Dec 2026, and say so on their pages", () => {
  for (const key of HIRING) {
    assert.deepEqual(server.forms[key].intakeWindow, { closesAt: "2026-12-18T23:59" }, key);
    assert.match(read(`forms/${key}/index.html`), /Closes:<\/strong> Dec 18, 2026, 11:59\s?PM/, key);
  }
  const forms = Object.fromEntries(HIRING.map((k) => [k, server.forms[k]]));
  const before = Date.parse("2026-12-19T05:58:00Z"), after = Date.parse("2026-12-19T05:59:00Z");
  for (const key of HIRING) {
    assert.equal(servedForms(forms, before)[key].state, "open", `${key} at 11:58 PM`);
    assert.equal(servedForms(forms, after)[key].state, "closed", `${key} at 11:59 PM`);
    assert.equal(forms[key].state, "open", "the content itself is not changed");
  }
});

test("a window's shape and order are checked, and its reasons named", () => {
  assert.deepEqual(windowProblems({}), []);
  assert.deepEqual(windowProblems({ intakeWindow: { closesAt: "2026-12-18T23:59" } }), []);
  assert.deepEqual(windowProblems({ intakeWindow: { closesAt: "18 Dec" } }).map((p) => p.code), ["window-date"]);
  assert.deepEqual(windowProblems({ intakeWindow: { ends: "2026-12-18T23:59" } }).map((p) => p.code), ["window-shape"]);
  assert.deepEqual(windowProblems({ intakeWindow: { opensAt: "2026-12-19T00:00", closesAt: "2026-12-18T23:59" } }).map((p) => p.code), ["window-order"]);
  const win = { opensAt: "2026-11-01T09:00", closesAt: "2026-12-18T23:59" };
  assert.equal(windowReason(win, Date.parse("2026-10-31T12:00:00Z")), "scheduled");
  assert.equal(windowReason(win, Date.parse("2026-11-10T12:00:00Z")), null);
  assert.equal(windowReason(win, Date.parse("2026-12-20T12:00:00Z")), "ended");
  assert.equal(windowReason(undefined, 0), null);
});

test("a Google Form address is built only from a well-formed id", () => {
  assert.equal(googleFormUrl({ source: { system: "google-forms", publishedId: "1FAIpQLSdExampleExampleExample" } }), google("1FAIpQLSdExampleExampleExample"));
  for (const source of [{ system: "google-forms", publishedId: "../x" }, { system: "google-forms", publishedId: "short" }, { system: "other", publishedId: "1FAIpQLSdExampleExampleExample" }, undefined])
    assert.equal(googleFormUrl({ source }), null, JSON.stringify(source));
});
