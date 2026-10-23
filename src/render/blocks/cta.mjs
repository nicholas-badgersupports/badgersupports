/* The close of a page: one thing to do next, on the red ground, after the visitor has seen
   everything else. One big button; any other ways on are the quieter light pills beside it. A
   photo of people, when the block has one, sits at the side in a circle. `whole` shows it at its own
   shape instead, uncropped, for a slide or a card whose words must stay whole. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";

export default {
  type: "cta",
  label: "Closing call to action",
  fields: { title: "text!", body: "text", primary: "link!", links: "link[]", photos: "media[]", whole: "boolean" },
  data: [],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const [photo] = b.photos || [];
    const whole = Boolean(photo && b.whole);
    return html`<section class="${["cta", photo ? "has-photo" : null, whole ? "is-whole" : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  ${photo ? html`<div class="photo cta-photo">${picture(ctx, photo, { sizes: whole ? "(max-width: 860px) calc(100vw - 2rem), 34rem" : "(max-width: 860px) 9rem, 15rem" })}</div>` : ""}
  <div class="cta-words">
    <h2 id="${b.id}-h">${b.title}</h2>
    ${b.body ? html`<p class="lead">${b.body}</p>` : ""}
    <div class="cta-actions">
      ${link(ctx, b.primary.href, b.primary.label, { class: "btn btn--big", icon: b.primary.icon || "arrow" })}
      ${(b.links || []).map((l) => link(ctx, l.href, l.label, { class: "go go--light", icon: l.icon || "arrow" }))}
    </div>
  </div>
</div></section>`;
  },
};
