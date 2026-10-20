/* The About pages: the team from Connect's opt-in profiles, each person's own page, What We Do and
   the FAQ. Every person here is fictional (content/fixtures/team.json). */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { teamProblems } from "../src/render/team.mjs";

const OUT = path.join(ROOT, "local", "test-build-team");
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const section = (page, id) => {
  const m = page.match(new RegExp(`<section [^>]*data-block="${id}"[^>]*>([\\s\\S]*?)</section>`));
  assert.ok(m, `section ${id}`);
  return m[0];
};
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fixtures/team.json"), "utf8"));

test.before(async () => {
  await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-10-20" });
});

test("every published person has a page, and an unpublished one has neither page nor card", () => {
  for (const p of FIXTURE.people.filter((x) => x.published)) assert.ok(fs.existsSync(path.join(OUT, "about/our-team", p.slug, "index.html")), p.slug);
  assert.ok(!fs.existsSync(path.join(OUT, "about/our-team/jamie-unlisted")));
  assert.doesNotMatch(read("about/our-team/index.html"), /jamie-unlisted|Jamie Unlisted/);
});

test("the team page names its groups, says once that the people are samples, and shows initials", () => {
  const page = read("about/our-team/index.html");
  const team = section(page, "b-team");
  const heads = [...team.matchAll(/<h3 class="team-group-h" id="b-team-([a-z-]+)">([^<]+)<\/h3>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(heads, [["directors", "Staff Directors"], ["associate-directors", "Associate Directors"], ["staff", "General Staff"], ["volunteers", "Volunteers"]]);
  assert.equal([...team.matchAll(/class="team-group has-h"/g)].length, 4);
  assert.match(team, /<ul class="people" aria-labelledby="b-team-directors">/);
  assert.match(team, /<span class="monogram" aria-hidden="true">AE<\/span>/);
  const advisors = section(page, "b-team-advisors");
  assert.doesNotMatch(advisors, /team-group-h|has-h/, "the advisors block names its one group once, in its heading");
  assert.match(advisors, /<ul class="people" aria-labelledby="b-team-advisors-h">/);
  assert.equal([...page.matchAll(/class="sample-note"/g)].length, 1);
});

test("the team's cards show the role over the photo, and the advisors' show their full title", () => {
  const page = read("about/our-team/index.html");
  const team = section(page, "b-team");
  const advisors = section(page, "b-team-advisors");
  assert.ok([...team.matchAll(/<li class="person ([^"]+)"/g)].every((m) => m[1] === "is-role"));
  assert.ok([...advisors.matchAll(/<li class="person ([^"]+)"/g)].every((m) => m[1] === "is-title"));
  // The link reads name first; the stylesheet lifts the role above the photo.
  assert.match(team, /<span class="person-name">Avery Example<\/span>\s*<span class="person-role">[^<]+<\/span>/);
  assert.match(advisors, /<span class="person-name">[^<]+<\/span>\s*<span class="person-role">Faculty Advisor<\/span>/);
  const css = fs.readFileSync(path.join(ROOT, "src/styles/blocks.css"), "utf8");
  assert.match(css, /\.people \{[^}]*grid-template-columns: repeat\(4, minmax\(0, ?1fr\)\)/);
  assert.match(css, /\.person\.is-role \.person-role \{[^}]*order: -1/);
  assert.match(css, /@supports \(grid-template-rows: subgrid\) \{\s*\.person, \.person-link \{[^}]*grid-template-rows: subgrid/, "cards in a row share their lines");
  assert.doesNotMatch(team, /<img[^>]*class="[^"]*team-group/, "group headings are words, never pictures");
});

test("a person's page writes to them only if they published a contact", () => {
  const avery = read("about/our-team/avery-example/index.html");
  assert.match(avery, /<h1 id="b-person-h">Avery Example<\/h1>/);
  assert.match(avery, /href="mailto:avery\.example@example\.org"[^>]*>[\s\S]*?Connect with Avery/);
  assert.match(avery, /class="profile-more"/);
  const jordan = section(read("about/our-team/jordan-placeholder/index.html"), "b-person");
  assert.doesNotMatch(jordan, /mailto:|profile-contact/);
});

test("the old group addresses go to the team page, and the FAQ's old address to the FAQ", () => {
  const lines = read("_redirects").split("\n");
  const team = "/about/" + "our-team/";
  for (const g of ["advisors", "directors", "general-staff", "volunteers"]) {
    assert.ok(lines.includes(`${team}${g}/*  ${team}  301`), g);
  }
  assert.ok(lines.includes("/about/f-a-q  /about/faq/  301"));
});

test("a public contact must be an organisation address", () => {
  const bad = { ...FIXTURE, people: [{ ...FIXTURE.people[0], contact: "name@wisc.edu" }] };
  assert.ok(teamProblems(bad).some((x) => /organisation address/.test(x)));
  assert.deepEqual(teamProblems(FIXTURE), []);
});

test("What We Do and the FAQ open with one heading and one big button", () => {
  for (const [p, id, h] of [["about/what-we-do/index.html", "b-wwd-head", "What We Do"], ["about/faq/index.html", "b-faq-head", "Frequently Asked Questions"]]) {
    const page = read(p);
    assert.equal([...page.matchAll(/<h1[ >]/g)].length, 1, p);
    const head = section(page, id);
    assert.match(head, new RegExp(`<h1 id="${id}-h">${h}</h1>`), p);
    assert.equal([...head.matchAll(/class="btn btn--big"/g)].length, 1, p);
  }
  assert.match(section(read("about/what-we-do/index.html"), "b-wwd-craft"), /class="[^"]*\bis-flip\b/);
});
