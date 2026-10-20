/* The team, from Connect. Every member already has a Connect account; a member who chooses to be
 * on the public site writes their profile there (name, pronouns, class year, title, a short bio,
 * an uploaded photo, and a public contact only if they want one), and Connect exports the
 * published profiles. The build gives each one a card on /about/our-team/ and a page of its own at
 * /about/our-team/<slug>/. There is no second roster here: adding, changing or removing a person
 * happens in Connect.
 *
 * A profile its owner has not made public (published: false) gets no card and no page.
 *
 * The old site kept each person under their group (/about/our-team/<group>/<slug>). Those
 * addresses move to the team page as a whole, because a group is a fact Connect can change and a
 * person's address should not move with it.
 */

import { photoProblems } from "./media.mjs";

export const TEAM_SCHEMA = "bss.team-fixture/1";
export const GROUPS = ["directors", "associate-directors", "staff", "volunteers", "advisors"];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/* A public contact is an organisation address, never a personal one, unless Connect says the
   member chose to publish their own. The fixture uses example.org. */
const CONTACT_RE = /@(badgersupports\.org|example\.org|example\.com)$/;

export const TEAM_PATH = "/about/our-team/";
export const personPath = (slug) => `${TEAM_PATH}${slug}/`;

export const initials = (name) => String(name).trim().split(/\s+/).filter(Boolean).map((w) => w[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join("").toUpperCase();

/* Problems with the whole export. */
export function teamProblems(team, { media = null, production = false } = {}) {
  const out = [];
  if (team.schema !== TEAM_SCHEMA) out.push(`schema must be ${TEAM_SCHEMA}`);
  const slugs = new Set();
  for (const p of team.people || []) {
    const at = p.slug || p.id || "?";
    if (!p.id) out.push(`${at}: needs Connect's opaque id`);
    if (!SLUG_RE.test(p.slug || "")) out.push(`${at}: slug must use a–z, 0–9 and single hyphens`);
    if (slugs.has(p.slug)) out.push(`${at}: duplicate slug`);
    slugs.add(p.slug);
    for (const k of ["name", "title", "role"]) if (!p[k]) out.push(`${at}: needs a ${k}`);
    if (!GROUPS.includes(p.group)) out.push(`${at}: group must be one of ${GROUPS.join(", ")}`);
    if (!Array.isArray(p.bio) || p.bio.some((x) => typeof x !== "string")) out.push(`${at}: bio is a list of paragraphs`);
    if (p.contact && !CONTACT_RE.test(String(p.contact).replace(/^mailto:/, ""))) out.push(`${at}: a public contact is an organisation address`);
    if (p.photo) for (const x of photoProblems(p.photo, { media, production })) out.push(`${at}: ${x}`);
    for (const a of p.aliases || []) if (!/^\/[^\s]*[^/]$/.test(a)) out.push(`${at}: alias ${a}: an old address starts with "/" and has no trailing slash`);
  }
  return out;
}

/* The published people, in order: by group, then the order Connect gives, then name. */
export function publicPeople(team) {
  return (team?.people || []).filter((p) => p.published)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
}

/* One page per published person. t is the resolved word table, for the title and description. */
export function personPages(team, t) {
  return publicPeople(team).map((p) => ({
    schema: "bss.page/1",
    id: `pg-person-${p.slug}`,
    path: personPath(p.slug),
    aliases: p.aliases || [],
    generated: "person",
    title: t("team.pageTitle", { name: p.name, title: p.title }),
    description: t("team.pageDescription", { name: p.name, title: p.title }),
    analytics: "public",
    blocks: [{ id: "b-person", type: "person", person: p.slug }],
  }));
}

/* The old per-group addresses, each sent to the team page. Written last in _redirects so a
   person's own old address, when Connect carries one as an alias, wins over it. */
const OLD_GROUPS = ["advisors", "directors", "general-staff", "volunteers"];
export const teamRedirects = () => OLD_GROUPS.map((g) => `${TEAM_PATH}${g}/*  ${TEAM_PATH}  301`);
