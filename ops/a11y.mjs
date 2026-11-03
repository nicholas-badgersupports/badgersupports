/* Accessibility and the real form in a real browser, against the running local site.
 *
 *   BASE=http://127.0.0.1:8911 node ops/a11y.mjs
 *
 * 1. axe-core (WCAG 2.0–2.2 A and AA rules) on every built page at 1280, 390 and 320 wide, with the
 *    browser's clock held one minute after the first listed event ends, so ended and coming events are
 *    both on the page whatever the hour; then every page with events again, held after its last one
 *    ends, so every event view is measured ended. A page whose clock is not the held one, or a run
 *    with no ended or no coming event in it, fails. On each page held after its last event, an ended row's
 *    "Ended" sits after a dot on a desktop and starts its own line, with no dot, on a phone.
 * 2. Keyboard: the first Tab reaches the skip link (found by its target, since its words are editable).
 * 3. The workshop request, filled in and sent with JavaScript on: a mistake is announced and
 *    focused, the corrected form sends, and the confirmation shows a reference.
 * 4. The programming feedback form: choosing a category opens only that branch.
 * 5. The same workshop request with JavaScript off: the server's reply is a page, not JSON.
 * Uses fictional answers only.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { chromium } from "playwright";
import { finish } from "./finish.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:8899";
const AXE = fs.readFileSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const report = JSON.parse(fs.readFileSync(path.join(ROOT, ".build/report.json"), "utf8"));
const PAGES = report.pages.map((p) => p.path);
const results = [];
const fail = (what) => results.push({ ok: false, what });
const pass = (what) => results.push({ ok: true, what });

const browser = await chromium.launch();

/* "Ended" is decided in the browser (src/client/schedule.js) against its own clock, so the clock is
   held at a moment taken from the events the pages list, never the hour the suite happens to run.
   MARKED must stay the selector schedule.js marks with; the check below fails when they part. */
const MARKED = ".ev[data-ends], .evcard[data-ends]";
(fs.readFileSync(path.join(ROOT, "src/client/schedule.js"), "utf8").includes(`"${MARKED}"`) ? pass : fail)(`axe: the events measured as ended are the ones src/client/schedule.js marks (${MARKED})`);
const ENDS = new Map();
{
  const parser = await browser.newPage();
  for (const p of PAGES) {
    const html = await (await fetch(BASE + p)).text();
    ENDS.set(p, await parser.evaluate(([h, sel]) => [...new DOMParser().parseFromString(h, "text/html").querySelectorAll(sel)].map((e) => Date.parse(e.dataset.ends)), [html, MARKED]));
  }
  await parser.close();
}
const listed = [...ENDS.values()].flat();
const MIXED = listed.length ? Math.min(...listed) + 60_000 : null;
const iso = (ms) => new Date(ms).toISOString();
const held = { pages: 0, onClock: 0, ended: 0, coming: 0, off: [] };

/* One axe run: the page loaded with its clock held at `at`; returns its violations and what it measured. */
async function axeAt(p, width, at) {
  // bypassCSP lets the harness inject axe; the page itself is served with its real policy,
  // which the other checks below run under.
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, bypassCSP: true });
  const page = await ctx.newPage();
  if (at != null) await page.clock.setFixedTime(at);
  await page.goto(BASE + p, { waitUntil: "networkidle" });
  const seen = await page.evaluate((sel) => ({ now: Date.now(), events: document.querySelectorAll(sel).length, ended: [...document.querySelectorAll(sel)].filter((e) => e.classList.contains("is-past")).length }), MARKED);
  // axe cannot read colour through a background image, so the paper textures (tokens.css,
  // "paper") are taken off and each light ground is darkened to the texture's darkest
  // measured tone (each channel x .950): the worst case a line of text can sit on. A coloured
  // block loses only its texture, which leaves its flat accent, the lightest case under cream.
  await page.addStyleTag({ content: "*, *::before, *::after { background-image: none !important; }" });
  await page.evaluate(() => {
    const root = document.documentElement;
    for (const name of ["--ground", "--paper-deep", "--red-wash", "--peer-wash", "--craft-wash", "--workshops-wash"]) {
      const hex = getComputedStyle(root).getPropertyValue(name).trim().match(/^#([0-9a-f]{6})$/i);
      if (!hex) continue;
      const dim = [0, 2, 4].map((i) => Math.round(parseInt(hex[1].slice(i, i + 2), 16) * 0.95).toString(16).padStart(2, "0"));
      root.style.setProperty(name, "#" + dim.join(""));
    }
  });
  await page.addScriptTag({ content: AXE });
  // every element a rule failed is named, so a faded row reads as the row, not its first word
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`));
  await ctx.close();
  return { violations, ...seen };
}

const report1 = (label, r) => (r.violations.length ? fail(`axe ${label}: ${r.violations.join(" | ")}`) : pass(`axe ${label}`));

for (const p of PAGES) {
  for (const width of [1280, 390, 320]) {
    const r = await axeAt(p, width, MIXED);
    held.pages++;
    if (r.now === MIXED) held.onClock++; else held.off.push(`${p} @${width} read ${r.now == null ? "nothing" : iso(r.now)}`);
    held.ended += r.ended;
    held.coming += r.events - r.ended;
    report1(`${p} @${width}`, r);
  }
}
(MIXED != null && held.onClock === held.pages ? pass : fail)(`axe: every page judged "ended" at the held clock, ${MIXED == null ? "none (no page lists an event)" : iso(MIXED)}: ${held.onClock} of ${held.pages} page loads${held.off.length ? `; not held: ${held.off.slice(0, 3).join("; ")}` : ""}`);
(held.ended > 0 && held.coming > 0 ? pass : fail)(`axe: ended and coming events both measured at the held clock: ${held.ended} ended, ${held.coming} coming, over ${held.pages} page loads`);

/* Every event view once more with each of its events ended: a page held a minute after its own last one. */
const withEvents = PAGES.filter((p) => ENDS.get(p).length);
for (const p of withEvents) {
  const at = Math.max(...ENDS.get(p)) + 60_000;
  for (const width of [1280, 390, 320]) {
    const r = await axeAt(p, width, at);
    (r.now === at && r.events > 0 && r.ended === r.events ? pass : fail)(`axe, all ended: ${p} @${width} held at ${iso(at)}, ${r.ended} of ${r.events} events ended${r.now === at ? "" : ` (the page read ${iso(r.now)})`}`);
    report1(`${p} @${width}, all ended`, r);
  }
}
(withEvents.length ? pass : fail)(`axe, all ended: ${withEvents.length} of ${PAGES.length} pages list events`);

/* An ended row's "Ended": on a desktop it sits after a dot in the row's sign-up cell; on a phone, where the row is one
   column and the cell wraps, it starts its own line with no dot. Each page with events is held a minute after its own
   last one, so every listed row is ended and every one is measured. An ended row hides its Drop in, so the pages' cells
   hold "Ended" alone; the first row of each page is measured again with its sign-up words ("No Sign-Up") put back. */
{
  const words = JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text["schedule.signup.none"].text;
  const seen = { rows: 0, worded: 0, wrong: [], unmeasured: [] };
  const counts = {};
  for (const p of withEvents) {
    const at = Math.max(...ENDS.get(p)) + 60_000;
    for (const width of [1280, 390, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(at);
      await page.goto(BASE + p, { waitUntil: "networkidle" });
      const r = await page.evaluate((words) => {
        const measure = (ev) => {
          const tag = ev.querySelector(".ended-tag");
          const box = tag?.getClientRects()[0];
          if (!box) return { shown: false };
          const cell = tag.parentElement;
          const start = cell.getBoundingClientRect().left + parseFloat(getComputedStyle(cell).paddingLeft);
          return { shown: true, dot: getComputedStyle(tag, "::before").content, lineStart: Math.abs(box.left - start) < 1 };
        };
        const ended = [...document.querySelectorAll(".ev.is-past")];
        const rows = ended.map(measure);
        let worded = null;
        if (ended[0]) {
          ended[0].querySelector(".ended-tag").before(document.createTextNode(words));
          worded = measure(ended[0]);
        }
        return { listed: document.querySelectorAll(".ev[data-ends]").length, rows, worded };
      }, words);
      await ctx.close();
      const phone = width <= 860;
      const judge = (x, what) => {
        const ok = phone ? x.dot === "none" && x.lineStart : x.dot === '"·"';
        if (!ok) seen.wrong.push(`${p} @${width}${what}: dot ${x.dot}${phone ? `, ${x.lineStart ? "starts a line" : "mid-line"}` : ""}`);
      };
      const shown = r.rows.filter((x) => x.shown);
      counts[width] = (counts[width] || 0) + shown.length;
      if (shown.length !== r.listed) seen.unmeasured.push(`${p} @${width}: ${shown.length} of ${r.listed} rows`);
      for (const x of shown) { seen.rows++; judge(x, ""); }
      if (r.worded?.shown) { seen.worded++; judge(r.worded, ` with "${words}"`); }
    }
  }
  (seen.rows && seen.worded && !seen.wrong.length && !seen.unmeasured.length ? pass : fail)(
    `ended rows: "· Ended" on a desktop, "Ended" on its own line with no dot on a phone — ${Object.entries(counts).map(([w, n]) => `${n} rows at ${w}`).join(", ")}, ${seen.worded} with sign-up words${seen.wrong.length ? `; wrong: ${[...new Set(seen.wrong)].slice(0, 4).join("; ")} (${seen.wrong.length})` : ""}${seen.unmeasured.length ? `; not measured: ${seen.unmeasured.join("; ")}` : ""}`);
}

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => ({ skip: document.activeElement?.matches("a.skip[href='#main']"), text: document.activeElement?.textContent?.trim() }));
  (first.skip ? pass : fail)(`first Tab reaches the skip link (got "${first.text}")`);
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/forms/workshop-request/", { waitUntil: "networkidle" });
  await page.fill("#f-name", "Avery Example");
  await page.fill("#f-email", "avery@example");
  await page.click("[data-submit]");
  const summaryFocused = await page.evaluate(() => document.activeElement?.matches("[data-error-summary]"));
  const emailError = await page.textContent("#e-email").catch(() => null);
  (summaryFocused && emailError ? pass : fail)(`a mistake is listed, focused and named beside its field ("${emailError}")`);
  await page.fill("#f-email", "avery@example.org");
  await page.fill("#f-affiliation", "Example Hall Council");
  await page.fill("#f-attendees", "25");
  await page.check("#f-topics");
  for (const [i, d] of [[1, "2026-11-02T18:00"], [2, "2026-11-03T18:00"], [3, "2026-11-04T18:00"]]) await page.fill(`#f-option_${i}`, d);
  await page.fill("#f-location", "Example Hall lounge");
  await page.check("#f-projection");
  await page.fill("#f-group_notes", "First workshop for the group.");
  await page.fill("#f-access_needs", "None known.");
  await page.click("[data-submit]");
  await page.waitForSelector("[data-form-done]", { timeout: 5000 }).catch(() => {});
  const ref = await page.textContent("[data-form-done] .ref").catch(() => null);
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  (ref && /^WR-/.test(ref) && focused === "H2" ? pass : fail)(`the corrected form sends; confirmation focused with reference ${ref}`);
  (errors.length ? fail : pass)(`no script errors on the form${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/forms/programming-feedback/", { waitUntil: "networkidle" });
  const visible = async () => page.$$eval("[data-section]", (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.section));
  const before = await visible();
  await page.check('input[name="category"][value="craft"]');
  const after = await visible();
  (before.join() === "start" && after.join() === "start,craft" ? pass : fail)(`branching: [${before}] then [${after}] after choosing craft`);
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + "/forms/workshop-request/");
  // Every field filled; the address passes the browser's own email check but not the server's,
  // so the browser sends and the server has to answer with a page.
  await page.fill("#f-name", "Avery Example");
  await page.fill("#f-email", "avery@example");
  await page.fill("#f-affiliation", "Example Hall Council");
  await page.fill("#f-attendees", "25");
  await page.check("#f-topics");
  for (const [i, d] of [[1, "2026-11-02T18:00"], [2, "2026-11-03T18:00"], [3, "2026-11-04T18:00"]]) await page.fill(`#f-option_${i}`, d);
  await page.fill("#f-location", "Example Hall lounge");
  await page.check("#f-projection");
  await page.fill("#f-group_notes", "First workshop for the group.");
  await page.fill("#f-access_needs", "None known.");
  await Promise.all([page.waitForNavigation(), page.click("[data-submit]")]);
  const title = await page.textContent(".error-summary h2").catch(() => "");
  const kept = await page.inputValue("#f-affiliation").catch(() => "");
  (title.includes("Unable to send yet") && kept === "Example Hall Council" ? pass : fail)(`without JavaScript the server returns the form with the error and every answer kept ("${title}")`);
  await page.fill("#f-email", "avery@example.org");
  await Promise.all([page.waitForNavigation(), page.click("[data-submit]")]);
  const ref = await page.textContent("[data-form-done] .ref").catch(() => null);
  (ref && /^WR-/.test(ref) ? pass : fail)(`without JavaScript the corrected form sends (reference ${ref})`);
  await ctx.close();
}

await browser.close();
for (const r of results) console.log(`${r.ok ? "  ok  " : "  FAIL"} ${r.what}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `a11y: ${failed} of ${results.length} failed` : `a11y: all ${results.length} passed`);
finish(failed ? 1 : 0);
