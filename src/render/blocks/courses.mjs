/* Discover Classes by Interest (EXPLORE-F-CLASSES): UW–Madison courses gathered by what
   interests a student — creativity, music, languages, nature, community — from the published
   section offerings ops/courses.mjs pulls out of UW Course Search, the university's official
   listings (docs/research/COURSE-SEARCH-API-2026-11-11.md). The interest mapping is content
   (content/courses.json); the offerings are data, refreshed by the pull, never typed by hand.

   A course is here because it had published sections in a term the service verifies: open
   for a current or upcoming term, or offered in the most recent past term it still serves.
   The label on the card is that term, and it is the whole of the claim — no card says
   anything about a future offering beyond the terms shown. Every card links to UW Course
   Search, where a student reads the sections and enrolls; this page holds no schedules,
   grades or enrollment state, and nothing a visitor chooses is sent anywhere
   (src/client/courses.js filters in the page).

   The page carries the first courses of each group; the whole catalogue rides in a data
   file the build writes beside the page (courses-data.json, registered with ctx.defer),
   and the script fetches it when the visitor first opens, scrolls to or filters the list —
   the site search's pattern (src/render/blocks/sitesearch.mjs). The cards in the file are
   drawn by the same courseCard as the ones on the page, so a card is written once. Without
   a script the first courses of each group show, under the count of the whole catalogue.

   The redesign (approved 15 Nov 2026) turns the interests into the page's front door:
   one tile per interest — its name, how many courses it holds, and the way in — with the
   first interest open beneath them. Availability (all, available, recently offered) and
   the search narrow inside the open interest, so the two old standing groups became a
   filter over one list, and the data file's groups are the interests themselves
   (bss.courses-data/2). A card carries data-open when its course has a published term,
   which is all the availability filter reads. */

import { html, attrs } from "../html.mjs";
import { link } from "../context.mjs";
import { dateParts } from "../events.mjs";
import { icon } from "../icons.mjs";

/* The official listings, and the address the queue entry names for them. The app is a
   stateful search with no published per-course address, so a card links here and names its
   course for a screen reader, as the resource cards name theirs. */
export const COURSE_SEARCH_URL = "https://public.enroll.wisc.edu/search";

function courseCard(c, ctx) {
  const desig = `${c.subject} ${c.number}`;
  const label = c.open ? ctx.t("classes.open", { term: c.open }) : ctx.t("classes.offered", { term: c.offered });
  const credits = c.credits === "1" ? ctx.t("classes.credit.one") : ctx.t("classes.credits", { n: c.credits });
  return html`<li${attrs({ class: "cls-card", "data-cls": "", "data-open": c.open ? "" : null, "data-interests": (c.interests || []).join(" "), "data-search": `${c.subject} ${c.number} ${c.title}` })}>
    <h4 class="cls-title"><span class="cls-desig">${desig}</span> ${c.title}</h4>
    <p class="cls-meta"><span class="cls-credits">${credits}</span> <span class="cls-tag">${label}</span></p>
    <p class="cls-go">${link(ctx, COURSE_SEARCH_URL, html`${ctx.t("classes.view")}<span class="sr-only">: ${desig}</span>`, { class: "btn cls-btn", icon: "out" })}</p>
  </li>`;
}

/* How many of a group's courses the page itself carries; the rest ride in the data file.
   The resource list's page size, so a first view is the same depth on both pages. */
const FIRST = 12;

export default {
  type: "courses",
  label: "Discover Classes by Interest",
  fields: { title: "text!", lead: "text" },
  data: ["courses", "courseInterests", "coursesSample", "coursesUpdated"],
  client: "courses.js",
  styles: "courses.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const all = (ctx.data.courses || []).filter((c) => c && c.id && (c.open || c.offered));
    if (!all.length) return html`<section class="courses band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
      <h2 id="${b.id}-h">${b.title}</h2>
      <p>${ctx.t("classes.empty")}</p>
    </div></section>`;
    const interests = (ctx.data.courseInterests || [])
      .map((i) => ({ ...i, list: all.filter((c) => (c.interests || []).includes(i.id)) }))
      .filter((i) => i.list.length);
    const first = interests[0];
    const countWords = (n) => (n === 1 ? ctx.t("classes.count.one") : ctx.t("classes.count.all", { n }));
    /* The whole catalogue, held back for the script to fetch on first use: one group per
       interest, its cards drawn by the same hand as the page's. A course under two
       interests rides in both groups — the union of the groups is the catalogue. */
    ctx.defer({
      file: "courses-data.json",
      body: JSON.stringify({ schema: "bss.courses-data/2", total: all.length, groups: interests.map((i) => ({ id: i.id, label: i.label, count: i.list.length, cards: i.list.map((c) => String(courseCard(c, ctx))) })) }) + "\n",
    });
    const updated = ctx.data.coursesUpdated;
    return html`<section class="courses band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-courses data-courses-src="${ctx.path || ""}courses-data.json"><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  ${ctx.data.coursesSample ? html`<p class="sample-note">${ctx.data.coursesSample}</p>` : ""}
  <div class="cls-tools" data-cls-tools hidden>
    <div class="cls-tiles" role="group" aria-labelledby="${b.id}-h">
      ${interests.map((i, ix) => html`<button${attrs({ type: "button", class: "cls-tile", "aria-pressed": ix === 0 ? "true" : "false", "data-interest": i.id })}><span class="cls-tile-label">${i.label}</span><span class="cls-tile-count">${countWords(i.list.length)}</span><span class="cls-tile-go">${ctx.t("classes.browse", { label: i.label })}</span></button>`)}
    </div>
    <div class="cls-search">
      <label for="${b.id}-q">${ctx.t("classes.search.label")}</label>
      <p class="cls-hint" id="${b.id}-qh">${ctx.t("classes.search.hint")}</p>
      <div class="cls-field">${icon("search", "cls-field-ic")}<input id="${b.id}-q" type="search" autocomplete="off" spellcheck="false" aria-describedby="${b.id}-qh" data-cls-q><button type="button" class="cls-qclear" aria-label="${ctx.t("classes.search.clear")}" title="${ctx.t("classes.search.clear")}" data-cls-clear hidden>${icon("close")}</button></div>
    </div>
    <div class="cls-avail" role="group" aria-label="${ctx.t("classes.availability")}">
      <button type="button" class="cls-chip" aria-pressed="true" data-avail="all">${ctx.t("classes.group.all")}</button>
      <button type="button" class="cls-chip" aria-pressed="false" data-avail="open">${ctx.t("classes.group.available")}</button>
      <button type="button" class="cls-chip" aria-pressed="false" data-avail="recent">${ctx.t("classes.group.recent")}</button>
    </div>
  </div>
  <div class="cls-status" aria-live="polite"><p class="cls-count" data-cls-count>${countWords(all.length)}</p></div>
  <p class="cls-again" data-cls-again hidden><button type="button" class="btn btn--quiet" data-cls-retry>${ctx.t("classes.retry")}</button></p>
  <div class="cls-group" data-cls-group="${first.id}">
    <h3 data-cls-grouphead>${first.label} — ${countWords(first.list.length)}</h3>
    <ul class="cls-list">${first.list.slice(0, FIRST).map((c) => courseCard(c, ctx))}</ul>
  </div>
  <div class="cls-none" data-cls-none hidden>
    <h3>${ctx.t("classes.none.title")}</h3>
    <p>${ctx.t("classes.none.body")}</p>
    <button type="button" class="btn btn--quiet" data-cls-reset>${ctx.t("classes.none.reset")}</button>
  </div>
  <p class="cls-scope">${ctx.t("classes.source")}${updated ? html` <span class="cls-updated">${ctx.t("classes.updated", dateParts(updated, ctx.t))}</span>` : ""}</p>
</div></section>`;
  },
};
