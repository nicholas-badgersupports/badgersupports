/* Queue item 22: the analytics forwarder and the configuration a build carries. The forwarder's
   dictionary is tested as a pure function; the builds are tested as pages and headers: without a
   verified measurement id a build carries no island and allows no Google host, and with one it
   carries both, while the staff page's own label still keeps it unmeasured. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT, analyticsConfig, cspHeader } from "../ops/build.mjs";
import { cleanEvent, measurable } from "../src/client/analytics.js";

const LISTS = { forms: ["workshop-request", "resource-suggestion"], places: ["sac-mhh", "lcm"] };

test("the dictionary forwards a named event with only its named parameters", () => {
  assert.deepEqual(cleanEvent("form_start", { form: "workshop-request" }, LISTS), { form: "workshop-request" });
  assert.deepEqual(cleanEvent("form_submit_success", { form: "workshop-request", email: "a@example.org", note: "free text" }, LISTS), { form: "workshop-request" });
  assert.deepEqual(cleanEvent("drop_in", { place: "sac-mhh" }, LISTS), { place: "sac-mhh" });
  assert.deepEqual(cleanEvent("calendar_add", {}, LISTS), {});
  assert.deepEqual(cleanEvent("reel_play", { anything: "dropped" }, LISTS), {});
});

test("the dictionary drops an unnamed event and a value outside the closed lists", () => {
  assert.equal(cleanEvent("page_view", { page_path: "/join/" }, LISTS), null);
  assert.equal(cleanEvent("sign_in", { form: "workshop-request" }, LISTS), null);
  assert.equal(cleanEvent("form_start", { form: "not-a-form" }, LISTS), null);
  assert.equal(cleanEvent("form_start", {}, LISTS), null);
  assert.equal(cleanEvent("drop_in", { place: "not-a-place" }, LISTS), null);
  assert.equal(cleanEvent("drop_in", { place: 42 }, LISTS), null);
});

test("a page is measurable only when its label is public and its path is not private", () => {
  assert.equal(measurable({ label: "public", path: "/" }), true);
  assert.equal(measurable({ label: "public", path: "/join/peer-support-groups/" }), true);
  assert.equal(measurable({ label: "none", path: "/" }), false);
  assert.equal(measurable({ label: undefined, path: "/" }), false);
  assert.equal(measurable({ label: "public", path: "/staff/" }), false);
  assert.equal(measurable({ label: "public", path: "/staff" }), false);
  assert.equal(measurable({ label: "public", path: "/api/forms/workshop-request" }), false);
});

test("a build carries a measurement id only when the value has a measurement id's shape", () => {
  const content = { forms: [{ key: "workshop-request" }, { key: "resource-suggestion" }], places: [{ id: "sac-mhh" }] };
  assert.equal(analyticsConfig({}, content), null);
  assert.equal(analyticsConfig({ GA_MEASUREMENT_ID: "" }, content), null);
  assert.equal(analyticsConfig({ GA_MEASUREMENT_ID: "not-an-id" }, content), null);
  assert.equal(analyticsConfig({ GA_MEASUREMENT_ID: "g-test12345" }, content), null);
  assert.deepEqual(analyticsConfig({ GA_MEASUREMENT_ID: "G-TEST12345" }, content), {
    id: "G-TEST12345",
    forms: ["workshop-request", "resource-suggestion"],
    places: ["sac-mhh"],
  });
});

test("the policy allows Google's hosts only for a configured build", () => {
  assert.doesNotMatch(cspHeader(false), /google/);
  const csp = cspHeader(true);
  assert.match(csp, /script-src[^;]*https:\/\/\*\.googletagmanager\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/\*\.google-analytics\.com https:\/\/\*\.googletagmanager\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/\*\.google-analytics\.com https:\/\/\*\.analytics\.google\.com https:\/\/\*\.googletagmanager\.com/);
});

const OFF = path.join(ROOT, "local", "test-build-analytics-off");
const ON = path.join(ROOT, "local", "test-build-analytics-on");
const readFrom = (out) => (p) => fs.readFileSync(path.join(out, p), "utf8");

test.before(async () => {
  delete process.env.GA_MEASUREMENT_ID;
  await build({ out: OFF, serverDir: path.join(OFF, "_server"), media: false, today: "2026-10-20" });
  process.env.GA_MEASUREMENT_ID = "G-TEST12345";
  try {
    await build({ out: ON, serverDir: path.join(ON, "_server"), media: false, today: "2026-10-20" });
  } finally {
    delete process.env.GA_MEASUREMENT_ID;
  }
});

test("an unconfigured build loads the forwarder and nothing of Google's", () => {
  const read = readFrom(OFF);
  const home = read("index.html");
  assert.match(home, /<script type="module" src="\/assets\/js\/[a-z0-9]+\/analytics\.js">/);
  assert.doesNotMatch(home, /bss-analytics/);
  assert.doesNotMatch(home, /googletagmanager|google-analytics/);
  assert.doesNotMatch(read("_headers"), /google/);
});

test("a configured build carries the id and the closed lists, and its policy allows the tag", () => {
  const read = readFrom(ON);
  const home = read("index.html");
  const island = JSON.parse(home.match(/<script type="application\/json" id="bss-analytics">([^<]*)<\/script>/)[1]);
  assert.equal(island.id, "G-TEST12345");
  assert.ok(island.forms.includes("workshop-request"), "the workshop form is on the list");
  assert.ok(island.places.includes("sac-mhh"), "the Hub is on the list");
  const csp = read("_headers").match(/Content-Security-Policy: (.*)/)[1];
  assert.match(csp, /script-src[^;]*https:\/\/\*\.googletagmanager\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/\*\.google-analytics\.com/);
  const staff = read(path.join("staff", "index.html"));
  assert.match(staff, /data-analytics="none"/, "the staff page's label still refuses measurement");
});
test("the publish build is given the owner's measurement id, and no other build is", () => {
  // The hand-off that switches measurement on (owner's decision, 13 Nov 2026): the publish
  // file deploys through Netlify's command line with --context production, which applies
  // this table's environment to the build it runs. The id is the owner's own, supplied
  // 12 Nov 2026; it is printed in every measured page, so it is configuration, not a secret.
  const toml = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
  const section = toml.match(/\[context\.production\.environment\]\s*\n([^[]*)/);
  assert.ok(section, "netlify.toml carries a production environment table");
  assert.match(section[1], /GA_MEASUREMENT_ID = "G-XVT9XWRVQ5"/);
  assert.equal((toml.match(/GA_MEASUREMENT_ID\s*=\s*"/g) || []).length, 1,
    "only the production build is given an id; prototype and preview builds stay unconfigured");
});
