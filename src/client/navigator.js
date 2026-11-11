/* The Academic Support Navigator's walk (src/render/blocks/navigator.mjs): one question at a
   time, Back and Start Over, and the focus carried to each new heading so a keyboard or screen
   reader user lands where the walk went. The answers are choices the visitor pressed in this
   page and nothing else: nothing is stored, and no request carries them — the panels are all
   already here, so showing one and hiding the rest is the whole of it. Without this script
   every question and every result stays on the page, in order, and each choice is an anchor. */

for (const box of document.querySelectorAll("[data-navigator]")) {
  const panels = [...box.querySelectorAll("[data-nav-panel]")];
  if (panels.length < 2) continue;
  const start = panels.find((p) => p.dataset.navStep) || panels[0];
  const stack = [];
  let current = start;
  const show = (panel) => {
    current = panel;
    for (const p of panels) p.hidden = p !== panel;
    panel.querySelector("[data-nav-heading]")?.focus();
  };
  for (const a of box.querySelectorAll("[data-nav-go]")) {
    a.addEventListener("click", (e) => {
      const target = document.getElementById(a.dataset.navGo);
      if (!target || !panels.includes(target)) return;
      e.preventDefault();
      stack.push(current);
      show(target);
    });
  }
  for (const p of panels) {
    p.querySelector("[data-nav-back]")?.addEventListener("click", () => { const prev = stack.pop(); if (prev) show(prev); });
    p.querySelector("[data-nav-restart]")?.addEventListener("click", () => { stack.length = 0; show(start); });
  }
  for (const c of box.querySelectorAll("[data-nav-controls]")) c.hidden = false;
  show(start);
}
