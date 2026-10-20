/* The block library.
 *
 * A block is a module that exports one object:
 *
 *   export default {
 *     type: "schedule",                 // what a page's JSON names in `blocks[].type`
 *     label: "Event timetable",         // what an editor in Connect sees
 *     fields: { title: "text!", ... },  // the editor's form; "!" = required. Checked at build.
 *     data: ["events"],                 // named data sources the block reads (ctx.data.*)
 *     client: "schedule.js",            // optional browser module, loaded only on pages using it
 *     analytics: "none" | "page",       // "none": the block emits nothing; "page": it may emit
 *                                       //  events from docs/ANALYTICS.md's dictionary, nothing else
 *     loading: "eager" | "lazy",        // whether its media may load before it is near the screen
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

export const BLOCKS = Object.fromEntries([announcement, hero, schedule, program, wall, involve, mood, form, text, directions, places, questions, workshops, embed, events, eventhero, expect, cta, team, person, pagehead, cards, words, spill, staff].map((b) => [b.type, b]));

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
      if (!["id", "type", "enabled", "anchor"].includes(key) && !(key in (def.fields || {}))) problems.push(`${at}: ${b.type} has no field "${key}"`);
    }
  }
  return problems;
}

/* The page's blocks that are switched on and inside their dates. */
export function liveBlocks(page, today) {
  return (page.blocks || []).filter((b) => b.enabled !== false && (!b.startsOn || b.startsOn <= today) && (!b.endsOn || today <= b.endsOn));
}
