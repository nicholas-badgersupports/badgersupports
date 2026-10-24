/* A directory of a building or a block: groups in order (a floor, a side of the square), each with
   its heading, an optional second line (who holds the floor, the street) and its places. A place is
   a name, an optional address and an optional link, so every office keeps its own link, which a
   card's single link cannot do. */

import { html } from "../html.mjs";
import { go, link } from "../context.mjs";

export default {
  type: "directory",
  label: "Directory",
  fields: { title: "text!", lead: "text", groups: "directory!", links: "link[]" },
  data: [],
  styles: "directory.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    return html`<section class="directory band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  <ol class="dy-groups">${b.groups.map((g) => html`<li class="dy-group" id="${g.id}">
    <h3><span class="dy-title">${g.title}</span>${g.label ? html`<span class="dy-label">${g.label}</span>` : ""}</h3>
    <ul class="dy-items">${g.items.map((it) => html`<li>
      ${it.href ? link(ctx, it.href, it.name, { icon: "arrow" }) : html`<span class="dy-name">${it.name}</span>`}
      ${it.address ? html`<span class="dy-addr">${it.address}</span>` : ""}
    </li>`)}</ul>
  </li>`)}</ol>
  ${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}
</div></section>`;
  },
};

/* Why a directory block cannot be published, as a list of reasons. */
export function directoryProblems(b) {
  const out = [];
  const ids = new Set();
  for (const [i, g] of (b.groups || []).entries()) {
    const at = `${b.id}: groups[${i}]`;
    if (!g || typeof g !== "object") { out.push(`${at}: a group is an object`); continue; }
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(g.id || "")) out.push(`${at}: id must be lower-case letters, digits and hyphens`);
    else if (ids.has(g.id)) out.push(`${at}: duplicate id "${g.id}"`);
    ids.add(g.id);
    if (typeof g.title !== "string" || !g.title.trim()) out.push(`${at}: a group needs a heading`);
    if (g.label != null && typeof g.label !== "string") out.push(`${at}: the second line is text`);
    if (!Array.isArray(g.items) || !g.items.length) { out.push(`${at}: a group needs at least one place`); continue; }
    for (const [j, it] of g.items.entries()) {
      if (typeof it?.name !== "string" || !it.name.trim()) out.push(`${at}.items[${j}]: a place needs a name`);
      for (const k of ["address", "href"]) if (it?.[k] != null && (typeof it[k] !== "string" || !it[k].trim())) out.push(`${at}.items[${j}]: ${k} is text`);
    }
  }
  if (!(b.groups || []).length) out.push(`${b.id}: a directory needs at least one group`);
  return out;
}
