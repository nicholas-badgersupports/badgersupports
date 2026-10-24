/* The resource list: Connect's records drawn as Connect's cards, the topics and old addresses that
   open them, the buttons that never call, and the build refusing a topic it cannot draw. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { resourceProblems } from "../src/render/blocks/resources.mjs";

const OUT = path.join(ROOT, "local", "test-build-resources");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "fixtures", "resources.json"), "utf8"));
const pageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "pages", "resources.json"), "utf8"));
let page;
const card = (id) => {
  const a = page.indexOf(`data-res="${id}"`);
  assert.ok(a > 0, `card ${id}`);
  return page.slice(a, page.indexOf("</li>", a));
};
const button = (id) => card(id).match(/<a [^>]*class="btn res-go"[^>]*>(?:<span class="go-label">)?([^<]*)/)?.[1];

test.before(async () => {
  await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
  page = read("resources/index.html");
});

test("every record in the source is a card, on campus first, and the list works without a script", () => {
  const ids = [...page.matchAll(/<li class="res-card" data-res="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, fixture.resources.length);
  assert.deepEqual([...ids].sort(), fixture.resources.map((r) => r.id).sort());
  const campus = ids.map((id) => fixture.resources.find((r) => r.id === id).location.campus);
  assert.ok(campus.lastIndexOf("on_campus") < campus.indexOf("madison_community"), "on campus before Madison");
  assert.ok(campus.lastIndexOf("madison_community") < campus.indexOf("national"), "Madison before national");
  assert.match(page, /<div class="res-tools" data-res-tools hidden>/, "the topics and search wait for the script");
  assert.match(page, /<details class="res-more"><summary>Additional Details<\/summary>/, "details open in place");
  assert.ok(page.includes(fixture.label), "a sample list says it is a sample");
  assert.match(page, /Last Updated [A-Z][a-z]+ \d{1,2}, \d{4}/);
});

test("only topics a resource carries are offered, and the old resource pages open theirs", () => {
  const topics = [...page.matchAll(/data-topic="([a-z-]*)"/g)].map((m) => m[1]);
  const carried = pageJson.blocks.find((b) => b.type === "resources").topics
    .filter((tp) => fixture.resources.some((r) => r.categories.includes(tp.category))).map((tp) => tp.id);
  assert.deepEqual(topics, ["", ...carried]);
  assert.ok(!topics.includes("transportation") && !topics.includes("research"), "a topic no resource carries is not shown");
  assert.match(page, /data-topic="mental-health" data-category="mental_emotional_health" data-aliases="health"/);
  assert.match(page, /data-topic="community" data-category="identity_belonging" data-aliases="identity-based"/);
  const redirects = read("_redirects");
  for (const t of ["basic-needs", "health", "identity-based", "general"]) {
    assert.match(redirects, new RegExp(`^/resources/${t} {2}/resources/\\?topic=${t} {2}301$`, "m"), t);
  }
});

test("no button calls, texts or emails: those say View Details, and the number stays on the card", () => {
  assert.doesNotMatch(page, /<a [^>]*class="btn res-go"[^>]*href="(tel|sms|mailto):/);
  assert.doesNotMatch(page, /<a [^>]*href="(tel|sms|mailto):[^"]*"[^>]*class="btn res-go"/);
  assert.equal(button("foodshare"), "View FoodShare", "a short label of the record's own is kept");
  assert.equal(button("access-community-health-centers"), "View Details", "a label that says Call");
  assert.equal(button("slow-food-uw"), "View Details", "Email Slow Food UW opens a web page");
  assert.equal(button("988-suicide-crisis-lifeline"), "View Details", "Text 988 opens a web page");
  assert.match(card("slow-food-uw"), /View Details<span class="sr-only">: Slow Food UW<\/span><\/span>/, "a reader hears whose details");
  assert.doesNotMatch(card("foodshare"), /<a [^>]*class="btn res-go"[^>]*>[\s\S]*?sr-only[\s\S]*?<\/a>/, "a label of the record's own needs nothing added");
  assert.match(card("988-suicide-crisis-lifeline"), /Text 988 for support\./, "the text instruction stays");
  assert.match(card("space-to-heal"), /<p class="res-tel"><a href="tel:4149394673">414-939-HOPE<\/a><\/p>/, "letters dial as their keys");
});

test("Additional Details never repeats what the card already says", () => {
  for (const r of fixture.resources) {
    const c = card(r.id);
    const what = c.match(/<p class="res-what">([^<]*)<\/p>/)?.[1];
    const more = c.match(/<div class="res-more-body">([\s\S]*)<\/div><\/details>/)?.[1] || "";
    if (what) assert.ok(!more.includes(what), `${r.id}: summary repeated`);
  }
});

test("a resource list with a topic it cannot draw fails the build", () => {
  const ok = pageJson.blocks.find((b) => b.type === "resources");
  assert.deepEqual(resourceProblems(ok), []);
  const bad = (topics) => resourceProblems({ id: "b-x", topics });
  assert.match(bad([]).join(), /needs its topics/);
  assert.match(bad([{ id: "food", label: "Food", category: "groceries" }]).join(), /category must be one of/);
  assert.match(bad([{ id: "food", label: "", category: "housing" }]).join(), /needs a label/);
  assert.match(bad([{ id: "Food Bank", label: "Food", category: "housing" }]).join(), /lower-case letters/);
  assert.match(bad([{ id: "a1", label: "A", category: "housing" }, { id: "b1", label: "B", category: "housing" }]).join(), /two topics name housing/);
  assert.match(bad([{ id: "a1", label: "A", category: "housing", aliases: ["b1"] }, { id: "b1", label: "B", category: "legal_rights" }]).join(), /"b1" names two topics/);
});
