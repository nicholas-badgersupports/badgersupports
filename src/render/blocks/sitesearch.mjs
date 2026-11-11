/* Site-wide search (queue item 39, slice 39-A; the owner approved the slice on 11 Nov 2026):
   a box that searches the words on this site's public pages, in the visitor's browser, against
   the index the build writes (ops/build.mjs, searchIndex, delivered as /search-index.json).
   Nothing typed is sent anywhere: the script reads the index from this site and matches on the
   visitor's own machine.

   The index holds the public, indexable pages only. The staff page and the 404 page are
   noindex and stay out, form answers are never page content, and resource records keep their
   own Resource Search on the Resources page. Without JavaScript the box stays hidden and
   every indexed page is listed below as a plain link, so the page still works; the same list
   stays when the index cannot be loaded. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { icon } from "../icons.mjs";

export default {
  type: "sitesearch",
  label: "Site search",
  fields: { title: "text!", lead: "text" },
  data: ["searchIndex"],
  client: "search.js",
  styles: "sitesearch.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const all = ctx.data.searchIndex || [];
    return html`<section class="sitesearch band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-search><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  <div class="srch-tools" data-srch-tools hidden>
    <label for="${b.id}-q">${ctx.t("search.label")}</label>
    <p class="srch-hint" id="${b.id}-qh">${ctx.t("search.hint")}</p>
    <div class="srch-field">${icon("search", "srch-field-ic")}<input id="${b.id}-q" type="search" autocomplete="off" spellcheck="false" aria-describedby="${b.id}-qh" data-srch-q><button type="button" class="srch-qclear" aria-label="${ctx.t("search.clear")}" title="${ctx.t("search.clear")}" data-srch-clear hidden>${icon("close")}</button></div>
  </div>
  <div class="srch-status" aria-live="polite"><p class="srch-count" data-srch-count>${ctx.t("search.nojs")}</p><p class="srch-relaxed" data-srch-relaxed hidden>${ctx.t("search.relaxed")}</p></div>
  <p class="srch-again" data-srch-again hidden><button type="button" class="btn btn--quiet" data-srch-retry>${ctx.t("search.retry")}</button></p>
  <ul class="srch-list" data-srch-list hidden></ul>
  <div class="srch-none" data-srch-none hidden>
    <h3>${ctx.t("search.none.title")}</h3>
    <p>${ctx.t("search.none.body")}</p>
    <button type="button" class="btn btn--quiet" data-srch-reset>${ctx.t("search.none.reset")}</button>
  </div>
  <div class="srch-all" data-srch-all>
    <h3>${ctx.t("search.browse")}</h3>
    <ul>${all.map((p) => html`<li>${link(ctx, p.path, p.title)}</li>`)}</ul>
  </div>
  <p class="srch-scope">${ctx.t("search.scope")}</p>
</div></section>`;
  },
};
