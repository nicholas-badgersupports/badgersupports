/* The top of an ordinary page: its name, what it is in a sentence or two, and the one thing to do
   first as the page's big button, with any other ways on as quieter pills. Photos of people stand
   beside it, one tall and two small, so a page opens on who is there before what it says. On a
   pale band of the page's colour, on the brand's paper texture, with a straight foot (Badger SPILL's
   waves are SPILL's own mark, so they stay on SPILL's site); the full colour belongs to a program's
   own page (eventhero).

   `label` is a short line above the lead, for wording the old site set as a run-in ("Our
   Mission:"). Every word is the page's own, so every word is editable.

   `heroRibbons` names ribbon tones (the ribbons block's colours) to stand as a row of
   decoration in the opening, placed by that page's own rules in blocks.css. The row is
   ornament only: it takes no clicks and is hidden from screen readers, and no page is
   required to carry it.

   `side: "directory"` stands a card in the band's right side where a page has no photos: the
   page's own directory's title and its first group's places, each with the room or address line
   the directory itself shows. The entries are not the opening's to store — the page render
   (src/render/layout.mjs) reads them from the page's directory block as it stands in that
   render and hands them over as `sideTitle`/`sideItems`, so the card can never drift from the
   directory below it. No new words: the card is the directory's own, begun in the band.

   `side: "press"` fans the page's three newest article cards in the same place. The fan's
   cards are drawn from the page's own card lists when the page is laid out (pressFan below,
   called from the layout), never written into the page's JSON, so an article added below
   moves the fan with it. */

import { html } from "../html.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";
import { ribbonArt, isRibbonTone } from "./ribbons.mjs";

function sidePanel(b) {
  const items = b.sideItems || [];
  if (b.side === "directory" && items.length) {
    return html`<div class="pagehead-side is-directory">
      ${b.sideTitle ? html`<p class="ph-side-title">${b.sideTitle}</p>` : ""}
      <ul class="ph-dir">${items.map((it) => html`<li>
        ${it.href ? html`<a href="${it.href}">${it.name}</a>` : html`<span class="ph-dir-name">${it.name}</span>`}
        ${it.address ? html`<span class="ph-dir-addr">${it.address}</span>` : ""}
      </li>`)}</ul>
    </div>`;
  }
  if (b.side === "press") {
    const items = b.sideItems || [];
    if (!items.length) return "";
    return html`<div class="pagehead-side is-press">${items.map((it) => html`<article class="ph-card">
        <p class="ph-card-title">${it.title}</p>
        ${it.line ? html`<p class="ph-card-line">${it.line}</p>` : ""}
      </article>`)}</div>`;
  }
  return "";
}

const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

/* A card item's date, from the first of its lines that reads as one ("October 10, 2026", or
   "September 2024" with no day): the line as written, and when it falls. No such line, no date —
   the item is not an article and never fans. */
function articleDate(item) {
  for (const line of item.lines || []) {
    const m = /^([A-Za-z]+) (?:(\d{1,2}), )?(\d{4})$/.exec(String(line).trim());
    if (!m || !(m[1].toLowerCase() in MONTHS)) continue;
    return { line: String(line), when: Date.UTC(+m[3], MONTHS[m[1].toLowerCase()], m[2] ? +m[2] : 1) };
  }
  return null;
}

/* The press fan's cards: the newest three dated items among the page's own card lists, newest
   first, each as it appears below — its title and its date line. */
export function pressFan(blocks) {
  const dated = [];
  for (const b of blocks || []) {
    if (b.type !== "cards") continue;
    for (const item of b.items || []) {
      if (!item.title) continue;
      const d = articleDate(item);
      if (d) dated.push({ title: item.title, line: d.line, when: d.when });
    }
  }
  return dated.sort((a, b) => b.when - a.when).slice(0, 3).map(({ title, line }) => ({ title, line }));
}

function sidePanel(b) {
  if (b.side === "press") {
    const items = b.sideItems || [];
    if (!items.length) return "";
    return html`<div class="pagehead-side is-press">${items.map((it) => html`<article class="ph-card">
        <p class="ph-card-title">${it.title}</p>
        ${it.line ? html`<p class="ph-card-line">${it.line}</p>` : ""}
      </article>`)}</div>`;
  }
  return "";
}

export default {
  type: "pagehead",
  label: "Page opening",
  fields: { title: "text!", label: "text", lead: "text", body: "paragraphs", primary: "link", links: "link[]", photos: "media[]", firstLinkPrimary: "boolean", whole: "boolean", heroRibbons: "list", side: "choice:none|directory|press" },
  data: [],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const photos = (b.photos || []).slice(0, 3);
    const body = Array.isArray(b.body) ? b.body : b.body ? [b.body] : [];
    const sizes = b.whole ? Array(3).fill("(max-width: 860px) calc(100vw - 2rem), 46vw") : ["(max-width: 860px) 58vw, 26rem", "(max-width: 860px) 38vw, 15rem", "(max-width: 860px) 38vw, 15rem"];
    const heroTones = Array.isArray(b.heroRibbons) ? b.heroRibbons.filter((t) => typeof t === "string" && t) : [];
    const primary = b.primary || (b.firstLinkPrimary ? b.links?.[0] : null);
    const links = b.firstLinkPrimary && !b.primary ? b.links?.slice(1) : b.links;
    const actions = primary || links?.length;
    const side = sidePanel(b);
    return html`<section class="${["pagehead band", photos.length ? `has-photos has-${photos.length}` : null, b.whole ? "is-whole" : null, heroTones.length ? "has-hero-ribbons" : null, side ? "has-side" : null].filter(Boolean).join(" ")}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="pagehead-words">
    <h1 id="${b.id}-h">${b.title}</h1>
    ${b.label ? html`<p class="pagehead-label">${b.label}</p>` : ""}
    ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
    ${body.map((p) => html`<p>${p}</p>`)}
  </div>
    ${actions ? html`<div class="pagehead-actions">
      ${primary ? link(ctx, primary.href, primary.label, { class: "btn btn--big", icon: primary.icon || "arrow" }) : ""}
      ${(links || []).map((l) => link(ctx, l.href, l.label, { class: "go", icon: l.icon || "arrow" }))}
    </div>` : ""}
  ${photos.length ? html`<div class="pagehead-photos">${photos.map((m, i) => html`<div class="photo">${picture(ctx, m, { sizes: sizes[i], eager: true, priority: i === 0 ? "high" : null })}</div>`)}</div>` : ""}
  ${side}
</div>${heroTones.length ? html`<div class="pagehead-ribbons" aria-hidden="true">${heroTones.map((t, i) => html`<span class="ph-ribbon">${ribbonArt(t, `${b.id}-hero-${i}`)}</span>`)}</div>` : ""}</section>`;
  },
};

/* The row is placed for at most five ribbons (blocks.css), and every tone it names must be
   one the ribbon artwork can draw: an unknown name would stand in the opening uncoloured. */
export function pageheadProblems(b) {
  const out = [];
  if (b.heroRibbons == null) return out;
  if (!Array.isArray(b.heroRibbons) || b.heroRibbons.some((t) => typeof t !== "string" || !t)) { out.push(`${b.id}: heroRibbons is a list of ribbon tones`); return out; }
  if (b.heroRibbons.length > 5) out.push(`${b.id}: heroRibbons names ${b.heroRibbons.length} ribbons; the opening's row holds at most five`);
  for (const t of b.heroRibbons) if (!isRibbonTone(t)) out.push(`${b.id}: unknown ribbon tone "${t}"`);
  return out;
}
