import test from "node:test";
import assert from "node:assert/strict";
import * as team from "../src/render/team.mjs";
const { publicPeople, cardRole } = team;

const person = (name, title, extra = {}) => ({ name, title, role: "Director", group: "directors", published: true, ...extra });

test("leadership follows public role order rather than the alphabet", () => {
  const people = [person("Avery Example", "Director of Workshops (Programs)"), person("Zoe Sample", "Executive Director"), person("Morgan Fixture", "Managing Director"), person("Blair Example", "Financial Director")];
  assert.deepEqual(publicPeople({people}).map(p => p.title), ["Executive Director", "Managing Director", "Financial Director", "Director of Workshops (Programs)"]);
});

test("explicit source order, unknown titles and duplicate titles have deterministic fallbacks", () => {
  const people = [person("Zoe Sample", "Executive Director"), person("Morgan Fixture", "Director of Research", { order: 1 }), person("Blair Example", "Director of Research"), person("Avery Example", "Director of Research")];
  assert.deepEqual(publicPeople({people}).map(p => p.name), ["Morgan Fixture", "Zoe Sample", "Avery Example", "Blair Example"]);
  assert.deepEqual(people.map(p => p.name), ["Zoe Sample", "Morgan Fixture", "Blair Example", "Avery Example"], "sorting must not rewrite the source array");
});

test("associates follow their own roles without changing source group membership", () => {
  const people = [person("Avery Example", "Associate Director of Business", {group:"associate-directors"}), person("Zoe Sample", "Associate Director of Campus Relations", {group:"associate-directors"}), person("Morgan Fixture", "Associate Director of Operations", {group:"associate-directors"}), person("Blair Example", "Executive Director", {group:"volunteers"})];
  const ordered = publicPeople({people});
  assert.deepEqual(ordered.map(p=>p.title), ["Associate Director of Campus Relations", "Associate Director of Operations", "Associate Director of Business", "Executive Director"]);
  assert.equal(ordered.at(-1).group, "volunteers", "the directory cannot silently reassign a source role");
});

test("a specific public title replaces a generic tier without inventing missing details", () => {
  assert.equal(cardRole(person("Avery Example", "Director of Workshops (Programs)")), "Director of Workshops (Programs)");
  assert.equal(cardRole(person("Avery Example", "Director of Workshops", {role:"Workshops"})), "Workshops");
  assert.equal(cardRole({role:"Staff", title:"Programming Coordinator"}), "Programming Coordinator");
  assert.equal(cardRole({role:"Volunteer"}), "Volunteer");
  assert.equal(cardRole({title:"Campus Relations"}), "Campus Relations");
  assert.equal(cardRole({}), "");
});

test("sparse and hidden profiles retain eligibility boundaries while being sorted", () => {
  const people = [person("Hidden Fixture", "Executive Director", {published:false}), person("", ""), person("Avery Example", "Director of Workshops")];
  const sorted = publicPeople({people});
  assert.equal(sorted.length, 2);
  assert.equal(sorted[0].title, "Director of Workshops");
  assert.equal(sorted[1].name, "");
});


test("unrecognized overlapping titles do not borrow another department's priority", () => {
  const people = [person("Avery Example", "Director of Research and Development"), person("Morgan Fixture", "Director of Business Development"), person("Zoe Sample", "Financial Director")];
  assert.deepEqual(publicPeople({people}).map(p => p.name), ["Zoe Sample", "Avery Example", "Morgan Fixture"]);
});

test("bounded numeric ranks outrank legacy fallback while equal ranks use names and stable identities", () => {
  const ranked = [person("Zoe Sample", "Executive Director", { order: 4, id: "z" }), person("Avery Example", "Director of Research", { order: 4, id: "b" }), person("Avery Example", "Managing Director", { order: 4, id: "a" }), person("Maximum Fixture", "Director of Research", { order: 99999 }), person("Zero Fixture", "Director of Research", { order: 0 }), person("Legacy Fixture", "Executive Director")];
  assert.deepEqual(publicPeople({ people: ranked }).map(p => p.id || p.name), ["Zero Fixture", "a", "b", "z", "Maximum Fixture", "Legacy Fixture"]);
});

test("mixed explicit maximum rank and legacy titles form the same total order under every permutation", () => {
  const a = person("M Ranked", "Director of Research", { order: 99999, id: "ranked" });
  const b = person("Z Legacy", "Executive Director", { id: "executive" });
  const c = person("A Legacy", "Director of Research", { id: "other" });
  for (const people of [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]]) assert.deepEqual(publicPeople({ people }).map(p => p.id), ["ranked", "executive", "other"]);
  for (const [left, right] of [[a,b],[a,c],[b,c]]) assert.deepEqual(publicPeople({ people: [right,left] }).map(p => p.id), publicPeople({ people: [left,right] }).map(p => p.id));
});

test("malformed optional ranks use legacy fallback without being coerced", () => {
  for (const invalid of [-1, 100000, 1.5, NaN, Infinity, "0", false, {}, null]) {
    const people = [person("A Unknown", "Director of Research", { order: invalid }), person("Z Executive", "Executive Director"), person("Ranked Fixture", "Director of Research", { order: 0 })];
    assert.deepEqual(publicPeople({ people }).map(p => p.name), ["Ranked Fixture", "Z Executive", "A Unknown"]);
  }
});
