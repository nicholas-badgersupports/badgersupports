/* Plain text: a heading and paragraphs, and any links on from them as pills under the words. The
   smallest block, and the model for a new one.
   variant "era" draws the same words as one stop on a timeline: a title written "When — What" shows its
   when on the line and its what as the card's heading (both stay one heading, one edit target), an
   optional photo sits in the card, and consecutive era sections join into one line (styles/blocks/text.css).
   An era card opens with its first sentence as a lead, so the whole story can be scanned from the
   leads alone; what follows folds away (the site's native details pattern, as on the resource
   cards) once the rest passes FOLD_AFTER words — a short stop, like the closing one, stays whole.
   Every word stays on the page either way; the fold only decides what shows first.

   variant "panel" sets the words in a card: the heading over a rule, then the paragraphs side by side
   as parts, each with its icon in a tinted circle (icons names one icon per paragraph, in order) —
   for a page's closing notes, where the plain side-by-side reads as an afterthought. */

import { html, attrs } from "../html.mjs";
import { go } from "../context.mjs";
import { picture } from "../media.mjs";
import { icon } from "../icons.mjs";

export default {
  type: "text",
  label: "Text",
  fields: { title: "text", heading: "choice:h1|h2", variant: "choice:plain|era|panel", body: "paragraphs!", links: "link[]", photos: "media[]", icons: "list" },
  data: [],
  styles: "text.css",
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const body = Array.isArray(b.body) ? b.body : [b.body];
    if (b.variant === "era" && b.title) return era(b, body, ctx);
    if (b.variant === "panel" && b.title) return panel(b, body, ctx);
    return html`<section${attrs({ class: b.title && b.heading !== "h1" ? "text-block band has-side" : "text-block band", id: b.anchor || null, "aria-labelledby": b.title ? `${b.id}-h` : null, "data-block": b.id })}><div class="wrap">${b.title ? (b.heading === "h1" ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`) : ""}<div class="text-body">${body.map((p) => html`<p>${p}</p>`)}${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}</div></div></section>`;
  },
};

const ERA_SPLIT = /^(.+?)\s+[—–-]\s+(.+)$/;
/* The first sentence of an era's first paragraph, and what follows it. */
const FIRST_SENTENCE = /^([\s\S]*?[.!?])\s+(?=[A-Z"“])([\s\S]*)$/;
/* An era folds when the words past its lead pass this count. */
const FOLD_AFTER = 50;
const words = (paras) => paras.join(" ").split(/\s+/).filter(Boolean).length;

function era(b, body, ctx) {
  const m = String(b.title).match(ERA_SPLIT);
  const photo = b.photos?.[0];
  const [first, ...others] = body;
  const sm = typeof first === "string" ? first.match(FIRST_SENTENCE) : null;
  const lead = sm ? sm[1] : null;
  const rest = sm ? [sm[2], ...others] : body;
  const fold = lead && words(rest) > FOLD_AFTER;
  const shown = lead
    ? html`<p class="era-lead">${lead}</p>${fold
      ? html`<details class="era-more"><summary><span>${ctx.t("history.more")}</span>${icon("plus")}</summary><div class="era-more-body">${rest.map((p) => html`<p>${p}</p>`)}</div></details>`
      : rest.map((p) => html`<p>${p}</p>`)}`
    : body.map((p) => html`<p>${p}</p>`);
  return html`<section${attrs({ class: photo ? "text-block band is-era has-photo" : "text-block band is-era", id: b.anchor || null, "aria-labelledby": `${b.id}-h`, "data-block": b.id })}><div class="wrap">
  <h2 id="${b.id}-h" class="era-head">${m ? html`<span class="era-when">${m[1]}</span><span class="era-title">${m[2]}</span>` : html`<span class="era-title">${b.title}</span>`}</h2>
  <div class="era-card">${photo ? html`<div class="photo">${picture(ctx, photo, { sizes: "(max-width: 760px) calc(100vw - 4rem), 34rem" })}</div>` : ""}<div class="text-body">${shown}${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}</div></div>
</div></section>`;
}

function panel(b, body, ctx) {
  const icons = Array.isArray(b.icons) ? b.icons : [];
  return html`<section${attrs({ class: "text-block band is-panel", id: b.anchor || null, "aria-labelledby": `${b.id}-h`, "data-block": b.id })}><div class="wrap"><div class="note-panel">
  <h2 id="${b.id}-h">${b.title}</h2>
  <div class="note-parts">${body.map((p, i) => html`<div class="note-part">${icons[i] ? html`<span class="note-ic">${icon(icons[i])}</span>` : ""}<p>${p}</p></div>`)}</div>
  ${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}
</div></div></section>`;
}
