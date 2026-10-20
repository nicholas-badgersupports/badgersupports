/* The top of a program's page: the name on the red ground, one line on what it is, and the next
   event as a card that carries everything needed to come — the date, the time, the room — with the
   page's one big button, Drop in, which leads to the room's directions (a room with no directions
   page yet keeps the words, unlinked). Adding it to a calendar sits beside it as a quieter pill.
   Up to three photos of people at past events stand beside it, one large and two small.

   The card is an event card (class `evcard`, the same data attributes), so schedule.js marks it
   Today, and Ended once it is over, exactly as it marks the cards in a list. With nothing coming up,
   the card says so. Built for the craft nights page; any program's page can use it. */

import { html, attrs } from "../html.mjs";
import { link } from "../context.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";
import { icsPath } from "../ics.mjs";
import { nextDated, dateParts, timeRange } from "../events.mjs";

function feature(ctx, b, r) {
  const p = dateParts(r.date, ctx.t);
  const when = timeRange(r.start, r.end, ctx.t);
  const hid = `${b.id}-next`;
  return html`<article${attrs({ class: "evcard is-feature", "data-starts": r.startsAt, "data-ends": r.endsAt, "data-date": r.date, "aria-labelledby": hid })}>
    <div class="evcard-date" aria-hidden="true"><span class="dow">${p.dow}</span><span class="dom">${p.dom}</span><span class="mon">${p.mon}</span><span class="evcard-time">${when}</span>${r.date === ctx.today ? html`<span class="today-tag">${ctx.t("schedule.today")}</span>` : ""}</div>
    <div class="evcard-body">
      <p class="feature-label">${b.nextLabel || ctx.t("events.next")}</p>
      <h2 id="${hid}">${r.short}<span class="sr-only">, ${p.dowLong}, ${p.monLong} ${p.dom}, ${when}</span></h2>
      ${r.tagline ? html`<p class="evcard-tag">${r.tagline}</p>` : ""}
      ${r.place ? html`<p class="evcard-where">${icon("pin")}<span><strong>${r.place.name}</strong>${r.place.detail ? ` · ${r.place.detail}` : ""}</span></p>` : ""}
      ${r.note ? html`<p class="evcard-note">${r.note}</p>` : ""}
      <div class="feature-actions">
        ${r.place?.href ? link(ctx, r.place.href, html`${ctx.t("schedule.dropIn")}<span class="sr-only">: ${r.short}</span>`, { class: "btn btn--big", icon: "pin" }) : html`<span class="evcard-chip">${icon("pin")}${ctx.t("schedule.dropIn")}</span>`}
        <a class="go" href="${icsPath(r.event)}"><span class="go-label">${ctx.t("events.calendar")}<span class="sr-only">: ${r.short}</span></span>${icon("calendar", "go-ic")}</a>
        <span class="ended-tag">${ctx.t("schedule.ended")}</span>
      </div>
    </div>
  </article>`;
}

export default {
  type: "eventhero",
  label: "Event hero",
  fields: { title: "text!", lead: "text", nextLabel: "text", source: "source!", program: "choice:peer|craft|workshops|other", photos: "media[]" },
  data: ["events"],
  client: "schedule.js",
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const src = ctx.data.events;
    if (!src) throw new Error(`${b.id}: no event source "${b.source}"`);
    const [next] = nextDated(src, ctx.today, 1, b.program || null);
    const photos = (b.photos || []).slice(0, 3);
    const sizes = ["(max-width: 860px) 46vw, 24rem", "(max-width: 860px) 23vw, 14rem", "(max-width: 860px) 23vw, 14rem"];
    return html`<section class="${["eventhero", photos.length ? "has-photos" : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="eventhero-main">
    <h1 id="${b.id}-h">${b.title}</h1>
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${next ? feature(ctx, b, next) : html`<p class="evlist-none">${ctx.t("events.none")}</p>`}
  </div>
  ${photos.length ? html`<div class="eventhero-photos">${photos.map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: sizes[i], eager: i === 0 })}</div>`)}</div>` : ""}
</div></section>`;
  },
};
