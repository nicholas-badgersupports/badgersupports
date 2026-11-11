/* UW Course Search offerings for Discover Classes by Interest (EXPLORE-F-CLASSES).
 *
 *   node ops/courses.mjs     pull the served terms and rewrite content/fixtures/courses.json
 *
 * The pull reads the whole published-sections index for each term the service serves — the
 * current term, the upcoming term(s) its aggregate offers, and up to three terms back that
 * still answer — and applies the interest mapping in content/courses.json here, so a course
 * is never silently dropped because its subject was not pulled. The search body is the one
 * the official app sends, with the published-sections clause that makes a result a published
 * section offering rather than a catalog entry. Verification, endpoints and limits:
 * docs/research/COURSE-SEARCH-API-2026-11-11.md.
 *
 * A failed pull changes nothing: the data file is written only from a complete, checked
 * answer, so the last good data stays. A visitor's browser never calls the API. */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { isDirect } from "./direct.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const API = "https://public.enroll.wisc.edu";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const PUBLISHED = { has_child: { type: "enrollmentPackage", query: { term: { "enrollmentPackage.sections.published": true } } } };
const PAGE = 500;
const MAX_PAGES = 40;

/* Term codes step by two per term and roll at the season digit: ... 1264, 1266, 1272, 1274 ... */
export const prevTermCode = (code) => { const n = Number(code); return String(n % 10 === 2 ? n - 6 : n - 2); };

const SEASONS = ["Spring", "Summer", "Fall"];
const seasonOf = (short) => ({ Fall: "Fall", Sprng: "Spring", Spring: "Spring", Summer: "Summer", Sumr: "Summer" })[short] || null;

/* Term labels from the aggregate's own anchors, walked backwards by the cycle. A code the
   walk cannot label is not used: the pull never invents a term. `anchors` are the aggregate's
   terms as {code, season, year}; returns a Map of code -> {label, season, year} covering the
   anchors and up to `back` terms before the earliest anchor. */
export function termWalk(anchors, back = 3) {
  const map = new Map();
  const sorted = [...anchors].sort((a, z) => Number(a.code) - Number(z.code));
  for (const a of sorted) map.set(a.code, { label: `${a.season} ${a.year}`, season: a.season, year: a.year });
  let { code, season, year } = sorted[0] || {};
  for (let i = 0; i < back && code; i++) {
    const prev = prevTermCode(code);
    const si = SEASONS.indexOf(season);
    if (si === 0) { season = "Fall"; year -= 1; } else season = SEASONS[si - 1];
    code = prev;
    map.set(code, { label: `${season} ${year}`, season, year });
  }
  return map;
}

/* The data file's courses from the pull's raw hits. `hitsByTerm` maps a term code to the
   hits of that term's published-sections search; `terms` is the window in chronological
   order, each {code, label, kind} with kind "recent" for a past term and "current" or
   "upcoming" for a term a student can still enter. A course is kept when the mapping claims
   it and it has a published offering inside the window: available in a current or upcoming
   term ("open"), or most recently offered in a past term ("offered"). */
export function normalizeCourses(hitsByTerm, terms, interests) {
  const order = new Map(terms.map((t, i) => [t.code, i]));
  const byId = new Map();
  for (const t of terms) for (const h of hitsByTerm[t.code] || []) {
    if (!h?.courseId || !h.subject?.subjectCode) continue;
    let c = byId.get(h.courseId);
    if (!c) {
      c = { id: h.courseId, subjectCode: h.subject.subjectCode, subject: h.subject.shortDescription || h.subject.description || h.subject.subjectCode,
        number: h.catalogNumber, title: h.title, credits: h.creditRange,
        breadths: [...new Set((h.breadths || []).map((b) => b?.code).filter(Boolean))], offered: new Set() };
      byId.set(h.courseId, c);
    }
    c.offered.add(t.code);
  }
  const out = [];
  for (const c of byId.values()) {
    const mine = (interests || []).filter((i) => (i.subjects || []).includes(c.subjectCode) || (i.breadths || []).some((b) => c.breadths.includes(b))).map((i) => i.id);
    if (!mine.length) continue;
    const offered = [...c.offered].sort((a, z) => order.get(a) - order.get(z));
    const openCode = offered.find((code) => terms[order.get(code)].kind !== "recent") || null;
    const past = offered.filter((code) => terms[order.get(code)].kind === "recent");
    out.push({ id: c.id, subject: c.subject, subjectCode: c.subjectCode, number: c.number, title: c.title, credits: c.credits, interests: mine,
      open: openCode ? terms[order.get(openCode)].label : null,
      offered: past.length ? terms[order.get(past[past.length - 1])].label : null });
  }
  const num = (n) => parseInt(n, 10) || 0;
  out.sort((a, z) => (a.open ? 0 : 1) - (z.open ? 0 : 1) || String(a.subject).localeCompare(String(z.subject)) || num(a.number) - num(z.number) || String(a.number).localeCompare(String(z.number)));
  return out;
}

async function getJson(u) {
  const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
  return r.json();
}

async function searchTerm(code, firstPageOnly = false) {
  const hits = [];
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetch(`${API}/api/search/v2`, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/json" },
      body: JSON.stringify({ selectedTerm: code, queryString: "*", filters: [PUBLISHED], page, pageSize: PAGE }) });
    if (!r.ok) throw new Error(`search ${code}: HTTP ${r.status}`);
    const d = await r.json();
    if (firstPageOnly) return typeof d?.found === "number" ? d.found : 0;
    if (!Array.isArray(d.hits) || typeof d.found !== "number") throw new Error(`search ${code}: the answer was not in the shape this pull reads`);
    let fresh = 0;
    for (const h of d.hits) if (h?.courseId && !seen.has(h.courseId)) { seen.add(h.courseId); hits.push(h); fresh++; }
    if (hits.length >= d.found || !fresh) break;
  }
  return hits;
}

const chicagoDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function pullCourses({ log = () => {} } = {}) {
  const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, "content/courses.json"), "utf8"));
  const aggregate = await getJson(`${API}/api/search/v1/aggregate`);
  const offered = (aggregate.terms || []).filter((t) => t && t.termCode && !t.pastTerm)
    .sort((a, z) => (a.beginDate || 0) - (z.beginDate || 0))
    .map((t) => { const m = /^(\d{4})\s+(\w+)$/.exec(t.shortDescription || ""); return m && seasonOf(m[2]) ? { code: String(t.termCode), season: seasonOf(m[2]), year: Number(m[1]) } : null; })
    .filter(Boolean);
  if (!offered.length) throw new Error("the aggregate offered no terms this pull can label");
  const walk = termWalk(offered, 3);
  const terms = [{ code: offered[0].code, kind: "current" }, ...offered.slice(1).map((t) => ({ code: t.code, kind: "upcoming" }))];
  // Past terms, newest first, while the service still answers and the walk can label them.
  let code = offered[0].code;
  for (let i = 0; i < 3; i++) {
    code = prevTermCode(code);
    if (!walk.has(code)) break;
    const found = await searchTerm(code, true);
    if (!found) break;
    terms.unshift({ code, kind: "recent" });
  }
  const labelled = terms.map((t) => ({ ...t, label: walk.get(t.code)?.label })).filter((t) => t.label);
  const hitsByTerm = {};
  for (const t of labelled) { hitsByTerm[t.code] = await searchTerm(t.code); log(`courses: term ${t.code} (${t.label}): ${hitsByTerm[t.code].length} courses with published sections`); }
  const courses = normalizeCourses(hitsByTerm, labelled, mapping.interests);
  const day = chicagoDay();
  return { schema: "bss.courses-fixture/1", fixture: true,
    label: `Sample data: courses pulled from UW Course Search on ${day} to verify this tool. It goes live when the owner accepts the verification note in docs/research/COURSE-SEARCH-API-2026-11-11.md.`,
    provenance: `ops/courses.mjs, ${day}: the published-sections index of each term UW Course Search served (${labelled.map((t) => `${t.code} ${t.label}`).join(", ")}), mapped to interests by content/courses.json.`,
    sourceUpdatedAt: day, terms: labelled, courses };
}

if (isDirect(import.meta.url)) {
  try {
    const file = await pullCourses({ log: (s) => console.log(s) });
    fs.writeFileSync(path.join(ROOT, "content/fixtures/courses.json"), JSON.stringify(file, null, 2) + "\n");
    console.log(`courses: wrote ${file.courses.length} mapped courses to content/fixtures/courses.json`);
  } catch (e) {
    console.error(`courses: pull failed, the data file is unchanged: ${e.message}`);
    process.exit(1);
  }
}
