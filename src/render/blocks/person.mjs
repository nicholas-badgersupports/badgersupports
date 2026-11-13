/* One person's page, as they wrote it in Connect: a card that leads with their photo — square and
   cropped, as on their card, larger — with their title on the pale-red stripe over their name beside
   it and the first paragraph of their bio under that. The rest of the bio
   follows under an "About" heading, and the facts Connect syncs (their title, their pronouns, their
   class year) close the card in a band of their own at the bottom — below the About words when there
   are any, straight after the photo and words when there are not. A field Connect did not supply leaves its piece out entirely —
   no photo shows their initials, no bio shows nothing — never filler. Below the card, where "More of
   Our Team" used to offer more browsing, are the things a visitor can do next: join, come to a
   group, request a workshop. Their email appears only if they chose to publish one. */

import { html } from "../html.mjs";
import { icon } from "../icons.mjs";
import { link } from "../context.mjs";
import { picture } from "../media.mjs";
import { publicPeople, initials, TEAM_PATH, personPhoto } from "../team.mjs";

/* The ways in. Nothing here is read from the person's own profile: Connect syncs no program
   memberships and no directorate for anyone (their group is a tier — directors, staff — not a
   team with a page), so a per-person "their programs" list would be invented. These are the
   standing invitations every profile can honestly offer, at the pages the site already keeps. */
const NEXT = [
  { key: "team.nextJoin", path: "/join/get-involved/" },
  { key: "team.nextGroups", path: "/join/peer-support-groups/" },
  { key: "team.nextWorkshop", path: "/join/request-a-workshop/" },
];

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
    const name = p.name || ctx.t("team.unnamed");
    const first = (p.name || "").trim().split(/\s+/)[0];
    const [lead, ...rest] = p.bio || [];
    const facts = [
      p.title ? { label: ctx.t("team.factTitle"), value: p.title } : null,
      p.pronouns ? { label: ctx.t("team.factPronouns"), value: p.pronouns } : null,
      p.classYear ? { label: ctx.t("team.factClass"), value: p.classYear } : null,
    ].filter(Boolean);
    return html`<section class="profile" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
  <p class="crumb"><a class="go go--back" href="${ctx.link(TEAM_PATH).href}">${icon("back", "go-ic")}<span class="go-label">${ctx.t("team.all")}</span></a></p>
  <div class="profile-card">
    <div class="profile-main">
      <div class="profile-photo">${p.photo ? personPhoto(ctx, p, { sizes: "(max-width: 760px) calc(100vw - 6rem), 21rem", eager: true, alt: "" }) : html`<span class="monogram" aria-hidden="true">${initials(p.name) || "?"}</span>`}</div>
      <div class="profile-words">
        ${p.title ? html`<p class="person-title"><span>${p.title}</span></p>` : ""}
        <h1 id="${b.id}-h">${name}</h1>
        ${lead ? html`<p class="lead">${lead}</p>` : ""}
        ${p.contact ? html`<p class="profile-contact">${link(ctx, `mailto:${String(p.contact).replace(/^mailto:/, "")}`, ctx.t(first ? "team.connectWith" : "team.connect", { first }), { class: "go", icon: "mail" })}</p>` : ""}
        ${ctx.data.teamSample ? html`<p class="sample-note">${ctx.data.teamSample}</p>` : ""}
      </div>
    </div>
    ${rest.length ? html`<div class="profile-about">
      <h2>${ctx.t("team.aboutFirst", { first: first || name })}</h2>
      ${rest.map((x) => html`<p>${x}</p>`)}
    </div>` : ""}
    ${facts.length ? html`<dl class="profile-facts">${facts.map((f) => html`<div class="profile-fact"><dt>${f.label}</dt><dd>${f.value}</dd></div>`)}</dl>` : ""}
  </div>
  <div class="profile-next">
    <h2 id="${b.id}-next">${ctx.t("team.nextHeading")}</h2>
    <ul class="profile-next-list" aria-labelledby="${b.id}-next">${NEXT.map((n) => html`<li><a href="${ctx.link(n.path).href}"><span>${ctx.t(n.key)}</span><span aria-hidden="true">→</span></a></li>`)}</ul>
  </div>
</div></section>`;
  },
};
