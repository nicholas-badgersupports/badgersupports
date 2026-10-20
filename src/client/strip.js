/* Previous / next buttons for a photo strip. The strip is an ordinary scrollable list without
   this file; nothing moves on its own. */

import { t } from "./text.js";

for (const strip of document.querySelectorAll("[data-strip]")) {
  const track = strip.querySelector(".strip-track");
  const prev = strip.querySelector("[data-strip-prev]");
  const next = strip.querySelector("[data-strip-next]");
  const count = strip.querySelector("[data-strip-count]");
  const items = [...track.children];
  const current = () => {
    const left = track.getBoundingClientRect().left;
    let best = 0, dist = Infinity;
    items.forEach((li, i) => { const d = Math.abs(li.getBoundingClientRect().left - left); if (d < dist) { dist = d; best = i; } });
    return best;
  };
  const update = () => {
    const i = current();
    prev.disabled = i === 0;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    count.textContent = t("strip.count", { n: i + 1, total: items.length });
  };
  const go = (dir) => {
    const i = Math.max(0, Math.min(items.length - 1, current() + dir));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: items[i].offsetLeft - track.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  update();
}
