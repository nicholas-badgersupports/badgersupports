import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build, ROOT } from '../ops/build.mjs';
import { mapTeam, readFeedRules } from '../ops/connect-feed.mjs';
import { teamProblems } from '../src/render/team.mjs';
import { useContent } from '../netlify/lib/content.mjs';
import { useConnect } from '../netlify/lib/connect.mjs';
import { useStore, memoryStore } from '../netlify/lib/published.mjs';
import { handlePage, useDist } from '../netlify/lib/pages.mjs';
import { sharedNow, forgetShared, forgetSharedEverywhere, teamPhotoResponse, SHARED_FRESH_MS, WALL_FALLBACK_MS } from '../netlify/lib/live-content.mjs';
import { publicUpload } from '../netlify/lib/live-team.mjs';

const OUT = path.join(ROOT, 'local/test-build-shared');
const ID = 'p' + '1'.repeat(24), VERSION = 'a'.repeat(32);
const PHOTO = `https://home.badgersupports.org/p/${ID}`;
const PERSON = { id: ID, slug: 'avery-example', published: true, name: 'Avery Example', title: 'Program Coordinator', role: 'Coordinator', group: 'staff', bio: ['A public profile paragraph.'], classYear: 'Spring 2028', photo: { url: PHOTO, alt: 'Avery Example' } };
const PRIVATE = 'never-publish-this-account-data';
const RULES = { ...readFeedRules(ROOT), exports: { team: true, wall: true } };
const baseResources = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/fixtures/resources.json')));
const PRODUCER = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/team-producer.json')));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9l8AAAAASUVORK5CYII=', 'base64');
let reply, offline, photoBytes, calls, clock, realNow, photoType, photoLength, writes;
const cfg = { url: 'https://home.badgersupports.org', keyId: 'fixture', secret: 'x'.repeat(40), fetch: async (url, init) => {
  calls.push({ url, method: init.method, headers: init.headers, redirect: init.redirect });
  if (offline) throw new Error('offline');
  if (init.method === 'GET') {
    const p = reply.publicTeam.people.find(p => p.id === new URL(url).pathname.slice(3) && p.published === true && p.photo);
    if (!p) return new Response(null, { status: 404 });
    return new Response(photoBytes, { headers: { 'content-type': photoType, ...(photoLength ? { 'content-length': String(photoLength) } : {}) } });
  }
  return { json: async () => structuredClone(reply[JSON.parse(init.body).action] || { ok: false }) };
} };
function resetReply() {
  calls = []; offline = false; photoType = 'image/png'; photoLength = null; photoBytes = Buffer.from(PNG);
  reply = { publicEvents: { ok: true, schema: 1, events: [], weekly: [] }, publicResourceExport: { ok: true, schema: 1, resources: baseResources.resources }, publicTeam: { ok: true, schema: 'bss.team/1', people: [structuredClone(PERSON)] }, publicWallNotes: { ok: true, schema: 'bss.wall/1', notes: [{ id: 'w1', text: 'A moderated public note.' }] } };
}
let SERVER;
test.before(async () => {
  resetReply();
  await build({ production: true, connectConfig: cfg, feedRules: RULES, out: OUT, serverDir: path.join(OUT, '_server'), media: false, today: '2026-11-03' });
  SERVER = JSON.parse(fs.readFileSync(path.join(OUT, '_server/server.json')));
});
test.beforeEach(() => {
  realNow = Date.now; clock = realNow(); Date.now = () => clock; resetReply(); writes = [];
  const store = memoryStore();
  useContent(SERVER); useDist(OUT); useStore({ ...store, set: async (key, value) => { writes.push({ key, value: structuredClone(value) }); await store.set(key, value); } }); useConnect(cfg); forgetShared();
});
test.afterEach(() => { Date.now = realNow; useConnect(null); forgetShared(); });
const get = p => handlePage(new Request('https://site.test' + p), { today: '2026-11-03' });
const quietly = async f => { const old = console.error; console.error = () => {}; try { return await f(); } finally { console.error = old; } };

test('the actual team contract omits invented fields and tolerates missing display details', () => {
  const row = { ...PERSON, email: PRIVATE, ssid: PRIVATE, credentials: PRIVATE, order: 77, aliases: [PRIVATE] };
  for (const field of ['name', 'title', 'role', 'pronouns', 'classYear', 'bio', 'contact', 'photo']) {
    const incomplete = { ...row }; delete incomplete[field];
    const mapped = mapTeam({ people: [incomplete] }).team;
    assert.equal(mapped.people.length, 1, field); assert.deepEqual(teamProblems(mapped, { production: true }), [], field);
    assert.ok(!JSON.stringify(mapped).includes(PRIVATE));
  }
  const mapped = mapTeam({ people: [{ ...row, slug: 'not a valid path' }, row, { ...row, id: 'p' + '2'.repeat(24) }] });
  assert.equal(mapped.team.people.length, 1); assert.ok(mapped.dropped.some(x => /invalid or duplicate identity/.test(x)));
  for (const published of [false, 'true', 1, undefined]) assert.equal(mapTeam({ people: [{ ...PERSON, published }] }).team.people.length, 0);
});
test('production has no baked profiles while runtime photos stay same-origin', async () => {
  const built = fs.readFileSync(path.join(OUT, 'about/our-team/index.html'), 'utf8');
  assert.doesNotMatch(built, /Avery Example|avery-example|api\/team-photo/);
  assert.deepEqual(SERVER.render.team.people, []); assert.deepEqual(SERVER.render.data.team.people, []);
  const page = await (await get('/about/our-team/')).text(); assert.match(page, new RegExp(`/api/team-photo/${ID}`));
  assert.doesNotMatch(page, /src="https:\/\/home\.badgersupports\.org\/p\//);
});
test('add edit and remove profiles immediately at origin without publishing or aging a cache', async () => {
  await get('/about/our-team/');
  reply.publicTeam.people = [{ ...PERSON, name: 'Avery Updated', title: '', role: '', bio: [] }, { ...PERSON, id: 'p' + '2'.repeat(24), slug: 'new-person', name: 'New Person', photo: undefined }];
  const list = await (await get('/about/our-team/')).text(); assert.match(list, /Avery Updated/); assert.match(list, /New Person/);
  assert.equal((await get('/about/our-team/new-person/')).status, 200);
  const changed = await (await get('/about/our-team/avery-example/')).text(); assert.match(changed, /Avery Updated/); assert.doesNotMatch(changed, /Avery Updated is  at/);
  reply.publicTeam.people = [];
  assert.equal((await get('/about/our-team/avery-example/')).status, 404); assert.equal((await get('/about/our-team/new-person/')).status, 404);
  assert.doesNotMatch(await (await get('/about/our-team/')).text(), /Avery Updated|New Person/);
});
test('the successful shared-page cache stays inside thirty minutes', async () => {
  const cache = (await get('/about/our-team/')).headers.get('netlify-cdn-cache-control');
  assert.ok(Number(cache.match(/s-maxage=(\d+)/)[1]) + Number(cache.match(/stale-while-revalidate=(\d+)/)[1]) <= 1800);
});
test('resources and Wall notes retain bounded last-good reads but team eligibility is never persisted', async () => {
  await sharedNow(SERVER.render); assert.ok(writes.length); assert.ok(!JSON.stringify(writes).includes(PERSON.name));
  offline = true; clock += SHARED_FRESH_MS + 1; forgetShared();
  const old = await quietly(() => sharedNow(SERVER.render));
  assert.equal(old.team.unavailable, true); assert.equal(old.team.value.people.length, 0);
  assert.equal(old.resources.value.resources.length, baseResources.resources.length); assert.equal(old.wall.value.notes.length, 1);
  clock += WALL_FALLBACK_MS + 1; forgetShared();
  const expired = await quietly(() => sharedNow(SERVER.render)); assert.equal(expired.wall.unavailable, true); assert.equal(expired.wall.value.notes.length, 0); assert.ok(expired.resources.value.resources.length);
});
test('resources and moderated notes update between publishes without private team fields', async () => {
  await get('/resources/'); reply.publicResourceExport.resources = [{ ...baseResources.resources[0], name: 'A Later Approved Resource' }];
  reply.publicWallNotes.notes = [{ id: 'w2', text: 'A newer moderated note.' }]; reply.publicTeam.people = [{ ...PERSON, email: PRIVATE, phone: PRIVATE, permissions: [PRIVATE] }]; clock += SHARED_FRESH_MS + 1;
  assert.match(await (await get('/resources/')).text(), /A Later Approved Resource/);
  const home = await (await get('/')).text(); assert.match(home, /A newer moderated note/); assert.doesNotMatch(home, /A moderated public note/);
  assert.ok(!(await (await get('/about/our-team/')).text()).includes(PRIVATE));
});
test('Refresh Now reaches another warm catalogue reader without weakening fresh team reads', async () => {
  const other = await import('../netlify/lib/live-content.mjs?second-function');
  const before = await other.sharedNow(SERVER.render); assert.equal(before.resources.value.resources.length, baseResources.resources.length);
  reply.publicResourceExport.resources = []; reply.publicTeam.people = [{ ...PERSON, name: 'Avery Refreshed' }];
  assert.equal((await other.sharedNow(SERVER.render)).team.value.people[0].name, 'Avery Refreshed');
  assert.ok((await other.sharedNow(SERVER.render)).resources.value.resources.length);
  await forgetSharedEverywhere(); const after = await other.sharedNow(SERVER.render); assert.equal(after.resources.value.resources.length, 0);
});
test('photo proxy preserves version syntax and current producer eligibility without exporting the team per image', async () => {
  const url = `https://site.test/api/team-photo/${ID}?v=${VERSION}`, before = calls.length;
  let res = await teamPhotoResponse(new Request(url), ID); assert.equal(res.status, 200); assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
  assert.equal(calls.length, before + 1); const sent = calls.at(-1); assert.equal(sent.method, 'GET'); assert.equal(sent.redirect, 'manual');
  assert.equal(new URL(sent.url).searchParams.get('v'), VERSION); assert.ok(!Object.keys(sent.headers).some(k => /cookie|x-public/i.test(k)));
  photoBytes = Buffer.concat([PNG, Buffer.from([1])]);
  res = await teamPhotoResponse(new Request(url), ID); assert.deepEqual(Buffer.from(await res.arrayBuffer()), photoBytes, 'producer returns its current eligible upload, not semantic old-hash rejection');
  const head = await teamPhotoResponse(new Request(url, { method: 'HEAD' }), ID); assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  reply.publicTeam.people = []; res = await teamPhotoResponse(new Request(url), ID); assert.equal(res.status, 404); assert.equal(res.headers.get('netlify-cdn-cache-control'), 'no-store');
});
test('a sized photo request stays bounded and falls back to the original bytes when no resized copy can be had', async () => {
  const plain = await teamPhotoResponse(new Request(`https://site.test/api/team-photo/${ID}?v=${VERSION}`), ID);
  assert.equal(plain.headers.get('netlify-vary'), 'query=v|w');
  const res = await teamPhotoResponse(new Request(`https://site.test/api/team-photo/${ID}?v=${VERSION}&w=512`, { headers: { accept: 'image/avif,image/webp,image/*' } }), ID);
  assert.equal(res.status, 200);
  /* This rig has no image CDN to resize with, so the original bytes are served under the original tag. */
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), Buffer.from(await plain.arrayBuffer()));
  assert.equal(res.headers.get('etag'), plain.headers.get('etag'));
});
test('non-string identities are isolated before rendering or generating paths', () => {
  for (const value of [123, true, {}, []]) for (const field of ['id', 'slug']) {
    const mapped = mapTeam({ people: [{ ...PERSON, [field]: value }, PERSON] }); assert.equal(mapped.team.people.length, 1); assert.equal(mapped.team.people[0].slug, PERSON.slug);
  }
});
test('an unavailable editorial store never resurrects opted-out built profiles', async () => {
  reply.publicTeam.people = []; useStore({ kind: 'broken', get: async () => { throw new Error('store unavailable'); }, set: async () => { throw new Error('store unavailable'); } });
  const list = await quietly(() => get('/about/our-team/')); assert.equal(list.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(await list.text(), /Avery Example/);
  const profile = await quietly(() => get('/about/our-team/avery-example/')); assert.equal(profile.status, 503); assert.doesNotMatch(await profile.text(), /Avery Example/);
});
test('failed current eligibility cannot renew personal HTML or use old recognition', async () => {
  await get('/about/our-team/'); offline = true;
  const stale = await quietly(() => get('/about/our-team/')); assert.equal(stale.status, 503); assert.equal(stale.headers.get('netlify-cdn-cache-control'), 'no-store'); assert.doesNotMatch(await stale.text(), /Avery Example/);
});
test('a successful empty resource export renders an explicit state without breaking production', async () => {
  reply.publicResourceExport.resources = []; const out = path.join(ROOT, 'local/test-build-empty-catalogue');
  await build({ production: true, connectConfig: cfg, feedRules: RULES, out, serverDir: path.join(out, '_server'), media: false, today: '2026-11-03' });
  assert.match(fs.readFileSync(path.join(out, 'resources/index.html'), 'utf8'), /No resources are listed right now/);
  assert.match(await (await get('/resources/')).text(), /No resources are listed right now/);
});
test('photo proxy refuses unsafe origins paths types magic bytes and oversized responses', async () => {
  for (const url of [`https://badgerspill.org/p/${ID}`, PHOTO + '/another', PHOTO + '?v=bad']) assert.equal(publicUpload(url, cfg.url), null);
  const req = new Request(`https://site.test/api/team-photo/${ID}`);
  for (const [type, bytes, length] of [['text/html', PNG, null], ['image/png', Buffer.from('not an image'), null], ['image/png', PNG, 5 * 1024 * 1024], ['image/png', Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024 + 1 - PNG.length)]), null]]) {
    photoType = type; photoBytes = bytes; photoLength = length;
    const response = await teamPhotoResponse(req, ID); assert.equal(response.status, 502); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
test('the frozen fictional producer fixture renders incomplete profiles and versioned photos', async () => {
  reply.publicTeam = structuredClone(PRODUCER); assert.equal(mapTeam(PRODUCER).team.people.length, PRODUCER.people.length);
  const list = await (await get('/about/our-team/')).text();
  for (const p of PRODUCER.people) { assert.ok(list.includes(p.name || 'Team Member')); assert.equal((await get(`/about/our-team/${p.slug}/`)).status, 200); }
  const p = PRODUCER.people.find(p => p.photo), version = new URL(p.photo.url).searchParams.get('v');
  assert.ok(list.includes(`/api/team-photo/${p.id}?v=${version}`));
  const res = await teamPhotoResponse(new Request(`https://site.test/api/team-photo/${p.id}?v=${version}`), p.id); assert.equal(res.status, 200);
});
test('untrusted or repeated photo parameters and mismatched profile photos cannot reach a fetch', async () => {
  const before = calls.length;
  for (const suffix of ['?v=invalid', '?v=' + VERSION + '&url=https://example.org', '?v=' + VERSION + '&v=' + VERSION, '?url=https://example.org', '?v=' + VERSION + '&w=999', '?v=' + VERSION + '&w=512&w=256', '?w=512&w=512']) assert.equal((await teamPhotoResponse(new Request(`https://site.test/api/team-photo/${ID}${suffix}`), ID)).status, 400);
  assert.equal(calls.length, before);
  reply.publicTeam.people = [{ ...PERSON, photo: { url: PHOTO.replace(ID, 'p' + '2'.repeat(24)) } }];
  const page = await (await get('/about/our-team/')).text(); assert.doesNotMatch(page, /api\/team-photo/);
});
