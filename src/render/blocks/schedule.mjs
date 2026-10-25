/* The next seven days as a timetable — date, time, place — then the next few one-off events.
   It answers "when can I go?" on the first screen after the hero, which the live homepage never
   does (its schedule sits behind three "View the schedule" buttons on other pages). */

import { html, attrs } from "../html.mjs";
import { link, go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { rowsBetween, nextDated, groupByDate, dateParts, timeRange, addDays, dayRange } from "../events.mjs";

function dateBlock(ctx, date, today) {
  const p = dateParts(date, ctx.t);
  return html`<div class="dateblock" aria-hidden="true"><span class="dow">${p.dow}</span><span class="dom">${p.dom}</span><span class="mon">${p.mon}</span>${date === today ? html`<span class="today-tag">${ctx.t("schedule.today")}</span>` : ""}</div>`;
}

/* An event anyone can walk into gets a Drop in button: to the program's own page when the block
   names one (peer support groups: what a group is, then the way to the Hub), otherwise to the
   room's directions. With neither, it just says no sign-up is needed. */
function signup(ctx, r, dropIn) {
  if (r.signup === "connect" && r.signupUrl) return link(ctx, r.signupUrl, ctx.t("schedule.signup.connect"));
  if (r.signup === "none") {
    const to = dropIn?.[r.program] || r.place?.href;
    if (to) return link(ctx, to, html`${ctx.t("schedule.dropIn")}<span class="sr-only">: ${r.title}</span>`, { class: "drop", icon: "pin" });
  }
  return ["none", "link"].includes(r.signup) ? ctx.t(`schedule.signup.${r.signup}`) : "";
}

function eventRow(ctx, r, { withDate = false, dropIn = null } = {}) {
  const p = dateParts(r.date, ctx.t);
  const when = timeRange(r.start, r.end, ctx.t);
  const days = dayRange(r, ctx.t);
  const title = r.href && !ctx.here(r.href) ? link(ctx, r.href, r.title) : r.title;
  return html`<li${attrs({ class: "ev", "data-program": r.program, "data-starts": r.startsAt, "data-ends": r.endsAt })}>
    <span class="ev-time">${withDate ? html`<span class="sr-only">${p.dowLong}, ${p.monLong} ${p.dom}, </span>` : ""}${when}</span>
    <span class="ev-what"><strong>${title}</strong>${days ? html`<span class="ev-days"><span aria-hidden="true">${days.short}</span><span class="sr-only">${days.long}</span></span>` : ""}${r.place ? html`<span>${r.place.href ? link(ctx, r.place.href, r.place.name) : r.place.name}${r.place.detail ? ` · ${r.place.detail}` : ""}</span>` : ""}</span>
    <span class="ev-sign">${signup(ctx, r, dropIn)}<span class="ended-tag">${ctx.t("schedule.ended")}</span></span>
  </li>`;
}

export default {
  type: "schedule",
  label: "Event timetable",
  fields: { title: "text!", intro: "text", source: "source!", days: "number", later: "number", laterTitle: "text", home: "place", dropIn: "droplinks", connect: "link" },
  data: ["events"],
  client: "schedule.js",
  refresh: true,
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const src = ctx.data.events;
    if (!src) throw new Error(`${b.id}: no event source "${b.source}"`);
    const days = b.days || 7;
    const today = ctx.today;
    const week = groupByDate(rowsBetween(src, today, days));
    // after the week: events that start after it (one that starts in the week is already in it, whatever its last day)
    const after = addDays(today, days);
    const later = nextDated(src, after, Infinity).filter((r) => r.date >= after).slice(0, b.later ?? 3);
    const home = b.home ? src.places?.[b.home] : null;
    const dropIn = Object.fromEntries((b.dropIn || []).map((d) => [d.program, d.href]));
    return html`<section class="week band" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <header class="week-head">
    <h2 id="${b.id}-h">${b.title}</h2>
    ${b.intro ? html`<p>${b.intro}</p>` : ""}
    ${home ? html`<div class="place"><strong>${home.name}</strong><span>${home.detail}</span>${home.href ? go(ctx, home.href, ctx.t("schedule.placeLink"), "pin") : ""}</div>` : ""}
  </header>
  <div class="week-body">
    ${week.length ? html`<ol class="days">${week.map((d) => {
      const p = dateParts(d.date, ctx.t);
      return html`<li class="${d.date === today ? "day is-today" : "day"}" data-date="${d.date}">${dateBlock(ctx, d.date, today)}<div><h3 class="sr-only">${d.date === today ? `${ctx.t("schedule.todayPrefix")} ` : ""}${p.dowLong}, ${p.monLong} ${p.dom}</h3><ul class="events">${d.items.map((r) => eventRow(ctx, r, { dropIn }))}</ul></div></li>`;
    })}</ol>` : html`<div class="week-empty">${icon("calendar")}<p><strong>${ctx.t("schedule.none")}</strong><span>${ctx.t("schedule.noneMore")}</span></p></div>`}
    ${later.length ? html`<h3 class="later-title">${b.laterTitle || ctx.t("schedule.laterTitle")}</h3><ol class="days">${later.map((r) => html`<li class="day" data-date="${r.date}">${dateBlock(ctx, r.date, today)}<div><ul class="events">${eventRow(ctx, r, { withDate: true, dropIn })}</ul></div></li>`)}</ol>` : ""}
    ${b.connect ? html`<p class="week-foot">${go(ctx, b.connect.href, b.connect.label, "calendar")}</p>` : ""}
  </div>
</div></section>`;
  },
};
