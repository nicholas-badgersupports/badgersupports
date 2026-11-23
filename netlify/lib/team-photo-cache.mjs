/* The public site's own copies of the team photos (owner's direction, 23 November 2026: "instead
 * of loading the images from Connect, could we instead cache them on the website, and Connect
 * just refreshes them or adds this one? I still want instant updates when somebody changes
 * something on Connect.").
 *
 * Until this module, every portrait answer was fetched from Connect on the spot: the full
 * original upload crossed from Connect for every view, and even for a revalidation that ended
 * in a bodyless 304, because the tag is computed from the current bytes (live-team.mjs). A page
 * with a dozen portraits cost a dozen Connect round trips and the whole weight of every original
 * before it could finish loading.
 *
 * What is kept here is the validated original of one person's current photo, under their upload
 * id and the version Connect gave that upload. The roster is still read from Connect on every
 * page draw (live-content.mjs), so the page only ever links the current version of a photo:
 *
 *   a changed photo arrives under a new version, so its address is new, the copy kept here is
 *     not used for it, and the new bytes are fetched and kept on first view — no publish, no
 *     waiting for the freshness window below;
 *   a photo Connect is told about through the refresh door (live-content.mjs,
 *     teamPhotoRefreshResponse) is replaced or dropped the moment the call arrives;
 *   a copy whose version matches but whose freshness window has passed is read from Connect
 *     again before it is served, and a Connect answer of "not there" drops the copy — so a
 *     removal or opt-out that arrives by neither route still takes effect within the window.
 *
 * The window is thirty minutes, the same bound the Wall's moderated notes are held to
 * (live-content.mjs, WALL_FALLBACK_MS): personal content is never held here indefinitely.
 * An unversioned ask is never answered from here at all: it names no version to match, so it
 * keeps the old behaviour of a live read every time.
 *
 * The store is a seam, like the published revision's (published.mjs): Netlify Blobs when
 * deployed, memory on a laptop and in the tests. A store failure is a missed copy, never a
 * failed photo: every read and write here swallows its error and the caller falls back to
 * reading Connect, exactly as the site behaved before anything was kept. */

export const PHOTO_CACHE_FRESH_MS = 30 * 60 * 1000;
const STORE_NAME = "team-photos";

/* A store keeps one validated photo per upload id:
   { version: string|null, type, body: Buffer, at: epoch ms }. */
export function memoryPhotoStore() {
  const docs = new Map();
  return {
    kind: "memory",
    async get(key) { const v = docs.get(key); return v ? { ...v, body: Buffer.from(v.body) } : null; },
    async set(key, value) { docs.set(key, { ...value, body: Buffer.from(value.body) }); },
    async delete(key) { docs.delete(key); },
    clear() { docs.clear(); },
  };
}

/* Netlify Blobs, deployed. Loaded only there; a missing package is a named failure the callers
   above turn into a missed copy, never a guess. The bytes are the value; the version, type and
   time ride in the entry's metadata, as strings. */
export function blobsPhotoStore() {
  let store = null;
  const open = async () => {
    if (store) return store;
    let mod;
    try { mod = await import("@netlify/blobs"); } catch { throw Object.assign(new Error("@netlify/blobs is not installed"), { code: "publish.unavailable" }); }
    store = mod.getStore({ name: STORE_NAME, consistency: "strong" });
    return store;
  };
  return {
    kind: "blobs",
    async get(key) {
      const r = await (await open()).getWithMetadata(key, { type: "arrayBuffer" });
      if (!r?.data) return null;
      const m = r.metadata || {};
      return { version: m.version ? String(m.version) : null, type: String(m.type || ""), body: Buffer.from(r.data), at: Number(m.at) || 0 };
    },
    async set(key, value) {
      const body = Buffer.from(value.body);
      await (await open()).set(key, body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        { metadata: { version: value.version || "", type: value.type, at: String(value.at) } });
    },
    async delete(key) { await (await open()).delete(key); },
  };
}

let store = null;

/* Tests may install their own. The local rig and the tests (LOCAL_DB) keep copies in memory;
   anywhere else it is Netlify Blobs, never memory, which each instance would hold apart. */
export function usePhotoStore(s) { store = s; }
function current() {
  if (!store) store = process.env.LOCAL_DB ? memoryPhotoStore() : blobsPhotoStore();
  return store;
}
export const photoStoreKind = () => current().kind;

/* The copy kept for one upload id, or null when there is none — or when the store cannot be
   read, which the caller treats the same way. */
export async function cachedPhoto(id) {
  try { return await current().get(id); } catch (e) { console.error(`team photo cache: a kept copy could not be read (${e.code || e.message}); reading Connect instead`); return null; }
}

/* Keep a validated photo. A failure is logged and forgotten: the photo itself was already
   answered from the same bytes. */
export async function cachePhoto(id, entry) {
  try { await current().set(id, entry); } catch (e) { console.error(`team photo cache: a copy could not be kept (${e.code || e.message})`); }
}

/* Drop one person's copy (a removal, an opt-out, a refresh that found nothing). */
export async function dropCachedPhoto(id) {
  try { await current().delete(id); } catch (e) { console.error(`team photo cache: a copy could not be dropped (${e.code || e.message})`); }
}

/* This copy forgets everything it keeps. Tests start each case with nothing kept. */
export function forgetPhotoCache() {
  if (store && typeof store.clear === "function") store.clear();
}
