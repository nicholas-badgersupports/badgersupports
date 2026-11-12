/* The Drop In This Week photo carousel (src/render/blocks/schedule.mjs). The track is an
   ordinary scrollable list — touch and sideways scrolling work without this file — and this
   adds the previous / next buttons, the dots and the arrow keys.
 *
 * It advances on its own every few seconds only while nobody is using it: reduced motion
 * turns the advance off entirely, hovering or focusing pauses it, and the first touch,
 * scroll or press stops it for good. The timetable above it is re-rendered live by
 * schedule.js, which replaces the whole section, so a carousel that arrives with that
 * replacement is picked up and set going too. */

import { t } from "./text.js";

const ADVANCE_MS = 7000;

function init(root) {
  if (root.dataset.carouselReady) return;
  root.dataset.carouselReady = "1";
  const track = root.querySelector("[data-carousel-track]");
  const prev = root.querySelector("[data-carousel-prev]");
  const next = root.querySelector("[data-carousel-next]");
  const dots = [...root.querySelectorAll("[data-carousel-dot]")];
  const status = root.querySelector("[data-carousel-status]");
  const items = [...track.children];
  if (items.length < 2) return;
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const current = () => {
    const left = track.getBoundingClientRect().left;
    let best = 0, dist = Infinity;
    items.forEach((li, i) => { const d = Math.abs(li.getBoundingClientRect().left - left); if (d < dist) { dist = d; best = i; } });
    return best;
  };
  const update = () => {
    const i = current();
    dots.forEach((d, j) => { if (j === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
    status.textContent = t("carousel.count", { n: i + 1, total: items.length });
  };
  const go = (i) => {
    const j = (i + items.length) % items.length;
    track.scrollTo({ left: items[j].offsetLeft - track.offsetLeft, behavior: reduce() ? "auto" : "smooth" });
  };
  let timer = null, stopped = false;
  const stop = () => { stopped = true; if (timer) { clearTimeout(timer); timer = null; } };
  const tick = () => {
    timer = null;
    if (stopped) return;
    go(current() + 1);
    timer = setTimeout(tick, ADVANCE_MS);
  };
  const play = () => { if (!stopped && !timer && !reduce() && !document.hidden) timer = setTimeout(tick, ADVANCE_MS); };
  const pause = () => { if (timer) { clearTimeout(timer); timer = null; } };
  prev.addEventListener("click", () => { stop(); go(current() - 1); });
  next.addEventListener("click", () => { stop(); go(current() + 1); });
  dots.forEach((d, j) => d.addEventListener("click", () => { stop(); go(j); }));
  root.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    stop();
    go(current() + (e.key === "ArrowRight" ? 1 : -1));
    e.preventDefault();
  });
  track.addEventListener("pointerdown", stop);
  track.addEventListener("wheel", stop, { passive: true });
  root.addEventListener("pointerenter", pause);
  root.addEventListener("pointerleave", play);
  root.addEventListener("focusin", pause);
  root.addEventListener("focusout", play);
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
  track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  update();
  play();
}

for (const el of document.querySelectorAll("[data-carousel]")) init(el);
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    if (n.matches?.("[data-carousel]")) init(n);
    n.querySelectorAll?.("[data-carousel]").forEach(init);
  }
}).observe(document.body, { childList: true, subtree: true });
