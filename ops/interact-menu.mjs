/* Behaviour in a real browser: 1. the phone menu.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-menu.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("phone menu", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openMenu(page);
  let s = await menuState(page);
  check(s.expanded === "true" && s.shown, `phone: Menu opens the navigation (expanded ${s.expanded}, shown ${s.shown})`);
  await page.keyboard.press("Escape");
  s = await menuState(page);
  check(s.expanded === "false" && !s.shown && s.focus === "toggle", `phone: Escape closes the menu and focus returns to Menu (expanded ${s.expanded}, shown ${s.shown}, focus ${s.focus})`);

  await openMenu(page);
  const summary = page.locator("#site-nav details[data-nav] > summary").first();
  const name = (await summary.textContent()).trim();
  await summary.click();
  s = await menuState(page);
  check(s.sub === name, `phone: a sub-menu opens inside the menu ("${s.sub}")`);
  await page.keyboard.press("Escape");
  s = await menuState(page);
  check(s.sub === null && s.expanded === "true" && s.shown && s.focus === `summary:${name}`, `phone: the first Escape closes only the sub-menu, focus on its heading (sub ${s.sub}, menu ${s.expanded}, focus ${s.focus})`);
  await page.keyboard.press("Escape");
  s = await menuState(page);
  check(s.expanded === "false" && !s.shown && s.focus === "toggle", `phone: the second Escape closes the menu, focus on Menu (expanded ${s.expanded}, focus ${s.focus})`);

  await openMenu(page);
  await page.locator("main h1").first().click();
  s = await menuState(page);
  check(s.expanded === "false" && !s.shown, `phone: a click outside closes the menu (expanded ${s.expanded}, shown ${s.shown})`);

  await openMenu(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await sleep(100);
  s = await menuState(page);
  check(s.expanded === "false", `resize: widening past the phone layout closes the menu (expanded ${s.expanded})`);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(100);
  s = await menuState(page);
  check(s.expanded === "false" && !s.shown, `resize: back on a phone the menu is still closed, no stale panel (shown ${s.shown})`);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator("#site-nav details[data-nav] > summary").first().click();
  await page.keyboard.press("Escape");
  s = await menuState(page);
  check(s.sub === null && s.focus === `summary:${name}`, `desktop: Escape closes a sub-menu and focus returns to its heading (focus ${s.focus})`);

  await page.setViewportSize({ width: 390, height: 844 });
  await openMenu(page);
  await page.keyboard.press("Tab");
  const inMenu = await page.evaluate(() => !!document.activeElement.closest("#site-nav"));
  check(inMenu, "phone: Tab moves from Menu into the open navigation, and nothing traps it there");
  check(!errors.length, `menu: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("touch menu", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await openMenu(page, true);
  let s = await menuState(page);
  const opened = s.expanded === "true" && s.shown;
  await page.locator("main h1").first().tap();
  s = await menuState(page);
  check(opened && s.expanded === "false" && !s.shown, `touch: a tap opens the menu and a tap outside closes it (expanded ${s.expanded})`);
  await ctx.close();
});

await part("menu and Back", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await openMenu(page);
  const href = await page.locator("#site-nav > ul > li > a[href^='/']").first().getAttribute("href");
  await Promise.all([page.waitForNavigation(), page.locator(`#site-nav a[href="${href}"]`).first().click()]);
  await page.goBack({ waitUntil: "networkidle" });
  const s = await menuState(page);
  check(s.expanded === "false" && !s.shown, `Back after following a menu link shows the page with the menu closed (expanded ${s.expanded})`);
  await ctx.close();
});

await part("menu without JavaScript", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + "/");
  const r = await page.evaluate(() => ({
    button: !!document.querySelector("[data-menu-toggle]").getClientRects().length,
    links: [...document.querySelectorAll("#site-nav a")].filter((a) => a.getClientRects().length).length,
  }));
  check(!r.button && r.links > 0, `no JavaScript: no Menu button, the navigation shows as links (${r.links} visible)`);
  await ctx.close();
});

finish(await closeAndTally("interact-menu"));
