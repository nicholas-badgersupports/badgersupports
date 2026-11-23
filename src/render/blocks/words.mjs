/* A cloud of words under one heading: what people bring to a peer support group, as the live page's
   graphic shows it, redrawn in brand red and the neutrals. Each word is a chip in one of three sizes
   (1 small, 2 medium, 3 large) and one of three treatments taken in turn (filled red, red outline,
   red tint), so no two neighbours look alike. The words are a list, read in order by a screen reader.
   A word may carry a `quote`: an example of how a student might put that topic, in the student's
   words. A word with a quote is a button; pressing it opens the section's pop-up with the quote
   (words.js). The quotes are examples written for the page, never a real student's words, and the
   pop-up says so. Without JavaScript the words simply stand as the list they always were. */

import { html } from "../html.mjs";
import { icon } from "../icons.mjs";

const word = (w) => (typeof w === "string" ? { text: w, size: 1 } : { text: w.text, size: w.size || 1, quote: w.quote });

export default {
  type: "words",
  label: "Word cloud",
  fields: { title: "text!", invite: "text", items: "words!", note: "text", exampleLabel: "text", closeLabel: "text" },
  data: [],
  styles: "words.css",
  client: "words.js",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const items = b.items.map(word);
    const anyQuote = items.some((w) => w.quote);
    return html`<section class="words band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-words><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.invite ? html`<p class="words-invite">${b.invite}</p>` : ""}
  <ul class="word-cloud">${items.map((w, i) => {
    const cls = `w-${Math.min(3, Math.max(1, w.size))} tone-${(i % 3) + 1}`;
    return w.quote
      ? html`<li class="${cls}"><button type="button" class="word-pill" data-words-open data-words-topic="${w.text}" data-words-quote="${w.quote}" aria-haspopup="dialog">${w.text}</button></li>`
      : html`<li class="${cls}">${w.text}</li>`;
  })}</ul>
  ${b.note ? html`<p class="words-note">${b.note}</p>` : ""}
  ${anyQuote ? html`<dialog class="words-dialog" aria-labelledby="${b.id}-dh" data-words-dialog><div class="words-dialog-head"><h3 id="${b.id}-dh" data-words-dtitle></h3><button type="button" class="btn btn--quiet words-close" data-words-close>${b.closeLabel}${icon("close")}</button></div><div class="words-dialog-body"><p class="words-dialog-example">${b.exampleLabel}</p><blockquote class="words-quote" data-words-dquote></blockquote></div></dialog>` : ""}
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
  if ((b.items || []).some((w) => w && typeof w === "object" && w.quote) && (!b.exampleLabel || !b.closeLabel)) out.push(`${b.id}: a word with a quote needs the pop-up's exampleLabel and closeLabel`);
  return out;
}
