/* Sets the homepage hero's circles drifting, with a Pause button (WCAG 2.2.2). Without this file
   the circles pop in once and rest, and the button stays hidden. Nobody who asks for less motion
   sees the drift or the button. */

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
  };
  button.addEventListener("click", () => { paused = !paused; show(); });
  reduce.addEventListener("change", show);
  show();
}
