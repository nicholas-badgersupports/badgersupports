/* The block library.
 *
 * A block is a module that exports one object:
 *
 *   export default {
 *     type: "schedule",                 // what a page's JSON names in `blocks[].type`
 *     label: "Event timetable",         // what an editor in Connect sees
 *     fields: { title: "text!", ... },  // the editor's form; "!" = required. Checked at build.
 *     data: ["events"],                 // named data sources the block reads (ctx.data.*); reading
 *                                       //  any other stops the build (renderBlock below)
 *     client: "schedule.js",            // optional browser module, loaded only on pages using it
 *     styles: "schedule.css",           // optional: its rules in src/styles/blocks/, else in blocks.css
 *     analytics: "none" | "page",       // "none": the block emits nothing; "page": it may emit
 *                                       //  events from docs/ANALYTICS.md's dictionary, nothing else
 *     loading: "eager" | "lazy",        // whether its media may load before it is near the screen
 *     refresh: true | (block) => bool,  // optional: shown again from Connect's current events
 *                                       //  between publishes (netlify/lib/live-events.mjs). Its
 *                                       //  section keeps data-block; a part marked data-live is
 *                                       //  swapped alone when the rest is unchanged
 *     render(block, ctx) { return html`…` },
 *   };
 *
 * Adding a block is: write the module, add it to BLOCKS below, add its fields to the Connect
 * editor contract (docs/CONNECT-EDITOR-CONTRACT.md is generated from these declarations). No other
 * file changes. docs/EXTENDING.md walks through one.
 */

import announcement from "./blocks/announcement.mjs";
import hero from "./blocks/hero.mjs";
import schedule from "./blocks/schedule.mjs";
import program from "./blocks/program.mjs";
import wall from "./blocks/wall.mjs";
import involve from "./blocks/involve.mjs";
import mood from "./blocks/mood.mjs";
import form from "./blocks/form.mjs";
import text from "./blocks/text.mjs";
import directions from "./blocks/directions.mjs";
import places from "./blocks/places.mjs";
import questions from "./blocks/questions.mjs";
import workshops from "./blocks/workshops.mjs";
import embed from "./blocks/embed.mjs";
import events from "./blocks/events.mjs";
import eventhero from "./blocks/eventhero.mjs";
import expect from "./blocks/expect.mjs";
import cta from "./blocks/cta.mjs";
import team from "./blocks/team.mjs";
import staff from "./blocks/staff.mjs";
import person from "./blocks/person.mjs";
import pagehead from "./blocks/pagehead.mjs";
import cards from "./blocks/cards.mjs";
import words from "./blocks/words.mjs";
import spill from "./blocks/spill.mjs";
import resources from "./blocks/resources.mjs";
import directory from "./blocks/directory.mjs";

export const BLOCKS = Object.fromEntries([announcement, hero, schedule, program, wall, involve, mood, form, text, directions, places, questions, workshops, embed, events, eventhero, expect, cta, team, person, pagehead, cards, words, spill, staff, resources, directory].map((b) => [b.type, b]));

/* What every block may carry besides its declared fields. */
export const COMMON_FIELDS = ["id", "type", "enabled", "anchor", "startsOn", "endsOn"];

const isDate = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/* Every problem a page's blocks have against the declarations. The build refuses a page with any. */
export function blockProblems(page) {
  const problems = [];
  const ids = new Set();
  for (const b of page.blocks || []) {
    const at = `${page.id}.${b.id || "?"}`;
    if (!/^b-[a-z0-9-]{2,60}$/.test(String(b.id || ""))) problems.push(`${at}: block id must look like b-something`);
    if (ids.has(b.id)) problems.push(`${at}: duplicate block id`);
    ids.add(b.id);
    const def = BLOCKS[b.type];
    if (!def) { problems.push(`${at}: unknown block type "${b.type}"`); continue; }
    for (const [name, spec] of Object.entries(def.fields || {})) {
      if (spec.endsWith("!") && (b[name] == null || b[name] === "")) problems.push(`${at}: ${b.type} needs "${name}"`);
    }
    for (const key of Object.keys(b)) {
      if (!COMMON_FIELDS.includes(key) && !(key in (def.fields || {}))) problems.push(`${at}: ${b.type} has no field "${key}"`);
    }
    for (const key of ["startsOn", "endsOn"]) if (b[key] != null && !isDate(b[key])) problems.push(`${at}: ${key} must be a date written YYYY-MM-DD`);
    if (isDate(b.startsOn) && isDate(b.endsOn) && b.startsOn > b.endsOn) problems.push(`${at}: startsOn is after endsOn, so the block would never show`);
  }
  return problems;
}

/* The page's blocks that are switched on and inside their dates (both included, Chicago time). A date takes
   effect when the site is built: a block that ends on the 10th still shows until the next publish after it. */
/* Whether this block on a page is one the events refresh renders again. */
export function refreshes(b) {
  const r = BLOCKS[b.type]?.refresh;
  return typeof r === "function" ? !!r(b) : !!r;
}

export function liveBlocks(page, today) {
  return (page.blocks || []).filter((b) => b.enabled !== false && (!b.startsOn || b.startsOn <= today) && (!b.endsOn || today <= b.endsOn));
}

/* One block's markup. The block sees only the data sources it declares: reading another stops the build, so
   `data` is the whole of what a block depends on. ctx stays the same object (team.mjs keys a WeakSet on it);
   only ctx.data is swapped, for the length of the render, which is synchronous. */
export function renderBlock(b, ctx) {
  const def = BLOCKS[b.type];
  const all = ctx.data;
  const check = (key) => {
    if (typeof key === "string" && !def.data.includes(key)) throw new Error(`block ${b.id} (${b.type}) reads ctx.data.${key}, which ${b.type} does not declare: add "${key}" to its data list`);
  };
  ctx.data = new Proxy(all, {
    get(t, key) { check(key); return t[key]; },
    has(t, key) { check(key); return key in t; },
  });
  try { return def.render(b, ctx); } finally { ctx.data = all; }
}
