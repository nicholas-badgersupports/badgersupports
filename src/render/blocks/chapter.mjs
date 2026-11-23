/* A chapter break on a timeline of era stops (src/render/blocks/text.mjs): the story is told in a
   few parts, and each part opens with its span set larger than any stop's years, the same mark on
   the line every stop carries, and the part's stops named as links beside it — a contents line for the part, so a
   reader sees what the part covers before reading it. The timeline's line ends at the last stop
   before a chapter and starts again after it (styles/blocks/text.css), so the break reads in the
   line as well as in the type.
   The first chapter on a page may also carry "jump": the same parts as a slim row of the site's
   section navigation (src/render/secnav.mjs) that stays at the top of the screen while the story
   scrolls under it, so a reader can move between parts deliberately. */

import { html, attrs } from "../html.mjs";
import { sectionNav } from "../secnav.mjs";

export default {
  type: "chapter",
  label: "Timeline chapter",
  fields: { title: "text!", items: "link[]", jump: "link[]" },
  data: [],
  styles: "text.css",
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const jump = b.jump?.length
      ? html`<div class="era-jump"><div class="wrap">${sectionNav(ctx, ctx.t("directions.onPage"), b.jump.map((l) => ({ href: l.href, label: l.label, icon: l.icon || "arrow" })))}</div></div>`
      : "";
    return html`${jump}<section${attrs({ class: "text-block band era-chapter", id: b.anchor || null, "aria-labelledby": `${b.id}-h`, "data-block": b.id })}><div class="wrap">
  <h2 id="${b.id}-h" class="era-chapter-head"><span class="era-chapter-when">${b.title}</span>${b.items?.length ? html`<span class="era-chapter-items">${b.items.map((l, i) => html`${i ? html`<span class="era-chapter-sep" aria-hidden="true">·</span>` : ""}<a href=${l.href}>${l.label}</a>`)}</span>` : ""}</h2>
</div></section>`;
  },
};
