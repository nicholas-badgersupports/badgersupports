/* The Wall of Support: short notes Badgers leave for each other, as paper notes taped up.
   Kept from the live homepage, where it is one of the two things that is unmistakably BSS.
   The notes come from a moderated source; with none, the block renders nothing at all. */

import { html, jsonIsland } from "../html.mjs";

/* The same eight on every request for a given day, so a static page and its no-JS reader agree. */
function pick(notes, n, seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const idx = notes.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).map((i) => notes[i]);
}

export default {
  type: "wall",
  label: "Wall of Support",
  fields: { title: "text!", intro: "text", source: "source!", show: "number", more: "text" },
  data: ["wallNotes"],
  client: "wall.js",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const notes = (ctx.data.wallNotes || []).filter((n) => typeof n === "string" && n.trim());
    if (!notes.length) return html``;
    const n = Math.min(b.show || 8, notes.length);
    const shown = pick(notes, n, ctx.today);
    return html`<section class="wall band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-wall="${n}"><div class="wrap">
  <div class="wall-head"><div><h2 id="${b.id}-h">${b.title}</h2>${b.intro ? html`<p>${b.intro}</p>` : ""}</div>${notes.length > n ? html`<button type="button" class="btn btn--quiet" data-wall-more hidden>${b.more || ctx.t("wall.more")}</button>` : ""}</div>
  ${ctx.data.wallSample ? html`<p class="sample-note">${ctx.data.wallSample}</p>` : ""}
  <ul class="notes" aria-live="polite">${shown.map((t) => html`<li class="note">${t}</li>`)}</ul>
  ${notes.length > n ? jsonIsland(`${b.id}-notes`, notes) : ""}
</div></section>`;
  },
};
