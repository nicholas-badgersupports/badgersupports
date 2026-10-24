/* Where the words came from. Every string a visitor reads in content/ is checked against Badger
 * Supports' own material (the live site's pages, the workshop decks, the Google Form questions) and
 * classed verbatim, assembled (whole sentences joined), near (most three-word runs match) or new.
 *
 *   node ops/provenance.mjs <corpus-folder>     # writes local/provenance.tsv
 *
 * The corpus is never in this repository: the live site's team pages name real people. Lay it out as
 * crawl/{main,text,x,pages,x/embeds}, crawl/widgets.json, deck-*.txt and forms/*.json. Files whose
 * name contains about_our_team_ are skipped. docs/research/COPY-SOURCES.md has the last result.
 */
import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const SITE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."), SP = process.argv[2];
if (!SP) { console.log("usage: node ops/provenance.mjs <corpus-folder>"); process.exit(1); }
const norm = (s) => String(s).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/<[^>]+>/g, " ").toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
  .replace(/&amp;/g, "&").replace(/[^a-z0-9&']+/g, " ").replace(/'/g, "").trim().replace(/\s+/g, " ");
const corpusFiles = [];
for (const d of ["crawl/main", "crawl/text", "crawl/x"]) for (const f of fs.readdirSync(path.join(SP, d))) {
  if (/about_our_team_/.test(f)) continue; const p = path.join(SP, d, f); if (fs.statSync(p).isFile()) corpusFiles.push(p);
}
for (const f of fs.readdirSync(SP)) if (/^deck-.*\.txt$/.test(f)) corpusFiles.push(path.join(SP, f));
for (const f of fs.readdirSync(path.join(SP, "forms"))) if (f.endsWith(".json")) corpusFiles.push(path.join(SP, "forms", f));
for (const d of ["crawl/pages", "crawl/x/embeds"]) for (const f of fs.readdirSync(path.join(SP, d))) if (!/about_our_team_/.test(f)) corpusFiles.push(path.join(SP, d, f));
corpusFiles.push(path.join(SP, "crawl/widgets.json"));
const corpus = corpusFiles.map((p) => ({ p: path.relative(SP, p), t: " " + norm(fs.readFileSync(p, "utf8")) + " " }));
const all = corpus.map((c) => c.t).join(" | ");
const SKIP = new Set(["id", "href", "path", "schema", "type", "analytics", "icon", "group", "where", "about", "photos", "photo", "media", "place", "form", "kind", "status", "variant", "slug", "src", "url", "embed", "ref", "key", "name_key", "version", "generated", "loading", "data", "aliases", "tone", "measured", "note", "disposition", "live", "count", "required", "min", "max", "maxLength", "pattern", "accept", "start", "end", "date", "time", "tz", "lat", "lng", "sourcePage", "source", "license", "credit", "sha256", "bytes", "width", "height", "focus", "crop", "event", "events", "who", "review", "proposed", "pending", "workflow", "provenance", "file", "anchor", "publishedId", "read", "connectQueue", "receipt", "backup", "category", "series"]);
const rows = [];
function walk(v, file, kp) {
  if (typeof v === "string") {
    const key = kp[kp.length - 1];
    if (SKIP.has(key)) return;
    if (/^(https?:|mailto:|\/|#|m-|b-|q-|pg-|f-|\d{4}-\d\d)/.test(v) || !/[a-z]/i.test(v) || v.length < 2) return;
    rows.push({ file, kp: kp.join("."), s: v });
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, file, [...kp, i]));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
    if (file.endsWith("text.json") && kp.length === 0 && k === "groups") continue;
    walk(x, file, [...kp, k]);
  }
}
const files = [];
for (const d of ["content/pages", "content/forms", "content/places", "content/widgets"]) for (const f of fs.readdirSync(path.join(SITE, d))) if (f.endsWith(".json")) files.push(path.join(d, f));
files.push("content/site.json", "content/text.json");
for (const f of files) walk(JSON.parse(fs.readFileSync(path.join(SITE, f), "utf8")), f, []);
const has = (n) => n && all.includes(" " + n + " ");
function classify(s) {
  const parts = s.split(/\{\{[^}]+\}\}/).map(norm).filter((x) => x.split(" ").length >= 1 && x);
  if (!parts.length) return ["template", ""];
  if (parts.every(has)) { const src = corpus.find((c) => c.t.includes(" " + parts[0] + " ")); return ["verbatim", src ? src.p : ""]; }
  const sents = s.split(/(?<=[.!?])\s+|\{\{[^}]+\}\}/).map(norm).filter(Boolean);
  if (sents.length > 1 && sents.every(has)) return ["assembled", ""];
  const w = norm(s).split(" "); if (w.length < 4) return ["new", ""];
  let hit = 0, n = 0; for (let i = 0; i + 3 <= w.length; i++) { n++; if (has(w.slice(i, i + 3).join(" "))) hit++; }
  return [hit / n >= 0.6 ? "near" : "new", (hit / n).toFixed(2)];
}
const out = rows.map((r) => ({ ...r, c: classify(r.s) }));
fs.mkdirSync(path.join(SITE, "local"), { recursive: true });
fs.writeFileSync(path.join(SITE, "local", "provenance.tsv"), out.map((r) => [r.file, r.kp, r.c[0], r.c[1], r.s.replace(/\s+/g, " ")].join("\t")).join("\n"));
const by = {}; for (const r of out) by[r.c[0]] = (by[r.c[0]] || 0) + 1;
console.log(rows.length, "strings;", JSON.stringify(by), "; corpus files", corpus.length);
