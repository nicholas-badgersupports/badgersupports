/* More photos of an event, below its own sections: a strip of photographs in one row that
   scrolls sideways, the shape the program gallery's strip uses, without the program around it.
   The photos are the event record's (src/render/hubevents.mjs), chosen in the Hub Events
   builder. */

import { html } from "../html.mjs";
import { picture } from "../media.mjs";

export default {
  type: "gallery",
  label: "Photo strip",
  fields: { title: "text", photos: "media[]!" },
  data: [],
  analytics: "page",
  loading: "lazy",
  styles: "gallery.css",
  render(b, ctx) {
    const photos = b.photos || [];
    if (!photos.length) return html``;
    return html`<section class="gallery band"${b.title ? html` aria-labelledby="${b.id}-h"` : html` aria-label="${ctx.t("hubevent.galleryLabel")}"`} data-block="${b.id}"><div class="wrap">
  ${b.title ? html`<h2 id="${b.id}-h">${b.title}</h2>` : ""}
  <ul class="gallery-track">${photos.map((m) => html`<li><div class="photo">${picture(ctx, m, { sizes: "(max-width: 860px) 80vw, 30rem" })}</div></li>`)}</ul>
</div></section>`;
  },
};
