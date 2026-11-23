/* A cloud of words under one heading: what people bring to a peer support group, as the live page's
   graphic shows it, redrawn in brand red and the neutrals. Each word is a chip in one of three sizes
   (1 small, 2 medium, 3 large) and one of three treatments taken in turn (filled red, red outline,
   red tint), so no two neighbours look alike.
   A word may carry a `quote`: an example of how a student might put that topic, in the student's
   words. Words with quotes form a tab set (the WAI-ARIA tabs pattern): the words are the tabs, and
   one panel under the cloud shows the picked word's quote, in place — nothing opens over the page,
   and picking another word swaps the quote at once (words.js). The first quoted word stands picked,
   so the panel is never empty. The quotes are examples written for the page, never a real student's
   words, and the panel says so. Without JavaScript the words stand as before and the panel shows
   the first word's quote. A words block with no quotes is a plain list, read in order. */

import { html } from "../html.mjs";

const word = (w) => (typeof w === "string" ? { text: w, size: 1 } : { text: w.text, size: w.size || 1, quote: w.quote });
const chip = (w, i) => `w-${Math.min(3, Math.max(1, w.size))} tone-${(i % 3) + 1}`;

export default {
  type: "words",
  label: "Word cloud",
  fields: { title: "text!", invite: "text", items: "words!", note: "text", exampleLabel: "text" },
  data: [],
  styles: "words.css",
  client: "words.js",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const items = b.items.map(word);
    const first = items.findIndex((w) => w.quote);
    const cloud = first < 0
      ? html`<ul class="word-cloud">${items.map((w, i) => html`<li class="${chip(w, i)}">${w.text}</li>`)}</ul>`
      : html`<div class="word-cloud" role="tablist" aria-labelledby="${b.id}-h">${items.map((w, i) => w.quote
        ? html`<button type="button" role="tab" class="word-pill ${chip(w, i)}" id="${b.id}-tab-${i}" aria-selected="${i === first ? "true" : "false"}" aria-controls="${b.id}-panel" tabindex="${i === first ? 0 : -1}" data-words-tab data-words-topic="${w.text}" data-words-quote="${w.quote}">${w.text}</button>`
        : html`<span class="${chip(w, i)}">${w.text}</span>`)}</div>`;
    return html`<section class="words band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-words><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.invite ? html`<p class="words-invite">${b.invite}</p>` : ""}
  ${cloud}
  ${first >= 0 ? html`<div class="words-panel" role="tabpanel" id="${b.id}-panel" tabindex="0" aria-labelledby="${b.id}-tab-${first}" data-words-panel><p class="words-panel-topic" data-words-ptopic>${items[first].text}</p><p class="words-panel-example">${b.exampleLabel}</p><blockquote class="words-quote" data-words-pquote>${items[first].quote}</blockquote></div>` : ""}
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
    if (w && typeof w === "object" && w.quote != null && (typeof w.quote !== "string" || !w.quote.trim())) out.push(`${at}: a quote is words a student might say, or left out`);
  }
  if (!(b.items || []).length) out.push(`${b.id}: a words block needs at least one word`);
  if ((b.items || []).some((w) => w && typeof w === "object" && w.quote) && !b.exampleLabel) out.push(`${b.id}: a word with a quote needs the panel's exampleLabel`);
  return out;
}
