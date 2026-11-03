import { html, attrs } from "../html.mjs";
import { go } from "../context.mjs";

export default {
  type: "alumni",
  label: "Alumni history",
  fields: { title: "text!", lead: "text", contact: "link!" },
  data: ["alumni", "alumniState"],
  styles: "alumni.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const groups = (ctx.data.alumni?.groups || []).filter(g => g.people.length);
    const state = ctx.data.alumniState || "disabled";
    return html`<section class="alumni-history band" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
      <h2 id="${b.id}-h">${b.title}</h2>${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
      ${state === "fixture" ? html`<p class="sample-note">${ctx.t("alumni.sample")}</p>` : ""}
      ${groups.length ? html`<div class="alumni-cohorts">${groups.map((group, i) => html`<details${attrs({ open: i === 0 })}>
        <summary><span>${group.heading}</span><span class="alumni-origin">${ctx.t(group.organization === "BSN" ? "alumni.bsn" : "alumni.bss")}</span></summary>
        <ul class="alumni-people">${group.people.map(person => html`<li><h3>${person.name}</h3><p>${person.years}</p>${person.titles.length ? html`<ul class="alumni-titles">${person.titles.map(title => html`<li>${title}</li>`)}</ul>` : ""}</li>`)}</ul>
      </details>`)}</div>` : html`<p>${ctx.t(state === "unavailable" ? "alumni.unavailable" : state === "empty" ? "alumni.empty" : "alumni.disabled")}</p>`}
      <p class="alumni-contact">${go(ctx, b.contact.href, b.contact.label, "mail")}</p>
    </div></section>`;
  },
};
