/* Every page: the phone Menu button, and sub-menus that close when another opens, on Escape,
   or on a click elsewhere. Without this file the navigation still works (see layout.mjs). */

const toggle = document.querySelector("[data-menu-toggle]");
const nav = document.getElementById("site-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  });
}

const menus = [...document.querySelectorAll("details[data-nav]")];
for (const d of menus) {
  d.addEventListener("toggle", () => {
    if (d.open) for (const other of menus) if (other !== d) other.open = false;
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const open = menus.find((d) => d.open);
  if (open) { open.open = false; open.querySelector("summary").focus(); }
});
document.addEventListener("click", (e) => {
  for (const d of menus) if (d.open && !d.contains(e.target)) d.open = false;
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
  const el = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (el && el.tagName === "DETAILS") el.open = true;
}
window.addEventListener("hashchange", openTarget);
openTarget();

/* Someone signed in to the staff page on this browser: load the edit button. It asks the server
   who that is, and draws nothing for anyone who may not change words (edit.js). */
if (/(?:^|;\s*)bss_staff_hint=1(?:;|$)/.test(document.cookie)) import("./edit.js");
