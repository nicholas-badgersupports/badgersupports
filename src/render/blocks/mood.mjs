/* "How are you feeling today?" — one tap, no names, kept from the live footer.
   It posts to /api/mood (a plain form, so it works without JavaScript) and is never sent to
   analytics: the block declares analytics "none" and the client sends nothing but the tap.
   As on the live check-in, each feeling is its emoji over its word; the client adds a confetti
   burst on a tap. The feelings are the build's (content/widgets/mood.json) unless a publisher
   saved their own set in Site Settings (structure.mjs, layMood). Each button names its colour
   in data-color and the client lays it on as the button's --mood: the generated sheet colours
   the build's feelings on its own, and a saved set's colours follow without it knowing their
   ids (an inline style attribute would break the site's style policy, so the client sets it). */

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
      <fieldset class="mood-options"><legend>${b.title}</legend>${cfg.moods.map((m) => html`<button type="submit" name="mood" value="${m.id}" class="mood-btn mood-${m.id}" data-color="${m.color}" aria-pressed="false"><span class="e" aria-hidden="true">${m.emoji}</span><span class="mood-label">${m.label}</span></button>`)}</fieldset>
    </form>
    <div class="mood-result" data-mood-result hidden tabindex="-1"></div>
  </div>
</div></section>`;
  },
};
