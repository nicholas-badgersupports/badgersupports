/* Sets the homepage hero's circles drifting, with a round pause control among the white dots
   (WCAG 2.2.2). Its name follows what pressing it does: Pause while they move, Play while they rest;
   the same words show as its tooltip. Without this file the circles pop in once and rest, and the
   button stays hidden. Nobody who asks for less motion sees the drift or the button.

   The middle circle is a button too (owner, 12 Nov 2026): it rests on its word, turns over once to
   the smiley face the first time it comes into view, and pressing it turns it back and forth. The
   turn itself is the flip in blocks.css; this file only chooses which side shows, and keeps the
   button's name and pressed state with the side showing. Nobody who asks for less motion gets the
   first turn — the word stays until they press it, and then it swaps at once, because base.css
   switches transitions off for them. */

import { t } from "./text.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)");

for (const net of document.querySelectorAll("[data-network]")) {
  const you = net.querySelector("[data-you]");
  if (you) {
    const youLabel = you.querySelector("[data-you-label]");
    let face = false, touched = false;
    const showYou = () => {
      you.classList.toggle("is-face", face);
      you.setAttribute("aria-pressed", String(face));
      if (youLabel) youLabel.textContent = t(face ? "hero.youWord" : "hero.youFace");
    };
    you.addEventListener("click", () => { touched = true; face = !face; showYou(); });
    showYou();
    /* Hello once, a beat after the circle's own pop-in settles (blocks.css: you-in ends at
       1.45s), and only if nobody has pressed it first. */
    if ("IntersectionObserver" in window) {
      const seen = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          seen.disconnect();
          if (reduce.matches) return;
          setTimeout(() => { if (!touched && !reduce.matches) { face = true; showYou(); } }, 1600);
        }
      }, { threshold: 0.6 });
      seen.observe(you);
    }
  }
  const button = net.querySelector("[data-still]");
  if (!button) continue;
  const label = button.querySelector("span");
  let paused = false;
  const show = () => {
    net.classList.toggle("is-moving", !paused && !reduce.matches);
    button.hidden = reduce.matches;
    label.textContent = t(paused ? "hero.play" : "hero.pause");
    button.title = label.textContent;
  };
  button.addEventListener("click", () => { paused = !paused; show(); });
  reduce.addEventListener("change", show);
  show();
}
