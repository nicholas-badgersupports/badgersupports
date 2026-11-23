/* The top of an ordinary page: its name, what it is in a sentence or two, and the one thing to do
   first as the page's big button, with any other ways on as quieter pills. Photos of people stand
   beside it, one tall and two small, so a page opens on who is there before what it says. On a
   pale band of the page's colour, on the brand's paper texture, with a straight foot (Badger SPILL's
   waves are SPILL's own mark, so they stay on SPILL's site); the full colour belongs to a program's
   own page (eventhero).

   `label` is a short line above the lead, for wording the old site set as a run-in ("Our
   Mission:"). Every word is the page's own, so every word is editable.

   `side` stands a panel of the page's own material in the band's right side where a page
   has no photos — the bus explorer's route badges first (hero audit Proposal 5, approved
   23 Nov 2026); the directory, press, tools and interests kinds carry the same mechanism
   for their pages. Every word and badge is copied from the page's own content below;
   nothing new is written. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";
import { icon } from "../icons.mjs";

function sidePanel(b) {
  const items = b.sideItems || [];
  if (b.side === "directory") {
    return html`<div class="pagehead-side is-directory">
      ${b.sideTitle ? html`<p class="ph-side-title">${b.sideTitle}</p>` : ""}
      <ul class="ph-dir">${items.map((it) => html`<li>
        ${it.href ? html`<a href="${it.href}">${it.name}</a>` : html`<span class="ph-dir-name">${it.name}</span>`}
        ${it.address ? html`<span class="ph-dir-addr">${it.address}</span>` : ""}
      </li>`)}</ul>
    </div>`;
  }
  if (b.side === "press") {
    return html`<div class="pagehead-side is-press">${items.map((it) => html`<article class="ph-card">
        <p class="ph-card-title">${it.title}</p>
        ${it.line ? html`<p class="ph-card-line">${it.line}</p>` : ""}
      </article>`)}</div>`;
  }
  if (b.side === "routes") {
    return html`<div class="pagehead-side is-routes">${items.map((it) => html`<span class="bus-badge bus-badge--big bus-badge--r${it.name}">${it.name}</span>`)}</div>`;
  }
  if (b.side === "tools") {
    return html`<div class="pagehead-side is-tools">${items.map((it) => html`<span class="ph-tool"><span class="ph-tool-ic">${icon(it.icon || "arrow")}</span><span class="ph-tool-name">${it.title}</span></span>`)}</div>`;
  }
  if (b.side === "interests") {
    return html`<div class="pagehead-side is-interests">${items.map((it) => html`<span class="ph-chip">${it.label}</span>`)}</div>`;
  }
  return "";
}

export default {
  type: "pagehead",
  label: "Page opening",
  fields: { title: "text!", label: "text", lead: "text", body: "paragraphs", primary: "link", links: "link[]", photos: "media[]", firstLinkPrimary: "boolean", whole: "boolean", side: "choice:none|directory|press|routes|tools|interests", sideTitle: "text", sideItems: "rows" },
  data: [],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const photos = (b.photos || []).slice(0, 3);
    const body = Array.isArray(b.body) ? b.body : b.body ? [b.body] : [];
    const sizes = b.whole ? Array(3).fill("(max-width: 860px) calc(100vw - 2rem), 46vw") : ["(max-width: 860px) 58vw, 26rem", "(max-width: 860px) 38vw, 15rem", "(max-width: 860px) 38vw, 15rem"];
    const primary = b.primary || (b.firstLinkPrimary ? b.links?.[0] : null);
    const links = b.firstLinkPrimary && !b.primary ? b.links?.slice(1) : b.links;
    const actions = primary || links?.length;
    return html`<section class="${["pagehead band", photos.length ? `has-photos has-${photos.length}` : null, b.whole ? "is-whole" : null, b.side ? "has-side" : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
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
  ${b.side ? sidePanel(b) : ""}
</div></section>`;
  },
};
