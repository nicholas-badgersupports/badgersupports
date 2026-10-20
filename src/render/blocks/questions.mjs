/* Questions and answers, each folded until it is opened, beside their heading and one way to ask
   something else. Built on <details>, so it works with no script and a screen reader announces
   each one as a button that expands; its plus turns into a minus while it is open. A note, when there
   is one, closes the list: a line every reader should meet without opening anything. */

import { html } from "../html.mjs";
import { go } from "../context.mjs";
import { icon } from "../icons.mjs";

export default {
  type: "questions",
  label: "Questions and answers",
  fields: { title: "text!", items: "qa!", ask: "link", note: "text" },
  data: [],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    return html`<section class="questions band" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="qa-head">
    <h2 id="${b.id}-h">${b.title}</h2>
    ${b.ask ? go(ctx, b.ask.href, b.ask.label, b.ask.icon || (b.ask.href.startsWith("mailto:") ? "mail" : "arrow")) : ""}
  </div>
  <div class="qa-list">${b.items.map((q) => html`<details id="${q.id}"><summary><span>${q.q}</span>${icon("plus")}</summary>${(Array.isArray(q.a) ? q.a : [q.a]).map((p) => html`<p>${p}</p>`)}</details>`)}</div>
  ${b.note ? html`<p class="qa-note">${b.note}</p>` : ""}
</div></section>`;
  },
};
