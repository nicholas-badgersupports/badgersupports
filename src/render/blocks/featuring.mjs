/* The people an event features — a visiting professional, a speaker, a partner — as a row of
   cards that lead with the person's photo, as the team's cards do: the photo, their name, the
   role or organisation they come with, and one short line of theirs. A person with no photo
   stands by their name alone; a field left out leaves its piece out, never filler. The words
   are the event record's (src/render/hubevents.mjs), written in the Hub Events builder. */

import { html } from "../html.mjs";
import { picture } from "../media.mjs";

export default {
  type: "featuring",
  label: "People featured",
  fields: { title: "text", people: "people" },
  data: [],
  analytics: "page",
  loading: "lazy",
  styles: "featuring.css",
  render(b, ctx) {
    const people = b.people || [];
    if (!people.length) return html``;
    return html`<section class="featuring band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  ${b.title ? html`<h2 id="${b.id}-h">${b.title}</h2>` : html`<h2 id="${b.id}-h" class="sr-only">${ctx.t("hubevent.peopleTitle")}</h2>`}
  <ul class="featuring-list">${people.map((p) => html`<li class="featuring-card">
    ${p.photo ? html`<div class="photo">${picture(ctx, p.photo, { sizes: "(max-width: 860px) 40vw, 14rem", alt: "" })}</div>` : ""}
    <div class="featuring-words">
      <h3>${p.name}</h3>
      ${p.role ? html`<p class="featuring-role">${p.role}</p>` : ""}
      ${p.line ? html`<p>${p.line}</p>` : ""}
    </div>
  </li>`)}</ul>
</div></section>`;
  },
};
