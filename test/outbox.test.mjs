/* The outbox (netlify/lib/deliver.mjs) and the directors' backup workbook (netlify/lib/backup.mjs), against a fake
   Connect and a fake Sheets API. Fixture only: nothing here reaches Connect, Google or any mail service, and no
   schedule is registered. Avery Example and every answer are made up. */

import test from "node:test";
import assert from "node:assert/strict";
import { freshServer, workshopAnswers, post } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { useConnect } from "../netlify/lib/connect.mjs";
import { serverContent, useContent } from "../netlify/lib/content.mjs";
import { useAdapter, many, q, one } from "../netlify/lib/db.mjs";
import { deliverOnce, deliveriesSettled, runOutbox, MAX_WAIT_MINUTES } from "../netlify/lib/deliver.mjs";
import { useBackup, workbookPlan, COLOURS } from "../netlify/lib/backup.mjs";
import { noteSet } from "../netlify/lib/published.mjs";

const ip = (n = 1) => ({ ip: `198.51.100.${n}` });
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* A fake Connect: Website Forms keeps one copy per ref, the mail path one message per dedupe key. `fail(action,
   n)` says what the nth call of an action does: "down" (never arrives), "lost" (arrives, the answer is lost). */
function fakeConnect({ fail = () => null, slow = 0 } = {}) {
  const stored = new Map(), mailed = new Map(), calls = [];
  const n = {};
  return {
    stored, mailed, calls,
    cfg: {
      url: "https://connect.example.test", keyId: "outbox-test-key", secret: "o".repeat(40), ssoSecret: "s".repeat(40),
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        n[body.action] = (n[body.action] || 0) + 1;
        calls.push(body.action);
        if (slow) await sleep(slow);
        const how = fail(body.action, n[body.action]);
        if (how === "down") throw new TypeError("offline");
        let reply;
        if (body.action === "publicFormIngest") { const again = stored.has(body.ref); stored.set(body.ref, body); reply = { ok: true, ref: body.ref, stored: again ? "already" : "new" }; }
        else if (body.action === "publicReceipt") { const again = mailed.has(body.dedupeKey); if (!again) mailed.set(body.dedupeKey, body); reply = { ok: true, messageId: `m-${mailed.size}`, sent: again ? "already" : "new" }; }
        else reply = { ok: false };
        if (how === "lost") throw new TypeError("connection reset");
        return { json: async () => reply };
      },
    },
  };
}

/* A fake Sheets API with the five calls the writer makes, kept in memory. */
function fakeSheets() {
  const book = { sheets: [] };
  const byTitle = (range) => { const m = range.match(/^'((?:[^']|'')*)'!/); return book.sheets.find((s) => s.properties.title === m[1].replace(/''/g, "'")); };
  const requests = [];
  return {
    book, requests,
    get: async () => structuredClone({ sheets: book.sheets.map((s) => ({ properties: s.properties, developerMetadata: s.developerMetadata })) }),
    batchUpdate: async (_id, reqs) => {
      requests.push(...reqs);
      for (const r of reqs) {
        if (r.addSheet) book.sheets.push({ properties: { ...r.addSheet.properties }, developerMetadata: [], values: [], format: [] });
        if (r.createDeveloperMetadata) { const d = r.createDeveloperMetadata.developerMetadata; book.sheets.find((s) => s.properties.sheetId === d.location.sheetId).developerMetadata.push({ metadataKey: d.metadataKey, metadataValue: d.metadataValue }); }
        if (r.deleteDeveloperMetadata) { const l = r.deleteDeveloperMetadata.dataFilter.developerMetadataLookup; const s = book.sheets.find((x) => x.properties.sheetId === l.metadataLocation.sheetId); s.developerMetadata = s.developerMetadata.filter((m) => m.metadataKey !== l.metadataKey); }
        if (r.repeatCell || r.addBanding) book.sheets.find((s) => s.properties.sheetId === (r.repeatCell?.range || r.addBanding.bandedRange.range).sheetId).format.push(r);
      }
      return { replies: [] };
    },
    valuesGet: async (_id, range) => ({ values: structuredClone(byTitle(range).values) }),
    valuesUpdate: async (_id, range, values) => { const s = byTitle(range); values.forEach((row, i) => { s.values[i] = row; }); return {}; },
    valuesAppend: async (_id, range, values) => { byTitle(range).values.push(...values); return {}; },
  };
}

/* Submissions stored with nothing set up, so they wait; then the given Connect and workbook. */
async function waiting(count, { connect, sheets = null, forms = null } = {}) {
  const db = await freshServer();
  if (forms) useContent({ ...serverContent(), forms: { ...serverContent().forms, ...forms } });
  useConnect(null);
  useBackup(null);
  for (let i = 0; i < count; i++) assert.equal((await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ group_notes: `Made-up request ${i + 1}.` })), ip(i + 1))).status, 200);
  await deliveriesSettled();
  if (connect) useConnect(connect.cfg);
  if (sheets) useBackup({ spreadsheetId: "made-up-sheet", sheets });
  return db;
}
/* Rows put back by hand do not move the note a scheduled run reads; this clears it, as a new submission would. */
const wake = () => noteSet("outbox-next", null);
const rows = (kind) => many("SELECT o.state, o.attempts, o.last_error, s.ref FROM outbox o JOIN submissions s ON s.id = o.submission_id WHERE o.kind = $1 ORDER BY o.id", [kind]);

test.afterEach(() => { useConnect(null); useBackup(null); delete process.env.RECEIPT_SENDER; delete process.env.BACKUP_CONFIDENTIAL; });

test("two workers at once send each row once: a claimed row is skipped, and a stopped worker's claim runs out", async () => {
  const connect = fakeConnect({ slow: 40 });
  await waiting(4, { connect });
  const [a, b] = await Promise.all([deliverOnce(), deliverOnce()]);
  assert.equal(a.sent + b.sent, 4);
  assert.equal(connect.calls.filter((c) => c === "publicFormIngest").length, 4, "no submission was sent twice");
  assert.deepEqual((await rows("connect.ingest")).map((r) => r.state), ["sent", "sent", "sent", "sent"]);

  // A worker that stopped mid-send leaves its claim; nobody takes the row until the claim runs out.
  await waiting(1, { connect: fakeConnect() });
  await q("UPDATE outbox SET claim_until = now() + interval '1 minute', claim_token = 'gone-worker' WHERE kind = 'connect.ingest'");
  assert.equal((await deliverOnce()).sent, 0);
  await q("UPDATE outbox SET claim_until = now() - interval '1 second' WHERE kind = 'connect.ingest'");
  assert.equal((await deliverOnce()).sent, 1);
});

test("a failed row waits two, four, eight, then fifteen minutes at most, so a run every fifteen retries within thirty", async () => {
  await waiting(1, { connect: fakeConnect({ fail: () => "down" }) });
  const waits = [];
  for (let i = 0; i < 6; i++) {
    await deliverOnce({ force: true });
    const r = await one("SELECT extract(epoch FROM next_at - now()) / 60 AS m, attempts, state, last_error FROM outbox WHERE kind = 'connect.ingest'");
    waits.push(Math.round(Number(r.m)));
    assert.equal(r.state, "failed");
    assert.equal(r.last_error, "connect.unreachable");
  }
  assert.deepEqual(waits, [2, 4, 8, 15, 15, 15]);
  assert.equal(MAX_WAIT_MINUTES, 15);
  assert.ok(MAX_WAIT_MINUTES + 15 <= 30, "the longest wait plus one schedule period is within thirty minutes");
});

test("an answer lost on the way back is sent again with the same reference and kept once", async () => {
  const connect = fakeConnect({ fail: (action, n) => (action === "publicFormIngest" && n === 1 ? "lost" : null) });
  await waiting(1, { connect });
  assert.equal((await deliverOnce()).failed, 1);
  await q("UPDATE outbox SET next_at = now() WHERE kind = 'connect.ingest'");
  assert.equal((await deliverOnce()).sent, 1);
  assert.equal(connect.calls.length, 2, "sent twice");
  assert.equal(connect.stored.size, 1, "stored once");
});

test("the scheduled run: with nothing due it returns without touching the database", async () => {
  const db = await waiting(2, { connect: fakeConnect() });
  let queries = 0;
  useAdapter({ ...db, query: (...a) => { queries++; return db.query(...a); }, transaction: (fn) => { queries++; return db.transaction(fn); } });
  const first = await runOutbox();
  assert.equal(first.woke, true);
  assert.equal(first.ingest.sent, 2);
  const used = queries;
  assert.ok(used > 0);
  const second = await runOutbox();
  assert.deepEqual(second, { woke: false });
  assert.equal(queries, used, "no query when nothing is due");
  // A failure notes when it is due; the run wakes for it then, not before.
  await waiting(1, { connect: fakeConnect({ fail: () => "down" }) });
  await deliverOnce();
  assert.deepEqual(await runOutbox(), { woke: false });
  assert.equal((await runOutbox({ now: Date.now() + 3 * 60_000 })).woke, true);
});

test("receipts: held until a sender is verified, then sent once each; never for an anonymous form", async () => {
  const connect = fakeConnect();
  await freshServer();
  const shipped = serverContent().forms["workshop-request"];
  // Receipts are switched on per form; none is on as shipped, so this case switches one on.
  await waiting(2, { connect, forms: { "workshop-request": { ...shipped, workflow: { ...shipped.workflow, receipt: "on" } } } });
  assert.deepEqual((await many("SELECT state, hold_reason FROM outbox WHERE kind = 'mail.receipt'")).map((r) => `${r.state}:${r.hold_reason}`), ["held:sender-unverified", "held:sender-unverified"]);
  const off = await runOutbox();
  assert.equal(off.receipts.configured, false);
  assert.equal(connect.mailed.size, 0, "no sender, no mail");

  process.env.RECEIPT_SENDER = "someone@example.com";
  assert.deepEqual(await runOutbox(), { woke: false }, "only a badgersupports.org address is a sender: nothing more is set up, so nothing wakes");
  process.env.RECEIPT_SENDER = "directors@badgersupports.org";
  const on = await runOutbox();
  assert.equal(on.receipts.sent, 2);
  const mail = [...connect.mailed.values()];
  assert.deepEqual(mail.map((m) => [m.to, m.template, m.sender]), [["avery@example.org", "public.workshop-request.receipt", "directors@badgersupports.org"], ["avery@example.org", "public.workshop-request.receipt", "directors@badgersupports.org"]]);
  await q("UPDATE outbox SET state = 'pending', next_at = now() WHERE kind = 'mail.receipt'");
  await wake();
  assert.equal((await runOutbox()).receipts.sent, 2);
  assert.equal(connect.mailed.size, 2, "sent again, mailed once: Connect keeps one message per dedupe key");

  // A receipt row for an anonymous form (none can be written; this one is put there by hand) is cancelled.
  await q("UPDATE submissions SET anonymous = true");
  await q("INSERT INTO outbox (kind, submission_id, dedupe_key) SELECT 'mail.receipt', id, 'mail.receipt:hand-' || id FROM submissions LIMIT 1");
  await wake();
  await runOutbox();
  assert.equal(connect.mailed.size, 2);
  assert.equal((await one("SELECT state FROM outbox WHERE dedupe_key LIKE 'mail.receipt:hand-%'")).state, "cancelled");
});

test("the backup workbook: Start Here, a Dashboard of counts, and a styled tab per form; each answer once, never a formula", async () => {
  const sheets = fakeSheets();
  await waiting(2, { connect: fakeConnect(), sheets });
  await q("UPDATE submissions SET answers = jsonb_set(answers, '{group_notes}', '\"=HYPERLINK(\\\"https://example.org\\\")\"') WHERE id = (SELECT min(id) FROM submissions)");
  const r = await runOutbox();
  assert.equal(r.backup.sent, 2);
  const tag = (s) => s.developerMetadata.find((m) => m.metadataKey === "bss.backup")?.metadataValue;
  assert.deepEqual(sheets.book.sheets.map(tag), ["start", "dashboard", "form:workshop-request"]);
  const [start, dash, tab] = sheets.book.sheets;
  assert.equal(start.values[0][0], "Start Here");
  assert.ok(start.values.flat().some((v) => /confidential are not in this file/.test(v)));
  assert.deepEqual(dash.values[0], ["Form", "Open or Closed", "Answers", "Last 7 Days", "Last 30 Days", "Latest", "Waiting for Connect", "Not Reaching Connect"]);
  const line = dash.values.find((v) => v[0] === serverContent().forms["workshop-request"].title);
  assert.deepEqual(line.slice(2, 5), [2, 2, 2]);
  assert.ok(!JSON.stringify(dash.values).includes("Avery"), "the Dashboard holds counts, never an answer");
  assert.deepEqual(tab.values[0].slice(0, 3), ["Reference", "Received", "Version"]);
  assert.equal(tab.values.length, 3);
  assert.ok(tab.values.flat().includes(`'=HYPERLINK("https://example.org")`), "an answer that starts like a formula is written as words");
  // Styled in the brand's colours, a frozen header, no edge drawn in colour.
  assert.equal(tab.properties.gridProperties.frozenRowCount, 1);
  assert.deepEqual(tab.format.find((f) => f.repeatCell).repeatCell.cell.userEnteredFormat.backgroundColor, COLOURS.cream);
  assert.ok(!JSON.stringify(sheets.requests).includes("borders"), "no borders at all, so no coloured edge");

  // A retry, a renamed tab and a new answer: still one row each, found by its tag.
  tab.properties.title = "Renamed by a director";
  await q("UPDATE outbox SET state = 'pending', next_at = now() WHERE kind = 'sheets.backup'");
  await wake();
  assert.equal((await runOutbox()).backup.sent, 2, "the retry ran, and found both rows there");
  assert.equal(tab.values.length, 3, "no second copy");
  assert.equal(sheets.book.sheets.length, 3, "no second tab");
});

test("confidential answers stay out of the workbook unless the one setting says otherwise", async () => {
  await freshServer();
  const { columnsFor } = await import("../netlify/lib/backup.mjs");
  const all = (await columnsFor("staff-application")).map((c) => c.id);
  process.env.BACKUP_CONFIDENTIAL = "include";
  const withConf = (await columnsFor("staff-application")).map((c) => c.id);
  assert.ok(withConf.length > all.length, "the staff application has confidential questions");
  assert.ok(withConf.filter((id) => !all.includes(id)).length > 0);
  const plan = await workbookPlan();
  assert.ok(!plan.start.flat().some((v) => /confidential/.test(v)), "and Start Here stops saying they are left out");
});

test("one submission, everything set up: one Connect record, one receipt, one sheet row; a retry makes no second", async () => {
  const connect = fakeConnect();
  const sheets = fakeSheets();
  const shipped = (await freshServer(), serverContent().forms["workshop-request"]);
  await waiting(1, { connect, sheets, forms: { "workshop-request": { ...shipped, workflow: { ...shipped.workflow, receipt: "on" } } } });
  process.env.RECEIPT_SENDER = "directors@badgersupports.org";
  await runOutbox();
  await q("UPDATE outbox SET state = 'pending', next_at = now()");
  await wake();
  const again = await runOutbox();
  assert.deepEqual([again.ingest.sent, again.receipts.sent, again.backup.sent], [1, 1, 1], "every kind ran again");
  await runOutbox({ now: Date.now() + 60 * 60_000 });
  assert.equal(connect.stored.size, 1);
  assert.equal(connect.mailed.size, 1);
  assert.equal(sheets.book.sheets.find((s) => s.developerMetadata.some((m) => m.metadataValue === "form:workshop-request")).values.length, 2, "a header and one row");
  assert.deepEqual((await rows("connect.ingest")).map((r) => r.state), ["sent"]);
});
