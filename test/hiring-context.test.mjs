import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hiringContext, readRaw } from "../src/shared/forms.mjs";
import { renderForm, publicDefinition } from "../src/render/form.mjs";
import { makeT, resolveText } from "../src/shared/text.mjs";
import { freshServer, post, ORIGIN, workshopAnswers } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { q, one, many } from "../netlify/lib/db.mjs";
import { useConnect } from "../netlify/lib/connect.mjs";
import { serverContent } from "../netlify/lib/content.mjs";
import { ingestPayload } from "../netlify/lib/deliver.mjs";

const LETTER = "recommendation-letter";
const CYCLE_A = "hc-0123456789ab";
const CYCLE_B = "hc-abcdef012345";
const load = key => JSON.parse(fs.readFileSync(new URL(`../content/forms/${key}.json`, import.meta.url)));
const t = makeT(resolveText(JSON.parse(fs.readFileSync(new URL("../content/text.json", import.meta.url)))));

test("cycle context distinguishes absent, explicit and malformed links without becoming an answer", () => {
  assert.deepEqual(hiringContext(LETTER, {}), {});
  assert.deepEqual(hiringContext(LETTER, { _cycle: CYCLE_A }), { hiringCycleId: CYCLE_A });
  for (const value of ["", "not-a-cycle", "HC-0123456789AB", " hc-0123456789ab", null, 3, {}, [CYCLE_A, CYCLE_B]]) {
    assert.deepEqual(hiringContext(LETTER, { _cycle: value }), { hiringCycleId: "" });
  }
  const body = new FormData(); body.append("_cycle", CYCLE_A);
  assert.deepEqual(hiringContext(LETTER, body), { hiringCycleId: CYCLE_A });
  body.append("_cycle", CYCLE_A);
  assert.deepEqual(hiringContext(LETTER, body), { hiringCycleId: "" });
  for (const key of fs.readdirSync(new URL("../content/forms/", import.meta.url)).map(f => f.replace(".json", ""))) {
    if (key !== LETTER) assert.deepEqual(hiringContext(key, { _cycle: CYCLE_A }), {}, key);
  }
  assert.equal(Object.hasOwn(readRaw(load(LETTER), { _cycle: CYCLE_A }), "_cycle"), false);
});

test("corrected letter markup keeps only normalized context, outside the question definition", () => {
  const def = load(LETTER);
  const render = context => String(renderForm(def, { t, submissionContext: context }));
  assert.doesNotMatch(render({}), /name="_cycle"/);
  assert.match(render({ hiringCycleId: CYCLE_A }), /name="_cycle" value="hc-0123456789ab"/);
  assert.match(render({ hiringCycleId: "untrusted words" }), /name="_cycle" value=""/);
  assert.doesNotMatch(render({ hiringCycleId: "untrusted words" }), /untrusted words/);
  assert.doesNotMatch(JSON.stringify(publicDefinition(def)), /hiringCycleId|_cycle/);
  assert.doesNotMatch(String(renderForm(load("workshop-request"), { t, submissionContext: { hiringCycleId: CYCLE_A } })), /name="_cycle"/);
});

test("accepted context is separate, immutable on replay, and retained through stale-form correction", async () => {
  await freshServer(); useConnect(false);
  await q("INSERT INTO form_state(form_key,state,changed_by) VALUES($1,'open','fixture')", [LETTER]);
  const upload = async () => {
    const response = await handle(new Request(`${ORIGIN}/api/forms/${LETTER}/files?q=letter`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/pdf", accept: "application/json", "x-file-name": "fictional-cycle-letter.pdf" }, body: Buffer.from("%PDF-1.4\n% fictional context fixture\n%%EOF\n") }), { ip: "192.0.2.64" });
    assert.equal(response.status, 200);
    return (await response.json()).fileId;
  };
  const body = { _form: LETTER, _version: "1", _key: "fictional-cycle-context-a", name: "Fictional Referrer", email: "fictional@example.org", applicant: "Fictional Applicant", letter: await upload(), _cycle: CYCLE_A };
  const first = await handle(post(`/api/forms/${LETTER}/submit`, body), { ip: "192.0.2.64" });
  assert.equal(first.status, 200); const accepted = await first.json();
  const replay = await handle(post(`/api/forms/${LETTER}/submit`, { ...body, _cycle: CYCLE_B }), { ip: "192.0.2.64" });
  assert.equal((await replay.json()).ref, accepted.ref);
  const saved = await one("SELECT * FROM submissions WHERE ref=$1", [accepted.ref]);
  assert.deepEqual(saved.context, { hiringCycleId: CYCLE_A });
  assert.equal(Object.hasOwn(saved.answers, "_cycle"), false);
  assert.deepEqual(ingestPayload(saved, serverContent().forms[LETTER]).context, { hiringCycleId: CYCLE_A });
  assert.equal((await many("SELECT id FROM submissions WHERE form_key=$1", [LETTER])).length, 1);
  const bad = await handle(post(`/api/forms/${LETTER}/submit`, { ...body, _key: "fictional-cycle-context-b", _cycle: "untrusted words", letter: await upload() }), { ip: "192.0.2.65" });
  assert.equal(bad.status, 200);
  const invalid = await one("SELECT * FROM submissions WHERE ref=$1", [(await bad.json()).ref]);
  assert.deepEqual(invalid.context, { hiringCycleId: "" });
  assert.deepEqual(ingestPayload(invalid, serverContent().forms[LETTER]).context, { hiringCycleId: "" });
  const bare = { ...saved, context: {} };
  assert.equal(Object.hasOwn(ingestPayload(bare, serverContent().forms[LETTER]), "context"), false);
  const workshop = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _cycle: CYCLE_A, _key: "fictional-cycle-workshop" })), { ip: "192.0.2.66" });
  assert.equal(workshop.status, 200);
  const ordinary = await one("SELECT * FROM submissions WHERE ref=$1", [(await workshop.json()).ref]);
  assert.deepEqual(ordinary.context, {});
  assert.equal(Object.hasOwn(ingestPayload(ordinary, serverContent().forms["workshop-request"]), "context"), false);
  const newer = structuredClone(serverContent().forms[LETTER]); newer.version = 2;
  await q("INSERT INTO form_versions(form_key,version,definition,published_by) VALUES($1,2,$2::jsonb,'fixture')", [LETTER, JSON.stringify(newer)]);
  const stale = await handle(post(`/api/forms/${LETTER}/submit`, { _form: LETTER, _version: "1", _key: "fictional-cycle-stale", _cycle: CYCLE_A }), { ip: "192.0.2.67" });
  assert.equal(stale.status, 422);
  const correction = await stale.json();
  assert.match(correction.form, /name="_cycle" value="hc-0123456789ab"/);
  const html = await handle(post(`/api/forms/${LETTER}/submit`, { _form: LETTER, _version: "1", _cycle: CYCLE_A }, { json: false }), { ip: "192.0.2.68" });
  assert.equal(html.status, 422);
  assert.match(await html.text(), /name="_cycle" value="hc-0123456789ab"/);
});
