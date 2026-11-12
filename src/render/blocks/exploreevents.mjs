/* The Campus Events Explorer (WORK item 41, EXPLORE-A-EVENTS): UW–Madison Events, the Wisconsin
 * Union calendar and Badger Supports programs in one searchable, filterable list, with a calendar
 * view of the same set. The build's read of the feeds is rendered here and carried in a JSON
 * island; src/client/campus-events.js refreshes it from /api/campus-events (the feeds are read
 * again at most every few minutes there, and a failed read keeps the last good list) and runs the
 * filters. Without a script, the build's list stays on the page.
 *
 * An external listing is distinct from a Badger Supports program by words, not colour alone: a
 * program card says so, and every card names its source. Cost and "Sold out" appear only when the
 * source states them — ops/campus-feed.mjs keeps an unstated field absent.
 *
 * The list is revealed in steps (campus-events.js): the first set shows, and a Show More button
 * reveals the next set of the events the filters currently match, the way the Resources list
 * does. A toggle beside the source menu limits the list to Badger Supports' own programs — the
 * events the Connect feed marks as ours (badger: true, source "badger") — for a reader who came
 * only for those. No interest chip is styled apart from the others: a chip reads as chosen only
 * while it is pressed. */

import { html, jsonIsland } from "../html.mjs";
import { go, link } from "../context.mjs";
import { icon } from "../icons.mjs";
import { dateParts, timeRange } from "../events.mjs";

const TZ = "America/Chicago";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/* An instant on its Chicago day, and its Chicago HH:MM. */
export const chicagoDay = (iso) => dayFmt.format(new Date(iso));
const chicagoHm = (iso) => hmFmt.format(new Date(iso));
const updatedFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const updatedWords = (iso) => updatedFmt.format(new Date(iso));

export function eventCard(ctx, e, today) {
  const date = chicagoDay(e.start);
  const p = dateParts(date, ctx.t);
  const when = e.allDay ? ctx.t("explore.events.allDay") : timeRange(chicagoHm(e.start), e.end ? chicagoHm(e.end) : null, ctx.t);
  const [first, ...rest] = e.sources;
  return html`<li class="cecard${e.badger ? " is-badger" : ""}">
    <div class="cecard-date${date === today ? " is-today" : ""}" aria-hidden="true"><span class="dow">${p.dow}</span><span class="dom">${p.dom}</span><span class="mon">${p.mon}</span></div>
    <div class="cecard-body">
      <h3>${first?.url ? link(ctx, first.url, e.title) : e.title}</h3>
      ${e.badger ? html`<p class="cecard-program">${ctx.t("explore.events.program")}</p>` : ""}
      <p class="cecard-meta"><span class="sr-only">${p.dowLong}, ${p.monLong} ${p.dom}, </span>${date === today ? html`<span class="cecard-today">${ctx.t("schedule.today")}</span>` : ""}${when}${e.place ? html` · ${e.place}` : ""}</p>
      ${e.organizer ? html`<p class="cecard-org">${e.organizer}</p>` : ""}
      ${e.blurb ? html`<p class="cecard-blurb">${e.blurb}</p>` : ""}
      ${e.cost ? html`<p class="cecard-cost">${e.cost}</p>` : ""}
      ${e.status === "soldOut" ? html`<p class="cecard-status">${ctx.t("explore.events.soldOut")}</p>` : ""}
      <p class="cecard-source">${e.sources.map((s, i) => html`${i ? " · " : ""}${ctx.t("explore.events.sourceLine", { name: s.name })}${s.url ? html` — ${go(ctx, s.url, ctx.t("explore.events.official"), "out")}` : ""}`)}</p>
    </div>
  </li>`;
}

export default {
  type: "exploreevents",
  label: "Campus Events Explorer",
  fields: { title: "text!", lead: "text", count: "number" },
  data: ["campusEvents", "campusInterests"],
  client: "campus-events.js",
  styles: "exploreevents.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const data = ctx.data.campusEvents || { events: [], updated: null, stale: false };
    const interests = ctx.data.campusInterests || { interests: [] };
    const shown = (data.events || []).slice(0, b.count || 40);
    const total = (data.events || []).length;
    const categories = [...new Set((data.events || []).flatMap((e) => e.categories))].sort();
    const payload = { events: data.events || [], interests: interests.interests || [], updated: data.updated || null, stale: !!data.stale, today: ctx.today };
    return html`<section class="exploreevents band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-campus-events><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  ${jsonIsland(`${b.id}-data`, payload)}
  <div class="ce-tools" data-ce-tools hidden>
    <div class="ce-field ce-field--search">
      <label for="${b.id}-q">${ctx.t("explore.events.search")}</label>
      <div class="ce-searchbox">${icon("search", "ce-searchbox-ic")}<input id="${b.id}-q" type="search" autocomplete="off" spellcheck="false" data-ce-q></div>
    </div>
    <fieldset class="ce-interests">
      <legend>${ctx.t("explore.events.interests")}</legend>
      <div class="ce-chips">${(interests.interests || []).map((i) => html`<button type="button" class="ce-chip" aria-pressed="false" data-ce-interest="${i.id}">${i.label}</button>`)}</div>
    </fieldset>
    <div class="ce-row">
      <div class="ce-field">
        <label for="${b.id}-cat">${ctx.t("explore.events.category")}</label>
        <select id="${b.id}-cat" data-ce-cat><option value="">${ctx.t("explore.events.categoryAll")}</option>${categories.map((c) => html`<option value="${c}">${c}</option>`)}</select>
      </div>
      <div class="ce-field">
        <label for="${b.id}-src">${ctx.t("explore.events.source")}</label>
        <select id="${b.id}-src" data-ce-src><option value="">${ctx.t("explore.events.sourceAll")}</option><option value="uw">${ctx.t("explore.events.name.uw")}</option><option value="union">${ctx.t("explore.events.name.union")}</option><option value="badger">${ctx.t("explore.events.name.badger")}</option></select>
      </div>
      <button type="button" class="ce-badger-toggle" aria-pressed="false" data-ce-badger>${ctx.t("explore.events.onlyBadger")}</button>
      <div class="ce-field">
        <label for="${b.id}-from">${ctx.t("explore.events.from")}</label>
        <input id="${b.id}-from" type="date" data-ce-from>
      </div>
      <div class="ce-field">
        <label for="${b.id}-to">${ctx.t("explore.events.to")}</label>
        <input id="${b.id}-to" type="date" data-ce-to>
      </div>
      <div class="ce-field ce-field--view">
        <span class="ce-viewlabel" id="${b.id}-viewlabel">${ctx.t("explore.events.view")}</span>
        <div class="ce-viewtoggle" role="group" aria-labelledby="${b.id}-viewlabel">
          <button type="button" aria-pressed="true" data-ce-view="list">${ctx.t("explore.events.viewList")}</button>
          <button type="button" aria-pressed="false" data-ce-view="calendar">${ctx.t("explore.events.viewCalendar")}</button>
        </div>
      </div>
      <button type="button" class="btn btn--quiet" data-ce-reset>${ctx.t("explore.events.reset")}</button>
    </div>
  </div>
  <div class="ce-status" aria-live="polite">
    <p class="ce-count" data-ce-count>${total ? ctx.t(total === 1 ? "explore.events.count.one" : "explore.events.count.other", { n: total }) : ctx.t("explore.events.count.none")}</p>
    ${data.updated ? html`<p class="ce-updated" data-ce-updated>${ctx.t("explore.events.updated", { when: updatedWords(data.updated) })}</p>` : ""}
  </div>
  <p class="ce-retry" data-ce-retry hidden><button type="button" class="btn btn--quiet" data-ce-retrybtn>${ctx.t("explore.events.retry")}</button></p>
  <ol class="cecards" data-ce-list>${shown.map((e) => eventCard(ctx, e, ctx.today))}</ol>
  <p class="ce-more-row" data-ce-more-row hidden><button type="button" class="btn ce-more-btn" data-ce-more>${ctx.t("explore.events.showMore")}</button></p>
  <div class="cecal" data-ce-cal hidden></div>
  <div class="ce-none" data-ce-none ${shown.length ? "hidden" : ""}>
    <h3>${ctx.t("explore.events.none.title")}</h3>
    <p>${ctx.t("explore.events.none.body")}</p>
  </div>
</div></section>`;
  },
};
