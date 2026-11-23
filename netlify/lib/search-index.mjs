/* The search index the pages function serves (workflow audit PF-1 and PF-3). Two faults met at
 * this address: the pages function caught /search-index.json and, having no page for it,
 * answered its 404 page — so site Search never worked live — and the only index in existence
 * was the one the build wrote, so a page published between deploys could not be found until
 * the next deploy rebuilt it.
 *
 * The settlement: this function serves the address deliberately (it is not in the pages
 * function's excludedPath, and the guard test — test/deferred-data.test.mjs — holds it to a
 * named function-served list instead). What it serves is the index rebuilt at the last publish
 * (refreshSearchIndex, called by the router wherever a revision is published), kept in the
 * published store; before the first such publish, the build's own index from the snapshot
 * stands in. One builder (src/render/search-index.mjs) makes both, so they cannot drift. */

import { serverContent } from "./content.mjs";
import { searchIndexGet, searchIndexSet, purgeTags } from "./published.mjs";
import { siteNow } from "./pages.mjs";
import { searchIndex } from "../../src/render/search-index.mjs";
import { chicagoDate } from "../../src/render/context.mjs";

export const SEARCH_INDEX_SCHEMA = "bss.search-index/1";

/* The index to serve now: the publish-time rebuild when one is stored, else the build's. */
export async function searchIndexAnswer() {
  try {
    const stored = await searchIndexGet();
    if (stored?.schema === SEARCH_INDEX_SCHEMA && Array.isArray(stored.pages)) return stored;
  } catch { /* a store that cannot be read leaves the build's index standing */ }
  const snap = serverContent().render;
  if (Array.isArray(snap?.data?.searchIndex)) return { schema: SEARCH_INDEX_SCHEMA, pages: snap.data.searchIndex };
  return null;
}

/* Rebuild the index from the site as it stands after a publish, and keep it beside the
   revision. Best-effort by design: a publish never fails because its index could not be
   rebuilt — the last good index (or the build's) keeps serving, and the failure is logged. */
export async function refreshSearchIndex() {
  try {
    const site = await siteNow();
    if (!site) return false;
    const pages = searchIndex(
      { pages: site.pages, places: site.places, team: site.data?.team, resources: { resources: site.data?.resources || [] }, site: site.site },
      { today: chicagoDate() },
    );
    await searchIndexSet({ schema: SEARCH_INDEX_SCHEMA, pages });
    await purgeTags(["search-index"]).catch(() => {});
    return true;
  } catch (e) {
    console.error(`search index: the publish-time rebuild failed (${e.code || e.message}); the last good index stands`);
    return false;
  }
}
