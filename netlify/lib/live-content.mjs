/* Approved public catalogues between publishes. Resources and Wall notes use bounded last-good
   records in the existing publication store; current profile eligibility is read without a roster cache; one failed catalogue never replaces another with an empty
   success. Only mapped public data is persisted. Prototype pages never contact Connect. */
import crypto from 'node:crypto';
import { call, serviceConfigNow } from './connect.mjs';
import { noteGet, noteSet } from './published.mjs';
import { mapResources, mapWall, WALL_EXPORT } from '../../ops/connect-feed.mjs';
import { serverContent } from './content.mjs';
import { teamNow, teamPhoto } from "./live-team.mjs";
import { alumniNow } from "./alumni-history.mjs";

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
      const value = spec.map(reply);
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
      return { value: expired ? empty(kind) : record.value || empty(kind), stale: true, unavailable: expired || !record.value, ...(kind !== "resources" ? { expiresAt: record.at + WALL_FALLBACK_MS } : {}) };
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
  const wanted = kinds.filter(k => (k === 'alumni' || k === 'team' || SPECS[k]) && (k === 'alumni' || k === 'resources' || snap.shared.exports?.[k] === true));
  const token = wanted.some(k => SPECS[k]) ? await tokenNow() : undefined;
  const entries = await Promise.all(wanted.map(async kind => {
    if (kind === 'alumni') return [kind, await alumniNow(snap.alumniSource)];
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
   Connect checks present eligibility on every photo fetch. No roster is needed to answer an image. */
export async function teamPhotoResponse(req, id) {
  const snap = serverContent().render;
  if (snap?.prototype || !snap?.shared?.exports?.team) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store', 'netlify-cdn-cache-control': 'no-store' } });
  return teamPhoto(req, id);
}
