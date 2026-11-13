/* Behaviour in a real browser: 7. site search.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-search.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("site search", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE + "/search/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => !document.querySelector("[data-srch-list]")?.hidden && document.querySelectorAll("[data-srch-list] .srch-card").length > 40);
    const ready = await searchState(page);
    check(ready.tools && ready.listShown && !ready.all && ready.count === words("search.count.all").replace("{{n}}", String(ready.cards.length)),
      `search: the index loads and lists every page (${ready.cards.length} pages, "${ready.count}")`);
    await page.fill("[data-srch-q]", "secular");
    await page.waitForFunction(() => document.querySelectorAll("[data-srch-list] .srch-card").length === 1);
    const found = await searchState(page);
    check(found.cards.length === 1 && found.cards[0] === "/directions/lcm/" && !found.none,
      `search: a word only one room's page carries finds that room alone (${JSON.stringify(found.cards)})`);
    await page.fill("[data-srch-q]", "zxqwv");
    await page.waitForFunction(() => !document.querySelector("[data-srch-none]")?.hidden);
    const none = await searchState(page);
    check(none.none && !none.listShown && none.count === words("search.count.some").replace("{{shown}}", "0").replace("{{total}}", String(ready.cards.length)),
      `search: a word on no page shows the no-matches block (${JSON.stringify(none.count)})`);
    await page.goto(BASE + "/search/?q=secular", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll("[data-srch-list] .srch-card").length === 1);
    const linked = await searchState(page);
    check(linked.cards.length === 1 && linked.cards[0] === "/directions/lcm/" && errors.length === 0,
      `search: an address with ?q= opens with its results, no browser errors (${JSON.stringify(linked.cards)})`);
  } finally { await ctx.close(); }

  const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  try {
    const page = await plain.newPage();
    await page.goto(BASE + "/search/", { waitUntil: "networkidle" });
    const result = await searchState(page);
    check(!result.tools && result.all && result.allLinks > 40 && result.count === words("search.nojs"),
      `search: without JavaScript the box stays hidden and every page is a plain link (${result.allLinks} links)`);
  } finally { await plain.close(); }

  const cut = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await cut.newPage();
    let down = true;
    await cut.route(/\/search-index\.json$/, async (route) => { if (down) await route.abort(); else await route.continue(); });
    await page.goto(BASE + "/search/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => !document.querySelector("[data-srch-again]")?.hidden);
    const failed = await searchState(page);
    check(failed.count === words("search.failed") && failed.again && failed.all,
      `search: a failed index says so and keeps the list of pages ("${failed.count}")`);
    down = false;
    await page.click("[data-srch-retry]");
    await page.waitForFunction(() => !document.querySelector("[data-srch-list]")?.hidden && document.querySelectorAll("[data-srch-list] .srch-card").length > 40);
    const back = await searchState(page);
    check(back.listShown && !back.again, "search: Try Again loads the index");
  } finally { await cut.close(); }
});

finish(await closeAndTally("interact-search"));
