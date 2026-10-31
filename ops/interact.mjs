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
 *    while a save is still going; its key, earlier versions and Restore.
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
import { chicagoDate } from "../src/render/context.mjs";
import { addDays } from "../src/render/events.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:8899";
const TEXT = JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text;
const words = (key) => TEXT[key]?.text ?? `(no text ${key})`;
const results = [];
const check = (ok, what) => results.push({ ok: !!ok, what });
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/* A part that throws is a failure of that part, and the rest still run. */
async function part(name, fn) {
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
const { useConnect } = await import("../netlify/lib/connect.mjs");
const STAFF = "/staff/";
/* Sign-in switched on, with no Connect behind it: nothing here signs in through Connect or delivers. The one call it
   answers is Connect's shared sign-in quotes (Connect GOOGLE-SIGNIN), one made-up line, so the quote under the button
   is pressed and timed like the rest. */
const HARNESS_QUOTE = "A made-up line for the harness.";
useConnect({ url: "https://connect.example.test", keyId: "harness-key", secret: "h".repeat(40), ssoSecret: "s".repeat(40), statusCheck: false,
  fetch: async (href, init) => {
    if (JSON.parse(init.body).action === "publicSigninQuotes") return new Response(JSON.stringify({ ok: true, quotes: [HARNESS_QUOTE] }), { headers: { "content-type": "application/json" } });
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
async function openStaff({ session = null, hint = !!session, slow = 0, fail, path = STAFF, js = true, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, javaScriptEnabled: js });
  const cookies = [];
  if (session) cookies.push({ name: "bss_staff", value: await staffSession(session), url: BASE });
  if (hint) cookies.push({ name: "bss_staff_hint", value: "1", url: BASE });
  if (cookies.length) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
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
    const set = res.headers.getSetCookie();
    if (set.length) out.headers["set-cookie"] = set.join("\n");
    await route.fulfill(out).catch(() => {});
  });
  await page.goto(BASE + path, { waitUntil: js ? "networkidle" : "load" });
  return { ctx, page, errors, calls };
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

await part("staff page: editor only", async () => {
  await freshServer();
  const { ctx, page } = await openStaff({ session: ["site.edit"] });
  const s = await staffState(page);
  check(s.who && !s.headings.includes(words("staff.forms.title")) && s.headings.includes(words("staff.edit.title")) && !/answers/i.test(s.text) && !s.buttons.includes(words("staff.edit.download")),
    `staff editor only: words tools only, nothing about reading answers or publishing (headings ${JSON.stringify(s.headings)})`);
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
    return { chip: li?.querySelector(".staff-chip")?.textContent, buttons: [...(li?.querySelectorAll("button") || [])].map((b) => b.textContent),
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
  await page.keyboard.press("Escape");
  const shut = await resState(page);
  const back = await summary.evaluate((s) => s === document.activeElement);
  check(opened.open && !shut.open && back && shut.y === before.y && !shut.locked,
    `resources: a card's details open by keyboard, Escape closes them, focus and scroll come back to the card, and the page scrolls again (${JSON.stringify({ opened: opened.open, shut: shut.open, focusBack: back, y: [before.y, shut.y], locked: shut.locked })})`);
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
  const kept = await page.evaluate(() => [...document.querySelectorAll(".staff-part input")].slice(0, 2).map((i) => i.value));
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

await browser.close();
for (const r of results) console.log(`${r.ok ? "  ok  " : "  FAIL"} ${r.what}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `interact: ${failed} of ${results.length} failed` : `interact: all ${results.length} passed`);
process.exit(failed ? 1 : 0);
