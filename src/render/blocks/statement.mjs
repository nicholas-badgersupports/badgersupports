/* A statement: one short line a page wants a visitor to actually take in — that a session is
   free, drop-in and open to everyone, say — set large and centred on the program's tint, with
   its key points as chips under it, a few sentences of body, and one clear action. The paw
   prints are drawn from the icon set, so the block suits a page about animals as readily as
   any other; nothing about the words is baked in. */

import { html, attrs } from "../html.mjs";
import { link, go } from "../context.mjs";
import { icon } from "../icons.mjs";

const paras = (body) => (Array.isArray(body) ? body : body ? [body] : []).map((p) => html`<p>${p}</p>`);

export default {
  type: "statement",
  label: "Statement banner",
  fields: { text: "text!", points: "points", body: "paragraphs", primary: "link", links: "link[]", program: "choice:peer|craft|workshops|other" },
  data: [],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    return html`<section id="${b.anchor || b.id}"${attrs({ class: "statement band", "data-program": b.program || null })} aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <h2 class="sr-only" id="${b.id}-h">${b.text}</h2>
  <p class="statement-line" aria-hidden="true">${icon("paw", "statement-paw")}<span>${b.text}</span>${icon("paw", "statement-paw")}</p>
  ${b.points?.length ? html`<ul class="statement-points">${b.points.map((p) => html`<li>${icon(p.icon || "check", "statement-ic")}<span>${p.text}</span></li>`)}</ul>` : ""}
  ${paras(b.body)}
  ${b.primary || b.links?.length ? html`<div class="statement-actions">${b.primary ? link(ctx, b.primary.href, b.primary.label, { class: "btn btn--big", icon: b.primary.icon || "arrow" }) : ""}${(b.links || []).map((l) => go(ctx, l.href, l.label, l.icon || "arrow"))}</div>` : ""}
</div></section>`;
  },
};
