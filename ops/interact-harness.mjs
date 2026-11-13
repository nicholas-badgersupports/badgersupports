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
 *    puts back a file that was replaced. The application is open as shipped; the harness answers
 *    its uploads itself, slowly, with made-up ids. The real upload route is tested in test/applications.test.mjs. On the same
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
 * 7. The search page (item 39, slice 39-A): the index loads and lists every page; a word that
 *    only one room's page carries finds that room alone; a word on no page shows the no-matches
 *    block; an address with ?q= opens with its results; without JavaScript the box stays hidden
 *    and every page is a plain link; a failed index says so, keeps the list, and Try Again loads it.
 * 8. Email links (src/client/email.js): a press copies the address and opens the popup, and the
 *    mailto: is not followed; Copy again copies again; Open in mail app is left to the browser;
 *    Escape and a press outside close the popup and focus returns to the link; when the browser
 *    will not copy, the popup still opens and its note does not claim a copy. Left alone it
 *    dismisses itself at six seconds — hover, focus inside and a hidden tab pause that clock,
 *    a press inside stops it — and scrolling it or its link out of sight closes it at once.
 * 9. The Safety Exit: the pill is in the header's top-right on every page at five widths, at
 *    least 44px tall and covering nothing; it is still in reach after scrolling; one press (or
 *    three quick Escapes, never two) leaves for Google, in a new tab and in this tab both,
 *    with no analytics request fired; without JavaScript it is still there, a plain working link.
 * 10. The mood check-in on the home page: each feeling is its emoji over its word, in its own colour;
 *    a tap bursts confetti and the answer shows one of the feeling's reply lines and the day's
 *    counts; a visitor who asked to reduce motion gets the answer with no burst. And its editor:
 *    a publisher sees the Feeling Check-In part with the set as it stands, a set that breaks the
 *    rules is refused and says why, and a saved set is what the structure then holds.
 * Fictional files and people only: a few bytes that start as a PDF does, Avery Example and Robin Example.
 */

/* THE SPLIT, 13 November 2026 (proposal C-40; audit item P1). This file is the shared
   harness of what was ops/interact.mjs: the browser, the check/part machinery, and every
   helper the parts use, in the order the single file defined them. The parts themselves
   live in the twelve ops/interact-*.mjs group files, one per part-group of the original
   numbering, each ending with its own tally. The single file had never completed a run —
   it stalled idle three times, and printed nothing until the end — so no run of it was
   ever evidence; a group that stalls now leaves the other groups' reports standing, and
   every result prints as its part records it. check.mjs --browser runs the groups in
   order, as ops/suites.mjs lists them. */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { chromium } from "playwright";
import { finish } from "./finish.mjs";
import { chicagoDate } from "../src/render/context.mjs";
import { addDays, chicagoOffset } from "../src/render/events.mjs";
// The groups use fs and path directly, as the parts did inside the single file.
export { fs, path };
export { addDays, chicagoDate, chicagoOffset };

export const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
export const BASE = process.env.BASE || "http://127.0.0.1:8899";
export const TEXT = JSON.parse(fs.readFileSync(path.join(ROOT, "content/text.json"), "utf8")).text;
export const words = (key) => TEXT[key]?.text ?? `(no text ${key})`;
export const results = [];
/* A result prints as it is recorded. In the single file nothing printed until every part
   had run, so a stall showed nothing and left nothing; each group now reports as it goes. */
export const check = (ok, what) => {
  const r = { ok: !!ok, what };
  results.push(r);
  console.log(`${r.ok ? "  ok  " : "  FAIL"} ${r.what}`);
};
export const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/* A part that throws is a failure of that part, and the rest still run. */
export async function part(name, fn) {
  if (process.env.INTERACT_PART && !name.includes(process.env.INTERACT_PART)) return;
  try { await fn(); } catch (e) { check(false, `${name}: ${String(e.message).split("\n")[0]}`); }
}

export const browser = await chromium.launch();

/* ------------------------------------------------------------------ 1. the phone menu */

export const menuState = (page) => page.evaluate(() => {
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
export async function openMenu(page, tap) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await (tap ? page.tap("[data-menu-toggle]") : page.click("[data-menu-toggle]"));
}





/* ------------------------------------------------------------------ 2. an upload still going */

export const PAGE = "/forms/staff-application/";
export const PDF = Buffer.from("%PDF-1.4\n% a made-up file for the harness\n%%EOF\n");
export const fakeId = (n) => `${"F".repeat(31)}${n}`;

/* The open form, its uploads answered after `delays[n]` ms (a preview attribute, were one served, is taken off). */
export async function openForm(delays) {
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
  if (!live) throw new Error("the staff application page did not serve an open form");
  return { ctx, page, errors };
}

export const resume = (page) => page.evaluate(() => {
  const box = document.querySelector('[data-upload="resume"]');
  return { id: box.querySelector("[data-file-id]").value, status: box.querySelector("[data-upload-status]").textContent };
});

/* Send pressed: either the wait message, or the form's own answer about the missing questions. */
export async function pressSend(page) {
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

export const replacements = [
  ["cleared", []],
  ["not a PDF", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("made-up notes") }],
  ["over 3 MB", { name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024)]) }],
];



/* A question's card takes its section's whole width (a 40rem cap once left 640px fields in a
   715px column at 1280), a control fills its card's inside, a control for a short value keeps
   its compact width, and secondary help stays folded until asked for, by keyboard as by
   pointer, with or without JavaScript. A stepped form is measured step by step, walking its
   own step buttons, and the measures of every step are gathered together. */
export const COMPACT = 'input[type="number"], input[type="tel"], input[type="date"], input[type="datetime-local"], .other-text, .rank select';
export const widths = (page) => page.evaluate((compact) => {
  const shown = (el) => el.getClientRects().length > 0;
  const out = { form: 0, fields: 0, short: [], narrow: [], compacts: [], sideways: 0 };
  const seen = new Set();
  const measure = () => {
    const form = document.querySelector("form[data-form]");
    out.form = Math.round(form.getBoundingClientRect().width);
    for (const f of document.querySelectorAll(".bss-form .field")) {
      if (!shown(f)) continue;
      const key = f.dataset.q || f.querySelector("[id]")?.id || "";
      if (seen.has(key)) continue;
      seen.add(key);
      out.fields++;
      const sec = f.closest("[data-section]") || form;
      if (Math.abs(f.getBoundingClientRect().width - sec.getBoundingClientRect().width) > 1) out.short.push(key);
      const cs = getComputedStyle(f);
      const inside = f.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      for (const c of f.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), textarea, select")) {
        if (!shown(c)) continue;
        if (c.matches(compact)) out.compacts.push(c.getBoundingClientRect().width < inside - 1);
        else if (Math.abs(c.getBoundingClientRect().width - inside) > 1) out.narrow.push(c.id);
      }
    }
    out.sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  };
  measure();
  for (const b of document.querySelectorAll("[data-step-item]:not([hidden]) [data-step-link]")) { b.click(); measure(); }
  return out;
}, COMPACT);




/* ------------------------------------------------------------------ 3. the form changes, or the reply is lost */

/* The workshop page as built, with its API answered by the real router against a fresh PGlite
   database in this process, so a test can publish a new version or close the form under it. */
export const { freshServer, ORIGIN } = await import("../test/helpers.mjs");
export const { handle } = await import("../netlify/lib/router.mjs");
export const { many, one, q } = await import("../netlify/lib/db.mjs");
export const { serverContent } = await import("../netlify/lib/content.mjs");
export const WORKSHOP = "/forms/workshop-request/";
export let ipN = 10;
// A group cannot increment an imported binding, so the counter is handed out by function.
export const takeIpN = () => ipN++;

export async function publishWorkshop(change) {
  const v2 = structuredClone(serverContent().forms["workshop-request"]);
  v2.version = 2;
  change(v2);
  await q("INSERT INTO form_versions (form_key, version, definition, published_by) VALUES ('workshop-request', 2, $1::jsonb, 'harness')", [JSON.stringify(v2)]);
}
export const questionsOf = (def, id) => def.sections.find((s) => s.id === id).questions;

/* `onSubmit(route, run)` decides what happens to each Send; `run()` puts it through the router. */
export async function openWorkshop({ js = true, onSubmit } = {}) {
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

/* A long form is walked a section at a time with JavaScript on: bring a question's step up
   before filling it. A no-op when the question is already on screen, and without JavaScript,
   when the form is one scroll. */
export async function showField(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const sec = el?.closest("[data-section]");
    if (!sec || sec.getClientRects().length) return;
    document.querySelector(`[data-step-link="${sec.dataset.section}"]`)?.click();
  }, selector).catch(() => {});
}

export async function fillWorkshop(page) {
  for (const [id, v] of [["name", "Avery Example"], ["email", "avery@example.org"], ["affiliation", "Example Hall Council"], ["attendees", "25"],
    ["option_1", "2026-11-02T18:00"], ["option_2", "2026-11-03T18:00"], ["option_3", "2026-11-04T18:00"],
    ["location", "Example Hall lounge"], ["group_notes", "First workshop for the group."], ["access_needs", "None known."]]) {
    await showField(page, `#f-${id}`);
    await page.fill(`#f-${id}`, v);
  }
  await showField(page, 'input[name="topics"][value="stress_self_care"]');
  await page.check('input[name="topics"][value="stress_self_care"]');
  await showField(page, 'input[name="projection"][value="yes"]');
  await page.check('input[name="projection"][value="yes"]');
}

export const formState = (page) => page.evaluate(() => {
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
export const send = async (page) => { await page.click("[data-submit]"); await page.waitForTimeout(300); return formState(page); };









/* ------------------------------------------------------------------ 4. the staff page, in each state */

/* The staff page as built, its API answered by the real router. A signed-in director is a session
   row written straight into the fresh database, so no Connect is needed: test/staff.test.mjs signs
   in through a fake Connect. Robin Example and their answers are made up. */
export const crypto = await import("node:crypto");
export const { post, workshopAnswers } = await import("../test/helpers.mjs");
export const { useConnect, canonicalJson, hmacB64u, CLIENT_ID } = await import("../netlify/lib/connect.mjs");
export const { netlifyLocation } = await import("./dev-server.mjs");
export const STAFF = "/staff/";
/* Sign-in switched on, with no Connect behind it: nothing here delivers. Two calls are answered: Connect's shared sign-in
   quotes (Connect GOOGLE-SIGNIN), one made-up line, so the quote under the button is pressed and timed like the rest; and
   the trade of a one-time code this harness made itself (harnessCodes), for a note signed with the harness's made-up key,
   so one sign-in goes through the real callback. */
export const HARNESS_QUOTE = "A made-up line for the harness.";
export const HARNESS_SSO = "s".repeat(40);
export const harnessCodes = new Map();   // a code the harness made → the nonce of the sign-in start it wrote
export const reply = (body) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
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

export async function staffSession(scopes) {
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
export async function openStaff({ session = null, hint = !!session, auth = null, slow = 0, fail, path = STAFF, js = true, viewport = { width: 1280, height: 900 }, init = null } = {}) {
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

export const staffState = (page) => page.evaluate(() => {
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

/* The tools open on the Overview; a part presses the section menu's item for the view it works in. */
export const goStaff = async (page, key) => {
  await page.locator(".staff-nav").getByRole("link", { name: words(key), exact: true }).click();
};






/* Signing in comes back with nothing after the page's address: Netlify puts the callback's code and state on the
   router's redirect, and the page takes those two back off for a browser that has just signed in, and only those two. */









/* The box closed (Escape) and other words opened in it while the first save is still going. The
   first answer used to close the box on the second words, or, when it was a conflict, write the
   first place's words into it and point Save at the first place. */
export async function editTwoPlaces({ conflict }) {
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



/* A value that is not a word, by keyboard: found under More words by its key, named by what it is and its section,
   opened with a list of its options, saved, and checked again on the server. */

/* A photo and a link's address, from the page itself: the photo is outlined, reached by Tab, named by what it is and
   its section, and opened by Enter; the box for a link's words opens the link's address, and lists the section's
   other values by name. */

/* Earlier versions, by keyboard. The first ask for them is answered after the box has moved on to/* Earlier versions, by keyboard. The first ask for them is answered after the box has moved on to
   other words, before the ask for those: it must not fill the box with the first place's versions. */

/* ------------------------------------------------------------------ 5. the events between publishes */

/* The week section lists only days that have an event. The clock is held, mid-morning in Madison, on
   the first day of the week drawn for TODAY whose next day is listed too, so "Today" can be seen to
   move a day later whatever day the checks run on. */
export const TODAY = process.env.TODAY || chicagoDate();
export const weekDays = await (async () => {
  const p = await browser.newPage();
  const home = await (await fetch(BASE + "/")).text();
  const days = await p.evaluate((h) => [...new DOMParser().parseFromString(h, "text/html")
    .querySelectorAll('[data-block="b-home-week"] .week-body > ol.days:first-child > li.day')].map((li) => li.dataset.date), home);
  await p.close();
  return days;
})();
export const DAY = weekDays.find((d, i) => weekDays[i + 1] === addDays(d, 1)) || null;
export const NEXT = DAY && addDays(DAY, 1);
export const at = (day) => new Date(`${day}T15:00:00Z`);
/* This check stood at the head of the events section, before its parts. In the split it is
   the events group's to run first (ops/interact-events.mjs), not every group's. */
export function checkEventDays() {
  check(DAY && weekDays[0] >= TODAY && weekDays.at(-1) < addDays(TODAY, 7),
    `events: the home page's week is drawn for TODAY (${TODAY}) and has two days in a row to hold the clock on (${JSON.stringify(weekDays)})`);
}

/* The home page as built, served as a page built from Connect's events, so schedule.js asks
   /api/events/pg-home; each answer is the week section as built, with `data-harness` saying which
   answer it is, sent after `delays[n]` ms. */
export async function openEvents(delays) {
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

export const weekState = (page) => page.evaluate(() => {
  const week = document.querySelector('[data-block="b-home-week"]');
  const a = document.activeElement;
  return { answer: week?.dataset.harness || "published", today: [...document.querySelectorAll(".day.is-today")].map((d) => d.dataset.date),
    focus: a === document.body ? "body" : a?.textContent.trim().slice(0, 40), inWeek: !!week?.contains(a) };
});



/* ------------------------------------------------------------------ 6. the resources page */

export const resState = (page) => page.evaluate(() => ({
  topic: document.querySelector("[data-topic][aria-pressed='true']")?.dataset.topic ?? null,
  q: document.getElementById("b-res-list-q")?.value,
  count: document.querySelector("[data-res-count]")?.textContent.trim(),
  open: !!document.querySelector("[data-res-dialog]")?.open,
  locked: getComputedStyle(document.documentElement).overflowY === "hidden",
  y: Math.round(scrollY),
}));



/* The pages part of the staff page (item 16) against the API in this process, with the build's own snapshot so pages
   can be drawn: add a draft, preview it at both widths, a refused address that keeps what was typed, put it on, move a
   menu entry, and bring back an earlier version, asked twice. */

/* The sections of one page (item 15): opened from its card, moved by keyboard and saved, copied, retired with a second
   yes, put back, and a Text section added; the list redrawn from the server after each. */

/* A menu entry taken off and put back (item 15): Take Off lists it under Off the Menu, the list comes back from the
   server after Save, and Put Back by keyboard returns it to the end of its own group with focus on its arrow. */

/* Site Settings (item 15): a publisher's part, after the menu. Tab goes name, description, email, Safety Exit
   destination, photo count, gallery layout, Save Settings (the Safety Exit and Craft Nights fields joined the
   form with their own branches); a refused address keeps every typed value and says why; a stale tab keeps them
   too and shows, under each field, the value someone else saved since; Save Settings again replaces theirs and
   clears those lines; site.edit alone does not see it. */

/* Rooms (item 15): a publisher's part. With a room open, Tab goes through its words, each step's words and photo, the
   note and Save Room; a refused save keeps what was typed and says why; a stale tab keeps it too and shows, under each
   changed field, what someone else saved since; Save Room again replaces theirs; site.edit alone does not see the part. */

/* A card's Suggest an Update names its resource in the address; the form's own page is closed until Connect files these,
   so the check reads the same address on the form's review page. */







/* A recent night with no photo shares the recap grid with photo tiles. Its words must wrap
   between words, never inside one: a word split across lines means its column is too narrow. */

/* A room ticket's stub word sits inside the stub at every width; past its edge it runs off the card. */

/* A heading or button that splits a word ("VOLUNTEERIN / G") has a column too narrow for its type.
   Letters only: a break after a hyphen ("Student- / led") is ordinary wrapping. Hidden text
   (a closed disclosure, sr-only) is not drawn, so it is not judged; nor is an address. */









/* The arrival jumps are the redesign's section navigation (render/secnav.mjs):
   the same native in-page anchors, under the component's markup. */




/* ------------------------------------------------------------------ 7. site search */

export const searchState = (page) => page.evaluate(() => ({
  tools: !document.querySelector("[data-srch-tools]")?.hidden,
  count: document.querySelector("[data-srch-count]")?.textContent.trim(),
  cards: [...document.querySelectorAll("[data-srch-list] .srch-card h3 a")].map((a) => a.getAttribute("href")),
  listShown: !document.querySelector("[data-srch-list]")?.hidden,
  none: !document.querySelector("[data-srch-none]")?.hidden,
  all: !document.querySelector("[data-srch-all]")?.hidden,
  allLinks: document.querySelectorAll("[data-srch-all] a").length,
  again: !document.querySelector("[data-srch-again]")?.hidden,
}));


/* ------------------------------------------------------------------ 8. email links copy first */

export const emailState = (page) => page.evaluate(() => {
  const pop = document.querySelector("dialog.email-pop");
  const link = document.querySelector('.site-footer a[href^="mailto:"]');
  const box = pop && pop.open ? pop.getBoundingClientRect() : null;
  return {
    open: !!pop?.open,
    note: pop?.querySelector(".email-pop-note span:last-of-type")?.textContent ?? null,
    addr: pop?.querySelector(".email-pop-addr")?.textContent ?? null,
    openHref: pop?.querySelector(".email-pop-actions a")?.getAttribute("href") ?? null,
    focusBack: document.activeElement === link,
    box: box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null,
    scrollW: document.documentElement.scrollWidth,
    url: location.href,
  };
});


/* ------------------------------------------------------------------ 9. the safety exit */


/* ------------------------------------------------------------------ 10. the mood check-in */



/* The end of a group file: close the browser, print the group's own tally in the shape
   ops/suites.mjs judges ("<tag>: all N passed" / "<tag>: F of N failed"), and hand back the
   exit code the file ends through finish() with. */
export async function closeAndTally(tag) {
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `${tag}: ${failed} of ${results.length} failed` : `${tag}: all ${results.length} passed`);
  return failed ? 1 : 0;
}
