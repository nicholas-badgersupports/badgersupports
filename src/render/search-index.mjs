/* The site-wide search index (queue item 39, slice 39-A): every public, indexable page with the
   words on it, written to dist/search-index.json and read in the visitor's browser by
   src/client/search.js, so nothing typed leaves the visitor's machine. A page stays out when it
   is noindex (the staff page, the 404 page), when it is the search page itself, and when it is a
   form preview; form answers are never page content, so they are never here. A room's page
   carries its room record's words and a person's page their public profile's, because those
   pages are made from the records, not from blocks of their own. Only the blocks a visitor
   would see today are read, so a hidden or out-of-season section is not found before its page
   shows it. Rebuilt at every build, so a new page is findable from the next publish.
   The resource catalogue rides in the same index (QOL proposal 1, 15 November 2026): one entry
   per resource the Resources page shows, titled with the resource's name and worded with what
   it is, who it suits, the words it is also known by (its aka) and its categories. Its address
   is the Resources page with the resource's name as the search there (?q=, the address scheme
   the list itself keeps), so the result lands on the resource on that page. The Resources
   page's own entry above stays: it is the page; these are what is on it.

   The builder lives here, apart from the build, because the published site rebuilds the same
   index at every publish from the site as composed then (netlify/lib/search-index.mjs;
   workflow audit PF-3) — one builder, so the two can never drift. It reads a content-shaped
   object: { pages, places, team, resources: { resources }, site }. */

import { liveBlocks } from "./registry.mjs";
import { pageStrings } from "../shared/edits.mjs";
import { bareTitle } from "../shared/structure.mjs";
import { publicPeople } from "./team.mjs";
import { resourceVisible } from "./blocks/resources.mjs";

export function searchIndex(content, { today } = {}) {
  const words = (page) => pageStrings({ ...page, blocks: liveBlocks(page, today) }).map((s) => s.value);
  const out = [];
  for (const page of content.pages) {
    if (page.noindex || page.file || page.id === "pg-search" || page.generated === "form-preview") continue;
    const parts = [page.description || "", ...words(page)];
    for (const b of liveBlocks(page, today)) {
      if (b.type === "directions") {
        const p = content.places?.[b.place];
        if (p) parts.push(p.name || "", p.building || "", p.where || "", p.address || "", p.note || "", ...(p.steps || []).map((s) => s.text || ""));
      }
      if (b.type === "person") {
        const p = publicPeople(content.team).find((x) => x.slug === b.person);
        if (p) parts.push(p.name || "", p.title || "", p.role || "", ...(p.bio || []));
      }
    }
    const text = parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 6000);
    out.push({ path: page.path, title: bareTitle(page.title, [content.site.name], { first: page.id === "pg-home" }), text });
  }
  const resPage = content.pages.find((p) => (p.blocks || []).some((b) => b.type === "resources"));
  const records = content.resources?.resources;
  if (resPage && Array.isArray(records)) {
    for (const r of records) {
      if (!r?.id || !r?.name || !resourceVisible(r)) continue;
      const cats = (r.categories || []).map((c) => String(c).replace(/_/g, " ")).join(" ");
      const text = [r.summary || "", r.bestFor || "", r.aka || "", cats].join(" ").replace(/\s+/g, " ").trim().slice(0, 6000);
      out.push({ path: `${resPage.path}?q=${encodeURIComponent(r.name).replace(/'/g, "%27")}`, title: r.name, text });
    }
  }
  return out.sort((a, z) => a.title.localeCompare(z.title, "en") || a.path.localeCompare(z.path, "en"));
}
