/* Behaviour in a real browser, against the running local site: the things a screenshot cannot show.
 *
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact.mjs
 *
 * TODAY is the day the local site draws its pages for (check.mjs passes the build's day; the
 * server's own default when it is not given).
 *
 * 1. The phone menu: Escape closes the innermost open layer (a sub-menu, then the menu) and puts
 *    focus back on what opened it; a click or tap outside closes it; widening the window past the
 *    phone layout closes it; without JavaScript the links simply show.
 * 2. A file question while its upload is still going: a cleared, wrong or oversized replacement,
 *    or a second PDF, never leaves Send stuck on "wait for your file", and an older reply never
 *    puts back a file that was replaced. The applications are closed as shipped, so the page is a
 *    preview; the harness serves it as an open form and answers its uploads itself, slowly, with
 *    made-up ids. The real upload route is tested in test/applications.test.mjs. On the same
 *    page: every question takes the form's column at 1280, 390 and 320 while a short value's
 *    control stays compact, and folded help opens from its label by keyboard and without JavaScript.
 * 3. The workshop form, with its API answered by the real router against a fresh database in this
 *    process: a version published while the page is open (a question added, or renamed, with and
 *    without JavaScript), Send pressed twice, a lost reply, no connection, the form closed under
 *    the page, and a long answer pasted past its limit.
 * 4. The staff page in each state: signed in (no Sign In flash), signed out, a sign-in that has
 *    ended, coming back to the page that sent you, an editor who reads nothing, answers refused,
 *    Back after signing out, a dropped connection, a phone, and no JavaScript; and the edit
 *    button when the sign-in ends with words in its box, or when other words are opened in the box
 *    while a save is still going; its key, earlier versions and Restore; and the pages, sections, menu, Site
 *    Settings and Rooms parts (a refused or stale save of settings or a room keeps what was typed and shows what was
 *    saved since).
 * 5. The events between publishes (src/client/schedule.js), on the home page served as a page built
 *    from Connect's events, with the answers made up here from its own markup: a section with focus
 *    in it is not replaced until focus leaves; Back or Forward to a kept page moves "Today" and asks
 *    again; and of two answers, the newer ask's wins even when the older one arrives last.
 * 6. The resources page: a card's details open and close by keyboard and leave the page as it was,
 *    and Back keeps the topic and search.
 * Fictional files and people only: a few bytes that start as a PDF does, Avery Example and Robin Example.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { chromium } from "playwright";
import { finish } from "./finish.mjs";
import { chicagoDate } from "../src/render/context.mjs";
import { addDays, chicagoOffset } from "../src/render/events.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:8899";
const TEXT = JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text;
const words = (key) => TEXT[key]?.text ?? `(no text ${key})`;
const results = [];
const check = (ok, what) => results.push({ ok: !!ok, what });
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/* A part that throws is a failure of that part, and the rest still run. */
async function part(name, fn) {
  if (process.env.INTERACT_PART && !name.includes(process.env.INTERACT_PART)) return;
  try { await fn(); } catch (e) { check(false, `${name}: ${String(e.message).split("\n")[0]}`); }
}

const browser = await chromium.launch();

/* ------------------------------------------------------------------ 1. the phone menu */

const menuState = (page) => page.evaluate(() => {
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.getElementById("site-nav");
  const sub = [...document.querySelectorAll("details[data-nav]")].find((d) => d.open);
  return {
    expanded: toggle.getAttribute("aria-expanded"),
    shown: !!nav.getClientRects().length && getComputedStyle(nav).display !== "none",
    sub: sub ? sub.querySelector("summary").textContent.trim() : null,
    focus: document.activeElement === toggle ? "toggle" : document.activeElement?.tagName === "SUMMARY" ? `summary:${document.activeElement.textContent.trim()}` : document.activeElement?.tagName,
  };
});

/* Opens the phone menu from a known closed state, whatever the last step left behind. */
async function openMenu(page, tap) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await (tap ? page.tap("[data-menu-toggle]") : page.click("[data-menu-toggle]"));
}

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

/* ------------------------------------------------------------------ 2. an upload still going */

const PAGE = "/forms/staff-application/preview/";
const PDF = Buffer.from("%PDF-1.4\n% a made-up file for the harness\n%%EOF\n");
const fakeId = (n) => `${"F".repeat(31)}${n}`;

/* The preview served as the open form it will be, and uploads answered after `delays[n]` ms. */
async function openForm(delays) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route((u) => u.pathname === PAGE, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(' data-preview=""', "") });
  });
  await page.route("**/api/forms/staff-application/state", (route) => route.fulfill({ json: { ok: true, state: "open" } }));
  let n = 0;
  await page.route("**/api/forms/staff-application/files?**", async (route) => {
    const i = n++;
    await sleep(delays[i] ?? 0);
    await route.fulfill({ json: { ok: true, fileId: fakeId(i) } }).catch(() => {});
  });
  await page.goto(BASE + PAGE, { waitUntil: "networkidle" });
  const live = await page.evaluate(() => !document.querySelector("form[data-form]").hasAttribute("data-preview"));
  if (!live) throw new Error("the harness could not serve the preview as an open form");
  return { ctx, page, errors };
}

const resume = (page) => page.evaluate(() => {
  const box = document.querySelector('[data-upload="resume"]');
  return { id: box.querySelector("[data-file-id]").value, status: box.querySelector("[data-upload-status]").textContent };
});

/* Send pressed: either the wait message, or the form's own answer about the missing questions. */
async function pressSend(page) {
  await page.click("[data-submit]");
  await sleep(50);
  return page.evaluate(() => {
    const sum = document.querySelector("[data-error-summary]");
    return {
      status: document.querySelector("[data-form-status]").textContent,
      summary: !sum.hidden,
      resumeListed: !!sum.querySelector('a[href="#f-resume"]'),
    };
  });
}

const replacements = [
  ["cleared", []],
  ["not a PDF", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("made-up notes") }],
  ["over 3 MB", { name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024)]) }],
];
for (const [what, files] of replacements) await part(`upload ${what}`, async () => {
  const { ctx, page, errors } = await openForm([1200]);
  await page.setInputFiles("#f-resume", { name: "resume.pdf", mimeType: "application/pdf", buffer: PDF });
  const going = await resume(page);
  await page.setInputFiles("#f-resume", files);
  const sent = await pressSend(page);
  check(sent.status !== words("form.upload.wait") && sent.summary && sent.resumeListed,
    `upload ${what} while the first is still going: Send answers with the missing resume, not "wait" (status "${sent.status}", summary ${sent.summary})`);
  await sleep(1400);
  const after = await resume(page);
  check(going.status.startsWith("Uploading") && after.id === "", `upload ${what}: the first file's late reply does not come back (id "${after.id}", status "${after.status}")`);
  const again = await pressSend(page);
  check(again.status !== words("form.upload.wait"), `upload ${what}: Send still answers after the late reply (status "${again.status}")`);
  check(!errors.length, `upload ${what}: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("upload replaced by a second PDF", async () => {
  const { ctx, page, errors } = await openForm([1200, 100]);
  await page.setInputFiles("#f-resume", { name: "old.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.setInputFiles("#f-resume", { name: "new.pdf", mimeType: "application/pdf", buffer: PDF });
  await sleep(400);
  const mid = await resume(page);
  await sleep(1200);
  const after = await resume(page);
  check(mid.id === fakeId(1) && after.id === fakeId(1) && after.status.includes("new.pdf"), `a second PDF replaces the first, and the first's late reply is ignored (id ${after.id}, "${after.status}")`);
  const sent = await pressSend(page);
  check(sent.status !== words("form.upload.wait") && sent.summary && !sent.resumeListed, `with the replacement up, Send checks the rest of the form and the resume counts as answered`);
  check(!errors.length, `replacement: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("upload still going", async () => {
  const { ctx, page } = await openForm([800]);
  await page.setInputFiles("#f-resume", { name: "resume.pdf", mimeType: "application/pdf", buffer: PDF });
  const sent = await pressSend(page);
  check(sent.status === words("form.upload.wait"), `Send during a real upload still says to wait ("${sent.status}")`);
  await sleep(1000);
  const after = await page.evaluate(() => document.querySelector("[data-form-status]").textContent);
  check(after !== words("form.upload.wait"), `once that upload is up, the wait message goes ("${after}")`);
  await ctx.close();
});

/* A question takes the form's whole column (a 40rem cap left 640px fields in a 715px column at
   1280), a control for a short value keeps its compact width, and secondary help stays folded
   until asked for, by keyboard as by pointer, with or without JavaScript. */
const COMPACT = 'input[type="number"], input[type="tel"], input[type="date"], input[type="datetime-local"], .other-text, .rank select';
const widths = (page) => page.evaluate((compact) => {
  const shown = (el) => el.getClientRects().length > 0;
  const form = document.querySelector("form[data-form]").getBoundingClientRect().width;
  const fields = [...document.querySelectorAll(".bss-form .field")].filter(shown);
  const short = fields.filter((f) => Math.abs(f.getBoundingClientRect().width - form) > 1).map((f) => f.id || f.querySelector("[id]")?.id);
  const controls = [...document.querySelectorAll(".bss-form .field input:not([type=checkbox]):not([type=radio]):not([type=file]), .bss-form .field textarea, .bss-form .field select")].filter(shown);
  const narrow = controls.filter((c) => !c.matches(compact) && Math.abs(c.getBoundingClientRect().width - c.closest(".field").getBoundingClientRect().width) > 1).map((c) => c.id);
  const compacts = controls.filter((c) => c.matches(compact)).map((c) => c.getBoundingClientRect().width < c.closest(".field").getBoundingClientRect().width - 1);
  return { form: Math.round(form), fields: fields.length, short, narrow, compacts, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}, COMPACT);

await part("a form's width", async () => {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + PAGE, { waitUntil: "networkidle" });
    const r = await widths(page);
    check(r.fields > 10 && !r.short.length, `@${width}: every question takes the ${r.form}px column (${r.fields} questions${r.short.length ? `; narrower: ${r.short.slice(0, 4).join(", ")}` : ""})`);
    check(!r.narrow.length, `@${width}: every text box and list fills its question${r.narrow.length ? ` (not: ${r.narrow.slice(0, 4).join(", ")})` : ""}`);
    if (width === 1280) check(r.compacts.length && r.compacts.every(Boolean), `@1280: a short value's control stays compact (${r.compacts.length} of them)`);
    check(r.sideways <= 0, `@${width}: nothing scrolls sideways`);
    await ctx.close();
  }
});

await part("Other answer fields at phone and desktop widths", async () => {
  const paths = ["/forms/staff-application/preview/", "/forms/volunteer-application/preview/", "/forms/program-request/preview/", "/forms/programming-feedback/"];
  for (const js of [true, false]) for (const width of [1280, 768, 390, 320]) for (const path of paths) {
    const branches = js && path.includes("programming-feedback") ? ["workshop", "craft", "peer"] : [null];
    for (const branch of branches) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: js });
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: "load" });
      if (branch) await page.locator(`input[name="category"][value="${branch}"]`).check();
      if (js) for (const control of await page.locator('input[value="__other"]').all()) if (await control.isVisible()) await control.check();
      const inputs = await page.locator("input.other-text:visible").all();
      let fits = inputs.length > 0;
      for (const input of inputs) {
        await input.fill("An example Other answer");
        const r = await input.evaluate(el => {
          const b = el.getBoundingClientRect(), p = el.closest(".choices").getBoundingClientRect();
          return { width: b.width, right: b.right, parentRight: p.right, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, value: el.value };
        });
        fits &&= r.width >= 100 && r.right <= r.parentRight + 1 && r.overflow <= 0 && r.value === "An example Other answer";
      }
      check(fits, `Other input ${js ? "JS" : "no JS"} @${width} ${path}${branch ? `/${branch}` : ""}: ${inputs.length} fields fit, stay usable and accept typing`);
      await ctx.close();
    }
  }
});

await part("folded help", async () => {
  for (const js of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: js });
    const page = await ctx.newPage();
    await page.goto(BASE + PAGE, { waitUntil: "networkidle" });
    const folds = await page.evaluate(() => [...document.querySelectorAll("details.prose-more")].map((d) => d.open));
    check(folds.length > 0 && folds.every((o) => !o), `${js ? "" : "no JavaScript: "}${folds.length} folds, all closed until asked for`);
    const first = page.locator("details.prose-more > summary").first();
    if (js) {
      await first.focus();
      await page.keyboard.press("Enter");
      const opened = await page.evaluate(() => { const d = document.querySelector("details.prose-more"); return d.open && d.querySelector(".prose-more-body").getBoundingClientRect().height > 0; });
      await page.keyboard.press("Space");
      const shut = await page.evaluate(() => !document.querySelector("details.prose-more").open);
      check(opened && shut, `a fold opens with Enter and closes with Space from its label (${opened}, ${shut})`);
    } else {
      await first.click();
      check(await page.evaluate(() => document.querySelector("details.prose-more").open), "no JavaScript: a fold still opens when its label is pressed");
    }
    await ctx.close();
  }
});

/* ------------------------------------------------------------------ 3. the form changes, or the reply is lost */

/* The workshop page as built, with its API answered by the real router against a fresh PGlite
   database in this process, so a test can publish a new version or close the form under it. */
const { freshServer, ORIGIN } = await import("../test/helpers.mjs");
const { handle } = await import("../netlify/lib/router.mjs");
const { many, one, q } = await import("../netlify/lib/db.mjs");
const { serverContent } = await import("../netlify/lib/content.mjs");
const WORKSHOP = "/forms/workshop-request/";
let ipN = 10;

async function publishWorkshop(change) {
  const v2 = structuredClone(serverContent().forms["workshop-request"]);
  v2.version = 2;
  change(v2);
  await q("INSERT INTO form_versions (form_key, version, definition, published_by) VALUES ('workshop-request', 2, $1::jsonb, 'harness')", [JSON.stringify(v2)]);
}
const questionsOf = (def, id) => def.sections.find((s) => s.id === id).questions;

/* `onSubmit(route, run)` decides what happens to each Send; `run()` puts it through the router. */
async function openWorkshop({ js = true, onSubmit } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: js });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const ip = `198.51.100.${ipN++}`;
  const sends = [];
  const run = async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const headers = { origin: ORIGIN, "sec-fetch-site": "same-origin" };
    for (const h of ["content-type", "accept"]) if (r.headers()[h]) headers[h] = r.headers()[h];
    const res = await handle(new Request(ORIGIN + u.pathname + u.search, { method: r.method(), headers, body: r.method() === "POST" ? r.postData() : undefined }), { ip });
    return { status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() };
  };
  await page.route("**/api/forms/workshop-request/**", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill(await run(route));
    sends.push(route.request().postData());
    return onSubmit ? onSubmit(route, () => run(route), sends.length) : route.fulfill(await run(route));
  });
  await page.goto(BASE + WORKSHOP, { waitUntil: "networkidle" });
  return { ctx, page, errors, sends };
}

async function fillWorkshop(page) {
  for (const [id, v] of [["name", "Avery Example"], ["email", "avery@example.org"], ["affiliation", "Example Hall Council"], ["attendees", "25"],
    ["option_1", "2026-11-02T18:00"], ["option_2", "2026-11-03T18:00"], ["option_3", "2026-11-04T18:00"],
    ["location", "Example Hall lounge"], ["group_notes", "First workshop for the group."], ["access_needs", "None known."]]) await page.fill(`#f-${id}`, v);
  await page.check('input[name="topics"][value="stress_self_care"]');
  await page.check('input[name="projection"][value="yes"]');
}

const formState = (page) => page.evaluate(() => {
  const form = document.querySelector("form[data-form]");
  const n = form?.querySelector("[data-form-notice]");
  const sum = form?.querySelector("[data-error-summary]");
  const island = form && document.getElementById(`form-def-${form.dataset.form}`);
  return {
    form: !!form,
    notice: n && !n.hidden ? n.textContent : "",
    summaryFocused: !!sum && document.activeElement === sum,
    listed: sum && !sum.hidden ? [...sum.querySelectorAll("a[href^='#f-']")].map((a) => a.getAttribute("href").slice(3)) : [],
    status: form?.querySelector("[data-form-status]")?.textContent || "",
    disabled: !!form?.querySelector("[data-submit]")?.disabled,
    name: form?.querySelector("#f-name")?.value ?? null,
    key: form?.querySelector("[data-idem]")?.value ?? null,
    version: form?.querySelector('[name="_version"]')?.value ?? null,
    islandVersion: island ? JSON.parse(island.textContent).version : null,
    kept: [...(form?.querySelectorAll(".kept-answers dd") || [])].map((d) => d.textContent),
    ref: document.querySelector("[data-form-done] .ref")?.textContent || "",
  };
});
const send = async (page) => { await page.click("[data-submit]"); await page.waitForTimeout(300); return formState(page); };

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

/* ------------------------------------------------------------------ 4. the staff page, in each state */

/* The staff page as built, its API answered by the real router. A signed-in director is a session
   row written straight into the fresh database, so no Connect is needed: test/staff.test.mjs signs
   in through a fake Connect. Robin Example and their answers are made up. */
const crypto = await import("node:crypto");
const { post, workshopAnswers } = await import("../test/helpers.mjs");
const { useConnect, canonicalJson, hmacB64u, CLIENT_ID } = await import("../netlify/lib/connect.mjs");
const { netlifyLocation } = await import("./dev-server.mjs");
const STAFF = "/staff/";
/* Sign-in switched on, with no Connect behind it: nothing here delivers. Two calls are answered: Connect's shared sign-in
   quotes (Connect GOOGLE-SIGNIN), one made-up line, so the quote under the button is pressed and timed like the rest; and
   the trade of a one-time code this harness made itself (harnessCodes), for a note signed with the harness's made-up key,
   so one sign-in goes through the real callback. */
const HARNESS_QUOTE = "A made-up line for the harness.";
const HARNESS_SSO = "s".repeat(40);
const harnessCodes = new Map();   // a code the harness made → the nonce of the sign-in start it wrote
const reply = (body) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
useConnect({ url: "https://connect.example.test", keyId: "harness-key", secret: "h".repeat(40), ssoSecret: HARNESS_SSO, statusCheck: false,
  fetch: async (href, init) => {
    const body = JSON.parse(init.body);
    if (body.action === "publicSigninQuotes") return reply({ ok: true, quotes: [HARNESS_QUOTE] });
    if (body.action === "publicSsoToken" && harnessCodes.has(body.code)) {
      const now = Math.floor(Date.now() / 1000);
      const assertion = { v: 1, aud: CLIENT_ID, iat: now, exp: now + 120, nonce: harnessCodes.get(body.code), sub: "u-harness-1", name: "Robin Example", active: true, scopes: ["site.edit"] };
      harnessCodes.delete(body.code);
      return reply({ ok: true, assertion, sig: hmacB64u(HARNESS_SSO, canonicalJson(assertion)) });
    }
    throw new TypeError("no Connect in this harness");
  } });

async function staffSession(scopes) {
  const id = crypto.randomBytes(32).toString("base64url");
  await q(`INSERT INTO staff_sessions (id_hash, sub, name, scopes, expires_at) VALUES ($1, 'u-harness-1', 'Robin Example', $2::jsonb, now() + interval '8 hours')`,
    [crypto.createHash("sha256").update(id).digest("hex"), JSON.stringify(scopes)]);
  return id;
}

/* `session`: scopes for a signed-in director, or null. `hint`: the cookie a past sign-in leaves.
   `slow`: ms each answer waits, or `(path) => ms`. `fail(path, n)`: true to drop that request, as a
   lost connection. */
/* `auth`: the sign-in start cookie a press of Sign in leaves. Each redirect the API answers is sent as Netlify sends it,
   and its Location is kept in `redirects`. */
async function openStaff({ session = null, hint = !!session, auth = null, slow = 0, fail, path = STAFF, js = true, viewport = { width: 1280, height: 900 }, init = null } = {}) {
  const ctx = await browser.newContext({ viewport, javaScriptEnabled: js });
  const cookies = [];
  if (session) cookies.push({ name: "bss_staff", value: await staffSession(session), url: BASE });
  if (hint) cookies.push({ name: "bss_staff_hint", value: "1", url: BASE });
  if (auth) cookies.push({ name: "bss_auth", value: auth, url: BASE });
  if (cookies.length) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  /* Every frame, whether the sign-in button or the checking line could be seen. */
  await page.addInitScript(() => {
    window.__seen = { signIn: false, checking: false };
    const shown = (sel) => { const n = document.querySelector(sel); return !!n && !!n.getClientRects().length && getComputedStyle(n).visibility !== "hidden"; };
    const look = () => { if (shown("[data-staff-signin] a")) window.__seen.signIn = true; if (shown("[data-staff-checking]")) window.__seen.checking = true; requestAnimationFrame(look); };
    requestAnimationFrame(look);
  });
  const calls = {};
  const redirects = [];
  await page.route("**/api/**", async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    calls[u.pathname] = (calls[u.pathname] || 0) + 1;
    if (fail?.(u.pathname, calls[u.pathname])) return route.abort("internetdisconnected");
    const wait = typeof slow === "function" ? slow(u.pathname) : slow;
    if (wait) await sleep(wait);
    const all = await r.allHeaders();
    const headers = { origin: ORIGIN, "sec-fetch-site": "same-origin" };
    for (const h of ["content-type", "accept", "cookie"]) if (all[h]) headers[h] = all[h];
    const res = await handle(new Request(ORIGIN + u.pathname + u.search, { method: r.method(), headers, body: r.method() === "POST" ? r.postData() : undefined, redirect: "manual" }), { ip: "198.51.100.200" });
    const out = { status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) };
    if (out.headers.location) redirects.push(out.headers.location = netlifyLocation(u.search, res.status, out.headers.location));
    const set = res.headers.getSetCookie();
    if (set.length) out.headers["set-cookie"] = set.join("\n");
    await route.fulfill(out).catch(() => {});
  });
  await page.goto(BASE + path, { waitUntil: js ? "networkidle" : "load" });
  return { ctx, page, errors, calls, redirects };
}

const staffState = (page) => page.evaluate(() => {
  const seen = (n) => !!n && !n.closest("[hidden]") && !!n.getClientRects().length;
  const signIn = document.querySelector("[data-staff-signin] a");
  const intro = document.querySelector("[data-staff-intro]");
  const quote = document.querySelector("[data-staff-quote]");
  const app = document.querySelector("[data-staff-app]");
  return {
    signIn: seen(signIn), href: signIn?.getAttribute("href") || "",
    checking: seen(document.querySelector("[data-staff-checking]")),
    intro: seen(intro) ? intro.textContent.trim() : "", introParas: intro ? intro.querySelectorAll("p").length : 0,
    quote: seen(quote) ? quote.textContent.trim() : "", help: !!document.querySelector("[data-staff-help], .staff details"),
    who: seen(document.querySelector(".staff-who")) ? document.querySelector(".staff-who p").textContent : "",
    notes: [...new Set(document.querySelectorAll(".staff-note, .staff-answers p"))].filter(seen).map((n) => n.textContent),
    headings: [...app.querySelectorAll("h2")].filter(seen).map((h) => h.textContent),
    text: document.querySelector("main")?.innerText || document.body.innerText,
    tables: document.querySelectorAll(".staff-table").length,
    buttons: [...document.querySelectorAll(".staff button, .staff a.btn")].filter(seen).map((b) => b.textContent),
    hint: /(?:^|;\s*)bss_staff_hint=1/.test(document.cookie),
  };
});

await part("staff page: signed in, no Sign In flash", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["forms.read:*", "site.edit"], slow: 600 });
  const s = await staffState(page);
  const seen = await page.evaluate(() => window.__seen);
  check(!seen.signIn && seen.checking && s.who === "Signed in as Robin Example" && !s.signIn,
    `staff signed in: the Sign In button never shows while the session is checked, a checking line does, then who is signed in (sign-in seen ${seen.signIn}, checking seen ${seen.checking}, "${s.who}")`);
  check(!s.intro && !s.quote, `staff signed in: the before-sign-in words and the quote give way to the tools (intro "${s.intro.slice(0, 40)}", quote "${s.quote}")`);
  check(s.text.includes(words("staff.forms.how")), "staff signed in, a reader: the forms part says answers are worked through in Connect");
  check(!errors.length, `staff signed in: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("staff page: signed out", async () => {
  const { ctx, page } = await openStaff({ slow: 400 });
  const s = await staffState(page);
  const seen = await page.evaluate(() => window.__seen);
  check(s.signIn && !seen.checking && s.introParas === 1 && !s.help,
    `staff signed out: the button shows at once, no checking line, one short line before it, no help under it (checking seen ${seen.checking}, paragraphs ${s.introParas}, help ${s.help})`);
  const order = await page.evaluate(() => {
    const a = document.querySelector("[data-staff-signin] a"), q = document.querySelector("[data-staff-quote]");
    return !!q && !!(a.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check(order && s.quote === HARNESS_QUOTE, `staff signed out: Connect's quote shows under the sign-in button ("${s.quote}")`);
  await page.keyboard.press("Tab");
  let tabs = 0;
  while (tabs++ < 30 && !(await page.evaluate(() => !!document.activeElement?.closest("[data-staff-signin]")))) await page.keyboard.press("Tab");
  const next = await (async () => { await page.keyboard.press("Tab"); return page.evaluate(() => document.activeElement?.tagName); })();
  check(tabs < 30 && next !== "SUMMARY", `staff signed out, keyboard: Tab reaches Sign in, and no folded help comes next (after sign-in, ${next})`);
  await ctx.close();
});

await part("staff page: a past sign-in that has ended", async () => {
  const { ctx, page } = await openStaff({ hint: true });
  // the edit button may forget the hint before the staff page has said anything: wait for the page's own answer
  await page.waitForFunction((w) => [...document.querySelectorAll(".staff-note")].some((n) => n.textContent === w), words("staff.ended"), { timeout: 3000 }).catch(() => {});
  const s = await staffState(page);
  check(s.signIn && s.notes.includes(words("staff.ended")) && !s.hint && !s.who,
    `staff ended: says the sign-in has ended, offers Sign in, and forgets the hint (notes ${JSON.stringify(s.notes)}, hint ${s.hint})`);
  await ctx.close();
});

await part("staff page: another module clears the hint before staff starts", async () => {
  const { ctx, page } = await openStaff({ hint: true, init: () => {
    const observer = new MutationObserver(() => {
      if (!document.documentElement?.classList.contains("staff-hint")) return;
      document.cookie = "bss_staff_hint=; Path=/; Max-Age=0; SameSite=Lax";
      observer.disconnect();
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  } });
  await page.waitForFunction((w) => [...document.querySelectorAll(".staff-note")].some((n) => n.textContent === w), words("staff.ended"), { timeout: 3000 }).catch(() => {});
  const s = await staffState(page);
  check(s.signIn && s.notes.includes(words("staff.ended")) && !s.hint && !s.who,
    "staff ended: the page remembers its initial hint after another module clears the cookie");
  await ctx.close();
});

await part("staff page: the place to come back to", async () => {
  let { ctx, page } = await openStaff({ path: `${STAFF}?return=/forms/workshop-request/` });
  let s = await staffState(page);
  check(s.href === "/api/auth/start?return=%2Fforms%2Fworkshop-request%2F", `staff return: Sign in comes back to the page that sent you (${s.href})`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ path: `${STAFF}?return=//elsewhere.test/` }));
  s = await staffState(page);
  check(s.href === "/api/auth/start?return=/staff/", `staff return: an address off this site is ignored (${s.href})`);
  await ctx.close();
});

/* Signing in comes back with nothing after the page's address: Netlify puts the callback's code and state on the
   router's redirect, and the page takes those two back off for a browser that has just signed in, and only those two. */
await part("staff sign-in: the address bar", async () => {
  await freshServer();
  const b64 = (n) => crypto.randomBytes(n).toString("base64url");
  const state = b64(24), code = b64(24), nonce = b64(16);
  await q(`INSERT INTO auth_starts (state_hash, verifier, nonce, return_to, expires_at) VALUES ($1, $2, $3, $4, now() + interval '10 minutes')`,
    [crypto.createHash("sha256").update(state).digest("hex"), b64(48), nonce, STAFF]);
  harnessCodes.set(code, nonce);
  let { ctx, page, errors, redirects } = await openStaff({ auth: state, path: `/api/auth/callback?code=${code}&state=${state}` });
  const s = await staffState(page);
  const bar = () => { const u = new URL(page.url()); return u.pathname + u.search; };
  const sent = redirects.join(" ");
  check(sent.startsWith(`${STAFF}?code=`) && bar() === STAFF && s.who === "Signed in as Robin Example" && !errors.length,
    `staff sign-in: after signing in the address bar reads ${STAFF}, though the redirect arrived as Netlify sends it (bar "${bar()}", redirect sent "${sent.replace(/=[^&]{6,}/g, "=…")}", "${s.who}"${errors.length ? `, errors: ${errors.join(" | ")}` : ""})`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ path: "/?code=a&state=b" }));
  check(bar() === "/?code=a&state=b", `staff sign-in: a page's own code and state stay for a browser that has not signed in (bar "${bar()}")`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ hint: true, path: "/?keep=1&code=a&state=b" }));
  check(bar() === "/?keep=1", `staff sign-in: only code and state leave the address, the rest of it stays (bar "${bar()}")`);
  await ctx.close();
});

await part("staff page: editor only", async () => {
  await freshServer();
  const { ctx, page } = await openStaff({ session: ["site.edit"] });
  const s = await staffState(page);
  check(s.who && s.headings.includes(words("staff.forms.title")) && s.headings.includes(words("staff.edit.title")) && !s.buttons.includes(words("staff.answers.show")) && !s.buttons.includes(words("staff.switch.open")) && !s.buttons.includes(words("staff.edit.download")),
    `staff editor only: form wording and page tools without answers, intake controls or publishing (headings ${JSON.stringify(s.headings)})`);
  await ctx.close();
});

await part("staff page: when the words last reached the site, and Refresh Now", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"] });
  const before = words("staff.edit.timing").split("{{when}}")[0];
  let s = await staffState(page);
  check(s.text.includes(before + words("staff.edit.neverUpdated")), `refresh: the page says changes take up to 30 minutes, and that nothing has been published yet ("${s.text.split("\n").find((l) => l.startsWith(before)) || ""}")`);
  const button = page.getByRole("button", { name: words("staff.edit.refresh") });
  await button.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, words("staff.edit.refreshed"), { timeout: 5000 }).catch(() => {});
  s = await staffState(page);
  const line = s.text.split("\n").find((l) => l.startsWith(before)) || "";
  check(/\d{4}/.test(line) && !line.includes(words("staff.edit.neverUpdated")), `refresh: pressed by keyboard, the line names when the site last updated ("${line}")`);
  await button.click();
  await page.waitForTimeout(300);
  s = await staffState(page);
  check(s.text.includes(words("staff.edit.refreshSoon")), "refresh: pressed again within the minute, it says to wait, and nothing else happens");
  check(!errors.length, `refresh: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("staff page: answers the account may no longer read", async () => {
  await freshServer();
  await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), { ip: "198.51.100.201" });
  const { ctx, page } = await openStaff({ session: ["forms.read:workshop-request"], slow: 500 });
  await q("UPDATE staff_sessions SET scopes = '[\"site.edit\"]'::jsonb");
  const show = page.getByRole("button", { name: words("staff.answers.show") });
  await show.click({ timeout: 3000 });
  await sleep(350); // the words change after 200 ms; the answer takes 500
  const waiting = await page.evaluate(() => { const b = document.querySelector(".staff-form button"); return { text: b.textContent, busy: b.getAttribute("aria-busy") }; });
  check(waiting.text === words("staff.answers.loading") && waiting.busy === "true", `staff answers: while they load the button says so (${JSON.stringify(waiting)})`);
  await sleep(700);
  const s = await staffState(page);
  check(s.notes.includes(words("staff.forbidden")) && !s.tables, `staff answers refused: the reason shows where the answers would be (notes ${JSON.stringify(s.notes)})`);
  await ctx.close();
});

await part("staff page: Open and Close a form", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["forms.switch:resource-problem"] });
  const rows = async () => (await q("SELECT state FROM form_state WHERE form_key = 'resource-problem'")).rows.map((r) => r.state);
  const card = () => page.evaluate(() => {
    const li = document.querySelector(".staff-form");
    return { chip: li?.querySelector(".staff-chip")?.textContent, buttons: [...(li?.querySelectorAll(".staff-switch button") || [])].map((b) => b.textContent),
      text: li?.textContent || "", focus: document.activeElement?.textContent || "", forms: document.querySelectorAll(".staff-form").length };
  });
  const first = await card();
  check(first.forms === 1 && first.chip === words("staff.forms.state.closed") && first.buttons.join("|") === words("staff.switch.open") && !first.text.includes(words("staff.forms.none")),
    `staff switch: someone who may only switch a form sees it closed, with Open and no answers (${JSON.stringify(first)})`);
  await page.getByRole("button", { name: words("staff.switch.open") }).click();
  const asked = await card();
  check(asked.buttons.join("|") === `${words("staff.switch.yes")}|${words("staff.switch.cancel")}` && asked.focus === words("staff.switch.yes") && !(await rows()).length,
    `staff switch: Open asks again first, with the yes focused, and sends nothing (${JSON.stringify(asked)})`);
  await page.getByRole("button", { name: words("staff.switch.cancel") }).click();
  const kept = await card();
  check(kept.buttons.join("|") === words("staff.switch.open") && kept.focus === words("staff.switch.open") && !(await rows()).length, `staff switch: Keep It Closed puts Open back, focused (${JSON.stringify(kept)})`);
  await page.getByRole("button", { name: words("staff.switch.open") }).click();
  await page.getByRole("button", { name: words("staff.switch.yes") }).click();
  await page.waitForFunction((w) => document.querySelector(".staff-form .staff-chip")?.textContent === w, words("staff.forms.state.open"));
  const open = await card();
  check(open.buttons.join("|") === words("staff.switch.close") && open.focus === words("staff.switch.close") && /is open\./.test(open.text) && (await rows()).join() === "open",
    `staff switch: the yes opens it; the chip, the button and the line follow the server (${JSON.stringify(open)})`);
  await page.getByRole("button", { name: words("staff.switch.close") }).click();
  await page.waitForFunction((w) => document.querySelector(".staff-form .staff-chip")?.textContent === w, words("staff.forms.state.closed"));
  check((await rows()).join() === "closed" && (await card()).buttons.join("|") === words("staff.switch.open"), "staff switch: Close goes at once, with no second question");
  check(!errors.length, `staff switch: no script errors (${errors.join("; ")})`);
  await ctx.close();
});

await part("staff page: Back after signing out", async () => {
  await freshServer();
  await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), { ip: "198.51.100.202" });
  const { ctx, page } = await openStaff({ session: ["forms.read:*"] });
  await page.getByRole("button", { name: words("staff.answers.show") }).click();
  await page.waitForSelector(".staff-table");
  /* Headless Chromium here keeps no page in the back-forward cache (measured), so the events a
     browser fires when it stores and restores one are fired by hand. */
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  const stored = await staffState(page);
  check(!stored.tables && !stored.who, `staff Back: leaving the page takes the answers off it before a browser stores it (tables ${stored.tables})`);
  await q("DELETE FROM staff_sessions");
  await ctx.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await sleep(400);
  const back = await staffState(page);
  check(back.signIn && !back.who && !back.tables, `staff Back: coming back to a stored page checks again, and a signed-out browser sees Sign in (who "${back.who}")`);
  await ctx.close();
});

await part("staff page: the connection drops", async () => {
  await freshServer();
  // Down for every check until Try again; the edit button asks too, and may ask first.
  let down = true;
  const { ctx, page } = await openStaff({ session: ["forms.read:*"], fail: (p) => p === "/api/staff/me" && down });
  let s = await staffState(page);
  check(s.notes.includes(words("staff.loadError")) && s.buttons.includes(words("staff.tryAgain")) && !s.checking, `staff offline: says so, with Try again, and stops checking (buttons ${JSON.stringify(s.buttons)})`);
  down = false;
  await page.getByRole("button", { name: words("staff.tryAgain") }).click({ timeout: 3000 });
  await sleep(400);
  s = await staffState(page);
  check(s.who === "Signed in as Robin Example" && !s.notes.includes(words("staff.loadError")), `staff offline: Try again signs in without a reload ("${s.who}")`);
  await ctx.close();
});

await part("staff page: phone and no JavaScript", async () => {
  let { ctx, page } = await openStaff({ viewport: { width: 390, height: 844 } });
  const box = await page.locator("[data-staff-signin] a").boundingBox();
  check(box && box.y + box.height <= 844, `staff phone: Sign in is on the first screen at 390×844 (bottom ${box ? Math.round(box.y + box.height) : "none"})`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ hint: true, js: false }));
  const s = await staffState(page);
  check(s.signIn && !s.checking, `staff without JavaScript: Sign in shows even after a past sign-in, and no checking line (sign-in ${s.signIn}, checking ${s.checking})`);
  await ctx.close();
});

await part("edit button: the sign-in ends while words are in the box", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/" });
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.locator("[data-block] [data-edit-target]").first().click({ timeout: 3000 });
  await q("DELETE FROM staff_sessions");
  await page.fill(".edit-dialog textarea", "Words typed before the sign-in ended");
  await page.getByRole("button", { name: words("edit.save") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.querySelector(".edit-status a"), null, { timeout: 3000 }).catch(() => {});
  const box = await page.evaluate(() => {
    const a = document.querySelector(".edit-status a");
    return { status: document.querySelector(".edit-status").textContent, href: a?.getAttribute("href"), target: a?.target, rel: a?.rel, value: document.querySelector(".edit-dialog textarea").value, open: document.querySelector(".edit-dialog").open };
  });
  check(box.open && box.value === "Words typed before the sign-in ended" && box.status.startsWith(words("edit.error.signedOut")),
    `edit button, sign-in ended: the box stays open with the words in it, and says so ("${box.status}")`);
  check(box.href === "/api/auth/start?return=%2F" && box.target === "_blank" && /noopener/.test(box.rel),
    `edit button, sign-in ended: Sign in again opens in a new tab and comes back to this page (${box.href}, ${box.target})`);
  check(!errors.length, `edit button, sign-in ended: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

/* The box closed (Escape) and other words opened in it while the first save is still going. The
   first answer used to close the box on the second words, or, when it was a conflict, write the
   first place's words into it and point Save at the first place. */
async function editTwoPlaces({ conflict }) {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/", slow: (p) => (p === "/api/staff/edit/save" ? 1200 : 0) });
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-editing"), null, { timeout: 3000 });
  const [first, second] = await page.evaluate(() => [...new Set([...document.querySelectorAll("main [data-block] [data-edit-target]")].map((n) => n.getAttribute("data-edit-target")))].slice(0, 2));
  if (conflict) await q("INSERT INTO content_edits (target, value, previous, edited_by, edited_name) VALUES ($1, 'Made-up words someone else saved', '', 'u-harness-2', 'Avery Example')", [first]);
  const mark = (target) => page.locator(`[data-edit-target="${target}"]`).first();
  await mark(first).click({ timeout: 3000 });
  await page.fill(".edit-dialog textarea", "Made-up words for the first place");
  await page.getByRole("button", { name: words("edit.save") }).click({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await mark(second).click({ timeout: 3000 });
  await page.fill(".edit-dialog textarea", "Words still being typed for the second place");
  await sleep(1700);
  const box = await page.evaluate(() => ({ open: document.querySelector(".edit-dialog").open, value: document.querySelector(".edit-dialog textarea").value, save: document.querySelector(".edit-dialog [type=submit]").disabled }));
  return { ctx, page, errors, first, second, box, mark };
}

await part("edit button: other words opened while a save is still going", async () => {
  const { ctx, page, errors, first, box, mark } = await editTwoPlaces({ conflict: false });
  check(box.open && box.value === "Words still being typed for the second place" && !box.save,
    `edit button, two places: the first save's answer leaves the box open on the second words, Save usable (${JSON.stringify(box)})`);
  check((await mark(first).textContent()).trim() === "Made-up words for the first place", "edit button, two places: the first place shows its saved words");
  check(!errors.length, `edit button, two places: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

await part("edit button: a conflict answered after other words are opened", async () => {
  const { ctx, page, first, second, box } = await editTwoPlaces({ conflict: true });
  check(box.open && box.value === "Words still being typed for the second place",
    `edit button, conflict for the first place: the second words stay in the box (${JSON.stringify(box.value)})`);
  await page.getByRole("button", { name: words("edit.save") }).click({ timeout: 3000 });
  await sleep(1600);
  const rows = Object.fromEntries((await many("SELECT target, value FROM content_edits")).map((r) => [r.target, r.value]));
  check(rows[second] === "Words still being typed for the second place" && rows[first] === "Made-up words someone else saved",
    `edit button, conflict for the first place: Save keeps the second words in the second place and leaves the first alone (${JSON.stringify(rows)})`);
  await ctx.close();
});

/* A value that is not a word, by keyboard: found under More words by its key, named by what it is and its section,
   opened with a list of its options, saved, and checked again on the server. */
await part("edit button: a section switched off, by keyboard, under More words", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/" });
  const target = "page:pg-home:b-home-announce/enabled";
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-editing"), null, { timeout: 3000 });
  const marked = await page.evaluate((t) => !!document.querySelector(`[data-edit-target="${t}"]`), target);
  await page.getByRole("button", { name: words("edit.more") }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("b-home-announce/enabled");
  const item = page.locator(".edit-more-list .edit-pick");
  const found = await item.count();
  const name = await item.first().locator(".edit-pick-where").textContent().catch(() => "");
  await item.first().focus();
  await page.keyboard.press("Enter");
  const control = await page.evaluate(() => { const c = document.getElementById("edit-d-v"); return { tag: c?.tagName, options: [...(c?.options || [])].map((o) => o.textContent), value: c?.value, focused: document.activeElement === c, key: document.querySelector(".edit-key code")?.textContent }; });
  check(!marked && found === 1 && control.key === target && control.tag === "SELECT" && control.options.join("|") === `${words("edit.on")}|${words("edit.off")}` && control.value === "true" && control.focused,
    `typed value: not marked on the page, found under More words by its key, opened as a focused list of On and Off (${JSON.stringify({ marked, found, control })})`);
  check(name.startsWith(`${words("edit.field.enabled")}, `) && !name.includes(target),
    `typed value: More words names it by what it is and its section, not by its key ("${name}")`);
  // Native selects handle arrow keys differently across platforms; type the option's label.
  await page.keyboard.type(words("edit.off"));
  const selected = await page.locator("#edit-d-v").inputValue();
  check(selected === "false", `typed value: keyboard selects Off (${selected})`);
  await page.keyboard.press("Tab");
  const onSave = await page.evaluate(() => document.activeElement?.type === "submit");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".edit-dialog").open, null, { timeout: 3000 }).catch(() => {});
  check(onSave, "typed value: Tab from the list reaches Save");
  const row = await one("SELECT value FROM content_edits WHERE target = $1", [target]);
  check(row?.value === "false", `typed value: Off is saved by keyboard (${JSON.stringify(row)})`);
  check(!errors.length, `typed value: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

/* A photo and a link's address, from the page itself: the photo is outlined, reached by Tab, named by what it is and
   its section, and opened by Enter; the box for a link's words opens the link's address, and lists the section's
   other values by name. */
await part("edit button: a photo and a link's address, from the page", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/" });
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-editing"), null, { timeout: 3000 });
  const photo = await page.evaluate(() => {
    const img = document.querySelector("main [data-block] picture img[data-edit-target]");
    const others = [...document.querySelectorAll("main picture[class*='media-m-']")].map((p) => [...p.classList].find((c) => c.startsWith("media-m-")).slice(6));
    return img && { target: img.getAttribute("data-edit-target"), label: img.getAttribute("aria-label"), tab: img.tabIndex, shown: [...img.closest("picture").classList].find((c) => c.startsWith("media-m-")).slice(6), others };
  });
  check(photo && photo.tab === 0 && photo.label?.startsWith(`${words("edit.field.photo")}, `) && !photo.label.includes(photo.target),
    `photo: outlined on the page, in the Tab order, named by what it is and its section (${JSON.stringify(photo && { target: photo.target, label: photo.label, tab: photo.tab })})`);
  if (photo) {
    const img = page.locator(`img[data-edit-target="${photo.target}"]`);
    await img.focus();
    await page.keyboard.press("Enter");
    const box = await page.evaluate(() => ({ open: document.querySelector(".edit-dialog").open, key: document.querySelector(".edit-key code")?.textContent, value: document.getElementById("edit-d-v")?.value, where: document.querySelector(".edit-where")?.textContent }));
    check(box.open && box.key === photo.target && box.value === photo.shown && box.where === photo.label,
      `photo: Enter opens it, with its library id and the same name (${JSON.stringify(box)})`);
    const next = photo.others.find((id) => id !== photo.shown);
    await page.fill("#edit-d-v", next);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector(".edit-dialog").open, null, { timeout: 3000 }).catch(() => {});
    const row = await one("SELECT value FROM content_edits WHERE target = $1", [photo.target]);
    const back = await page.evaluate(() => document.activeElement?.getAttribute("data-edit-target"));
    check(row?.value === next && back === photo.target, `photo: another library photo is saved by keyboard, and focus comes back to the photo (${JSON.stringify({ row, back })})`);
  }

  const words_ = await page.evaluate(() => {
    for (const n of document.querySelectorAll("main [data-block] a[href^='/'] [data-edit-target], main [data-block] a[href^='/'][data-edit-target]")) {
      if (!n.closest("picture")) return { target: n.getAttribute("data-edit-target"), href: n.closest("a").getAttribute("href") };
    }
    return null;
  });
  await page.locator(`[data-edit-target="${words_?.target}"]`).first().click({ timeout: 3000 });
  const linkButton = page.getByRole("button", { name: words("edit.link") });
  const offered = await linkButton.isVisible();
  const section = await page.evaluate(() => {
    const d = document.querySelector(".edit-section");
    return { hidden: d.hidden, title: d.querySelector("summary").textContent, names: [...d.querySelectorAll(".edit-pick-where")].map((n) => n.textContent) };
  });
  check(offered && !section.hidden && /\(\d+\)$/.test(section.title) && section.names.length && section.names.every((n) => n.includes(", ")),
    `link: the box for a link's words offers its address, and lists the section's other values by name (${JSON.stringify({ words_, offered, title: section.title, first: section.names[0] })})`);
  await linkButton.focus();
  await page.keyboard.press("Enter");
  const link = await page.evaluate(() => ({ key: document.querySelector(".edit-key code")?.textContent, value: document.getElementById("edit-d-v")?.value, focused: document.activeElement?.id === "edit-d-v", where: document.querySelector(".edit-where")?.textContent }));
  check(link.key?.endsWith("/href") && link.value === words_?.href && link.focused && link.where.startsWith(`${words("edit.field.href")}, `),
    `link: Change Where This Link Goes opens the address the link has on the page, focused, named (${JSON.stringify(link)})`);
  await page.keyboard.press("Escape");
  const back = await page.evaluate(() => document.activeElement?.getAttribute("data-edit-target"));
  check(back === words_?.target, `link: closing the box gives focus back to the words it was opened from (${back})`);

  await page.getByRole("button", { name: words("edit.done") }).click({ timeout: 3000 });
  const after = await page.evaluate(() => ({ marked: document.querySelectorAll("[data-edit-target]").length, labelled: document.querySelectorAll("main picture img[aria-label]").length }));
  check(after.marked === 0 && after.labelled === 0, `photo: Done Editing takes the outline, the Tab stop and the name away again (${JSON.stringify(after)})`);
  check(!errors.length, `photo and link: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

/* Earlier versions, by keyboard. The first ask for them is answered after the box has moved on to/* Earlier versions, by keyboard. The first ask for them is answered after the box has moved on to
   other words, before the ask for those: it must not fill the box with the first place's versions. */
await part("edit button: the key, earlier versions and Restore", async () => {
  await freshServer();
  let asks = 0;
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/", slow: (p) => (p === "/api/staff/edit/history" ? [0, 1000, 2500][asks++] ?? 0 : 0) });
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-editing"), null, { timeout: 3000 });
  const [first, second] = await page.evaluate(() => [...new Set([...document.querySelectorAll("main [data-block] [data-edit-target]")].map((n) => n.getAttribute("data-edit-target")))].slice(0, 2));
  const mark = (target) => page.locator(`[data-edit-target="${target}"]`).first();
  const closed = () => page.waitForFunction(() => !document.querySelector(".edit-dialog").open, null, { timeout: 3000 });
  for (const v of ["Made-up first version", "Made-up second version"]) {
    await mark(first).click({ timeout: 3000 });
    await page.fill(".edit-dialog textarea", v);
    await page.getByRole("button", { name: words("edit.save") }).click({ timeout: 3000 });
    await closed();
  }
  await mark(first).click({ timeout: 3000 });
  const key = await page.evaluate(() => document.querySelector(".edit-key code")?.textContent);
  check(key === first, `edit box: shows the words' permanent key (${key})`);
  await page.locator(".edit-history summary").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".edit-versions li"), null, { timeout: 3000 }).catch(() => {});
  const list = await page.evaluate(() => [...document.querySelectorAll(".edit-versions li")].map((li) => {
    const b = li.querySelector("button");
    return { words: li.querySelector(".edit-version-words").textContent, notes: [...li.querySelectorAll(".edit-by")].map((p) => p.textContent), restore: b ? document.getElementById(b.getAttribute("aria-describedby"))?.textContent : null };
  }));
  check(list.length === 1 && list[0].words === "Made-up first version" && list[0].restore === "Made-up first version" && list[0].notes.join().startsWith("Robin Example, "),
    `edit box: Earlier versions lists the words saved before, not the words already in the box, with who and when, and Restore named by its words (${JSON.stringify(list)})`);
  await page.getByRole("button", { name: words("edit.restore") }).focus();
  await page.keyboard.press("Enter");
  await closed().catch(() => {});
  const rows = (await many("SELECT value FROM content_edit_history WHERE target = $1 ORDER BY id", [first])).map((r) => r.value);
  const back = await page.evaluate(() => document.activeElement?.getAttribute("data-edit-target"));
  check((await mark(first).textContent()).trim() === "Made-up first version" && rows.join("|") === "Made-up first version|Made-up second version|Made-up first version" && back === first,
    `edit box: Restore saves the earlier words as the newest version, shows them, and gives focus back to them (${JSON.stringify({ rows, back })})`);

  await mark(first).click({ timeout: 3000 });
  await page.locator(".edit-history summary").click({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await mark(second).click({ timeout: 3000 });
  await page.locator(".edit-history summary").click({ timeout: 3000 });
  await sleep(1600);
  const between = await page.evaluate(() => ({ key: document.querySelector(".edit-key code")?.textContent, items: document.querySelectorAll(".edit-versions li").length, line: document.querySelector(".edit-versions-list")?.textContent }));
  check(between.key === second && between.items === 0 && between.line === words("edit.history.loading"),
    `edit box: an answer about the first words, come after the box moved on, is not shown for the second (${JSON.stringify(between)})`);
  await sleep(2400);
  const after = await page.evaluate(() => document.querySelector(".edit-versions-list")?.textContent);
  check(after === words("edit.history.none"), `edit box: the second words' own answer is shown ("${after}")`);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: words("edit.more") }).click({ timeout: 3000 });
  await page.fill("#edit-find", "text:page.skip");
  const found = await page.locator(".edit-more-list .edit-pick").count();
  await page.locator(".edit-more-list .edit-pick").first().click({ timeout: 3000 });
  const picked = await page.evaluate(() => document.querySelector(".edit-key code")?.textContent);
  check(found === 1 && picked === "text:page.skip", `More words: searching a key finds those words, and the box shows the key (${JSON.stringify({ found, picked })})`);
  await page.keyboard.press("Escape");
  check(!errors.length, `edit box, versions: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

/* ------------------------------------------------------------------ 5. the events between publishes */

/* The week section lists only days that have an event. The clock is held, mid-morning in Madison, on
   the first day of the week drawn for TODAY whose next day is listed too, so "Today" can be seen to
   move a day later whatever day the checks run on. */
const TODAY = process.env.TODAY || chicagoDate();
const weekDays = await (async () => {
  const p = await browser.newPage();
  const home = await (await fetch(BASE + "/")).text();
  const days = await p.evaluate((h) => [...new DOMParser().parseFromString(h, "text/html")
    .querySelectorAll('[data-block="b-home-week"] .week-body > ol.days:first-child > li.day')].map((li) => li.dataset.date), home);
  await p.close();
  return days;
})();
const DAY = weekDays.find((d, i) => weekDays[i + 1] === addDays(d, 1)) || null;
const NEXT = DAY && addDays(DAY, 1);
const at = (day) => new Date(`${day}T15:00:00Z`);
check(DAY && weekDays[0] >= TODAY && weekDays.at(-1) < addDays(TODAY, 7),
  `events: the home page's week is drawn for TODAY (${TODAY}) and has two days in a row to hold the clock on (${JSON.stringify(weekDays)})`);

/* The home page as built, served as a page built from Connect's events, so schedule.js asks
   /api/events/pg-home; each answer is the week section as built, with `data-harness` saying which
   answer it is, sent after `delays[n]` ms. */
async function openEvents(delays) {
  if (!DAY) throw new Error("no two days in a row in the week drawn for TODAY");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(at(DAY));
  await page.route((u) => u.pathname === "/", async (route) => {
    const res = await route.fetch();
    route.fulfill({ response: res, body: (await res.text()).replace('<body data-page="pg-home"', '<body data-refresh="events" data-page="pg-home"') });
  });
  const built = await (await fetch(BASE + "/")).text();
  let n = 0;
  await page.route("**/api/events/pg-home", async (route) => {
    const mine = ++n;
    await sleep(delays[mine - 1] ?? 0);
    const week = await page.evaluate(([html, v]) => new DOMParser().parseFromString(html, "text/html").querySelector('[data-block="b-home-week"]').outerHTML.replace('data-block="b-home-week"', `data-block="b-home-week" data-harness="${v}"`), [built, `v${mine}`]).catch(() => "");
    await route.fulfill({ json: { ok: true, today: DAY, blocks: { "b-home-week": week } }, headers: { "cache-control": "no-store" } }).catch(() => {});
  });
  await page.goto(BASE + "/", { waitUntil: "load" });
  return { ctx, page, errors, asked: () => n };
}

const weekState = (page) => page.evaluate(() => {
  const week = document.querySelector('[data-block="b-home-week"]');
  const a = document.activeElement;
  return { answer: week?.dataset.harness || "published", today: [...document.querySelectorAll(".day.is-today")].map((d) => d.dataset.date),
    focus: a === document.body ? "body" : a?.textContent.trim().slice(0, 40), inWeek: !!week?.contains(a) };
});

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

/* ------------------------------------------------------------------ 6. the resources page */

const resState = (page) => page.evaluate(() => ({
  topic: document.querySelector("[data-topic][aria-pressed='true']")?.dataset.topic ?? null,
  q: document.getElementById("b-res-list-q")?.value,
  count: document.querySelector("[data-res-count]")?.textContent.trim(),
  open: !!document.querySelector("[data-res-dialog]")?.open,
  locked: getComputedStyle(document.documentElement).overflowY === "hidden",
  y: Math.round(scrollY),
}));

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

/* The pages part of the staff page (item 16) against the API in this process, with the build's own snapshot so pages
   can be drawn: add a draft, preview it at both widths, a refused address that keeps what was typed, put it on, move a
   menu entry, and bring back an earlier version, asked twice. */
await part("staff page: pages, preview and earlier versions", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
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

/* The sections of one page (item 15): opened from its card, moved by keyboard and saved, copied, retired with a second
   yes, put back, and a Text section added; the list redrawn from the server after each. */
await part("staff page: the sections of a page", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
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

/* A menu entry taken off and put back (item 15): Take Off lists it under Off the Menu, the list comes back from the
   server after Save, and Put Back by keyboard returns it to the end of its own group with focus on its arrow. */
await part("staff page: a menu entry taken off and put back", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
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

/* Site Settings (item 15): a publisher's part, after the menu. Tab goes name, description, email, Save Settings; a refused
   address keeps all three typed values and says why; a stale tab keeps them too and shows, under each field, the value
   someone else saved since; Save Settings again replaces theirs and clears those lines; site.edit alone does not see it. */
await part("staff page: Site Settings", async () => {
  await freshServer();
  const { useContent } = await import("../netlify/lib/content.mjs");
  const { structureNow } = await import("../netlify/lib/structure.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  const label = { name: words("staff.settings.field.name"), description: words("staff.settings.field.description"), email: words("staff.settings.field.email") };
  let { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
  const form = page.locator("form.staff-settings");
  await form.waitFor({ timeout: 5000 });
  const values = () => form.evaluate((f) => [...f.querySelectorAll("input, textarea")].map((x) => x.value));
  const since = () => form.evaluate((f) => [...f.querySelectorAll(".field")].map((d) => { const l = d.querySelector(".staff-since"); return l && !l.hidden ? l.textContent : ""; }));
  const note = () => form.evaluate((f) => { const n = f.querySelector(".staff-note"); return n && !n.closest("[hidden]") ? n.textContent : ""; });
  const noteIs = (key) => page.waitForFunction((w) => document.querySelector("form.staff-settings .staff-note")?.textContent === w, words(key), { timeout: 5000 }).then(() => true, () => false);
  const save = () => page.getByRole("button", { name: words("staff.settings.save") }).click();

  await page.getByLabel(label.name, { exact: true }).focus();
  const order = [];
  for (let i = 0; i < 4; i++) {
    order.push(await page.evaluate(() => { const a = document.activeElement; return a.labels?.[0]?.textContent || a.textContent; }));
    await page.keyboard.press("Tab");
  }
  check(order.join("|") === [label.name, label.description, label.email, words("staff.settings.save")].join("|"),
    `settings: a publisher sees Site Settings, and Tab goes name, description, email, Save Settings (${JSON.stringify(order)})`);

  const typed = ["Sifting Badgers Test", "A made-up search description typed in the harness.", "not an address"];
  await page.getByLabel(label.name, { exact: true }).fill(typed[0]);
  await page.getByLabel(label.description, { exact: true }).fill(typed[1]);
  await page.getByLabel(label.email, { exact: true }).fill(typed[2]);
  await save();
  const refused = await noteIs("staff.pages.error.email");
  const keptAfter422 = await values();
  check(refused && keptAfter422.join("|") === typed.join("|"), `settings: a refused address says why and keeps all three typed values (${JSON.stringify({ note: await note(), kept: keptAfter422 })})`);

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
  const want = [words("staff.settings.since").replace("{{value}}", "Their Harness Name"), words("staff.settings.since").replace("{{value}}", words("staff.settings.none")), ""];
  check(other.status === 200 && conflict && keptAfter409.join("|") === typed.join("|") && lines.join("|") === want.join("|"),
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
  await page.locator("#staff-pages-h ~ div ul.staff-forms").first().waitFor({ timeout: 5000 });
  const shown = await page.locator("form.staff-settings").count();
  const headings = await page.evaluate(() => [...document.querySelectorAll("h3")].map((h) => h.textContent));
  check(shown === 0 && !headings.includes(words("staff.settings.title")), `settings: someone with site.edit only does not see Site Settings (forms ${shown})`);
  await ctx.close();
});

/* Rooms (item 15): a publisher's part. With a room open, Tab goes through its words, each step's words and photo, the
   note and Save Room; a refused save keeps what was typed and says why; a stale tab keeps it too and shows, under each
   changed field, what someone else saved since; Save Room again replaces theirs; site.edit alone does not see the part. */
await part("staff page: Rooms", async () => {
  await freshServer();
  const { useContent, serverContent } = await import("../netlify/lib/content.mjs");
  const { structureNow } = await import("../netlify/lib/structure.mjs");
  useContent(JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "server.json"), "utf8")));
  let { ctx, page, errors } = await openStaff({ session: ["site.edit", "site.publish"] });
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
  await page.locator("#staff-pages-h ~ div ul.staff-forms").first().waitFor({ timeout: 5000 });
  const shown = await page.locator("#staff-rooms-h, form.staff-room").count();
  check(shown === 0, `rooms: someone with site.edit only does not see Rooms (${shown})`);
  await ctx.close();
});

/* A card's Suggest an Update names its resource in the address; the form's own page is closed until Connect files these,
   so the check reads the same address on the form's review page. */
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
    await page.goto(`${BASE}/forms/resource-update/preview/${query}`, { waitUntil: "networkidle" });
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

await part("FAQ and first visit: keyboard, links and no JavaScript", async () => {
  for (const width of [1280, 390, 320]) for (const javaScriptEnabled of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, javaScriptEnabled, reducedMotion: "reduce" });
    const page = await ctx.newPage(), errors = [], remote = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (/instagram\.com/.test(r.url())) remote.push(r.url()); });
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
    const disclosure = page.locator("#b-pg-how-details");
    await disclosure.locator("summary").focus();
    if (await disclosure.getAttribute("open") !== null) await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    check(await disclosure.getAttribute("open") !== null && await disclosure.locator("ol").isVisible(), `first visit ${width}px JS=${javaScriptEnabled}: expectations open by keyboard`);
    const state = await page.evaluate(() => ({ scrolls: document.documentElement.scrollWidth > innerWidth + 1, reflection: document.querySelectorAll("main input, main textarea").length, steps: document.querySelectorAll(".talk ol li").length, room: document.querySelector(".visit-action")?.getAttribute("href") }));
    check(!state.scrolls && !state.reflection && state.steps === 3 && /^\/directions\//.test(state.room || ""), `first visit ${width}px JS=${javaScriptEnabled}: room action, arrival steps and no personal input or overflow`);
    check(!errors.length && !remote.length, `FAQ/first visit ${width}px JS=${javaScriptEnabled}: no script error or unsolicited reel request`);
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
  const markup = (place, now = at("17:59"), stale = false, empty = false) => String(renderBlock(intro, makeContext({ site, text, today: DAY, now, builtPaths: ["/directions/sac-mhh/", "/directions/sac-caucus/", "/join/email-list/"], data: { eventsState: { stale }, events: { recurring: [], dated: empty ? [] : [{ id: "example-visit", title: "Example Group", program: "peer", date: DAY, start: "17:00", end: "18:00", place }], places: { hub: { name: "Example Hub", href: "/directions/sac-mhh/" }, changed: { name: "Changed Room", href: "/directions/sac-caucus/" } } } } })));
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
  await page.locator("#b-pg-how-details > summary").focus(); await sleep(200);
  check(await page.locator(".visit-action").getAttribute("href") === "/directions/sac-caucus/", "first visit: current-room directions replace the old room once focus leaves");
  await page.locator(".visit-action").focus();
  await page.clock.fastForward(60_000);
  check(await page.locator(".visit-action").isVisible(), "first visit: exact end preserves the focused action until focus leaves");
  await page.locator("#b-pg-how-details > summary").focus(); await sleep(100);
  check(!await page.locator(".visit-action").isVisible(), "first visit: ended directions disappear after focus leaves");
  await page.locator(".visit-event .ended-tag").evaluate((n, words) => n.before(document.createTextNode(words)), words("schedule.signup.none"));
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
      await page.locator(`input[name="topics"][value="${topic}"]`).uncheck();
      await page.locator(`input[name="topics"][value="${other}"]`).check();
      if (JSON.stringify(await chosen()) !== JSON.stringify([other])) choices = false;
    }
    check(choices && !writes.length, `Workshop ${width}px JS=${javaScriptEnabled}: every request action carries its topic and the visitor can change it without submitting`);
    let honest = true;
    for (const state of ["google", "manual"]) {
      const def = structuredClone(formDef); def.state = "closed";
      if (state === "google") def.elsewhere = googleFormUrl(def);
      const renderCtx = makeContext({ site, text: Object.fromEntries(Object.entries(TEXT).map(([k,v]) => [k,v.text])), formTopic: "housing", data: { forms: { "workshop-request": def } } });
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
      const dimensions = await img.evaluate(img => { const b = img.getBoundingClientRect(), frame = img.closest(".photo").getBoundingClientRect(); return { clipped: b.bottom > frame.bottom + 2 || b.right > frame.right + 2 || b.top < frame.top - 2 || b.left < frame.left - 2, shown: b.width > 0 && b.height > 0, ratio: b.width / b.height, natural: img.naturalWidth / img.naturalHeight, alt: img.alt }; });
      if (!dimensions.shown || dimensions.clipped || !dimensions.alt || Math.abs(dimensions.ratio - dimensions.natural) > .02) whole = false;
    }
    const captions = await page.locator("#b-cn-past-work .card-words").allTextContents();
    const visibleCaptions = await Promise.all((await page.locator("#b-cn-past-work .card-words").all()).map(n => n.isVisible()));
    const visibleTitles = await Promise.all((await page.locator("#b-cn-past-work .card-words h3").all()).map(n => n.isVisible()));
    check(whole && visibleCaptions.every(Boolean) && visibleTitles.length === 2 && visibleTitles.every(Boolean) && captions.length === 2 && /Nostalgic Crafts[\s\S]*September 2026/.test(captions[0]) && /Paint a Planter/.test(captions[1]), `Craft ${width}px JS=${javaScriptEnabled}: captioned people photos retain their whole image`);
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
      let card = page.locator('[data-form-card="staff-application"]');
      await card.locator("summary").click();
      await card.locator('[id$="-opensAt"]').fill("2099-01-01T12:00");
      await card.locator('[id$="-deadline"]').fill("2099-01-08T12:00");
      await card.locator('[id$="-title"]').fill("Fictional Staff Application");
      await card.getByRole("button", { name: "Save Form Settings", exact: true }).click();
      await card.getByRole("heading", { name: /Fictional Staff Application/ }).waitFor();
      await page.reload({ waitUntil: "networkidle" }); card = page.locator('[data-form-card="staff-application"]');
      await card.locator("summary").click();
      check(await card.locator('[id$="-opensAt"]').inputValue() === "2099-01-01T12:00" && await card.locator('[id$="-deadline"]').inputValue() === "2099-01-08T12:00", `form settings ${width}px: dates and wording persist without a website build`);
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

await browser.close();
for (const r of results) console.log(`${r.ok ? "  ok  " : "  FAIL"} ${r.what}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `interact: ${failed} of ${results.length} failed` : `interact: all ${results.length} passed`);
finish(failed ? 1 : 0);
