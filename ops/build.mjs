/* The build: content in, a static site out.
 *
 *   node ops/build.mjs                       # the prototype: fixtures allowed, noindex everywhere
 *   node ops/build.mjs --today=2026-10-20    # pin "today" (screenshots, tests)
 *   node ops/build.mjs --production          # the published site: events and resources from
 *                                            # Connect (no build without it), no sample notes or
 *                                            # people, and nothing still left on the live site
 *                                            # (cutoverProblems)
 *   node ops/build.mjs --launch              # the prototype with the forms as they launch: closed,
 *                                            # each page linking its Google Form (--production does this too)
 *   node ops/build.mjs --text-edits=FILE     # apply published text edits ({ key: text }) over
 *                                            # content/text.json, as Connect's publish will
 *   node ops/build.mjs --edits=FILE          # lay words changed with the edit button over the
 *                                            # content (src/shared/edits.mjs); without the flag the
 *                                            # build reads content/edits.json when there is one
 *   node ops/build.mjs --connect             # read the events and resources from Connect, as
 *                                            # --production always does (ops/connect-feed.mjs)
 *   node ops/build.mjs --fetch-media         # download any photo original missing from local/
 *                                            # (sha256-checked) and fetch any linked photo not
 *                                            # yet in local/media-links/, as a Netlify build must
 *
 * It refuses to write anything when a page, room or form definition has a problem: every block
 * is checked against its declaration (src/render/registry.mjs), every room against
 * src/render/places.mjs and every form against the form rules (src/shared/forms.mjs). Every
 * published room in content/places/ becomes a page at /directions/<id>/. Output:
 *
 *   dist/                     the site Netlify would publish
 *   dist/assets/css/site.<hash>.css, dist/assets/js/<hash>/…   cached forever
 *   dist/media/               image variants (ops/media.mjs), cached forever
 *   dist/calendar/<event>.ics one calendar file per upcoming dated event (src/render/ics.mjs)
 *   dist/_headers, _redirects, robots.txt
 *   .build/server.json        what the intake API needs to render a page: asset names, site
 *                             content, form definitions, and every editable word as built and as
 *                             shipped (for the edit button). Bundled into the function.
 *   .build/report.json        pages, links still pointing at the live site, image weights
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import url from "node:url";
import { blockProblems, BLOCKS, refreshes } from "../src/render/registry.mjs";
import { workshopProblems } from "../src/render/blocks/workshops.mjs";
import { embedProblems } from "../src/render/blocks/embed.mjs";
import { cardProblems } from "../src/render/blocks/cards.mjs";
import { wordProblems } from "../src/render/blocks/words.mjs";
import { resourceProblems } from "../src/render/blocks/resources.mjs";
import { directoryProblems } from "../src/render/blocks/directory.mjs";
import { ICONS } from "../src/render/icons.mjs";
import { makeContext, chicagoDate, PROGRAMS } from "../src/render/context.mjs";
import { renderPage, INLINE_JS } from "../src/render/layout.mjs";
import { mediaCss, photoRef, photoProblems, photoSlots } from "../src/render/media.mjs";
import { definitionProblems, launchForms } from "../src/shared/forms.mjs";
import { textProblems, resolveText, makeT } from "../src/shared/text.mjs";
import { applyEdits, readEditsFile, pageStrings, siteStrings, textStrings, pageValues, siteValues } from "../src/shared/edits.mjs";
import { placeProblems, placePages, eventPlaces, eventPlaceProblems } from "../src/render/places.mjs";
import { formPreviewPages } from "../src/render/blocks/form.mjs";
import { teamProblems, personPages, publicPeople, teamRedirects, GROUPS, TEAM_PATH } from "../src/render/team.mjs";
import { buildMedia, buildLinks, linkPlaceholders, loadManifest } from "./media.mjs";
import { nextDated } from "../src/render/events.mjs";
import { eventIcs, icsPath } from "../src/render/ics.mjs";
import { feedConfig, feedRuleProblems, readConnectFeed, seriesIds } from "./connect-feed.mjs";
import { pagePrograms, sectionPrograms, siteSnapshot } from "../src/render/site.mjs";

export const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const CSS_ORDER = ["tokens.css", "base.css", "layout.css", "blocks.css", "forms.css", "motion.css"];

/* The block stylesheets, as paths under src/styles/. Each block that declares `styles` names a file in
   src/styles/blocks/, and every file there belongs to a block: a missing or orphaned one stops the build. */
export function blockStyles(dir = path.join(ROOT, "src/styles/blocks"), blocks = BLOCKS) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".css")) : [];
  const named = Object.values(blocks).filter((b) => b.styles).map((b) => [b.type, b.styles]);
  const problems = [
    ...named.filter(([, f]) => !files.includes(f)).map(([t, f]) => `block ${t} names styles ${f}, which is not in src/styles/blocks/`),
    ...files.filter((f) => !named.some(([, n]) => n === f)).map((f) => `src/styles/blocks/${f} belongs to no block: name it in a block's \`styles\`, or move its rules to blocks.css`),
  ];
  if (problems.length) throw new Error(problems.join("\n"));
  return named.map(([, f]) => `blocks/${f}`);
}

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const readDir = (p) => fs.readdirSync(path.join(ROOT, p)).filter((f) => f.endsWith(".json")).sort();
const hash = (s, n = 10) => crypto.createHash("sha256").update(s).digest("hex").slice(0, n);

/* The parsers that take the notes out of what browsers are sent (X2): clean-css for the stylesheet, terser for
   the scripts. Exact-pinned dev dependencies; a build without them stops and says how to install them. */
export const MINIFIERS = { terser: "5.51.2", "clean-css": "5.3.3", acorn: "8.19.0" };
async function minifiers() {
  const missing = [];
  const load = async (name) => { try { return await import(name); } catch { missing.push(`${name}@${MINIFIERS[name]}`); return null; } };
  const [terser, CleanCSS] = [await load("terser"), await load("clean-css")];
  await load("acorn");
  if (missing.length) throw new Error(`The build takes the notes out of what browsers are sent, and needs ${missing.join(", ")}. Install them: npm install --save-dev --save-exact ${Object.entries(MINIFIERS).map(([n, v]) => `${n}@${v}`).join(" ")}`);
  return {
    // level 1 only: whitespace and comments out, nothing reordered or merged
    css(text) {
      const out = new (CleanCSS.default || CleanCSS)({ level: 1, inline: false, rebase: false }).minify(text);
      if (out.errors.length) throw new Error(`the stylesheet could not be read: ${out.errors.join("; ")}`);
      return out.styles;
    },
    // parsed as a module: comments and spacing out, every name and import kept, nothing rewritten
    async js(text, name) {
      const out = await terser.minify(text, { module: true, compress: false, mangle: false, format: { comments: /^!|@license/ } });
      if (out.code === undefined) throw new Error(`${name} could not be read`);
      return out.code;
    },
  };
}

/* What may ship in dist/, and nothing else (X2). A file outside this list stops the build. */
export const SHIPS = [
  /^(?:[a-z0-9-]+\/)*index\.html$/, /^404\.html$/, /^_headers$/, /^_redirects$/, /^robots\.txt$/, /^sitemap\.xml$/,
  /^assets\/css\/site\.[0-9a-f]{10}\.css$/, /^assets\/js\/[0-9a-f]{10}\/[a-z0-9-]+\.(?:js|mjs)$/,
  /^assets\/fonts\/[A-Za-z0-9-]+\.woff2$/, /^assets\/fonts\/[A-Za-z0-9-]+\.txt$/,
  /^assets\/brand\/[a-z0-9-]+\.(?:png|jpg|webp|svg)$/, /^assets\/brand\/[A-Z-]+\.txt$/, /^assets\/icons\/[a-z0-9-]+\.svg$/,
  /^media\/[A-Za-z0-9._-]+\.(?:avif|webp|jpg|png)$/, /^calendar\/[A-Za-z0-9_-]+\.ics$/,
];

/* Every note, map or file a browser should not be sent, as sentences. Comments are found by parsing (acorn for
   scripts, a tokenizer that knows strings for the stylesheet), never by deleting text. A licence comment
   (/*! … or @license) is allowed. */
export async function deliveredProblems(out, { serverDir = null } = {}) {
  const { Parser } = await import("acorn");
  const problems = [];
  // a test may write the server's file inside its output; a real build writes it to .build/, outside dist/
  const own = serverDir && serverDir.startsWith(out + path.sep) ? path.relative(out, serverDir).split(path.sep).join("/") + "/" : null;
  const files = fs.readdirSync(out, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.relative(out, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join("/")).filter((f) => !own || !f.startsWith(own));
  for (const f of files) {
    if (!SHIPS.some((re) => re.test(f))) { problems.push(`${f}: not on the list of what ships`); continue; }
    if (!/\.(?:html|css|js|mjs|svg|txt|xml|ics)$|^_headers$|^_redirects$/.test(f)) continue;
    const text = fs.readFileSync(path.join(out, f), "utf8");
    if (/[#@]\s*source(?:Mapping)?URL=/.test(text) || /^SourceMap:/im.test(text)) problems.push(`${f}: names a source map`);
    if (/\.(?:js|mjs)$/.test(f)) {
      try {
        Parser.parse(text, { ecmaVersion: "latest", sourceType: "module", onComment: (block, body) => { if (!/^!|@license/.test(body)) problems.push(`${f}: a comment: ${body.trim().slice(0, 40)}`); } });
      } catch (e) { problems.push(`${f}: cannot be read as a module (${e.message})`); }
    }
    if (f.endsWith(".css")) for (const c of cssComments(text)) if (!c.startsWith("!")) problems.push(`${f}: a comment: ${c.trim().slice(0, 40)}`);
    if (/\.(?:html|svg)$/.test(f) && /<!--|<metadata\b|\b(?:inkscape|sodipodi):/.test(text)) problems.push(`${f}: an HTML or SVG comment or editor's metadata`);
  }
  return problems;
}

function cssComments(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") { for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++; continue; }
    if (c === "/" && text[i + 1] === "*") { const end = text.indexOf("*/", i + 2); out.push(text.slice(i + 2, end < 0 ? undefined : end)); i = end < 0 ? text.length : end + 1; }
  }
  return out;
}

/* The edits file a build lays over the content when it is given none: content/edits.json, if any. */
export function shippedEdits() {
  const f = path.join(ROOT, "content/edits.json");
  return fs.existsSync(f) ? readEditsFile(JSON.parse(fs.readFileSync(f, "utf8"))) : {};
}

/* Everything the build and the API read, loaded and checked. Throws with the full list.
   `feed` is Connect's public lists as ops/connect-feed.mjs maps them ({ events, resources }); without
   it the events and resources are the hand-typed fixtures, which a production build refuses. */
export function loadContent({ production = false, launch = production, textEdits = {}, edits = shippedEdits(), feed = null } = {}) {
  const site = readJson("content/site.json");
  const textRegistry = readJson("content/text.json");
  const routes = readJson("content/routes.json").routes;
  const media = loadManifest();
  const mediaIds = new Set(media.items.map((m) => m.id));
  // Every photo slot that holds a link instead of a library id, fetched once by the build.
  const links = new Map();
  const photos = (record, where) => {
    for (const s of photoSlots(record)) {
      const bad = photoProblems(s.ref, { media: mediaIds, production });
      for (const p of bad) problems.push(`${where}: ${s.at}: ${p}`);
      const r = photoRef(s.ref);
      if (!bad.length && r.link && !links.has(r.id)) links.set(r.id, r);
    }
  };
  const mood = readJson("content/widgets/mood.json");
  const forms = {};
  const pages = [];
  const problems = [];

  for (const f of readDir("content/forms")) {
    const def = readJson(`content/forms/${f}`);
    if (`${def.key}.json` !== f) problems.push(`content/forms/${f}: key "${def.key}" does not match the file name`);
    for (const p of definitionProblems(def)) problems.push(`content/forms/${f}: ${p.code} at ${p.at || "(form)"}`);
    forms[def.key] = def;
  }

  // Words changed with the edit button go over the files before anything is checked, so an edited
  // page is held to the same rules. The files stay the floor: the edit button can put them back.
  const files = readDir("content/pages").map((f) => ({ f, page: readJson(`content/pages/${f}`) }));
  const floorText = Object.fromEntries(Object.entries(textRegistry.text).map(([k, v]) => [k, v.text]));
  const floor = { site: structuredClone(site), pages: files.map((x) => structuredClone(x.page)) };
  const overlay = applyEdits(edits, { site, pages: files.map((x) => x.page), text: floorText }, { media: mediaIds });
  const givenTextEdits = textEdits;
  textEdits = { ...textEdits, ...overlay.textEdits };

  const ids = new Set();
  const paths = new Set();
  for (const { f, page } of files) {
    const at = `content/pages/${f}`;
    if (page.schema !== "bss.page/1") problems.push(`${at}: schema must be bss.page/1`);
    if (!/^pg-[a-z0-9-]{2,60}$/.test(page.id || "")) problems.push(`${at}: page id must look like pg-something`);
    if (ids.has(page.id)) problems.push(`${at}: duplicate page id ${page.id}`);
    ids.add(page.id);
    if (!page.file && !/^\/([a-z0-9-]+\/)*$/.test(page.path || "")) problems.push(`${at}: path must start and end with "/" and use a–z, 0–9 and hyphens`);
    if (paths.has(page.path)) problems.push(`${at}: duplicate path ${page.path}`);
    paths.add(page.path);
    if (!page.title) problems.push(`${at}: needs a title`);
    if (page.program !== undefined && !PROGRAMS.includes(page.program)) problems.push(`${at}: program is one of ${PROGRAMS.join(", ")}, or left out for brand red`);
    for (const p of blockProblems(page)) problems.push(`${at}: ${p}`);
    for (const b of page.blocks || []) {
      if (b.type === "form" && !forms[b.form]) problems.push(`${at}: block ${b.id} names form "${b.form}", which has no definition`);
      if (b.type === "involve") for (const it of b.items || []) if (it.form && !forms[it.form]) problems.push(`${at}: ${b.id}.${it.id} names form "${it.form}", which has no definition`);
      // Every icon an editor names must be one the site draws (src/render/icons.mjs).
      JSON.stringify(b, (k, v) => { if (k === "icon" && !ICONS.includes(v)) problems.push(`${at}: ${b.id} names icon "${v}"; the icons are ${ICONS.join(", ")}`); return v; });
      photos(b, `${at}: ${b.id}`);
    }
    pages.push(page);
  }

  for (const p of textProblems(textRegistry, textEdits)) problems.push(`content/text.json: ${p}`);

  // Rooms: one record each; a published room becomes a page (src/render/places.mjs).
  const places = {};
  for (const f of readDir("content/places")) {
    const place = readJson(`content/places/${f}`);
    if (`${place.id}.json` !== f) problems.push(`content/places/${f}: id "${place.id}" does not match the file name`);
    for (const p of placeProblems(place, { media: mediaIds, production })) problems.push(`content/places/${f}: ${p}`);
    if (place.published) for (const s of photoSlots(place)) { const r = photoRef(s.ref); if (r?.link && !links.has(r.id)) links.set(r.id, r); }
    places[place.id] = place;
  }
  for (const page of pages) for (const b of page.blocks || []) {
    if (b.type === "directions" && !places[b.place]?.published) problems.push(`content/pages: ${page.id}.${b.id} names room "${b.place}", which is not a published room`);
    if (b.type === "questions") for (const q of b.items || []) if (!/^q-[a-z0-9-]{2,60}$/.test(q.id || "") || !q.q || !q.a) problems.push(`content/pages: ${page.id}.${b.id}: every question needs an id like q-something, a question and an answer`);
    if (b.type === "workshops") for (const p of workshopProblems(b)) problems.push(`content/pages: ${page.id}.${p}`);
    if (b.type === "cards") for (const p of cardProblems(b)) problems.push(`content/pages: ${page.id}.${p}`);
    if (b.type === "words") for (const p of wordProblems(b)) problems.push(`content/pages: ${page.id}.${p}`);
    if (b.type === "directory") for (const p of directoryProblems(b)) problems.push(`content/pages: ${page.id}.${p}`);
    if (b.type === "resources") for (const p of resourceProblems(b)) problems.push(`content/pages: ${page.id}.${p}`);
    if (b.type === "embed") for (const p of embedProblems(b)) problems.push(`content/pages: ${page.id}.${b.id}: ${p}`);
    if (b.type === "program" && b.embed) for (const p of embedProblems(b.embed)) problems.push(`content/pages: ${page.id}.${b.id}: video ${p}`);
    if (b.type === "program" && !b.photos?.length && !(b.variant === "feature" && b.embed) && b.variant !== "topics") problems.push(`content/pages: ${page.id}.${b.id}: a ${b.variant} section needs photos${b.variant === "feature" ? " or a video" : ""}`);
    if (b.type === "schedule") for (const d of b.dropIn || []) if (!["peer", "craft", "workshops", "other"].includes(d.program) || !d.href) problems.push(`content/pages: ${page.id}.${b.id}: each drop-in page names a program (peer, craft, workshops or other) and an address`);
    if (b.type === "hero") for (const c of b.circles || []) if (!c.media || !c.label || !c.href) problems.push(`content/pages: ${page.id}.${b.id}: each circle needs a photo, a label and an address`);
  }

  // Events: Connect's public list when the build read it, else the fixture. A room Connect names in
  // words that match no room here comes with the list as a place of its own, shown unlinked.
  const feedRules = readJson("content/connect-feed.json");
  for (const p of feedRuleProblems(feedRules, places)) problems.push(`content/connect-feed.json: ${p}`);
  const eventsAt = feed?.events ? "Connect's public event list" : "content/fixtures/events.json";
  const events = feed?.events ? structuredClone(feed.events) : readJson("content/fixtures/events.json");
  const rooms = events.rooms || {};
  delete events.rooms;
  for (const p of eventPlaceProblems(events, { ...places, ...rooms })) problems.push(`${eventsAt}: ${p}`);
  const series = seriesIds(feedRules);
  for (const e of events.dated || []) if (e.series && !series.includes(e.series)) problems.push(`${eventsAt}: ${e.id} is in series "${e.series}"; the series are ${series.join(", ")} (content/connect-feed.json)`);
  for (const page of pages) for (const b of page.blocks || []) if (b.series && !series.includes(b.series)) problems.push(`content/pages: ${page.id}.${b.id} names series "${b.series}"; the series are ${series.join(", ")} (content/connect-feed.json)`);
  photos(events, eventsAt);
  events.places = { ...eventPlaces(places), ...rooms };
  // The wall and the team: Connect's exports when the build read them (ops/connect-feed.mjs). Without them a
  // published site shows neither sample: the wall renders nothing and the team page its words without people.
  const wall = feed?.wall ? structuredClone(feed.wall) : production ? { schema: "bss.wall-fixture/1", fixture: false, notes: [] } : readJson("content/fixtures/wall-notes.json");
  // The team: Connect's opt-in public profiles (src/render/team.mjs). Each published one gets a page.
  const teamAt = feed?.team ? "Connect's public team export" : "content/fixtures/team.json";
  const team = feed?.team ? structuredClone(feed.team) : production ? { schema: "bss.team-fixture/1", fixture: false, people: [] } : readJson("content/fixtures/team.json");
  for (const p of teamProblems(team, { media: mediaIds, production })) problems.push(`${teamAt}: ${p}`);
  photos({ people: publicPeople(team) }, teamAt);
  const slugs = new Set(publicPeople(team).map((p) => p.slug));
  // Resources: Connect's resource records, projected as its projectResource() does.
  const resourcesAt = feed?.resources ? "Connect's public resource list" : "content/fixtures/resources.json";
  const resources = feed?.resources ? structuredClone(feed.resources) : readJson("content/fixtures/resources.json");
  if (!Array.isArray(resources.resources)) problems.push(`${resourcesAt}: resources is a list`);
  else for (const [i, r] of resources.resources.entries()) if (!r?.id || !r?.name) problems.push(`${resourcesAt}: resources[${i}] needs an id and a name`);
  for (const page of pages) for (const b of page.blocks || []) {
    if (b.type === "team") for (const g of b.groups || []) if (!GROUPS.includes(g.group)) problems.push(`content/pages: ${page.id}.${b.id}: each group is one of ${GROUPS.join(", ")}`);
    if (b.type === "person" && !slugs.has(b.person)) problems.push(`content/pages: ${page.id}.${b.id} names "${b.person}", who has no public profile`);
  }
  if (production) {
    // Fixtures are typed by hand for review. A published site reads Connect, or shows nothing.
    if (events.fixture) problems.push("production: the event timetable would come from a hand-typed fixture; it needs Connect's public event export");
    if (resources.fixture) problems.push("production: the resource list would come from a sample; it needs Connect's approved public resource export");
  }
  // At launch every open form is served closed, linking its Google Form (src/shared/forms.mjs).
  const served = launch ? launchForms(forms) : forms;
  if (launch) for (const def of Object.values(served)) for (const p of definitionProblems(def)) problems.push(`launch: content/forms/${def.key}.json: ${p.code} at ${p.at || "(form)"}`);
  if (problems.length) throw Object.assign(new Error(`The content has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`), { problems });
  const text = resolveText(textRegistry, textEdits);
  const roomPages = placePages(places, makeT(text));
  for (const p of roomPages) if (paths.has(p.path)) throw new Error(`content/places: ${p.path} is also a page in content/pages`);
  const peoplePages = personPages(team, makeT(text));
  for (const p of peoplePages) if (paths.has(p.path)) throw new Error(`${teamAt}: ${p.path} is also a page in content/pages`);
  // A closed form's review page, on the prototype only (src/render/blocks/form.mjs).
  const previewPages = production ? [] : formPreviewPages(forms, makeT(text));
  for (const p of previewPages) if (paths.has(p.path)) throw new Error(`content/forms: ${p.path} is also a page in content/pages`);
  return {
    site, routes, media, links: [...links.values()], mood, forms: served, pages: [...pages, ...roomPages, ...peoplePages, ...previewPages], places, events, wall, team, resources, textRegistry, text,
    editable: editableWords({ site, pages, text }, { ...floor, text: floorText }, textRegistry),
    edits: { applied: overlay.applied, skipped: overlay.problems },
    // the files before any saved word, for the page function to lay a published revision over (src/render/site.mjs)
    floor: { ...floor, text: floorText }, givenTextEdits,
  };
}

/* Every word the edit button can change: { target: { shown, floor?, where? } }, floor only where
   an edit moved it, where (from text.json) for lines that are not part of a page's own content.
   Rooms and people pages are made from their own records, and are edited there. */
function editableWords(built, floor, registry) {
  const floorOf = new Map([
    ...floor.pages.flatMap((p) => pageStrings(p).map((s) => [s.target, s.value])),
    ...siteStrings(floor.site).map((s) => [s.target, s.value]),
    ...textStrings(floor.text).map((s) => [s.target, s.value]),
  ]);
  const out = {};
  const shown = [...built.pages.flatMap(pageStrings), ...siteStrings(built.site), ...textStrings(built.text)];
  for (const s of shown) {
    const f = floorOf.get(s.target);
    if (f === undefined) continue;
    out[s.target] = f === s.value ? { shown: s.value } : { shown: s.value, floor: f };
    if (s.target.startsWith("text:")) out[s.target].where = registry.text[s.target.slice(5)].where;
  }
  // values that are not words, each with its kind (src/shared/edits.mjs, kindAt)
  const floorValues = new Map([...floor.pages.flatMap(pageValues), ...siteValues(floor.site)].map((v) => [v.target, v.value]));
  for (const v of [...built.pages.flatMap(pageValues), ...siteValues(built.site)]) {
    const f = floorValues.get(v.target);
    if (f === undefined) continue;
    out[v.target] = { shown: v.value, ...(f === v.value ? {} : { floor: f }), kind: v.kind, ...(v.options && v.kind !== "icon" ? { options: v.options } : {}) };
  }
  return out;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function moodCss(mood) {
  return mood.moods.map((m) => `.mood-${m.id}{--mood:${m.color}}`).join("\n") + "\n";
}

export function cspHeader() {
  const inline = crypto.createHash("sha256").update(INLINE_JS).digest("base64");
  return [
    "default-src 'self'",
    `script-src 'self' 'sha256-${inline}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    // An Instagram reel plays in a frame only after someone presses Play (blocks/embed.mjs).
    "frame-src https://www.instagram.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join("; ");
}

/* The headers every path gets. _headers carries them for the static files; the page function sets the same on
   the pages it draws, because Netlify does not lay _headers over a function's answer. */
export function siteHeaders({ prototype }) {
  return [
    `Content-Security-Policy: ${cspHeader()}`,
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy: same-origin",
    ...(prototype ? ["X-Robots-Tag: noindex"] : []),
  ];
}

function headersFile({ prototype }) {
  const all = siteHeaders({ prototype });
  return [
    "/*", ...all.map((h) => `  ${h}`), "",
    // File names carry a content hash: a change is a new URL, so the old one may be cached forever.
    "/assets/css/*", "  Cache-Control: public, max-age=31536000, immutable", "",
    "/assets/js/*", "  Cache-Control: public, max-age=31536000, immutable", "",
    "/media/*", "  Cache-Control: public, max-age=31536000, immutable", "",
    // Fonts and brand files keep their names, so they are cached for a week, not forever.
    "/assets/fonts/*", "  Cache-Control: public, max-age=604800", "",
    "/assets/brand/*", "  Cache-Control: public, max-age=604800", "",
    // An event can move, so a calendar file is checked again after an hour.
    "/calendar/*", "  Content-Type: text/calendar; charset=utf-8", "  Cache-Control: public, max-age=3600", "",
  ].join("\n");
}

/* Live addresses that move get a 301 — but only once the page they move to exists. Until then
   they stay on the live site and are listed in the report as waiting. */
export function redirectsFile(routes, pages, built) {
  const lines = [];
  const waiting = [];
  const topic = { "/resources/basic-needs": "basic-needs", "/resources/health": "health", "/resources/identity-based": "identity-based", "/resources/general": "general" };
  for (const r of routes) {
    if (!r.live || !r.path || r.live.includes("{")) continue;
    const from = encodeURI(r.live);
    if (r.disposition === "redirect" || (r.disposition === "replace" && r.live !== r.path.replace(/\/$/, ""))) {
      const to = topic[r.live] ? `${r.path}?topic=${topic[r.live]}` : r.path;
      if (built.has(r.path)) lines.push(`${from}  ${to}  301`);
      else waiting.push(`${r.live} -> ${to}`);
    }
  }
  for (const p of pages) for (const a of p.aliases || []) if (!lines.some((l) => l.startsWith(`${a} `))) lines.push(`${a}  ${p.path}  301`);
  // Last, so a person's own old address (an alias above) wins over the catch-all for their group.
  if (built.has(TEAM_PATH)) lines.push(...teamRedirects());
  return { text: lines.join("\n") + "\n", waiting };
}

/* A production build replaces the live site at the same address, so nothing may still lean on it: every
   live address in content/routes.json needs a page here or an alias to one, and every link needs a built
   page. The prototype lists these in its report; production refuses them. */
export function cutoverProblems({ routes, pages, builtPaths, pendingLinks }) {
  const built = new Set(builtPaths);
  const aliases = new Set(pages.flatMap((p) => p.aliases || []));
  return [
    ...routes.filter((r) => r.live && !r.live.includes("{") && !aliases.has(r.live) && !built.has(r.path))
      .map((r) => `production: the live address ${r.live} (${r.disposition}) has no page here to answer it`),
    ...pendingLinks.map((p) => `production: a link goes to ${p}, which this site does not build`),
  ];
}


/* What the events refresh (netlify/lib/live-events.mjs) needs to render a page's event blocks again
   from Connect's current list: those blocks as the build had them, the rules that map Connect's list,
   the rooms, and the list the build used, which it answers with when Connect cannot be read. A page
   built from the fixture answers with the fixture, so a prototype never calls Connect. */
export function eventsForServer(content, { connect }) {
  const pages = {};
  for (const page of content.pages) {
    const blocks = (page.blocks || []).filter(refreshes);
    if (blocks.length) pages[page.id] = { path: page.path, blocks, sections: sectionPrograms(page) };
  }
  return {
    source: connect ? "connect" : "fixture",
    rules: connect ? readJson("content/connect-feed.json") : null,
    built: content.events,
    placeNames: eventPlaces(content.places),
    places: content.places,
    programs: [...pagePrograms(content.pages)],
    pages,
  };
}

/* `connect` reads Connect's public events and resources (ops/connect-feed.mjs) in place of the
   fixtures; production always does, and refuses to build when Connect cannot be read, so the site
   already published stays up. `connectConfig` is for tests: Connect's address, key and a fetch.
   `feedRules` is for tests too: content/connect-feed.json with its `exports` turned on or off. */
export async function build({ production = false, launch = production, today = null, out = path.join(ROOT, "dist"), serverDir = path.join(ROOT, ".build"), media = true, fetchMedia = false, textEdits = {}, edits = undefined, connect = production, connectConfig = undefined, feedRules = null, log = () => {} } = {}) {
  const prototype = !production;
  let feed = null;
  if (connect) {
    feed = await readConnectFeed(connectConfig === undefined ? feedConfig() : connectConfig, feedRules || JSON.parse(fs.readFileSync(path.join(ROOT, "content/connect-feed.json"), "utf8")));
    if (feed.problem) throw Object.assign(new Error(`Connect: ${feed.problem}. Nothing was built.`), { problems: [feed.problem] });
    for (const d of feed.dropped) log(`connect: left out ${d}`);
  }
  const content = loadContent({ production, launch, textEdits, edits, feed });
  const day = today || chicagoDate();

  if (!out.startsWith(ROOT + path.sep)) throw new Error(`refusing to write outside the project: ${out}`);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const d of ["fonts", "brand", "icons"]) copyDir(path.join(ROOT, "assets", d), path.join(out, "assets", d));

  // Photos: the library's variants, then every linked photo (fetched once into local/media-links/).
  // Without photos (tests, --no-media) a linked photo renders from its cached record or a placeholder.
  const mediaResult = media ? await buildMedia(path.join(out, "media"), { fetchMissing: fetchMedia, log }) : { files: [], encoded: 0 };
  const linkResult = media ? await buildLinks(content.links, path.join(out, "media"), { fetchMissing: fetchMedia, production, log }) : { items: linkPlaceholders(content.links), files: [], encoded: 0, fetched: 0 };
  const allMedia = { ...content.media, items: [...content.media.items, ...linkResult.items] };

  const min = await minifiers();
  // Styles: one file, named by its content. A block's own rules (its `styles`, in src/styles/blocks/) follow the
  // shared blocks.css, in the library's order. The notes come out before the name is taken from the bytes.
  const source = CSS_ORDER.flatMap((f) => (f === "blocks.css" ? [f, ...blockStyles()] : [f])).map((f) => fs.readFileSync(path.join(ROOT, "src/styles", f), "utf8")).join("\n")
    + "\n/* generated: photo focal points */\n" + mediaCss(allMedia.items)
    + "/* generated: mood colours (content/widgets/mood.json) */\n" + moodCss(content.mood);
  const css = min.css(source);
  const cssName = `site.${hash(css)}.css`;
  fs.mkdirSync(path.join(out, "assets/css"), { recursive: true });
  fs.writeFileSync(path.join(out, "assets/css", cssName), css);

  // Scripts: every browser module plus the shared form rules, in one directory named by the
  // content of them all, so their relative imports keep working and one change renames them all.
  const jsFiles = fs.readdirSync(path.join(ROOT, "src/client")).filter((f) => f.endsWith(".js")).sort()
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(ROOT, "src/client", f), "utf8") }));
  jsFiles.push({ name: "forms.mjs", text: fs.readFileSync(path.join(ROOT, "src/shared/forms.mjs"), "utf8") });
  for (const f of jsFiles) f.text = await min.js(f.text, f.name);
  const jsDir = hash(jsFiles.map((f) => f.name + "\0" + f.text).join("\0"));
  fs.mkdirSync(path.join(out, "assets/js", jsDir), { recursive: true });
  const js = {};
  for (const f of jsFiles) {
    fs.writeFileSync(path.join(out, "assets/js", jsDir, f.name), f.text);
    js[f.name] = `/assets/js/${jsDir}/${f.name}`;
  }
  for (const b of Object.values(BLOCKS)) for (const c of [].concat(b.client || [])) if (!js[c]) throw new Error(`block ${b.type} names client ${c}, which is not in src/client/`);

  const assets = { css: `/assets/css/${cssName}`, js };

  const data = {
    events: content.events,
    wallNotes: content.wall.notes,
    wallSample: content.wall.fixture ? content.wall.label : null,
    team: content.team,
    teamSample: content.team.fixture ? content.team.label : null,
    mood: content.mood,
    forms: content.forms,
    places: content.places,
    resources: content.resources.resources,
    resourcesSample: content.resources.fixture ? content.resources.label : null,
    resourcesUpdated: content.resources.sourceUpdatedAt,
  };
  const builtPaths = content.pages.filter((p) => !p.file).map((p) => p.path);
  const programs = pagePrograms(content.pages);
  const pending = new Map();
  const pageReport = [];
  for (const page of content.pages) {
    const ctx = makeContext({ site: content.site, media: allMedia, builtPaths, programs: new Map([...programs, ...sectionPrograms(page)]), routes: content.routes, data, text: content.text, today: day, prototype, assets, liveEvents: !!feed, path: page.path || null });
    const html = String(renderPage(ctx, page));
    const file = page.file ? path.join(out, page.file) : path.join(out, page.path, "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    for (const p of ctx.pendingLinks) pending.set(p, [...(pending.get(p) || []), page.path || page.file]);
    pageReport.push({ id: page.id, path: page.path || `/${page.file}`, bytes: Buffer.byteLength(html) });
  }

  // One calendar file per upcoming dated event: the round calendar button on its card opens it.
  const stamp = `${day.replace(/-/g, "")}T000000Z`;
  const calendar = nextDated(content.events, day, Infinity);
  for (const r of calendar) {
    const file = path.join(out, icsPath(r.event));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, eventIcs(r, { place: content.places[r.placeId] || (r.place ? { name: r.place.name } : null), origin: content.site.origin, stamp }));
  }

  if (production) {
    const left = cutoverProblems({ routes: content.routes, pages: content.pages, builtPaths, pendingLinks: [...pending.keys()] });
    if (left.length) throw Object.assign(new Error(`The site still leans on the live one in ${left.length} place(s):\n  ${left.join("\n  ")}`), { problems: left });
  }

  fs.writeFileSync(path.join(out, "_headers"), headersFile({ prototype }));
  const redirects = redirectsFile(content.routes, content.pages, new Set(builtPaths));
  fs.writeFileSync(path.join(out, "_redirects"), redirects.text);
  fs.writeFileSync(path.join(out, "robots.txt"), prototype
    ? "# Prototype: not for search engines.\nUser-agent: *\nDisallow: /\n"
    : `# Crawlers: please send a working email address in the HTTP From header (${content.site.origin}/crawlers/).\nUser-agent: *\nDisallow: /staff/\nDisallow: /api/\nSitemap: ${content.site.origin}/sitemap.xml\n`);
  if (!prototype) {
    const urls = content.pages.filter((p) => !p.noindex && !p.file).map((p) => `  <url><loc>${content.site.origin}${p.path}</loc></url>`);
    fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  }

  // What the API needs to render a page, and a page's event blocks, the same way the build did.
  const server = {
    schema: "bss.server/1", prototype, assets, site: content.site, routes: content.routes, builtPaths,
    forms: content.forms, mood: content.mood, media: allMedia, text: content.text, editable: content.editable,
    events: eventsForServer(content, { connect: !!feed }),
    headers: siteHeaders({ prototype }), redirects: redirects.text,
    // every page as the build rendered it, before the saved words: the page function draws pages from this
    render: siteSnapshot({
      floor: content.floor, textRegistry: content.textRegistry, textEdits: content.givenTextEdits, places: content.places, team: content.team,
      forms: content.forms, production, prototype, media: allMedia, routes: content.routes, data, assets, liveEvents: !!feed, builtPaths,
    }),
    formPages: Object.fromEntries(content.pages.flatMap((p) => (p.blocks || []).filter((b) => b.type === "form").map((b) => [b.form, { id: p.id, path: p.path, title: p.title, blockId: b.id, blockTitle: b.title || null }]))),
  };
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(serverDir, "server.json"), JSON.stringify(server));

  const report = {
    today: day, prototype, launch,
    connect: feed ? { events: feed.events.dated.length, weekly: feed.events.recurring.length, resources: feed.resources.resources.length, ...(feed.team ? { team: publicPeople(feed.team).length } : {}), ...(feed.wall ? { wall: feed.wall.notes.length } : {}), dropped: feed.dropped, version: feed.version } : null,
    edits: content.edits,
    pages: pageReport,
    calendar: calendar.map((r) => icsPath(r.event)),
    css: { name: cssName, bytes: Buffer.byteLength(css) },
    js: Object.fromEntries(jsFiles.map((f) => [f.name, Buffer.byteLength(f.text)])),
    media: {
      variants: mediaResult.files.length + linkResult.files.length,
      encoded: mediaResult.encoded + linkResult.encoded,
      bytes: [...mediaResult.files, ...linkResult.files].reduce((n, f) => n + f.bytes, 0),
      linked: content.links.map((r) => ({ id: r.id, link: r.link })),
      fetched: linkResult.fetched,
    },
    pendingLinks: [...pending.entries()].sort().map(([p, from]) => ({ path: p, from: [...new Set(from)] })),
    redirectsWaiting: redirects.waiting,
  };
  // nothing ships that is not on the list, and nothing carries a note or a map (X2)
  const leaks = await deliveredProblems(out, { serverDir });
  if (leaks.length) throw Object.assign(new Error(`What browsers would be sent is not clean:\n  ${leaks.join("\n  ")}`), { problems: leaks });
  fs.writeFileSync(path.join(serverDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  try {
    const r = await build({
      production: process.argv.includes("--production"),
      launch: process.argv.includes("--production") || process.argv.includes("--launch"),
      today: arg("today") || null,
      media: !process.argv.includes("--no-media"),
      fetchMedia: process.argv.includes("--fetch-media"),
      connect: process.argv.includes("--production") || process.argv.includes("--connect"),
      textEdits: arg("text-edits") ? JSON.parse(fs.readFileSync(path.resolve(arg("text-edits")), "utf8")) : {},
      edits: arg("edits") ? readEditsFile(JSON.parse(fs.readFileSync(path.resolve(arg("edits")), "utf8"))) : undefined,
      log: process.argv.includes("--verbose") ? console.log : () => {},
    });
    console.log(`built ${r.pages.length} pages for ${r.today}${r.prototype ? " (prototype)" : ""}${r.launch ? ", forms as at launch" : ""}`);
    console.log(r.connect ? `  from Connect: ${r.connect.events} events, ${r.connect.weekly} weekly groups, ${r.connect.resources} resources${r.connect.team != null ? `, ${r.connect.team} team profiles` : ""}${r.connect.wall != null ? `, ${r.connect.wall} Wall notes` : ""}${r.connect.dropped.length ? `; left out ${r.connect.dropped.length} (--verbose names them)` : ""}` : "  events and resources from the hand-typed fixtures");
    console.log(`  css ${r.css.bytes} B · js ${Object.values(r.js).reduce((a, b) => a + b, 0)} B · ${r.media.variants} image variants (${r.media.encoded} newly encoded)`);
    console.log(`  ${r.pendingLinks.length} internal links still point at the live site · ${r.redirectsWaiting.length} redirects wait for their page`);
    if (r.edits.applied.length || r.edits.skipped.length) console.log(`  ${r.edits.applied.length} edited words laid over the files${r.edits.skipped.length ? `; skipped ${r.edits.skipped.length}: ${r.edits.skipped.join(", ")}` : ""}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
