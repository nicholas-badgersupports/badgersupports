/* Behaviour in a real browser, against the running local site: the things a screenshot cannot show.
 *
 *   BASE=http://127.0.0.1:8911 node ops/interact.mjs
 *
 * 1. The phone menu: Escape closes the innermost open layer (a sub-menu, then the menu) and puts
 *    focus back on what opened it; a click or tap outside closes it; widening the window past the
 *    phone layout closes it; without JavaScript the links simply show.
 * 2. A file question while its upload is still going: a cleared, wrong or oversized replacement,
 *    or a second PDF, never leaves Send stuck on "wait for your file", and an older reply never
 *    puts back a file that was replaced. The applications are closed as shipped, so the page is a
 *    preview; the harness serves it as an open form and answers its uploads itself, slowly, with
 *    made-up ids. The real upload route is tested in test/applications.test.mjs.
 * 3. The workshop form, with its API answered by the real router against a fresh database in this
 *    process: a version published while the page is open (a question added, or renamed, with and
 *    without JavaScript), Send pressed twice, a lost reply, no connection, and the form closed
 *    under the page.
 * 4. The staff page in each state: signed in (no Sign In flash), signed out, a sign-in that has
 *    ended, coming back to the page that sent you, an editor who reads nothing, answers refused,
 *    Back after signing out, a dropped connection, a phone, and no JavaScript; and the edit
 *    button when the sign-in ends with words in its box.
 * Fictional files and people only: a few bytes that start as a PDF does, Avery Example and Robin Example.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { chromium } from "playwright";

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

/* ------------------------------------------------------------------ 3. the form changes, or the reply is lost */

/* The workshop page as built, with its API answered by the real router against a fresh PGlite
   database in this process, so a test can publish a new version or close the form under it. */
const { freshServer, ORIGIN } = await import("../test/helpers.mjs");
const { handle } = await import("../netlify/lib/router.mjs");
const { many, q } = await import("../netlify/lib/db.mjs");
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

/* ------------------------------------------------------------------ 4. the staff page, in each state */

/* The staff page as built, its API answered by the real router. A signed-in director is a session
   row written straight into the fresh database, so no Connect is needed: test/staff.test.mjs signs
   in through a fake Connect. Robin Example and their answers are made up. */
const crypto = await import("node:crypto");
const { post, workshopAnswers } = await import("../test/helpers.mjs");
const { useConnect } = await import("../netlify/lib/connect.mjs");
const STAFF = "/staff/";
/* Sign-in switched on, with no Connect behind it: nothing here signs in through Connect or delivers. */
useConnect({ url: "https://connect.example.test", keyId: "harness-key", secret: "h".repeat(40), ssoSecret: "s".repeat(40), statusCheck: false,
  fetch: async () => { throw new TypeError("no Connect in this harness"); } });

async function staffSession(scopes) {
  const id = crypto.randomBytes(32).toString("base64url");
  await q(`INSERT INTO staff_sessions (id_hash, sub, name, scopes, expires_at) VALUES ($1, 'u-harness-1', 'Robin Example', $2::jsonb, now() + interval '8 hours')`,
    [crypto.createHash("sha256").update(id).digest("hex"), JSON.stringify(scopes)]);
  return id;
}

/* `session`: scopes for a signed-in director, or null. `hint`: the cookie a past sign-in leaves.
   `slow`: ms each answer waits. `fail(path, n)`: true to drop that request, as a lost connection. */
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
    if (slow) await sleep(slow);
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
  const help = document.querySelector("[data-staff-help]");
  const app = document.querySelector("[data-staff-app]");
  return {
    signIn: seen(signIn), href: signIn?.getAttribute("href") || "",
    checking: seen(document.querySelector("[data-staff-checking]")),
    intro: seen(intro) ? intro.textContent.trim() : "", introParas: intro ? intro.querySelectorAll("p").length : 0,
    help: help ? { shown: seen(help), open: help.open, summary: help.querySelector("summary")?.textContent.trim() || "" } : null,
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
  check(!s.intro && !(s.help?.shown), `staff signed in: the before-sign-in words and help give way to the tools (intro "${s.intro.slice(0, 40)}", help ${s.help?.shown})`);
  check(s.text.includes(words("staff.forms.how")), "staff signed in, a reader: the forms part says answers are worked through in Connect");
  check(!errors.length, `staff signed in: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("staff page: signed out", async () => {
  const { ctx, page } = await openStaff({ slow: 400 });
  const s = await staffState(page);
  const seen = await page.evaluate(() => window.__seen);
  check(s.signIn && !seen.checking && s.introParas === 1 && s.help && !s.help.open && s.help.summary,
    `staff signed out: the button shows at once, no checking line, one short line before it, help folded (checking seen ${seen.checking}, paragraphs ${s.introParas}, help ${JSON.stringify(s.help)})`);
  const order = await page.evaluate(() => {
    const a = document.querySelector("[data-staff-signin] a"), h = document.querySelector("[data-staff-help]");
    return !!h && !!(a.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check(order, "staff signed out: the sign-in button comes before the folded help");
  await page.keyboard.press("Tab");
  let tabs = 0;
  while (tabs++ < 30 && !(await page.evaluate(() => !!document.activeElement?.closest("[data-staff-signin]")))) await page.keyboard.press("Tab");
  const next = await (async () => { await page.keyboard.press("Tab"); return page.evaluate(() => document.activeElement?.tagName); })();
  check(tabs < 30 && next === "SUMMARY", `staff signed out, keyboard: Tab reaches Sign in, and the help next (after sign-in, ${next})`);
  await ctx.close();
});

await part("staff page: a past sign-in that has ended", async () => {
  const { ctx, page } = await openStaff({ hint: true });
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

await browser.close();
for (const r of results) console.log(`${r.ok ? "  ok  " : "  FAIL"} ${r.what}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `interact: ${failed} of ${results.length} failed` : `interact: all ${results.length} passed`);
process.exit(failed ? 1 : 0);
