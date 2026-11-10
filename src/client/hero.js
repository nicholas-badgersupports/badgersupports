/* Sets the homepage hero's circles drifting, with a round pause control among the white dots
   (WCAG 2.2.2). Its name follows what pressing it does: Pause while they move, Play while they rest;
   the same words show as its tooltip. Without this file the circles pop in once and rest, and the
   button stays hidden. Nobody who asks for less motion sees the drift or the button. */

import { t } from "./text.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)");

for (const net of document.querySelectorAll("[data-network]")) {
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
