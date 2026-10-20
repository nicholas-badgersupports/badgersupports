/* Badger SPILL, a Badger Supports program: confidential written peer support at badgerspill.org.
 * A band in SPILL's own colours with its logo, which says hello when it comes into view and plays
 * a splash, a seesaw or a pour each time it is pressed, as it does on SPILL's own pages
 * (src/client/spill-logo.js). Then a heading, a few lines and the ways to SPILL itself. For any page
 * where SPILL belongs: the homepage, peer support, getting involved (owner, 20 Oct 2026). */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { spillLogo, SPILL_CLIENT } from "../spill.mjs";

export default {
  type: "spill",
  label: "Badger SPILL",
  fields: { title: "text!", body: "paragraphs", primary: "link!", links: "link[]" },
  data: [],
  analytics: "page",
  loading: "lazy",
  client: SPILL_CLIENT,
  render(b, ctx) {
    const body = b.body == null ? [] : [].concat(b.body);
    return html`<section class="spill-band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap"><div class="spill-card">
  ${spillLogo("spill-band-logo", "(max-width: 640px) 14rem, 20rem")}
  <div class="spill-words">
    <h2 id="${b.id}-h">${b.title}</h2>
    ${body.map((p) => html`<p>${p}</p>`)}
    <div class="spill-actions">
      ${link(ctx, b.primary.href, b.primary.label, { class: "btn btn--big", icon: b.primary.icon || "arrow" })}
      ${(b.links || []).map((l) => link(ctx, l.href, l.label, { class: "go", icon: l.icon || "arrow" }))}
    </div>
  </div>
</div></div></section>`;
  },
};
