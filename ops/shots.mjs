/* Screenshots of the running local site, for review, plus what each page cost to load.
 *
 *   BASE=http://127.0.0.1:8911 node ops/shots.mjs [--out=local/shots] [--full] [--pages=/,/directions/]
 *
 * Shots go to local/ (never committed: they show real students). Each page is shot at 1280,
 * 390 and 320 wide, the viewport only unless --full; a sticky header and lazy images make
 * full-page captures misleading, so the viewport shots are the ones to judge by. Fails if a page
 * logs an error or the Content-Security-Policy refuses anything.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { chromium } from "playwright";
import { finish } from "./finish.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:8899";
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const OUT = path.resolve(ROOT, arg("out") || "local/shots");
const FULL = process.argv.includes("--full");
/* Every page the last build wrote, unless --pages names some. */
const BUILT = () => JSON.parse(fs.readFileSync(path.join(ROOT, ".build/report.json"), "utf8")).pages.map((p) => p.path);
const PAGES = arg("pages") ? arg("pages").split(",") : BUILT();
const WIDTHS = [[1280, 800], [390, 844], [320, 640]];

const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const report = [];
for (const p of PAGES) {
  for (const [w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    let bytes = 0, images = 0;
    /* only this site's own console counts: the peer page's Instagram frame logs Instagram's own warnings */
    page.on("console", (m) => { if (m.type() === "error" && (!m.location()?.url || m.location().url.startsWith(BASE))) errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", async (r) => {
      try { const b = await r.body(); bytes += b.length; if (r.request().resourceType() === "image") images += b.length; } catch { /* redirects have no body */ }
    });
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const name = (p === "/" ? "home" : p.replace(/^\/|\/$/g, "").replace(/\//g, "-")) + `-${w}`;
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    if (FULL) {
      // Scroll through so every lazy image loads before the long capture.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += h) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    report.push({ page: p, width: w, bytes, images, overflow, errors });
    await ctx.close();
  }
}
await browser.close();
for (const r of report) console.log(`${r.page.padEnd(32)} ${String(r.width).padStart(4)}px  ${(r.bytes / 1024).toFixed(0).padStart(5)} KB loaded (${(r.images / 1024).toFixed(0)} KB images)${r.overflow > 0 ? `  SCROLLS SIDEWAYS by ${r.overflow}px` : ""}${r.errors.length ? `  ERRORS: ${r.errors.join(" | ")}` : ""}`);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.errors.length || r.overflow > 0).length;
console.log(bad ? `shots: ${bad} of ${report.length} failed (console errors or sideways scroll, above)` : `shots: all ${report.length} passed — captures in ${path.relative(ROOT, OUT)}/, no console errors, nothing scrolls sideways`);
finish(bad ? 1 : 0);
