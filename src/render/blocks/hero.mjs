/* The first screen: the name, what it is, one big way in, and the support network.
 *
 * The network is the picture from the Building Support Networks workshop (Canva, slide 11): big
 * overlapping circles around a small one marked "you". Here each big circle is a photo of one
 * program and a link to it, with its name on a tag; the gaps between circles are the red of the
 * page, as if they were cut out of it. It says hello once when the page opens (the circles pop in
 * one after another). Then src/client/hero.js sets them drifting and shows a Pause button in the
 * corner (owner, 20 Oct 2026; WCAG 2.2.2). Without the script, or for anyone who asks for less
 * motion, the circles rest and the button stays hidden.
 */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";
import { icon } from "../icons.mjs";

export default {
  type: "hero",
  label: "Hero",
  fields: { title: "text!", tagline: "list", body: "text", primary: "link!", secondary: "link", centre: "text", circles: "circles" },
  data: [],
  analytics: "page",
  loading: "eager",
  client: "hero.js",
  render(b, ctx) {
    const circles = (b.circles || []).slice(0, 3);
    return html`<section class="hero" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="hero-text">
    <h1 id="${b.id}-h">${b.title}</h1>
    ${b.tagline?.length ? html`<ul class="hero-tagline" aria-label="${ctx.t("hero.taglineLabel")}">${b.tagline.map((t) => html`<li>${t}</li>`)}</ul>` : ""}
    ${b.body ? html`<p class="hero-body">${b.body}</p>` : ""}
    <div class="hero-actions">${link(ctx, b.primary.href, b.primary.label, { class: "btn btn--big", icon: "hand" })}${b.secondary ? link(ctx, b.secondary.href, b.secondary.label, { class: "go go--light", icon: "down" }) : ""}</div>
  </div>
  ${circles.length ? html`<div class="network" data-network>
    <ul class="network-list" aria-label="${ctx.t("hero.photosLabel")}">${circles.map((c, i) => html`<li class="hub hub-${i + 1}">${link(ctx, c.href, html`<span class="hub-photo">${picture(ctx, c.media, { sizes: i === 0 ? "(max-width: 860px) 52vw, 19rem" : "(max-width: 860px) 44vw, 16rem", eager: i === 0, alt: "" })}</span><span class="hub-tag"><span>${c.label}</span>${icon(c.icon || "arrow", "go-ic")}</span>`, { class: "hub-link" })}</li>`)}</ul>
    ${b.centre ? html`<p class="hub-you" aria-hidden="true">${b.centre}</p>` : ""}
    <span class="bubble bubble-1" aria-hidden="true"></span><span class="bubble bubble-2" aria-hidden="true"></span><span class="bubble bubble-3" aria-hidden="true"></span><span class="bubble bubble-4" aria-hidden="true"></span>
    <button type="button" class="still" data-still hidden>${icon("pause", "still-pause")}${icon("play", "still-play")}<span>${ctx.t("hero.pause")}</span></button>
  </div>` : ""}
</div></section>`;
  },
};
