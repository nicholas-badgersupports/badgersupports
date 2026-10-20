/* Plain text: a heading and paragraphs, and any links on from them as pills under the words. The
   smallest block, and the model for a new one. */

import { html, attrs } from "../html.mjs";
import { go } from "../context.mjs";

export default {
  type: "text",
  label: "Text",
  fields: { title: "text", heading: "choice:h1|h2", body: "paragraphs!", links: "link[]" },
  data: [],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const body = Array.isArray(b.body) ? b.body : [b.body];
    return html`<section${attrs({ class: b.title && b.heading !== "h1" ? "text-block band has-side" : "text-block band", "aria-labelledby": b.title ? `${b.id}-h` : null, "data-block": b.id })}><div class="wrap">${b.title ? (b.heading === "h1" ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`) : ""}<div class="text-body">${body.map((p) => html`<p>${p}</p>`)}${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}</div></div></section>`;
  },
};
