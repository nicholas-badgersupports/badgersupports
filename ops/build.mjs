/* The build: content in, a static site out.
 *
 *   node ops/build.mjs                       # the prototype: fixtures allowed, noindex everywhere
 *   node ops/build.mjs --today=2026-10-20    # pin "today" (screenshots, tests)
 *   node ops/build.mjs --production          # refuses fixtures, and anything still left on the
 *                                            # live site (cutoverProblems); nothing runs this yet
 *   node ops/build.mjs --launch              # the prototype with the forms as they launch: closed,
 *                                            # each page linking its Google Form (--production does this too)
 *   node ops/build.mjs --text-edits=FILE     # apply published text edits ({ key: text }) over
 *                                            # content/text.json, as Connect's publish will
 *   node ops/build.mjs --edits=FILE          # lay words changed with the edit button over the
 *                                            # content (src/shared/edits.mjs); without the flag the
 *                                            # build reads content/edits.json when there is one
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
import { blockProblems, BLOCKS } from "../src/render/registry.mjs";
import { workshopProblems } from "../src/render/blocks/workshops.mjs";
import { embedProblems } from "../src/render/blocks/embed.mjs";
import { cardProblems } from "../src/render/blocks/cards.mjs";
import { wordProblems } from "../src/render/blocks/words.mjs";
import { resourceProblems } from "../src/render/blocks/resources.mjs";
import { directoryProblems } from "../src/render/blocks/directory.mjs";
import { ICONS } from "../src/render/icons.mjs";
import { makeContext, chicagoDate } from "../src/render/context.mjs";
import { renderPage, INLINE_JS } from "../src/render/layout.mjs";
import { mediaCss, photoRef, photoProblems, photoSlots } from "../src/render/media.mjs";
import { definitionProblems, launchForms } from "../src/shared/forms.mjs";
import { textProblems, resolveText, makeT } from "../src/shared/text.mjs";
import { applyEdits, readEditsFile, pageStrings, siteStrings, textStrings } from "../src/shared/edits.mjs";
import { placeProblems, placePages, eventPlaces, eventPlaceProblems } from "../src/render/places.mjs";
import { teamProblems, personPages, publicPeople, teamRedirects, GROUPS, TEAM_PATH } from "../src/render/team.mjs";
import { buildMedia, buildLinks, linkPlaceholders, loadManifest } from "./media.mjs";
import { nextDated } from "../src/render/events.mjs";
import { eventIcs, icsPath } from "../src/render/ics.mjs";

export const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const CSS_ORDER = ["tokens.css", "base.css", "layout.css", "blocks.css", "forms.css", "motion.css"];

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const readDir = (p) => fs.readdirSync(path.join(ROOT, p)).filter((f) => f.endsWith(".json")).sort();
const hash = (s, n = 10) => crypto.createHash("sha256").update(s).digest("hex").slice(0, n);

/* The edits file a build lays over the content when it is given none: content/edits.json, if any. */
export function shippedEdits() {
  const f = path.join(ROOT, "content/edits.json");
  return fs.existsSync(f) ? readEditsFile(JSON.parse(fs.readFileSync(f, "utf8"))) : {};
}

/* Everything the build and the API read, loaded and checked. Throws with the full list. */
export function loadContent({ production = false, launch = production, textEdits = {}, edits = shippedEdits() } = {}) {
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
  const overlay = applyEdits(edits, { site, pages: files.map((x) => x.page), text: floorText });
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

  const events = readJson("content/fixtures/events.json");
  for (const p of eventPlaceProblems(events, places)) problems.push(`content/fixtures/events.json: ${p}`);
  photos(events, "content/fixtures/events.json");
  events.places = eventPlaces(places);
  const wall = readJson("content/fixtures/wall-notes.json");
  // The team: Connect's opt-in public profiles (src/render/team.mjs). Each published one gets a page.
  const team = readJson("content/fixtures/team.json");
  for (const p of teamProblems(team, { media: mediaIds, production })) problems.push(`content/fixtures/team.json: ${p}`);
  photos({ people: publicPeople(team) }, "content/fixtures/team.json");
  const slugs = new Set(publicPeople(team).map((p) => p.slug));
  // Resources: Connect's resource records, projected as its projectResource() does.
  const resources = readJson("content/fixtures/resources.json");
  if (!Array.isArray(resources.resources)) problems.push("content/fixtures/resources.json: resources is a list");
  else for (const [i, r] of resources.resources.entries()) if (!r?.id || !r?.name) problems.push(`content/fixtures/resources.json: resources[${i}] needs an id and a name`);
  for (const page of pages) for (const b of page.blocks || []) {
    if (b.type === "team") for (const g of b.groups || []) if (!GROUPS.includes(g.group)) problems.push(`content/pages: ${page.id}.${b.id}: each group is one of ${GROUPS.join(", ")}`);
    if (b.type === "person" && !slugs.has(b.person)) problems.push(`content/pages: ${page.id}.${b.id} names "${b.person}", who has no public profile`);
  }
  if (production) {
    // Fixtures are typed by hand for review. A published site reads Connect, or shows nothing.
    if (events.fixture) problems.push("production: the event timetable would come from a hand-typed fixture; it needs Connect's public event export");
    if (wall.fixture) problems.push("production: the Wall of Support would show sample notes; it needs the moderated source");
    if (team.fixture) problems.push("production: the team would come from a hand-typed fixture; it needs Connect's public profile export");
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
  for (const p of peoplePages) if (paths.has(p.path)) throw new Error(`content/fixtures/team.json: ${p.path} is also a page in content/pages`);
  return {
    site, routes, media, links: [...links.values()], mood, forms: served, pages: [...pages, ...roomPages, ...peoplePages], places, events, wall, team, resources, textRegistry, text,
    editable: editableWords({ site, pages, text }, { ...floor, text: floorText }, textRegistry),
    edits: { applied: overlay.applied, skipped: overlay.problems },
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

function headersFile({ prototype }) {
  const all = [
    `Content-Security-Policy: ${cspHeader()}`,
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy: same-origin",
    ...(prototype ? ["X-Robots-Tag: noindex"] : []),
  ];
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

export async function build({ production = false, launch = production, today = null, out = path.join(ROOT, "dist"), serverDir = path.join(ROOT, ".build"), media = true, fetchMedia = false, textEdits = {}, edits = undefined, log = () => {} } = {}) {
  const prototype = !production;
  const content = loadContent({ production, launch, textEdits, edits });
  const day = today || chicagoDate();

  if (!out.startsWith(ROOT + path.sep)) throw new Error(`refusing to write outside the project: ${out}`);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const d of ["fonts", "brand", "icons"]) copyDir(path.join(ROOT, "assets", d), path.join(out, "assets", d));

  // Photos: the library's variants, then every linked photo (fetched once into local/media-links/).
  // Without photos (tests, --no-media) a linked photo renders from its cached record or a placeholder.
  const mediaResult = media ? await buildMedia(path.join(out, "media"), { fetchMissing: fetchMedia, log }) : { files: [], encoded: 0 };
  const linkResult = media ? await buildLinks(content.links, path.join(out, "media"), { fetchMissing: fetchMedia, log }) : { items: linkPlaceholders(content.links), files: [], encoded: 0, fetched: 0 };
  const allMedia = { ...content.media, items: [...content.media.items, ...linkResult.items] };

  // Styles: one file, named by its content.
  const css = CSS_ORDER.map((f) => fs.readFileSync(path.join(ROOT, "src/styles", f), "utf8")).join("\n")
    + "\n/* generated: photo focal points */\n" + mediaCss(allMedia.items)
    + "/* generated: mood colours (content/widgets/mood.json) */\n" + moodCss(content.mood);
  const cssName = `site.${hash(css)}.css`;
  fs.mkdirSync(path.join(out, "assets/css"), { recursive: true });
  fs.writeFileSync(path.join(out, "assets/css", cssName), css);

  // Scripts: every browser module plus the shared form rules, in one directory named by the
  // content of them all, so their relative imports keep working and one change renames them all.
  const jsFiles = fs.readdirSync(path.join(ROOT, "src/client")).filter((f) => f.endsWith(".js")).sort()
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(ROOT, "src/client", f), "utf8") }));
  jsFiles.push({ name: "forms.mjs", text: fs.readFileSync(path.join(ROOT, "src/shared/forms.mjs"), "utf8") });
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
  const pending = new Map();
  const pageReport = [];
  for (const page of content.pages) {
    const ctx = makeContext({ site: content.site, media: allMedia, builtPaths, routes: content.routes, data, text: content.text, today: day, prototype, assets });
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
    fs.writeFileSync(file, eventIcs(r, { place: content.places[r.placeId] || null, origin: content.site.origin, stamp }));
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
    : `User-agent: *\nDisallow: /staff/\nDisallow: /api/\nSitemap: ${content.site.origin}/sitemap.xml\n`);
  if (!prototype) {
    const urls = content.pages.filter((p) => !p.noindex && !p.file).map((p) => `  <url><loc>${content.site.origin}${p.path}</loc></url>`);
    fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  }

  // What the intake API needs to render a page the same way the build did.
  const server = {
    schema: "bss.server/1", prototype, assets, site: content.site, routes: content.routes, builtPaths,
    forms: content.forms, mood: content.mood, media: allMedia, text: content.text, editable: content.editable,
    formPages: Object.fromEntries(content.pages.flatMap((p) => (p.blocks || []).filter((b) => b.type === "form").map((b) => [b.form, { id: p.id, path: p.path, title: p.title, blockId: b.id, blockTitle: b.title || null }]))),
  };
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(serverDir, "server.json"), JSON.stringify(server));

  const report = {
    today: day, prototype, launch,
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
      textEdits: arg("text-edits") ? JSON.parse(fs.readFileSync(path.resolve(arg("text-edits")), "utf8")) : {},
      edits: arg("edits") ? readEditsFile(JSON.parse(fs.readFileSync(path.resolve(arg("edits")), "utf8"))) : undefined,
      log: process.argv.includes("--verbose") ? console.log : () => {},
    });
    console.log(`built ${r.pages.length} pages for ${r.today}${r.prototype ? " (prototype)" : ""}${r.launch ? ", forms as at launch" : ""}`);
    console.log(`  css ${r.css.bytes} B · js ${Object.values(r.js).reduce((a, b) => a + b, 0)} B · ${r.media.variants} image variants (${r.media.encoded} newly encoded)`);
    console.log(`  ${r.pendingLinks.length} internal links still point at the live site · ${r.redirectsWaiting.length} redirects wait for their page`);
    if (r.edits.applied.length || r.edits.skipped.length) console.log(`  ${r.edits.applied.length} edited words laid over the files${r.edits.skipped.length ? `; skipped ${r.edits.skipped.length}: ${r.edits.skipped.join(", ")}` : ""}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
