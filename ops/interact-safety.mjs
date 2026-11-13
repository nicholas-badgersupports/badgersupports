/* Behaviour in a real browser: 9. the safety exit.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-safety.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("9. the safety exit", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await ctx.newPage();
    const exits = [];
    const ga = [];
    await ctx.route(/google\.com/, async (route) => { exits.push(route.request().url()); await route.abort(); });
    page.on("request", (r) => { if (/google-analytics|googletagmanager/.test(r.url())) ga.push(r.url()); });

    for (const path of ["/", "/operations/privacy-policy/"]) {
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      for (const w of [1600, 1280, 768, 390, 320]) {
        await page.setViewportSize({ width: w, height: 900 });
        const r = await page.evaluate(() => {
          const el = document.querySelector("[data-safety-exit]");
          const b = el.getBoundingClientRect();
          const head = document.querySelector(".site-header").getBoundingClientRect();
          const hits = (sel) => {
            const n = document.querySelector(sel);
            if (!n || !n.getClientRects().length) return false;
            const o = n.getBoundingClientRect();
            return b.left < o.right && o.left < b.right && b.top < o.bottom && o.top < b.bottom;
          };
          return {
            href: el.getAttribute("href"), label: el.textContent.trim(),
            top: Math.round(b.top), bottom: Math.round(b.bottom), fromBottom: Math.round(innerHeight - b.bottom), right: Math.round(innerWidth - b.right), h: Math.round(b.height),
            headTop: Math.round(head.top), headBottom: Math.round(head.bottom),
            overlap: hits(".brand") || hits("[data-menu-toggle]") || hits("#site-nav"),
            sideways: document.documentElement.scrollWidth - innerWidth,
          };
        });
        check(r.href === "https://www.google.com/" && r.label === words("header.safetyExit"),
          `safety exit @${w} ${path}: a plain link to Google, labelled "${r.label}"`);
        check(r.fromBottom >= 8 && r.fromBottom <= 40 && r.right >= 8 && r.right <= 40 && r.top >= 0 && r.h >= 44 && !r.overlap && r.sideways <= 0,
          `safety exit @${w} ${path}: floating at the screen's bottom right, ${r.h}px tall, covering nothing, no sideways scroll`);
      }
    }

    /* scrolled to the foot of a long page, the pill is still in reach */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(300);
    const stuck = await page.evaluate(() => {
      const b = document.querySelector("[data-safety-exit]").getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, fromBottom: innerHeight - b.bottom };
    });
    check(stuck.top >= 0 && stuck.fromBottom >= 8 && stuck.fromBottom <= 40, `safety exit: still at the bottom right after scrolling (${Math.round(stuck.fromBottom)}px from the foot)`);

    /* one press opens Google in a new tab and replaces this page with it too, and nothing is measured on the way out */
    exits.length = 0;
    await page.click("[data-safety-exit]");
    await sleep(600);
    check(exits.length === 2 && exits.every((u) => u.startsWith("https://www.google.com")),
      `safety exit: one press opens a new tab and replaces this page (${exits.length} leavings)`);
    check(!ga.length, `safety exit: no analytics request fired while leaving (${ga.length})`);

    /* three Escapes in quick succession do the same; two do not */
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    exits.length = 0;
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await sleep(400);
    check(exits.length === 0, "safety exit: two Escapes do not leave");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await sleep(600);
    check(exits.length === 2, `safety exit: three quick Escapes leave the same way (${exits.length} leavings)`);
    check(!ga.length, `safety exit: the Escape exit is not measured either (${ga.length})`);
  } finally { await ctx.close(); }

  /* without JavaScript the pill is still there and still a working link */
  const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  try {
    const page = await plain.newPage();
    const exits = [];
    await plain.route(/google\.com/, async (route) => { exits.push(route.request().url()); await route.abort(); });
    await page.goto(BASE + "/", { waitUntil: "load" });
    const r = await page.evaluate(() => {
      const el = document.querySelector("[data-safety-exit]");
      return { href: el.getAttribute("href"), label: el.textContent.trim(), shown: !!el.getClientRects().length };
    });
    check(r.shown && r.href === "https://www.google.com/" && r.label === words("header.safetyExit"),
      "safety exit: without JavaScript the pill shows, as a link to Google");
    await page.click("[data-safety-exit]");
    await sleep(500);
    check(exits.length === 1, "safety exit: without JavaScript the link still leaves");
  } finally { await plain.close(); }
});

finish(await closeAndTally("interact-safety"));
