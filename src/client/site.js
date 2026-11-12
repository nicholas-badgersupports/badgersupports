/* Every page: the phone Menu button, and sub-menus that close when another opens. Escape closes
   the innermost thing open — a sub-menu first, then the phone menu — and puts focus back on what
   opened it. A click or tap outside closes both; so does widening the window past the phone layout,
   and coming Back to a page the browser kept. Nothing traps focus: Tab leaves the menu as it would
   any list of links. Without this file the navigation still works (see layout.mjs). */

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
/* Visible portraits load together without speculative rows competing for their bandwidth. */
const deferredPortraits = teamPortraits.filter(image => image.hasAttribute("data-src"));
if (deferredPortraits.length) {
  if (typeof IntersectionObserver === "function") {
    portraitObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) activatePortrait(entry.target);
    }, { rootMargin: "0px" });
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

/* Icons move once, each its own way (motion.css), when their link or button is pressed, or when
   a mouse comes onto it — as Badger SPILL's icons do. A second press starts the move again. The
   class comes off when every part has finished, so the next press can play it. */
const CONTROL = "a, button, summary, label";
const turns = new WeakMap();
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
function play(el) {
  if (reduce.matches || !el) return;
  for (const ic of el.querySelectorAll("[data-i]")) {
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
}
document.addEventListener("click", (e) => play(e.target.closest?.(CONTROL)), { passive: true });
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest?.(CONTROL);
  if (el && !el.contains(e.relatedTarget)) play(el);
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

/* Someone signed in to the staff page on this browser: load the edit button. It asks the server
   who that is, and draws nothing for anyone who may not change words (edit.js). */
if (/(?:^|;\s*)bss_staff_hint=1(?:;|$)/.test(document.cookie)) import("./edit.js");
