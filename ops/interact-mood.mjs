/* Behaviour in a real browser: 10. the mood check-in.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-mood.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { fs, path, BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("mood check-in", async () => {
  const MOODS = JSON.parse(fs.readFileSync(path.join(ROOT, "content/widgets/mood.json"), "utf8")).moods;
  /* The block's own script has run when it has laid each button's named colour on it. */
  const ready = (page) => page.waitForFunction(() => document.querySelector(".mood-btn")?.style.getPropertyValue("--mood") !== "", null, { timeout: 5000 });
  const answered = (page) => page.waitForFunction(() => { const o = document.querySelector("[data-mood-result]"); return o && !o.hidden && o.textContent.includes("checked in today"); }, null, { timeout: 5000 });

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await ready(page);
    const lay = await page.evaluate(() => {
      const btn = document.querySelector(".mood-btn");
      const e = btn.querySelector(".e").getBoundingClientRect();
      const l = btn.querySelector(".mood-label").getBoundingClientRect();
      return { dir: getComputedStyle(btn).flexDirection, emojiAbove: e.bottom <= l.top + 2,
        colour: getComputedStyle(btn).getPropertyValue("--mood").trim(), named: btn.dataset.color,
        count: document.querySelectorAll(".mood-btn").length };
    });
    check(lay.count === MOODS.length && lay.dir === "column" && lay.emojiAbove && lay.colour === lay.named,
      `mood: the feelings stand as an emoji over each word, in their own colours (${JSON.stringify(lay)})`);
    const pick = MOODS[MOODS.length - 1];
    await page.click(`button[name="mood"][value="${pick.id}"]`);
    const burst = await page.waitForSelector("canvas.mood-confetti", { timeout: 1500 }).then(() => true, () => false);
    await answered(page);
    const answer = await page.evaluate(() => document.querySelector("[data-mood-result]").textContent);
    check(burst, "mood: a tap bursts confetti from the feeling");
    check(pick.messages.some((m) => answer.includes(m)) && MOODS.every((m) => answer.includes(m.label)),
      `mood: the answer gives one of the feeling's reply lines and the day's counts (${JSON.stringify(answer.slice(0, 120))})`);
  } finally { await ctx.close(); }

  const calm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  try {
    const page = await calm.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await ready(page);
    await page.click(`button[name="mood"][value="${MOODS[0].id}"]`);
    await answered(page);
    await sleep(400);
    const made = await page.evaluate(() => !!document.querySelector("canvas.mood-confetti"));
    check(!made, "mood: reduced motion gets the answer with no confetti burst");
  } finally { await calm.close(); }
});

await part("mood check-in editor", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  const { structureNow } = await import("../netlify/lib/structure.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const MOODS = JSON.parse(fs.readFileSync(path.join(ROOT, "content/widgets/mood.json"), "utf8")).moods;
  const { ctx, page } = await openStaff({ session: ["site.edit", "site.publish"] });
  try {
    await goStaff(page, "staff.settings.title");
    const form = page.locator("form.staff-mood");
    await form.waitFor({ timeout: 5000 });
    const labels = await form.evaluate((f) => [...f.querySelectorAll(".staff-mood-row")].map((r) => r.querySelectorAll("input")[1].value));
    check(labels.join("|") === MOODS.map((m) => m.label).join("|"),
      `mood editor: a publisher sees the feelings as they stand (${JSON.stringify(labels)})`);
    await form.scrollIntoViewIfNeeded();
    await form.screenshot({ path: path.join(ROOT, "local", "feeling-settings-1280.png") });
    const firstLabel = form.locator(".staff-mood-row").first().locator("input").nth(1);
    await firstLabel.fill("");
    await page.getByRole("button", { name: words("staff.mood.save") }).click();
    const refused = await page.waitForFunction((w) => document.body.textContent.includes(w), words("staff.pages.error.mood"), { timeout: 5000 }).then(() => true, () => false);
    check(refused && !(await structureNow()).doc.settings?.moodCheckin,
      "mood editor: a feeling with no word is refused, says why, and stores nothing");
    await firstLabel.fill("Wiped Out");
    await page.getByRole("button", { name: words("staff.mood.save") }).click();
    const done = await page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, words("staff.mood.done"), { timeout: 5000 }).then(() => true, () => false);
    const stored = (await structureNow()).doc.settings?.moodCheckin;
    check(done && stored?.moods?.length === MOODS.length && stored.moods[0].id === MOODS[0].id && stored.moods[0].label === "Wiped Out",
      `mood editor: a saved set is what the structure holds, its ids kept (${JSON.stringify(stored?.moods?.[0])})`);
  } finally { await ctx.close(); }
});

finish(await closeAndTally("interact-mood"));
