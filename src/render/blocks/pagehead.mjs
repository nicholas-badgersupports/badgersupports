/* The top of an ordinary page: its name, what it is in a sentence or two, and the one thing to do
   first as the page's big button, with any other ways on as quieter pills. Photos of people stand
   beside it, one tall and two small, so a page opens on who is there before what it says. On a
   pale band of the page's colour, on the brand's paper texture, with a straight foot (Badger SPILL's
   waves are SPILL's own mark, so they stay on SPILL's site); the full colour belongs to a program's
   own page (eventhero).

   `label` is a short line above the lead, for wording the old site set as a run-in ("Our
   Mission:"). Every word is the page's own, so every word is editable.

   `timeline` adds the alumni history as a line of its own year stops under the actions
   (yearStops, below): the stops and their labels are the history's own words, drawn from
   the history data, so they stay right as the history grows. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";

const yearRange = /^(\d{4})\s*[–—-]\s*(\d{4})$/;

/* The alumni history's year stops: one per history group whose heading is a bare year
   range — a group named for a programme (the Peer Facilitator groups) is not a stop — in
   year order. A stop carries its organisation's name only where the name takes over: at
   the first stop, and at any stop whose organisation differs from the stop before it.
   The names are the same two provenance labels the history list itself uses. */
function yearStops(ctx) {
  const stops = (ctx.data.alumni?.groups || [])
    .filter((g) => g.people?.length)
    .map((g) => {
      const m = yearRange.exec(g.heading.trim());
      return m ? { years: g.heading.trim(), from: Number(m[1]), org: ctx.t(g.organization === "BSN" ? "alumni.bsn" : "alumni.bss") } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.from - b.from);
  stops.forEach((s, i) => { s.lead = i === 0 || s.org !== stops[i - 1].org; });
  return stops;
}

export default {
  type: "pagehead",
  label: "Page opening",
  fields: { title: "text!", label: "text", lead: "text", body: "paragraphs", primary: "link", links: "link[]", photos: "media[]", firstLinkPrimary: "boolean", whole: "boolean", timeline: "boolean" },
  data: ["alumni"],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const photos = (b.photos || []).slice(0, 3);
    const body = Array.isArray(b.body) ? b.body : b.body ? [b.body] : [];
    const sizes = b.whole ? Array(3).fill("(max-width: 860px) calc(100vw - 2rem), 46vw") : ["(max-width: 860px) 58vw, 26rem", "(max-width: 860px) 38vw, 15rem", "(max-width: 860px) 38vw, 15rem"];
    const primary = b.primary || (b.firstLinkPrimary ? b.links?.[0] : null);
    const links = b.firstLinkPrimary && !b.primary ? b.links?.slice(1) : b.links;
    const actions = primary || links?.length;
    const stops = b.timeline ? yearStops(ctx) : [];
    return html`<section class="${["pagehead band", photos.length ? `has-photos has-${photos.length}` : null, b.whole ? "is-whole" : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
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
  ${stops.length > 1 ? html`<ol class="pagehead-timeline">${stops.map((s, i) => html`<li class="pagehead-stop" style="--d:${(i * 0.07).toFixed(2)}s"><span class="pagehead-stop-years">${s.years}</span><span class="pagehead-stop-dot" aria-hidden="true"></span><span class="pagehead-stop-org">${s.lead ? s.org : ""}</span></li>`)}</ol>` : ""}
</div></section>`;
  },
};
