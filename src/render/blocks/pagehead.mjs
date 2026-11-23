/* The top of an ordinary page: its name, what it is in a sentence or two, and the one thing to do
   first as the page's big button, with any other ways on as quieter pills. Photos of people stand
   beside it, one tall and two small, so a page opens on who is there before what it says. On a
   pale band of the page's colour, on the brand's paper texture, with a straight foot (Badger SPILL's
   waves are SPILL's own mark, so they stay on SPILL's site); the full colour belongs to a program's
   own page (eventhero).

   `label` is a short line above the lead, for wording the old site set as a run-in ("Our
   Mission:"). Every word is the page's own, so every word is editable.

   `heroRibbons` names ribbon tones (the ribbons block's colours) to stand as a row of
   decoration in the opening, placed by that page's own rules in blocks.css. The row is
   ornament only: it takes no clicks and is hidden from screen readers, and no page is
   required to carry it. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";
import { ribbonArt, isRibbonTone } from "./ribbons.mjs";

export default {
  type: "pagehead",
  label: "Page opening",
  fields: { title: "text!", label: "text", lead: "text", body: "paragraphs", primary: "link", links: "link[]", photos: "media[]", firstLinkPrimary: "boolean", whole: "boolean", heroRibbons: "list" },
  data: [],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const photos = (b.photos || []).slice(0, 3);
    const body = Array.isArray(b.body) ? b.body : b.body ? [b.body] : [];
    const sizes = b.whole ? Array(3).fill("(max-width: 860px) calc(100vw - 2rem), 46vw") : ["(max-width: 860px) 58vw, 26rem", "(max-width: 860px) 38vw, 15rem", "(max-width: 860px) 38vw, 15rem"];
    const heroTones = Array.isArray(b.heroRibbons) ? b.heroRibbons.filter((t) => typeof t === "string" && t) : [];
    const primary = b.primary || (b.firstLinkPrimary ? b.links?.[0] : null);
    const links = b.firstLinkPrimary && !b.primary ? b.links?.slice(1) : b.links;
    const actions = primary || links?.length;
    return html`<section class="${["pagehead band", photos.length ? `has-photos has-${photos.length}` : null, b.whole ? "is-whole" : null, heroTones.length ? "has-hero-ribbons" : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="pagehead-words">
    <h1 id="${b.id}-h">${b.title}</h1>
    ${b.label ? html`<p class="pagehead-label">${b.label}</p>` : ""}
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${body.map((p) => html`<p>${p}</p>`)}
  </div>
    ${actions ? html`<div class="pagehead-actions">
      ${primary ? link(ctx, primary.href, primary.label, { class: "btn btn--big", icon: primary.icon || "arrow" }) : ""}
      ${(links || []).map((l) => link(ctx, l.href, l.label, { class: "go", icon: l.icon || "arrow" }))}
    </div>` : ""}
  ${photos.length ? html`<div class="pagehead-photos">${photos.map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: sizes[i], eager: true, priority: i === 0 ? "high" : null })}</div>`)}</div>` : ""}
</div>${heroTones.length ? html`<div class="pagehead-ribbons" aria-hidden="true">${heroTones.map((t, i) => html`<span class="ph-ribbon">${ribbonArt(t, `${b.id}-hero-${i}`)}</span>`)}</div>` : ""}</section>`;
  },
};

/* The row is placed for at most five ribbons (blocks.css), and every tone it names must be
   one the ribbon artwork can draw: an unknown name would stand in the opening uncoloured. */
export function pageheadProblems(b) {
  const out = [];
  if (b.heroRibbons == null) return out;
  if (!Array.isArray(b.heroRibbons) || b.heroRibbons.some((t) => typeof t !== "string" || !t)) { out.push(`${b.id}: heroRibbons is a list of ribbon tones`); return out; }
  if (b.heroRibbons.length > 5) out.push(`${b.id}: heroRibbons names ${b.heroRibbons.length} ribbons; the opening's row holds at most five`);
  for (const t of b.heroRibbons) if (!isRibbonTone(t)) out.push(`${b.id}: unknown ribbon tone "${t}"`);
  return out;
}
