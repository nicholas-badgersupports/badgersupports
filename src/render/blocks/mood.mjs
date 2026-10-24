/* "How are you feeling today?" — one tap, no names, kept from the live footer.
   It posts to /api/mood (a plain form, so it works without JavaScript) and is never sent to
   analytics: the block declares analytics "none" and the client sends nothing but the tap. */

import { html } from "../html.mjs";

export default {
  type: "mood",
  label: "Mood check-in",
  fields: { title: "text!", intro: "text" },
  data: ["mood"],
  styles: "mood.css",
  client: "mood.js",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const cfg = ctx.data.mood;
    if (!cfg?.moods?.length) return html``;
    return html`<section class="mood" aria-labelledby="${b.id}-h" data-block="${b.id}" data-analytics="off"><div class="wrap">
  <div><h2 id="${b.id}-h">${b.title}</h2>${b.intro ? html`<p>${b.intro}</p>` : ""}</div>
  <div>
    <form method="post" action="/api/mood" data-mood>
      <fieldset class="mood-options"><legend>${b.title}</legend>${cfg.moods.map((m) => html`<button type="submit" name="mood" value="${m.id}" class="mood-btn mood-${m.id}" aria-pressed="false"><span class="e" aria-hidden="true">${m.emoji}</span>${m.label}</button>`)}</fieldset>
    </form>
    <div class="mood-result" data-mood-result hidden tabindex="-1"></div>
  </div>
</div></section>`;
  },
};
