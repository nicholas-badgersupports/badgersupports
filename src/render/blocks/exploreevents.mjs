/* The Campus Events Explorer (WORK item 41, EXPLORE-A-EVENTS): UW–Madison Events, the Wisconsin
 * Union calendar and Badger Supports programs in one searchable, filterable list, with a calendar
 * view of the same set. The build's read of the feeds is rendered here as the first cards; the
 * same data rides in a file beside the page (events-data.json) that src/client/campus-events.js
 * fetches the first time the visitor opens, searches or filters the explorer, and refreshes from
 * /api/campus-events (the feeds are read again at most every few minutes there, and a failed read
 * keeps the last good list) before it runs the filters. Without a script, the build's list stays
 * on the page.
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
 * while it is pressed.
 *
 * The redesign (approved 15 Nov 2026) opens the explorer on a window — Tonight, Today, This
 * Weekend, All Dates — and groups the list: Badger Supports' own programs in the window first,
 * under their own heading, then the window's other events.
 * The build's first paint is the Tonight window read by date (the build knows the day, not the
 * hour); the script re-windows with the real clock the moment the data lands, and refines
 * Tonight to events not yet over. Picking a date range or the calendar sets the window aside.
 *
 * Layout (redesign approved 23 Nov 2026): the tools are one
 * quiet row — the window as a segmented control, a compact search, an Interests fold button and
 * the List/Calendar toggle — and everything else (interest chips, category, source, the Badger
 * Supports toggle, the date range, Clear filters) sits in the fold's panel, closed on arrival. */

import { html } from "../html.mjs";
import { go, link } from "../context.mjs";
import { icon } from "../icons.mjs";
import { dateParts, timeRange } from "../events.mjs";

const TZ = "America/Chicago";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/* An instant on its Chicago day, and its Chicago HH:MM. */
export const chicagoDay = (iso) => dayFmt.format(new Date(iso));
const chicagoHm = (iso) => hmFmt.format(new Date(iso));

export const WINDOWS = ["tonight", "today", "weekend", "all"];
/* Tonight, read by date alone (the build's first paint; the script refines it with the
 * clock): on today, not all-day, and running at or across 5 PM. */
export const inTonight = (e, today) => {
  const d = chicagoDay(e.start), dEnd = chicagoDay(e.end || e.start);
  if (d > today || dEnd < today || e.allDay) return false;
  if (d < today && dEnd > today) return true;
  const s = chicagoHm(e.start), en = chicagoHm(e.end || e.start);
  return s >= "17:00" || (s < "17:00" && en > "17:00" && dEnd === today);
};
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
    const all = data.events || [];
    const total = all.length;
    const categories = [...new Set(all.flatMap((e) => e.categories))].sort();
    const payload = { events: all, interests: interests.interests || [], updated: data.updated || null, stale: !!data.stale, today: ctx.today };
    /* The explorer's whole set, in a file beside the page for the client to fetch on first
       use — the payload the page used to carry in a JSON island. */
    ctx.defer({ file: "events-data.json", body: JSON.stringify({ schema: "bss.events-data/1", ...payload }) });
    /* The first paint is the Tonight window, grouped: ours first, then the window's rest.
       The script re-windows with the real clock as soon as the data file lands. */
    const tonight = all.filter((e) => inTonight(e, ctx.today));
    const badgerTonight = tonight.filter((e) => e.badger);
    const restTonight = tonight.filter((e) => !e.badger).slice(0, 12);
    const groupHead = (label) => html`<h3 class="ce-grouphead">${label}</h3>`;
    return html`<section class="exploreevents band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-campus-events data-ce-data="${ctx.path || ""}events-data.json"><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  <div class="ce-tools" data-ce-tools hidden>
    <div class="ce-bar">
      <fieldset class="ce-when">
        <legend class="sr-only">${ctx.t("explore.events.when")}</legend>
        <div class="ce-seg">${WINDOWS.map((w) => html`<button type="button" class="ce-chip" aria-pressed="${w === "tonight" ? "true" : "false"}" data-ce-window="${w}">${ctx.t(`explore.events.window.${w}`)}</button>`)}</div>
      </fieldset>
      <div class="ce-field ce-field--search">
        <label class="sr-only" for="${b.id}-q">${ctx.t("explore.events.search")}</label>
        <div class="ce-searchbox">${icon("search", "ce-searchbox-ic")}<input id="${b.id}-q" type="search" autocomplete="off" spellcheck="false" data-ce-q></div>
      </div>
      <button type="button" class="ce-foldbtn" aria-expanded="false" aria-controls="${b.id}-filters" data-ce-foldbtn>${ctx.t("explore.events.interests")}<span class="ce-foldcount" data-ce-foldcount hidden></span></button>
      <div class="ce-field ce-field--view">
        <span class="ce-viewlabel sr-only" id="${b.id}-viewlabel">${ctx.t("explore.events.view")}</span>
        <div class="ce-viewtoggle" role="group" aria-labelledby="${b.id}-viewlabel">
          <button type="button" aria-pressed="true" data-ce-view="list">${ctx.t("explore.events.viewList")}</button>
          <button type="button" aria-pressed="false" data-ce-view="calendar">${ctx.t("explore.events.viewCalendar")}</button>
        </div>
      </div>
    </div>
    <div class="ce-panel" id="${b.id}-filters" data-ce-panel hidden>
      <fieldset class="ce-interests">
        <legend class="sr-only">${ctx.t("explore.events.interests")}</legend>
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
        <button type="button" class="btn btn--quiet" data-ce-reset>${ctx.t("explore.events.reset")}</button>
      </div>
    </div>
  </div>
  <div class="ce-status" aria-live="polite">
    <p class="ce-count" data-ce-count>${total ? ctx.t(total === 1 ? "explore.events.count.one" : "explore.events.count.other", { n: total }) : ctx.t("explore.events.count.none")}</p>
    ${data.updated ? html`<p class="ce-updated" data-ce-updated>${ctx.t("explore.events.updated", { when: updatedWords(data.updated) })}</p>` : ""}
  </div>
  <p class="ce-retry" data-ce-retry hidden><button type="button" class="btn btn--quiet" data-ce-retrybtn>${ctx.t("explore.events.retry")}</button></p>
  <div data-ce-list>
    ${badgerTonight.length ? html`<div class="ce-group">${groupHead(`${ctx.t("explore.events.name.badger")} ${ctx.t("explore.events.window.tonight")}`)}<ol class="cecards">${badgerTonight.map((e) => eventCard(ctx, e, ctx.today))}</ol></div>` : ""}
    ${restTonight.length ? html`<div class="ce-group">${groupHead(ctx.t("explore.events.window.tonight"))}<ol class="cecards">${restTonight.map((e) => eventCard(ctx, e, ctx.today))}</ol></div>` : ""}
  </div>
  <p class="ce-more-row" data-ce-more-row hidden><button type="button" class="btn ce-more-btn" data-ce-more>${ctx.t("explore.events.showMore")}</button></p>
  <div class="cecal" data-ce-cal hidden></div>
  <div class="ce-none" data-ce-none ${tonight.length ? "hidden" : ""}>
    <h3>${ctx.t("explore.events.none.title")}</h3>
    <p>${ctx.t("explore.events.none.body")}</p>
  </div>
</div></section>`;
  },
};
