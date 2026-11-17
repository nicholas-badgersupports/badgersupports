/* Site-wide search (queue item 39, slice 39-A; the owner approved the slice on 11 Nov 2026):
   a box that searches the words on this site's public pages, in the visitor's browser, against
   the index the build writes (ops/build.mjs, searchIndex, delivered as /search-index.json).
   Nothing typed is sent anywhere: the script reads the index from this site and matches on the
   visitor's own machine.

   The index holds the public, indexable pages only. The staff page and the 404 page are
   noindex and stay out, form answers are never page content, and resource records keep their
   own Resource Search on the Resources page. The index is data the search reads, never page
   content (UX placement audit finding 3, ruled 16 Nov 2026): the page renders no results
   until the visitor types a query. Without JavaScript the box stays hidden and the count
   line says search needs JavaScript; when the index cannot be loaded the count line says
   so and the Try Again button is offered — that button appears only on a failed load. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { icon } from "../icons.mjs";
import { resourceVisible } from "./resources.mjs";

/* The crisis block's records: 988 and the UHS 24/7 crisis line, drawn from the resource
   catalogue itself, so the block carries the catalogue's own words and follows them when
   they change. The script (src/client/search.js) shows the block above the results when
   the visitor's words are the 988 record's own crisis words (its aka list) — the site
   search's mirror of the resource list's safety pinning. */
const CRISIS_IDS = ["988-suicide-crisis-lifeline", "uhs-24-7-mental-health-crisis-support-line"];

/* The crisis line as the page band prints it (src/render/layout.mjs, supportLine): the
   Site settings sentence with its numbers linked. Empty when the band is off. */
function crisisLine(ctx) {
  const sl = ctx.site?.supportLine;
  if (!sl?.enabled || !sl.text) return "";
  let parts = [sl.text];
  for (const l of sl.links || []) {
    parts = parts.flatMap((p) => {
      if (typeof p !== "string") return [p];
      const i = p.indexOf(l.label);
      if (i < 0) return [p];
      return [p.slice(0, i), html`<a href="${l.href}">${l.label}</a>`, p.slice(i + l.label.length)];
    });
  }
  return parts;
}

export default {
  type: "sitesearch",
  label: "Site search",
  fields: { title: "text!", lead: "text" },
  data: ["searchIndex", "resources"],
  client: "search.js",
  styles: "sitesearch.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const crisis = CRISIS_IDS.map((id) => (ctx.data.resources || []).find((r) => r && r.id === id)).filter((r) => r && resourceVisible(r));
    return html`<section class="sitesearch band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-search><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  <div class="srch-tools" data-srch-tools hidden>
    <label for="${b.id}-q">${ctx.t("search.label")}</label>
    <p class="srch-hint" id="${b.id}-qh">${ctx.t("search.hint")}</p>
    <div class="srch-field">${icon("search", "srch-field-ic")}<input id="${b.id}-q" type="search" autocomplete="off" spellcheck="false" aria-describedby="${b.id}-qh" data-srch-q><button type="button" class="srch-qclear" aria-label="${ctx.t("search.clear")}" title="${ctx.t("search.clear")}" data-srch-clear hidden>${icon("close")}</button></div>
  </div>
  <div class="srch-status" aria-live="polite"><p class="srch-count" data-srch-count>${ctx.t("search.nojs")}</p><p class="srch-relaxed" data-srch-relaxed hidden>${ctx.t("search.relaxed")}</p></div>
  ${crisis.length ? html`<div class="srch-crisis" data-srch-crisis hidden>
    <h3>${ctx.t("support.label")}</h3>
    <ul>${crisis.map((r) => { const href = r.source?.url || r.action?.url || r.url; return html`<li>
      <p class="srch-crisis-name">${href ? link(ctx, href, r.name, { icon: "out" }) : r.name}</p>
      ${r.summary ? html`<p>${r.summary}</p>` : ""}
      ${r.nextStep ? html`<p>${r.nextStep}</p>` : ""}
    </li>`; })}</ul>
  </div>` : ""}
  <p class="srch-again" data-srch-again hidden><button type="button" class="btn btn--quiet" data-srch-retry>${ctx.t("search.retry")}</button></p>
  <ul class="srch-list" data-srch-list hidden></ul>
  <div class="srch-none" data-srch-none hidden>
    <h3>${ctx.t("search.none.title")}</h3>
    <p>${ctx.t("search.none.body")}</p>
    <div class="srch-closest" data-srch-closest-wrap hidden>
      <p class="srch-closest-label">${ctx.t("search.none.closest")}</p>
      <ul data-srch-closest></ul>
    </div>
    <p class="srch-none-actions">${link(ctx, "/resources/", ctx.t("search.none.resources"), { class: "btn btn--quiet", attrs: { "data-srch-resources": "" } })}<button type="button" class="btn btn--quiet" data-srch-reset>${ctx.t("search.none.reset")}</button></p>
    <p class="srch-crisis-line">${crisisLine(ctx)}</p>
  </div>
  <p class="srch-scope">${ctx.t("search.scope")}</p>
</div></section>`;
  },
};
