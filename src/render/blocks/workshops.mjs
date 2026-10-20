/* Try a piece of each workshop. One tab per workshop; each holds a small activity taken from that
 * workshop's own slides (Canva, read 2026-10-20) beside what the full workshop covers and the way
 * to request it. Four kinds of activity:
 *
 *   network — the support-network map: four circles round "you"; open one to see what that
 *             kind of support is and who gives it
 *   bingo   — a self-care bingo card: nine squares to tick, and a line says so
 *   choose  — a scenario and three things to say; each choice shows how it lands
 *   flip    — terms to know, as cards that turn over
 *
 * Every word is the block's content. Without JavaScript the tabs are links to each workshop, all
 * four show one under another, and every activity still works: the map's circles jump to their
 * lists, the bingo squares are checkboxes, the choices reveal their verdicts in CSS, and the cards
 * are <details>. src/client/workshops.js adds the tabs, one-at-a-time circles, the bingo line and
 * announcements. Nothing anyone ticks or chooses is kept or sent. Photos from past workshops, when
 * the block has them, sit beside its heading: one wide, one narrow.
 */

import { html } from "../html.mjs";
import { link, go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";

const KINDS = ["network", "bingo", "choose", "flip"];

function network(w, a, ctx) {
  return html`<div class="act act-network" data-act="network">
  <p class="act-prompt">${a.prompt}</p>
  <div class="net-wrap">
    <div class="net">
      <ul class="net-areas">${a.areas.map((ar, i) => html`<li class="net-area net-${i + 1}"><a class="net-btn" href="#${w.id}-${ar.id}" data-area="${ar.id}"><span>${ar.label}</span></a></li>`)}</ul>
      ${a.centre ? html`<span class="net-you" aria-hidden="true">${a.centre}</span>` : ""}
    </div>
    <div class="net-detail">${a.areas.map((ar, i) => html`<section class="net-panel net-${i + 1}" id="${w.id}-${ar.id}" data-area-panel="${ar.id}" aria-labelledby="${w.id}-${ar.id}-h">
      <h4 id="${w.id}-${ar.id}-h">${ar.label}</h4>
      ${ar.text ? html`<p class="net-text">${ar.text}</p>` : ""}
      ${ar.ways?.length ? html`<ul class="net-ways">${ar.ways.map((x) => html`<li>${x}</li>`)}</ul>` : ""}
      ${ar.examples ? html`<p class="net-ex">${ctx.t("workshops.examples", { who: ar.examples })}</p>` : ""}
    </section>`)}</div>
  </div>
</div>`;
}

function bingo(w, a) {
  return html`<fieldset class="act act-bingo" data-act="bingo">
  <legend class="act-prompt">${a.prompt}</legend>
  <div class="bingo-card">${a.cells.map((c, i) => html`<label class="bingo-cell"><input type="checkbox" name="${w.id}-bingo" value="${i}"><span>${c}</span></label>`)}</div>
  <p class="bingo-win" role="status" data-win="${a.win}"></p>
</fieldset>`;
}

function choose(w, a) {
  return html`<div class="act act-choose" data-act="choose">
  ${a.scenario ? html`<p class="act-scenario">${a.scenario}</p>` : ""}
  <fieldset>
    <legend class="act-prompt">${a.question}</legend>
    <div class="says">${a.options.map((o) => html`<label class="say say--${o.tone || "neutral"}"><input type="radio" name="${w.id}-say" value="${o.id}"><span class="say-text">${o.text}</span><span class="say-verdict" id="${w.id}-${o.id}-v"><strong>${o.verdict}</strong>${o.why ? html` ${o.why}` : ""}</span></label>`)}</div>
  </fieldset>
  <p class="sr-only" role="status" data-say-status></p>
</div>`;
}

function flip(w, a) {
  return html`<div class="act act-flip" data-act="flip">
  <p class="act-prompt">${a.prompt}</p>
  <div class="flips">${a.cards.map((c) => html`<details class="flip" id="${w.id}-${c.id}"><summary><span class="flip-term">${c.term}</span>${icon("plus")}</summary><p class="flip-back">${c.text}</p></details>`)}</div>
  ${a.note ? html`<p class="act-note">${a.note}</p>` : ""}
</div>`;
}

const ACTIVITIES = { network, bingo, choose, flip };

/* Problems with one workshops block's items; the build refuses the page with any. */
export function workshopProblems(b) {
  const out = [];
  const ids = new Set();
  for (const w of b.items || []) {
    const at = `${b.id}.${w.id || "?"}`;
    if (!/^w-[a-z0-9-]{2,40}$/.test(w.id || "")) out.push(`${at}: id must look like w-something`);
    if (ids.has(w.id)) out.push(`${at}: duplicate id`);
    ids.add(w.id);
    if (!w.title || !w.tab) out.push(`${at}: needs a title and a short tab name`);
    const a = w.activity || {};
    if (!KINDS.includes(a.kind)) { out.push(`${at}: activity kind must be one of ${KINDS.join(", ")}`); continue; }
    if (a.kind === "network" && (!(a.areas?.length >= 2 && a.areas.length <= 4) || a.areas.some((ar) => !/^a-[a-z0-9-]+$/.test(ar.id || "") || !ar.label || !(ar.text || ar.ways?.length)))) out.push(`${at}: a network needs two to four areas, each with an id like a-something, a label, and what that support is or the ways it shows up`);
    if (a.kind === "bingo" && (a.cells?.length !== 9 || !a.win)) out.push(`${at}: a bingo card needs exactly nine squares and a line message`);
    if (a.kind === "choose" && (!a.question || !(a.options?.length >= 2) || a.options.some((o) => !/^o-[a-z0-9-]+$/.test(o.id || "") || !o.text || !o.verdict))) out.push(`${at}: a choice needs a question and at least two options, each with an id like o-something, its words and a verdict`);
    if (a.kind === "flip" && (!a.cards?.length || a.cards.some((c) => !/^t-[a-z0-9-]+$/.test(c.id || "") || !c.term || !c.text))) out.push(`${at}: flip cards each need an id like t-something, a term and its meaning`);
  }
  return out;
}

export default {
  type: "workshops",
  label: "Workshop previews",
  fields: { title: "text!", lead: "text", photos: "media[]", primary: "link", items: "workshops!" },
  data: [],
  client: "workshops.js",
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    return html`<section class="workshops band" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <header class="${b.photos?.length ? "ws-head has-photos" : "ws-head"}">
    <div class="ws-words">
      <h2 id="${b.id}-h">${b.title}</h2>
      ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    </div>
    ${b.photos?.length ? html`<div class="ws-photos">${b.photos.slice(0, 2).map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: i ? "(max-width: 860px) 36vw, 13rem" : "(max-width: 860px) 56vw, 22rem" })}</div>`)}</div>` : ""}
  </header>
  <div class="ws" data-ws>
    <ul class="ws-tabs" data-ws-tabs>${b.items.map((w, i) => html`<li><a class="ws-tab" href="#${w.id}" data-tab="${w.id}"><span class="ws-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span>${w.tab}</span></a></li>`)}</ul>
    ${b.items.map((w) => html`<article class="ws-panel" id="${w.id}" data-panel="${w.id}" aria-labelledby="${w.id}-h">
      <div class="ws-try">${ACTIVITIES[w.activity.kind](w, w.activity, ctx)}</div>
      <div class="ws-about">
        <h3 id="${w.id}-h">${w.title}</h3>
        ${w.goals?.length ? html`<p class="ws-in">${ctx.t("workshops.inWorkshop")}</p><ul class="ws-goals">${w.goals.map((g) => html`<li>${icon("check")}<span>${g}</span></li>`)}</ul>` : ""}
        <div class="ws-actions">${b.primary ? link(ctx, b.primary.href, b.primary.label, { class: "btn", icon: "arrow" }) : ""}${w.link ? go(ctx, w.link.href, w.link.label) : ""}</div>
      </div>
    </article>`)}
  </div>
</div></section>`;
  },
};
