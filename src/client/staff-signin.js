/* The staff page before sign-in, and nothing beyond it. This is the public half of the split the
 * source-exposure audit prescribed (F-1, 15 November 2026): the page ships with only this small
 * shell, and the console (src/client/staff.js, with form-setup.js and edit.js) is held back by the
 * build (.build/staff-client/, ops/build.mjs) and served by the API only to a signed-in staff
 * session (/api/staff/client/, netlify/lib/router.mjs). The console's words are not in this page
 * either: they arrive with the /api/staff/me answer (staffText) and are laid into the words island
 * before the console is loaded, so a stranger can read neither the console's code nor its labels.
 * The states, each with one thing to do next:
 *   - never signed in on this browser: the Sign in button at once; the page asks only whether
 *     sign-in is switched on here (/api/auth/status);
 *   - signed in before (the hint cookie): "Checking your sign-in" stands where the button is, from
 *     the first frame (src/render/layout.mjs), until /api/staff/me answers;
 *   - that sign-in has ended: says so above the button, and forgets the hint;
 *   - sign-in is not switched on: says so, with no button;
 *   - the check failed: says so, with Try again.
 * Sent here with ?return=/some/page/, Sign in comes back to that page. A check that is run again
 * wins over one still on its way, and leaving the page takes any tools off it, so a page a browser
 * keeps for Back holds no answers; coming back to it checks again.
 * Nothing here is counted, and nothing is kept in the browser.
 */

import { t } from "./text.js";

const app = document.querySelector("[data-staff-app]");
const signIn = document.querySelector("[data-staff-signin]");
const signInLink = signIn?.querySelector("a");
const checking = document.querySelector("[data-staff-checking]");
const intro = document.querySelector("[data-staff-intro]");
const quote = document.querySelector("[data-staff-quote]");
const heading = app?.closest(".staff")?.querySelector("h1");
const HINT = /(?:^|;\s*)bss_staff_hint=1(?:;|$)/;

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k != null && k !== false));
  return n;
};
const offline = () => ({ status: 0, body: {} });
const isBusy = (button) => button.getAttribute("aria-busy") === "true";

async function call(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method, credentials: "same-origin",
    headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/* Where Sign in comes back to: ?return= when it names a page on this site, held to the server's
   own rule (netlify/lib/staff.mjs, returnPath), else this page. The console is told it too, for
   its Return link. */
const back = (() => {
  const v = new URLSearchParams(location.search).get("return") || "";
  return v.length <= 200 && /^\/(?!\/)[A-Za-z0-9\-._~/]*$/.test(v) ? v : "/staff/";
})();
if (signInLink && back !== "/staff/") signInLink.href = `/api/auth/start?return=${encodeURIComponent(back)}`;

const status = el("p", { className: "sr-only" });
status.setAttribute("role", "status");
app?.after(status);
function say(words) {
  status.textContent = "";
  // A fresh line each time, so a screen reader reads the same words twice in a row.
  requestAnimationFrame(() => { status.textContent = words; });
}

/* The hint that tells every page to load the edit button; a session that ended elsewhere leaves it
   behind, and this page is where it is noticed. */
const forgetHint = () => { document.cookie = `bss_staff_hint=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; };

/* ---------- the states before the tools ---------- */

/* Under the button: why there are no tools, and Try again when a check failed. Made once, so focus
   stays on Try again while it checks again. */
const state = el("div", { className: "staff-state", hidden: true });
const stateNote = el("p", { className: "staff-note" });
const tryAgain = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.tryAgain") });
state.append(stateNote, tryAgain);
signIn?.after(state);
tryAgain.addEventListener("click", () => { if (!isBusy(tryAgain)) start(); });

function note(words, retry = false) {
  stateNote.textContent = words || "";
  tryAgain.hidden = !retry;
  state.hidden = !words;
}

/* "checking", "signIn" or "none": what stands where the button is. The words before it show again. */
function before(mode) {
  checking.hidden = mode !== "checking";
  signIn.hidden = mode !== "signIn";
  intro.hidden = false;
  if (quote) quote.hidden = !quote.textContent || mode !== "signIn";
}

/* The console takes the page over: the sign-in states go away and stay away. */
function enter() {
  before("none");
  note("");
  intro.hidden = true;
  if (quote) quote.hidden = true;
}

/* ---------- the handover ---------- */

/* Signed in: the console's words are laid into the island its text module will read, and the
   console itself is fetched from the API, which serves it only with this session. A load that
   fails — the session ended between the two asks — is the check's own failure state. */
async function mountConsole(me, fresh) {
  const island = document.getElementById("bss-text");
  if (island && me.staffText) {
    let held = {};
    try { held = JSON.parse(island.textContent || "{}"); } catch { held = {}; }
    island.textContent = JSON.stringify({ ...held, ...me.staffText });
  }
  let console_ = null;
  try { console_ = await import("/api/staff/client/staff.js"); } catch { console_ = null; }
  if (!fresh()) return;
  if (!console_) { before("signIn"); note(t("staff.loadError"), true); say(t("staff.loadError")); return; }
  console_.mount(me, { back, enter });
}

/* One check of who is here. `fresh()` turns false once a newer check has started, or the page was
   left, and its answer is then dropped. */
async function check(hinted, fresh) {
  if (!hinted) {
    const s = await call("/api/auth/status").catch(offline);
    if (!fresh()) return;
    if (s.status !== 200) { note(t("staff.loadError"), true); say(t("staff.loadError")); return; }
    if (!s.body.signedIn) {
      if (s.body.configured === false) { before("none"); note(t("staff.notConfigured")); }
      else before("signIn");
      return;
    }
    before("checking"); // signed in, though the hint has gone
  }
  const r = await call("/api/staff/me").catch(offline);
  if (!fresh()) return;
  if (r.status === 200) { await mountConsole(r.body, fresh); return; }
  if (r.status === 401) {
    forgetHint();
    if (r.body.configured === false) { before("none"); note(t("staff.notConfigured")); return; }
    before("signIn");
    note(t("staff.ended"));
    say(t("staff.ended"));
    return;
  }
  before(hinted ? "none" : "signIn");
  note(t("staff.loadError"), true);
  say(t("staff.loadError"));
}

/* Connect GOOGLE-SIGNIN: one quote from Connect's one shared list, picked once per page load and kept while the page
   stands. None when the list is empty, switched off in Connect, or does not load; it never holds up signing in. It
   stands only beside the Sign in button. */
async function loadQuote() {
  if (!quote) return;
  const r = await call("/api/signin-quotes").catch(offline);
  const list = Array.isArray(r.body.quotes) ? r.body.quotes.filter((x) => typeof x === "string" && x) : [];
  if (!list.length) return;
  quote.textContent = list[Math.floor(Math.random() * list.length)];
  quote.hidden = signIn.hidden;
}

let runs = 0;
async function start() {
  const run = ++runs;
  // Another module can clear the cookie before this page checks; keep the initial page-load hint.
  const hinted = HINT.test(document.cookie) || document.documentElement.classList.contains("staff-hint");
  const had = state.contains(document.activeElement);
  document.documentElement.classList.remove("staff-hint");
  // Pressed Try again: it stays where it is, busy, while the page checks again.
  if (had) { stateNote.textContent = t("staff.checking"); tryAgain.setAttribute("aria-busy", "true"); }
  else note("");
  before(had ? "none" : hinted ? "checking" : "signIn");
  await check(hinted, () => run === runs);
  if (run !== runs) return;
  tryAgain.removeAttribute("aria-busy");
  // Try again has gone: focus goes to what replaced it, the button or the page's heading.
  if (had && (state.hidden || tryAgain.hidden)) (signIn.hidden ? heading : signInLink)?.focus();
}

if (app) {
  /* Leaving: the tools come off before a browser keeps the page for Back, so it holds no answers,
     and any reply still on its way is dropped. Coming back to a kept page checks again. */
  addEventListener("pagehide", () => {
    runs++;
    app.replaceChildren();
    app.hidden = true;
    note("");
    before(HINT.test(document.cookie) ? "checking" : "signIn");
  });
  addEventListener("pageshow", (e) => { if (e.persisted) start(); });
  start();
  loadQuote();
}
