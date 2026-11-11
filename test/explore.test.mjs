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
