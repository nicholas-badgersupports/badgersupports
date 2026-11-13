/* Behaviour in a real browser: 8. email links copy first.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-email.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("email links", async () => {
  for (const width of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
    try {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      const before = await page.evaluate(() => location.href);
      const target = await page.locator('.site-footer a[href^="mailto:"]').first().getAttribute("href");
      const address = decodeURIComponent(target.slice("mailto:".length).split("?")[0]);
      await page.locator('.site-footer a[href^="mailto:"]').first().click();
      await page.waitForSelector("dialog.email-pop[open]");
      await page.waitForFunction(() => document.querySelector(".email-pop-note")?.textContent.includes("copied"));
      let s = await emailState(page);
      check(s.note === words("email.copied") && s.addr === address,
        `email ${width}px: the popup says the address was copied and shows it ("${s.note}", "${s.addr}")`);
      check(s.url === before, `email ${width}px: pressing the link did not follow the mailto:`);
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      check(clip === address, `email ${width}px: the clipboard holds the address ("${clip}")`);
      check(s.openHref === target, `email ${width}px: Open in mail app keeps the full mailto: href ("${s.openHref}")`);
      check(s.box && s.box.left >= 0 && s.box.right <= width && s.box.top >= 0 && s.box.bottom <= 900 && s.scrollW <= width,
        `email ${width}px: the popup sits inside the screen and the page does not scroll sideways`);

      /* Copy again copies again: count the clipboard writes across the second press. */
      await page.evaluate(() => { window.__writes = 0; const w = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = (text) => { window.__writes++; return w(text); }; });
      await page.getByRole("button", { name: words("email.copyAgain") }).click();
      await page.waitForFunction(() => window.__writes === 1);
      check(true, `email ${width}px: Copy again copies the address once more`);

      /* Open in mail app is not intercepted: the press is the browser's own mailto: following,
         observable here as the popup closing around a link whose href is the mailto:. */
      await page.getByRole("link", { name: words("email.openMail") }).click();
      await page.waitForFunction(() => !document.querySelector("dialog.email-pop")?.open);
      check(true, `email ${width}px: Open in mail app closes the popup and is left to the browser`);

      /* Escape closes, and focus returns to the link that was pressed. */
      await page.locator('.site-footer a[href^="mailto:"]').first().click();
      await page.waitForSelector("dialog.email-pop[open]");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("dialog.email-pop")?.open);
      s = await emailState(page);
      check(s.focusBack, `email ${width}px: Escape closes the popup and focus returns to the email link`);

      /* A press on the backdrop — the dialog itself, outside its card — closes it too. */
      await page.locator('.site-footer a[href^="mailto:"]').first().click();
      await page.waitForSelector("dialog.email-pop[open]");
      await page.mouse.click(4, 4);
      await page.waitForFunction(() => !document.querySelector("dialog.email-pop")?.open);
      check(true, `email ${width}px: a press outside the popup closes it`);
      check(errors.length === 0, `email ${width}px: no page errors (${errors.join("; ")})`);
    } finally { await ctx.close(); }
  }

  /* When the browser will not copy — no clipboard API, and the legacy way refused — the popup
     still opens, the note does not claim a copy, and the address is there to copy by hand. */
  const cut = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await cut.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      document.execCommand = () => false;
    });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const target = await page.locator('.site-footer a[href^="mailto:"]').first().getAttribute("href");
    const address = decodeURIComponent(target.slice("mailto:".length).split("?")[0]);
    await page.locator('.site-footer a[href^="mailto:"]').first().click();
    await page.waitForSelector("dialog.email-pop[open]");
    await page.waitForFunction(() => document.querySelector(".email-pop-note span:last-of-type")?.textContent.length > 0);
    const s = await emailState(page);
    check(s.open && s.note === words("email.copyFailed") && s.addr === address,
      `email fallback: the popup opens, the note claims no copy, and the address shows ("${s.note}")`);
    const selectable = await page.evaluate(() => getComputedStyle(document.querySelector(".email-pop-addr")).userSelect);
    check(selectable === "all", `email fallback: the address is one-press selectable (user-select ${selectable})`);
  } finally { await cut.close(); }

  /* The self-dismiss clock, in real time — the waits are the proof. One width only: the clock
     is the same at every width. */
  const timed = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  try {
    const page = await timed.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const link = page.locator('.site-footer a[href^="mailto:"]').first();
    const isOpen = () => page.evaluate(() => !!document.querySelector("dialog.email-pop")?.open);
    const waitClosed = (ms) => page.waitForFunction(() => !document.querySelector("dialog.email-pop")?.open, null, { timeout: ms }).then(() => true, () => false);
    const openPop = async () => {
      await link.click();
      await page.waitForSelector("dialog.email-pop[open]");
      await page.waitForFunction(() => document.querySelector(".email-pop-note")?.textContent.includes("copied"));
    };
    /* The pointer must rest nowhere near the popup, or hover would pause the clock. */
    const moveOff = async () => {
      const s = await emailState(page);
      const spots = [[8, 8], [1272, 8], [8, 892], [1272, 892]];
      const [x, y] = spots.find(([px, py]) => !s.box || px < s.box.left || px > s.box.right || py < s.box.top || py > s.box.bottom) ?? [8, 8];
      await page.mouse.move(x, y);
    };

    /* Left alone, it closes itself at about six seconds — and not before. */
    await openPop();
    await moveOff();
    await sleep(3000);
    check(await isOpen(), "email dismiss: three seconds left alone, the popup is still open");
    check(await waitClosed(6000), "email dismiss: left alone, the popup closes itself (six-second clock)");

    /* Hovering pauses the clock where it stands; the pointer leaving resumes what remains. */
    await openPop();
    await moveOff();
    const hov = await emailState(page);
    await page.mouse.move((hov.box.left + hov.box.right) / 2, (hov.box.top + hov.box.bottom) / 2);
    await sleep(7000);
    check(await isOpen(), "email dismiss: seven seconds hovering, the popup is still open");
    await moveOff();
    check(await waitClosed(9000), "email dismiss: the pointer leaving resumes the clock and it closes");

    /* A hidden tab pauses the clock the same way. */
    await openPop();
    await moveOff();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(7000);
    check(await isOpen(), "email dismiss: seven seconds with the tab hidden, the popup is still open");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    check(await waitClosed(9000), "email dismiss: the tab showing again resumes the clock and it closes");

    /* A press inside stops the clock for good; the × still closes at once; and scrolling the
       link out of sight closes the popup even after that press. */
    await openPop();
    await moveOff();
    await page.getByRole("button", { name: words("email.copyAgain") }).click();
    await sleep(7000);
    check(await isOpen(), "email dismiss: a press inside stops the clock — still open at seven seconds");
    const xAt = Date.now();
    await page.locator(".email-pop-x").click();
    check((await waitClosed(2000)) && Date.now() - xAt < 2000, "email dismiss: the × closes at once, clock or no clock");
    await openPop();
    await page.getByRole("button", { name: words("email.copyAgain") }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    check(await waitClosed(3000), "email dismiss: scrolling the link out of sight closes it even after a press inside");
    await openPop();
    await page.evaluate(() => window.scrollTo(0, 0));
    check(await waitClosed(3000), "email dismiss: scrolling the link out of sight closes an untouched popup at once");
    check(errors.length === 0, `email dismiss: no page errors (${errors.join("; ")})`);
  } finally { await timed.close(); }
});

finish(await closeAndTally("interact-email"));
