/* Program requesting (owner, 23 Nov 2026): the coming-soon line on a program page with nothing
   scheduled, and the per-program switch that hides the page and takes the program off the request
   forms. Built once from the shipped fixtures (whose only events are the peer groups' weekly
   ones, so the workshop, craft and dogs pages are always in their nothing-scheduled state, and
   the peer page always has a group coming), then asked through the pages function and the router
   as a browser and the staff page would. Every person here is fictional. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { useContent } from "../netlify/lib/content.mjs";
import { useConnect } from "../netlify/lib/connect.mjs";
import { freshPglite, useAdapter, q } from "../netlify/lib/db.mjs";
import { useStore, memoryStore } from "../netlify/lib/published.mjs";
import { handlePage, useDist } from "../netlify/lib/pages.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { submit } from "../netlify/lib/intake.mjs";
import { programsForStaff, setProgramState } from "../netlify/lib/programs.mjs";
import { composeSite, hidePrograms } from "../src/render/site.mjs";
import { withoutProgramOptions } from "../src/shared/programs.mjs";
import { makeContext } from "../src/render/context.mjs";
import { renderBlock } from "../src/render/registry.mjs";
import { workshopAnswers, post, ORIGIN } from "./helpers.mjs";

const OUT = path.join(ROOT, "local", "test-build-programs");
await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: "2026-12-15" });
const SERVER = JSON.parse(fs.readFileSync(path.join(OUT, "_server", "server.json"), "utf8"));
const WHEN = { today: "2026-12-15", now: Date.parse("2026-12-15T17:00:00Z") };

/* Each case starts from the built content, a fresh database (so no program is switched off
   unless the case switches it), and an empty published store. */
async function given() {
  process.env.LOCAL_DB = "pglite";
  useAdapter(await freshPglite());
  useContent(SERVER);
  useDist(OUT);
  useStore(memoryStore());
  useConnect(null);
}

const get = (p) => handlePage(new Request(ORIGIN + p), WHEN);
const body = async (res) => res.text();

test("a workshop page with nothing scheduled offers the coming-soon line and a way to ask", async () => {
  await given();
  const res = await get("/initiatives/housing-hub/");
  assert.equal(res.status, 200);
  const page = await body(res);
  assert.match(page, /More Workshops Coming Soon!/);
  assert.match(page, /Request This Workshop/);
  assert.match(page, /href="\/forms\/workshop-request\/\?topic=housing"/);
  assert.doesNotMatch(page, /Nothing is scheduled yet\./);
  // The hero's photos are of a Navigating Housing workshop itself.
  assert.match(page, /Students filling the seats of a lecture hall before the Navigating Housing workshop/);
});

test("craft nights and dogs on call get their own coming-soon lines", async () => {
  await given();
  const craft = await body(await get("/join/craft-nights/"));
  assert.match(craft, /More Craft Nights Coming Soon!/);
  assert.match(craft, /Suggest a Craft Night/);
  const dogs = await body(await get("/initiatives/dogs-on-call/"));
  assert.match(dogs, /More Visits Coming Soon!/);
  assert.doesNotMatch(dogs, /Nothing is scheduled yet\./);
});

test("a program with something scheduled keeps showing the schedule", async () => {
  await given();
  const peer = await body(await get("/join/peer-support-groups/"));
  assert.doesNotMatch(peer, /More Groups Coming Soon!/);
  assert.doesNotMatch(peer, /No upcoming peer support group is listed/);
});

test("the peer page's empty state, drawn with no groups at all, offers the coming-soon line and a way to ask", async () => {
  await given();
  const composed = composeSite(SERVER.render);
  const ctx = makeContext({
    site: composed.site, media: SERVER.media, builtPaths: composed.builtPaths, routes: SERVER.routes,
    data: { ...composed.data, events: { recurring: [], events: [] }, eventsState: null },
    text: composed.text, today: "2026-12-15", now: WHEN.now, assets: SERVER.assets,
  });
  const page = JSON.parse(fs.readFileSync(path.join(ROOT, "content/pages/peer-support-groups.json"), "utf8"));
  const block = page.blocks.find((b) => b.type === "program" && b.upcoming);
  const out = String(renderBlock(block, ctx));
  assert.match(out, /More Groups Coming Soon!/);
  assert.match(out, /Request a Peer Support Group/);
  assert.match(out, /href="\/forms\/program-request\/\?topic=peer_support_group"/);
});

test("every program takes requests until a director switches it off", async () => {
  await given();
  const programs = await programsForStaff();
  assert.deepEqual(programs.map((p) => p.key), ["housing", "workshops", "peer", "craft", "training", "dogs"]);
  assert.ok(programs.every((p) => p.requesting));
});

test("a program switched off loses its pages, its search entries and its form choices; the others keep theirs", async () => {
  await given();
  await setProgramState("housing", "off", "test-director");

  assert.equal((await get("/initiatives/housing-hub/")).status, 404);
  assert.equal((await get("/join/request-a-workshop/behind-the-workshop/navigating-housing/")).status, 404);
  assert.equal((await get("/join/craft-nights/")).status, 200);

  const index = await (await get("/search-index.json")).json();
  const paths = index.pages.map((e) => e.path);
  assert.ok(!paths.includes("/initiatives/housing-hub/"), "the housing page leaves the search index");
  assert.ok(paths.includes("/join/craft-nights/"), "other pages stay in the search index");

  const form = await body(await get("/forms/workshop-request/"));
  assert.ok(!form.includes('value="housing"'), "the housing choice leaves the workshop form");
  assert.ok(form.includes('value="support_network"'), "the other workshop choices stay");
  assert.equal((await get("/forms/workshop-request/?topic=housing")).status, 404, "the program's own form address answers as its hidden page does");
  assert.equal((await get("/forms/workshop-request/?topic=stress_self_care")).status, 200);

  const refused = await submit("workshop-request", workshopAnswers({ topics: ["housing"] }));
  assert.equal(refused.ok, false);
  assert.equal(refused.error, "answers.invalid");
  const accepted = await submit("workshop-request", workshopAnswers({ topics: ["stress_self_care"] }));
  assert.equal(accepted.ok, true);
});

test("switching a program back on restores its page and its form choice", async () => {
  await given();
  await setProgramState("housing", "off", "test-director");
  assert.equal((await get("/initiatives/housing-hub/")).status, 404);
  await setProgramState("housing", "on", "test-director");
  assert.equal((await get("/initiatives/housing-hub/")).status, 200);
  const accepted = await submit("workshop-request", workshopAnswers({ topics: ["housing"] }));
  assert.equal(accepted.ok, true);
});

test("hiding a program leaves the composed site it was given untouched", async () => {
  await given();
  const site = composeSite(SERVER.render);
  const hidden = hidePrograms(site, new Set(["housing"]));
  assert.ok(site.pages.some((p) => p.id === "pg-housing-hub"), "the cached site keeps the page");
  assert.ok(!hidden.pages.some((p) => p.id === "pg-housing-hub"), "the hidden copy drops it");
  assert.deepEqual(hidden.moves.get("/initiatives/housing-hub"), { to: null, page: "pg-housing-hub" });
  assert.ok(!hidden.builtPaths.includes("/initiatives/housing-hub/"));
  const hrefs = [];
  const walk = (items) => items.forEach((i) => { if (i.href) hrefs.push(i.href); if (i.children) walk(i.children); });
  walk(hidden.site.nav);
  assert.ok(!hrefs.some((h) => h.includes("housing-hub")), "the menu drops the hidden page");
});

test("taking a program's choices off a form leaves the form's other choices and the form itself alone", async () => {
  const { loadContent } = await import("../ops/build.mjs");
  const def = loadContent({}).forms["workshop-request"];
  const topics = (d) => d.sections.flatMap((s) => s.questions).find((x) => x.id === "topics").options.map((o) => o.id);
  assert.ok(topics(def).includes("housing"));
  const cut = withoutProgramOptions(def, new Set(["housing"]));
  assert.deepEqual(topics(cut), ["support_network", "stress_self_care", "self_advocacy"]);
  assert.ok(topics(def).includes("housing"), "the definition it was given is unchanged");
  assert.equal(withoutProgramOptions(def, new Set()), def, "nothing off, the same definition");
});

/* A staff session made directly in the database, as finishSignIn would leave it. */
async function staffSession(scopes) {
  const id = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(id).digest("hex");
  await q(`INSERT INTO staff_sessions (id_hash, sub, name, scopes, expires_at, method)
           VALUES ($1, $2, $3, $4::jsonb, now() + interval '8 hours', 'password')`,
    [hash, "test-director", "Robin Example", JSON.stringify(scopes)]);
  return `bss_staff=${id}`;
}

test("the staff page lists the programs, and switching one off takes a publisher and a second yes", async () => {
  await given();
  const cookie = await staffSession(["site.publish"]);
  const list = await handle(new Request(`${ORIGIN}/api/staff/programs`, { headers: { cookie, accept: "application/json" } }), { ip: "203.0.113.1" });
  assert.equal(list.status, 200);
  const listed = await list.json();
  assert.equal(listed.canSwitch, true);
  assert.equal(listed.programs.length, 6);
  assert.ok(listed.programs.every((p) => p.requesting));

  const noConfirm = await handle(post("/api/staff/programs/housing/switch", { state: "off" }, { headers: { cookie } }), { ip: "203.0.113.1" });
  assert.equal(noConfirm.status, 409, "turning off without the second yes is refused");
  const off = await handle(post("/api/staff/programs/housing/switch", { state: "off", confirm: "housing" }, { headers: { cookie } }), { ip: "203.0.113.1" });
  assert.equal(off.status, 200);
  assert.equal((await off.json()).programs.find((p) => p.key === "housing").requesting, false);
  assert.equal((await get("/initiatives/housing-hub/")).status, 404, "the switch the staff page made hides the page");

  const unknown = await handle(post("/api/staff/programs/nope/switch", { state: "off", confirm: "nope" }, { headers: { cookie } }), { ip: "203.0.113.1" });
  assert.equal(unknown.status, 404);
});

test("someone who cannot publish can see the switches but not move them", async () => {
  await given();
  const cookie = await staffSession(["site.edit"]);
  const list = await handle(new Request(`${ORIGIN}/api/staff/programs`, { headers: { cookie, accept: "application/json" } }), { ip: "203.0.113.1" });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).canSwitch, false);
  const move = await handle(post("/api/staff/programs/housing/switch", { state: "off", confirm: "housing" }, { headers: { cookie } }), { ip: "203.0.113.1" });
  assert.equal(move.status, 403);
  assert.ok((await programsForStaff()).every((p) => p.requesting), "nothing was switched");
});
