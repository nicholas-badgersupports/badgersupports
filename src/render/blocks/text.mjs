/* Plain text: a heading and paragraphs, and any links on from them as pills under the words. The
   smallest block, and the model for a new one.
   variant "era" draws the same words as one stop on a timeline: a title written "When — What" shows its
   when on the line and its what as the card's heading (both stay one heading, one edit target), an
   optional photo sits in the card, and consecutive era sections join into one line (styles/blocks/text.css). */

import { html, attrs } from "../html.mjs";
import { go } from "../context.mjs";
import { picture } from "../media.mjs";

export default {
  type: "text",
  label: "Text",
  fields: { title: "text", heading: "choice:h1|h2", variant: "choice:plain|era", body: "paragraphs!", links: "link[]", photos: "media[]" },
  data: [],
  styles: "text.css",
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const body = Array.isArray(b.body) ? b.body : [b.body];
    if (b.variant === "era" && b.title) return era(b, body, ctx);
    return html`<section${attrs({ class: b.title && b.heading !== "h1" ? "text-block band has-side" : "text-block band", id: b.anchor || null, "aria-labelledby": b.title ? `${b.id}-h` : null, "data-block": b.id })}><div class="wrap">${b.title ? (b.heading === "h1" ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`) : ""}<div class="text-body">${body.map((p) => html`<p>${p}</p>`)}${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}</div></div></section>`;
  },
};

const ERA_SPLIT = /^(.+?)\s+[—–-]\s+(.+)$/;

function era(b, body, ctx) {
  const m = String(b.title).match(ERA_SPLIT);
  const photo = b.photos?.[0];
  return html`<section${attrs({ class: photo ? "text-block band is-era has-photo" : "text-block band is-era", id: b.anchor || null, "aria-labelledby": `${b.id}-h`, "data-block": b.id })}><div class="wrap">
  <h2 id="${b.id}-h" class="era-head">${m ? html`<span class="era-when">${m[1]}</span><span class="era-title">${m[2]}</span>` : html`<span class="era-title">${b.title}</span>`}</h2>
  <div class="era-card">${photo ? html`<div class="photo">${picture(ctx, photo, { sizes: "(max-width: 760px) calc(100vw - 4rem), 34rem" })}</div>` : ""}<div class="text-body">${body.map((p) => html`<p>${p}</p>`)}${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}</div></div>
</div></section>`;
}
