/* Every page: the phone Menu button, and sub-menus that close when another opens. Escape closes
   the innermost thing open — a sub-menu first, then the phone menu — and puts focus back on what
   opened it. A click or tap outside closes both; so does widening the window past the phone layout,
   and coming Back to a page the browser kept. Nothing traps focus: Tab leaves the menu as it would
   any list of links. Without this file the navigation still works (see layout.mjs). */

/* Email links copy their address and offer the mail program as a choice, never as a surprise. */
import "./email.js";

const toggle = document.querySelector("[data-menu-toggle]");
/* The initials stay visible until a portrait has loaded; a failed photo never blanks a profile. */
const teamPortraits = [...document.querySelectorAll("img[data-team-portrait]")];
let portraitObserver = null;
function activatePortrait(image, eager = true) {
  const source = image.getAttribute("data-src");
  if (!source) return;
  portraitObserver?.unobserve(image);
  image.removeAttribute("data-src");
  /* The width choices go on before the address, so the browser picks from them, not the fallback. */
  const srcset = image.getAttribute("data-srcset");
  if (srcset) { image.srcset = srcset; image.removeAttribute("data-srcset"); }
  if (eager) image.loading = "eager";
  image.src = source;
  if (image.complete) revealPortrait(image);
}
function revealPortrait(image) {
  image.closest("picture")?.classList.toggle("is-loaded", image.naturalWidth > 0);
}
for (const image of teamPortraits) {
  image.addEventListener("load", () => revealPortrait(image));
  image.addEventListener("error", () => revealPortrait(image));
  if (image.complete) revealPortrait(image);
}
/* Portraits start loading a little before they scroll into view, so a row is ready as it
   arrives rather than blank at first sight; rows further down still wait, so speculative rows
   never compete with the ones being read. */
const deferredPortraits = teamPortraits.filter(image => image.hasAttribute("data-src"));
if (deferredPortraits.length) {
  if (typeof IntersectionObserver === "function") {
    portraitObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) activatePortrait(entry.target);
    }, { rootMargin: "600px 0px" });
    for (const image of deferredPortraits) portraitObserver.observe(image);
  } else for (const image of deferredPortraits) activatePortrait(image, false);
  document.addEventListener("focusin", event => {
    const image = event.target.closest?.(".person-link")?.querySelector("img[data-team-portrait][data-src]");
    if (image) activatePortrait(image);
  });
}
const nav = document.getElementById("site-nav");
const phone = matchMedia("(max-width: 860px)"); // the phone layout in layout.css
const menuOpen = () => !!toggle && toggle.getAttribute("aria-expanded") === "true";
function setMenu(open, refocus) {
  if (!toggle || !nav) return;
  toggle.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("is-open", open);
  if (!open && refocus) toggle.focus();
}
if (toggle && nav) {
  toggle.addEventListener("click", () => setMenu(!menuOpen()));
  phone.addEventListener("change", () => { if (!phone.matches) setMenu(false); });
  window.addEventListener("pageshow", (e) => { if (e.persisted) setMenu(false); });
}

const menus = [...document.querySelectorAll("details[data-nav]")];
for (const d of menus) {
  d.addEventListener("toggle", () => {
    if (d.open) for (const other of menus) if (other !== d) other.open = false;
  });
}
document.addEventListener("keydown", (e) => {
  // a dialog, or a control that already used the key, has its own Escape
  if (e.key !== "Escape" || e.defaultPrevented || e.target.closest?.("dialog")) return;
  const open = menus.find((d) => d.open);
  if (open) { open.open = false; open.querySelector("summary").focus(); }
  else if (menuOpen()) setMenu(false, true);
});
document.addEventListener("click", (e) => {
  for (const d of menus) if (d.open && !d.contains(e.target)) d.open = false;
  if (menuOpen() && !nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
});

/* The Safety Exit: one press of the pill, or Escape three times in quick succession, leaves at
   once — no confirmation, nothing asked first. The destination opens in a new tab, and this
   tab is replaced by it too, its entry in the history overwritten, so Back does not bring the
   site back; the script also tries to close this tab outright, which a browser only allows
   for a tab the page itself opened, so the replace is what guarantees the leaving. The pill
   is a plain link and still leaves without this file. Leaving is never measured: nothing
   here sends anything of its own, to anyone. */
const safetyExit = document.querySelector("[data-safety-exit]");
function leaveQuickly() {
  const url = safetyExit ? safetyExit.href : "https://www.google.com/";
  window.open(url, "_blank");
  window.location.replace(url);
  window.close();
}
if (safetyExit) {
  safetyExit.addEventListener("click", (e) => { e.preventDefault(); leaveQuickly(); });
}
let escapes = [];
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.repeat) return;
  const now = performance.now();
  escapes = escapes.filter((t) => now - t < 1000);
  escapes.push(now);
  if (escapes.length >= 3) { escapes = []; leaveQuickly(); }
});

/* Icons: every kind in MOVING has a move (motion.css) and keeps it — no icon loses its move.
   When a move may start is the owner's rule, restated 12 Nov 2026 (21:07): never on scroll
   into view, never on hover, never on focus — only on a click, and a click plays only the
   single icon closest to the click point (the listener below). The class comes off when
   every part has finished, so the next click can play it again. The plus is not in MOVING:
   it has no move — its turn into a minus is a transition, in motion.css. */
const MOVING = new Set(["arrow", "back", "down", "out", "pin", "mail", "calendar", "chat", "scissors", "bulb", "house", "badge", "question", "star", "check", "play", "pause", "jar", "pencil", "ribbon", "search", "account", "paw", "instagram", "tiktok", "linkedin", "win", "sliders", "close", "hand"]);
const turns = new WeakMap();
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
function playIcon(ic) {
  if (reduce.matches || !ic || !MOVING.has(ic.getAttribute("data-i"))) return;
  const turn = (turns.get(ic) || 0) + 1;
  turns.set(ic, turn);
  ic.classList.remove("i-press");
  void ic.getBoundingClientRect();
  ic.classList.add("i-press");
  const done = () => { if (turns.get(ic) === turn) ic.classList.remove("i-press"); };
  const moves = typeof ic.getAnimations === "function" ? ic.getAnimations({ subtree: true }) : [];
  if (moves.length) Promise.all(moves.map((a) => a.finished.catch(() => {}))).then(done);
  else setTimeout(done, 1200);
}
/* A click — anywhere — plays the one move whose icon sits closest to the click point, and
   no other: not the other icons of the button pressed, not every icon on the page. A click
   on an icon itself is distance zero, so the icon clicked is always the one that plays. */
document.addEventListener("click", (e) => {
  if (reduce.matches) return;
  let best = null, bestD = Infinity;
  for (const ic of document.querySelectorAll("[data-i]")) {
    if (!MOVING.has(ic.getAttribute("data-i")) || !ic.getClientRects().length) continue;
    const r = ic.getBoundingClientRect();
    const dx = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0;
    const dy = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = ic; }
  }
  if (best) playIcon(best);
}, { passive: true });

/* A link to a folded answer (#q-…) opens it. */
function openTarget() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const el = id ? document.getElementById(id) : null;
  if (el && el.tagName === "DETAILS") el.open = true;
}
window.addEventListener("hashchange", openTarget);
openTarget();

/* Someone signed in to the staff page on this browser: load the edit button. It is not published
   with the site's pages (source-exposure audit, F-1): the API serves it only to a signed-in staff
   session, so a browser whose session has ended simply gets nothing. It asks the server who that
   is, and draws nothing for anyone who may not change words (edit.js). */
if (/(?:^|;\s*)bss_staff_hint=1(?:;|$)/.test(document.cookie)) import("/api/staff/client/edit.js").catch(() => {});

/* The development notice (layout.mjs draws it; its words are text keys): Badger SPILL's
   announcement pop-up is the model — it opens a moment after the page arrives, and shows once
   on each arrival or reload, not while clicking through the site: this tab remembers in
   sessionStorage, and a reload clears the memory, so it shows again. Not inside a frame (the
   staff page's previews frame pages), and never a modal: it is shown without showModal, so
   the Safety Exit pill stays pressable while it is up, and Escape pressed three times still
   leaves. Nothing about the visitor is sent anywhere. */
const devNotice = document.querySelector("[data-dev-notice]");
if (devNotice && window.self === window.top && typeof devNotice.show === "function") {
  const KEY = "bss-dev-notice";
  let seen = false;
  try {
    if (performance.getEntriesByType("navigation")[0]?.type === "reload") sessionStorage.removeItem(KEY);
    seen = sessionStorage.getItem(KEY) === "1";
  } catch { /* storage off: it may show again */ }
  for (const b of devNotice.querySelectorAll("[data-dev-close]")) b.addEventListener("click", () => devNotice.close());
  devNotice.addEventListener("keydown", (e) => { if (e.key === "Escape") devNotice.close(); });
  if (!seen) setTimeout(() => {
    try { sessionStorage.setItem(KEY, "1"); } catch { /* storage off: it may show again */ }
    if (!devNotice.open) { devNotice.show(); devNotice.querySelector("[data-dev-close]")?.focus(); }
  }, 700);
}

/* The Director Sign-In pop-up (layout.mjs): pressing the footer's link opens it and starts the
   move to Connect on its own — the pop-up is the signing-in state, so there is no second press.
   A director Connect already knows is brought straight back to the staff page; anyone else
   lands on Connect's sign-in page. Closing the pop-up — its ×, Escape, or a press on the scrim
   behind it — calls the move off, and the link inside it goes to the same place at once if the
   automatic move stalls. Without a working dialog the link is left alone: it goes to the staff
   page, whose own button signs in as it always has. Coming Back to a page the browser kept
   closes a pop-up left open, so nobody returns to a move already made. */
const signinLink = document.querySelector("[data-signin-open]");
const signinPop = document.querySelector("[data-signin-pop]");
if (signinLink && signinPop && typeof signinPop.showModal === "function") {
  const START = "/api/auth/start?return=/staff/";
  /* The retry link points at the staff page in the markup; with the script running it goes
     straight to the sign-in start, like the staff page's own button. */
  const retry = signinPop.querySelector(".signin-pop-retry a");
  if (retry) retry.href = START;
  let timer = null;
  const callOff = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
  signinLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (signinPop.open) return;
    signinPop.showModal();
    timer = setTimeout(() => { timer = null; location.assign(START); }, 800);
  });
  signinPop.addEventListener("close", callOff);
  signinPop.querySelector("[data-signin-close]")?.addEventListener("click", () => signinPop.close());
  signinPop.addEventListener("click", (e) => { if (e.target === signinPop) signinPop.close(); });
  window.addEventListener("pageshow", (e) => { if (e.persisted && signinPop.open) signinPop.close(); });
}

/* The Alumni pop-up (layout.mjs draws it; its words are the Email List page's): pressing an
   Alumni link — in the navigation, the footer, or a page — opens the invite over the page
   the visitor is on, once per visit: this tab remembers in sessionStorage, so pressing
   Alumni again, or going back and forth, goes straight to the page. Closing the invite —
   its Close button or Escape — completes the press and lands on the Alumni page; pressing
   it while already there just closes. Its own button goes straight to the email list form
   and is left to navigate on its own. It is shown without showModal (the development notice
   is the model): nothing traps focus, and the Safety Exit pill stays pressable while it is
   up. Not inside a frame (the staff page's previews frame pages). Without a working dialog
   the links are left alone: they go to the Alumni page as they always have. */
const alumniPop = document.querySelector("[data-alumni-pop]");
if (alumniPop && window.self === window.top && typeof alumniPop.show === "function") {
  const KEY = "bss-alumni-pop";
  const seen = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
  const mark = () => { try { sessionStorage.setItem(KEY, "1"); } catch { /* storage off: it may show again */ } };
  const isAlumni = (url) => url.pathname.replace(/\/$/, "") === "/join/alumni";
  let dest = null, viaCta = false;
  for (const a of document.querySelectorAll("a[href]")) {
    if (a.target && a.target !== "_self") continue;
    let url;
    try { url = new URL(a.href); } catch { continue; }
    if (url.origin !== location.origin || !isAlumni(url)) continue;
    a.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || seen() || alumniPop.open) return;
      e.preventDefault();
      mark();
      dest = a.href;
      alumniPop.show();
      alumniPop.querySelector("[data-alumni-close]")?.focus();
    });
  }
  alumniPop.querySelector("[data-alumni-cta]")?.addEventListener("click", () => { viaCta = true; });
  alumniPop.querySelector("[data-alumni-close]")?.addEventListener("click", () => alumniPop.close());
  alumniPop.addEventListener("keydown", (e) => { if (e.key === "Escape") alumniPop.close(); });
  alumniPop.addEventListener("close", () => {
    const go = dest;
    dest = null;
    const here = location.pathname.replace(/\/$/, "");
    if (!viaCta && go && new URL(go).pathname.replace(/\/$/, "") !== here) location.assign(go);
    viaCta = false;
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted && alumniPop.open) { viaCta = true; alumniPop.close(); } });
}
