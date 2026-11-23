/* The Resources page's whole list, as it stands now (workflow audit PF-4). The page itself is
 * drawn from the current catalogue (live-content.mjs), but the full list its script fetches on
 * first use used to be only the file the build wrote beside the page — frozen at the last
 * deploy, so the first screen and the full list disagreed whenever Connect's catalogue changed
 * between publishes. This answers /api/resources with the same list drawn the same way, from
 * the catalogue as it stands: the resources block rendered at request time, its held-back data
 * (ctx.defer) read back instead of written to a file. The build's file remains the client's
 * fallback, exactly as the campus-events answer treats its build's list (campus-events.mjs).
 * Returns the data file's own shape, { schema, cards }, or null when this build has no
 * Resources page to draw from. */

import { serverContent } from "./content.mjs";
import { currentRevision } from "./published.mjs";
import { sharedNow } from "./live-content.mjs";
import { composeSite, sectionPrograms } from "../../src/render/site.mjs";
import { makeContext } from "../../src/render/context.mjs";
import { chicagoDate } from "../../src/render/context.mjs";
import { BLOCKS } from "../../src/render/registry.mjs";

export async function resourcesDataNow({ today = chicagoDate() } = {}) {
  const snap = serverContent().render;
  if (!snap) return null;
  const revision = await currentRevision();
  const shared = await sharedNow(snap, { kinds: ["resources"] });
  const site = composeSite(snap, revision?.edits, revision?.structure || null, shared);
  const page = site.pages.find((p) => (p.blocks || []).some((b) => b.type === "resources"));
  if (!page) return null;
  const block = page.blocks.find((b) => b.type === "resources");
  const ctx = makeContext({
    site: site.site, media: snap.media, builtPaths: site.builtPaths || snap.builtPaths,
    programs: new Map([...site.programs, ...sectionPrograms(page)]),
    routes: snap.routes, data: site.data, text: site.text, today,
    prototype: snap.prototype, assets: snap.assets, liveEvents: snap.liveEvents, path: page.path || null,
  });
  BLOCKS.resources.render(block, ctx);
  const held = ctx.deferred.find((d) => d.file === "resources-data.json");
  if (!held) return null;
  return JSON.parse(held.body);
}
