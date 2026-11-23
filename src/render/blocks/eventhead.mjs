/* The top of a Hub event's page (src/render/hubevents.mjs makes the page from its record): the
   event's name at the page's ordinary scale, its date-and-standing line above it where a reader
   meets it first, its tagline, its words and the plain lines of when and where, and its buttons
   in one row of one height directly under the words and the photos, with no gap of its own.
   The photos stand beside the words as one even block — the first tall, the others stacked in
   the same height, so all four edges are shared and no photo ends short of another. On the
   page's pale band, as a page opening is.
   (Page openings of ordinary pages are pagehead's; this is the event pages' own, so an event
   page's header can be the one design the Hub Events builder uses for every event.) */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";

export default {
  type: "eventhead",
  label: "Event opening",
  fields: { title: "text!", label: "text", lead: "text", body: "paragraphs", details: "paragraphs", primary: "link", links: "link[]", photos: "media[]" },
  data: [],
  analytics: "page",
  loading: "eager",
  styles: "eventhead.css",
  render(b, ctx) {
    const photos = (b.photos || []).slice(0, 3);
    const body = Array.isArray(b.body) ? b.body : b.body ? [b.body] : [];
    const details = Array.isArray(b.details) ? b.details : b.details ? [b.details] : [];
    const sizes = ["(max-width: 860px) 58vw, 26rem", "(max-width: 860px) 38vw, 15rem", "(max-width: 860px) 38vw, 15rem"];
    const actions = b.primary || b.links?.length;
    return html`<section class="${["eventhead band", photos.length ? `has-photos has-${photos.length}` : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="eventhead-words">
    ${b.label ? html`<p class="eventhead-label">${b.label}</p>` : ""}
    <h1 id="${b.id}-h">${b.title}</h1>
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${body.map((p) => html`<p>${p}</p>`)}
    ${details.length ? html`<ul class="eventhead-details">${details.map((d) => html`<li>${d}</li>`)}</ul>` : ""}
  </div>
  ${photos.length ? html`<div class="eventhead-photos">${photos.map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: sizes[i], eager: true, priority: i === 0 ? "high" : null })}</div>`)}</div>` : ""}
  ${actions ? html`<div class="eventhead-actions">
      ${b.primary ? link(ctx, b.primary.href, b.primary.label, { class: "btn btn--big", icon: b.primary.icon || "arrow" }) : ""}
      ${(b.links || []).map((l) => link(ctx, l.href, l.label, { class: "btn btn--big btn--quiet", icon: l.icon || "arrow" }))}
    </div>` : ""}
</div></section>`;
  },
};
