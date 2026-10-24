/* Ways to join, as doors: one tile per way in, the whole tile a link, its icon moving when it is
   pointed at. The primary way in (volunteering) is the red door. A row tied to a form shows that
   form's real state: a closed application says it is closed, from the same switch the intake API
   enforces, and its tile still opens the page about it. A compact list (the homepage's) shows each
   door's name and action only; on its own page (heading h1) the doors stand on a red band. Photos,
   when the block has them, are a row of up to three people beside the heading. A door may carry
   "more": what the live page said about that way in (the hiring steps, what volunteers do), shown
   under the doors as one panel each, never on the compact list, with the live page's photo of that
   way in on top when it has one. */

import { html, attrs, breakAtSign } from "../html.mjs";
import { link, go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";

export default {
  type: "involve",
  label: "Get involved doors",
  fields: { title: "text!", heading: "choice:h1|h2", compact: "boolean", photos: "media[]", items: "rows!" },
  data: ["forms"],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const page = b.heading === "h1";
    const photos = (b.photos || []).slice(0, 3);
    const cls = ["involve band", page ? "is-page" : "", b.compact ? "is-compact" : "", photos.length ? "has-photos" : ""].filter(Boolean).join(" ");
    const more = b.compact ? [] : b.items.filter((it) => it.more);
    return html`<section class="${cls}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="involve-head">
    ${page ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`}
    ${photos.length ? html`<div class="involve-photos">${photos.map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: "(max-width: 960px) calc(33vw - 1.5rem), 11rem", eager: page && i === 0 })}</div>`)}</div>` : ""}
  </div>
  <ul class="doors">${b.items.map((it) => {
    const form = it.form ? ctx.data.forms?.[it.form] : null;
    const closed = form && form.state === "closed" && !form.elsewhere;
    const away = it.link && ctx.link(it.link.href).external;
    const inner = html`<span class="door-ic">${icon(it.icon || "arrow")}</span><span class="door-body">
      <span class="door-title">${it.title}</span>
      ${closed ? html`<span class="chip chip--closed">${ctx.t("involve.closed")}</span>` : ""}
      ${!b.compact && it.text ? html`<span class="door-text">${it.text}</span>` : ""}
      ${!b.compact && closed && form.closedMessage ? html`<span class="door-text door-closed">${breakAtSign(form.closedMessage)}</span>` : ""}
      ${it.link ? html`<span class="door-go"><span class="go-label">${it.link.label}</span>${icon(away ? "out" : "arrow", "go-ic")}</span>` : ""}`;
    const door = it.link ? link(ctx, it.link.href, inner, { class: "door-link" }) : html`<div class="door-link">${inner}</div>`;
    return html`<li${attrs({ class: it.primary && !closed ? "door is-primary" : "door", "data-program": ctx.programOf(it.link?.href) })}>${door}</li>`;
  })}</ul>
  ${more.length ? html`<div class="door-more">${more.map(moreHtml(ctx))}</div>` : ""}
</div></section>`;
  },
};

/* One panel: its photo, its title, a lead sentence, then each list under its own label. A numbered list counts
   steps in red circles; an unnumbered one is ticked. */
const moreHtml = (ctx) => (it) => {
  const m = it.more;
  return html`<section class="${m.photo ? "more has-photo" : "more"}" id="${m.anchor || `${it.id}-more`}" aria-labelledby="${it.id}-more-h">
    ${m.photo ? html`<div class="photo">${picture(ctx, m.photo, { sizes: "(max-width: 860px) calc(100vw - 4.5rem), 34rem" })}</div>` : ""}
    <h2 id="${it.id}-more-h">${m.title || it.title}</h2>
    ${m.lead ? html`<p class="more-lead">${m.lead}</p>` : ""}
    ${(m.lists || []).map((l) => html`${l.label ? html`<p class="more-label">${l.label}</p>` : ""}${l.ordered
      ? html`<ol class="more-steps">${l.items.map((x) => html`<li><span>${x}</span></li>`)}</ol>`
      : html`<ul class="more-list">${l.items.map((x) => html`<li>${icon("check")}<span>${x}</span></li>`)}</ul>`}`)}
    ${m.after ? html`<p class="more-after">${m.after}</p>` : ""}
    ${m.link ? go(ctx, m.link.href, m.link.label, ctx.link(m.link.href).external ? "out" : "arrow") : ""}
  </section>`;
};
