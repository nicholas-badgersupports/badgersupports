/* Behaviour in a real browser: the native forms and what surrounds them.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-forms.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { fs, path, BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, takeIpN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("all native forms", async () => {
  const { freshServer } = await import("../test/helpers.mjs");
  const { useContent } = await import("../netlify/lib/content.mjs");
  const { useConnect, connectConfig, serviceConfigNow } = await import("../netlify/lib/connect.mjs");
  const { deliveriesSettled } = await import("../netlify/lib/deliver.mjs");
  const { many } = await import("../netlify/lib/db.mjs");
  const { setSwitch } = await import("../netlify/lib/intake.mjs");
  const { handle } = await import("../netlify/lib/router.mjs");
  const { handlePage, useDist } = await import("../netlify/lib/pages.mjs");
  const snap = JSON.parse(fs.readFileSync(path.join(ROOT, ".build/server.json")));
  const added = ["program-request", "resource-request", "referral-card-survey", "staff-application", "volunteer-application", "recommendation-letter"];
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    await freshServer(); useContent(snap); useConnect(false); useDist(path.join(ROOT, "dist"));
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: "reduce" });
    try {
      const page = await ctx.newPage();
      await page.route(BASE + "/forms/**", async route => {
        const response = await handlePage(new Request(route.request().url()), { today: "2026-11-05" });
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      });
      await page.route(BASE + "/api/forms/**", async route => {
        const r = route.request(), bytes = r.postDataBuffer();
        const response = await handle(new Request(r.url(), { method: r.method(), headers: r.headers(), ...(["GET", "HEAD"].includes(r.method()) ? {} : { body: bytes }) }), { ip: "192.0.2.140" });
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      });
      // Forms ship open; each is closed by its switch here, so its closed page is the one checked.
      for (const key of added) await setSwitch(key, "closed", "fixture");
      for (const key of added) {
        await page.goto(BASE + `/forms/${key}/`, { waitUntil: "networkidle" });
        check(await page.locator("main h1").count() === 1 && await page.locator("form.bss-form").count() === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `native ${key} ${width}px JS=${javaScriptEnabled}: closed production page is readable without overflow`);
      }
      await setSwitch("recommendation-letter", "open", "fixture");
      await page.goto(BASE + "/forms/recommendation-letter/", { waitUntil: "networkidle" });
      if (javaScriptEnabled) {
        await page.locator('[name="name"]').fill("Fictional Example"); await page.locator('[name="email"]').fill("fictional@example.org"); await page.locator('[name="applicant"]').fill("Fictional Applicant");
        await page.locator('input[type="file"]').setInputFiles({ name: "fictional.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% fictional native browser fixture\n%%EOF\n") });
        await page.waitForFunction(() => !!document.querySelector('[data-file-id]')?.value);
        await page.locator('[data-submit]').click(); await page.locator('[data-form-done]').waitFor();
        check(await page.locator('[data-form-done]').isVisible(), `native ${width}px: actual PDF upload and native recommendation submission complete locally`);
      } else {
        check(await page.locator('[data-upload-alternative] a[href^="mailto:"]').isVisible() && !await page.locator('form.has-uploads').isVisible(), `native ${width}px noJS: PDF submission offers a usable contact alternative instead of a nonworking Send`);
        await setSwitch("programming-feedback", "open", "fixture");
        await page.goto(BASE + "/forms/programming-feedback/", { waitUntil: "networkidle" });
        await page.locator('[name="category"][value="general"]').check(); await page.locator('[name="general_comment"]').fill("Fictional general-only feedback.");
        await page.locator('[data-submit]').click(); await page.locator('[data-form-done]').waitFor();
        check(await page.locator('[data-form-done]').isVisible(), `native ${width}px noJS: general feedback submits without unrelated required branches`);
      }
      await deliveriesSettled();
      check(connectConfig() === false && serviceConfigNow() === false && (await many("SELECT state FROM outbox")).every(r => r.state !== "sent"), `native ${width}px JS=${javaScriptEnabled}: fictional submissions cannot reach an external delivery service`);
    } finally { await ctx.close(); }
  }
});

await part("editable native form settings", async () => {
  const { freshServer } = await import("../test/helpers.mjs");
  const { deliveriesSettled } = await import("../netlify/lib/deliver.mjs");
  for (const width of [1280, 390, 320]) {
    await freshServer(); useConnect(false);
    const { ctx, page, errors } = await openStaff({ session: ["site.edit", "forms.switch:staff-application"], viewport: { width, height: 900 } });
    try {
      await goStaff(page, "staff.forms.title");
      let card = page.locator('[data-form-card="staff-application"]');
      await card.locator("summary").click();
      await card.locator('[id$="-opensAt"]').fill("2099-01-01T12:00");
      await card.locator('[id$="-deadline"]').fill("2099-01-08T12:00");
      // The hiring forms ship with a stop time (18 Dec); a later start needs a later stop or the save is refused.
      await card.locator('[id$="-closesAt"]').fill("2099-02-01T12:00");
      await card.locator('[id$="-title"]').fill("Fictional Staff Application");
      await card.getByRole("button", { name: "Save Form Settings", exact: true }).click();
      await card.getByRole("heading", { name: /Fictional Staff Application/ }).waitFor();
      await page.reload({ waitUntil: "networkidle" }); card = page.locator('[data-form-card="staff-application"]');
      await card.locator("summary").click();
      check(await card.locator('[id$="-opensAt"]').inputValue() === "2099-01-01T12:00" && await card.locator('[id$="-deadline"]').inputValue() === "2099-01-08T12:00", `form settings ${width}px: dates and wording persist without a website build`);
      // Forms ship open, so a saved future start shows Scheduled straight away; close, then open again through the confirm.
      await card.getByText("Scheduled", { exact: true }).waitFor();
      await card.getByRole("button", { name: /^Close/, exact: false }).click();
      await card.getByText("Closed", { exact: true }).waitFor();
      await card.getByRole("button", { name: /^Open/, exact: false }).click();
      await card.getByRole("button", { name: "Yes, Open It", exact: true }).click();
      await card.getByText("Scheduled", { exact: true }).waitFor();
      check(await card.getByRole("button", { name: /^Close/, exact: false }).isVisible(), `form settings ${width}px: scheduled intake can still be manually closed`);
      await card.getByRole("button", { name: /^Close/, exact: false }).click();
      await card.getByText("Closed", { exact: true }).waitFor();
      await card.locator('[id$="-closesAt"]').fill("2098-01-01T12:00");
      await card.getByRole("button", { name: "Save Form Settings", exact: true }).click();
      await card.locator('[role="alert"]:not([hidden])').waitFor();
      check(await card.locator('[id$="-closesAt"]').inputValue() === "2098-01-01T12:00", `form settings ${width}px: refused dates keep the user's entries`);
      check(errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `form settings ${width}px: controls fit and have no browser error`);
      await deliveriesSettled();
    } finally { await ctx.close(); }
  }
});

await part("Ribbons: cards, cause dialogs and whole photos", async () => {
  const proof = path.join(ROOT, "local/ribbons-proof"); fs.mkdirSync(proof, { recursive: true });
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: "reduce" });
    try {
      const page = await ctx.newPage(), writes = [];
      page.on("request", r => { if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url()); });
      await page.goto(BASE + "/initiatives/ribbons/", { waitUntil: "networkidle" });
      const labels = await page.locator(".ribbon-name").allTextContents();
      check(labels.length === 27 && labels.includes("Teal & Purple") && !labels.some(t=>/Zebra|Houndstooth/i.test(t)) && !labels.some(t => /red.*white.*blue|orange.*black/i.test(t)), `Ribbons ${width}px JS=${javaScriptEnabled}: 27 text-labelled ribbons omit all requested patterns`);
      const gallery=page.locator(".ribbon-grid");
      const layout=await gallery.evaluate(n=>({cols:getComputedStyle(n).gridTemplateColumns.split(" ").length,art:[...n.querySelectorAll("summary")].every(s=>s.querySelector('svg[aria-hidden="true"]')&&getComputedStyle(s).transitionDuration==="0s")}));
      check(layout.cols===(width>1100?5:width>600?3:2)&&layout.art,`Ribbons ${width}px JS=${javaScriptEnabled}: intentional responsive cards retain decorative art and respect reduced motion`);
      const artFocus=await page.locator(".ribbon-card summary").evaluateAll(nodes=>nodes.every(n=>{const a=n.querySelector(".ribbon-art").getBoundingClientRect(),s=n.getBoundingClientRect(),c=getComputedStyle(n.parentElement);return a.height/s.height>.65&&s.height<(innerWidth>700?285:240)&&c.boxShadow==="none"&&c.borderTopWidth==="0px";}));
      check(artFocus&&await page.locator(".ribbon-reference-heading").count()===0,`Ribbons ${width}px JS=${javaScriptEnabled}: tighter spacing makes the artwork dominant without boxed display cells or a reference heading`);
      const primary = page.getByRole("link", { name: "Ask About Ribbon Pickup", exact: true });
      check(await primary.getAttribute("href") === "mailto:hello@badgersupports.org" && await page.locator('[data-block="b-rb-head"] a[href="/directions/sac-mhh/"]').count() === 1, `Ribbons ${width}px JS=${javaScriptEnabled}: pickup inquiry and Hub directions have distinct destinations`);
      const images = await page.locator("main .photo img").all(); let whole = images.length === 4;
      for (const image of images) { await image.scrollIntoViewIfNeeded(); await image.evaluate(n => n.decode()); whole &&= await image.evaluate(n => { const r = n.getBoundingClientRect(); return n.naturalWidth > 0 && Math.abs(r.width / r.height - n.naturalWidth / n.naturalHeight) < .02; }); }
      check(whole, `Ribbons ${width}px JS=${javaScriptEnabled}: approved card and all three photos remain whole`);
      const station = page.locator('[data-block="b-rb-pickup"]');
      check(await station.locator('a[href="/forms/resource-request/"]').count() === 1 && await station.locator(".btn").count() === 0 && await station.locator('a[href="mailto:hello@badgersupports.org"]').count() === 1, `Ribbons ${width}px JS=${javaScriptEnabled}: station form stays secondary with an email fallback`);
      const jump = page.getByRole("link", { name: "Ribbon Colors and Causes", exact: true });
      await jump.focus(); await page.keyboard.press("Enter"); await page.waitForURL("**/initiatives/ribbons/#b-rb-causes");
      const summary=page.locator(".ribbon-card").filter({has:page.locator(".ribbon-name",{hasText:/^Red$/})}).locator("summary");
      await summary.focus();
      const before=await page.evaluate(()=>({url:location.href,scroll:scrollY,local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage)}));
      check(await summary.evaluate(n=>document.activeElement===n&&getComputedStyle(n).outlineStyle!=="none"),`Ribbons ${width}px JS=${javaScriptEnabled}: cards have visible keyboard focus`);
      if(width===1280||width===390)await page.screenshot({path:path.join(proof,`cards-${width}-${javaScriptEnabled}.png`)});
      await page.keyboard.press("Enter");
      if(javaScriptEnabled) {
        const dialog=page.getByRole("dialog",{name:"Red",exact:true});await dialog.waitFor({state:"visible"});
        const text=await dialog.textContent();
        check(text.includes("In Colors of Support")&&text.includes("Substance Abuse & Addiction")&&text.includes("Associated Causes")&&text.includes("HIV/AIDS")&&await dialog.locator(".ribbon-references a").count()===0,`Ribbons ${width}px: popup keeps both meanings without public reference links`);
        const unique=await page.locator("svg [id]").evaluateAll(nodes=>new Set(nodes.map(n=>n.id)).size===nodes.length);
        const fit=await dialog.evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&n.scrollWidth<=n.clientWidth+1;});
        check(unique&&fit&&await page.locator("html").evaluate(n=>getComputedStyle(n).overflow==="hidden"),`Ribbons ${width}px: popup fits, vector paint IDs stay unique and background scrolling is pinned`);
        const close=dialog.getByRole("button",{name:"Close",exact:true});
        await close.focus();await page.keyboard.press("Shift+Tab");
        const contained=await dialog.evaluate(n=>n.contains(document.activeElement));
        await page.keyboard.press("Tab");
        check(contained&&await close.evaluate(n=>document.activeElement===n),`Ribbons ${width}px: keyboard focus remains inside the open dialog`);
        if(width===1280||width===390)await page.screenshot({path:path.join(proof,`popup-${width}.png`)});
        await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});
        const restored=await page.evaluate(()=>({url:location.href,scroll:scrollY,local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage),pinned:document.documentElement.classList.contains("ribbon-pinned")}));
        check(await summary.evaluate(n=>document.activeElement===n)&&Math.abs(restored.scroll-before.scroll)<2&&!restored.pinned&&restored.url===before.url&&restored.local===before.local&&restored.session===before.session,`Ribbons ${width}px: Escape restores focus and scroll without storing or sharing a choice`);
        await summary.click();await dialog.waitFor({state:"visible"});await close.click();await dialog.waitFor({state:"hidden"});
        check(await summary.evaluate(n=>document.activeElement===n),`Ribbons ${width}px: Close also returns to the chosen card`);
      } else {
        const card=summary.locator("..");
        check(await card.evaluate(n=>n.open)&&await card.locator(".ribbon-details").isVisible()&&(await card.textContent()).includes("HIV/AIDS"),`Ribbons ${width}px: native disclosure exposes the same causes without JavaScript`);
        const contained=await card.evaluate(n=>{const b=n.getBoundingClientRect(),body=n.querySelector(".ribbon-details").getBoundingClientRect();const row=n.parentElement.parentElement.children[innerWidth>1100?5:innerWidth>600?3:2].getBoundingClientRect();return body.bottom<=b.bottom+2&&body.bottom<=row.top;});
        check(contained,`Ribbons ${width}px: expanded native content stays in its card and clears the next row`);
        await page.keyboard.press("Enter");check(!(await card.evaluate(n=>n.open)),`Ribbons ${width}px: native disclosure closes by keyboard`);
      }
      check(!writes.length&&await page.locator("main input,main textarea,main form").count()===0&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Ribbons ${width}px JS=${javaScriptEnabled}: no personal inputs, writes or horizontal overflow`);
      await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(proof,`ribbons-${width}-${javaScriptEnabled}.png`),fullPage:true});
    } finally { await ctx.close(); }
  }
});

await part("Equity: unchanged statement and quiet contacts", async () => {
  const statement = JSON.parse(fs.readFileSync(path.join(ROOT, "content/pages/equity-belonging.json")));
  const paragraphs = statement.blocks.slice(0, 2).flatMap(b => b.body || []);
  const proof = path.join(ROOT, "local/ribbons-proof"); fs.mkdirSync(proof, { recursive: true });
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: "reduce" });
    try {
      const page = await ctx.newPage(); await page.goto(BASE + "/about/equity-belonging/", { waitUntil: "networkidle" });
      const text = await page.locator("main").textContent();
      check(paragraphs.length === 10 && paragraphs.every(p => text.includes(p)), `Equity ${width}px JS=${javaScriptEnabled}: all protected statement paragraphs remain readable`);
      const contact = page.locator('[data-block="b-eb-cta"]');
      const mail = contact.locator('a[href="mailto:directors@badgersupports.org"]');
      await mail.focus();
      check(await contact.locator(".btn").count() === 0 && await contact.locator('a[href="mailto:accessibility@badgersupports.org"]').count() === 1 && await mail.evaluate(n => document.activeElement === n && getComputedStyle(n).outlineStyle !== "none"), `Equity ${width}px JS=${javaScriptEnabled}: director and accessibility contacts are quiet and keyboard reachable`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Equity ${width}px JS=${javaScriptEnabled}: statement has no horizontal overflow`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(proof, `equity-${width}-${javaScriptEnabled}.png`), fullPage: true });
    } finally { await ctx.close(); }
  }
});

await part("room arrival", async () => {
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: "reduce" });
    try {
      const page = await ctx.newPage();
      await page.goto(BASE + "/directions/", { waitUntil: "networkidle" });
      check(await page.locator(".hubcard").count() === 1 && await page.locator(".tickets .ticket").count() === 6, `arrival ${width}px JS=${javaScriptEnabled}: Hub and six event rooms remain distinct`);
      await page.locator('.secnav a[href$="-rooms"]').click();
      check(await page.evaluate(() => { const h = document.querySelector(location.hash); const y = h.getBoundingClientRect().top; return y >= document.querySelector(".site-header").getBoundingClientRect().bottom - 1 && y < innerHeight; }), `arrival ${width}px JS=${javaScriptEnabled}: Event Rooms jump clears the sticky header`);
      for (const id of ["sac-mhh", "sac-caucus", "sac-hearing", "sac-multipurpose", "lcm", "union-south-marquee", "memorial-union-tripp"]) {
        await page.goto(BASE + `/directions/${id}/`, { waitUntil: "networkidle" });
        const addressOnly = ["union-south-marquee", "memorial-union-tripp"].includes(id);
        check(await page.locator("main h1").count() === 1 && await page.locator(".dir-steps").count() === (addressOnly ? 0 : 1) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `arrival ${id} ${width}px JS=${javaScriptEnabled}: readable room, appropriate route and no overflow`);
        check(await page.locator(".dir-side").evaluate(n => { const photo = n.querySelector(".dir-photo"); return !photo || n.querySelector("address").getBoundingClientRect().bottom < photo.getBoundingClientRect().top; }), `arrival ${id} ${width}px JS=${javaScriptEnabled}: address and map precede photography`);
        await page.locator('.dir-side .secnav a[href$="-access"]').click();
        check(await page.locator('.dir-access a[href="mailto:accessibility@badgersupports.org"]').isVisible(), `arrival ${id} ${width}px JS=${javaScriptEnabled}: access contact reached by native jump`);
        await page.locator('.dir-side .secnav a[href$="-next"]').click();
        check(await page.locator(".dir-next").isVisible() && await page.locator(".dir-next").textContent() !== "", `arrival ${id} ${width}px JS=${javaScriptEnabled}: room remains useful with or without events`);
      }
    } finally { await ctx.close(); }
  }
});

await part("form setup wizard", async () => {
  const { saveFormSettings } = await import("../netlify/lib/form-settings.mjs");
  const { currentForm } = await import("../netlify/lib/intake.mjs");
  const proof = path.join(ROOT, "local/form-setup-proof"); fs.mkdirSync(proof, { recursive: true });
  for (const width of [1280, 390, 320]) {
    await freshServer(); useConnect(false);
    const { ctx, page, errors } = await openStaff({ session: ["site.edit", "forms.switch:*"], viewport: { width, height: 900 } });
    try {
      await goStaff(page, "staff.forms.title");
      await page.getByRole("button", { name: "Set Up Forms", exact: true }).click();
      let wizard = page.locator("[data-form-setup]"); await wizard.locator("#setup-form").waitFor({ state: "visible" });
      check(await wizard.locator("#setup-form option").count() === 15, `setup ${width}px: every one of the fourteen forms is selectable`);
      await wizard.locator("#setup-form").selectOption("email-list"); await wizard.getByRole("button", { name: "Next", exact: true }).click();
      await wizard.locator('input[id$="-title"]').fill("Fictional Email Setup");
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      await wizard.locator("#setup-state").selectOption("open"); await wizard.locator('[id$="-deadline"]').fill("2099-01-02T12:00");
      await wizard.getByRole("button", { name: "Back", exact: true }).click();
      check(await wizard.locator('input[id$="-title"]').inputValue() === "Fictional Email Setup", `setup ${width}px: Back retains entered wording`);
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      check(await wizard.locator('[id$="-deadline"]').inputValue() === "2099-01-02T12:00" && await wizard.locator("#setup-state").inputValue() === "open", `setup ${width}px: Back retains the intake choice and dates`);
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      check((await one("SELECT count(*)::int AS n FROM form_settings_history")).n === 0 && (await one("SELECT count(*)::int AS n FROM form_state")).n === 0, `setup ${width}px: review is reached before any write or switch`);
      check((await wizard.textContent()).includes("Previously:") && await wizard.getByRole("button", { name: "Save and Open Form", exact: true }).count() === 1, `setup ${width}px: review shows the actual change and explicit opening action`);
      await wizard.screenshot({ path: path.join(proof, `review-${width}.png`) });
      await wizard.getByRole("button", { name: "Save and Open Form", exact: true }).click();
      await wizard.getByRole("button", { name: "View Form Settings", exact: true }).waitFor();
      const saved = await currentForm("email-list");
      check(saved.manualState === "open" && saved.def.title === "Fictional Email Setup" && saved.settings.deadline === "2099-01-02T12:00", `setup ${width}px: one real request saves settings and opens intake`);
      await wizard.getByRole("button", { name: "View Form Settings", exact: true }).click();
      const card = page.locator('[data-form-card="email-list"]');
      check(await card.locator('[id$="-title"]').inputValue() === "Fictional Email Setup" && await card.locator(".staff-form-settings").evaluate(n => n.open), `setup ${width}px: full settings immediately show the wizard's saved values`);
      await page.getByRole("button", { name: "Set Up Forms", exact: true }).click();
      wizard = page.locator("[data-form-setup]"); await wizard.locator("#setup-form").selectOption("workshop-request"); await wizard.getByRole("button", { name: "Next", exact: true }).click();
      await wizard.locator('input[id$="-title"]').fill("Cancelled draft"); await wizard.getByRole("button", { name: "Cancel Setup", exact: true }).click();
      check((await one("SELECT count(*)::int AS n FROM form_settings_history")).n === 1 && (await currentForm("workshop-request")).settings.version === 0, `setup ${width}px: Cancel makes no changes`);
      check(errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `setup ${width}px: no browser error or horizontal overflow`);
    } finally { await ctx.close(); }
  }
  await freshServer(); useConnect(false);
  {
    const { ctx, page } = await openStaff({ session: ["site.edit"], viewport: { width: 390, height: 900 } });
    await goStaff(page, "staff.forms.title");
    try {
      await page.getByRole("button", { name: "Set Up Forms", exact: true }).click(); const w = page.locator("[data-form-setup]"); await w.locator("#setup-form").waitFor({ state: "visible" });
      await w.locator("#setup-form").selectOption("staff-application"); await w.getByRole("button", { name: "Next", exact: true }).click();
      await w.locator('input[id$="-title"]').fill("Editor Only Title"); await w.getByRole("button", { name: "Next", exact: true }).click();
      check(await w.locator("input,select,textarea").count() === 0, "setup editor: hidden date and switch fields are not required or blanked");
      await w.getByRole("button", { name: "Next", exact: true }).click(); await w.getByRole("button", { name: "Save Form Settings", exact: true }).click();
      await w.getByRole("button", { name: "View Form Settings", exact: true }).waitFor();
      check((await currentForm("staff-application")).def.title === "Editor Only Title" && (await one("SELECT count(*)::int AS n FROM form_state")).n === 0, "setup editor: can save wording without changing intake");
    } finally { await ctx.close(); }
  }
  await freshServer(); useConnect(false);
  {
    const { ctx, page } = await openStaff({ session: ["forms.switch:staff-application"], viewport: { width: 320, height: 900 } });
    await goStaff(page, "staff.forms.title");
    try {
      await page.getByRole("button", { name: "Set Up Forms", exact: true }).click(); const w = page.locator("[data-form-setup]"); await w.locator("#setup-form").waitFor({ state: "visible" });
      check(await w.locator("#setup-form option").count() === 2, "setup switcher: only the permitted form is offered");
      await w.locator("#setup-form").selectOption("staff-application"); await w.getByRole("button", { name: "Next", exact: true }).click();
      check(await w.locator("input,textarea").count() === 0, "setup switcher: wording stays read-only");
      await w.getByRole("button", { name: "Next", exact: true }).click(); await w.locator("#setup-state").selectOption("open"); await w.locator('[id$="-opensAt"]').fill("2099-01-01T12:00");
      // The shipped stop time comes before that start: the save is refused, the dates step returns with the entries, and nothing opens.
      await w.getByRole("button", { name: "Next", exact: true }).click(); await w.getByRole("button", { name: "Save and Open Form", exact: true }).click();
      await w.locator('[role="alert"]:not([hidden])').waitFor();
      check(await w.locator('[id$="-opensAt"]').inputValue() === "2099-01-01T12:00" && (await one("SELECT count(*)::int AS n FROM form_state")).n === 0 && (await one("SELECT count(*)::int AS n FROM form_settings_history")).n === 0, "setup switcher: a start after the shipped stop time is refused, keeps the entry and opens nothing");
      await w.locator('[id$="-closesAt"]').fill("2099-02-01T12:00");
      await w.getByRole("button", { name: "Next", exact: true }).click(); await w.getByRole("button", { name: "Save and Open Form", exact: true }).click(); await w.getByRole("button", { name: "View Form Settings", exact: true }).waitFor();
      check((await currentForm("staff-application")).stateReason === "scheduled", "setup switcher: future opening is saved as scheduled, not falsely shown accepting now");
    } finally { await ctx.close(); }
  }
  await freshServer(); useConnect(false);
  {
    const { ctx, page } = await openStaff({ session: ["site.edit", "forms.switch:*"], viewport: { width: 390, height: 900 } });
    await goStaff(page, "staff.forms.title");
    try {
      await page.getByRole("button", { name: "Set Up Forms", exact: true }).click(); const w = page.locator("[data-form-setup]"); await w.locator("#setup-form").waitFor({ state: "visible" });
      await w.locator("#setup-form").selectOption("workshop-request"); await w.getByRole("button", { name: "Next", exact: true }).click(); await w.locator('input[id$="-title"]').fill("Kept Draft Title");
      await w.getByRole("button", { name: "Next", exact: true }).click(); await w.locator("#setup-state").selectOption("open"); await w.getByRole("button", { name: "Next", exact: true }).click();
      const f = await currentForm("workshop-request"); await saveFormSettings("workshop-request", { ...f.settings, title: "Concurrent Title" }, "fixture");
      await w.getByRole("button", { name: "Save and Open Form", exact: true }).click(); await w.getByRole("button", { name: "Reload Current Settings", exact: true }).waitFor();
      check((await w.textContent()).includes("Kept Draft Title") && (await one("SELECT count(*)::int AS n FROM form_state")).n === 0, "setup conflict: entries remain and a rejected save never opens intake");
      await w.getByRole("button", { name: "Reload Current Settings", exact: true }).click(); await w.getByText("Current settings reloaded.", { exact: false }).waitFor();
      check((await w.textContent()).includes("Concurrent Title") && (await w.textContent()).includes("Kept Draft Title"), "setup conflict: refreshed review keeps edits and shows the newer saved value");
      await w.getByRole("button", { name: "Save and Open Form", exact: true }).click(); await w.getByRole("button", { name: "View Form Settings", exact: true }).waitFor();
      check((await currentForm("workshop-request")).def.title === "Kept Draft Title" && (await many("SELECT * FROM form_settings_history")).length === 2, "setup conflict: deliberate second save applies once after refreshed review");
    } finally { await ctx.close(); }
  }
});

await part("resource form validation", async () => {
  for (const key of ["resource-problem", "resource-update"]) for (const width of [1280, 390, 320]) {
    await freshServer(); useConnect(false);
    await q("INSERT INTO form_state(form_key,state,changed_by) VALUES($1,'open','harness')", [key]);
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await ctx.newPage(); const errors = []; let sends = 0;
      page.on("pageerror", e => errors.push(e.message));
      const preview = `/forms/${key}/`;
      await page.route(u => u.pathname === preview, async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()).replace(' data-preview=""', "") });
      });
      await page.route(`**/api/forms/${key}/**`, async route => {
        const request = route.request(); const address = new URL(request.url());
        const headers = { origin: ORIGIN, "sec-fetch-site": "same-origin" };
        for (const name of ["content-type", "accept"]) if (request.headers()[name]) headers[name] = request.headers()[name];
        if (address.pathname.endsWith("/submit")) sends++;
        const response = await handle(new Request(ORIGIN + address.pathname + address.search, { method: request.method(), headers, body: request.method() === "POST" ? request.postData() : undefined }), { ip: `192.0.2.${takeIpN()}` });
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      });
      await page.goto(BASE + preview, { waitUntil: "networkidle" });
      const catalog = await page.evaluate(key => {
        const def = JSON.parse(document.getElementById(`form-def-${key}`).textContent);
        return { offered: [...document.querySelectorAll("#f-resource option")].filter(o => o.value).map(o => o.value), checked: def.sections.flatMap(s => s.questions).find(q => q.type === "resource").resources?.map(r => r.id) };
      }, key);
      check(catalog.offered.length > 0 && JSON.stringify(catalog.offered) === JSON.stringify(catalog.checked), `${key} ${width}px: browser validation has exactly the choices shown in the dropdown`);
      await page.locator("#f-resource").selectOption(catalog.offered[0]);
      if (key === "resource-problem") await page.locator("#f-problem").fill("Fictional resource problem for browser verification");
      else { await page.locator("#f-field").selectOption("other"); await page.locator("#f-words").fill("Fictional resource update for browser verification"); }
      await page.locator("[data-submit]").click(); await page.locator("[data-form-done]").waitFor();
      const rows = await many("SELECT answers FROM submissions WHERE form_key=$1", [key]);
      check(sends === 1 && rows.length === 1 && rows[0].answers.resource === catalog.offered[0], `${key} ${width}px: selecting a displayed resource reaches the actual intake once and saves its ID`);
      check(errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${key} ${width}px: successful enhanced submission has no browser error or horizontal overflow`);
    } finally { await ctx.close(); }
  }
});

await part("recommendation cycle context", async () => {
  const key = "recommendation-letter"; const cycle = "hc-0123456789ab";
  const cases = [{ query: `?cycle=${cycle}`, context: { hiringCycleId: cycle } }, { query: `?cycle=${cycle}&cycle=hc-abcdef012345`, context: { hiringCycleId: "" } }, { query: "", context: {} }];
  for (const [index, scenario] of cases.entries()) {
    await freshServer(); useConnect(false);
    await q("INSERT INTO form_state(form_key,state,changed_by) VALUES($1,'open','harness')", [key]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    try {
      const page = await ctx.newPage(); const errors = []; let submits = 0; let posted = null;
      page.on("pageerror", e => errors.push(e.message));
      const preview = `/forms/${key}/`;
      await page.route(u => u.pathname === preview, async route => {
        const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace(' data-preview=""', "") });
      });
      await page.route(`**/api/forms/${key}/**`, async route => {
        const request = route.request(); const address = new URL(request.url());
        const headers = { origin: ORIGIN, "sec-fetch-site": "same-origin" };
        for (const name of ["content-type", "accept", "x-file-name"]) if (request.headers()[name]) headers[name] = request.headers()[name];
        if (address.pathname.endsWith("/submit")) { submits++; posted = request.postDataJSON(); }
        const response = await handle(new Request(ORIGIN + address.pathname + address.search, { method: request.method(), headers, body: request.method() === "POST" ? request.postDataBuffer() : undefined }), { ip: `192.0.2.${230 + index}` });
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      });
      await page.goto(BASE + preview + scenario.query, { waitUntil: "networkidle" });
      await page.evaluate(() => { window.testAnalytics = []; document.addEventListener("bss:analytics", e => window.testAnalytics.push(e.detail)); });
      await page.locator("#f-name").fill("Fictional Referrer"); await page.locator("#f-email").fill("fictional@example.org"); await page.locator("#f-applicant").fill("Fictional Applicant");
      await page.locator("#f-letter").setInputFiles({ name: "fictional-cycle-letter.pdf", mimeType: "application/pdf", buffer: PDF });
      await page.waitForFunction(() => !!document.querySelector('[data-upload="letter"] [data-file-id]')?.value);
      await page.locator("[data-submit]").click(); await page.locator("[data-form-done]").waitFor();
      const row = await one("SELECT answers,context FROM submissions WHERE form_key=$1", [key]);
      check(submits === 1 && JSON.stringify(row.context) === JSON.stringify(scenario.context), `letter context ${index}: address context survives native upload and actual intake exactly once`);
      check(!Object.hasOwn(row.answers, "_cycle") && (Object.hasOwn(scenario.context, "hiringCycleId") ? posted._cycle === scenario.context.hiringCycleId : !Object.hasOwn(posted, "_cycle")), `letter context ${index}: explicit invalid remains distinct from bare and context is never an answer`);
      const analytics = await page.evaluate(() => window.testAnalytics);
      check(errors.length === 0 && analytics.length > 0 && analytics.every(e => Object.keys(e).sort().join(",") === "form,name"), `letter context ${index}: no browser errors or cycle/answer information in analytics`);
    } finally { await ctx.close(); }
  }
});

finish(await closeAndTally("interact-forms"));
