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
   (src/client/courses.js filters in the page). Without a script every course shows. */

import { html, attrs } from "../html.mjs";
import { link } from "../context.mjs";
import { dateParts } from "../events.mjs";

/* The official listings, and the address the queue entry names for them. The app is a
   stateful search with no published per-course address, so a card links here and names its
   course for a screen reader, as the resource cards name theirs. */
export const COURSE_SEARCH_URL = "https://public.enroll.wisc.edu/search";

function courseCard(c, ctx) {
  const desig = `${c.subject} ${c.number}`;
  const label = c.open ? ctx.t("classes.open", { term: c.open }) : ctx.t("classes.offered", { term: c.offered });
  const credits = c.credits === "1" ? ctx.t("classes.credit.one") : ctx.t("classes.credits", { n: c.credits });
  return html`<li${attrs({ class: "cls-card", "data-cls": "", "data-interests": (c.interests || []).join(" ") })}>
    <h4 class="cls-title"><span class="cls-desig">${desig}</span> ${c.title}</h4>
    <p class="cls-meta"><span class="cls-credits">${credits}</span> <span class="cls-tag">${label}</span></p>
    <p class="cls-go">${link(ctx, COURSE_SEARCH_URL, html`${ctx.t("classes.view")}<span class="sr-only">: ${desig}</span>`, { class: "btn cls-btn", icon: "out" })}</p>
  </li>`;
}

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
    const interests = (ctx.data.courseInterests || []).filter((i) => all.some((c) => (c.interests || []).includes(i.id)));
    const available = all.filter((c) => c.open);
    const recent = all.filter((c) => !c.open);
    const group = (id, heading, list) => list.length ? html`<div class="cls-group" data-cls-group="${id}">
      <h3>${heading}</h3>
      <ul class="cls-list">${list.map((c) => courseCard(c, ctx))}</ul>
    </div>` : "";
    const updated = ctx.data.coursesUpdated;
    return html`<section class="courses band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-courses><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  ${ctx.data.coursesSample ? html`<p class="sample-note">${ctx.data.coursesSample}</p>` : ""}
  <div class="cls-tools" data-cls-tools hidden>
    <div class="cls-interests" role="group" aria-labelledby="${b.id}-h">
      <button type="button" class="cls-chip" aria-pressed="true" data-interest="">${ctx.t("classes.interests.all")}</button>
      ${interests.map((i) => html`<button${attrs({ type: "button", class: "cls-chip", "aria-pressed": "false", "data-interest": i.id })}>${i.label}</button>`)}
    </div>
  </div>
  <div class="cls-status" aria-live="polite"><p class="cls-count" data-cls-count>${all.length === 1 ? ctx.t("classes.count.one") : ctx.t("classes.count.all", { n: all.length })}</p></div>
  ${group("available", ctx.t("classes.group.available"), available)}
  ${group("recent", ctx.t("classes.group.recent"), recent)}
  <p class="cls-scope">${ctx.t("classes.source")}${updated ? html` <span class="cls-updated">${ctx.t("classes.updated", dateParts(updated, ctx.t))}</span>` : ""}</p>
</div></section>`;
  },
};
