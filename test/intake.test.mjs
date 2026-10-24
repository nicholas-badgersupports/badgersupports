/* The intake API, end to end through the router, against a fresh PGlite database. */

import test from "node:test";
import assert from "node:assert/strict";
import { freshServer, workshopAnswers, post, ORIGIN } from "./helpers.mjs";
import { handle, ROUTES, TIERS } from "../netlify/lib/router.mjs";
import { many, one, q } from "../netlify/lib/db.mjs";

const ip = (n = 1) => ({ ip: `198.51.100.${n}` });
const get = (path) => new Request(ORIGIN + path, { headers: { accept: "application/json" } });

test("a valid request is stored once, with its onward work in the outbox", async () => {
  await freshServer();
  const res = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0001-aaaa" })), ip());
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.match(body.ref, /^WR-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  const sub = await one("SELECT * FROM submissions WHERE ref = $1", [body.ref]);
  assert.equal(sub.answers.affiliation, "Example Hall Council");
  assert.equal(sub.anonymous, false);
  const out = await many("SELECT kind, state FROM outbox ORDER BY id");
  assert.deepEqual(out.map((o) => `${o.kind}:${o.state}`), ["connect.ingest:pending", "sheets.backup:pending"]);
});

test("a receipt is queued only where it is switched on, and held until the sender is verified", async () => {
  await freshServer();
  const { serverContent } = await import("../netlify/lib/content.mjs");
  const v2 = structuredClone(serverContent().forms["workshop-request"]);
  v2.version = 2;
  v2.workflow = { ...v2.workflow, receipt: "on" };
  await q("INSERT INTO form_versions (form_key, version, definition, published_by) VALUES ('workshop-request', 2, $1::jsonb, 'test')", [JSON.stringify(v2)]);
  const res = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0006-ffff", _version: "2" })), ip());
  assert.equal(res.status, 200);
  const held = await one("SELECT state, hold_reason FROM outbox WHERE kind = 'mail.receipt'");
  assert.deepEqual({ ...held }, { state: "held", hold_reason: "sender-unverified" });
});

test("pressing Send twice, or again after a lost reply, is one submission", async () => {
  await freshServer();
  const a = await (await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0002-bbbb" })), ip())).json();
  const b = await (await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0002-bbbb" })), ip())).json();
  assert.equal(a.ref, b.ref);
  // Without JavaScript there is no key: the same answers on the same day are the same submission.
  const c = await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), ip());
  const d = await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), ip());
  assert.equal(c.status, 200);
  assert.equal(d.status, 200);
  assert.equal((await one("SELECT count(*)::int AS n FROM submissions")).n, 2);
});

test("a form closed while a tab is open refuses the send and gives the answers back", async () => {
  await freshServer();
  await q("INSERT INTO form_state (form_key, state, changed_by) VALUES ('workshop-request', 'closed', 'test')");
  const state = await (await handle(get("/api/forms/workshop-request/state"), ip())).json();
  assert.equal(state.state, "closed");
  const res = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0003-cccc" })), ip());
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "form.closed");
  const html = await (await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), ip())).text();
  assert.match(html, /This form has closed/);
  assert.match(html, /Example Hall Council/, "the no-JavaScript reply shows what they wrote");
  assert.equal((await one("SELECT count(*)::int AS n FROM submissions")).n, 0);
});

test("an application with no questions cannot be switched open", async () => {
  await freshServer();
  const { serverContent } = await import("../netlify/lib/content.mjs");
  const v3 = structuredClone(serverContent().forms["staff-application"]);
  v3.version += 1;
  for (const s of v3.sections) s.questions = [];
  await q("INSERT INTO form_versions (form_key, version, definition, published_by) VALUES ('staff-application', $1, $2::jsonb, 'test')", [v3.version, JSON.stringify(v3)]);
  await q("INSERT INTO form_state (form_key, state, changed_by) VALUES ('staff-application', 'open', 'test')");
  const state = await (await handle(get("/api/forms/staff-application/state"), ip())).json();
  assert.equal(state.state, "closed");
});

test("a form updated while open: the send is checked against the new questions", async () => {
  await freshServer();
  const { serverContent } = await import("../netlify/lib/content.mjs");
  const v2 = structuredClone(serverContent().forms["workshop-request"]);
  v2.version = 2;
  v2.sections[0].questions.push({ id: "pronouns", type: "short", label: "Your pronouns", required: true });
  await q("INSERT INTO form_versions (form_key, version, definition, published_by) VALUES ('workshop-request', 2, $1::jsonb, 'test')", [JSON.stringify(v2)]);
  const res = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0004-dddd" })), ip());
  const body = await res.json();
  assert.equal(res.status, 422);
  assert.equal(body.version, 2);
  assert.deepEqual(Object.keys(body.errors), ["pronouns"]);
  const html = await (await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), ip())).text();
  assert.match(html, /This form was updated while it was open/);
  assert.match(html, /value="Avery Example"/, "the answers already given are kept");
});

test("an anonymous form keeps no connection data, and answers from a hidden branch are dropped", async () => {
  await freshServer();
  const res = await handle(post("/api/forms/programming-feedback/submit", {
    _form: "programming-feedback", _version: "1", _key: "k-0005-eeee",
    category: "craft", craft_activity: "bracelets_f26", craft_enjoyed: "Calm room.", ws_learned: "not shown to them",
  }), ip());
  assert.equal(res.status, 200);
  const sub = await one("SELECT anonymous, answers FROM submissions");
  assert.equal(sub.anonymous, true);
  assert.equal(sub.answers.ws_learned, undefined);
  const cols = (await many("SELECT column_name FROM information_schema.columns WHERE table_name = 'submissions'")).map((r) => r.column_name);
  for (const c of cols) assert.doesNotMatch(c, /ip|agent|address|connection/i);
});

test("the trap field is told yes and nothing is kept", async () => {
  await freshServer();
  const res = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _website: "http://spam.example" })), ip());
  assert.equal(res.status, 200);
  assert.equal((await one("SELECT count(*)::int AS n FROM submissions")).n, 0);
});

test("a no-JavaScript send with mistakes comes back as the form, marked, with every answer kept", async () => {
  await freshServer();
  const res = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ email: "nope", attendees: "" }), { json: false }), ip());
  const html = await res.text();
  assert.equal(res.status, 422);
  assert.match(html, /Unable to send yet/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /value="Example Hall Council"/);
  assert.match(html, /Content-Security|<link rel="stylesheet"/);
});

test("posts from another site are refused; one connection is rate-limited", async () => {
  await freshServer();
  const cross = await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { origin: "https://elsewhere.example" }), ip());
  assert.equal(cross.status, 403);
  let last;
  for (let i = 0; i < 11; i++) last = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: `k-rate-${String(i).padStart(4, "0")}` })), ip(9));
  assert.equal(last.status, 429);
  const other = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-rate-other" })), ip(10));
  assert.equal(other.status, 200, "another connection is unaffected");
});

test("every route declares a tier, and every staff route refuses while sign-in does not exist", async () => {
  await freshServer();
  for (const r of ROUTES) assert.ok(TIERS.has(r.tier), r.name);
  for (const path of ["/api/staff/forms/workshop-request/submissions", "/api/staff/", "/api/staff/anything"]) {
    const res = await handle(new Request(ORIGIN + path), ip());
    assert.equal(res.status, 401, path);
  }
});

test("a mood tap adds one to today's count and records nothing about who tapped", async () => {
  await freshServer();
  const res = await handle(post("/api/mood", { mood: "finding_calm" }), ip());
  const body = await res.json();
  assert.equal(body.total, 1);
  assert.equal(body.counts.find((c) => c.id === "finding_calm").n, 1);
  assert.ok(body.message.length > 0);
  const bad = await handle(post("/api/mood", { mood: "ecstatic" }), ip());
  assert.equal(bad.status, 400);
  const cols = (await many("SELECT column_name FROM information_schema.columns WHERE table_name = 'mood_daily'")).map((r) => r.column_name).sort();
  assert.deepEqual(cols, ["day", "mood", "n"]);
  const page = await handle(post("/api/mood", { mood: "thriving" }, { json: false }), ip());
  assert.match(await page.text(), /Thanks for Checking In/);
});

test("with no database configured the API fails closed", async () => {
  const { useAdapter } = await import("../netlify/lib/db.mjs");
  const saved = process.env.LOCAL_DB;
  delete process.env.LOCAL_DB;
  const missing = Object.assign(new Error("No database is configured."), { code: "config.missing" });
  useAdapter({ query: async () => { throw missing; }, transaction: async () => { throw missing; } });
  const res = await handle(get("/api/forms/workshop-request/state"), ip());
  assert.equal(res.status, 503);
  process.env.LOCAL_DB = saved;
});
