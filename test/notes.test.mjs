/* Notes mode's endpoints, end to end through the router against a fresh database: who may read
 * and write notes, the version guard that keeps two editors from dropping each other's notes,
 * and the shape of a note. Nobody in this file is a real person. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freshServer, post, ORIGIN } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { q } from "../netlify/lib/db.mjs";
import { currentRevision, editorNotesGet } from "../netlify/lib/published.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function session(scopes, name = "Robin Example") {
  const id = crypto.randomBytes(32).toString("base64url");
  await q("INSERT INTO staff_sessions(id_hash,sub,name,scopes,expires_at) VALUES($1,'fictional-notes',$2,$3::jsonb,now()+interval '1 hour')",
    [crypto.createHash("sha256").update(id).digest("hex"), name, JSON.stringify(scopes)]);
  return `bss_staff=${id}`;
}

const get = (path_, cookie) => handle(new Request(ORIGIN + path_, { headers: { accept: "application/json", ...(cookie ? { cookie } : {}) } }), { ip: "192.0.2.96" });
const send = (path_, body, cookie) => handle(post(path_, body, { headers: cookie ? { cookie } : {} }), { ip: "192.0.2.96" });

const NOTE = {
  page: { name: "Home", route: "/" },
  anchor: { kind: "edit-target", id: "page:pg-home:b-home-hero/title", text: "You are not alone." },
  selector: "main > section > h1",
  pos: { dx: 0.92, dy: 0.18 },
  fingerprint: "0123456789abcdef",
  text: "This line is also the Connect home heading.",
};

test("notes refuse anyone who may not edit, and anyone signed out", async () => {
  await freshServer();
  const reader = await session(["forms.read:*"]);
  for (const [name, r] of [
    ["list, signed out", await get("/api/staff/notes")],
    ["list, a reader", await get("/api/staff/notes", reader)],
    ["save, signed out", await send("/api/staff/notes/save", { version: 0, ...NOTE })],
    ["save, a reader", await send("/api/staff/notes/save", { version: 0, ...NOTE }, reader)],
    ["remove, a reader", await send("/api/staff/notes/remove", { version: 0, id: "n000000000000" }, reader)],
    ["clear, a reader", await send("/api/staff/notes/clear", { version: 0, scope: "all" }, reader)],
  ]) {
    assert.ok(r.status === 401 || r.status === 403, `${name}: refused (${r.status})`);
  }
  assert.equal(await editorNotesGet(), null, "a refused write stores nothing");
});

test("a note is created with its author, read back by another editor, and changed in place", async () => {
  await freshServer();
  const robin = await session(["site.edit"], "Robin Example");
  const avery = await session(["site.edit"], "Avery Example");

  const made = await send("/api/staff/notes/save", { version: 0, ...NOTE }, robin);
  assert.equal(made.status, 200);
  const doc = await made.json();
  assert.equal(doc.version, 1);
  assert.equal(doc.notes.length, 1);
  const note = doc.notes[0];
  assert.ok(note.id, "the server names the note");
  assert.equal(note.author, "Robin Example", "the author is the editor who wrote it");
  assert.equal(note.state, "open");
  assert.equal(note.fingerprint, NOTE.fingerprint);
  assert.ok(note.createdAt);

  const seen = await (await get("/api/staff/notes", avery)).json();
  assert.equal(seen.notes.length, 1, "notes are shared: another editor reads the same list");
  assert.equal(seen.notes[0].text, NOTE.text);

  const changed = await send("/api/staff/notes/save", { version: 1, id: note.id, text: "Changed words." }, avery);
  assert.equal(changed.status, 200);
  const after = (await changed.json()).notes[0];
  assert.equal(after.text, "Changed words.");
  assert.equal(after.fingerprint, NOTE.fingerprint, "rewording a note leaves its fingerprint as made");
  assert.equal(after.author, "Robin Example", "and its author");

  const cleared = await send("/api/staff/notes/save", { version: 2, id: note.id, state: "cleared" }, robin);
  assert.equal(cleared.status, 200);
  const done = (await cleared.json()).notes[0];
  assert.equal(done.state, "cleared");
  assert.ok(done.clearedAt, "a cleared note says when");
});

test("a stale version is refused with the document as it stands, and drops nothing", async () => {
  await freshServer();
  const robin = await session(["site.edit"]);
  await send("/api/staff/notes/save", { version: 0, ...NOTE }, robin);
  const stale = await send("/api/staff/notes/save", { version: 0, ...NOTE, text: "A second editor, writing from the first read." }, robin);
  assert.equal(stale.status, 409);
  const body = await stale.json();
  assert.equal(body.error, "notes.conflict");
  assert.equal(body.version, 1);
  assert.equal(body.notes.length, 1, "the refusal carries the list as it stands, and the first note survives");
  const retry = await send("/api/staff/notes/save", { version: body.version, ...NOTE, text: "A second editor, writing from the first read." }, robin);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).notes.length, 2);
});

test("a note that is not shaped like a note is refused", async () => {
  await freshServer();
  const robin = await session(["site.edit"]);
  const bad = [
    [{ ...NOTE, text: "  " }, "empty words"],
    [{ ...NOTE, text: "x".repeat(2001) }, "words too long"],
    [{ ...NOTE, page: { name: "Home", route: "https://elsewhere.test/" } }, "a route off the site"],
    [{ ...NOTE, anchor: { kind: "guess", id: "", text: "" } }, "an anchor of no kind"],
    [{ ...NOTE, pos: { dx: 1.4, dy: 0.5 } }, "a position outside the box"],
    [{ ...NOTE, fingerprint: "not-a-digest" }, "a fingerprint that is no digest"],
    [{ page: NOTE.page }, "half a note"],
  ];
  for (const [body, name] of bad) {
    const r = await send("/api/staff/notes/save", { version: 0, ...body }, robin);
    assert.equal(r.status, 400, `${name}: refused`);
  }
  const noVersion = await send("/api/staff/notes/save", { ...NOTE }, robin);
  assert.equal(noVersion.status, 400, "a write with no version is refused");
  assert.equal(await editorNotesGet(), null, "nothing refused was stored");
});

test("remove takes one note; clear takes the cleared, or all", async () => {
  await freshServer();
  const robin = await session(["site.edit"]);
  let doc = await (await send("/api/staff/notes/save", { version: 0, ...NOTE }, robin)).json();
  doc = await (await send("/api/staff/notes/save", { version: doc.version, ...NOTE, text: "A second note." }, robin)).json();
  const [first, second] = doc.notes;
  doc = await (await send("/api/staff/notes/save", { version: doc.version, id: first.id, state: "cleared" }, robin)).json();

  const gone = await send("/api/staff/notes/remove", { version: doc.version, id: "n000000000000" }, robin);
  assert.equal(gone.status, 404, "removing a note that is not there says so");

  doc = await (await send("/api/staff/notes/clear", { version: doc.version, scope: "cleared" }, robin)).json();
  assert.deepEqual(doc.notes.map((n) => n.id), [second.id], "clearing the cleared leaves the open note");

  doc = await (await send("/api/staff/notes/remove", { version: doc.version, id: second.id }, robin)).json();
  assert.equal(doc.notes.length, 0, "remove takes the one note");

  doc = await (await send("/api/staff/notes/save", { version: doc.version, ...NOTE }, robin)).json();
  doc = await (await send("/api/staff/notes/clear", { version: doc.version, scope: "all" }, robin)).json();
  assert.equal(doc.notes.length, 0, "clear all takes every note");
});

test("notes are kept beside the published revision, never in it, and reach no visitor", async () => {
  await freshServer();
  const robin = await session(["site.edit"]);
  await send("/api/staff/notes/save", { version: 0, ...NOTE }, robin);
  assert.equal(await currentRevision(), null, "writing a note publishes nothing");
  const doc = await editorNotesGet();
  assert.equal(doc.schema, "bss.notes/1");
  assert.equal(doc.notes.length, 1);
  /* The only code that can ask for the notes is the edit tool's: no renderer, page script or
     other client file names the endpoints, so no signed-out page can carry a note. */
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(e.name) && fs.readFileSync(p, "utf8").includes("/api/staff/notes")) hits.push(path.relative(ROOT, p));
    }
  };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(hits, ["src/client/edit.js"]);
});
