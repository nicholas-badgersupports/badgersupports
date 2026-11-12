/* Explore Campus, writer B's items: the Resource Finder's source labels and approval gate
   (EXPLORE-C-RESOURCE-FINDER, public half), the Academic Support Navigator's tree
   (EXPLORE-G-ACADEMIC-NAV) and Discover Classes by Interest (EXPLORE-F-CLASSES).
   Each item's acceptance lines from docs/EXPLORE-CAMPUS-QUEUE-2026-11-10.md are the tests. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, loadContent, ROOT } from "../ops/build.mjs";
import { makeContext } from "../src/render/context.mjs";
import { renderBlock } from "../src/render/registry.mjs";
import { resourceVisible } from "../src/render/blocks/resources.mjs";
import { navigatorProblems, navigatorResourceProblems } from "../src/render/blocks/navigator.mjs";
import { normalizeCourses, prevTermCode, termWalk } from "../ops/courses.mjs";

const OUT = path.join(ROOT, "local", "test-build-explore");
let built = null;
test.before(async () => { await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-11-11" }); built = true; });
const builtPage = (p) => fs.readFileSync(path.join(OUT, p, "index.html"), "utf8");

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const fixtureResources = read("content/fixtures/resources.json").resources;
const own = fixtureResources.find((r) => r.id === "greater-university-tutoring-service");

/* A fixture export in the shape Connect's public resource export carries: one of the list's own
   records, one approved KnowledgeBase article, one KnowledgeBase record Connect has not
   approved, and one of the list's own records carrying its source. */
const kb = (extra) => ({
  ...structuredClone(own), id: "kb-test-article", name: "KB Test Article",
  summary: "A KnowledgeBase article Connect carries as a resource record.",
  categories: ["academic_learning"], primaryCategory: "academic_learning",
  source: { kind: "kb", publisher: "UW–Madison KnowledgeBase", url: "https://kb.wisc.edu/example-article", reviewedAt: "2026-10-14", reviewedBy: "KnowledgeBase editors (role)", ...extra },
});
const EXPORT = [
  structuredClone(own),
  kb({ status: "approved" }),
  kb({ id: "kb-unapproved", status: "submitted" }),
  { ...structuredClone(own), id: "own-marked", name: "Own Marked Resource", source: { kind: "badger-supports", status: "approved", reviewedAt: "2026-09-01" } },
];

test("EXPLORE-C: an unapproved outside record is not rendered, whatever carries it", () => {
  assert.equal(resourceVisible(own), true, "no source: shown, as before");
  assert.equal(resourceVisible(kb({ status: "approved" })), true);
  assert.equal(resourceVisible(kb({ status: "submitted" })), false, "not yet approved in Connect");
  assert.equal(resourceVisible(kb({ status: undefined })), false, "an outside record with no approval state is not shown");
  assert.equal(resourceVisible({ source: { kind: "badger-supports" } }), true, "the list's own records need no status");
});

test("EXPLORE-C: a fixture export shows the own record and the approved KB article, correctly labelled", () => {
  const { text } = loadContent();
  const block = read("content/pages/resources.json").blocks.find((b) => b.type === "resources");
  const ctx = makeContext({ site: {}, media: { items: [] }, builtPaths: [], routes: [], text, today: "2026-11-11",
    data: { resources: EXPORT, resourcesSample: null, resourcesUpdated: "2026-11-01", resourcesState: null } });
  const page = String(renderBlock(block, ctx));
  const card = (id) => { const a = page.indexOf(`data-res="${id}"`); return a < 0 ? "" : page.slice(a, page.indexOf("</li>", a)); };
  assert.ok(card("greater-university-tutoring-service"), "the own record renders");
  assert.ok(!card("greater-university-tutoring-service").includes("res-source"), "a record with no source keeps its card unchanged");
  assert.ok(card("kb-test-article"), "the approved KB article renders beside it in one list");
  assert.match(card("kb-test-article"), /Source:<\/span> UW–Madison KnowledgeBase/, "labelled by source and publisher");
  assert.match(card("kb-test-article"), /Last Reviewed October 14, 2026/, "with its review date");
  assert.match(card("kb-test-article"), /href="https:\/\/kb\.wisc\.edu\/example-article"/, "the card's link is the official article");
  assert.equal(card("kb-unapproved"), "", "the unapproved KB record is not rendered");
  assert.match(card("own-marked"), /Source:<\/span> Badger Supports/, "the list's own records are labelled too when the export marks them");
  assert.match(page, /3 Resources/, "the count announced is the count shown");
});

/* ---------- EXPLORE-G: the Academic Support Navigator ---------- */

const navBlock = read("content/pages/explore-academic-support.json").blocks.find((b) => b.type === "navigator");
const clone = (x) => structuredClone(x);

test("EXPLORE-G: the shipped tree joins up, and every leaf names a resource the library holds", () => {
  assert.deepEqual(navigatorProblems(navBlock), []);
  assert.deepEqual(navigatorResourceProblems(navBlock, fixtureResources), []);
  const leaves = navBlock.steps.flatMap((s) => s.options.filter((o) => o.results));
  assert.ok(leaves.length >= 5, "the tree has real leaves");
  for (const leaf of leaves) assert.ok(leaf.results.length >= 1, "every leaf resolves to at least one approved resource");
});

test("EXPLORE-G: a tree that does not join up, or names an unknown resource, is refused", () => {
  const both = clone(navBlock); both.steps[0].options[0].next = "course";
  assert.match(navigatorProblems(both).join(), /goes to one place/, "a choice cannot go to a step and a set of resources");
  const missing = clone(navBlock); missing.steps[0].options[2].next = "nowhere";
  assert.match(navigatorProblems(missing).join(), /which is not a step/);
  const orphan = clone(navBlock); orphan.steps.push({ id: "lost", prompt: "Lost?", options: [{ id: "xx", label: "X", results: ["greater-university-tutoring-service"] }] });
  assert.match(navigatorProblems(orphan).join(), /not reachable from the first step/);
  const dead = clone(navBlock); dead.steps[1].options = [{ id: "loop", label: "Loop", next: "course" }];
  assert.match(navigatorProblems(dead).join(), /can never reach a set of resources/);
  const unknown = clone(navBlock); unknown.steps[0].options[0].results = ["no-such-resource"];
  assert.match(navigatorResourceProblems(unknown, fixtureResources).join(), /which the resource library does not hold/, "a test fails on an unknown id");
});

test("EXPLORE-G: the built page walks to real cards, and the full finder is linked at every step", () => {
  assert.ok(built);
  const page = builtPage("explore/academic-support");
  const section = page.slice(page.indexOf("data-navigator"), page.indexOf("</section>", page.indexOf("data-navigator")));
  const panels = [...section.matchAll(/data-nav-panel/g)].length;
  assert.equal(panels, 10, "two questions and eight sets of results");
  assert.equal([...section.matchAll(/href="\/resources\/"/g)].length, panels, "See All Resources is present at every step");
  assert.equal([...section.matchAll(/data-res="greater-university-tutoring-service"/g)].length, 3, "tutoring ends on the tutoring service from three paths");
  assert.match(section, /data-res="mcburney-disability-resource-center"/, "accommodations end on McBurney");
  assert.match(section, /data-nav-go="b-nav-step-course"/, "the course choice goes to the second question");
  assert.doesNotMatch(section, /<input|<textarea|<select/, "no free-text personal data is asked for");
});

/* ---------- EXPLORE-F: Discover Classes by Interest ---------- */

const TERMS = [
  { code: "1266", label: "Summer 2026", kind: "recent" },
  { code: "1272", label: "Fall 2026", kind: "current" },
  { code: "1274", label: "Spring 2027", kind: "upcoming" },
];
const MAPPING = [{ id: "languages", label: "Languages", subjects: ["872"] }, { id: "music", label: "Music", subjects: ["660"] }];
const hit = (id, subjectCode, number, title) => ({ courseId: id, subject: { subjectCode, shortDescription: subjectCode === "872" ? "SCAND ST" : "MUSIC" }, catalogNumber: number, title, creditRange: "3", breadths: [] });

test("EXPLORE-F: term codes step by two and roll at the season digit, labelled from the anchors", () => {
  assert.equal(prevTermCode("1272"), "1266");
  assert.equal(prevTermCode("1266"), "1264");
  assert.equal(prevTermCode("1262"), "1256");
  const walk = termWalk([{ code: "1272", season: "Fall", year: 2026 }, { code: "1274", season: "Spring", year: 2027 }], 3);
  assert.equal(walk.get("1266").label, "Summer 2026");
  assert.equal(walk.get("1264").label, "Spring 2026");
  assert.equal(walk.get("1262").label, "Fall 2025");
});

test("EXPLORE-F: offerings classify as open or recently offered, by their own term", () => {
  const hits = {
    "1266": [hit("fall-only", "872", "101", "First Semester Norwegian"), hit("both", "872", "201", "Nordic Storytelling")],
    "1272": [hit("both", "872", "201", "Nordic Storytelling")],
    "1274": [hit("spring-only", "872", "102", "Second Semester Norwegian")],
  };
  const out = normalizeCourses(hits, TERMS, MAPPING);
  const byId = Object.fromEntries(out.map((c) => [c.id, c]));
  assert.equal(byId["fall-only"].open, null, "a course offered only in a past term is not available now");
  assert.equal(byId["fall-only"].offered, "Summer 2026", "recently offered, with that term");
  assert.equal(byId["spring-only"].open, "Spring 2027", "a published upcoming section shows as available, with its term");
  assert.equal(byId["both"].open, "Fall 2026", "the earliest enterable term is the label");
  assert.equal(byId["both"].offered, "Summer 2026", "its past offering is still on the record");
  assert.deepEqual(out.map((c) => c.id), ["spring-only", "both", "fall-only"], "available courses come before recently offered ones, by subject then number within a group");
});

test("EXPLORE-F: a course with no published offering in the window, or outside the mapping, is excluded", () => {
  const hits = { "1272": [hit("unmapped", "448", "101", "A History Course")] };
  assert.deepEqual(normalizeCourses(hits, TERMS, MAPPING), [], "not the mapping's to show");
  assert.deepEqual(normalizeCourses({}, TERMS, MAPPING), [], "a catalog entry with no offering in any served term never reaches the list");
  const outside = normalizeCourses({ "1256": [hit("old", "872", "101", "First Semester Norwegian")] }, TERMS, MAPPING);
  assert.deepEqual(outside, [], "an offering outside the verified window does not count");
});

test("EXPLORE-F: the built page shows the pulled courses with their terms and the official link", () => {
  assert.ok(built);
  const data = read("content/fixtures/courses.json");
  const page = builtPage("explore/classes");
  const section = page.slice(page.indexOf("data-courses"), page.indexOf("</section>", page.indexOf("data-courses")));
  assert.ok(section.includes(data.label), "the sample pull says what it is until the owner accepts the verification note");
  assert.equal([...section.matchAll(/<li class="cls-card"/g)].length, data.courses.length, "every pulled course is a card");
  const card = (desig) => { const a = section.indexOf(desig); return a < 0 ? "" : section.slice(a, section.indexOf("</li>", a)); };
  assert.match(card("SCAND ST 101"), /Open for Fall 2026/, "the fall-only Norwegian course is open for the fall term it is published in");
  assert.match(card("SCAND ST 102"), /Open for Spring 2027/, "the spring-only course is open for spring, not shown as available now");
  assert.match(section, /href="https:\/\/public\.enroll\.wisc\.edu\/search"/, "cards link to UW Course Search");
  assert.doesNotMatch(section, /guarantee|might|may not be offered|uncertain/i, "no card carries future-uncertainty helper text; the term label does the work");
});
