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

   Without JavaScript every card shows, in order, and Additional Details opens in place. The search
   and the topic row under it (Connect's order) appear only when src/client/resources.js runs; it
   also turns Additional Details into a dialog. The records come from a named source:
   content/fixtures/resources.json until Connect publishes a list a director has approved for the
   public site. */

import { html, attrs } from "../html.mjs";
import { link } from "../context.mjs";
import { dateParts } from "../events.mjs";

/* Connect's sixteen resource categories (netlify/lib/builtin-resources.mjs). A topic names one. */
export const CATEGORIES = [
  "mental_emotional_health", "food_essential_needs", "housing", "safety_survivor_support", "financial_support",
  "physical_health", "academic_learning", "identity_belonging", "navigation_general", "career_employment",
  "parenting_child_care", "legal_rights", "disability_access", "technology_access", "transportation", "research_creation",
];
const CAMPUS = ["on_campus", "madison_community", "national"];
const COST = { free: "free", free_or_covered: "covered", reduced_cost: "reduced", paid: "paid", varies: "varies", unknown: "unknown" };
const WHERE = { on_campus: "onCampus", madison_community: "madison", national: "national" };
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

function card(r, ctx, topicOf) {
  const href = r.action?.url || r.url;
  const phone = r.contact?.phone;
  const topic = topicOf.get(r.primaryCategory);
  const where = WHERE[r.location?.campus];
  const more = details(r, ctx);
  return html`<li${attrs({ class: "res-card", "data-res": r.id, "data-cats": (r.categories || []).join(" "), "data-aka": r.aka || null })}>
    <h3>${r.name}</h3>
    ${r.summary ? html`<p class="res-what">${r.summary}</p>` : ""}
    ${r.bestFor ? html`<p class="res-fit"><span class="res-lead">${ctx.t("resources.fit")}</span> ${r.bestFor}</p>` : ""}
    <p class="res-tags">${topic ? html`<span class="res-tag res-topic">${topic}</span>` : ""}<span class="res-tag">${ctx.t(`resources.cost.${COST[r.cost?.code] || "unknown"}`)}</span>${where ? html`<span class="res-tag">${ctx.t(`resources.where.${where}`)}</span>` : ""}</p>
    <div class="res-foot">
      ${href ? link(ctx, href, buttonLabel(r.action, ctx), { class: "btn res-go", icon: "out" }) : ""}
      ${phone ? html`<p class="res-tel"><a href="${tel(phone)}">${phone}</a></p>` : ""}
      ${more.length ? html`<details class="res-more"><summary>${ctx.t("resources.more")}</summary><div class="res-more-body">${more}</div></details>` : ""}
    </div>
  </li>`;
}

export default {
  type: "resources",
  label: "Resource list",
  fields: { title: "text!", lead: "text", source: "source!", topics: "resourcetopics!" },
  data: ["resources"],
  client: "resources.js",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const all = (ctx.data.resources || []).filter((r) => r && r.id && r.name);
    if (!all.length) return html``;
    const topics = (b.topics || []).filter((tp) => all.some((r) => (r.categories || []).includes(tp.category)));
    const topicOf = new Map(topics.map((tp) => [tp.category, tp.label]));
    const rank = (r) => { const i = CAMPUS.indexOf(r.location?.campus); return i < 0 ? CAMPUS.length : i; };
    const list = all.slice().sort((a, z) => rank(a) - rank(z) || a.name.localeCompare(z.name, "en"));
    const n = list.length;
    const updated = ctx.data.resourcesUpdated;
    return html`<section class="resources band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-resources><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  ${ctx.data.resourcesSample ? html`<p class="sample-note">${ctx.data.resourcesSample}</p>` : ""}
  <div class="res-tools" data-res-tools hidden>
    <div class="res-search">
      <label for="${b.id}-q">${ctx.t("resources.search.label")}</label>
      <p class="res-hint" id="${b.id}-qh">${ctx.t("resources.search.hint")}</p>
      <div class="res-search-row"><input id="${b.id}-q" type="search" autocomplete="off" spellcheck="false" aria-describedby="${b.id}-qh" data-res-q><button type="button" class="btn btn--quiet" data-res-clear hidden>${ctx.t("resources.search.clear")}</button></div>
    </div>
    <div class="res-topics" role="group" aria-labelledby="${b.id}-h">
      <button type="button" class="res-topic-btn" aria-pressed="true" data-topic="">${ctx.t("resources.topics.all")}</button>
      ${topics.map((tp) => html`<button${attrs({ type: "button", class: "res-topic-btn", "aria-pressed": "false", "data-topic": tp.id, "data-category": tp.category, "data-aliases": (tp.aliases || []).join(" ") || null })}>${tp.label}</button>`)}
    </div>
  </div>
  <div class="res-status" aria-live="polite"><p class="res-count" data-res-count>${n === 1 ? ctx.t("resources.count.one") : ctx.t("resources.count.all", { n })}</p><p class="res-relaxed" data-res-relaxed hidden>${ctx.t("resources.relaxed")}</p></div>
  <ul class="res-list">${list.map((r) => card(r, ctx, topicOf))}</ul>
  <div class="res-none" data-res-none hidden>
    <h3>${ctx.t("resources.none.title")}</h3>
    <p>${ctx.t("resources.none.body")}</p>
    <button type="button" class="btn btn--quiet" data-res-reset>${ctx.t("resources.none.reset")}</button>
  </div>
  <p class="res-scope">${ctx.t("resources.scope")}${updated ? html` <span class="res-updated">${ctx.t("resources.updated", dateParts(updated, ctx.t))}</span>` : ""}</p>
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
