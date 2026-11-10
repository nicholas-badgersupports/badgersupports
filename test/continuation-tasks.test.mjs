import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BLOCKS } from "../src/render/registry.mjs";
import { makeContext } from "../src/render/context.mjs";
import { resolveText } from "../src/shared/text.mjs";

const read = name => JSON.parse(fs.readFileSync(new URL(`../content/${name}.json`, import.meta.url)));
const text = resolveText(read("text"));
const ctx = (events, now, today) => makeContext({ site: {}, text, data: { events }, today, now: Date.parse(now), builtPaths: ["/join/email-list/", "/directions/sac-mhh/"] });

test("unresolved event times offer contact instead of attendance or calendar actions", () => {
  const events = { recurring: [], dated: [{ id: "gap", title: "Example Night", date: "2026-03-08", start: "02:30", end: "03:30", place: "room" }], places: { room: { name: "Example Room", href: "/directions/sac-mhh/" } } };
  for (const type of ["eventhero", "events", "schedule"]) {
    const block = { id: "b-gap", type, title: "Example Events", source: "events" };
    const out = String(BLOCKS[type].render(block, ctx(events, "2026-03-08T06:00:00Z", "2026-03-08")));
    assert.match(out, /Time needs confirmation/); assert.match(out, /mailto:directors@badgersupports.org/);
    assert.doesNotMatch(out, /href="[^"]*calendar\/|class="drop"|class="btn btn--big"/);
  }
});

test("Home program facts point to its current schedule without a second timetable", () => {
  const page = read("pages/home"), group = page.blocks.find(b => b.id === "b-home-groups");
  assert.ok(group.links.some(l => l.href === "#this-week"));
  assert.ok(page.blocks.some(b => b.type === "schedule" && b.anchor === "this-week" && b.source === "events"));
  assert.doesNotMatch(group.facts.map(f => f.text).join(" "), /Mon–Thu|5–6 PM|7–8 PM|3203/);
  assert.equal(group.facts[0].term, "When"); assert.equal(group.facts[1].term, "Where"); assert.equal(group.facts[2].term, "Who");
});

test("program comparison exposes attend request and written-support destinations", () => {
  const page = read("pages/about-what-we-do"), head = page.blocks[0];
  assert.equal(head.primary.href, "/join/peer-support-groups/");
  for (const href of ["/join/craft-nights/", "/forms/workshop-request/", "https://badgerspill.org/#spill-form"]) assert.ok(head.links.some(l => l.href === href));
  assert.doesNotMatch(page.blocks.find(b => b.id === "b-wwd-craft").body.join(" "), /Every other week/);
});

test("program requests preserve Housing context and separate booking from written support", () => {
  const page = read("pages/request-a-program"), head = page.blocks[0];
  const choose = page.blocks.find(b => b.id === "b-rp-choose");
  assert.match(choose.steps.map(s => s.text).join(" "), /not a confirmed booking/, "the request steps say a request is not a booking");
  assert.equal(head.primary.href, "#b-rp-choose", "one main action near the top");
  assert.equal(page.blocks.find(b => b.id === "b-rp-housing").links[0].href, "/forms/workshop-request/?topic=housing");
  for (const id of ["b-rp-workshops", "b-rp-groups", "b-rp-training", "b-rp-housing"]) assert.ok(choose.items.some(c => c.link.href === `#${id}`), id);
  for (const [id, choice] of [["b-rp-training", "volunteer_training"], ["b-rp-groups", "peer_support_group"]]) {
    const url = new URL(page.blocks.find(b => b.id === id).links[0].href, "https://example.org");
    assert.equal(url.pathname, "/forms/program-request/");
    assert.equal(url.searchParams.get("topic"), choice);
  }
  const spill = page.blocks.find(b => b.id === "b-rp-spill");
  assert.equal(spill.primary.href, "https://badgerspill.org/#spill-form");
  assert.ok(spill.body.some(p => /For written peer support/.test(p)));
});
