import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BLOCKS } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";
import { resolveText } from "../src/shared/text.mjs";
import { applyEdits, pageStrings, pageValues, valueProblem } from "../src/shared/edits.mjs";

import { questionProblems } from "../src/render/blocks/questions.mjs";
import { emptyStructure, applyChange } from "../src/shared/structure.mjs";

const read = name => JSON.parse(fs.readFileSync(new URL(`../content/${name}.json`, import.meta.url)));
const text = resolveText(read("text"));
const ctx = (events, { stale = false, now = "2026-11-03T12:00:00-06:00" } = {}) => makeContext({ site: { origin: "https://example.org", liveOrigin: "https://example.org", connectOrigin: "https://connect.example.org" }, text, data: { events, eventsState: { stale } }, now: Date.parse(now), today: "2026-11-03", builtPaths: ["/join/peer-support-groups/", "/join/email-list/", "/directions/sac-mhh/", "/directions/sac-caucus/"] });
const intro = () => ({ ...read("pages/peer-support-groups").blocks[0], upcoming: { source: "events", program: "peer", count: 1 } });
const events = (items = []) => ({ recurring: [], dated: items, places: { hub: { name: "Example Hub", href: "/directions/sac-mhh/" }, changed: { name: "Changed Room", href: "/directions/sac-caucus/" } } });
const visit = (id, day = "2026-11-03", place = "changed") => ({ id, title: "Example Group", program: "peer", date: day, start: "17:00", end: "18:00", place });

test("FAQ display groups retain native answer anchors and useful links", () => {
  const block = { id: "b-faq", type: "questions", title: "Questions", items: [{ id: "q-first", q: "Where?", a: "Use the current schedule.", links: [{ label: "Find a Group", href: "/join/peer-support-groups/" }] }, { id: "q-second", q: "What?", a: ["Peer support."] }], groups: [{ id: "visit", title: "First Visit", questionIds: ["q-second", "q-first"] }] };
  const out = String(BLOCKS.questions.render(block, ctx(events())));
  assert.match(out, /id="b-faq-visit"/); assert.match(out, /<h3[^>]*>First Visit<\/h3>/);
  assert.ok(out.indexOf('id="q-second"') < out.indexOf('id="q-first"'));
  assert.match(out, /<details id="q-first"><summary>/);
  assert.match(out, /href="\/join\/peer-support-groups\/"/);
  assert.doesNotMatch(out, /<input|<textarea|<form/);
});

test("the first-visit action follows the current occurrence room and exact end", () => {
  const source = events([visit("first"), visit("later", "2026-11-04", "hub")]);
  const render = options => String(BLOCKS.program.render(intro(), ctx(source, options)));
  const before = render({}); assert.match(before, /class="btn visit-action"[^>]*href=|href="\/directions\/sac-caucus\/" class="btn visit-action"/);
  assert.match(before, /Changed Room/); assert.match(before, /data-live="visit"/);
  const after = render({ now: "2026-11-03T18:00:00-06:00" });
  const live = after.match(/<div data-live="visit">([\s\S]*?)<\/article>/)?.[1] || "";
  assert.match(live, /Example Hub/); assert.doesNotMatch(live, /Changed Room/);
});

test("empty and unavailable first-visit schedules have distinct honest actions", () => {
  const empty = String(BLOCKS.program.render(intro(), ctx(events())));
  assert.match(empty, /No upcoming peer support group/); assert.match(empty, /href="\/join\/email-list\/"/);
  assert.doesNotMatch(empty, /class="btn visit-action"/);
  const stale = String(BLOCKS.program.render(intro(), ctx(events([visit("old")]), { stale: true })));
  assert.match(stale, /couldn’t confirm the current schedule/); assert.match(stale, /mailto:directors@badgersupports.org/);
  assert.doesNotMatch(stale, /class="btn visit-action"/);
});

test("expectations use an optional native disclosure and retain existing edit targets", () => {
  const page = read("pages/peer-support-groups"), how = page.blocks.find(b => b.id === "b-pg-how");
  const block = { ...how, photos: [], disclosure: "Read What to Expect" };
  const out = String(BLOCKS.program.render(block, ctx(events())));
  assert.match(out, /<details class="program-details" id="b-pg-how-details"><summary>/);
  const target = "page:pg-peer-groups:b-pg-how/topics/1/text";
  assert.ok(pageStrings(page).some(row => row.target === target));
  applyEdits({ [target]: "Example saved expectations wording." }, { site: {}, pages: [page], text: {} });
  assert.equal(page.blocks.find(b => b.id === "b-pg-how").topics[1].text, "Example saved expectations wording.");
  assert.doesNotMatch(out, /<input|<textarea|<form/);
});

const faqBlock = () => ({ id: "b-questions", type: "questions", title: "Questions", items: [{ id: "q-first", q: "Where?", a: "See the schedule." }, { id: "q-second", q: "How?", a: ["Drop in."] }], groups: [{ id: "visit", title: "First Visit", questionIds: ["q-first", "q-second"] }] });

test("question validation rejects missing, repeated and hidden references and incomplete answers", () => {
  assert.deepEqual(questionProblems(faqBlock()), []);
  const changes = [
    [b => b.items = [], "at least one answer"],
    [b => b.items.push({ ...b.items[0] }), "each question needs its own id"],
    [b => b.items[0].a = [], "one or more answer paragraphs"],
    [b => b.items[0].a = [""], "one or more answer paragraphs"],
    [b => b.groups[0].questionIds.push("q-unknown"), "each existing question once"],
    [b => b.groups[0].questionIds.push("q-first"), "each existing question once"],
    [b => b.groups[0].questionIds.pop(), "cannot hide a question"],
    [b => b.groups[0].questionIds = [], "every display group needs question ids"],
    [b => b.groups.push({ ...b.groups[0] }), "distinct ids and titles"],
    [b => b.groups[0].title = "", "distinct ids and titles"],
    [b => b.groups = [], "display groups need a title and question ids"],
  ];
  for (const [change, phrase] of changes) { const b = faqBlock(); change(b); assert.ok(questionProblems(b).some(p => p.includes(phrase)), String(change)); }
});

test("source answer links and saved links reject unsafe addresses", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,bad", "http://example.org/", "https://name:pass@example.org/", "//evil/", "//evil/path", "https://example.org/<bad>"]) {
    const b = faqBlock(); b.items[0].links = [{ label: "Open", href }];
    assert.ok(questionProblems(b).length, `source: ${href}`);
    assert.ok(valueProblem("link", href), `saved: ${href}`);
  }
  for (const href of ["/join/peer-support-groups/#b-pg-days", "#q-first", "https://example.org/", "mailto:directors@badgersupports.org", "tel:608-265-5600"]) assert.equal(valueProblem("link", href), null, href);
});

test("copied questions remap references even when group and question ids match", () => {
  const b = faqBlock(); b.groups[0].id = "q-first";
  const page = { id: "pg-test", path: "/test/", title: "Test", blocks: [b] }, site = { nav: [] };
  const r = applyChange(emptyStructure(), { action: "sectionCopy", page: page.id, section: b.id }, { pages: [page], site, authored: new Set([page.id]), links: [] });
  const copy = r.doc.pages[page.id].sections.made[r.section];
  assert.deepEqual(questionProblems(copy), []);
  const html = String(BLOCKS.questions.render(copy, ctx(events())));
  for (const q of copy.items) assert.equal(html.split(`id="${q.id}"`).length - 1, 1);
});

test("FAQ groups are structural references while all visitor words and answer links remain editable", () => {
  const page = read("pages/about-faq"), rows = pageStrings(page), values = pageValues(page);
  assert.ok(!rows.some(r => r.target.includes("questionIds")));
  assert.ok(rows.some(r => r.target.endsWith("groups/0/title")));
  assert.ok(values.some(r => r.target.endsWith("items/0/links/0/href")));
  for (const [i,id] of ["q-group-therapy", "q-only-uw", "q-mental-illness", "q-group-size", "q-when-where"].entries()) assert.equal(page.blocks[1].items[i].id, id);
  const target = "page:pg-about-faq:b-faq-groups/items/0/a";
  applyEdits({ [target]: "Saved answer example." }, { pages: [page], site: {}, text: {} });
  const html = String(BLOCKS.questions.render(page.blocks[1], ctx(events())));
  assert.match(html, /Saved answer example/);
});

test("linked display-group and expectations anchors prevent section retirement", () => {
  const group = faqBlock(), expectations = { ...read("pages/peer-support-groups").blocks.find(b => b.id === "b-pg-how"), anchor: "expectations" };
  for (const [b, target] of [[group, "b-questions-visit"], [group, "b-questions-visit-h"], [expectations, "expectations-details"]]) {
    const page = { id: "pg-test", path: "/test/", blocks: [b] };
    const context = { site: {}, pages: [page], authored: new Set([page.id]), links: [{ from: { page: "pg-other", block: "b-link" }, href: `/test/#${target}` }] };
    assert.throws(() => applyChange(emptyStructure(), { action: "sectionRetire", page: page.id, section: b.id }, context), e => e.code === "section.linked", target);
  }
});

test("missing rooms and unresolved times offer a contact action instead of directions", () => {
  for (const row of [{ ...visit("missing"), place: "absent" }, { ...visit("unknown"), end: "16:00" }]) {
    const out = String(BLOCKS.program.render(intro(), ctx(events([row]))));
    assert.doesNotMatch(out, /class="btn visit-action"/);
    assert.match(out, /mailto:directors@badgersupports.org/);
  }
});
