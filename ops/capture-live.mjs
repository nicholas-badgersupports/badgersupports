/* Capture the live Google Sites website as evidence for the rebuild: a screenshot of each page at
 * desktop and phone width, and every image the page asks for (address, natural size, the size it is
 * drawn at, bytes transferred, whether it is visible on first paint). Read-only: it loads pages the
 * way a visitor does and clicks nothing. Usage: node ops/capture-live.mjs <outDir> [path ...] */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2];
const paths = process.argv.slice(3);
if (!out || !paths.length) { console.error("usage: capture-live.mjs <outDir> <path> ..."); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const BASE = "https://www.badgersupports.org";
const WIDTHS = [{ name: "desktop", width: 1280, height: 800 }, { name: "phone", width: 390, height: 844, mobile: true }];

const browser = await chromium.launch();
const report = {};
for (const p of paths) {
  report[p] = {};
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height }, isMobile: !!w.mobile, hasTouch: !!w.mobile, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const images = new Map();
    page.on("response", async (r) => {
      const type = r.request().resourceType();
      if (type !== "image") return;
      let bytes = null;
      try { bytes = (await r.body()).length; } catch { /* redirected or aborted */ }
      images.set(r.url(), { status: r.status(), bytes, mime: r.headers()["content-type"] || "" });
    });
    let total = 0;
    page.on("response", async (r) => { try { total += Number(r.headers()["content-length"] || 0); } catch {} });
    const t0 = Date.now();
    await page.goto(BASE + encodeURI(p), { waitUntil: "load", timeout: 60000 });
    const loadMs = Date.now() - t0;
    // Embeds and lazy images load as they scroll into view: walk down the page first.
    for (let y = 0; y < 40000; y += 500) {
      const h = await page.evaluate((yy) => { scrollTo(0, yy); return document.documentElement.scrollHeight; }, y);
      await page.waitForTimeout(150);
      if (y > h) break;
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(2500);
    const drawn = await page.evaluate(() => {
      const vh = innerHeight;
      const out = [];
      for (const el of document.querySelectorAll("img")) {
        const r = el.getBoundingClientRect();
        out.push({ kind: "img", src: el.currentSrc || el.src, alt: el.getAttribute("alt"), naturalW: el.naturalWidth, naturalH: el.naturalHeight,
          drawnW: Math.round(r.width), drawnH: Math.round(r.height), top: Math.round(r.top + scrollY), aboveFold: r.top < vh && r.bottom > 0 && r.width > 0 });
      }
      for (const el of document.querySelectorAll("[style*='background-image']")) {
        const m = /url\(["']?([^"')]+)/.exec(el.style.backgroundImage || "");
        if (!m) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.push({ kind: "bg", src: m[1], drawnW: Math.round(r.width), drawnH: Math.round(r.height), top: Math.round(r.top + scrollY),
          hidden: r.width === 0 || cs.display === "none" || cs.visibility === "hidden", aboveFold: r.top < vh && r.bottom > 0 && r.width > 0 });
      }
      return { title: document.title, height: document.documentElement.scrollHeight, items: out, frames: [...document.querySelectorAll("iframe")].map((f) => f.title || f.getAttribute("aria-label") || f.src || "") };
    });
    const shot = path.join(out, `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}-${w.name}.jpg`);
    await page.screenshot({ path: shot, fullPage: true, type: "jpeg", quality: 60 });
    report[p][w.name] = { loadMs, transferredHeaderBytes: total, title: drawn.title, pageHeight: drawn.height, frames: drawn.frames,
      images: drawn.items.map((i) => ({ ...i, ...(images.get(i.src) || {}) })), requestedImages: [...images.entries()].map(([url, v]) => ({ url, ...v })) , shot: path.basename(shot) };
    await ctx.close();
    console.log(p, w.name, loadMs + "ms", drawn.items.length, "images");
  }
}
await browser.close();
fs.writeFileSync(path.join(out, "capture.json"), JSON.stringify(report, null, 1));
