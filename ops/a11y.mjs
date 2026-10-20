/* Accessibility and the real form in a real browser, against the running local site.
 *
 *   BASE=http://127.0.0.1:8911 node ops/a11y.mjs
 *
 * 1. axe-core (WCAG 2.0–2.2 A and AA rules) on every built page at 1280, 390 and 320 wide.
 * 2. Keyboard: the first Tab reaches "Skip to content".
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

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:8899";
const AXE = fs.readFileSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const report = JSON.parse(fs.readFileSync(path.join(ROOT, ".build/report.json"), "utf8"));
const PAGES = report.pages.map((p) => p.path);
const results = [];
const fail = (what) => results.push({ ok: false, what });
const pass = (what) => results.push({ ok: true, what });

const browser = await chromium.launch();

for (const p of PAGES) {
  for (const width of [1280, 390, 320]) {
    // bypassCSP lets the harness inject axe; the page itself is served with its real policy,
    // which the other checks below run under.
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.addScriptTag({ content: AXE });
    const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target?.join(" ")}`));
    if (r.length) fail(`axe ${p} @${width}: ${r.join(" | ")}`);
    else pass(`axe ${p} @${width}`);
    await ctx.close();
  }
}

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
  (first === "Skip to content" ? pass : fail)(`first Tab reaches the skip link (got "${first}")`);
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
process.exit(failed ? 1 : 0);
