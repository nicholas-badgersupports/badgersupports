/* A program section. Three variants so the three programs do not read as three identical cards:
 *   feature  — a large photo and the program's facts as a timetable (peer support groups)
 *   gallery  — the next dates, and a swipeable strip of photos (craft nights)
 *   topics   — a numbered list of what can be requested, and one request button (workshops)
 * Each wears its program's colour (data-program; src/styles/tokens.css): peer support groups green,
 * craft nights purple, workshops the brand red (owner, 23 Oct 2026). A gallery listing the next dates
 * has them in a part of their own (data-live), which schedule.js swaps alone between publishes, so the
 * photo strip beside it is left as it is.
 */

import { html, attrs } from "../html.mjs";
import { link, go } from "../context.mjs";
import { picture } from "../media.mjs";
import { nextDated, dateParts, timeRange } from "../events.mjs";
import { reel } from "./embed.mjs";

const ARROW_L = html`<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW_R = html`<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const paras = (body) => (Array.isArray(body) ? body : body ? [body] : []).map((p) => html`<p>${p}</p>`);
const links = (ctx, list) => (list?.length ? html`<ul class="more-links">${list.map((l) => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : "");

const heading = (b) => (b.heading === "h1" ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`);

/* feature: a big photo (or, on a program's own page, its Instagram video) and the facts */
function feature(b, ctx) {
  // A photo leads; a video follows the words, so the page's heading comes first.
  const media = b.embed ? html`<div class="program-reel">${reel(ctx, b.embed)}</div>` : html`<div class="photo">${picture(ctx, b.photos[0], { sizes: "(max-width: 860px) calc(100vw - 2rem), 40rem", eager: b.heading === "h1" })}</div>`;
  return html`<div class="wrap">
  ${b.embed ? "" : media}
  <div>
    ${heading(b)}
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${paras(b.body)}
    ${b.facts?.length ? html`<dl class="facts">${b.facts.map((f) => html`<dt>${f.term}</dt><dd>${f.text}</dd>`)}</dl>` : ""}
    ${b.list ? html`<div class="talk"><h3>${b.list.label}</h3><ul>${b.list.items.map((i) => html`<li><strong>${i.term}:</strong> ${i.text}</li>`)}</ul></div>` : ""}
    ${b.note ? html`<p class="not-therapy">${b.note}</p>` : ""}
    ${links(ctx, b.links)}
  </div>
  ${b.embed ? media : ""}
</div>`;
}

function gallery(b, ctx) {
  const src = ctx.data.events;
  const next = b.upcoming && src ? nextDated(src, ctx.today, b.upcoming.count || 2, b.upcoming.program) : [];
  return html`<div class="wrap">
  <div>
    ${heading(b)}
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${paras(b.body)}
    <div data-live="next">${next.length ? html`<h3 class="sr-only">${b.upcoming.label || ctx.t("program.upcomingLabel")}</h3><ul class="next-list">${next.map((r) => {
      const p = dateParts(r.date, ctx.t);
      return html`<li${attrs({ "data-starts": r.startsAt, "data-ends": r.endsAt })}><div class="dateblock" aria-hidden="true"><span class="dow">${p.dow}</span><span class="dom">${p.dom}</span><span class="mon">${p.mon}</span></div><div><strong>${r.short}</strong><span><span class="sr-only">${p.dowLong}, ${p.monLong} ${p.dom}, </span>${timeRange(r.start, r.end, ctx.t)}${r.place ? ` · ${r.place.name}` : ""}</span></div></li>`;
    })}</ul>` : ""}</div>
    ${links(ctx, b.links)}
  </div>
  <div class="strip" data-strip>
    <ul class="strip-track" tabindex="0" aria-label="${ctx.t("strip.trackLabel", { title: b.title })}">${b.photos.map((id) => html`<li><div class="photo">${picture(ctx, id, { sizes: "(max-width: 860px) 80vw, 30rem" })}</div></li>`)}</ul>
    <div class="strip-controls"><button type="button" data-strip-prev aria-label="${ctx.t("strip.prev")}">${ARROW_L}</button><button type="button" data-strip-next aria-label="${ctx.t("strip.next")}">${ARROW_R}</button><span class="strip-count" data-strip-count aria-live="polite"></span></div>
  </div>
</div>`;
}

function topics(b, ctx) {
  return html`<div class="wrap">
  <header>
    ${heading(b)}
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${paras(b.body)}
  </header>
  ${b.photos?.length ? html`<div class="photo">${picture(ctx, b.photos[0], { sizes: "(max-width: 860px) calc(100vw - 2rem), 22rem" })}</div>` : ""}
  <ol class="topics">${b.topics.map((t) => html`<li><div><strong>${t.href ? link(ctx, t.href, t.term) : t.term}</strong>${t.text ? html`<p>${t.text}</p>` : ""}</div></li>`)}</ol>
  <div class="topics-foot">${b.primary ? link(ctx, b.primary.href, b.primary.label, { class: "btn", icon: "arrow" }) : ""}${(b.links || []).map((l) => go(ctx, l.href, l.label, l.icon || "arrow"))}</div>
</div>`;
}

const VARIANTS = { feature, gallery, topics };

export default {
  type: "program",
  label: "Program section",
  fields: { variant: "choice:feature|gallery|topics!", program: "choice:peer|craft|workshops!", heading: "choice:h1|h2", title: "text!", lead: "text", body: "paragraphs", list: "termlist", facts: "termlist", note: "text", photos: "media[]", embed: "embed", links: "link[]", upcoming: "eventquery", topics: "termlist", primary: "link" },
  data: ["events"],
  client: ["strip.js", "embed.js"],
  refresh: (b) => !!b.upcoming,
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const v = VARIANTS[b.variant];
    if (!v) throw new Error(`${b.id}: unknown program variant ${b.variant}`);
    return html`<section class="program program--${b.variant}${b.heading === "h1" ? " is-page" : ""} band" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}" data-program="${b.program}">${v(b, ctx)}</section>`;
  },
};
