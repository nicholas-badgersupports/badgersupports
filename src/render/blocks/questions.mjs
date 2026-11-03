/* Questions and answers, each folded until it is opened, beside their heading and one way to ask
   something else. Built on <details>, so it works with no script and a screen reader announces
   each one as a button that expands; its plus turns into a minus while it is open. A note, when there
   is one, closes the list: a line every reader should meet without opening anything. */

import { html } from "../html.mjs";
import { go } from "../context.mjs";
import { icon } from "../icons.mjs";
import { linkProblem } from "../../shared/links.mjs";

function answer(q, ctx) {
  return html`<details id="${q.id}"><summary><span>${q.q}</span>${icon("plus")}</summary>${(Array.isArray(q.a) ? q.a : [q.a]).map(p => html`<p>${p}</p>`)}${q.links?.length ? html`<ul class="qa-links">${q.links.map(l => html`<li>${go(ctx, l.href, l.label, l.icon || "arrow")}</li>`)}</ul>` : ""}</details>`;
}

/* Display groups reference stable questions; moving a display group never moves saved answer paths. */
export function questionProblems(b) {
  const out = [], ids = new Set(), nonempty = v => typeof v === "string" && !!v.trim();
  if (!Array.isArray(b.items) || !b.items.length) return [`${b.id}: questions need at least one answer`];
  for (const q of b.items) {
    if (!/^q-[a-z0-9-]{2,60}$/.test(q?.id || "") || ids.has(q.id)) out.push(`${b.id}: each question needs its own id like q-something`);
    ids.add(q?.id);
    if (!nonempty(q?.q) || !(Array.isArray(q?.a) ? q.a.length && q.a.every(nonempty) : nonempty(q?.a))) out.push(`${b.id}: every question needs a question and one or more answer paragraphs`);
    if (q?.links != null && (!Array.isArray(q.links) || q.links.some(l => !nonempty(l?.label) || linkProblem(l?.href)))) out.push(`${b.id}: answer links need a label and a valid address`);
  }
  if (b.groups != null) {
    if (!Array.isArray(b.groups) || !b.groups.length) return [...out, `${b.id}: display groups need a title and question ids`];
    const shown = new Set(), groups = new Set();
    for (const g of b.groups) {
      if (!/^[a-z][a-z0-9-]{1,40}$/.test(g?.id || "") || groups.has(g.id) || !nonempty(g?.title)) out.push(`${b.id}: display groups need distinct ids and titles`);
      groups.add(g?.id);
      if (!Array.isArray(g?.questionIds) || !g.questionIds.length) { out.push(`${b.id}: every display group needs question ids`); continue; }
      for (const id of g.questionIds) {
        if (!ids.has(id) || shown.has(id)) out.push(`${b.id}: display groups must reference each existing question once`);
        shown.add(id);
      }
    }
    if ([...ids].some(id => !shown.has(id))) out.push(`${b.id}: display groups cannot hide a question`);
  }
  return out;
}

export default {
  type: "questions",
  label: "Questions and answers",
  fields: { title: "text!", items: "qa!", groups: "qagroups", ask: "link", note: "text" },
  data: [],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const anchor = b.anchor || b.id;
    return html`<section class="questions band" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <div class="qa-head">
    <h2 id="${b.id}-h">${b.title}</h2>
    ${b.ask ? go(ctx, b.ask.href, b.ask.label, b.ask.icon || (b.ask.href.startsWith("mailto:") ? "mail" : "arrow")) : ""}
  </div>
  <div class="qa-list">${b.groups?.length ? b.groups.map(g => html`<section class="qa-group" id="${anchor}-${g.id}" aria-labelledby="${anchor}-${g.id}-h"><h3 id="${anchor}-${g.id}-h">${g.title}</h3>${g.questionIds.map(id => answer(b.items.find(q => q.id === id), ctx))}</section>`) : b.items.map(q => answer(q, ctx))}</div>
  ${b.note ? html`<p class="qa-note">${b.note}</p>` : ""}
</div></section>`;
  },
};
