/* The word cloud (src/render/blocks/words.mjs): two moves, both asked for by the owner
 * (23 Nov 2026) for this section alone — the site's icons still move only when pressed.
 *
 * The entrance: when the section first scrolls into view, its words rise and fade in, one
 * after another, once. The pre-animation state is only ever set from here, and never for a
 * visitor who asks their device for reduced motion (the sheet also keeps it inside a
 * no-preference query), so nobody can be left looking at words the animation forgot to
 * bring back. Without IntersectionObserver the words simply stand.
 *
 * The quotes, in place: a word carrying an example quote is a tab (the WAI-ARIA tabs
 * pattern), and the panel under the cloud shows the picked word's quote. Picking a word
 * swaps the panel's words at once — nothing opens or closes, no scrim, focus never
 * moves, and the panel's space is reserved in the sheet, so the page does not jump.
 * Picking several words in quick succession just keeps swapping; the short fade restarts
 * with each pick and never blocks the next one. Arrow keys move between words and pick
 * as they go (automatic activation — every quote is already on the page, so each can be
 * shown instantly); Enter and Space pick the focused word. Picking the picked word again
 * leaves its quote standing: a tab set always has one word picked, and the first word
 * stands picked from the start. There is nothing to dismiss, so Escape does nothing here.
 * With reduced motion the swap is instant, with no fade. Nothing is sent or stored. */

for (const section of document.querySelectorAll("[data-words]")) {
  const cloud = section.querySelector(".word-cloud");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (cloud && "IntersectionObserver" in window && !reduce.matches) {
    [...cloud.children].forEach((el, i) => el.style.setProperty("--i", i));
    section.classList.add("words-anim");
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        seen.disconnect();
        section.classList.add("words-in");
      }
    }, { threshold: 0.25 });
    seen.observe(section);
  }

  const tabs = [...section.querySelectorAll("[data-words-tab]")];
  const panel = section.querySelector("[data-words-panel]");
  const ptopic = section.querySelector("[data-words-ptopic]");
  const pquote = section.querySelector("[data-words-pquote]");
  if (!tabs.length || !panel || !ptopic || !pquote) continue;
  let current = Math.max(0, tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"));
  const pick = (i, focus = false) => {
    if (i === current) { if (focus) tabs[i].focus({ preventScroll: true }); return; }
    current = i;
    tabs.forEach((t, j) => {
      const on = j === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    const t = tabs[i];
    ptopic.textContent = t.dataset.wordsTopic || "";
    pquote.textContent = t.dataset.wordsQuote || "";
    panel.setAttribute("aria-labelledby", t.id);
    if (focus) t.focus({ preventScroll: true });
    if (!reduce.matches) {
      panel.classList.remove("words-swap");
      void panel.offsetWidth;
      panel.classList.add("words-swap");
    }
  };
  tabs.forEach((t, i) => t.addEventListener("click", () => pick(i)));
  cloud?.addEventListener("keydown", (e) => {
    const from = tabs.indexOf(document.activeElement);
    if (from < 0) return;
    let i = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") i = (from + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") i = (from - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = tabs.length - 1;
    if (i === null) return;
    e.preventDefault();
    pick(i, true);
  });
}
