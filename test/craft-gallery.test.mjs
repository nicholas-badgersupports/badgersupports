/* The Craft Nights gallery's two Site Settings (owner direction, 12 Nov 2026): how many of the
   "Made at Past Craft Nights" photos show, and whether they stand in one row of smaller pictures
   or in the grid. A bad count and a layout that is neither word are refused at save; the gallery
   renders exactly the setting's count, in the setting's layout, and defaults to six in one row. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderBlock } from '../src/render/registry.mjs';
import { makeContext } from '../src/render/context.mjs';
import { emptyStructure, applyChange, laySettings, craftGallery, SETTINGS_KEYS } from '../src/shared/structure.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url)));
const page = () => read('content/pages/craft-nights.json');
const text = Object.fromEntries(Object.entries(read('content/text.json').text).map(([k, v]) => [k, v.text]));
const block = () => page().blocks.find((b) => b.id === 'b-cn-past-work');
const ctx = (site) => makeContext({ site, media: read('media/manifest.json'), text, today: '2026-11-03', now: Date.parse('2026-11-03T12:00:00-06:00'), builtPaths: ['/join/email-list/', '/forms/programming-feedback/'], data: { events: { recurring: [], dated: [], places: {} }, eventsState: {} } });
const render = (site) => String(renderBlock(block(), ctx(site)));
const cards = (out) => (out.match(/<li class="card has-photo"/g) || []).length;
const actx = { pages: [page()], site: read('content/site.json'), authored: new Set(['pg-craft-nights']), links: [] };
const save = (settings) => applyChange(emptyStructure(), { action: 'settings', settings }, actx);

test('craft settings: the two new keys are settings keys, and a good pair saves as a number and a word', () => {
  assert.ok(SETTINGS_KEYS.includes('craftPhotoCount') && SETTINGS_KEYS.includes('craftLayout'));
  const { doc } = save({ craftPhotoCount: '4', craftLayout: 'grid' });
  assert.deepEqual(doc.settings, { craftPhotoCount: 4, craftLayout: 'grid' });
  const again = applyChange(doc, { action: 'settings', settings: { craftPhotoCount: 12 } }, actx);
  assert.equal(again.doc.settings.craftPhotoCount, 12, 'a number saves as itself');
  assert.equal(again.doc.settings.craftLayout, 'grid', 'a change naming one key keeps the other');
});

test('craft settings: a bad count is refused, and so is a layout that is neither row nor grid', () => {
  for (const bad of [0, 13, -1, 2.5, 'six', '4.5', '', null, true, {}]) {
    assert.throws(() => save({ craftPhotoCount: bad }), (e) => e.code === 'settings.craftPhotoCount', JSON.stringify(bad));
  }
  for (const bad of ['rows', 'one-row', '', 'ROW ', 3, null, true]) {
    if (bad === 'ROW ') continue; // case and stray spaces are tidied, as the other settings tidy theirs
    assert.throws(() => save({ craftLayout: bad }), (e) => e.code === 'settings.craftLayout', JSON.stringify(bad));
  }
  assert.equal(save({ craftLayout: ' Grid ' }).doc.settings.craftLayout, 'grid');
});

test('craft settings: laid over a site they are what the gallery reads; unset or stale values fall back to six in a row', () => {
  const site = read('content/site.json');
  assert.deepEqual(craftGallery(site), { count: 6, layout: 'row' }, 'nothing saved: the defaults');
  laySettings(site, { craftPhotoCount: 3, craftLayout: 'grid' });
  assert.deepEqual(craftGallery(site), { count: 3, layout: 'grid' });
  assert.deepEqual(craftGallery({ craftPhotoCount: 99, craftLayout: 'spiral' }), { count: 6, layout: 'row' }, 'values that no longer pass fall back, never break the page');
});

test('craft gallery: by default it is one row, and it shows the setting\u2019s number of photos', () => {
  const out = render(read('content/site.json'));
  assert.match(out, /cards--craft cards--craft-row/, 'the row is the default layout');
  assert.equal(cards(out), 6, 'all six photos at the default count');
  const fewer = render({ ...read('content/site.json'), craftPhotoCount: 2, craftLayout: 'row' });
  assert.equal(cards(fewer), 2, 'a saved count of two shows two');
  assert.match(fewer, /Nostalgic Crafts/);
  assert.doesNotMatch(fewer, /Pumpkin Painting/, 'the cards past the count are the ones left out, in order');
});

test('craft gallery: the grid setting draws the previous arrangement, untouched', () => {
  const out = render({ ...read('content/site.json'), craftPhotoCount: 4, craftLayout: 'grid' });
  assert.match(out, /cards--craft cards--craft-grid/);
  assert.doesNotMatch(out, /cards--craft-row/);
  assert.equal(cards(out), 4, 'the count applies in the grid too');
});
