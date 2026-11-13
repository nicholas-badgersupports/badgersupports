/* Behaviour in a real browser: 3. the form changes, or the reply is lost.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-workshop.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("a question added while the page is open", async () => {
  await freshServer();
  await publishWorkshop((d) => questionsOf(d, "about_you").push({ id: "pronouns", type: "short", label: "Your pronouns", required: true }));
  const { ctx, page, errors } = await openWorkshop();
  let s = await formState(page);
  check(s.notice.includes(words("form.updated.ahead")), `changed form: on load the page says its questions have changed (notice "${s.notice.slice(0, 60)}")`);
  await fillWorkshop(page);
  const key = s.key;
  s = await send(page);
  check(s.notice.includes(words("form.updated.body")) && s.summaryFocused && s.listed.includes("pronouns"),
    `changed form: Send shows the new question, listed in the focused summary (listed ${JSON.stringify(s.listed)}, focused ${s.summaryFocused})`);
  check(await page.locator("#f-pronouns").isVisible() && (await page.getAttribute("#f-pronouns", "aria-invalid")) === "true", "changed form: the new question is on the page and marked");
  check(s.name === "Avery Example" && s.key === key && s.version === "2" && s.islandVersion === 2,
    `changed form: the answers, the Send key and the new version are kept (name ${s.name}, key kept ${s.key === key}, version ${s.version}/${s.islandVersion})`);
  await page.fill("#f-pronouns", "they/them");
  s = await send(page);
  const rows = await many("SELECT ref, form_version, version_seen FROM submissions");
  check(/^WR-/.test(s.ref) && rows.length === 1 && rows[0].ref === s.ref && rows[0].form_version === 2 && rows[0].version_seen === 2,
    `changed form: the second Send is accepted once, under version 2 (ref "${s.ref}", rows ${JSON.stringify(rows)})`);
  check(!errors.length, `changed form: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("a question renamed while the page is open", async () => {
  await freshServer();
  const { ctx, page } = await openWorkshop();
  await fillWorkshop(page);
  await publishWorkshop((d) => { Object.assign(questionsOf(d, "about_you").find((x) => x.id === "affiliation"), { id: "organisation", label: "Your organisation" }); });
  const s = await send(page);
  check(s.listed.includes("organisation") && s.kept.includes("Example Hall Council"),
    `renamed question: Send asks it again and shows the old answer to copy (listed ${JSON.stringify(s.listed)}, kept ${JSON.stringify(s.kept)})`);
  await ctx.close();
});

await part("a question renamed, without JavaScript", async () => {
  await freshServer();
  const { ctx, page } = await openWorkshop({ js: false });
  await fillWorkshop(page);
  await publishWorkshop((d) => { Object.assign(questionsOf(d, "about_you").find((x) => x.id === "affiliation"), { id: "organisation", label: "Your organisation" }); });
  await Promise.all([page.waitForNavigation(), page.click("[data-submit]")]);
  const s = await formState(page);
  check(s.listed.includes("organisation") && s.name === "Avery Example" && s.kept.includes("Example Hall Council"),
    `no JavaScript: the reply page asks the renamed question, keeps the answers and shows the old one (listed ${JSON.stringify(s.listed)}, kept ${JSON.stringify(s.kept)})`);
  await ctx.close();
});

await part("Send pressed twice", async () => {
  await freshServer();
  const { ctx, page, sends } = await openWorkshop({ onSubmit: async (route, run) => { await sleep(400); await route.fulfill(await run()); } });
  await fillWorkshop(page);
  await page.evaluate(() => { const f = document.querySelector("form[data-form]"); f.requestSubmit(); f.requestSubmit(); });
  await page.keyboard.press("Enter");
  await sleep(800);
  const rows = await many("SELECT ref FROM submissions");
  check(sends.length === 1 && rows.length === 1, `Send twice while the first is going: one request, one submission (requests ${sends.length}, rows ${rows.length})`);
  await ctx.close();
});

await part("a lost reply", async () => {
  await freshServer();
  const { ctx, page, sends } = await openWorkshop({ onSubmit: async (route, run, n) => { if (n === 1) { await run(); return route.abort("failed"); } return route.fulfill(await run()); } });
  await fillWorkshop(page);
  let s = await send(page);
  check(s.status === words("form.status.network") && !s.disabled && s.name === "Avery Example",
    `lost reply: the page says the connection failed, keeps the answers and lets Send again (status "${s.status}", disabled ${s.disabled})`);
  s = await send(page);
  const rows = await many("SELECT ref FROM submissions");
  check(sends.length === 2 && rows.length === 1 && rows[0].ref === s.ref,
    `lost reply: Send again gets the reference of the one stored submission (ref "${s.ref}", rows ${rows.length})`);
  await ctx.close();
});

await part("no connection", async () => {
  await freshServer();
  const { ctx, page } = await openWorkshop({ onSubmit: async (route, run, n) => (n === 1 ? route.abort("internetdisconnected") : route.fulfill(await run())) });
  await fillWorkshop(page);
  let s = await send(page);
  const none = (await many("SELECT ref FROM submissions")).length;
  check(s.status === words("form.status.network") && none === 0, `no connection: the page says so and nothing is stored (status "${s.status}", rows ${none})`);
  s = await send(page);
  check(/^WR-/.test(s.ref), `no connection: once it is back, Send goes through (ref "${s.ref}")`);
  await ctx.close();
});

await part("closed while the page is open", async () => {
  await freshServer();
  const { ctx, page } = await openWorkshop();
  await fillWorkshop(page);
  await q("INSERT INTO form_state (form_key, state, changed_by) VALUES ('workshop-request', 'closed', 'harness')");
  const s = await send(page);
  const rows = (await many("SELECT ref FROM submissions")).length;
  check(s.notice.includes(words("form.closedNow.title")) && s.disabled && s.name === "Avery Example" && rows === 0,
    `closed while open: Send is refused by the server, the page says so, keeps the answers and stops sending (disabled ${s.disabled}, rows ${rows})`);
  await ctx.close();
});

await part("a long answer near its limit", async () => {
  await freshServer();
  const { ctx, page, errors } = await openWorkshop();
  await showField(page, "#f-contact_other");
  const box = page.locator("#f-contact_other");
  const max = Number(await box.getAttribute("maxlength"));
  const room = () => page.evaluate(() => {
    const b = document.querySelector("#f-contact_other"), left = b.parentElement.querySelector(".field-left");
    return { length: b.value.length, shown: left && !left.hidden ? left.textContent : "", said: b.parentElement.querySelector(".sr-only[role=status]")?.textContent ?? null };
  });
  await box.focus();
  await page.keyboard.insertText("Made-up words.");
  const early = await room();
  await box.fill("");
  await page.keyboard.insertText("x".repeat(max - 40));
  const near = await room();
  await page.keyboard.insertText("x".repeat(100));
  const cut = await room();
  const left = (n) => words("form.left").replace("{{n}}", n);
  check(early.shown === "" && near.shown === left(40) && near.said === left(40),
    `long answer: nothing shows while there is room; near the limit the room left shows and is said once (${JSON.stringify({ early, near })})`);
  check(cut.length === max && cut.shown === left(0) && cut.said === left(0),
    `long answer: a paste past the limit is cut by the box, and the page shows and says that none is left (${JSON.stringify(cut)})`);
  check(!errors.length, `long answer: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

finish(await closeAndTally("interact-workshop"));
