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
