/* Behaviour in a real browser: 7. site search.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-search.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, browser, check, closeAndTally, part, searchState, words } from "./interact-harness.mjs";

await part("site search", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let total = 0;
  try {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE + "/search/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => /^\d+ Pages$/.test(document.querySelector("[data-srch-count]")?.textContent.trim() || ""));
    const ready = await searchState(page);
    total = Number(ready.count.replace(/\D+/g, ""));
    check(ready.tools && !ready.listShown && ready.cards.length === 0 && !ready.all && ready.allLinks === 0 && !ready.again && total > 40 && ready.count === words("search.count.all").replace("{{n}}", String(total)),
      `search: before any query the page shows the box and the count alone — no index, no results, no Try Again (${total} pages covered, "${ready.count}")`);
    await page.fill("[data-srch-q]", "secular");
    await page.waitForFunction(() => document.querySelectorAll("[data-srch-list] .srch-card").length === 1);
    const found = await searchState(page);
    check(found.cards.length === 1 && found.cards[0] === "/directions/lcm/" && !found.none,
      `search: a word only one room's page carries finds that room alone (${JSON.stringify(found.cards)})`);
    await page.fill("[data-srch-q]", "suicide");
    await page.waitForFunction(() => !!document.querySelector("[data-srch-crisis]") && !document.querySelector("[data-srch-crisis]").hidden);
    const crisis = await searchState(page);
    check(crisis.crisis, "search: a crisis word puts the crisis block above the results");
    await page.fill("[data-srch-q]", "zxqwv");
    await page.waitForFunction(() => !document.querySelector("[data-srch-none]")?.hidden);
    const none = await searchState(page);
    check(none.none && !none.listShown && none.count === words("search.count.some").replace("{{shown}}", "0").replace("{{total}}", String(total)),
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
    check(!result.tools && !result.all && result.allLinks === 0 && result.count === words("search.nojs"),
      `search: without JavaScript the box stays hidden and no index stands on the page ("${result.count}")`);
  } finally { await plain.close(); }

  const cut = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await cut.newPage();
    let down = true;
    await cut.route(/\/search-index\.json$/, async (route) => { if (down) await route.abort(); else await route.continue(); });
    await page.goto(BASE + "/search/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => !document.querySelector("[data-srch-again]")?.hidden);
    const failed = await searchState(page);
    check(failed.count === words("search.failed") && failed.again && !failed.all && !failed.listShown && failed.cards.length === 0,
      `search: a failed index says so and offers Try Again, with no list standing ("${failed.count}")`);
    down = false;
    await page.click("[data-srch-retry]");
    await page.waitForFunction(() => /^\d+ Pages$/.test(document.querySelector("[data-srch-count]")?.textContent.trim() || ""));
    const back = await searchState(page);
    check(!back.again && !back.listShown && back.cards.length === 0, "search: Try Again loads the index and the page returns to the box alone");
    await page.fill("[data-srch-q]", "secular");
    await page.waitForFunction(() => document.querySelectorAll("[data-srch-list] .srch-card").length === 1);
    const recovered = await searchState(page);
    check(recovered.cards.length === 1 && recovered.cards[0] === "/directions/lcm/", "search: after Try Again a query renders its results");
  } finally { await cut.close(); }
});

finish(await closeAndTally("interact-search"));
