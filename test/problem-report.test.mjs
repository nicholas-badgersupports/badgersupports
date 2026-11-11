/* Queue 60: a website problem is reported through the existing directors@ address, from a footer link to one FAQ
   answer. No form, no mail engine, and nothing about the page or the person is attached by the site. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../ops/build.mjs";

const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const links = (v, out = []) => {
  if (Array.isArray(v)) v.forEach((x) => links(x, out));
  else if (v && typeof v === "object") { if (typeof v.href === "string") out.push(v); Object.values(v).forEach((x) => links(x, out)); }
  return out;
};

test("the footer links to the FAQ's website-problem answer, and that answer exists under its anchor", () => {
  const footer = links(read("content/site.json")).find((l) => l.label === "Report a Website Problem");
  assert.ok(footer, "a footer link named Report a Website Problem");
  assert.equal(footer.href, "/about/faq/#b-faq-website-problem");
  const block = read("content/pages/about-faq.json").blocks.find((b) => b.anchor === "b-faq-website-problem");
  assert.ok(block, "the FAQ has the answer the footer points to");
});

test("the report goes to directors@ with a fixed subject and nothing taken from the page or the address bar", () => {
  const block = read("content/pages/about-faq.json").blocks.find((b) => b.anchor === "b-faq-website-problem");
  const mail = block.links.filter((l) => l.href.startsWith("mailto:"));
  assert.deepEqual(mail.map((l) => l.href), ["mailto:directors@badgersupports.org?subject=Website%20problem"]);
  assert.match(block.body.join(" "), /student directors review website reports/i, "names who triages");
  assert.match(block.body.join(" "), /does not submit a report/i, "says what happens next");
  assert.ok(!block.links.some((l) => l.href === "/resources/"), "the Find the Resource to Correct option is removed (redesign brief, 11 Nov 2026); resource corrections stay with each resource's own Report a Problem on the Resources page");
});
