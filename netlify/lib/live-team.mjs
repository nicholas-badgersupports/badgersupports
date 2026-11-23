/* Public profiles are read on a page draw, never kept in a second roster or a warm cache.
   Production HTML and media contain no built-in people to resurrect after an opt-out.
   Uploaded photos use a fixed Connect path; visitor input can never choose a fetch origin.
   The photos themselves are kept on this site once validated (team-photo-cache.mjs): a page
   draw still reads the roster live, so it only ever links a photo's current version, and a
   version the site holds a fresh copy of is answered from that copy instead of fetching the
   original from Connect again. */
import { call, serviceConfigNow, sha256Hex } from "./connect.mjs";
import { mapTeam, TEAM_EXPORT } from "../../ops/connect-feed.mjs";
import { PHOTO_CACHE_FRESH_MS, cachedPhoto, cachePhoto, dropCachedPhoto } from "./team-photo-cache.mjs";

export const PHOTO_ID = /^p[0-9a-f]{24}$/;
const VERSION = /^[0-9a-f]{32}$/;
const PHOTO_MAX = 4 * 1024 * 1024;
const RASTER_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];
/* A photo may also be asked for at one of these square widths (?w=). The width changes only the
   size and format of the bytes served, never which photo is served, and the resized bytes come
   from this site's own image CDN reading the same bounded address (see photoVariant). */
const PHOTO_WIDTHS = new Set(["256", "512", "800"]);

/* The raster's magic bytes must agree with the type it claims to be. */
function rasterOk(type, body) {
  return type === "image/png" ? body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : type === "image/jpeg" ? body[0] === 255 && body[1] === 216 && body[2] === 255
    : type === "image/webp" ? body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP"
    : body.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(body.toString("ascii", 8, Math.min(body.length, 40)));
}

/* A whole body, or null once it grows past the photo bound. */
async function readBounded(reader) {
  const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > PHOTO_MAX) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/* The format this site's image CDN negotiates for a reader, in its own order (WebP, then AVIF).
   Null means it would keep the original format, so no resized copy is worth asking for. */
function negotiatedFormat(accept) {
  const value = String(accept || "").toLowerCase();
  return value.includes("image/webp") ? "webp" : value.includes("image/avif") ? "avif" : null;
}

/* The resized copy, from this site's image CDN reading the same photo through this same bounded
   address without a width, so eligibility is checked there again. The wait is kept short on
   purpose: a resized copy is only worth serving when it arrives promptly, and any failure —
   a slow or missing CDN included — is answered with the original bytes, so a photo is never
   lost, or left hanging, because of a resizing problem. */
async function photoVariant(req, id, version, width) {
  try {
    const cdn = new URL("/.netlify/images", new URL(req.url).origin);
    cdn.searchParams.set("url", `/api/team-photo/${id}${version ? `?v=${version}` : ""}`);
    cdn.searchParams.set("w", width); cdn.searchParams.set("h", width); cdn.searchParams.set("fit", "cover");
    const r = await globalThis.fetch(cdn.href, { redirect: "manual", signal: AbortSignal.timeout(1200), headers: { accept: req.headers.get("accept") || "" } });
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (r.status !== 200 || !RASTER_TYPES.includes(type) || Number(r.headers.get("content-length")) > PHOTO_MAX) { await r.body?.cancel(); return null; }
    const reader = r.body?.getReader();
    if (!reader) return null;
    const body = await readBounded(reader);
    return body && rasterOk(type, body) ? { type, body } : null;
  } catch { return null; }
}

/* If-None-Match uses weak comparison; commas inside another quoted tag are not separators. */
function photoTagMatches(value, etag) {
  const field = String(value || "").trim();
  if (field === "*") return true;
  const tags = field.match(/(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"/g) || [];
  if (tags.join(",") !== field.replace(/[ \t]/g, "")) return false;
  return tags.some(tag => tag === etag || tag === `W/${etag}`);
}

export function publicUpload(value, origin) {
  try {
    const u = new URL(value);
    const id = u.pathname.slice(3);
    const version = u.searchParams.get("v");
    if (u.origin !== new URL(origin).origin || !u.pathname.startsWith("/p/") || !PHOTO_ID.test(id)
        || u.username || u.password || u.hash || [...u.searchParams.keys()].some((k) => k !== "v")
        || u.searchParams.getAll("v").length > 1 || (version !== null && !VERSION.test(version))) return null;
    return { uploadId: id, ...(version ? { version } : {}) };
  } catch { return null; }
}

export async function teamNow() {
  const cfg = serviceConfigNow();
  if (!cfg) throw Object.assign(new Error("Team profiles are not connected."), { code: "team.unavailable" });
  const reply = await call(cfg, { action: "publicTeam" });
  if (reply.schema !== TEAM_EXPORT || !Array.isArray(reply.people)) throw Object.assign(new Error("Team profiles could not be read."), { code: "team.bad-reply" });
  const { team } = mapTeam(reply);
  for (const p of team.people) if (p.photo) {
    const photo = publicUpload(p.photo.link, cfg.url);
    if (photo && photo.uploadId === p.id) p.photo = { ...photo, alt: p.photo.alt || "" };
    else delete p.photo;
  }
  return team;
}

/* One bounded read of a photo from Connect, with every check the proxy has always made:
   redirects refused, the claimed type one of the raster types and agreed with by the magic
   bytes, the whole body under the photo bound. The outcome is one of:
     { outcome: "ok", type, body }  the validated bytes;
     { outcome: "gone" }            Connect answered 404 or 403: no such eligible photo;
     { outcome: "bad" }             any other answer, or none: nothing here may be kept or served;
     { outcome: "unavailable" }     Connect is not set up on this site.
   Eligibility is Connect's to settle, here and nowhere else: bytes are only ever kept after
   this read has validated them (team-photo-cache.mjs). */
async function fetchFromConnect(id, version) {
  const cfg = serviceConfigNow();
  if (!cfg) return { outcome: "unavailable" };
  const target = new URL(`/p/${id}`, cfg.url);
  if (version) target.searchParams.set("v", version);
  try {
    const r = await (cfg.fetch || globalThis.fetch)(target.href, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { accept: "image/png,image/jpeg,image/webp,image/avif" } });
    if (r.status === 404 || r.status === 403) { await r.body?.cancel(); return { outcome: "gone" }; }
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (r.status !== 200 || !RASTER_TYPES.includes(type) || Number(r.headers.get("content-length")) > PHOTO_MAX) { await r.body?.cancel(); return { outcome: "bad" }; }
    const reader = r.body?.getReader();
    if (!reader) return { outcome: "bad" };
    const body = await readBounded(reader);
    if (!body || !rasterOk(type, body)) return { outcome: "bad" };
    return { outcome: "ok", type, body };
  } catch { return { outcome: "bad" }; }
}

const photoFailure = (status) => new Response(null, { status, headers: { "cache-control": "no-store", "netlify-cdn-cache-control": "no-store", "x-content-type-options": "nosniff" } });

/* Answer one photo ask from validated bytes, wherever they came from: the tag is the hash of
   the bytes, so a revalidation is answered from the bytes in hand; a sized ask is answered with
   the resized copy when this site's image CDN can make one promptly, and with the original
   bytes when it cannot, exactly as before anything was kept. */
async function servePhoto(req, id, version, width, { type, body }) {
  const etag = `"${sha256Hex(Buffer.concat([Buffer.from(type + "\n"), body]))}"`;
  const headers = { "content-type": type, "x-content-type-options": "nosniff", "cache-control": "public, max-age=0, must-revalidate", "netlify-cdn-cache-control": "public, s-maxage=300", "netlify-vary": "query=v|w", "netlify-cache-tag": "page,team-photo", etag };
  if ((req.method === "GET" || req.method === "HEAD") && photoTagMatches(req.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  if (width) {
    const format = negotiatedFormat(req.headers.get("accept"));
    if (format) {
      /* The resized copy's tag is bound to the original's, so it changes whenever the photo,
         the width, or the negotiated format does — and names no bytes but the resized ones. */
      const vEtag = `"${sha256Hex(Buffer.from(`${etag}|w=${width}|${format}`))}"`;
      const vHeaders = { ...headers, "content-type": `image/${format}`, etag: vEtag, vary: "Accept" };
      if ((req.method === "GET" || req.method === "HEAD") && photoTagMatches(req.headers.get("if-none-match"), vEtag)) return new Response(null, { status: 304, headers: vHeaders });
      const variant = await photoVariant(req, id, version, width);
      if (variant) return new Response(req.method === "HEAD" ? null : variant.body, { headers: { ...vHeaders, "content-type": variant.type } });
    }
  }
  return new Response(req.method === "HEAD" ? null : body, { headers });
}

/* A photo ask. A versioned ask the site holds a fresh copy of is answered from that copy —
   no Connect round trip, no original crossing the wire again — because the roster that linked
   it was itself read from Connect on this page draw and names the photo's current version
   (team-photo-cache.mjs sets out the whole arrangement). Any other ask is read from Connect
   as before, and what it validates is kept under the version asked for. A stale copy whose
   re-read fails is served rather than lost, the site's last-good habit; a re-read that says
   the photo is gone drops the copy and answers 404. */
export async function teamPhoto(req, id) {
  const u = new URL(req.url), versions = u.searchParams.getAll("v"), widths = u.searchParams.getAll("w");
  if (!PHOTO_ID.test(id) || versions.length > 1 || widths.length > 1 || [...u.searchParams.keys()].some((k) => k !== "v" && k !== "w") || (versions.length && !VERSION.test(versions[0])) || (widths.length && !PHOTO_WIDTHS.has(widths[0]))) return photoFailure(400);
  const version = versions.length ? versions[0] : null;
  const width = widths.length ? widths[0] : null;
  const kept = version ? await cachedPhoto(id) : null;
  const usable = kept && kept.version === version ? kept : null;
  if (usable && Date.now() - usable.at < PHOTO_CACHE_FRESH_MS) return servePhoto(req, id, version, width, usable);
  const got = await fetchFromConnect(id, version);
  if (got.outcome === "ok") {
    if (version) await cachePhoto(id, { version, type: got.type, body: got.body, at: Date.now() });
    return servePhoto(req, id, version, width, got);
  }
  if (got.outcome === "gone") { if (kept) await dropCachedPhoto(id); return photoFailure(404); }
  if (usable) { console.error(`team photo: Connect could not be read (${got.outcome}); answering with the copy this site keeps`); return servePhoto(req, id, version, width, usable); }
  return photoFailure(got.outcome === "unavailable" ? 503 : 502);
}

/* Connect has said a photo changed (live-content.mjs, teamPhotoRefreshResponse): read the new
   bytes from Connect now and keep them, or drop the copy when Connect says the photo is gone.
   A failed read keeps the copy that is there and says so; the freshness window bounds how long
   it can then be served without another read. Returns the fetch outcome. */
export async function refreshTeamPhoto(id, version = null) {
  const got = await fetchFromConnect(id, version);
  if (got.outcome === "ok") await cachePhoto(id, { version, type: got.type, body: got.body, at: Date.now() });
  else if (got.outcome === "gone") await dropCachedPhoto(id);
  return got.outcome;
}

/* Connect has said a photo is gone: drop the copy this site keeps, without asking Connect. */
export async function dropTeamPhoto(id) {
  await dropCachedPhoto(id);
}
