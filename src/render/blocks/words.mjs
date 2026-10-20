/* A cloud of words under one heading: what people bring to a peer support group, as the live page's
   graphic shows it, redrawn in brand red and the neutrals. Each word is a chip in one of three sizes
   (1 small, 2 medium, 3 large) and one of three treatments taken in turn (filled red, red outline,
   red tint), so no two neighbours look alike. The words are a list, read in order by a screen reader. */

import { html } from "../html.mjs";

const word = (w) => (typeof w === "string" ? { text: w, size: 1 } : { text: w.text, size: w.size || 1 });

export default {
  type: "words",
  label: "Word cloud",
  fields: { title: "text!", items: "words!", note: "text" },
  data: [],
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    return html`<section class="words band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  <ul class="word-cloud">${b.items.map(word).map((w, i) => html`<li class="w-${Math.min(3, Math.max(1, w.size))} tone-${(i % 3) + 1}">${w.text}</li>`)}</ul>
  ${b.note ? html`<p class="words-note">${b.note}</p>` : ""}
</div></section>`;
  },
};

/* Why a words block cannot be published, as a list of reasons. */
export function wordProblems(b) {
  const out = [];
  for (const [i, w] of (b.items || []).entries()) {
    const at = `${b.id}: items[${i}]`;
    const text = typeof w === "string" ? w : w?.text;
    if (typeof text !== "string" || !text.trim()) out.push(`${at}: a word needs its text`);
    if (w && typeof w === "object" && w.size != null && ![1, 2, 3].includes(w.size)) out.push(`${at}: size is 1, 2 or 3`);
  }
  if (!(b.items || []).length) out.push(`${b.id}: a words block needs at least one word`);
  return out;
}
