/* The directory card in a page opening (pagehead `side: "directory"`, the Student Activity
   Center and University Square heroes): the card is the page's own directory begun in the
   band — its title and its first group's places, read from the directory block at render
   time. It is never a copy stored on the opening, so it cannot drift from the directory. */
import test from "node:test";
import assert from "node:assert/strict";
import { loadContent } from "../ops/build.mjs";
import { makeContext } from "../src/render/context.mjs";
import { renderPage } from "../src/render/layout.mjs";

const content = loadContent({ edits: {} });
const ctx = () => makeContext({ site: content.site, text: content.text, prototype: false, assets: { css: "/example.css", js: {} } });
const page = (id) => content.pages.find((p) => p.id === id);
const render = (p) => String(renderPage(ctx(), structuredClone(p)));
const panel = (html) => html.match(/<div class="pagehead-side is-directory">([\s\S]*?)<\/ul>/)?.[1] || "";

for (const [id, title, names] of [
  ["pg-student-activity-center", "Student Services Tower Directory", ["Student Mental Health Hub", "The Open Seat Food Pantry", "SOLI Student Organization Support", "Print &amp; Resource Center"]],
  ["pg-university-square", "University Square Directory", ["Office of Student Conduct and Community Standards", "Office of Admissions and Recruitment", "McBurney Disability Resource Center"]],
]) {
  test(`${id}: the opening stores only the ask, never a copy of the entries`, () => {
    const head = page(id).blocks.find((b) => b.type === "pagehead");
    assert.equal(head.side, "directory");
    assert.equal("sideItems" in head, false);
    assert.equal("sideTitle" in head, false);
  });

  test(`${id}: the band's card is the directory's title and its first group's places`, () => {
    const html = render(page(id));
    assert.match(html, /<section class="pagehead band has-side"/);
    const card = panel(html);
    assert.ok(card, "the card renders");
    assert.ok(card.includes(title), "the directory's own title");
    for (const n of names) assert.ok(card.includes(n), n);
    const dir = page(id).blocks.find((b) => b.type === "directory");
    assert.equal(dir.title, title);
    assert.deepEqual(dir.groups[0].items.map((it) => it.name.replaceAll("&", "&amp;")), names);
    for (const it of dir.groups[0].items) if (it.address) assert.ok(card.includes(it.address), it.address);
    assert.ok(!card.includes(dir.groups[1].items[0].name), "the second group stays below, in the directory");
  });
}

test("the card follows the directory: rename a place and the band renames it too", () => {
  const p = page("pg-student-activity-center");
  const dir = p.blocks.find((b) => b.type === "directory");
  dir.groups[0].items[0] = { ...dir.groups[0].items[0], name: "Renamed Example Hub", address: "Room 000, Example Floor" };
  dir.title = "Renamed Example Directory";
  const card = panel(render(p));
  assert.ok(card.includes("Renamed Example Hub"));
  assert.ok(card.includes("Room 000, Example Floor"));
  assert.ok(card.includes("Renamed Example Directory"));
  assert.ok(!card.includes("Student Mental Health Hub"));
});

test("an opening that asks for a card on a page with no directory renders no card", () => {
  const p = {
    id: "pg-example", path: "/example/", title: "Example",
    blocks: [{ id: "b-example-head", type: "pagehead", title: "Example", side: "directory" }],
  };
  const html = render(p);
  assert.ok(!html.includes("pagehead-side"));
  assert.ok(!html.includes("has-side"));
});
