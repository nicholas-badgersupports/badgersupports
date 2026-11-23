/* The kept team photos (netlify/lib/team-photo-cache.mjs): what a photo ask does with a copy
   whose freshness window has passed, and what happens when the store itself fails. The fill,
   serve and refresh behaviour is covered where it is used (team-live, live-content); this file
   covers the copy store's own edges, with a fictional Connect and no build. */
import test from "node:test";
import assert from "node:assert/strict";
import { useConnect } from "../netlify/lib/connect.mjs";
import { teamPhoto } from "../netlify/lib/live-team.mjs";
import { usePhotoStore, memoryPhotoStore, cachedPhoto, cachePhoto, PHOTO_CACHE_FRESH_MS } from "../netlify/lib/team-photo-cache.mjs";

const ID = "p" + "a".repeat(24), VERSION = "b".repeat(32), NEWER = "c".repeat(32);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9l8AAAAASUVORK5CYII=", "base64");
let mode = "ok", fetches = 0;
const cfg = {
  url: "https://home.badgersupports.org", keyId: "fictional-cache-key", secret: "fictional-cache-secret-32-chars-long",
  fetch: async (href) => {
    const u = new URL(href);
    assert.equal(u.origin, cfg.url); assert.ok(u.pathname.startsWith("/p/"));
    fetches++;
    if (mode === "down") throw new Error("fictional Connect outage");
    if (mode === "gone") return new Response(null, { status: 404 });
    return new Response(PNG, { headers: { "content-type": "image/png" } });
  },
};
const ask = (v = VERSION) => teamPhoto(new Request(`http://site.test/api/team-photo/${ID}?v=${v}`), ID);
function reset(store = memoryPhotoStore()) {
  mode = "ok"; fetches = 0; useConnect(cfg); usePhotoStore(store);
}
test.after(() => { useConnect(null); usePhotoStore(null); });

test("a stale copy is re-read, and served when the re-read fails rather than lost", async () => {
  reset();
  const store = memoryPhotoStore(); usePhotoStore(store);
  await cachePhoto(ID, { version: VERSION, type: "image/png", body: PNG, at: Date.now() - PHOTO_CACHE_FRESH_MS - 1 });
  mode = "down";
  const stale = await ask();
  assert.equal(stale.status, 200, "a failed re-read serves the kept copy");
  assert.deepEqual(Buffer.from(await stale.arrayBuffer()), PNG);
  assert.equal(fetches, 1, "the re-read was attempted");
  mode = "gone";
  const gone = await ask();
  assert.equal(gone.status, 404, "a re-read that says gone answers 404");
  assert.equal(await cachedPhoto(ID), null, "and drops the kept copy");
});

test("a copy kept under another version is never served for this version", async () => {
  reset();
  await cachePhoto(ID, { version: VERSION, type: "image/png", body: PNG, at: Date.now() });
  const r = await ask(NEWER);
  assert.equal(r.status, 200);
  assert.equal(fetches, 1, "the new version was read from Connect");
  assert.equal((await cachedPhoto(ID)).version, NEWER, "and is now the copy kept");
});

test("a store that fails is a missed copy, never a failed photo", async () => {
  reset({
    kind: "broken",
    get: async () => { throw new Error("fictional store outage"); },
    set: async () => { throw new Error("fictional store outage"); },
    delete: async () => { throw new Error("fictional store outage"); },
  });
  const errors = []; const was = console.error; console.error = (...a) => errors.push(a.join(" "));
  try {
    const r = await ask();
    assert.equal(r.status, 200);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG);
    assert.equal(fetches, 1, "the photo was read live");
  } finally { console.error = was; }
  assert.ok(errors.length >= 1, "the store failure was logged, not hidden");
});
