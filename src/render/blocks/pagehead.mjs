/* The top of an ordinary page: its name, what it is in a sentence or two, and the one thing to do
   first as the page's big button, with any other ways on as quieter pills. Photos of people stand
   beside it, one tall and two small, so a page opens on who is there before what it says. On a
   pale band of the page's colour, on the brand's paper texture, with a straight foot (Badger SPILL's
   waves are SPILL's own mark, so they stay on SPILL's site); the full colour belongs to a program's
   own page (eventhero).

   `label` is a short line above the lead, for wording the old site set as a run-in ("Our
   Mission:"). Every word is the page's own, so every word is editable. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";

export default {
  type: "pagehead",
  label: "Page opening",
  fields: { title: "text!", label: "text", lead: "text", body: "paragraphs", primary: "link", links: "link[]", photos: "media[]" },
  data: [],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const photos = (b.photos || []).slice(0, 3);
    const body = Array.isArray(b.body) ? b.body : b.body ? [b.body] : [];
    const sizes = ["(max-width: 860px) 58vw, 26rem", "(max-width: 860px) 38vw, 15rem", "(max-width: 860px) 38vw, 15rem"];
    const actions = b.primary || b.links?.length;
    return html`<section class="${["pagehead band", photos.length ? `has-photos has-${photos.length}` : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="pagehead-words">
    <h1 id="${b.id}-h">${b.title}</h1>
    ${b.label ? html`<p class="pagehead-label">${b.label}</p>` : ""}
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${body.map((p) => html`<p>${p}</p>`)}
    ${actions ? html`<div class="pagehead-actions">
      ${b.primary ? link(ctx, b.primary.href, b.primary.label, { class: "btn btn--big", icon: b.primary.icon || "arrow" }) : ""}
      ${(b.links || []).map((l) => link(ctx, l.href, l.label, { class: "go", icon: l.icon || "arrow" }))}
    </div>` : ""}
  </div>
  ${photos.length ? html`<div class="pagehead-photos">${photos.map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: sizes[i], eager: i === 0 })}</div>`)}</div>` : ""}
</div></section>`;
  },
};
