/* Behaviour in a real browser: 6. the resources page, and the staff pages that follow it in the file.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-resources.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { fs, path, BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("resources: startup space and no-JavaScript recovery", async () => {
  for (const width of [320, 390, 768]) {
    // An address with filters shows its chips at once; their row is reserved before resources.js runs, so the list stays put.
    for (const query of ["", "?topic=housing&q=housing", "?where=onCampus&how=online&topic=mental-health&q=counseling"]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await ctx.newPage();
      let release;
      const ready = new Promise((ok) => { release = ok; });
      await ctx.route(/\/resources\.js$/, async (route) => { await ready; await route.continue(); });
      try {
        await page.goto(BASE + "/resources/" + query, { waitUntil: "commit" });
        await page.waitForFunction(() => { const list = document.querySelector(".res-list"); return list && getComputedStyle(list).display === "grid"; });
        const measure = () => page.evaluate(async () => {
          await document.fonts.ready;
          const tools = document.querySelector("[data-res-tools]");
          return { hidden: tools.hidden, visibility: getComputedStyle(tools).visibility, height: tools.getBoundingClientRect().height,
            list: document.querySelector(".res-list").getBoundingClientRect().top + scrollY,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        const before = await measure();
        release();
        await page.waitForFunction(() => !document.querySelector("[data-res-tools]").hidden);
        const after = await measure();
        check(before.hidden && before.visibility === "hidden" && before.height > 0 && Math.abs(before.list - after.list) < 1 && after.overflow === 0,
          `resources: ${width}px ${query || "unfiltered"} delayed controls reserve space without moving the list (${JSON.stringify({ before, after })})`);
      } finally { release(); await ctx.close(); }
    }
    const plain = await browser.newContext({ viewport: { width, height: 844 }, javaScriptEnabled: false });
    try {
      const page = await plain.newPage();
      await page.goto(BASE + "/resources/", { waitUntil: "networkidle" });
      const result = await page.evaluate(() => ({ tools: document.querySelector("[data-res-tools]").getBoundingClientRect().height,
        cards: document.querySelectorAll("[data-res]").length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      const details = page.locator(".res-more").first();
      await details.locator("summary").click();
      check(result.tools === 0 && result.cards > 0 && result.overflow === 0 && await details.evaluate(el => el.open),
        `resources: ${width}px without JavaScript keeps cards and native details without an empty control gap (${JSON.stringify(result)})`);
    } finally { await plain.close(); }
  }
});

await part("resources: a card's details and the filter", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/resources/", { waitUntil: "networkidle" });
  const summary = page.locator(".res-more > summary").nth(4);
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  const before = await resState(page);
  await page.keyboard.press("Enter");
  const opened = await resState(page);
  /* The dialog's close event, which unpins the page and scrolls it back, is a task queued after the
     key press resolves; the state is read once it has run. This listener is added after the page's
     own, so it runs after it. */
  await page.evaluate(() => {
    const d = document.querySelector("[data-res-dialog]");
    window.__resClosed = new Promise((ok) => d.addEventListener("close", () => ok(true), { once: true }));
  });
  await page.keyboard.press("Escape");
  // the one bounded wait: it ends early on the close event, and only proves a dialog that never closes
  const closed = await page.evaluate(() => Promise.race([window.__resClosed, new Promise((ok) => setTimeout(() => ok(false), 3000))]));
  const shut = await resState(page);
  const back = await summary.evaluate((s) => s === document.activeElement);
  check(opened.open && closed && !shut.open && back && shut.y === before.y && !shut.locked,
    `resources: a card's details open by keyboard, Escape closes them, focus and scroll come back to the card, and the page scrolls again (${JSON.stringify({ opened: opened.open, closeEvent: closed, shut: shut.open, focusBack: back, y: [before.y, shut.y], locked: shut.locked })})`);
  await page.click('[data-topic="housing"]');
  const word = (await page.locator(".res-card:not([hidden]) h3").first().textContent()).match(/[A-Za-z]{4,}/)[0].toLowerCase();
  await page.fill("#b-res-list-q", word);
  const set = await resState(page);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.goBack({ waitUntil: "networkidle" });
  const kept = await resState(page);
  check(set.topic === "housing" && kept.topic === "housing" && kept.q === word && kept.count === set.count,
    `resources: Back keeps the topic and the search (${JSON.stringify({ set: [set.topic, set.q, set.count], back: [kept.topic, kept.q, kept.count] })})`);
  check(!errors.length, `resources: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

await part("staff page: pages, preview and earlier versions", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
  await goStaff(page, "staff.pages.title");
  const cardOf = (title) => page.locator(".staff-form").filter({ has: page.locator("h3", { hasText: title }) });
  await page.getByLabel(words("staff.pages.field.title")).first().fill("Spring Retreat");
  await page.getByLabel(words("staff.pages.field.path")).first().fill("/Spring Retreat/");
  await page.getByRole("button", { name: words("staff.pages.add.button") }).click();
  await page.waitForFunction((w) => [...document.querySelectorAll(".staff-note")].some((n) => n.textContent === w), words("staff.pages.error.path"), { timeout: 5000 }).catch(() => {});
  const kept = await Promise.all(["staff.pages.field.title", "staff.pages.field.path"].map(key => page.getByLabel(words(key)).first().inputValue()));
  check(kept.join("|") === "Spring Retreat|/Spring Retreat/", `pages: a refused address says why and keeps what was typed (${JSON.stringify(kept)})`);
  await page.getByLabel(words("staff.pages.field.path")).first().fill("/programs/spring-retreat/");
  await page.getByRole("button", { name: words("staff.pages.add.button") }).click();
  await cardOf("Spring Retreat").waitFor({ timeout: 5000 });
  const chip = await cardOf("Spring Retreat").locator(".staff-chip").textContent();
  check(chip === words("staff.pages.state.draft"), `pages: the new page is listed as a draft (${chip})`);

  await cardOf("Spring Retreat").getByRole("button", { name: words("staff.pages.preview") }).click();
  const frame = page.frameLocator(".staff-preview iframe");
  await frame.locator("h1").waitFor({ timeout: 8000 });
  const h1 = await frame.locator("h1").first().textContent();
  const size = () => page.evaluate(() => { const f = document.querySelector(".staff-preview iframe"); const r = f.getBoundingClientRect(); return { w: f.style.width, shown: Math.round(r.width), box: Math.round(f.parentElement.getBoundingClientRect().width) }; });
  const wide = await size();
  await page.getByRole("button", { name: words("staff.pages.preview.phone") }).click();
  const narrow = await size();
  check(h1.trim() === "Spring Retreat" && wide.w === "1280px" && narrow.w === "390px" && wide.shown <= wide.box && narrow.shown <= narrow.box,
    `pages: Preview shows the draft at desktop and phone width, scaled into its box (${JSON.stringify({ h1, wide, narrow })})`);
  await page.screenshot({ path: path.join(ROOT, "local", "staff-pages-preview.png"), fullPage: true });

  await cardOf("Spring Retreat").getByRole("button", { name: words("staff.pages.publish") }).click();
  await cardOf("Spring Retreat").getByLabel(words("staff.pages.field.group")).selectOption("nav-programs");
  await cardOf("Spring Retreat").getByRole("button", { name: words("staff.pages.publish.button") }).click();
  await page.waitForFunction((w) => [...document.querySelectorAll(".staff-form")].some((c) => c.querySelector("h3")?.textContent.startsWith("Spring Retreat") && c.querySelector(".staff-chip")?.textContent === w), words("staff.pages.state.live"), { timeout: 5000 }).catch(() => {});
  const on = await cardOf("Spring Retreat").locator(".staff-chip").textContent();
  const menuNames = await page.evaluate(() => [...document.querySelectorAll(".staff-menu > li > span")].map((s) => s.textContent));
  check(on === words("staff.pages.state.live") && menuNames.length > 2, `pages: Put on the Site makes it live, and the menu lists its entries (${JSON.stringify({ on, menuNames })})`);

  /* Retired, its card offers Put Back, which asks first with focus on the yes; Enter returns it to the site. */
  const chipIs = (w) => page.waitForFunction(([w2]) => [...document.querySelectorAll(".staff-form")].some((c) => c.querySelector("h3")?.textContent.startsWith("Spring Retreat") && c.querySelector(".staff-chip")?.textContent === w2), [w], { timeout: 5000 }).catch(() => {});
  await cardOf("Spring Retreat").getByRole("button", { name: words("staff.pages.retire"), exact: true }).click({ timeout: 5000 });
  await cardOf("Spring Retreat").getByRole("button", { name: words("staff.pages.retire.yes"), exact: true }).click({ timeout: 5000 });
  await chipIs(words("staff.pages.state.retired"));
  const gone = await cardOf("Spring Retreat").locator(".staff-chip").textContent();
  await cardOf("Spring Retreat").getByRole("button", { name: words("staff.pages.putBack"), exact: true }).click({ timeout: 5000 });
  const askedBack = await page.evaluate(() => document.activeElement?.textContent);
  await page.keyboard.press("Enter");
  await chipIs(words("staff.pages.state.live"));
  const back = await cardOf("Spring Retreat").locator(".staff-chip").textContent();
  check(gone === words("staff.pages.state.retired") && askedBack === words("staff.pages.putBack.yes") && back === words("staff.pages.state.live"),
    `pages: a retired page's card offers Put Back, asks first with focus on the yes, and Enter returns it to the site (${JSON.stringify({ gone, askedBack, back })})`);

  const second = menuNames[1];
  await page.getByRole("button", { name: words("staff.pages.menu.up").replace("{{label}}", second) }).click();
  const focus = await page.evaluate(() => document.activeElement?.textContent);
  await page.getByRole("button", { name: words("staff.pages.menu.save") }).click();
  await page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, words("staff.pages.done.menu"), { timeout: 5000 }).catch(() => {});
  const after = await page.evaluate(() => [...document.querySelectorAll(".staff-menu > li > span")].map((s) => s.textContent));
  check(after[0] === second && focus === words("staff.pages.menu.save"), `pages: Up moves an entry, keyboard focus stays in the menu, and Save keeps the order (${JSON.stringify({ after, focus })})`);

  const versions = () => page.evaluate(() => [...document.querySelectorAll("#staff-versions-h ~ div .staff-form > p:first-child")].map((p) => p.textContent));
  const before = await versions();
  const oldest = before.at(-1);
  await goStaff(page, "staff.versions.title");
  await page.getByRole("button", { name: words("staff.versions.restore").replace("{{n}}", "1") }).click();
  const asked = await page.evaluate(() => document.activeElement?.textContent);
  await page.getByRole("button", { name: words("staff.versions.yes") }).click();
  await page.waitForFunction((n) => document.querySelectorAll("#staff-versions-h ~ div .staff-form").length === n, before.length + 1, { timeout: 5000 }).catch(() => {});
  const restored = await versions();
  check(asked === words("staff.versions.yes") && restored.length === before.length + 1 && /^Version 1,/.test(oldest || ""),
    `pages: Bring Back asks again, focused on the yes, and the restore is the newest version (${JSON.stringify({ asked, before: before.length, after: restored.length })})`);

  check(!errors.length, `pages: no script errors (${errors.join("; ")})`);
  await ctx.close();
});

await part("staff page: the sections of a page", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
  await goStaff(page, "staff.pages.title");
  const box = page.locator(".staff-sections-box");
  const names = () => box.evaluate((b) => [...b.querySelectorAll(".staff-sections > li > span")].map((s) => s.firstChild.textContent));
  const retiredNames = () => box.evaluate((b) => [...b.querySelectorAll("h4 + .staff-menu > li > span")].map((s) => s.textContent));
  const status = (key) => page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, words(key), { timeout: 5000 }).then(() => true, () => false);
  const fill = (key, name) => words(key).replace("{{name}}", name);
  await page.locator(".staff-form").filter({ has: page.locator("p", { hasText: /^\/operations\/press\/$/ }) }).getByRole("button", { name: words("staff.sections.open") }).click();
  await box.locator(".staff-sections > li > span").first().waitFor({ timeout: 5000 });
  const opened = await names();
  const heading = await page.evaluate(() => document.activeElement?.id);
  check(opened.length === 3 && heading === "staff-sections-h", `sections: Sections opens the page's list and moves focus to its heading (${JSON.stringify({ opened, heading })})`);

  await page.getByRole("button", { name: fill("staff.sections.down", opened[1]) }).focus();
  await page.keyboard.press("Enter");
  const moved = await names();
  const kept = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.getByRole("button", { name: words("staff.sections.save") }).click();
  const saved = await status("staff.sections.done.order");
  const reloaded = await names();
  check(moved[2] === opened[1] && kept === fill("staff.sections.up", opened[1]) && saved && reloaded.join("|") === moved.join("|"),
    `sections: Down by keyboard moves a section to the bottom, focus stays on its other arrow, and Save the Order keeps it (${JSON.stringify({ moved, kept, saved, reloaded })})`);

  await page.getByRole("button", { name: fill("staff.sections.copyName", opened[1]) }).click();
  const copied = await status("staff.sections.done.copy");
  const withCopy = await names();
  check(copied && withCopy.length === 4 && withCopy.filter((n) => n === opened[1]).length === 2, `sections: Copy adds the section again, after the original (${JSON.stringify(withCopy)})`);

  await page.getByRole("button", { name: fill("staff.sections.retireName", opened[2]) }).click();
  const asked = await page.evaluate(() => document.activeElement?.textContent);
  await page.keyboard.press("Enter");
  const retired = await status("staff.sections.done.retire");
  const gone = await names();
  const listed = await retiredNames();
  check(asked === words("staff.pages.retire.yes") && retired && !gone.includes(opened[2]) && listed.join("|") === opened[2],
    `sections: Retire asks again, focused on the yes, and the section moves to Retired Sections (${JSON.stringify({ asked, gone, listed })})`);
  await page.getByRole("button", { name: fill("staff.sections.backName", opened[2]) }).click();
  const back = await status("staff.sections.done.back");
  const returned = await names();
  check(back && returned.includes(opened[2]) && !(await retiredNames()).length, `sections: Put Back returns it to the page (${JSON.stringify(returned)})`);

  await box.getByLabel(words("staff.sections.field.title")).fill("Made-up Heading");
  await box.getByLabel(words("staff.sections.field.words")).fill("Made-up words.\n\nA second paragraph.");
  await box.getByRole("button", { name: words("staff.sections.add.button") }).click();
  const added = await status("staff.sections.done.add");
  const withNew = await names();
  check(added && withNew.at(-1) === "Made-up Heading", `sections: Add Section puts a Text section at the end by default (${JSON.stringify(withNew)})`);
  await box.scrollIntoViewIfNeeded();
  await box.screenshot({ path: path.join(ROOT, "local", "staff-sections-1280.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await box.screenshot({ path: path.join(ROOT, "local", "staff-sections-390.png") });
  const wide = await box.evaluate((b) => b.scrollWidth <= b.clientWidth + 1);
  check(wide, "sections: at 390 px the list fits its box, with no sideways scroll");
  /* Each row's buttons on one line under its name, Retire among them, and no button's label broken over two lines. A
     button with no box measures as zero lines, so it fails rather than drops out. */
  const rows = await box.evaluate((b, retire) => [...b.querySelectorAll(".staff-sections > li")].filter((li) => li.querySelector(":scope > button")).map((li) => {
    const buttons = [...li.querySelectorAll(":scope > button")];
    const lines = (n) => { const r = document.createRange(); r.selectNodeContents(n); return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size; };
    return { name: li.querySelector(":scope > span").firstChild.textContent, rows: new Set(buttons.map((x) => Math.round(x.getBoundingClientRect().top))).size,
      labels: buttons.map((x) => `${x.textContent}:${lines(x)}`), retire: buttons.some((x) => x.textContent === retire) };
  }), words("staff.sections.retire"));
  const listedRows = withNew.length - 1;
  check(rows.length === listedRows && rows.every((r) => r.retire && r.rows === 1 && r.labels.every((l) => l.endsWith(":1"))),
    `sections: at 390 px Retire sits on one line with the arrows and Copy, each label on one line (${rows.length} of ${listedRows} rows measured; ${JSON.stringify(rows)})`);
  check(!errors.length, `sections: no script errors (${errors.join("; ")})`);
  await ctx.close();
});

await part("staff page: a menu entry taken off and put back", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
  await goStaff(page, "staff.pages.title");
  const fill = (key, label) => words(key).replace("{{label}}", label);
  const status = (key) => page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, words(key), { timeout: 5000 }).then(() => true, () => false);
  const group = () => page.evaluate(() => [...(document.querySelector(".staff-menu > li > ol")?.querySelectorAll(":scope > li > span") || [])].map((s) => s.textContent));
  const offNames = () => page.evaluate((h) => [...document.querySelectorAll(".staff-form h4")].filter((x) => x.textContent === h).flatMap((x) => [...x.nextElementSibling.querySelectorAll("li > span")].map((s) => s.textContent)), words("staff.pages.menu.off"));
  await page.getByRole("button", { name: words("staff.pages.menu.save") }).waitFor({ timeout: 5000 });
  const first = await group();
  const label = first[0];
  await page.getByRole("button", { name: fill("staff.pages.menu.remove", label) }).click();
  const listedNow = await offNames();
  await page.getByRole("button", { name: words("staff.pages.menu.save") }).click();
  const saved = await status("staff.pages.done.menu");
  const listedAfter = await offNames();
  check(listedNow.join("|") === label && saved && listedAfter.join("|") === label && !(await group()).includes(label),
    `menu: Take Off lists the entry under Off the Menu, and it is still there after Save (${JSON.stringify({ label, listedNow, listedAfter })})`);
  const part = page.locator(".staff-form").filter({ has: page.locator("h3", { hasText: words("staff.pages.menu.title") }) });
  await part.scrollIntoViewIfNeeded();
  await part.screenshot({ path: path.join(ROOT, "local", "staff-menu-off-1280.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await part.screenshot({ path: path.join(ROOT, "local", "staff-menu-off-390.png") });
  const fits = await part.evaluate((b) => b.scrollWidth <= b.clientWidth + 1);
  await page.setViewportSize({ width: 1280, height: 900 });
  check(fits, "menu: at 390 px the menu part fits its box, with no sideways scroll");
  await page.getByRole("button", { name: fill("staff.pages.menu.backName", label) }).focus();
  await page.keyboard.press("Enter");
  const back = await group();
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.getByRole("button", { name: words("staff.pages.menu.save") }).click();
  const saved2 = await status("staff.pages.done.menu");
  const end = await group();
  check(back.at(-1) === label && focus === fill("staff.pages.menu.up", label) && saved2 && end.at(-1) === label && !(await offNames()).length,
    `menu: Put Back by keyboard returns it to the end of its group, focus on its Up arrow, and Save keeps it (${JSON.stringify({ back, focus, end })})`);
  check(!errors.length, `menu: no script errors (${errors.join("; ")})`);
  await ctx.close();
});

await part("staff page: Site Settings", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  const { structureNow } = await import("../netlify/lib/structure.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const label = { name: words("staff.settings.field.name"), description: words("staff.settings.field.description"), email: words("staff.settings.field.email"), safety: words("staff.settings.field.safetyExit"), count: words("staff.settings.field.craftCount"), layout: words("staff.settings.field.craftLayout") };
  let { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
  await goStaff(page, "staff.settings.title");
  const form = page.locator("form.staff-settings");
  await form.waitFor({ timeout: 5000 });
  const values = () => form.evaluate((f) => [...f.querySelectorAll("input, textarea")].map((x) => x.value));
  const since = () => form.evaluate((f) => [...f.querySelectorAll(".field")].map((d) => { const l = d.querySelector(".staff-since"); return l && !l.hidden ? l.textContent : ""; }));
  const note = () => form.evaluate((f) => { const n = f.querySelector(".staff-note"); return n && !n.closest("[hidden]") ? n.textContent : ""; });
  const noteIs = (key) => page.waitForFunction((w) => document.querySelector("form.staff-settings .staff-note")?.textContent === w, words(key), { timeout: 5000 }).then(() => true, () => false);
  const save = () => page.getByRole("button", { name: words("staff.settings.save") }).click();

  await page.getByLabel(label.name, { exact: true }).focus();
  const order = [];
  for (let i = 0; i < 7; i++) {
    order.push(await page.evaluate(() => { const a = document.activeElement; return a.labels?.[0]?.textContent || a.textContent; }));
    await page.keyboard.press("Tab");
  }
  check(order.join("|") === [label.name, label.description, label.email, label.safety, label.count, label.layout, words("staff.settings.save")].join("|"),
    `settings: a publisher sees Site Settings, and Tab goes name, description, email, Safety Exit, photo count, gallery layout, Save Settings (${JSON.stringify(order)})`);

  const typed = ["Sifting Badgers Test", "A made-up search description typed in the harness.", "not an address"];
  await page.getByLabel(label.name, { exact: true }).fill(typed[0]);
  await page.getByLabel(label.description, { exact: true }).fill(typed[1]);
  await page.getByLabel(label.email, { exact: true }).fill(typed[2]);
  await save();
  const refused = await noteIs("staff.pages.error.email");
  const keptAfter422 = await values();
  check(refused && keptAfter422.join("|") === [...typed, "https://www.google.com/", "6"].join("|"), `settings: a refused address says why and keeps every typed value (${JSON.stringify({ note: await note(), kept: keptAfter422 })})`);

  // Someone else saves a name and an empty description after this page was opened.
  const theirs = await staffSession(["site.publish"]);
  const other = await handle(post("/api/staff/pages", { action: "settings", expected: (await structureNow()).version, settings: { name: "Their Harness Name", description: "" } }, { headers: { cookie: `bss_staff=${theirs}` } }), { ip: "198.51.100.203" });
  typed[2] = "a11y-test@example.org";
  await page.getByLabel(label.email, { exact: true }).fill(typed[2]);
  await page.setViewportSize({ width: 390, height: 844 });
  await save();
  const conflict = await noteIs("staff.settings.conflict");
  await sleep(300);
  const keptAfter409 = await values();
  const lines = await since();
  const want = [words("staff.settings.since").replace("{{value}}", "Their Harness Name"), words("staff.settings.since").replace("{{value}}", words("staff.settings.none")), "", "", "", ""];
  check(other.status === 200 && conflict && keptAfter409.join("|") === [...typed, "https://www.google.com/", "6"].join("|") && lines.join("|") === want.join("|"),
    `settings: a stale tab keeps the typed values and shows under each changed field the value saved since (${JSON.stringify({ other: other.status, note: await note(), kept: keptAfter409, lines })})`);
  await form.scrollIntoViewIfNeeded();
  await form.screenshot({ path: path.join(ROOT, "local", "staff-settings-conflict-390.png") });
  await page.setViewportSize({ width: 1280, height: 900 });

  await save();
  const saved = await page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, words("staff.settings.done"), { timeout: 5000 }).then(() => true, () => false);
  const stored = (await structureNow()).doc.settings || {};
  const cleared = await since();
  check(saved && stored.name === typed[0] && stored.description === typed[1] && stored.accessibilityEmail === typed[2] && cleared.every((x) => !x) && !(await note()),
    `settings: Save Settings again replaces theirs with the typed values and clears the lines (${JSON.stringify({ saved, stored, cleared })})`);
  check(!errors.length, `settings: no script errors (${errors.join("; ")})`);
  await ctx.close();

  ({ ctx, page } = await openStaff({ session: ["site.edit"] }));
  await goStaff(page, "staff.pages.title");
  await page.locator("#staff-pages-h ~ div ul.staff-forms").first().waitFor({ timeout: 5000 });
  const shown = await page.locator("form.staff-settings").count();
  const headings = await page.evaluate(() => [...document.querySelectorAll("h3")].map((h) => h.textContent));
  check(shown === 0 && !headings.includes(words("staff.settings.title")), `settings: someone with site.edit only does not see Site Settings (forms ${shown})`);
  await ctx.close();
});

await part("staff page: Rooms", async () => {
  await freshServer();
  const { useContent, serverContent } = await import("../netlify/lib/content.mjs");
  const { structureNow } = await import("../netlify/lib/structure.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  let { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
  await goStaff(page, "staff.rooms.title");
  const ROOM = "sac-caucus";
  await page.locator(`[data-room="${ROOM}"]`).click({ timeout: 5000 });
  const form = page.locator("form.staff-room");
  await form.waitFor({ timeout: 5000 });
  const values = () => form.evaluate((f) => [...f.querySelectorAll("input, textarea, select")].map((x) => x.value));
  const since = () => form.evaluate((f) => [...f.querySelectorAll(".staff-since")].filter((l) => !l.hidden).map((l) => l.textContent));
  const note = () => form.evaluate((f) => { const n = f.querySelector(".staff-note"); return n && !n.closest("[hidden]") ? n.textContent : ""; });
  const noteIs = (w) => page.waitForFunction((x) => document.querySelector("form.staff-room .staff-note")?.textContent === x, w, { timeout: 5000 }).then(() => true, () => false);
  const label = (key) => words(key);
  const steps = serverContent().render.places[ROOM].steps;

  await page.getByLabel(label("staff.rooms.field.name"), { exact: true }).focus();
  const order = [];
  for (let i = 0; i < 6 + steps.length * 2 + 1; i++) {
    order.push(await page.evaluate(() => { const a = document.activeElement; const by = a.getAttribute("aria-labelledby"); return a.labels?.[0]?.textContent || (by && document.getElementById(by)?.textContent) || a.textContent; }));
    await page.keyboard.press("Tab");
  }
  const want = [...["name", "short", "building", "where", "address"].map((k) => label(`staff.rooms.field.${k}`)),
    ...steps.flatMap((_, i) => [label("staff.rooms.step").replace("{{n}}", i + 1), label("staff.rooms.field.photo")]), label("staff.rooms.field.note"), label("staff.rooms.save")];
  check(order.join("|") === want.join("|"), `rooms: a publisher opens a room, and Tab goes through its words, each step's words and photo, the note and Save Room (${JSON.stringify(order)})`);

  await page.getByLabel(label("staff.rooms.field.name"), { exact: true }).fill("Sifting Room <b>Test</b>");
  await page.getByLabel(label("staff.rooms.field.note"), { exact: true }).fill("A made-up note typed in the harness.");
  const typed422 = await values();
  await page.getByRole("button", { name: label("staff.rooms.save") }).click();
  const why = label("staff.rooms.error.words").replace("{{field}}", label("staff.rooms.field.name")).replace("{{max}}", "80");
  const refused = await noteIs(why);
  const kept422 = await values();
  check(refused && kept422.join("|") === typed422.join("|"), `rooms: a refused name says why and keeps every typed value (${JSON.stringify({ note: await note(), name: kept422[0], kept: kept422.join("|") === typed422.join("|") })})`);

  // Someone else saves this room's name and its last step's photo after the room was opened.
  const theirs = await staffSession(["site.publish"]);
  const last = steps.at(-1).id;
  const other = await handle(post("/api/staff/pages", { action: "room", room: ROOM, expected: (await structureNow()).version, fields: { name: "Their Harness Room", steps: { [last]: { photo: "m-hub-sea" } } } }, { headers: { cookie: `bss_staff=${theirs}` } }), { ip: "198.51.100.204" });
  await page.getByLabel(label("staff.rooms.field.name"), { exact: true }).fill("Sifting Room Test");
  const typed409 = await values();
  await page.getByRole("button", { name: label("staff.rooms.save") }).click();
  const conflict = await noteIs(label("staff.rooms.conflict"));
  await sleep(300);
  const kept409 = await values();
  const lines = await since();
  const alt = serverContent().media.items.find((m) => m.id === "m-hub-sea").alt;
  const sinceWords = (v) => label("staff.settings.since").replace("{{value}}", v);
  check(other.status === 200 && conflict && kept409.join("|") === typed409.join("|") && lines.join("|") === [sinceWords("Their Harness Room"), sinceWords(alt)].join("|"),
    `rooms: a stale tab keeps the typed values and shows under each changed field what was saved since (${JSON.stringify({ other: other.status, note: await note(), kept: kept409.join("|") === typed409.join("|"), lines })})`);

  await page.getByRole("button", { name: label("staff.rooms.save") }).click();
  const saved = await page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, label("staff.rooms.done"), { timeout: 5000 }).then(() => true, () => false);
  const stored = (await structureNow()).doc.rooms?.[ROOM] || {};
  check(saved && stored.name === "Sifting Room Test" && stored.note === "A made-up note typed in the harness." && stored.steps?.[last]?.photo === null && !(await since()).length && !(await note()),
    `rooms: Save Room again replaces theirs with the typed values and clears the lines (${JSON.stringify({ saved, stored })})`);
  check(!errors.length, `rooms: no script errors (${errors.join("; ")})`);
  await ctx.close();

  ({ ctx, page } = await openStaff({ session: ["site.edit"] }));
  await goStaff(page, "staff.pages.title");
  await page.locator("#staff-pages-h ~ div ul.staff-forms").first().waitFor({ timeout: 5000 });
  const shown = await page.locator("#staff-rooms-h, form.staff-room").count();
  check(shown === 0, `rooms: someone with site.edit only does not see Rooms (${shown})`);
  await ctx.close();
});

await part("resources: Suggest an Update opens with its resource chosen", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/resources/", { waitUntil: "networkidle" });
  const all = await page.locator(".res-card").count();
  await page.fill("#b-res-list-q", "report problem suggest update");
  const matched = await page.locator(".res-card:not([hidden])").count();
  check(all > 0 && matched === 0, `resources: the search does not read the links every card shares (${matched} of ${all} cards match their words)`);
  const href = await page.locator('.res-card .res-report a[href^="/forms/resource-update/?resource="]').nth(4).getAttribute("href");
  const id = decodeURIComponent(href.split("?resource=")[1]);
  const chosen = async (query) => {
    await page.goto(`${BASE}/forms/resource-update/${query}`, { waitUntil: "networkidle" });
    return page.evaluate(() => { const s = document.querySelector('select[name="resource"]'); return s ? s.value : null; });
  };
  const got = await chosen(`?resource=${encodeURIComponent(id)}`);
  const unknown = await chosen("?resource=no-such-resource");
  const none = await chosen("");
  check(got === id && unknown === "" && none === "",
    `resources: Suggest an Update opens with its resource chosen, and an address naming no resource chooses nothing (${JSON.stringify({ id, got, unknown, none })})`);
  check(!errors.length, `resources: the update form has no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

finish(await closeAndTally("interact-resources"));
