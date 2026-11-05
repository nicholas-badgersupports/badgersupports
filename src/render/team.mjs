/* The team, from Connect. Every member already has a Connect account; a member who chooses to be
 * on the public site writes their profile there (name, pronouns, class year, title, a short bio,
 * an uploaded photo, and a public contact only if they want one), and Connect exports the
 * published profiles. The renderer gives each one a card on /about/our-team/ and a page of its own at
 * /about/our-team/<slug>/. There is no second roster here: adding, changing or removing a person
 * happens in Connect.
 *
 * A profile its owner has not made public (published: false) gets no card and no page.
 *
 * The old site kept each person under their group (/about/our-team/<group>/<slug>). Those
 * addresses move to the team page as a whole, because a group is a fact Connect can change and a
 * person's address should not move with it.
 */

import { photoProblems, picture } from "./media.mjs";
import { html, attrs } from "./html.mjs";

export const TEAM_SCHEMA = "bss.team-fixture/1";
export const GROUPS = ["directors", "associate-directors", "staff", "volunteers", "advisors"];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/* A public contact is at badgersupports.org or wisc.edu, never a personal address. example.org and
   example.com are for fixtures and tests. */
const CONTACT_RE = /@(badgersupports\.org|wisc\.edu|example\.org|example\.com)$/;

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
    for (const k of (team.source === "connect" ? [] : ["name", "title", "role"])) if (!p[k]) out.push(`${at}: needs a ${k}`);
    if (!GROUPS.includes(p.group)) out.push(`${at}: group must be one of ${GROUPS.join(", ")}`);
    if (!Array.isArray(p.bio) || p.bio.some((x) => typeof x !== "string")) out.push(`${at}: bio is a list of paragraphs`);
    if (p.contact && !CONTACT_RE.test(String(p.contact).replace(/^mailto:/, ""))) out.push(`${at}: a public contact is a badgersupports.org or wisc.edu address`);
    if (p.photo) for (const x of photoProblems(p.photo, { media, production })) out.push(`${at}: ${x}`);
    for (const a of p.aliases || []) if (!/^\/[^\s]*[^/]$/.test(a)) out.push(`${at}: alias ${a}: an old address starts with "/" and has no trailing slash`);
  }
  return out;
}

/* A specific public title is more useful than an account tier such as Director. */
export function cardRole(p) {
  const role = String(p.role || "").trim();
  const title = String(p.title || "").trim();
  return title && (!role || /^(?:student )?(?:executive director|managing director|director|associate director|coordinator|peer facilitator|general staff|staff|volunteer|advisor)$/i.test(role)) ? title : role || title;
}

/* Role order follows the public leadership directory; unknown titles remain alphabetical.
   Group membership and explicit source order remain source-owned. */
const DIRECTOR_ROLES = [
  /^(?:student )?executive(?: director)?$/, /^(?:student )?managing(?: director)?$/,
  /^(?:(?:financial|business) director|director of (?:business|finance|financial operations)|business|finance)$/,
  /^(?:director of outreach|outreach(?: director)?)$/, /^(?:director of advancement|advancement(?: director)?)$/,
  /^(?:director of education|education(?: director)?)$/, /^(?:director of development|development(?: director)?)$/,
  /^(?:director of engagement|engagement(?: director)?)$/,
  /^(?:director of (?:programs for )?workshops|workshops(?: director)?)$/,
  /^(?:director of (?:programs for )?craft nights|craft nights(?: director)?)$/,
];
const ASSOCIATE_ROLES = [
  /^(?:associate director of|ad) campus relations$/, /^(?:associate director of|ad) operations$/,
  /^(?:associate director of|ad) (?:business|finance)$/, /^(?:associate director of|ad) (?:technology|tech)$/,
];
function roleRank(p) {
  const rules = p.group === "directors" ? DIRECTOR_ROLES : p.group === "associate-directors" ? ASSOCIATE_ROLES : [];
  const rank = rules.findIndex(r => r.test(String(p.title || p.role || "").replace(/\s*\([^)]*\)\s*/g, " ").trim().replace(/\s+/g, " ").toLowerCase()));
  return rank < 0 ? rules.length : rank;
}

export const publicTeamOrder = (value) => Number.isInteger(value) && value >= 0 && value <= 99999 ? value : null;

/* Explicit source ranks form their own ordered set; older exports use role order only when both ranks are absent. */
export function publicPeople(team) {
  return (team?.people || []).filter((p) => p.published)
    .sort((a, b) => {
      const group = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group);
      if (group) return group;
      const left = publicTeamOrder(a.order), right = publicTeamOrder(b.order);
      if ((left === null) !== (right === null)) return left === null ? 1 : -1;
      const order = left !== null ? left - right : roleRank(a) - roleRank(b);
      return order || String(a.name || "").localeCompare(String(b.name || "")) || String(a.id || "").localeCompare(String(b.id || "")) || String(a.slug || "").localeCompare(String(b.slug || ""));
    });
}

/* One page per published person. t is the resolved word table, for the title and description. */
export function personPages(team, t) {
  return publicPeople(team).map((p) => ({
    schema: "bss.page/1",
    id: `pg-person-${p.slug}`,
    path: personPath(p.slug),
    aliases: p.aliases || [],
    generated: "person",
    title: p.title ? t("team.pageTitle", { name: p.name || t("team.unnamed"), title: p.title }) : p.name || t("team.unnamed"),
    description: p.title ? t("team.pageDescription", { name: p.name || t("team.unnamed"), title: p.title }) : t("team.pageIncomplete", { name: p.name || t("team.unnamed") }),
    analytics: "public",
    blocks: [{ id: "b-person", type: "person", person: p.slug }],
  }));
}

/* The old per-group addresses, each sent to the team page. Written last in _redirects so a
   person's own old address, when Connect carries one as an alias, wins over it. */
const OLD_GROUPS = ["advisors", "directors", "general-staff", "volunteers"];
export const teamRedirects = () => OLD_GROUPS.map((g) => `${TEAM_PATH}${g}/*  ${TEAM_PATH}  301`);

const publicPhotoSource = p => `/api/team-photo/${encodeURIComponent(p.photo.uploadId || p.id)}${p.photo.version ? `?v=${p.photo.version}` : ""}`;

/* Selection and order are shared by directory cards and their request-local hints. */
export const teamGroups = (team, groups) => {
  const people = publicPeople(team);
  return (groups || []).map(group => ({ ...group, people: people.filter(person => person.group === group.group) })).filter(group => group.people.length);
};

/* Missing photos occupy opening-row card positions; later groups cannot fill their vacancies. */
export function openingPortraits(ctx, blocks) {
  if (ctx.prototype || ctx.data.team?.source !== "connect" || !ctx.data.teamState
      || ctx.data.teamState.stale || ctx.data.teamState.unavailable) return [];
  for (const block of blocks.filter(block => block.type === "team")) {
    for (const group of teamGroups(ctx.data.team, block.groups)) {
      const members = group.people;
      return members.slice(0, 4).flatMap((person, index) => person.photo ? [{
        href: publicPhotoSource(person), media: index < 2 ? null : "not all and (max-width: 860px)",
      }] : []);
    }
  }
  return [];
}

/* Public profile photos stay under the bounded proxy; library fixture photos retain responsive variants. */
export function personPhoto(ctx, p, options) {
  if (ctx.data.team?.source !== "connect") return picture(ctx, p.photo, options);
  const source = publicPhotoSource(p);
  const filterId = `portrait-${p.id}-${options.eager ? "profile" : "card"}`;
  const priority = options.eager ? "high" : null;
  return html`<span class="live-portrait"><span class="monogram" aria-hidden="true">${initials(p.name) || "?"}</span><picture class="live-portrait-image"><img${attrs({ src: options.eager ? source : null, "data-src": options.eager ? null : source, "data-team-portrait": "", width: 400, height: 400, alt: "", loading: options.eager ? null : "lazy", fetchpriority: priority, decoding: "async" })}></picture><noscript><svg viewBox="0 0 400 400" aria-hidden="true" focusable="false"><defs><filter id="${filterId}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${source}" x="0" y="0" width="400" height="400" preserveAspectRatio="xMidYMid slice"></feImage></filter></defs><rect width="400" height="400" filter="${`url(#${filterId})`}"></rect></svg></noscript></span>`;
}
