/* The search index as the live site serves it (workflow audit PF-1 and PF-3). PF-1: the pages
   function claimed /search-index.json, had no page for it, and answered its 404 page — site
   Search, which reads only that address, never worked live. PF-3: the only index was the
   build's, so a page published between deploys stayed unfindable until the next deploy. The
   function now serves the address itself: the build's index until a publish rebuilds it, then
   the rebuilt one, kept in the published store. Built once from the fixtures, as
   published.test.mjs builds its snapshot. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { useContent } from "../netlify/lib/content.mjs";
import { handlePage, useDist } from "../netlify/lib/pages.mjs";
import { useStore, memoryStore, searchIndexGet, searchIndexSet } from "../netlify/lib/published.mjs";
import { refreshSearchIndex } from "../netlify/lib/search-index.mjs";
import { freshPglite, useAdapter } from "../netlify/lib/db.mjs";
import { forgetEvents } from "../netlify/lib/live-events.mjs";

const OUT = path.join(ROOT, "local", "test-build-search-live");
const TODAY = "2026-10-20";
await build({ out: OUT, serverDir: path.join(OUT, "_server"), media: false, today: TODAY, edits: {} });
const SERVER = JSON.parse(fs.readFileSync(path.join(OUT, "_server", "server.json"), "utf8"));
const HERO = "page:pg-home:b-home-hero/title";

async function given(revision = null) {
  useAdapter(await freshPglite());
  useContent(SERVER);
  useDist(OUT);
  const store = memoryStore();
  if (revision) await store.set("current", { schema: "bss.revision/1", at: "2026-10-20T15:00:00.000Z", by: "Robin", stamp: revision.n, ...revision });
  useStore(store);
  forgetEvents();
  return store;
}
const get = () => handlePage(new Request("http://site.test/search-index.json"), { today: TODAY, now: Date.parse(`${TODAY}T12:00:00Z`) });

test("the address answers the index as JSON, not the 404 page (PF-1)", async () => {
  await given();
  const res = await get();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  const body = JSON.parse(await res.text());
  assert.equal(body.schema, "bss.search-index/1");
  assert.deepEqual(body.pages, SERVER.render.data.searchIndex, "with nothing rebuilt yet, the build's own index stands in");
  assert.ok(body.pages.some((p) => p.path === "/resources/"), "the Resources page is findable");
});

test("a stored rebuild is served in place of the build's", async () => {
  await given();
  await searchIndexSet({ schema: "bss.search-index/1", pages: [{ path: "/brand-new/", title: "Brand New", text: "just published" }] });
  const body = JSON.parse(await (await get()).text());
  assert.deepEqual(body.pages.map((p) => p.path), ["/brand-new/"]);
});

test("a publish rebuilds the index from the site as published, so a saved word becomes findable (PF-3)", async () => {
  await given({ n: 3, edits: { [HERO]: "badger supports, together" } });
  assert.equal(await searchIndexGet(), null, "nothing rebuilt before the publish");
  assert.equal(await refreshSearchIndex(), true);
  const stored = await searchIndexGet();
  const home = stored.pages.find((p) => p.path === "/");
  assert.ok(home.text.includes("badger supports, together"), "the saved hero words are in the home page's entry");
  const body = JSON.parse(await (await get()).text());
  assert.ok(body.pages.find((p) => p.path === "/").text.includes("badger supports, together"), "and the served index is the rebuilt one");
});
