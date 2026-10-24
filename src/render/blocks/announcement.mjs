/* A one-line notice above the header. Switched on and off, and dated (startsOn / endsOn, as any block), in Connect. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";

export default {
  type: "announcement",
  label: "Announcement strip",
  placement: "top",
  fields: { text: "text!", link: "link" },
  data: [],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    return html`<aside class="announce" aria-label="${ctx.t("announce.label")}" data-block="${b.id}"><div class="wrap"><p>${b.text}</p>${b.link ? link(ctx, b.link.href, b.link.label) : ""}</div></aside>`;
  },
};
