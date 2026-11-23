/* Approved public catalogues between publishes. Resources and Wall notes use bounded last-good
   records in the existing publication store; current profile eligibility is read without a roster cache; one failed catalogue never replaces another with an empty
   success. Only mapped public data is persisted — and, since 23 November 2026, the team photos
   themselves, as validated copies under each upload's current version (team-photo-cache.mjs).
   Prototype pages never contact Connect. */
import crypto from 'node:crypto';
import { call, serviceConfigNow, hmacB64u, signatureBase } from './connect.mjs';
import { noteGet, noteSet, purgeTags } from './published.mjs';
import { mapResources, mapWall, WALL_EXPORT } from '../../ops/connect-feed.mjs';
import { wallWithDefaults } from '../../ops/wall-defaults.mjs';
import { serverContent } from './content.mjs';
import { teamNow, teamPhoto, refreshTeamPhoto, dropTeamPhoto, PHOTO_ID } from "./live-team.mjs";
import { alumniNow } from "./alumni-history.mjs";
import { legalNow } from "./legal.mjs";

export const SHARED_FRESH_MS = 60_000;
export const WALL_FALLBACK_MS = 30 * 60_000;
const held = new Map();
const FORGET = 'public-content-forgotten';
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const SPECS = {
  resources: { action: 'publicResourceExport', schema: 1, field: 'resources', map: mapResources },
  wall: { action: 'publicWallNotes', schema: WALL_EXPORT, field: 'notes', map: r => mapWall(r).wall },
};

export function forgetShared() { held.clear(); }
export async function forgetSharedEverywhere() {
  forgetShared();
  await noteSet(FORGET, { token: crypto.randomUUID() });
}
async function tokenNow() {
  try { return (await noteGet(FORGET))?.token || ''; }
  catch { return undefined; }
}
const empty = kind => kind === 'team'
  ? { schema: 'bss.team-fixture/1', source: 'connect', fixture: false, people: [] }
  : kind === 'wall' ? { schema: 'bss.wall-fixture/1', source: 'connect', fixture: false, notes: [] }
  : { schema: 'bss.resources-fixture/1', source: 'connect', fixture: false, resources: [] };
const built = (snap, kind) => kind === 'team' ? snap.team : kind === 'wall'
  ? { ...empty(kind), notes: snap.data?.wallNotes || [] }
  : { ...empty(kind), resources: snap.data?.resources || [], sourceUpdatedAt: snap.data?.resourcesUpdated || null };

async function oneCatalogue(snap, kind, now, token) {
  const cfg = serviceConfigNow();
  const source = cfg?.url || '';
  const key = `${source}:${kind}`;
  const cached = held.get(key);
  if (cached && cached.until > now && (token === undefined || cached.token === token)) return cached.promise.then(r => r.expiresAt != null && now >= r.expiresAt ? { ...r, value: empty(kind), unavailable: true } : r);
  const storeKey = `public-content-${hash(source).slice(0, 16)}-${kind}`;
  const spec = SPECS[kind];
  const promise = (async () => {
    try {
      if (!cfg) throw Object.assign(new Error('Connect is not configured'), { code: 'connect.missing' });
      const reply = await call(cfg, { action: spec.action });
      if (reply.schema !== spec.schema || !Array.isArray(reply[spec.field])) throw Object.assign(new Error('Unexpected public catalogue'), { code: 'connect.bad-reply' });
      /* The wall is settled through the same defaults floor the build applies: an empty approved
         list is a successful read of no notes, not a reason to serve a blank wall. */
      const mapped = spec.map(reply);
      const value = kind === 'wall' ? wallWithDefaults(mapped) : mapped;
      const record = { source, at: now, value };
      // Storage failure must not turn a successful public read into an unavailable service.
      await noteSet(storeKey, record).catch(() => {});
      return { value, stale: false, unavailable: false };
    } catch (e) {
      console.error(`public content: ${kind} could not be refreshed (${e.code || 'error'})`);
      let previous = null;
      try { previous = await noteGet(storeKey); } catch { /* the built public snapshot remains available */ }
      const at = Date.parse(snap.shared?.builtAt || '');
      const record = previous?.source === source && previous.value && Number.isFinite(previous.at)
        ? previous : { at, value: built(snap, kind) };
      // Personal recognition and moderated notes are not held indefinitely after withdrawal could have occurred.
      const expired = kind !== 'resources' && (!Number.isFinite(record.at) || now - record.at > WALL_FALLBACK_MS);
      /* The fallback value is settled through the same floor; the expiry above still stands, so a
         record outside its window reports unavailable with no notes rather than holding even the
         defaults indefinitely. */
      const fallback = record.value || empty(kind);
      return { value: expired ? empty(kind) : kind === 'wall' ? wallWithDefaults(fallback) : fallback, stale: true, unavailable: expired || !record.value, ...(kind !== "resources" ? { expiresAt: record.at + WALL_FALLBACK_MS } : {}) };
    }
  })();
  held.set(key, { until: now + SHARED_FRESH_MS, promise, token });
  return promise;
}

export function combineShared(...parts) {
  const value = Object.assign({}, ...parts.filter(Boolean).map(({ key, ...rest }) => rest));
  value.key = hash(Object.entries(value));
  return value;
}

export async function sharedNow(snap, { now = Date.now(), kinds = ['team', 'resources', 'wall'] } = {}) {
  if (snap?.prototype || snap?.shared?.source !== 'connect') return null;
  const wanted = kinds.filter(k => (k === 'alumni' || k === 'legal' || k === 'team' || SPECS[k]) && (k === 'alumni' || k === 'legal' || k === 'resources' || snap.shared.exports?.[k] === true));
  const token = wanted.some(k => SPECS[k]) ? await tokenNow() : undefined;
  const entries = await Promise.all(wanted.map(async kind => {
    if (kind === 'alumni') return [kind, await alumniNow(snap.alumniSource)];
    if (kind === 'legal') return [kind, { value: await legalNow({ now }), stale: false, unavailable: false }];
    if (kind !== 'team') return [kind, await oneCatalogue(snap, kind, now, token)];
    try { return [kind, { value: await teamNow(), stale: false, unavailable: false }]; }
    catch (e) {
      console.error(`public content: team could not be refreshed (${e.code || 'error'})`);
      return [kind, { value: empty('team'), stale: true, unavailable: true }];
    }
  }));
  return combineShared(Object.fromEntries(entries));
}

/* The reader is production-only; the image handler accepts only the fixed upload identity/version.
   Eligibility is settled by Connect on every read that fills or refreshes a kept copy, and the
   roster that links a photo is read live on every page draw. No roster is needed to answer an image. */
export async function teamPhotoResponse(req, id) {
  const snap = serverContent().render;
  if (snap?.prototype || !snap?.shared?.exports?.team) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store', 'netlify-cdn-cache-control': 'no-store' } });
  return teamPhoto(req, id);
}

/* ------------------------------------------------------------------ the refresh door */

/* The one door Connect opens on this site (owner's direction, 23 November 2026): when a team
   photo is added, changed or removed in Connect, Connect says so here and this site replaces or
   drops the copy it keeps, so the public page is current at once — no publish, and no waiting
   for a kept copy's freshness window.
 *
 *   POST /api/team-photo-refresh   { id, v?, gone? }   signed as every Connect call is signed.
 *
 * THE SIGNATURE IS THE SERVICE SIGNATURE, BYTE FOR BYTE (connect.mjs): the same secret the
 * public site signs its own calls with — Connect holds it as the public site's key
 * (PUBLIC_SITE_SERVICE_KEYS) and this site holds it as PUBLIC_SITE_SERVICE_SECRET — carried in
 * the same four headers, over the same base string with this door's own path. A timestamp more
 * than five minutes off (Connect's own SKEW_SECONDS), a wrong key id, or a wrong signature all
 * fail the same way, and the failure is never described. No nonce is spent on this side: the
 * call only ever re-reads from Connect or drops a copy, so a replay inside the window can do
 * nothing a fresh call could not.
 *
 * What Connect must do to use it is Connect's half of the arrangement and lives in Connect's
 * repository: after any change to a public profile's photo — an upload, a replacement, a
 * removal, or the profile ceasing to be public — call this door signed as above, with the
 * upload's id, its new version when there is one, and gone: true when the photo is gone. Until
 * that half lands, kept copies still track Connect through the roster's live versions and the
 * freshness window (team-photo-cache.mjs); this door is what makes a change instant. */
export const TEAM_PHOTO_REFRESH_PATH = "/api/team-photo-refresh";
const REFRESH_SKEW_SECONDS = 300;
const REFRESH_MAX_BODY = 64 * 1024;
const VERSION_RE = /^[0-9a-f]{32}$/;

const refreshReply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "netlify-cdn-cache-control": "no-store", "x-content-type-options": "nosniff" } });
const refreshRefused = () => refreshReply(403, { ok: false, error: "refresh.refused" });

function refreshSigned(req, raw, cfg, now = Date.now()) {
  const h = (k) => String(req.headers.get(k) || "");
  const keyId = h("x-public-key-id"), ts = h("x-public-timestamp"), nonce = h("x-public-nonce"), sig = h("x-public-signature");
  if (keyId !== cfg.keyId || !/^\d{9,11}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !sig) return false;
  if (Math.abs(now / 1000 - Number(ts)) > REFRESH_SKEW_SECONDS) return false;
  const expected = hmacB64u(cfg.secret, signatureBase(ts, nonce, "POST", TEAM_PHOTO_REFRESH_PATH, raw));
  const a = Buffer.from(expected), b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function teamPhotoRefreshResponse(req) {
  const snap = serverContent().render;
  if (snap?.prototype || !snap?.shared?.exports?.team) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store', 'netlify-cdn-cache-control': 'no-store' } });
  const cfg = serviceConfigNow();
  if (!cfg) return refreshReply(503, { ok: false, error: "refresh.unavailable" });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > REFRESH_MAX_BODY) return refreshReply(413, { ok: false, error: "refresh.too-large" });
  if (!refreshSigned(req, raw, cfg)) return refreshRefused();
  let body;
  try { body = JSON.parse(raw || "{}"); } catch { return refreshReply(400, { ok: false, error: "refresh.invalid" }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !PHOTO_ID.test(body.id || "")
      || (body.v !== undefined && !VERSION_RE.test(body.v)) || (body.gone !== undefined && typeof body.gone !== "boolean")) {
    return refreshReply(400, { ok: false, error: "refresh.invalid" });
  }
  if (body.gone) await dropTeamPhoto(body.id);
  else {
    const outcome = await refreshTeamPhoto(body.id, body.v ?? null);
    if (outcome === "bad") return refreshReply(502, { ok: false, error: "refresh.failed" });
    if (outcome === "unavailable") return refreshReply(503, { ok: false, error: "refresh.unavailable" });
  }
  /* The CDN holds photo answers under this tag; clear it so a replaced or dropped copy is not
     what the next visitor is served. A failure here is logged, never hidden behind success:
     the reply says the copy this site keeps is current, and names the purge separately. */
  let purgeError = null;
  await purgeTags(["team-photo"]).catch((e) => { purgeError = e.code || "purge.unavailable"; console.error("team photo refresh: the CDN tag could not be cleared:", e.message); });
  return refreshReply(200, { ok: true, ...(purgeError ? { purgeError } : {}) });
}
