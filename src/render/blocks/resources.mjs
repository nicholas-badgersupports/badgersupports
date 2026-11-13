/* The resource list: Connect's resource records, one card each, with a row of topics and a search
   above them. The card is Connect's own Find a Resource card (repo/assets/js/app.js findCardHTML
   and findMoreHTML) drawn in this site's colours, so a student who has used one can use the other:
   the name, what it is, who it is for, a topic and two plain chips, one button, the phone number
   as a footnote, and Additional Details.

   The button follows Connect's rules. Its label is the record's own unless that label is a phone
   number, starts with "Call", is longer than eighteen characters or is missing; then it says View
   Details. One rule more than Connect: the button always opens a web page here, so a label for a
   call, a text or an email ("Email Slow Food UW", "Text 988") says View Details too, and the
   number or address stays in the card. A record with no https address gets no button. There is
   never a call button.

   The page carries the first set of cards — the set the script's reveal shows first, safety
   resources never held back — and Additional Details opens in place on them. The whole list
   rides in a data file the build writes beside the page (resources-data.json, registered with
   ctx.defer), and the script fetches it when the visitor first opens, scrolls to, searches or
   filters the list — the site search's pattern (src/render/blocks/sitesearch.mjs); the cards in
   the file are drawn by the same resourceCard as the ones on the page, so a card is written
   once. The search and the topic row under it (Connect's order) appear only when
   src/client/resources.js runs; it also turns Additional Details into a dialog. The records
   come from a named source: content/fixtures/resources.json until Connect publishes a list a
   director has approved for the public site.

   A record may name where it comes from (EXPLORE-C-RESOURCE-FINDER): `source` holds a `kind`
   ("kb" for a UW–Madison KnowledgeBase article, "badger-supports" for one of the organisation's
   own), the `publisher`, the official `url`, a `status` and the review (`reviewedAt`,
   `reviewedBy`, a role and never a name). A card whose record names a source says so, with the
   publisher and the last reviewed date, and its button opens the source's official page. A
   record from outside the organisation's own list shows only while its status is "approved":
   approval is Connect's, and an unapproved record in the export is left out here, never shown
   unlabelled. A record with no source keeps the card it has always had. */

import { html, attrs } from "../html.mjs";
import { link, go } from "../context.mjs";
import { dateParts } from "../events.mjs";
import { icon } from "../icons.mjs";
import { picture } from "../media.mjs";

/* Connect's sixteen resource categories (netlify/lib/builtin-resources.mjs). A topic names one. */
export const CATEGORIES = [
  "mental_emotional_health", "food_essential_needs", "housing", "safety_survivor_support", "financial_support",
  "physical_health", "academic_learning", "identity_belonging", "navigation_general", "career_employment",
  "parenting_child_care", "legal_rights", "disability_access", "technology_access", "transportation", "research_creation",
];
const CAMPUS = ["on_campus", "madison_community", "national"];
const COST = { free: "free", free_or_covered: "covered", reduced_cost: "reduced", paid: "paid", varies: "varies", unknown: "unknown" };
const WHERE = { on_campus: "onCampus", madison_community: "madison", national: "national" };
/* Connect's ways to reach a resource (its modality), as the Access filter's options. */
const HOW = { in_person: "person", virtual: "online", phone: "phone", text: "text", chat: "text", email: "email" };
/* The filters under the topics, after Badger SPILL's and Connect's Resources page: within a group any pressed
   option matches; across groups every group must. An option no card carries is not offered. */
const FILTERS = [
  { id: "cost", label: "resources.filters.cost", options: ["free"], key: (o) => `resources.cost.${o}` },
  { id: "where", label: "resources.filters.where", options: ["onCampus", "madison", "national"], key: (o) => `resources.where.${o}` },
  { id: "how", label: "resources.filters.how", options: ["person", "online", "phone", "text", "email"], key: (o) => `resources.how.${o}` },
];
const valuesOf = (r) => ({ cost: [COST[r.cost?.code]].filter(Boolean), where: [WHERE[r.location?.campus]].filter(Boolean), how: [...new Set([].concat(r.modality || []).map((m) => HOW[m]).filter(Boolean))] });

/* How many cards the page itself carries; the rest ride in the data file. The script's
   reveal page (src/client/resources.js, PAGE), so the first view is one set on both sides. */
const PAGE = 12;

const KEYPAD = { A: 2, B: 2, C: 2, D: 3, E: 3, F: 3, G: 4, H: 4, I: 4, J: 5, K: 5, L: 5, M: 6, N: 6, O: 6, P: 7, Q: 7, R: 7, S: 7, T: 8, U: 8, V: 8, W: 9, X: 9, Y: 9, Z: 9 };

/* A number spelt in letters ("414-939-HOPE") dials each letter as its key; Connect's digits-only
   rule would dial six digits. */
const tel = (phone) => "tel:" + String(phone).toUpperCase().replace(/[A-Z]/g, (c) => KEYPAD[c]).replace(/[^0-9+]/g, "");

function buttonLabel(action, ctx) {
  const l = String(action?.label || "").trim();
  if (!l || /^call\b/i.test(l) || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(l) || l.length > 18) return ctx.t("resources.view");
  if (["call", "text", "email"].includes(action.channel) || /^(text|email)\b/i.test(l)) return ctx.t("resources.view");
  return l;
}

/* Additional Details, as Connect builds it: no fact twice. A line is left out when, with case,
   punctuation and a leading "Label:" removed, it repeats or begins one already shown. */
function details(r, ctx) {
  const seen = [];
  const norm = (s) => String(s || "").toLowerCase().replace(/^[a-z][a-z ]{0,18}:\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const fresh = (s) => {
    const n = norm(s);
    if (!n || seen.some((x) => n === x || n.startsWith(x) || x.startsWith(n))) return false;
    seen.push(n);
    return true;
  };
  const row = (key, value) => html`<p><b>${ctx.t(`resources.detail.${key}`)}</b> ${value}</p>`;
  fresh(r.summary);
  fresh(r.bestFor);
  const out = [];
  const phone = r.contact?.phone;
  const email = r.contact?.email;
  if (r.nextStep && fresh(r.nextStep)) out.push(html`<p>${r.nextStep}</p>`);
  if (phone) out.push(row("phone", html`<a href="${tel(phone)}">${phone}</a>`));
  if (r.limitations && fresh(r.limitations)) out.push(html`<p>${r.limitations}</p>`);
  if (r.eligibility && fresh(r.eligibility)) out.push(row("who", r.eligibility));
  if (r.hours && fresh(r.hours)) out.push(row("hours", r.hours));
  if (r.location?.where && fresh(r.location.where)) out.push(row("where", r.location.where));
  if (email) out.push(row("email", html`<a href="mailto:${email}">${email}</a>`));
  if (r.cost?.note && fresh(r.cost.note)) out.push(row("cost", r.cost.note));
  return out;
}

/* The button's words. View Details on sixty cards would be sixty links a screen reader lists alike,
   so a reader also hears whose details they are (WCAG 2.4.4's best practice). */
function button(r, ctx) {
  const label = buttonLabel(r.action, ctx);
  return label === ctx.t("resources.view") ? html`${label}<span class="sr-only">: ${r.name}</span>` : label;
}

/* A report about one resource opens its form's page with the resource chosen by the address
   (?resource=, src/client/form.js). A screen reader hears which resource, as with View Details. */
function reportLink(ctx, form, r, label) {
  const to = ctx.link(`/forms/${form}/`);
  const href = to.pending ? to.href : `${to.href}?resource=${encodeURIComponent(r.id)}`;
  return html`<a${attrs({ href, "data-pending": to.pending ? "" : null })}>${label}<span class="sr-only">: ${r.name}</span></a>`;
}

/* Whether a record shows at all: one naming a source shows only under Connect's approval
   (EXPLORE-C). No source, no condition: the record is one of the list's own, as before. */
export const resourceVisible = (r) => {
  const s = r?.source;
  if (!s || typeof s !== "object") return true;
  if (s.status != null) return s.status === "approved";
  return s.kind == null || s.kind === "badger-supports";
};

const SOURCE_NAMES = { kb: "resources.source.kb", "badger-supports": "resources.source.badger" };

/* The source line on a card whose record names one: the source, the publisher when it adds
   anything, and the date the record was last reviewed. */
function sourceLine(r, ctx) {
  const s = r.source;
  if (!s || typeof s !== "object") return "";
  const name = SOURCE_NAMES[s.kind] ? ctx.t(SOURCE_NAMES[s.kind]) : (s.publisher || "");
  if (!name) return "";
  const pub = s.publisher && s.publisher !== name ? ` · ${s.publisher}` : "";
  const reviewed = s.reviewedAt ? ` · ${ctx.t("resources.reviewed", dateParts(s.reviewedAt, ctx.t))}` : "";
  return html`<p class="res-source"><span class="res-lead">${ctx.t("resources.source")}</span> ${name}${pub}${reviewed}</p>`;
}

export function resourceCard(r, ctx, topicOf) {
  const href = r.source?.url || r.action?.url || r.url;
  const phone = r.contact?.phone;
  const topic = topicOf.get(r.primaryCategory);
  const where = WHERE[r.location?.campus];
  const more = [...details(r, ctx), html`<p class="res-report">${reportLink(ctx, "resource-problem", r, ctx.t("resources.report.problem"))}${reportLink(ctx, "resource-update", r, ctx.t("resources.report.update"))}</p>`];
  const v = valuesOf(r);
  return html`<li${attrs({ class: "res-card", "data-res": r.id, "data-cats": (r.categories || []).join(" "), "data-aka": r.aka || null, "data-cost": v.cost.join(" ") || null, "data-where": v.where.join(" ") || null, "data-how": v.how.join(" ") || null })}>
    ${r.photo && ctx.media.has(r.photo) ? html`<div class="photo res-photo">${picture(ctx, r.photo, { sizes: "(max-width: 560px) calc(100vw - 2rem), 23rem" })}</div>` : ""}
    <h3>${r.name}</h3>
    ${r.summary ? html`<p class="res-what">${r.summary}</p>` : ""}
    ${r.bestFor ? html`<p class="res-fit"><span class="res-lead">${ctx.t("resources.fit")}</span> ${r.bestFor}</p>` : ""}
    ${sourceLine(r, ctx)}
    <p class="res-tags">${topic ? html`<span class="res-tag res-topic">${topic}</span>` : ""}${COST[r.cost?.code] && COST[r.cost.code] !== "unknown" ? html`<span class="res-tag">${ctx.t(`resources.cost.${COST[r.cost.code]}`)}</span>` : ""}${where ? html`<span class="res-tag">${ctx.t(`resources.where.${where}`)}</span>` : ""}</p>
    <div class="res-foot">
      ${href ? link(ctx, href, button(r, ctx), { class: "btn res-go", icon: "out" }) : ""}
      ${phone ? html`<p class="res-tel"><a href="${tel(phone)}">${phone}</a></p>` : ""}
      ${more.length ? html`<details class="res-more"><summary>${ctx.t("resources.more")}</summary><div class="res-more-body">${more}</div></details>` : ""}
    </div>
  </li>`;
}

export default {
  type: "resources",
  label: "Resource list",
  fields: { title: "text!", lead: "text", source: "source!", topics: "resourcetopics!", feedback: "paragraphs", feedbackLink: "link" },
  data: ["resources", "resourcesSample", "resourcesUpdated", "resourcesState"],
  client: "resources.js",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const all = (ctx.data.resources || []).filter((r) => r && r.id && r.name && resourceVisible(r));
    if (!all.length) return html`<section class="resources band" aria-labelledby="${b.id}-h" data-block="${b.id}"><div class="wrap">
      <h2 id="${b.id}-h">${b.title}</h2>
      <p>${ctx.t(ctx.data.resourcesState?.stale ? "resources.unavailable" : "resources.empty")}</p>
      <p>${go(ctx, "mailto:directors@badgersupports.org", ctx.t("resources.contact"))}</p>
    </div></section>`;
    const topics = (b.topics || []).filter((tp) => all.some((r) => (r.categories || []).includes(tp.category)));
    const topicOf = new Map(topics.map((tp) => [tp.category, tp.label]));
    const rank = (r) => { const i = CAMPUS.indexOf(r.location?.campus); return i < 0 ? CAMPUS.length : i; };
    const list = all.slice().sort((a, z) => rank(a) - rank(z) || a.name.localeCompare(z.name, "en"));
    const n = list.length;
    /* The first set the page itself carries: the set the script's reveal (src/client/
       resources.js, PAGE) shows first — the first PAGE in order, a safety resource never
       held back by the count. The whole list is held back for the script to fetch on first
       use, its cards drawn by the same resourceCard. */
    let seen = 0;
    const first = list.filter((r) => {
      if ((r.categories || []).includes("safety_survivor_support")) return true;
      seen++;
      return seen <= PAGE;
    });
    ctx.defer({
      file: "resources-data.json",
      body: JSON.stringify({ schema: "bss.resources-data/1", cards: list.map((r) => String(resourceCard(r, ctx, topicOf))) }) + "\n",
    });
    const updated = ctx.data.resourcesUpdated;
    const carried = Object.fromEntries(FILTERS.map((g) => [g.id, new Set(list.flatMap((r) => valuesOf(r)[g.id]))]));
    const groups = FILTERS.map((g) => ({ ...g, options: g.options.filter((o) => carried[g.id].has(o)) })).filter((g) => g.options.length);
    return html`<section class="resources band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-resources data-res-src="${ctx.path || ""}resources-data.json"><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  ${ctx.data.resourcesState?.stale ? html`<p class="sample-note">${ctx.t("resources.stale")}</p>` : ""}
  ${ctx.data.resourcesSample ? html`<p class="sample-note">${ctx.data.resourcesSample}</p>` : ""}
  <div class="res-tools" data-res-tools hidden>
    <div class="res-search">
      <label for="${b.id}-q">${ctx.t("resources.search.label")}</label>
      <p class="res-hint" id="${b.id}-qh">${ctx.t("resources.search.hint")}</p>
      <div class="res-search-row">
        <div class="res-field">${icon("search", "res-field-ic")}<input id="${b.id}-q" type="search" autocomplete="off" spellcheck="false" aria-describedby="${b.id}-qh" data-res-q><button type="button" class="res-qclear" aria-label="${ctx.t("resources.search.clear")}" title="${ctx.t("resources.search.clear")}" data-res-clear hidden>${icon("close")}</button></div>
        ${groups.length ? html`<button type="button" class="res-filter-toggle" aria-expanded="false" aria-controls="${b.id}-filters" data-res-ftoggle>${icon("sliders", "res-ftoggle-ic")}<span>${ctx.t("resources.filters.toggle")}</span><span class="res-fcount" data-res-fcount hidden></span></button>` : ""}
      </div>
    </div>
    <div class="res-topics" role="group" aria-labelledby="${b.id}-h">
      <button type="button" class="res-topic-btn" aria-pressed="true" data-topic="">${ctx.t("resources.topics.all")}</button>
      ${topics.map((tp) => html`<button${attrs({ type: "button", class: "res-topic-btn", "aria-pressed": "false", "data-topic": tp.id, "data-category": tp.category, "data-aliases": (tp.aliases || []).join(" ") || null })}>${tp.label}</button>`)}
    </div>
    ${groups.length ? html`<div class="res-filters">
      <div class="res-filter-panel" id="${b.id}-filters" data-res-fpanel>${groups.map((g) => html`<div class="res-fgroup" role="group" aria-labelledby="${b.id}-f-${g.id}"><p class="res-flabel" id="${b.id}-f-${g.id}">${ctx.t(g.label)}</p><div class="res-fopts">${g.options.map((o) => html`<button type="button" class="res-topic-btn res-fopt" aria-pressed="false" data-fgroup="${g.id}" data-fopt="${o}">${ctx.t(g.key(o))}</button>`)}</div></div>`)}</div>
    </div>` : ""}
    <div class="res-active" data-res-active hidden><p class="res-active-label">${ctx.t("resources.active")}</p><ul class="res-chips" data-res-chips><li aria-hidden="true"><span class="res-chip res-chip-ph">&nbsp;</span></li></ul><button type="button" class="btn btn--quiet res-clearall" data-res-clearall>${ctx.t("resources.clearAll")}</button></div>
  </div>
  <div class="res-status" aria-live="polite"><p class="res-count" data-res-count tabindex="-1">${n === 1 ? ctx.t("resources.count.one") : ctx.t("resources.count.all", { n })}</p><p class="res-relaxed" data-res-relaxed hidden>${ctx.t("resources.relaxed")}</p></div>
  <p class="res-again" data-res-again hidden><button type="button" class="btn btn--quiet" data-res-retry>${ctx.t("resources.retry")}</button></p>
  <ul class="res-list">${first.map((r) => resourceCard(r, ctx, topicOf))}</ul>
  <p class="res-more-row" data-res-more-row hidden><button type="button" class="btn res-more-btn" data-res-more>${ctx.t("resources.showMore")}</button></p>
  <div class="res-none" data-res-none hidden>
    <h3>${ctx.t("resources.none.title")}</h3>
    <p>${ctx.t("resources.none.body")}</p>
    <button type="button" class="btn btn--quiet" data-res-reset>${ctx.t("resources.none.reset")}</button>
  </div>
  <div class="res-closing">
    <p class="res-scope">${ctx.t("resources.scope")}${updated ? html` <span class="res-updated">${ctx.t("resources.updated", dateParts(updated, ctx.t))}</span>` : ""}</p>
    <p class="res-suggest">${link(ctx, "/forms/resource-suggestion/", ctx.t("resources.report.suggest"), { class: "btn" })}</p>
    ${(b.feedback || []).map((p) => html`<p>${p}</p>`)}
    ${b.feedbackLink ? html`<p class="res-feedback-link">${link(ctx, b.feedbackLink.href, b.feedbackLink.label, { class: "btn btn--quiet" })}</p>` : ""}
  </div>
  <dialog class="res-dialog" aria-labelledby="${b.id}-dh" data-res-dialog>
    <div class="res-dialog-head"><h2 id="${b.id}-dh" data-res-dtitle></h2><button type="button" class="btn btn--quiet res-close" data-res-close>${ctx.t("resources.close")}</button></div>
    <div class="res-dialog-body" data-res-dbody></div>
  </dialog>
</div></section>`;
  },
};

/* Why a resource list cannot be published, as a list of reasons. */
export function resourceProblems(b) {
  const out = [];
  const ids = new Set();
  const cats = new Set();
  if (!Array.isArray(b.topics) || !b.topics.length) return [`${b.id}: a resource list needs its topics`];
  for (const [i, tp] of b.topics.entries()) {
    const at = `${b.id}: topics[${i}]`;
    if (!tp || typeof tp !== "object") { out.push(`${at}: a topic is an object`); continue; }
    for (const id of [tp.id, ...(tp.aliases || [])]) {
      if (!/^[a-z][a-z0-9-]{1,40}$/.test(id || "")) out.push(`${at}: "${id}" must be lower-case letters, digits and hyphens (it is the topic's web address)`);
      else if (ids.has(id)) out.push(`${at}: "${id}" names two topics`);
      ids.add(id);
    }
    if (typeof tp.label !== "string" || !tp.label.trim()) out.push(`${at}: a topic needs a label`);
    if (!CATEGORIES.includes(tp.category)) out.push(`${at}: category must be one of ${CATEGORIES.join(", ")}`);
    else if (cats.has(tp.category)) out.push(`${at}: two topics name ${tp.category}`);
    cats.add(tp.category);
    if (tp.aliases != null && !Array.isArray(tp.aliases)) out.push(`${at}: aliases are a list`);
  }
  return out;
}
