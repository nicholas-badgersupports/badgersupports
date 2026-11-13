/* The next seven days as a timetable — date, time, place — then the next few one-off events.
   It answers "when can I go?" on the first screen after the hero, which the live homepage never
   does (its schedule sits behind three "View the schedule" buttons on other pages). */

import { html, attrs } from "../html.mjs";
import { link, go } from "../context.mjs";
import { picture } from "../media.mjs";
import { icon } from "../icons.mjs";
import { timeUnconfirmed } from "../ics.mjs";
import { rowsBetween, nextDated, groupByDate, dateParts, timeRange, addDays, dayRange } from "../events.mjs";
import { eventClass, eventTags, timeContact } from "../event-status.mjs";

const ARROW_L = html`<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW_R = html`<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* The week's photos as a carousel directly below the timetable card, flush against its
   foot and spanning the wrap's width: photos of the people who come to the Hub.
   (src/client/carousel.js adds the buttons, dots and the slow advance.) Without the
   script the track is an ordinary sideways scroll, like a strip. */
function carousel(ctx, b) {
  const total = b.photos.length;
  return html`<div class="carousel week-photos" data-carousel role="region" aria-roledescription="carousel" aria-label="${ctx.t("carousel.label", { title: b.title })}">
    <ul class="carousel-track" data-carousel-track tabindex="0">${b.photos.map((id, i) => html`<li class="carousel-slide" role="group" aria-roledescription="slide" aria-label="${ctx.t("carousel.count", { n: i + 1, total })}"><div class="photo">${picture(ctx, id, { sizes: "(max-width: 860px) calc(100vw - 2rem), 72rem" })}</div></li>`)}</ul>
    <div class="carousel-controls">
      <button type="button" data-carousel-prev aria-label="${ctx.t("carousel.prev")}">${ARROW_L}</button>
      <div class="carousel-dots">${b.photos.map((id, i) => html`<button${attrs({ type: "button", "data-carousel-dot": true, "aria-label": ctx.t("carousel.dot", { n: i + 1 }), "aria-current": i === 0 ? "true" : null })}><span aria-hidden="true"></span></button>`)}</div>
      <button type="button" data-carousel-next aria-label="${ctx.t("carousel.next")}">${ARROW_R}</button>
      <span class="sr-only" data-carousel-status aria-live="polite"></span>
    </div>
  </div>`;
}

function dateBlock(ctx, date, today) {
  const p = dateParts(date, ctx.t);
  return html`<div class="dateblock" aria-hidden="true"><span class="dow">${p.dow}</span><span class="dom">${p.dom}</span><span class="mon">${p.mon}</span>${date === today ? html`<span class="today-tag">${ctx.t("schedule.today")}</span>` : ""}</div>`;
}

/* An event anyone can walk into gets a Drop in button: to the program's own page when the block
   names one (peer support groups: what a group is, then the way to the Hub), otherwise to the
   room's directions. With neither, it just says no sign-up is needed. */
function signup(ctx, r, dropIn) {
  if (timeUnconfirmed(r)) return timeContact(ctx);
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
  return html`<li${attrs({ class: eventClass("ev", r, ctx.now), "data-program": r.program, "data-starts": r.startsAt, "data-ends": r.endsAt })}>
    <span class="ev-time">${withDate ? html`<span class="sr-only">${p.dowLong}, ${p.monLong} ${p.dom}, </span>` : ""}${when}</span>
    <span class="ev-what"><strong>${title}</strong>${days ? html`<span class="ev-days"><span aria-hidden="true">${days.short}</span><span class="sr-only">${days.long}</span></span>` : ""}${r.place ? html`<span>${r.place.href ? link(ctx, r.place.href, r.place.name) : r.place.name}${r.place.detail ? ` · ${r.place.detail}` : ""}</span>` : ""}</span>
    <span class="ev-sign">${signup(ctx, r, dropIn)}${eventTags(ctx, r)}</span>
  </li>`;
}

export default {
  type: "schedule",
  label: "Event timetable",
  fields: { title: "text!", intro: "text", source: "source!", days: "number", later: "number", laterTitle: "text", home: "place", dropIn: "droplinks", connect: "link", photos: "media[]" },
  data: ["events"],
  client: ["schedule.js", "carousel.js"],
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
  <div class="week-card">
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
  </div>
  ${b.photos?.length ? carousel(ctx, b) : ""}
</div></section>`;
  },
};
