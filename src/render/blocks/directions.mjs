import { timeNotice, unavailableEvents } from "../event-status.mjs";
/* One room's page leads with its address and map, followed by its photo and the way in as a
   route — numbered stops on a dotted line, each with its own
   photo when there is one — ending at the room, with a photo of the arrival when the room has one.
   Address-only rooms omit the route while retaining event status and access help. The room's
   record (content/places/) and the text registry hold every word; the build makes this page for every published room (src/render/places.mjs). Another page
   can carry the same directions as a section (heading h2, with its own title): the peer support
   groups page does, for the Hub. The next events sit in their own part (data-live), which schedule.js
   swaps alone when Connect's list changes between publishes. */

import { html } from "../html.mjs";
import { link, go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";
import { rowsBetween, dateParts, timeRange } from "../events.mjs";
import { eventState } from "../../shared/event-state.mjs";

const mapHref = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export default {
  type: "directions",
  label: "Directions to a room",
  fields: { place: "place!", heading: "choice:h1|h2", title: "text" },
  data: ["places", "events", "eventsState"],
  refresh: true,
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const p = ctx.data.places?.[b.place];
    if (!p) throw new Error(`${b.id}: no room "${b.place}"`);
    const src = ctx.data.events;
    const unavailable = !src || !!ctx.data.eventsState?.stale;
    // The next three things held here in the coming three weeks, weekly groups included.
    const next = !unavailable ? rowsBetween(src, ctx.today, 21).filter((r) => r.placeId === p.id && eventState(r, ctx.now) !== "ended").slice(0, 3) : [];
    const page = b.heading !== "h2";
    const steps = p.steps || [];
    const body = page || steps.length || p.note || next.length || unavailable;
    const cls = ["directions band", page ? "" : "is-section", body ? "" : "is-short"].filter(Boolean).join(" ");
    return html`<section class="${cls}" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="${p.photo ? "dir-side has-photo" : "dir-side"}">
    ${page ? html`<p class="crumb"><a class="go go--back" href="${ctx.link("/directions/").href}">${icon("back", "go-ic")}<span class="go-label">${ctx.t("directions.all")}</span></a></p>` : ""}
    <header class="dir-head">
      ${page ? html`<p class="dir-kind">${p.kind === "hub" ? ctx.t("directions.hub") : ctx.t("directions.eventRoom")}</p>` : ""}
      ${page ? html`<h1 id="${b.id}-h">${p.name}</h1>` : html`<h2 id="${b.id}-h">${b.title || p.name}</h2>${b.title ? html`<p class="dir-name">${p.name}</p>` : ""}`}
      ${p.building || p.where ? html`<p class="dir-where">${[p.building, p.where].filter(Boolean).join(" · ")}</p>` : ""}
      <address>${p.address}</address>
      <div class="dir-actions">${link(ctx, mapHref(p.address), ctx.t("directions.map"), { class: "btn", icon: "pin" })}${(p.links || []).map((l) => go(ctx, l.href, l.label, "out", "go--light"))}</div>
    </header>
    ${p.photo ? html`<div class="dir-photo photo">${picture(ctx, p.photo, { sizes: "(max-width: 860px) calc(100vw - 2rem), 23rem", eager: page })}</div>` : ""}
    ${page ? html`<nav class="dir-jumps" aria-label="${ctx.t("directions.onPage")}">
      ${steps.length ? html`<a href="#${b.id}-route">${ctx.t("directions.stepsTitle")}</a>` : ""}
      <a href="#${b.id}-next">${ctx.t("directions.nextHere")}</a>
      <a href="#${b.id}-access">${ctx.t("directions.accessTitle")}</a>
    </nav>` : ""}
  </div>
  ${body ? html`<div class="dir-body">
    ${steps.length ? html`${page ? html`<h2 class="dir-title" id="${b.id}-route">${ctx.t("directions.stepsTitle")}</h2>` : html`<h3 class="dir-title">${ctx.t("directions.stepsTitle")}</h3>`}
    <ol class="dir-steps">${steps.map((s) => html`<li><p>${s.text}</p>${s.photo ? html`<div class="photo">${picture(ctx, s.photo, { sizes: "(max-width: 860px) calc(100vw - 5rem), 26rem" })}</div>` : ""}</li>`)}</ol>
    <p class="dir-arrive">${icon("pin")}<span>${ctx.t("directions.arrive", { place: p.name })}</span></p>
    ${p.arrivePhoto ? html`<div class="dir-arrive-photo photo">${picture(ctx, p.arrivePhoto, { sizes: "(max-width: 860px) calc(100vw - 5rem), 26rem" })}</div>` : ""}` : ""}
    ${p.note ? html`<p class="dir-note">${p.note}</p>` : ""}
    <div class="dir-next" id="${b.id}-next" data-live="next">${page || next.length || unavailable ? html`${page ? html`<h2 class="dir-title">${ctx.t("directions.nextHere")}</h2>` : html`<h3 class="dir-title">${ctx.t("directions.nextHere")}</h3>`}` : ""}${unavailable ? unavailableEvents(ctx) : next.length ? html`<ul class="next-list">${next.map((r) => {
      const d = dateParts(r.date, ctx.t);
      return html`<li><div class="dateblock" aria-hidden="true"><span class="dow">${d.dow}</span><span class="dom">${d.dom}</span><span class="mon">${d.mon}</span></div><div><strong>${r.href && !ctx.here(r.href) ? link(ctx, r.href, r.title) : r.title}</strong><span><span class="sr-only">${d.dowLong}, ${d.monLong} ${d.dom}, </span>${timeRange(r.start, r.end, ctx.t)}</span>${timeNotice(ctx, r)}</div></li>`;
    })}</ul>` : page ? html`<p>${ctx.t("directions.noEvents")}</p>${go(ctx, "/about/what-we-do/", ctx.t("directions.programs"), "arrow")}` : ""}</div>
    ${page ? html`<section class="dir-access" aria-labelledby="${b.id}-access">
      <h2 class="dir-title" id="${b.id}-access">${ctx.t("directions.accessTitle")}</h2>
      <p>${ctx.t("directions.accessBody")}</p>
      ${go(ctx, "mailto:accessibility@badgersupports.org", ctx.t("directions.accessContact"), "mail")}
    </section>` : ""}
  </div>` : ""}
</div></section>`;
  },
};
