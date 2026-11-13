/* Behaviour in a real browser: the page parts between the resources group and the forms: FAQ and first visit, workshops, craft, rooms, words, team, history.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-pages.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { fs, path, BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, addDays, at, browser, canonicalJson, chicagoDate, chicagoOffset, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("FAQ and first visit: keyboard, links and no JavaScript", async () => {
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, javaScriptEnabled, reducedMotion: "reduce" });
    const page = await ctx.newPage(), errors = [], remote = [];
    page.on("pageerror", e => errors.push(e.message));
    /* the reel's own frame talks to Instagram; the page itself never does */
    page.on("request", r => { if (/instagram\.com/.test(r.url()) && r.frame() === page.mainFrame()) remote.push(r.url()); });
    await page.goto(BASE + "/about/faq/#q-group-therapy", { waitUntil: "networkidle" });
    const answer = page.locator("#q-group-therapy"), summary = answer.locator("summary");
    if (javaScriptEnabled) check(await answer.getAttribute("open") !== null, `FAQ ${width}px: deep-linked answer opens`);
    await summary.focus();
    if (await answer.getAttribute("open") !== null) await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    check(await answer.getAttribute("open") !== null && await answer.locator("a").first().isVisible(), `FAQ ${width}px JS=${javaScriptEnabled}: answer and action open by keyboard`);
    const links = await page.locator(".qa-list a").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
    let lands = true;
    for (const href of [...new Set(links)]) {
      if (!href.startsWith("/")) continue;
      const u = new URL(href, BASE), response = await ctx.request.get(u.href.split("#")[0]);
      const html = await response.text();
      if (response.status() !== 200 || (u.hash && !html.includes(`id="${u.hash.slice(1)}"`))) lands = false;
    }
    check(lands, `FAQ ${width}px JS=${javaScriptEnabled}: answer actions land at existing pages and anchors`);
    if (javaScriptEnabled) { await page.goto(BASE + "/about/faq/#%bad"); await sleep(100); }
    await page.goto(BASE + "/join/peer-support-groups/#b-pg-how-details", { waitUntil: "networkidle" });
    const expectations = page.locator("#b-pg-how-details");
    check(await expectations.evaluate((n) => n.tagName === "OL" && !n.closest("details")) && await expectations.isVisible(), `first visit ${width}px JS=${javaScriptEnabled}: expectations show with no fold to open`);
    const state = await page.evaluate(() => ({ scrolls: document.documentElement.scrollWidth > innerWidth + 1, reflection: document.querySelectorAll("main input, main textarea").length, steps: document.querySelectorAll("#b-pg-days .card-steps li").length, room: document.querySelector(".visit-action")?.getAttribute("href") }));
    check(!state.scrolls && !state.reflection && state.steps === 3 && /^\/directions\//.test(state.room || ""), `first visit ${width}px JS=${javaScriptEnabled}: room action, arrival steps and no personal input or overflow`);
    check(!errors.length && !remote.length, `FAQ/first visit ${width}px JS=${javaScriptEnabled}: no script error, and Instagram reached only from the reel's frame`);
    await ctx.close();
  }
});

await part("first visit: current-room refresh waits for focus and exact end", async () => {
  const { makeContext } = await import("../src/render/context.mjs");
  const { renderBlock } = await import("../src/render/registry.mjs");
  const DAY = process.env.TODAY || chicagoDate();
  const at = time => Date.parse(`${DAY}T${time}:00${chicagoOffset(DAY)}`);
  const intro = JSON.parse(fs.readFileSync(path.join(ROOT, "content/pages/peer-support-groups.json"))).blocks[0];
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json")));
  const text = Object.fromEntries(Object.entries(TEXT).map(([k,v]) => [k,v.text]));
  const media = JSON.parse(fs.readFileSync(path.join(ROOT, "media/manifest.json")));
  const markup = (place, now = at("17:59"), stale = false, empty = false) => String(renderBlock(intro, makeContext({ site, media, text, today: DAY, now, builtPaths: ["/directions/sac-mhh/", "/directions/sac-caucus/", "/join/email-list/"], data: { eventsState: { stale }, events: { recurring: [], dated: empty ? [] : [{ id: "example-visit", title: "Example Group", program: "peer", date: DAY, start: "17:00", end: "18:00", place }], places: { hub: { name: "Example Hub", href: "/directions/sac-mhh/" }, changed: { name: "Changed Room", href: "/directions/sac-caucus/" } } } } })));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage();
  await page.clock.install({ time: at("17:59") });
  let release;
  const waiting = new Promise(ok => { release = ok; });
  await page.route("**/join/peer-support-groups/", async route => {
    const response = await route.fetch(), html = await response.text();
    await route.fulfill({ response, body: html.replace(/<body(?=\s)/, '<body data-refresh="events"').replace(/<section\b(?=[^>]*data-block="b-pg-intro")[\s\S]*?<\/section>/, markup("hub")) });
  });
  await page.route("**/api/events/pg-peer-groups", async route => { await waiting; await route.fulfill({ json: { ok: true, today: DAY, blocks: { "b-pg-intro": markup("changed") } } }); });
  await page.goto(BASE + "/join/peer-support-groups/", { waitUntil: "load" });
  await page.locator(".visit-action").focus();
  release(); await sleep(200);
  check(await page.locator(".visit-action").getAttribute("href") === "/directions/sac-mhh/", "first visit: a changed-room reply waits while its Directions action has focus");
  await page.locator("#b-pg-days a.go").first().focus(); await sleep(200);
  check(await page.locator(".visit-action").getAttribute("href") === "/directions/sac-caucus/", "first visit: current-room directions replace the old room once focus leaves");
  await page.locator(".visit-action").focus();
  await page.clock.fastForward(60_000);
  check(await page.locator(".visit-action").isVisible(), "first visit: exact end preserves the focused action until focus leaves");
  await page.locator("#b-pg-days a.go").first().focus(); await sleep(100);
  check(!await page.locator(".visit-action").isVisible(), "first visit: ended directions disappear after focus leaves");
  await page.locator(".visit-event .ended-tag").evaluate((n, words) => n.before(document.createTextNode(words)), words("schedule.signup.link"));
  const endedRows = [];
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    endedRows.push(await page.locator(".visit-event .ended-tag").evaluate((tag, width) => {
      const cell = tag.parentElement, box = tag.getBoundingClientRect();
      const start = cell.getBoundingClientRect().left + parseFloat(getComputedStyle(cell).paddingLeft);
      return { width, dot: getComputedStyle(tag, "::before").content, lineStart: Math.abs(box.left - start) < 1 };
    }, width));
  }
  check(endedRows.every(r => r.width <= 860 ? r.dot === "none" && r.lineStart : r.dot === '\"·\"'), `first visit: Ended starts its own phone line with sign-up text, with the desktop separator retained (${JSON.stringify(endedRows)})`);
  for (const [name, html, phrase] of [["empty", markup("hub", at("17:59"), false, true), words("program.groupNone")], ["unavailable", markup("hub", at("17:59"), true), words("program.groupUnavailable")]]) {
    await page.locator('[data-block="b-pg-intro"]').evaluate((n, html) => { n.outerHTML = html; }, html);
    check(await page.locator(".visit-notice").textContent() === phrase && await page.locator(".visit-action").count() === 0, `first visit: ${name} state offers an honest next step without directions`);
  }
  await ctx.close();
});

await part("Workshop comparison: native previews and changeable request choices", async () => {
  const catalogue = "/join/request-a-workshop/";
  const { makeContext } = await import("../src/render/context.mjs");
  const { renderBlock } = await import("../src/render/registry.mjs");
  const { googleFormUrl } = await import("../src/shared/forms.mjs");
  const formDef = JSON.parse(fs.readFileSync(path.join(ROOT, "content/forms/workshop-request.json")));
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json")));
  const media = JSON.parse(fs.readFileSync(path.join(ROOT, "media/manifest.json")));
  const topics = { "b-rw-networks": "support_network", "b-rw-selfcare": "stress_self_care", "b-rw-advocacy": "self_advocacy", "b-rw-housing": "housing" };
  const proof = path.join(ROOT, "local/workshop-comparison-proof"); fs.mkdirSync(proof, { recursive: true });
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: "reduce" });
    const page = await ctx.newPage(), errors = [], writes = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (!["GET", "HEAD", "OPTIONS"].includes(r.method())) writes.push(r.url()); });
    await page.goto(BASE + catalogue, { waitUntil: "networkidle" });
    const photosBefore = await page.locator(".expect-photos img").evaluateAll(nodes => nodes.map(n => n.getAttribute("src")));
    let jumps = true, previews = true;
    for (const id of Object.keys(topics)) {
      const jump = page.locator(`[data-block="b-rw-head"] a[href="#${id}"]`);
      await jump.focus(); await page.keyboard.press("Enter");
      if (!page.url().endsWith("#" + id) || !(await page.locator("#" + id).isVisible())) jumps = false;
      const detail = page.locator(`#${id}-preview`), summary = detail.locator("summary");
      await summary.focus(); await page.keyboard.press("Enter");
      if (!(await detail.getAttribute("open") !== null) || !(await detail.locator("p").first().isVisible())) previews = false;
      const hasFocus = await summary.evaluate(n => document.activeElement === n && getComputedStyle(n).outlineStyle !== "none");
      if (!hasFocus || !(await page.locator(`#${id} .expect-audience`).isVisible())) previews = false;
      if (width === 390 && !javaScriptEnabled || width === 1280 && javaScriptEnabled) await page.locator(`#${id} .expect-words`).screenshot({ path: path.join(proof, `${id}-${width}-${javaScriptEnabled}.png`) });
      await page.keyboard.press("Space");
      if (await detail.getAttribute("open") !== null) previews = false;
    }
    check(jumps, `Workshop ${width}px JS=${javaScriptEnabled}: equal keyboard jumps reach all four offered topics`);
    check(previews, `Workshop ${width}px JS=${javaScriptEnabled}: native activity disclosures open and close with visible focus and audience guidance`);
    await page.locator(".expect-preview").evaluateAll(nodes => nodes.forEach(n => { n.open = true; }));
    let photosVisible = true;
    for (const img of await page.locator(".expect-photos img").all()) {
      if (!(await img.isVisible())) { photosVisible = false; continue; }
      await img.scrollIntoViewIfNeeded(); await img.evaluate(n => n.decode());
      if (!(await img.evaluate(n => n.naturalWidth > 0 && n.width > 0))) photosVisible = false;
    }
    const photosAfter = await page.locator(".expect-photos img").evaluateAll(nodes => nodes.map(n => n.getAttribute("src")));
    const state = await page.evaluate(() => ({ scrolls: document.documentElement.scrollWidth > innerWidth + 1, inputs: document.querySelectorAll("main input, main textarea, main form").length, unsupported: /Requests must be submitted 5 days/.test(document.querySelector("main").textContent) }));
    check(!state.scrolls && !state.inputs && !state.unsupported && !errors.length && !writes.length && photosVisible && JSON.stringify(photosAfter) === JSON.stringify(photosBefore), `Workshop ${width}px JS=${javaScriptEnabled}: previews preserve photos without overflow, personal input or writes`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(proof, `catalogue-${width}-${javaScriptEnabled}.png`), fullPage: true });
    let choices = true;
    for (const [id, topic] of Object.entries(topics)) {
      await page.goto(BASE + catalogue + "#" + id);
      const action = page.locator(`#${id} a[href="/forms/workshop-request/?topic=${topic}"]`);
      await action.focus(); await page.keyboard.press("Enter");
      await page.waitForURL(`**/forms/workshop-request/?topic=${topic}`);
      const chosen = () => page.locator('input[name="topics"]').evaluateAll(nodes => nodes.filter(n => n.checked).map(n => n.value));
      if (JSON.stringify(await chosen()) !== JSON.stringify([topic])) choices = false;
      const other = Object.values(topics).find(x => x !== topic);
      await showField(page, 'input[name="topics"]');
      await page.locator(`input[name="topics"][value="${topic}"]`).uncheck();
      await page.locator(`input[name="topics"][value="${other}"]`).check();
      if (JSON.stringify(await chosen()) !== JSON.stringify([other])) choices = false;
    }
    check(choices && !writes.length, `Workshop ${width}px JS=${javaScriptEnabled}: every request action carries its topic and the visitor can change it without submitting`);
    let honest = true;
    for (const state of ["google", "manual"]) {
      const def = structuredClone(formDef); def.state = "closed";
      if (state === "google") def.elsewhere = googleFormUrl(def);
      const renderCtx = makeContext({ site, media, text: Object.fromEntries(Object.entries(TEXT).map(([k,v]) => [k,v.text])), formTopic: "housing", data: { forms: { "workshop-request": def } } });
      const html = String(renderBlock({ id: "b-form-workshop-request", type: "form", form: "workshop-request" }, renderCtx));
      await page.locator("main").evaluate((n, html) => { n.innerHTML = html; }, html);
      if (await page.locator("main input, main textarea, main form").count()) honest = false;
      if (state === "google") {
        if (!(await page.getByText(words("form.workshopGoogleSignIn"), { exact: true }).isVisible()) || await page.locator('main a[href="mailto:directors@badgersupports.org"]').count() !== 1 || !(await page.locator("[data-form-elsewhere]").getAttribute("href")).includes("entry.1411124785=Navigating+Housing")) honest = false;
      } else if (await page.locator("[data-form-elsewhere], .form-elsewhere-note").count()) honest = false;
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) honest = false;
      await page.screenshot({ path: path.join(proof, `${state}-${width}-${javaScriptEnabled}.png`), fullPage: true });
    }
    check(honest && !writes.length, `Workshop ${width}px JS=${javaScriptEnabled}: Google sign-in/email guidance and intentional native closure remain truthful without inputs`);
    let homeCarries = true;
    const homeTopics = { "w-networks": "support_network", "w-selfcare": "stress_self_care", "w-advocacy": "self_advocacy", "w-housing": "housing" };
    for (const [id, topic] of Object.entries(homeTopics)) {
      await page.goto(BASE + "/#workshops");
      await page.locator(`[data-tab="${id}"]`).focus(); await page.keyboard.press("Enter");
      const action = page.locator(`[data-panel="${id}"] .ws-actions .btn`);
      if ((await action.getAttribute("href")) !== "/forms/workshop-request/?topic=" + topic) homeCarries = false;
      await action.focus(); await page.keyboard.press("Enter");
      await page.waitForURL(`**/forms/workshop-request/?topic=${topic}`);
      const selected = await page.locator('input[name="topics"]').evaluateAll(nodes => nodes.filter(n => n.checked).map(n => n.value));
      if (JSON.stringify(selected) !== JSON.stringify([topic])) homeCarries = false;
    }
    check(homeCarries && !writes.length, `Workshop ${width}px JS=${javaScriptEnabled}: each Home preview also carries its own topic to the existing native request`);
    await ctx.close();
  }
});

await part("Craft refinement: hierarchy, captions and no JavaScript", async () => {
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: "reduce" });
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(BASE + "/join/craft-nights/", { waitUntil: "networkidle" });
    const jumps = await page.locator("#b-cn-hero .more-links a").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
    let lands = true;
    for (const href of jumps) {
      const link = page.locator(`#b-cn-hero a[href="${href}"]`); await link.focus(); await page.keyboard.press("Enter");
      if (!page.url().endsWith(href) || !(await page.locator(href).isVisible())) lands = false;
    }
    check(lands && jumps.length === 3, `Craft ${width}px JS=${javaScriptEnabled}: keyboard jumps reach expectations, past work and suggestions`);
    const contacts = await page.locator("#b-cn-expect a").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
    const suggestion = await page.locator("#b-cn-cta .btn").getAttribute("href");
    check(contacts.includes("mailto:directors@badgersupports.org") && contacts.includes("mailto:accessibility@badgersupports.org") && suggestion === "/forms/programming-feedback/", `Craft ${width}px JS=${javaScriptEnabled}: materials, access and suggestion actions have usable destinations`);
    let whole = true;
    for (const img of await page.locator("#b-cn-past-work img").all()) {
      await img.scrollIntoViewIfNeeded(); await img.evaluate(img => img.decode());
      const dimensions = await img.evaluate(img => { const b = img.getBoundingClientRect(), frame = img.closest(".photo").getBoundingClientRect(); return { clipped: b.bottom > frame.bottom + 2 || b.right > frame.right + 2 || b.top < frame.top - 2 || b.left < frame.left - 2, shown: b.width > 0 && b.height > 0, ratio: b.width / b.height, alt: img.alt }; });
      /* The gallery stands in one row of even shapes by the owner's setting (craft-row), so a photo
         fills its 4/3 frame instead of showing whole; what must hold is that it sits inside its
         frame, is really shown, and carries its alt words. */
      if (!dimensions.shown || dimensions.clipped || !dimensions.alt || Math.abs(dimensions.ratio - 4 / 3) > .05) whole = false;
    }
    const captions = await page.locator("#b-cn-past-work .card-words").allTextContents();
    const visibleCaptions = await Promise.all((await page.locator("#b-cn-past-work .card-words").all()).map(n => n.isVisible()));
    const visibleTitles = await Promise.all((await page.locator("#b-cn-past-work .card-words h3").all()).map(n => n.isVisible()));
    check(whole && visibleCaptions.every(Boolean) && visibleTitles.length === 6 && visibleTitles.every(Boolean) && captions.length === 6 && /Nostalgic Crafts[\s\S]*September 2026/.test(captions[0]) && /Paint a Planter/.test(captions[1]) && /Pumpkin Painting[\s\S]*October 2026/.test(captions[2]) && /Bracelet Making/.test(captions[3]) && /Bedazzled Crafts/.test(captions[4]) && /Garden Wall/.test(captions[5]), `Craft ${width}px JS=${javaScriptEnabled}: the past-work gallery stands six captioned photos even in their frames`);
    const state = await page.evaluate(() => ({ scrolls: document.documentElement.scrollWidth > innerWidth + 1, inputs: document.querySelectorAll("main input, main textarea").length, cutoff: /\b[35] days before/.test(document.querySelector("#b-cn-access").textContent) }));
    check(!state.scrolls && !state.inputs && !state.cutoff && !errors.length, `Craft ${width}px JS=${javaScriptEnabled}: no overflow, personal input, unsupported cutoff or script error`);
    await ctx.close();
  }
});

await part("Craft refinement: stale recovery preserves focus and recap photos", async () => {
  const { makeContext } = await import("../src/render/context.mjs");
  const { renderBlock } = await import("../src/render/registry.mjs");
  const DAY = process.env.TODAY || chicagoDate(), at = Date.parse(`${DAY}T17:59:00${chicagoOffset(DAY)}`);
  const source = JSON.parse(fs.readFileSync(path.join(ROOT, "content/pages/craft-nights.json"))), hero = source.blocks[0], recent = source.blocks.find(b => b.id === "b-cn-recent");
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"))), media = JSON.parse(fs.readFileSync(path.join(ROOT, "media/manifest.json")));
  const text = Object.fromEntries(Object.entries(TEXT).map(([k,v]) => [k,v.text]));
  const render = (b, room = "hub", stale = false) => String(renderBlock(b, makeContext({ site, media, text, today: DAY, now: at, builtPaths: ["/directions/sac-mhh/", "/directions/sac-caucus/", "/join/email-list/"], data: { eventsState: { stale }, events: { recurring: [], dated: [{ id: "example-current", title: "Example Current Night", program: "craft", date: DAY, start: "17:00", end: "18:00", place: room }, { id: "example-past", title: "Example Past Night", program: "craft", date: addDays(DAY,-1), start: "17:00", end: "18:00", place: "hub", media: "m-people-nostalgic" }], places: { hub: { name: "Example Hub", href: "/directions/sac-mhh/" }, changed: { name: "Changed Room", href: "/directions/sac-caucus/" } } } } })));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } }), page = await ctx.newPage();
  await page.clock.setFixedTime(at);
  let release, n = 0; const waiting = new Promise(ok => { release = ok; });
  await page.route("**/join/craft-nights/", async route => {
    const response = await route.fetch(), html = await response.text();
    await route.fulfill({ response, body: html.replace(/<body(?=\s)/, '<body data-refresh="events"').replace(/<section\b(?=[^>]*data-block="b-cn-hero")[\s\S]*?<\/section>/, render(hero)) });
  });
  await page.route("**/api/events/pg-craft-nights", async route => { const mine = ++n; if (mine === 1) await waiting; await route.fulfill({ json: { ok: true, today: DAY, blocks: { "b-cn-hero": render(hero,"changed",mine===1), "b-cn-recent": render(recent,"changed",mine===1) } } }); });
  await page.goto(BASE + "/join/craft-nights/", { waitUntil: "load" });
  await page.evaluate(() => { window.__craftPhoto = document.querySelector("#b-cn-hero img"); });
  await page.locator("#b-cn-hero .btn").focus(); release(); await sleep(200);
  check(await page.locator("#b-cn-hero .btn").count() === 1, "Craft: stale reply waits while the visit action has focus");
  await page.locator("#b-cn-expect a").first().focus(); await sleep(200);
  check(await page.locator("#b-cn-hero .event-help").count() === 1 && await page.locator("#b-cn-hero a[href*='calendar/']").count() === 0, "Craft: unavailable state replaces unconfirmed attendance and calendar actions after focus leaves");
  await page.locator("#b-cn-hero .event-help a").first().focus();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))); await sleep(200);
  check(await page.locator("#b-cn-hero .event-help").count() === 1, "Craft: recovered current event waits while its contact action has focus");
  await page.locator("#b-cn-expect a").first().focus(); await sleep(200);
  const recovered = await page.locator("#b-cn-hero .btn").getAttribute("href");
  const samePhoto = await page.evaluate(() => window.__craftPhoto === document.querySelector("#b-cn-hero img"));
  check(recovered === "/directions/sac-caucus/" && samePhoto, "Craft: recovered event uses its current room and preserves the existing hero photos");
  const image = page.locator("#b-cn-recent .evshot img").first(); await image.scrollIntoViewIfNeeded(); await image.evaluate(img => img.decode());
  const ratios = [];
  for (const width of [1280,390,320]) { await page.setViewportSize({width,height:900}); ratios.push(await image.evaluate(img => {const b=img.getBoundingClientRect(), frame=img.closest(".photo").getBoundingClientRect(); return Math.abs(b.width/b.height-img.naturalWidth/img.naturalHeight)<.02 && b.bottom<=frame.bottom+2 && b.right<=frame.right+2;})); }
  check(ratios.every(Boolean) && await page.locator("#b-cn-recent .evshot h3").first().isVisible() && await page.locator("#b-cn-recent a[href*='calendar/'], #b-cn-recent .drop").count()===0, "Craft: current recap photos stay whole and captioned at every width without attendance actions");
  await ctx.close();
});

await part("Craft: a recap card without a photo keeps whole words", async () => {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/join/craft-nights/", { waitUntil: "networkidle" });
    const split = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("#b-cn-recent .evcard h3, #b-cn-recent .evcard .evcard-tag")) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (n.parentElement.closest(".sr-only")) continue;
          for (const m of n.textContent.matchAll(/\S+/g)) {
            const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
            const tops = new Set([...r.getClientRects()].map((b) => Math.round(b.top)));
            if (tops.size > 1) out.push(m[0]);
          }
        }
      }
      return { cards: document.querySelectorAll("#b-cn-recent .evcard").length, out };
    });
    check(split.cards > 0 && split.out.length === 0, `Craft: a recap card without a photo keeps whole words at ${width}px${split.out.length ? ` (split: ${split.out.join(", ")})` : ""}${split.cards ? "" : " (no photo-less card in the fixture)"}`);
    await ctx.close();
  }
});

await part("Rooms: each ticket's Directions word stays inside its stub", async () => {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/directions/", { waitUntil: "networkidle" });
    const out = await page.evaluate(() => [...document.querySelectorAll(".ticket-stub")].map((stub) => {
      const s = stub.getBoundingClientRect(), w = stub.querySelector("span").getBoundingClientRect();
      return w.left >= s.left - 0.5 && w.right <= s.right + 0.5 ? null : `${Math.round(w.right - s.right)}px`;
    }));
    const bad = out.filter(Boolean);
    check(out.length > 0 && bad.length === 0, `Rooms: each ticket's Directions word stays inside its stub at ${width}px${bad.length ? ` (${bad.length} of ${out.length} past the edge by ${bad[0]})` : ""}`);
    /* the room's name and address end before the stub starts, or the stub paints over them */
    const hidden = await page.evaluate(() => [...document.querySelectorAll(".ticket")].flatMap((t) => {
      const edge = t.querySelector(".ticket-stub").getBoundingClientRect();
      return [...t.querySelectorAll(".ticket-name, .ticket-where, .ticket-addr")].filter((el) => {
        const r = document.createRange(); r.selectNodeContents(el);
        const rects = [...r.getClientRects()];
        return edge.top < Math.max(...rects.map((b) => b.bottom)) && Math.max(...rects.map((b) => b.right)) > edge.left + 0.5;
      }).map((el) => el.textContent.trim());
    }));
    check(hidden.length === 0, `Rooms: no room's name or address runs under its stub at ${width}px${hidden.length ? ` (${hidden.join("; ")})` : ""}`);
    await ctx.close();
  }
});

await part("Words: no heading or button splits a word, on any page", async () => {
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, ".build/report.json"), "utf8")).pages.map((p) => p.path)
    .filter((p) => p !== "/staff/" && !/\/preview\/$/.test(p) && !/^\/about\/our-team\/./.test(p));
  for (const width of [1280, 1024, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const found = [];
    for (const p of pages) {
      await page.goto(BASE + p, { waitUntil: "load" });
      const split = await page.evaluate(() => {
        const out = new Set();
        for (const el of document.querySelectorAll("main h1, main h2, main .door-title, main .go-label, main .btn")) {
          if (!el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) continue;
          /* an address (an email, a web page) is allowed to break where it must */
          if (/@|\/|\w\.[a-z]{2,}/i.test(el.textContent)) continue;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.parentElement.closest(".sr-only")) continue;
            for (const m of n.textContent.matchAll(/\p{L}{2,}/gu)) {
              const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
              if (new Set([...r.getClientRects()].filter((b) => b.width).map((b) => Math.round(b.top))).size > 1) out.add(m[0]);
            }
          }
        }
        return [...out];
      });
      if (split.length) found.push(`${p} ${split.join(", ")}`);
    }
    check(found.length === 0, `Words: no heading or button splits a word at ${width}px${found.length ? ` (${found.join("; ")})` : ""}`);
    await ctx.close();
  }
});

await part("Team directory: aligned portraits and compact opening", async () => {
  const proof = path.join(ROOT, "local/team-directory-proof"); fs.mkdirSync(proof, {recursive:true});
  for (const width of [1280,768,390,320]) for (const javaScriptEnabled of [true,false]) {
    const ctx = await browser.newContext({viewport:{width,height:900},javaScriptEnabled});
    const page = await ctx.newPage(); await page.goto(BASE + "/about/our-team/", {waitUntil:"networkidle"});
    await page.locator("#b-team .person-role").first().evaluate(n => { n.textContent = "Associate Director of Campus Relations and Community Programs"; });
    const layout = await page.locator("#b-team .people").first().evaluate(n => {
      const boxes = [...n.querySelectorAll(".person-photo")].map(p=>p.getBoundingClientRect());
      const columns = innerWidth > 860 ? 4 : 2, first = boxes.slice(0,columns);
      return { aligned:first.every(b=>Math.abs(b.top-first[0].top)<2), square:boxes.every(b=>Math.abs(b.width-b.height)<2), overflow:document.documentElement.scrollWidth>innerWidth+1, columns:getComputedStyle(n).gridTemplateColumns.split(" ").length };
    });
    const hero = await page.locator('[data-block="b-team-head"]').evaluate(n=>n.getBoundingClientRect().height);
    check(layout.aligned && layout.square && !layout.overflow && layout.columns === (width>860?4:2), `Team ${width}px JS=${javaScriptEnabled}: square portraits align under long roles without overflow`);
    check(hero < (width>860?410:660), `Team ${width}px JS=${javaScriptEnabled}: compact opening leaves room for the directory`);
    const firstLink=page.locator("#b-team .person-link").first(); await firstLink.focus();
    check(await firstLink.evaluate(n=>document.activeElement===n && getComputedStyle(n).outlineStyle!=="none"), `Team ${width}px JS=${javaScriptEnabled}: each profile remains keyboard reachable with visible focus`);
    if(width===1280 || width===390) { await page.keyboard.press("Tab"); await page.screenshot({path:path.join(proof,`directory-${width}-${javaScriptEnabled}.png`),fullPage:true}); }
    await ctx.close();
  }
});

await part("Workshop details: specific native activities and topic requests", async () => {
  const proof=path.join(ROOT,"local/workshop-detail-proof");fs.mkdirSync(proof,{recursive:true});
  for(const width of [1280,390,320]) for(const javaScriptEnabled of [true,false]) {
    const ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled,reducedMotion:"reduce"});const page=await ctx.newPage();
    const writes=[];page.on("request",r=>{if(!["GET","HEAD","OPTIONS"].includes(r.method()))writes.push(r.url());});
    for(const [suffix,short,topic] of [["support-networks","sn","support_network"],["stress-management-self-care","sc","stress_self_care"],["navigating-housing","nh","housing"]]) {
      await page.goto(BASE+"/join/request-a-workshop/behind-the-workshop/"+suffix+"/",{waitUntil:"networkidle"});
      const details=page.locator(`#b-btw-${short}-activity-preview`),summary=details.locator("summary");await summary.focus();await page.keyboard.press("Enter");
      const native=await details.evaluate(n=>n.open && n.querySelectorAll("p").length===2 && document.activeElement===n.querySelector("summary") && getComputedStyle(document.activeElement).outlineStyle!=="none");
      const inputs=await page.locator("main input,main textarea,main form").count();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      const image=page.locator(`#b-btw-${short}-slide .cta-photo img`);await image.scrollIntoViewIfNeeded();await image.evaluate(n=>n.decode());
      const whole=await image.evaluate(n=>{const b=n.getBoundingClientRect();return n.naturalWidth>0 && Math.abs(b.width/b.height-n.naturalWidth/n.naturalHeight)<.025;});
      check(native&&!inputs&&!overflow&&whole&&!writes.length,`Detail ${suffix} ${width}px JS=${javaScriptEnabled}: native text activity, whole slide, no answer inputs or writes`);
      if(width===1280||width===390)await page.screenshot({path:path.join(proof,`${suffix}-${width}-${javaScriptEnabled}.png`),fullPage:true});
      const action=page.locator(`#b-btw-${short}-slide a[href="/forms/workshop-request/?topic=${topic}"]`);await action.focus();await page.keyboard.press("Enter");await page.waitForURL(`**/forms/workshop-request/?topic=${topic}`);
      const chosen=await page.locator('input[name="topics"]').evaluateAll(nodes=>nodes.filter(n=>n.checked).map(n=>n.value));
      check(JSON.stringify(chosen)===JSON.stringify([topic])&&!writes.length,`Detail ${suffix} ${width}px JS=${javaScriptEnabled}: closing request retains its selected topic`);
    }
    await ctx.close();
  }
});

await part("History: complete reading and navigation without JavaScript", async () => {
 const proof=path.join(ROOT,"local/history-proof");fs.mkdirSync(proof,{recursive:true});
 const history=JSON.parse(fs.readFileSync(path.join(ROOT,"content/pages/about-history.json")));
 for(const width of [1280,390,320]) for(const javaScriptEnabled of [true,false]) {
  const ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled,reducedMotion:"reduce"});const page=await ctx.newPage();
  await page.goto(BASE+"/about/what-we-do/",{waitUntil:"networkidle"});const entry=page.getByRole("link",{name:"Our History",exact:true});await entry.focus();await page.keyboard.press("Enter");await page.waitForURL("**/about/history/");
  const visible=await page.locator("main").evaluate(n=>({h1:n.querySelectorAll("h1").length,h2:n.querySelectorAll("h2").length,text:n.textContent,overflow:document.documentElement.scrollWidth>innerWidth+1,hidden:n.querySelectorAll("details,[hidden],input,textarea,form").length}));
  const allCopy=history.blocks.slice(1).every(b=>b.body.every(p=>visible.text.includes(p)));
  check(visible.h1===1&&visible.h2===8&&allCopy&&!visible.overflow&&!visible.hidden,`History ${width}px JS=${javaScriptEnabled}: every era and approved paragraph is readable without hidden content or overflow`);
  const nav=page.locator('#site-nav a[href="/about/history/"]');check(await nav.count()===1,`History ${width}px JS=${javaScriptEnabled}: About navigation includes the page once`);
  const actions=page.locator('[data-block="b-history-era-8"] a');const hrefs=await actions.evaluateAll(nodes=>nodes.map(n=>n.getAttribute("href")));
  let focused=true;for(const link of await actions.all()){await link.focus();if(!(await link.evaluate(n=>document.activeElement===n&&getComputedStyle(n).outlineStyle!=="none")))focused=false;}
  check(focused&&JSON.stringify(hrefs)===JSON.stringify(["/about/what-we-do/","/join/get-involved/","/join/request-a-workshop/"]),`History ${width}px JS=${javaScriptEnabled}: program and involvement actions keep destinations and visible keyboard focus`);
  await page.screenshot({path:path.join(proof,`history-${width}-${javaScriptEnabled}.png`),fullPage:true});
  const back=page.locator('[data-block="b-history-head"] a[href="/about/what-we-do/"]');await back.focus();await page.keyboard.press("Enter");await page.waitForURL("**/about/what-we-do/");
  check(await page.locator("h1").textContent()==="What We Do",`History ${width}px JS=${javaScriptEnabled}: About return link reaches What We Do`);
  await ctx.close();
 }
});

finish(await closeAndTally("interact-pages"));
