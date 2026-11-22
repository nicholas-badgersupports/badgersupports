/* The scheduled outbox run (netlify/functions/outbox.mjs; workflow audit PF-2): the timer that
   gives deliver.mjs's full pass its caller. Before it, runOutbox() was called by nothing in
   production — receipts, notices and the backup workbook could never send, and a failed ingest
   waited for an unrelated submission to retry it. Fixture only: a fake Connect, no schedule is
   registered, and no mail is sent. */

import test from "node:test";
import assert from "node:assert/strict";
import { freshServer, workshopAnswers, post } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { useConnect } from "../netlify/lib/connect.mjs";
import { useBackup } from "../netlify/lib/backup.mjs";
import { deliveriesSettled } from "../netlify/lib/deliver.mjs";
import { many } from "../netlify/lib/db.mjs";
import run, { config } from "../netlify/functions/outbox.mjs";

const ip = () => ({ ip: "198.51.100.9" });

test.afterEach(() => { useConnect(null); useBackup(null); });

test("the timer is fifteen minutes: the longest back-off plus one run stays inside thirty", () => {
  assert.equal(config.schedule, "*/15 * * * *");
});

test("a scheduled run sends what a submission left waiting, and the next run leaves the store alone", async () => {
  await freshServer();
  useConnect(null);
  useBackup(null);
  const calls = [];
  /* Submitted with nothing set up, so the ingest waits — the state PF-2 left every row in. */
  assert.equal((await handle(post("/api/forms/workshop-request/submit", workshopAnswers()), ip())).status, 200);
  await deliveriesSettled();
  assert.deepEqual((await many("SELECT state FROM outbox WHERE kind = 'connect.ingest'")).map((r) => r.state), ["pending"]);

  useConnect({
    url: "https://connect.example.test", keyId: "schedule-test-key", secret: "o".repeat(40), ssoSecret: "s".repeat(40),
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body.action);
      return { json: async () => ({ ok: true, ref: body.ref, stored: "new" }) };
    },
  });
  const res = await run(new Request("http://site.test/.netlify/functions/outbox"));
  assert.equal(res.status, 200);
  assert.deepEqual((await many("SELECT state FROM outbox WHERE kind = 'connect.ingest'")).map((r) => r.state), ["sent"],
    "the scheduled run delivered the waiting row with no submission and no person to ask");
  assert.deepEqual(calls, ["publicFormIngest"]);

  const again = await run(new Request("http://site.test/.netlify/functions/outbox"));
  assert.equal(again.status, 200);
  assert.deepEqual(calls, ["publicFormIngest"], "with nothing due, the next run asks Connect nothing");
});
