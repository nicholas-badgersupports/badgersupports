/* One program's events as cards, built the way Connect builds its event card so the two read as
   one family: the filled date block on the left with the time under a rule, the photo (when
   the event has one) in its own column, then the body; and on one row at the foot, a round
   calendar button pinned left and the one filled action, Drop in, which leads to the room (a room
   with no directions page yet keeps the words, unlinked). The
   upcoming events come first; under them, the most recent ones that have happened, shown as their
   photos with the date and name under each, and no actions. The page leads with people: a block may
   carry photos, set as a mosaic beside its heading. The calendar button opens a calendar file for the
   event (src/render/ics.mjs calendarHref), so adding one needs no account and no script.

   `show` splits the two lists into blocks of their own, so a page can put other sections between
   them: "upcoming" shows only the events to come and "recent" only the ones that have happened,
   each under the block's own title. `skip` leaves out the first events to come, for a page whose
   event hero already shows the next one. A list split off this way that finds nothing renders an
   empty hidden section, except an upcoming list skipping none, which says nothing is scheduled. The
   hidden section keeps the block's place, so schedule.js can fill it when Connect lists an event
   between publishes. */

import { html, attrs } from "../html.mjs";
import { link, go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";
import { calendarHref } from "../ics.mjs";
import { nextDated, lastDated, dateParts, timeRange, dayRange, runsOn } from "../events.mjs";

/* A night that has happened, as its photo: the date and name under it. One without a photo keeps
   the card. */
function shot(ctx, r) {
  if (!r.media) return card(ctx, r, { past: true });
  const p = dateParts(r.date, ctx.t);
  const days = dayRange(r, ctx.t);
  const hid = `ev-${r.event}`;
  return html`<li class="evshot" aria-labelledby="${hid}">
    <div class="photo">${picture(ctx, r.media, { sizes: "(max-width: 760px) calc(50vw - 1.5rem), 17rem" })}</div>
    <h3 id="${hid}"><span class="evshot-date" aria-hidden="true">${days ? days.short : `${p.dow} ${p.mon} ${p.dom}`}</span>${r.short}<span class="sr-only">, ${days ? days.long : `${p.dowLong}, ${p.monLong} ${p.dom}`}</span></h3>
  </li>`;
}

function mosaic(ctx, photos) {
  const sizes = ["(max-width: 760px) 34vw, 24rem", "(max-width: 760px) 34vw, 19rem", "(max-width: 760px) 34vw, 19rem"];
  return html`<div class="evlist-mosaic">${photos.slice(0, 3).map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: sizes[i] })}</div>`)}</div>`;
}

function card(ctx, r, { past = false } = {}) {
  const p = dateParts(r.date, ctx.t);
  const when = timeRange(r.start, r.end, ctx.t);
  const today = runsOn(r, ctx.today);
  const days = dayRange(r, ctx.t);
  const cls = ["evcard", r.media ? "has-photo" : null, past ? "is-recent" : null].filter(Boolean).join(" ");
  const hid = `ev-${r.event}`;
  return html`<li${attrs({ class: cls, "data-starts": past ? null : r.startsAt, "data-ends": past ? null : r.endsAt, "data-date": past ? null : r.date, "data-until": past || !days ? null : r.until })} aria-labelledby="${hid}">
    <div class="evcard-date" aria-hidden="true"><span class="dow">${p.dow}</span><span class="dom">${p.dom}</span><span class="mon">${p.mon}</span>${past ? "" : html`<span class="evcard-time">${when}</span>`}${today && !past ? html`<span class="today-tag">${ctx.t("schedule.today")}</span>` : ""}</div>
    ${r.media ? html`<div class="evcard-photo">${picture(ctx, r.media, { sizes: "(max-width: 760px) calc(100vw - 2rem), 13rem" })}</div>` : ""}
    <div class="evcard-body">
      <h3 id="${hid}">${r.short}<span class="sr-only">, ${days ? days.long : `${p.dowLong}, ${p.monLong} ${p.dom}`}${past ? "" : `, ${when}`}</span></h3>
      ${days ? html`<p class="evcard-days" aria-hidden="true">${days.short}</p>` : ""}
      ${r.tagline ? html`<p class="evcard-tag">${r.tagline}</p>` : ""}
      ${r.place && !past ? html`<p class="evcard-where">${icon("pin")}<span><strong>${r.place.name}</strong>${r.place.detail ? ` · ${r.place.detail}` : ""}</span></p>` : ""}
      ${r.note && !past ? html`<p class="evcard-note">${r.note}</p>` : ""}
      ${past ? "" : html`<div class="evcard-row">
        <a class="evcard-cal" href="${calendarHref(ctx, r.event)}">${icon("calendar")}<span class="sr-only">${ctx.t("events.calendar")}: ${r.short}</span></a>
        ${r.place?.href ? link(ctx, r.place.href, html`${ctx.t("schedule.dropIn")}<span class="sr-only">: ${r.short}</span>`, { class: "drop", icon: "pin" }) : html`<span class="evcard-chip">${icon("pin")}${ctx.t("schedule.dropIn")}</span>`}
        <span class="ended-tag">${ctx.t("schedule.ended")}</span>
      </div>`}
    </div>
  </li>`;
}

export default {
  type: "events",
  label: "Event cards",
  fields: { title: "text!", heading: "choice:h1|h2", lead: "text", note: "text", source: "source!", program: "choice:peer|craft|workshops|other", series: "series", count: "number", recent: "number", upcomingTitle: "text", recentTitle: "text", suggest: "link", photos: "media[]", show: "choice:all|upcoming|recent", skip: "number" },
  data: ["events"],
  client: "schedule.js",
  refresh: true,
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const src = ctx.data.events;
    if (!src) throw new Error(`${b.id}: no event source "${b.source}"`);
    const show = b.show || "all";
    const skip = b.skip || 0;
    const next = show === "recent" ? [] : nextDated(src, ctx.today, (b.count || 6) + skip, { program: b.program, series: b.series }).slice(skip);
    const last = show === "upcoming" || b.recent === 0 ? [] : lastDated(src, ctx.today, b.recent || 4, { program: b.program, series: b.series });
    if ((show === "recent" && !last.length) || (show === "upcoming" && !next.length && skip)) return html`<section data-block="${b.id}" hidden></section>`;
    const h = b.heading === "h1" ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`;
    /* A split list is titled by its block; the whole list titles each half under the block's heading. */
    const sub = (x, id) => (show !== "all" ? "" : b.heading === "h1" ? html`<h2 class="evlist-title" id="${id}">${x}</h2>` : html`<h3 class="evlist-title" id="${id}">${x}</h3>`);
    const label = (id) => (show !== "all" ? `${b.id}-h` : id);
    const photos = b.photos || [];
    const cls = ["events-block band", show !== "all" ? `is-${show}` : null, photos.length ? "has-mosaic" : null].filter(Boolean).join(" ");
    return html`<section${attrs({ class: cls, id: b.anchor || b.id, "aria-labelledby": `${b.id}-h`, "data-block": b.id, "data-program": b.program })}><div class="wrap">
  <header class="evlist-head">
    <div class="evlist-words">
      ${h}
      ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
      ${b.note ? html`<p class="evlist-note">${b.note}</p>` : ""}
    </div>
    ${photos.length ? mosaic(ctx, photos) : ""}
  </header>
  ${show === "recent" ? "" : next.length ? html`${sub(b.upcomingTitle || ctx.t("schedule.laterTitle"), `${b.id}-next`)}<ol class="evcards" aria-labelledby="${label(`${b.id}-next`)}">${next.map((r) => card(ctx, r))}</ol>` : html`<p class="evlist-none">${ctx.t("events.none")}</p>`}
  ${last.length ? html`${sub(b.recentTitle || ctx.t("events.recentTitle"), `${b.id}-last`)}<ol class="evcards evcards--recent" aria-labelledby="${label(`${b.id}-last`)}">${last.map((r) => shot(ctx, r))}</ol>` : ""}
  ${b.suggest ? html`<p class="evlist-foot">${go(ctx, b.suggest.href, b.suggest.label, b.suggest.icon || "bulb")}</p>` : ""}
</div></section>`;
  },
};
