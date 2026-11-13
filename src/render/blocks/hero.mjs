/* The first screen: the name, what it is, one big way in, and the support network.
 *
 * The network is the picture from the Building Support Networks workshop (Canva, slide 11): big
 * overlapping circles around a small one marked "you". Here each big circle is a photo of one
 * program and a link to it, with its name on a tag; the gaps between circles are the red of the
 * page, as if they were cut out of it. It says hello once when the page opens (the circles pop in
 * together). Then src/client/hero.js sets them drifting and shows the pause control, a round
 * icon button that is one of the network's white dots (WCAG 2.2.2). Its name says what it does,
 * Pause or Play. Without the script, or for anyone who asks for less motion, the circles rest and
 * the button stays hidden.
 *
 * Under the buttons, Badger SPILL: its own logo, which tips and spills when it comes into view and
 * glugs when pointed at (src/client/spill-logo.js), beside a line and a way to write a SPILL (owner,
 * 20 Oct 2026: "Badger SPILL represented ... in the hero element on the front page").
 *
 * The centre circle is a button (owner, 12 Nov 2026, branch hero-smiley-2026-11-12, unmerged). It
 * rests on the centre word — this block's `centre` text field, set in the page's content ("you" in
 * content/pages/home.json), rendered exactly as before — and the smiley face (the "face2" icon, the
 * owner's pick of five) lives on the back of the same circle. When the circle first comes into
 * view, src/client/hero.js turns it over once to the face; pressing it turns it back and forth.
 * The turn is the flip in blocks.css. Anyone who asks for less motion keeps the word until they
 * press, and then it swaps at once. The button's name says what pressing it does, and follows the
 * side showing.
 */

import { html, attrs } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";
import { icon } from "../icons.mjs";
import { spillLogo, SPILL_CLIENT } from "../spill.mjs";

export default {
  type: "hero",
  label: "Hero",
  fields: { title: "text!", tagline: "list", body: "text", primary: "link!", secondary: "link", centre: "text", circles: "circles", spill: "spill" },
  data: [],
  analytics: "page",
  loading: "eager",
  client: ["hero.js", SPILL_CLIENT],
  render(b, ctx) {
    const circles = (b.circles || []).slice(0, 3);
    return html`<section class="hero" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="hero-text">
    <h1 id="${b.id}-h">${b.title}</h1>
    ${b.tagline?.length ? html`<ul class="hero-tagline" aria-label="${ctx.t("hero.taglineLabel")}">${b.tagline.map((t) => html`<li>${t}</li>`)}</ul>` : ""}
    ${b.body ? html`<p class="hero-body">${b.body}</p>` : ""}
    <div class="hero-actions">${link(ctx, b.primary.href, b.primary.label, { class: "btn btn--big", icon: "hand" })}${b.secondary ? link(ctx, b.secondary.href, b.secondary.label, { class: "go go--light", icon: "down" }) : ""}</div>
    ${b.spill ? link(ctx, b.spill.href, html`${spillLogo("hero-spill-logo", "(max-width: 480px) 8rem, 10rem", { eager: true })}<span class="hero-spill-words"><span class="hero-spill-title">${b.spill.title}</span>${b.spill.text ? html`<span class="hero-spill-text">${b.spill.text}</span>` : ""}<span class="go go--light"><span class="go-label">${b.spill.label}</span>${icon("out", "go-ic")}</span></span>`, { class: "hero-spill" }) : ""}
  </div>
  ${circles.length ? html`<div class="network" data-network>
    <ul class="network-list" aria-label="${ctx.t("hero.photosLabel")}">${circles.map((c, i) => html`<li${attrs({ class: `hub hub-${i + 1}`, "data-program": ctx.programOf(c.href) })}>${link(ctx, c.href, html`<span class="hub-photo">${picture(ctx, c.media, { sizes: i === 0 ? "(max-width: 860px) 52vw, 19rem" : "(max-width: 860px) 44vw, 16rem", eager: true, priority: i === 0 ? "high" : null, alt: "" })}</span><span class="hub-tag"><span>${c.label}</span>${icon(c.icon || "arrow", "go-ic")}</span>`, { class: "hub-link" })}</li>`)}</ul>
    ${b.centre ? html`<button type="button" class="hub-you" data-you aria-pressed="false"><span class="you-flip" aria-hidden="true"><span class="you-side you-side--word">${b.centre}</span><span class="you-side you-side--face">${icon("face2", "you-face")}</span></span><span class="sr-only" data-you-label>${ctx.t("hero.youFace")}</span></button>` : ""}
    <span class="bubble bubble-1" aria-hidden="true"></span><span class="bubble bubble-3" aria-hidden="true"></span><span class="bubble bubble-4" aria-hidden="true"></span><span class="bubble bubble-5" aria-hidden="true"></span>
    <button type="button" class="still" data-still hidden>${icon("pause", "still-pause")}${icon("play", "still-play")}<span class="sr-only">${ctx.t("hero.pause")}</span></button>
  </div>` : ""}
</div></section>`;
  },
};
