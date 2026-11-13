/* Behaviour in a real browser: 5. the events between publishes.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-events.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

checkEventDays();

await part("events: a section with focus in it waits for focus to leave", async () => {
  const { ctx, page, errors } = await openEvents([1200]);
  await page.focus('[data-block="b-home-week"] .place a');
  const link = await page.evaluate(() => document.activeElement.textContent.trim());
  await sleep(1500);
  let s = await weekState(page);
  check(s.answer === "published" && s.inWeek && s.focus === link,
    `events, focus inside: the answer does not replace the section the person is on, and focus stays put (${JSON.stringify(s)})`);
  await page.keyboard.press("Shift+Tab");
  await sleep(150);
  s = await weekState(page);
  check(s.answer === "v1" && s.focus !== "body" && !s.inWeek, `events, focus inside: once focus leaves, the answer goes in and focus is where the person moved it (${JSON.stringify(s)})`);
  check(!errors.length, `events: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

await part("events: Back or Forward to a kept page", async () => {
  // Asks: the page's own, then two restores; the first restore's answer comes last.
  const { ctx, page, asked } = await openEvents([0, 1200, 100]);
  await sleep(300);
  let s = await weekState(page);
  check(s.answer === "v1" && s.today.join() === DAY, `events: the page's own ask is put in, and ${DAY} is Today (${JSON.stringify(s)})`);
  /* Headless Chromium keeps no page in the back-forward cache (measured), so the restore is fired
     by hand, a day later. */
  await page.clock.setFixedTime(at(NEXT));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await sleep(50);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await sleep(1600);
  s = await weekState(page);
  check(s.today.join() === NEXT, `events, restored a day later: Today moves to the real today, ${NEXT} (${JSON.stringify(s.today)})`);
  check(asked() === 3 && s.answer === "v3", `events, restored twice: both ask again, and the newer ask's answer stays though the older one arrives last (asked ${asked()}, showing ${s.answer})`);
  await ctx.close();
});

finish(await closeAndTally("interact-events"));
