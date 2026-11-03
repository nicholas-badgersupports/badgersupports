/* A row of photo cards, each its own small poster: a photo of people, a title in the display face,
   one or two lines in bold (a time, a slogan) and one quieter line, then at most one link. Three
   variants, so a page that uses two does not show the same row twice:
     days        — portrait photos, four a row: one card a day, its times in bold (the peer support
                   groups' week, as the live page lays it out)
     activities  — square photos, three a row: what happens in a group
     whole       — each picture at its own shape, never cropped, two a row: a printed card or a slide
                   whose words must stay whole
   A card without a photo shows its icon, when it names one, large on the red tint; no other photo
   stands in for a missing one. */

import { html } from "../html.mjs";
import { go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { rowsBetween, groupByDate, dateParts, timeRange, weekday } from "../events.mjs";
import { picture } from "../media.mjs";
import { eventClass, eventTags } from "../event-status.mjs";

export default {
  type: "cards",
  label: "Photo cards",
  fields: { variant: "choice:days|activities|whole!", title: "text!", lead: "text", items: "cards!", links: "link[]", source: "source", program: "choice:peer|craft|workshops|other" },
  data: ["events"],
  refresh: b => b.variant === "days" && b.source === "events",
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    if (b.variant === "days" && b.source === "events") {
      const groups = groupByDate(rowsBetween(ctx.data.events, ctx.today, 7).filter(r => r.program === (b.program || "peer")));
      return html`<section class="cards cards--days band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
        <h2 id="${b.id}-h">${b.title}</h2>${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
        ${groups.length ? html`<ul class="card-list">${groups.map(({ date, items }) => {
          const day = dateParts(date, ctx.t);
          const template = (b.items || []).find(it => it.id === ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][weekday(date)]);
          const photo = template?.photo;
          return html`<li class="${photo ? "card has-photo" : "card"}" id="day-${date}">
            ${photo ? html`<div class="photo">${picture(ctx, photo, { sizes: "(max-width: 560px) calc(100vw - 2rem), (max-width: 960px) calc(50vw - 2rem), 17rem" })}</div>` : html`<div class="card-mark">${icon("calendar")}</div>`}
            <div class="card-words"><h3>${template?.title || day.dowLong}</h3><p class="card-text">${day.monLong} ${day.dom}</p>
              ${items.map(r => html`<div class="${eventClass("ev", r, ctx.now)}" data-starts="${r.startsAt}" data-ends="${r.endsAt}" data-date="${r.date}">
                <p class="card-line ev-time">${timeRange(r.start, r.end, ctx.t)}${eventTags(ctx, r)}</p>
                ${r.place ? html`<p class="card-text">${r.place.name}${r.place.detail ? html`<span class="where-detail">${r.place.detail}</span>` : ""}</p>` : ""}
                ${r.place?.href ? go(ctx, r.place.href, ctx.t("schedule.directions"), "pin") : ""}
              </div>`)}
            </div></li>`;
        })}</ul>` : html`<p class="evlist-none">${ctx.t("schedule.weekEmpty")}</p><p>${go(ctx, "/join/email-list/", ctx.t("schedule.updates"))}</p>`}
        ${b.links?.length ? html`<ul class="more-links">${b.links.map(l => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}
      </div></section>`;
    }
    const sizes = `(max-width: 560px) calc(100vw - 2rem), (max-width: 960px) calc(50vw - 2rem), ${{ days: "17rem", whole: "36rem" }[b.variant] || "23rem"}`;
    return html`<section class="cards cards--${b.variant} band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  <ul class="card-list">${b.items.map((it) => html`<li class="${it.photo ? "card has-photo" : "card"}" id="${it.id}">
    ${it.photo ? html`<div class="photo">${picture(ctx, it.photo, { sizes })}</div>` : it.icon ? html`<div class="card-mark">${icon(it.icon)}</div>` : ""}
    <div class="card-words">
      <h3>${it.title}</h3>
      ${(it.lines || []).map((l) => html`<p class="card-line">${l}</p>`)}
      ${it.text ? html`<p class="card-text">${it.text}</p>` : ""}
      ${it.link ? go(ctx, it.link.href, it.link.label, it.link.icon || (ctx.link(it.link.href).external ? "out" : "arrow")) : ""}
    </div>
  </li>`)}</ul>
  ${b.links?.length ? html`<ul class="more-links">${b.links.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}
</div></section>`;
  },
};

/* Why a cards block cannot be published, as a list of reasons. */
export function cardProblems(b) {
  const out = [];
  const ids = new Set();
  for (const [i, it] of (b.items || []).entries()) {
    const at = `${b.id}: items[${i}]`;
    if (!it || typeof it !== "object") { out.push(`${at}: a card is an object`); continue; }
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(it.id || "")) out.push(`${at}: id must be lower-case letters, digits and hyphens`);
    else if (ids.has(it.id)) out.push(`${at}: duplicate id "${it.id}"`);
    ids.add(it.id);
    if (typeof it.title !== "string" || !it.title.trim()) out.push(`${at}: a card needs a title`);
    if (it.lines != null && !(Array.isArray(it.lines) && it.lines.every((l) => typeof l === "string"))) out.push(`${at}: lines are a list of text`);
    if (it.link != null && !(typeof it.link.href === "string" && typeof it.link.label === "string")) out.push(`${at}: a link has a label and an address`);
  }
  if (!(b.items || []).length) out.push(`${b.id}: a cards block needs at least one card`);
  return out;
}
