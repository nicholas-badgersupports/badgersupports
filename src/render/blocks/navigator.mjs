/* The Academic Support Navigator (EXPLORE-G-ACADEMIC-NAV): a few choice questions that end on
   approved resources from the shared library — the same records the Resource Finder shows,
   drawn with its card (src/render/blocks/resources.mjs), so a student meets one card in both
   places. The tree is this block's own content, edited like any other block's words.

   Answers are choices only. Nothing is typed, nothing is stored and nothing is sent anywhere:
   the walk lives in the page (src/client/navigator.js). Without a script every question and
   every result is on the page in order, and each choice is an anchor to the step or the results
   it opens. The full Resource Finder is linked at every step.

   The build refuses a tree that does not join up (navigatorProblems) and a leaf that names a
   resource the library does not hold (navigatorResourceProblems, checked where the library is
   loaded). The navigator finds resources; it is not academic advising, and its words are held
   to that in review. */

import { html, attrs } from "../html.mjs";
import { go } from "../context.mjs";
import { resourceCard, resourceVisible } from "./resources.mjs";

const ID = /^[a-z][a-z0-9-]{1,40}$/;
const nonempty = (v) => typeof v === "string" && !!v.trim();

export function navigatorProblems(b) {
  const out = [];
  const steps = b.steps;
  if (!Array.isArray(steps) || !steps.length) return [`${b.id}: a navigator needs at least one step`];
  const ids = new Set();
  for (const s of steps) {
    if (!ID.test(s?.id || "") || ids.has(s.id)) out.push(`${b.id}: each step needs its own id like start or course`);
    ids.add(s?.id);
    if (!nonempty(s?.prompt)) out.push(`${b.id}: step "${s?.id}" needs its question`);
    if (!Array.isArray(s?.options) || !s.options.length) { out.push(`${b.id}: step "${s?.id}" needs choices`); continue; }
    const oids = new Set();
    for (const o of s.options) {
      if (!ID.test(o?.id || "") || oids.has(o.id)) out.push(`${b.id}: step "${s.id}": each choice needs its own id`);
      oids.add(o?.id);
      if (!nonempty(o?.label)) out.push(`${b.id}: step "${s.id}": every choice needs its words`);
      if ((o?.next != null) === (o?.results != null)) out.push(`${b.id}: step "${s.id}": choice "${o?.id}" goes to one place: a next step or a set of resources`);
      if (o?.results != null && (!Array.isArray(o.results) || !o.results.length)) out.push(`${b.id}: step "${s.id}": choice "${o?.id}" names no resources`);
    }
  }
  if (out.length) return out;
  for (const s of steps) for (const o of s.options) if (o.next != null && !ids.has(o.next)) out.push(`${b.id}: step "${s.id}": choice "${o.id}" goes to step "${o.next}", which is not a step`);
  if (out.length) return out;
  // Every step must be able to reach a set of resources, and every step must be reachable
  // from the first: a step that cannot is a dead end or an orphan an editor cannot see.
  const reaches = new Set(steps.filter((s) => s.options.some((o) => o.results != null)).map((s) => s.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const s of steps) if (!reaches.has(s.id) && s.options.some((o) => o.next != null && reaches.has(o.next))) { reaches.add(s.id); grew = true; }
  }
  for (const s of steps) if (!reaches.has(s.id)) out.push(`${b.id}: step "${s.id}" can never reach a set of resources`);
  const seen = new Set([steps[0].id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const s of steps) if (seen.has(s.id)) for (const o of s.options) if (o.next != null && !seen.has(o.next)) { seen.add(o.next); grew = true; }
  }
  for (const s of steps) if (!seen.has(s.id)) out.push(`${b.id}: step "${s.id}" is not reachable from the first step`);
  return out;
}

/* The leaves against the library itself: every resource a leaf names must be one the library
   holds and shows, or the navigator would end on a card that is not there. */
export function navigatorResourceProblems(b, resources) {
  const held = new Set((resources || []).filter((r) => r && resourceVisible(r)).map((r) => r.id));
  const out = [];
  for (const s of b.steps || []) for (const o of s.options || []) for (const id of o.results || [])
    if (!held.has(id)) out.push(`${b.id}: step "${s.id}": choice "${o.id}" names resource "${id}", which the resource library does not hold`);
  return out;
}

export default {
  type: "navigator",
  label: "Academic Support Navigator",
  fields: { title: "text!", lead: "text", steps: "navsteps!" },
  data: ["resources"],
  client: "navigator.js",
  styles: "navigator.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const byId = new Map((ctx.data.resources || []).filter((r) => r && r.id && resourceVisible(r)).map((r) => [r.id, r]));
    const noTopics = new Map();
    const controls = () => html`<p class="nav-controls" data-nav-controls hidden><button type="button" class="btn btn--quiet" data-nav-back>${ctx.t("navigator.back")}</button><button type="button" class="btn btn--quiet" data-nav-restart>${ctx.t("navigator.startOver")}</button></p>`;
    const finder = () => html`<p class="nav-all">${go(ctx, "/resources/", ctx.t("navigator.all"), "arrow")}</p>`;
    const panel = (attrsObj, inner) => html`<div${attrs(attrsObj)}>${inner}</div>`;
    const steps = (b.steps || []).map((s) => panel({ class: "nav-step", id: `${b.id}-step-${s.id}`, "data-nav-panel": "", "data-nav-step": s.id }, html`
      <h3 class="nav-prompt" id="${b.id}-step-${s.id}-h" tabindex="-1" data-nav-heading>${s.prompt}</h3>
      <ul class="nav-options">${s.options.map((o) => html`<li><a${attrs({ class: "btn nav-opt", href: `#${b.id}-${o.next != null ? `step-${o.next}` : `r-${s.id}-${o.id}`}`, "data-nav-go": o.next != null ? `${b.id}-step-${o.next}` : `${b.id}-r-${s.id}-${o.id}` })}>${o.label}</a></li>`)}</ul>
      ${controls()}
      ${finder()}`));
    const results = (b.steps || []).flatMap((s) => (s.options || []).filter((o) => o.results != null).map((o) => panel({ class: "nav-results", id: `${b.id}-r-${s.id}-${o.id}`, "data-nav-panel": "", "data-nav-results-panel": "" }, html`
      <h3 class="nav-prompt" id="${b.id}-r-${s.id}-${o.id}-h" tabindex="-1" data-nav-heading>${ctx.t("navigator.results")}</h3>
      <ul class="res-list">${o.results.map((id) => byId.get(id)).filter(Boolean).map((r) => resourceCard(r, ctx, noTopics))}</ul>
      ${controls()}
      ${finder()}`)));
    return html`<section class="navigator band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-navigator><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  ${steps}
  ${results}
</div></section>`;
  },
};
