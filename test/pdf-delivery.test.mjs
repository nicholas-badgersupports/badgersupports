import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { deliverForm, FILE_PIECE_BYTES, DELIVERY_BUDGET_MS, useConnect } from "../netlify/lib/connect.mjs";
import { freshServer, post, ORIGIN, workshopAnswers } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { many, one, q, useAdapter, getAdapter } from "../netlify/lib/db.mjs";
import { deliverOnce, deliveriesSettled, deliveryCounts, definitionFor } from "../netlify/lib/deliver.mjs";

const pdf = (size = FILE_PIECE_BYTES + 19) => { const b = Buffer.alloc(size, 32); b.write("%PDF-1.4\n% fictional delivery verification\n"); return b; };
const digest = b => crypto.createHash("sha256").update(b).digest("hex");
const entry = (id, b, question = "letter") => ({ question, fileId: id, name: "synthetic.pdf", type: "application/pdf", bytes: b.length, sha256: digest(b) });
const payload = files => ({ ref: "pdf-fixture-0001", form: "recommendation-letter", formTitle: "Synthetic recommendation", version: 1, receivedAt: new Date().toISOString(), anonymous: false, columns: [{ id: "letter", label: "PDF" }], answers: { letter: "Synthetic file" }, files });

/* Protocol fixture; independent actual receiver/database proof is run outside the repository. */
function receiver({ interrupt = () => null, mutate = r => r } = {}) {
  const submissions = new Map(), parts = new Map(), complete = new Map(), calls = [];
  const cfg = { url: "https://connect.example.org", keyId: "pdf-fixture", secret: "fictional-service-key-for-pdf-delivery-only-0001", ssoSecret: "fictional-sso-secret-for-pdf-delivery-only-0001", fetch: async (_url, init) => {
    const b = JSON.parse(init.body); calls.push(b);
    const mode = interrupt(b, calls);
    if (mode === "down") throw new TypeError("fixture offline");
    let out;
    if (b.action === "publicFormIngest") {
      const saved = submissions.get(b.ref); if (!saved) submissions.set(b.ref, b);
      out = { ok: true, ref: b.ref, stored: saved ? "already" : "new", files: ((saved || b).files || []).map(f => f.fileId) };
    } else {
      const key = `${b.ref}/${b.fileId}`;
      const f = submissions.get(b.ref)?.files.find(f => f.fileId === b.fileId);
      assert.ok(f, "only accepted files are transferred");
      const data = Buffer.from(b.data, "base64"); assert.ok(data.length <= FILE_PIECE_BYTES);
      if (!complete.has(key)) {
        const pieces = parts.get(key) || new Map(); parts.set(key, pieces);
        if (!pieces.has(b.piece)) pieces.set(b.piece, data);
        const wanted = Array.from({ length: b.pieces }, (_, i) => i).filter(i => !pieces.has(i));
        if (!wanted.length) {
          const bytes = Buffer.concat(Array.from({ length: b.pieces }, (_, i) => pieces.get(i)));
          assert.equal(bytes.length, f.bytes); assert.equal(digest(bytes), f.sha256); complete.set(key, bytes);
        }
        out = { ok: true, ref: b.ref, fileId: b.fileId, complete: complete.has(key), ...(wanted.length ? { wanted } : {}) };
      } else out = { ok: true, ref: b.ref, fileId: b.fileId, complete: true };
    }
    if (mode === "lost") throw new TypeError("fixture reply lost");
    return { json: async () => mutate(out, b, calls) };
  } };
  return { cfg, calls, submissions, parts, complete };
}

test("two maximum-size PDFs finish only after exact receiver reconstruction", async () => {
  const bytes = pdf(3 * 1024 * 1024), files = [entry("A".repeat(32), bytes, "resume"), entry("B".repeat(32), bytes, "cover_letter")];
  const remote = receiver(); const p = { ...payload(files), form: "staff-application" };
  const result = await deliverForm(remote.cfg, p, { readFile: () => bytes });
  assert.deepEqual(result.files, files.map(f => f.fileId)); assert.equal(remote.calls.length, 13);
  for (const f of files) assert.deepEqual(remote.complete.get(`${p.ref}/${f.fileId}`), bytes);
});

for (const point of ["ingest", "middle", "final"]) test(`a lost ${point} reply resumes with one answer and one exact PDF`, async () => {
  let interrupted = false;
  const bytes = pdf(2 * FILE_PIECE_BYTES + 19), file = entry("C".repeat(32), bytes), p = payload([file]);
  const remote = receiver({ interrupt: b => {
    const matches = point === "ingest" ? b.action === "publicFormIngest" : b.action === "publicFormFilePiece" && b.piece === (point === "middle" ? 1 : 2);
    if (!interrupted && matches) { interrupted = true; return "lost"; }
  } });
  await assert.rejects(deliverForm(remote.cfg, p, { readFile: () => bytes }), { code: "connect.unreachable" });
  const result = await deliverForm(remote.cfg, p, { readFile: () => bytes });
  assert.deepEqual(result.files, [file.fileId]); assert.equal(remote.submissions.size, 1);
  assert.equal(remote.complete.size, 1); assert.deepEqual(remote.complete.get(`${p.ref}/${file.fileId}`), bytes);
});

test("unaccepted descriptors, mismatched replies and malformed progress never count as delivery", async () => {
  const bytes = pdf(), file = entry("D".repeat(32), bytes), p = payload([file]);
  for (const mutate of [
    (r,b) => b.action === "publicFormIngest" ? { ...r, files: [] } : r,
    (r,b) => b.action === "publicFormIngest" ? { ...r, files: ["unknown"] } : r,
    (r,b) => b.action === "publicFormIngest" ? { ...r, files: [file.fileId, file.fileId] } : r,
    (r,b) => b.action === "publicFormIngest" ? { ...r, ref: "different-ref" } : r,
    (r,b) => b.action === "publicFormFilePiece" ? { ...r, fileId: "wrong-file" } : r,
    (r,b) => b.action === "publicFormFilePiece" ? { ...r, complete: "true" } : r,
    (r,b) => b.action === "publicFormFilePiece" ? { ...r, complete: false, wanted: [0] } : r,
    (r,b) => b.action === "publicFormFilePiece" ? { ...r, complete: false, wanted: [99] } : r,
    (r,b) => b.action === "publicFormFilePiece" ? { ...r, complete: false, wanted: [1, 1] } : r,
  ]) await assert.rejects(deliverForm(receiver({ mutate }).cfg, p, { readFile: () => bytes }));
});

test("changed/missing local bytes and expired budgets make no remote call; receiver restart waits for retry", async () => {
  const bytes = pdf(), file = entry("E".repeat(32), bytes), p = payload([file]);
  const remote = receiver();
  for (const readFile of [() => undefined, () => Buffer.from("%PDF-wrong")]) await assert.rejects(deliverForm(remote.cfg, p, { readFile }));
  await assert.rejects(deliverForm(remote.cfg, p, { readFile: () => bytes, deadline: Date.now() - 1 }), { code: "connect.delivery-pending" });
  assert.equal(remote.calls.length, 0);
  const restart = receiver({ mutate: (r,b) => b.action === "publicFormFilePiece" ? { ok: false, ref: b.ref, fileId: b.fileId, restart: true } : r });
  await assert.rejects(deliverForm(restart.cfg, p, { readFile: () => bytes }), { code: "connect.file-restart" });
  assert.equal(restart.calls.length, 2, "no unbounded in-request restart loop");
});

async function waitingLetter(bytes) {
  await freshServer(); useConnect(null);
  await q("INSERT INTO form_state (form_key, state, changed_by) VALUES ('recommendation-letter', 'open', 'fixture')");
  const upload = await handle(new Request(`${ORIGIN}/api/forms/recommendation-letter/files?q=letter`, { method: "POST", headers: { "content-type": "application/pdf", origin: ORIGIN, "x-file-name": "synthetic.pdf", accept: "application/json" }, body: bytes }), { ip: "192.0.2.90" });
  const { fileId } = await upload.json(); assert.ok(fileId);
  const send = await handle(post("/api/forms/recommendation-letter/submit", { _form: "recommendation-letter", _version: "1", _idempotency: "pdf-test-once", name: "Synthetic Example", email: "synthetic@example.org", applicant: "Synthetic Example", letter: fileId }), { ip: "192.0.2.90" });
  assert.equal(send.status, 200); await deliveriesSettled(); return { fileId, ref: (await send.json()).ref };
}

test.afterEach(() => useConnect(null));

test("native upload/submit/outbox leaves an interrupted PDF unsent; permitted retry completes and stamps it", async () => {
  const bytes = pdf(); const { fileId, ref } = await waitingLetter(bytes);
  let once = true;
  const remote = receiver({ interrupt: b => { if (once && b.action === "publicFormFilePiece" && b.piece === 1) { once = false; return "down"; } } });
  useConnect(remote.cfg);
  assert.equal((await deliverOnce()).failed, 1);
  assert.equal((await one("SELECT state FROM outbox WHERE kind = 'connect.ingest'")).state, "failed");
  assert.equal((await one("SELECT delivered_at FROM uploads WHERE file_id = $1", [fileId])).delivered_at, null);
  assert.equal((await many("SELECT * FROM submission_events WHERE kind = 'delivered'")).length, 0);
  assert.equal((await deliverOnce({ force: true })).sent, 1);
  assert.ok((await one("SELECT delivered_at FROM uploads WHERE file_id = $1", [fileId])).delivered_at);
  assert.equal((await deliveryCounts())["recommendation-letter"].sent, 1);
  assert.deepEqual(remote.complete.get(`${ref}/${fileId}`), bytes);
  assert.equal(remote.submissions.size, 1);
});

test("legacy answer-only sent rows show pending and only an authorized form retry requeues their PDFs", async () => {
  const bytes = pdf(); const { fileId } = await waitingLetter(bytes);
  await q("UPDATE outbox SET state = 'sent', sent_at = now() WHERE kind = 'connect.ingest'");
  const remote = receiver(); useConnect(remote.cfg);
  assert.equal((await deliveryCounts())["recommendation-letter"].pending, 1);
  assert.equal((await deliverOnce({ force: true, forms: ["workshop-request"] })).sent, 0);
  assert.equal(remote.calls.length, 0);
  assert.equal((await deliverOnce({ force: true, forms: ["recommendation-letter"] })).sent, 1);
  assert.ok((await one("SELECT delivered_at FROM uploads WHERE file_id = $1", [fileId])).delivered_at);
  assert.equal((await deliveryCounts())["recommendation-letter"].pending, 0);
});


test("a claim lost after remote completion cannot stamp local delivery or history", async () => {
  const { fileId } = await waitingLetter(pdf(40));
  const remote = receiver(), original = remote.cfg.fetch;
  remote.cfg.fetch = async (...args) => {
    const out = await original(...args), b = JSON.parse(args[1].body);
    if (b.action === "publicFormFilePiece") await q("UPDATE outbox SET claim_token = 'another-worker' WHERE kind = 'connect.ingest'");
    return out;
  };
  useConnect(remote.cfg);
  assert.equal((await deliverOnce()).sent, 0);
  assert.equal((await one("SELECT state FROM outbox WHERE kind = 'connect.ingest'")).state, "pending");
  assert.equal((await one("SELECT delivered_at FROM uploads WHERE file_id = $1", [fileId])).delivered_at, null);
  assert.equal((await many("SELECT * FROM submission_events WHERE kind = 'delivered'")).length, 0);
});

test("a failed completion transaction rolls back stamps and history, then retry finishes idempotently", async () => {
  const { fileId } = await waitingLetter(pdf(40)); const remote = receiver(); useConnect(remote.cfg);
  const adapter = await getAdapter(); let fail = true;
  useAdapter({ ...adapter, transaction: fn => adapter.transaction(raw => fn({ query: async (sql, params) => {
    if (fail && sql.startsWith("INSERT INTO submission_events")) { fail = false; throw new Error("fictional completion interruption"); }
    return raw.query(sql, params);
  } })) });
  try {
    assert.equal((await deliverOnce()).failed, 1);
    assert.equal((await one("SELECT delivered_at FROM uploads WHERE file_id = $1", [fileId])).delivered_at, null);
    assert.equal((await many("SELECT * FROM submission_events WHERE kind = 'delivered'")).length, 0);
  } finally { useAdapter(adapter); }
  assert.equal((await deliverOnce({ force: true })).sent, 1);
  assert.equal(remote.submissions.size, 1); assert.equal(remote.complete.size, 1);
});

test("a bounded run releases unstarted claimed rows for the next invocation", async () => {
  await waitingLetter(pdf());
  assert.equal((await handle(post("/api/forms/workshop-request/submit", workshopAnswers()), { ip: "192.0.2.91" })).status, 200);
  await deliveriesSettled();
  const remote = receiver(), original = remote.cfg.fetch, realNow = Date.now; let clock = realNow();
  remote.cfg.fetch = async (...args) => {
    const out = await original(...args); clock += DELIVERY_BUDGET_MS + 1; return out;
  };
  useConnect(remote.cfg); Date.now = () => clock;
  try { assert.equal((await deliverOnce()).failed, 1); } finally { Date.now = realNow; }
  const rows = await many("SELECT state, claim_token, claim_until FROM outbox WHERE kind = 'connect.ingest' ORDER BY id");
  assert.deepEqual(rows.map(r => r.state), ["failed", "pending"]);
  assert.ok(rows.every(r => r.claim_token === null && r.claim_until === null));
  assert.equal(remote.calls.length, 1, "no transfer starts after the shared invocation deadline");
});

test("legacy and ordinary pending counts combine, and an empty retry scope changes nothing", async () => {
  await waitingLetter(pdf());
  await q("UPDATE outbox SET state = 'sent', sent_at = now() WHERE kind = 'connect.ingest'");
  const sub = await one("SELECT * FROM submissions LIMIT 1");
  await q("INSERT INTO submissions (ref,form_key,form_version,idem_key,answers,anonymous) VALUES ('pdf-normal-pending-0001',$1,1,'fixture-second','{}'::jsonb,false)", [sub.form_key]);
  const second = await one("SELECT id FROM submissions WHERE ref = 'pdf-normal-pending-0001'");
  await q("INSERT INTO outbox (submission_id,kind,state,dedupe_key) VALUES ($1,'connect.ingest','pending','fixture-second')", [second.id]);
  const remote = receiver(); useConnect(remote.cfg);
  assert.equal((await deliveryCounts())["recommendation-letter"].pending, 2);
  assert.equal((await deliverOnce({ force: true, forms: [] })).sent, 0);
  assert.equal((await one("SELECT state FROM outbox ORDER BY id LIMIT 1")).state, "sent");
  assert.equal(remote.calls.length, 0);
});

test("a missing historical definition cannot silently use another version's file questions", async () => {
  await freshServer(); assert.equal(await definitionFor("recommendation-letter", 999), null);
  assert.equal((await definitionFor("recommendation-letter", 1)).version, 1);
});
