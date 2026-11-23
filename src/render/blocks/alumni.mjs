import { html, attrs } from "../html.mjs";
import { go } from "../context.mjs";

/* The history arrives as one flat run of bars, organisation years and role years mixed in
   the order Connect holds them. The page separates them into headed sections: a bar whose
   heading is only a year range stands under its organisation's name, and bars whose heading
   names a role after the years stand together under that role's name, whichever organisation
   they served — each bar still carries its own organisation label. Inside a section the bars
   run oldest first, the order the history itself happened in; sections are ordered the same
   way, organisations before roles. A heading that does not open with a year range cannot be
   split, so its bar keeps its organisation's section unsplit: no bar is dropped or renamed
   by the separation, and the first bar of the first section stays open, as before. */
function sections(groups) {
  const orgs = new Map(), roles = new Map();
  for (const group of groups) {
    const lead = /^(\d{4})\s*[–—-]\s*(\d{4})(?:\s+(.+))?$/.exec(group.heading.trim());
    const role = lead?.[3]?.trim() || null;
    const found = group.heading.match(/\d{4}/);
    const entry = { group, start: found ? Number(found[0]) : null };
    const bucket = role ? roles : orgs, key = role || group.organization;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push(entry);
  }
  const byYear = (a, b) => (a.start ?? Infinity) - (b.start ?? Infinity);
  const firstYear = (list) => Math.min(...list.map((e) => e.start ?? Infinity));
  const build = (map, isRole) => [...map.entries()]
    .map(([key, list]) => ({ org: isRole ? null : key, title: isRole ? key : null, list: list.sort(byYear) }))
    .sort((a, b) => firstYear(a.list) - firstYear(b.list));
  return [...build(orgs, false), ...build(roles, true)];
}

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
    const parts = sections(groups);
    return html`<section class="alumni-history band" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
      <h2 id="${b.id}-h">${b.title}</h2>${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
      ${state === "fixture" ? html`<p class="sample-note">${ctx.t("alumni.sample")}</p>` : ""}
      ${parts.length ? html`<div class="alumni-cohorts">${parts.map((part, pi) => html`<div class="alumni-group" role="group" aria-labelledby="${b.id}-g${pi}">
        <h3 class="alumni-group-title" id="${b.id}-g${pi}">${part.title ?? ctx.t(part.org === "BSN" ? "alumni.bsn" : "alumni.bss")}</h3>
        ${part.list.map((entry, ei) => html`<details${attrs({ open: pi === 0 && ei === 0 })}>
        <summary><span>${entry.group.heading}</span><span class="alumni-origin">${ctx.t(entry.group.organization === "BSN" ? "alumni.bsn" : "alumni.bss")}</span></summary>
        <ul class="alumni-people">${entry.group.people.map(person => html`<li><h3>${person.name}</h3><p>${person.years}</p>${person.titles.length ? html`<ul class="alumni-titles">${person.titles.map(title => html`<li>${title}</li>`)}</ul>` : ""}</li>`)}</ul>
      </details>`)}
      </div>`)}</div>` : html`<p>${ctx.t(state === "unavailable" ? "alumni.unavailable" : state === "empty" ? "alumni.empty" : "alumni.disabled")}</p>`}
      <p class="alumni-contact">${go(ctx, b.contact.href, b.contact.label, "mail")}</p>
    </div></section>`;
  },
};
