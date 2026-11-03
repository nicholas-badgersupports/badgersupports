/* Approved public catalogues between publishes. Each source has its own bounded read and last-good
   record in the existing publication store; one failed catalogue never replaces another with an empty
   success. Only mapped public data is persisted. Prototype pages never contact Connect. */
import crypto from 'node:crypto';
import { call, serviceConfigNow } from './connect.mjs';
import { noteGet, noteSet } from './published.mjs';
import { mapTeam, mapResources, mapWall, TEAM_EXPORT, WALL_EXPORT } from '../../ops/connect-feed.mjs';
import { serverContent } from './content.mjs';
import { initials } from '../../src/render/team.mjs';
import { html } from '../../src/render/html.mjs';

export const SHARED_FRESH_MS = 60_000;
export const PROFILE_FALLBACK_MS = 30 * 60_000;
const held = new Map();
const FORGET = 'public-content-forgotten';
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const SPECS = {
  team: { action: 'publicTeam', schema: TEAM_EXPORT, field: 'people', map: r => mapTeam(r).team },
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
      const expired = kind !== 'resources' && (!Number.isFinite(record.at) || now - record.at > PROFILE_FALLBACK_MS);
      return { value: expired ? empty(kind) : record.value || empty(kind), stale: true, unavailable: expired || !record.value, ...(kind !== "resources" ? { expiresAt: record.at + PROFILE_FALLBACK_MS } : {}) };
    }
  })();
  held.set(key, { until: now + SHARED_FRESH_MS, promise, token });
  return promise;
}

export async function sharedNow(snap, { now = Date.now(), kinds = ['team', 'resources', 'wall'] } = {}) {
  if (snap?.shared?.source !== 'connect') return null;
  const token = await tokenNow();
  const wanted = kinds.filter(k => SPECS[k] && (k === 'resources' || snap.shared.exports?.[k] === true));
  const entries = await Promise.all(wanted.map(async kind => [kind, await oneCatalogue(snap, kind, now, token)]));
  const result = Object.fromEntries(entries);
  result.key = hash(entries);
  return result;
}

/* A bounded same-origin proxy avoids permanent public copies of profile photos. It accepts an opaque
   identity, never a caller-supplied URL, and checks current public eligibility before fetching a raster
   from that identity's exact Connect photo path. Redirects, credentials and non-raster content are refused. */
export async function teamPhotoResponse(req, id, { now = Date.now() } = {}) {
  const snap = serverContent().render;
  if (!snap || new URL(req.url).search || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  const shared = await sharedNow(snap, { now, kinds: ['team'] });
  const p = shared?.team?.value?.people?.find(p => p.id === id && p.published === true);
  if (!p || shared.team.unavailable) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  const headers = { 'cache-control': 'public, max-age=0, must-revalidate', 'netlify-cdn-cache-control': 'public, s-maxage=60', 'netlify-vary': 'query', 'netlify-cache-tag': 'page,team-photo', 'x-content-type-options': 'nosniff' };
  if (shared.team.stale) { headers['cache-control'] = 'no-store'; headers['netlify-cdn-cache-control'] = 'no-store'; }
  const fallback = () => new Response(req.method === 'HEAD' ? null : String(html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><text x="200" y="230" text-anchor="middle" font-family="sans-serif" font-size="100">${initials(p.name) || '?'}</text></svg>`), { headers: { ...headers, 'content-type': 'image/svg+xml' } });
  try {
    if (shared.team.stale) return fallback();
    const cfg = serviceConfigNow();
    const url = new URL(p.photo?.link);
    if (!cfg || url.origin !== new URL(cfg.url).origin || url.pathname !== `/p/${id}` || url.username || url.password || url.hash) return fallback();
    // Connect may version an uploaded photo by its content hash; no other source query is accepted.
    if (url.search && !/^\?v=[a-f0-9]{32}$/.test(url.search)) return fallback();
    // Connect's path is stable while its photo changes; a bounded bucket prevents its hour-long cache hiding an edit.
    url.searchParams.set('_bss', String(Math.floor(now / SHARED_FRESH_MS)));
    const response = await (cfg.fetch || fetch)(url.href, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !/^image\/(?:png|jpeg|webp|avif|gif)$/.test(type || '') || Number(response.headers.get('content-length') || 0) > 5 * 1024 * 1024) return fallback();
    const reader = response.body?.getReader();
    if (!reader) return fallback();
    const chunks = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 5 * 1024 * 1024) { await reader.cancel(); return fallback(); } chunks.push(Buffer.from(value)); }
    return new Response(req.method === 'HEAD' ? null : Buffer.concat(chunks), { headers: { ...headers, 'content-type': type } });
  } catch { return fallback(); }
}
