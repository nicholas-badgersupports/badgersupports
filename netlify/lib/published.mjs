/* The published revision: every word saved with the edit button, and the page structure, as one numbered document
 * the pages are drawn with (netlify/lib/pages.mjs). A save or structure change that passes its checks publishes the
 * next revision (owner, 24 Oct 2026: "a permitted, valid save publishes"); Refresh now publishes again when the last
 * write failed. The document lives outside the database, so drawing a page never wakes it.
 *
 *   { schema: "bss.revision/1", n, at, by, stamp, edits: { target: words }, sstamp?, structure? }
 *
 * `stamp` is the newest history row the revision holds (content_edit_history.id) and `sstamp` the structure's
 * version (site_structure.id), so a slower save that read before a quicker one never writes over the quicker one's
 * revision. A revision with no structure is drawn as the build's pages. Every revision is kept, under
 * revisions/<n>, so any of them can be brought back (structure.mjs, restoreRevision).
 *
 * The store is a seam: Netlify Blobs when deployed (`@netlify/blobs`, an owner action to install), memory on
 * a laptop and in the tests. With no store, nothing is published and the editor is told so.
 */

import { one } from "./db.mjs";
import { revisionEdits } from "./edits.mjs";
import { structureNow } from "./structure.mjs";

export const REVISION_SCHEMA = "bss.revision/1";

/* A store keeps JSON documents by key. */
export function memoryStore() {
  const docs = new Map();
  return {
    kind: "memory",
    async get(key) { return docs.has(key) ? structuredClone(docs.get(key)) : null; },
    async set(key, value) { docs.set(key, structuredClone(value)); },
  };
}

/* Netlify Blobs, deployed. Loaded only there; a missing package is a named failure, never a guess. */
export function blobsStore() {
  let store = null;
  const open = async () => {
    if (store) return store;
    let mod;
    try { mod = await import("@netlify/blobs"); } catch { throw Object.assign(new Error("@netlify/blobs is not installed"), { code: "publish.unavailable" }); }
    store = mod.getStore({ name: "published", consistency: "strong" });
    return store;
  };
  return {
    kind: "blobs",
    async get(key) { return (await open()).get(key, { type: "json" }); },
    async set(key, value) { await (await open()).setJSON(key, value); },
  };
}

let store = null;

/* Tests may install their own. The local rig and the tests (LOCAL_DB) keep it in memory; anywhere else it is
   Netlify Blobs, never memory, which each instance would hold apart. */
export function useStore(s) { store = s; }
function current() {
  if (!store) store = process.env.LOCAL_DB ? memoryStore() : blobsStore();
  return store;
}
export const storeKind = () => current().kind;

/* The revision now, read from the store on every call and never held in this instance. A save is published by
   whichever running copy took it; a copy that held an older revision would draw it into a page the CDN has just
   cleared and then keeps for up to 30 minutes. null when nothing was ever published. */
export async function currentRevision() {
  return current().get("current");
}

export const VERSIONS_LIMIT = 50;

/* One published revision by number, or null. */
export async function readRevision(n) {
  try { return await current().get(`revisions/${Number(n)}`); } catch (e) { throw Object.assign(new Error(e.message), { code: "publish.unavailable" }); }
}

/* The newest VERSIONS_LIMIT revisions, newest first: { n, at, by }. Older ones are kept but not listed. */
export async function listRevisions() {
  const top = await currentRevision();
  const out = [];
  for (let n = top?.n || 0; n >= 1 && out.length < VERSIONS_LIMIT; n--) {
    const r = await readRevision(n);
    if (r) out.push({ n: r.n, at: r.at, by: r.by || "" });
  }
  return out;
}

/* Publish every saved word and the structure now as the next revision. Returns { n, at } or throws with code
   publish.unavailable. */
export async function publishRevision(who, { now = new Date() } = {}) {
  const { version, doc } = await structureNow();
  const sstamp = Number(version);
  const edits = await revisionEdits(doc);
  const row = await one("SELECT max(id) AS id FROM content_edit_history");
  const stamp = Number(row?.id || 0);
  const s = current();
  let was;
  try { was = await s.get("current"); } catch (e) { throw Object.assign(new Error(e.message), { code: "publish.unavailable" }); }
  // A save that read the words before a later one has nothing newer to say, and the same words are not
  // published twice.
  if (was && was.stamp >= stamp && (was.sstamp || 0) >= sstamp) return { n: was.n, at: was.at, kept: true };
  const revision = { schema: REVISION_SCHEMA, n: (was?.n || 0) + 1, at: now.toISOString(), by: who?.name || "", stamp, edits, ...(sstamp ? { sstamp, structure: doc } : {}) };
  try {
    await s.set(`revisions/${revision.n}`, revision);
    await s.set("current", revision);
  } catch (e) {
    throw Object.assign(new Error(e.message), { code: "publish.unavailable" });
  }
  return { n: revision.n, at: revision.at };
}

/* Clearing Netlify's CDN by tag. Deployed: purgeCache from `@netlify/functions` (an owner action to install),
   which needs no token inside a Netlify function. Locally and in the tests it is recorded, nothing more. */
let purger = null;
const purgedHere = [];
export function usePurger(p) { purger = p; }
export const purged = () => purgedHere.slice();
export async function purgeTags(tags) {
  if (purger) return purger(tags);
  if (process.env.LOCAL_DB) { purgedHere.push(...tags); return; }
  let mod;
  try { mod = await import("@netlify/functions"); } catch { throw Object.assign(new Error("@netlify/functions is not installed"), { code: "purge.unavailable" }); }
  await mod.purgeCache({ tags });
}

/* A small note kept beside the revision: the outbox's next due time (deliver.mjs), so a scheduled run with
   nothing to do never wakes the database. */
export const noteGet = (key) => current().get(`notes/${key}`);
export const noteSet = (key, value) => current().set(`notes/${key}`, value);
