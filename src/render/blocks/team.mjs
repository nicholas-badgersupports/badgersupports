/* The team, as Connect publishes it and as the live page lays it out: a heading, then each group
   under a big red heading of its own (or none, for a group the page names only once), four people
   to a row. Every published person is a card that opens their page: a square photo, or their
   initials on a square of paper when they have none. A group with nobody in it is left out.

   Two cards (the block's `card` field):
     role  — the short role over the photo and the name under it in red, as the team rows have it.
             The name comes first in the markup, so the link reads "name, role"; CSS lifts the role.
     title — the name in red under the photo and the full title under that, as the advisors have it.

   The people come from the team source (src/render/team.mjs), never from the page: the page only
   says which groups to show, in what order, and what to call them. */

import { html } from "../html.mjs";
import { picture } from "../media.mjs";
import { publicPeople, personPath, initials } from "../team.mjs";

export function personCard(ctx, p, card = "role") {
  const words = card === "title" ? p.title : p.role || p.title;
  return html`<li class="person is-${card}"><a class="person-link" href="${ctx.link(personPath(p.slug)).href}">
    <span class="person-photo">${p.photo ? picture(ctx, p.photo, { sizes: "(max-width: 860px) 45vw, 16rem", alt: "" }) : html`<span class="monogram" aria-hidden="true">${initials(p.name)}</span>`}</span>
    <span class="person-name">${p.name}</span>
    ${words ? html`<span class="person-role">${words}</span>` : ""}
  </a></li>`;
}

/* A page with two team blocks (the team, then its advisors) says the people are samples once,
   in the first. With nobody published yet, the first says so in a line and the rest are left out. */
const noted = new WeakSet();
const emptied = new WeakSet();

export default {
  type: "team",
  label: "Team",
  fields: { title: "text!", heading: "choice:h1|h2", lead: "text", photos: "media[]", source: "source!", groups: "teamgroups!", card: "choice:role|title" },
  data: ["team", "teamSample"],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    const people = publicPeople(ctx.data.team);
    const groups = (b.groups || []).map((g) => ({ ...g, people: people.filter((p) => p.group === g.group) })).filter((g) => g.people.length);
    const none = !groups.length;
    if (none && emptied.has(ctx)) return "";
    if (none) emptied.add(ctx);
    const [photo] = b.photos || [];
    const note = ctx.data.teamSample && !noted.has(ctx);
    if (note) noted.add(ctx);
    const h = b.heading === "h1" ? html`<h1 id="${b.id}-h">${b.title}</h1>` : html`<h2 id="${b.id}-h">${b.title}</h2>`;
    const sub = (x, id) => (b.heading === "h1" ? html`<h2 class="team-group-h" id="${id}">${x}</h2>` : html`<h3 class="team-group-h" id="${id}">${x}</h3>`);
    return html`<section class="${["team band", photo ? "has-photo" : null].filter(Boolean).join(" ")}" id="${b.anchor || b.id}" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <header class="team-head">
    <div class="team-words">
      ${h}
      ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
      ${note ? html`<p class="sample-note">${ctx.data.teamSample}</p>` : ""}
      ${none ? html`<p class="team-none">${ctx.t("team.none")}</p>` : ""}
    </div>
    ${photo ? html`<div class="photo team-photo">${picture(ctx, photo, { sizes: "(max-width: 860px) calc(100vw - 2rem), 34rem", eager: b.heading === "h1" })}</div>` : ""}
  </header>
  ${groups.map((g) => html`<div class="${g.title ? "team-group has-h" : "team-group"}">
    ${g.title ? sub(g.title, `${b.id}-${g.group}`) : ""}
    <ul class="people" aria-labelledby="${g.title ? `${b.id}-${g.group}` : `${b.id}-h`}">${g.people.map((p) => personCard(ctx, p, b.card || "role"))}</ul>
  </div>`)}
</div></section>`;
  },
};
