/* Where to find us. The place people can find Badger Supports (a room whose kind is "hub": today
   only the Student Mental Health Hub) leads, as a large red card with its photo; every other
   published room is an event room, listed under it as tickets: the room on the left, a torn-off
   stub on the right, the whole ticket a link to the room's own page. Both lists are the rooms
   themselves (content/places/), so a room an editor adds appears here with no page edit. */

import { html } from "../html.mjs";
import { link, go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";
import { placePath } from "../places.mjs";

const where = (p) => [p.building, p.where].filter(Boolean).join(" · ");

export default {
  type: "places",
  label: "List of rooms",
  fields: { title: "text!", heading: "choice:h1|h2", roomsTitle: "text" },
  data: ["places"],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const rooms = Object.values(ctx.data.places || {}).filter((p) => p.published).sort((a, c) => ((a.building || "~") + a.name).localeCompare((c.building || "~") + c.name));
    const hubs = rooms.filter((p) => p.kind === "hub");
    const others = rooms.filter((p) => p.kind !== "hub");
    const h = b.heading === "h1" ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`;
    const sub = b.heading === "h1" ? (x, id) => html`<h2 id="${id}">${x}</h2>` : (x, id) => html`<h3 id="${id}">${x}</h3>`;
    return html`<section class="places band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="places-head">${h}<span class="places-route" aria-hidden="true">${icon("pin")}</span></div>
  ${hubs.map((p) => html`<article class="${p.photo ? "hubcard has-photo" : "hubcard"}" aria-labelledby="${b.id}-${p.id}">
    <div class="hubcard-text">
      ${where(p) ? html`<p class="hubcard-where">${where(p)}</p>` : ""}
      ${sub(p.name, `${b.id}-${p.id}`)}
      <p class="hubcard-addr">${p.address}</p>
      ${go(ctx, placePath(p.id), ctx.t("directions.ticket"), "pin", "go--light")}
    </div>
    ${p.photo ? html`<div class="hubcard-photo">${picture(ctx, p.photo, { sizes: "(max-width: 860px) calc(100vw - 2rem), 34rem", eager: true })}</div>` : ""}
  </article>`)}
  ${others.length ? html`${sub(b.roomsTitle || ctx.t("directions.eventRooms"), `${b.id}-rooms`)}
  <ul class="tickets" aria-labelledby="${b.id}-rooms">${others.map((p) => html`<li class="ticket">${link(ctx, placePath(p.id), html`<span class="ticket-main"><span class="ticket-where">${where(p)}</span><strong class="ticket-name">${p.name}</strong><span class="ticket-addr">${p.address}</span></span><span class="ticket-stub">${icon("pin")}<span>${ctx.t("directions.ticket")}</span></span>`, { class: "ticket-link" })}</li>`)}</ul>` : ""}
</div></section>`;
  },
};
