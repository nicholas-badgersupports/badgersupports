/* One person's page, as they wrote it in Connect: their title on the pale-red stripe over their
   name, their pronouns and class year, their bio, and a way to write to them only if they chose to
   publish one. Their photo is square, as on their card, larger; with no photo, their initials.
   Below, a few others from the same group, as cards, and the way back to the whole team. */

import { html } from "../html.mjs";
import { icon } from "../icons.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";
import { publicPeople, initials, TEAM_PATH } from "../team.mjs";
import { personCard } from "./team.mjs";

export default {
  type: "person",
  label: "Profile",
  fields: { person: "person!" },
  data: ["team", "teamSample"],
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const people = publicPeople(ctx.data.team);
    const p = people.find((x) => x.slug === b.person);
    if (!p) throw new Error(`${b.id}: "${b.person}" has no public profile`);
    const meta = [p.pronouns, p.classYear ? ctx.t("team.classOf", { year: p.classYear }) : null, p.credentials].filter(Boolean).join(" · ");
    const first = p.name.trim().split(/\s+/)[0];
    const more = people.filter((x) => x.group === p.group && x.slug !== p.slug).slice(0, 4);
    return html`<section class="profile" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <p class="crumb"><a class="go go--back" href="${ctx.link(TEAM_PATH).href}">${icon("back", "go-ic")}<span class="go-label">${ctx.t("team.all")}</span></a></p>
  <div class="profile-main">
    <div class="profile-photo">${p.photo ? picture(ctx, p.photo, { sizes: "(max-width: 760px) 12rem, 18rem", eager: true, alt: "" }) : html`<span class="monogram" aria-hidden="true">${initials(p.name)}</span>`}</div>
    <div class="profile-words">
      <p class="person-title"><span>${p.title}</span></p>
      <h1 id="${b.id}-h">${p.name}</h1>
      ${meta ? html`<p class="profile-meta">${meta}</p>` : ""}
      ${(p.bio || []).map((x) => html`<p>${x}</p>`)}
      ${p.contact ? html`<p class="profile-contact">${link(ctx, `mailto:${String(p.contact).replace(/^mailto:/, "")}`, ctx.t("team.connectWith", { first }), { class: "go", icon: "mail" })}</p>` : ""}
      ${ctx.data.teamSample ? html`<p class="sample-note">${ctx.data.teamSample}</p>` : ""}
    </div>
  </div>
  ${more.length ? html`<div class="profile-more">
    <h2 id="${b.id}-more">${ctx.t("team.more")}</h2>
    <ul class="people" aria-labelledby="${b.id}-more">${more.map((x) => personCard(ctx, x))}</ul>
  </div>` : ""}
</div></section>`;
  },
};
