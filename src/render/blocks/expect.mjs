/* What coming is like, for someone who has never been: a heading, a few sentences, and the short
   things a first-timer wants to know before walking in (who can come, whether it costs anything,
   whether they need to be good at it), each a line with its icon on a dotted rule rather than a
   row of identical cards. A photo of people at one of the nights stands beside it.

   `links` ends it with the ways on, as pills. `flip` puts the photos on the right, so a page that
   sets several of these one after another reads as a zigzag rather than a column of twins. */

import { html } from "../html.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";
import { go } from "../context.mjs";

export default {
  type: "expect",
  label: "What to expect",
  fields: { title: "text!", body: "paragraphs", items: "points", links: "link[]", photos: "media[]", flip: "boolean" },
  data: [],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const body = b.body ? (Array.isArray(b.body) ? b.body : [b.body]) : [];
    const photos = (b.photos || []).slice(0, 2);
    const sizes = ["(max-width: 860px) calc(100vw - 2rem), 30rem", "(max-width: 860px) 40vw, 13rem"];
    return html`<section class="${["expect band", photos.length ? "has-photos" : null, photos.length && b.flip ? "is-flip" : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  ${photos.length ? html`<div class="expect-photos">${photos.map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: sizes[i] })}</div>`)}</div>` : ""}
  <div class="expect-words">
    <h2 id="${b.id}-h">${b.title}</h2>
    ${body.map((p) => html`<p>${p}</p>`)}
    ${b.items?.length ? html`<ul class="expect-points">${b.items.map((it) => html`<li>${icon(it.icon || "check", "expect-ic")}<span>${it.text}</span></li>`)}</ul>` : ""}
    ${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}
  </div>
</div></section>`;
  },
};
