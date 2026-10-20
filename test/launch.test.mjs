/* The forms as they launch (owner, 20 Oct 2026): every open form closed, its page linking the Google
   Form it replaces, until Connect shows submissions to the team that answers them. The prototype
   build keeps them open; the other suites cover that. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { googleFormUrl, launchForms } from "../src/shared/forms.mjs";

const OUT = path.join(ROOT, "local", "test-build-launch");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const google = (id) => `https://docs.google.com/forms/d/e/${id}/viewform`;
let server;

test.before(async () => {
  await build({ launch: true, out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
  server = JSON.parse(read("_server/server.json"));
});

test("each open form's page holds no form, only the button to its Google Form", () => {
  for (const key of ["workshop-request", "programming-feedback"]) {
    const page = read(`forms/${key}/index.html`);
    const id = JSON.parse(fs.readFileSync(path.join(ROOT, "content/forms", `${key}.json`), "utf8")).source.publishedId;
    assert.doesNotMatch(page, /<form[\s>]/, key);
    assert.match(page, new RegExp(`<a class="btn btn--big" href="${google(id).replace(/[.?/]/g, "\\$&")}" data-form-elsewhere><span class="go-label">Fill Out Our Form</span>`), key);
    assert.doesNotMatch(page, /class="closed-panel"[^>]*>\s*<h2>/, `${key}: no closing message under a form that has only moved`);
  }
});

test("the server holds the same forms closed, so a submission is refused there too", () => {
  for (const key of ["workshop-request", "programming-feedback"]) {
    assert.equal(server.forms[key].state, "closed", key);
    assert.match(server.forms[key].elsewhere, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform$/, key);
  }
});

test("a form that was already closed keeps its own message, and its door still says Closed", () => {
  const staff = server.forms["staff-application"];
  assert.equal(staff.state, "closed");
  assert.equal(staff.elsewhere, undefined);
  assert.match(read("join/get-involved/index.html"), /<span class="chip chip--closed">/);
});

test("a Google Form address is built only from a well-formed id", () => {
  assert.equal(googleFormUrl({ source: { system: "google-forms", publishedId: "1FAIpQLSdExampleExampleExample" } }), google("1FAIpQLSdExampleExampleExample"));
  for (const source of [{ system: "google-forms", publishedId: "../x" }, { system: "google-forms", publishedId: "short" }, { system: "other", publishedId: "1FAIpQLSdExampleExampleExample" }, undefined])
    assert.equal(googleFormUrl({ source }), null, JSON.stringify(source));
  const forms = { a: { key: "a", state: "open" }, b: { key: "b", state: "closed", closedMessage: "x" } };
  assert.deepEqual(launchForms(forms), { a: { key: "a", state: "closed", elsewhere: null }, b: forms.b });
  assert.equal(forms.a.state, "open", "the content itself is not changed");
});
