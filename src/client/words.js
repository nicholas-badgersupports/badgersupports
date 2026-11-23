/* The word cloud (src/render/blocks/words.mjs): two moves, both asked for by the owner
   (23 Nov 2026) for this section alone — the site's icons still move only when pressed.
 *
 * The entrance: when the section first scrolls into view, its words rise and fade in, one
 * after another, once. The pre-animation state is only ever set from here, and never for a
 * visitor who asks their device for reduced motion (the sheet also keeps it inside a
 * no-preference query), so nobody can be left looking at words the animation forgot to
 * bring back. Without IntersectionObserver the words simply stand.
 *
 * The pop-up: a word carrying an example quote is a button. Pressing it fills the section's
 * dialog with the word and its quote and opens it as a modal, the way the resource list's
 * details and the ribbon cards open theirs: Escape or a press on the scrim closes it, and
 * closing gives the pressed word its focus back. Nothing is sent or stored. */

for (const section of document.querySelectorAll("[data-words]")) {
  const cloud = section.querySelector(".word-cloud");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (cloud && "IntersectionObserver" in window && !reduce.matches) {
    cloud.querySelectorAll("li").forEach((li, i) => li.style.setProperty("--i", i));
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

  const dialog = section.querySelector("[data-words-dialog]");
  const title = section.querySelector("[data-words-dtitle]");
  const quote = section.querySelector("[data-words-dquote]");
  if (!dialog || !title || !quote || typeof dialog.showModal !== "function") continue;
  let opener = null;
  for (const btn of section.querySelectorAll("[data-words-open]")) {
    btn.addEventListener("click", () => {
      opener = btn;
      title.textContent = btn.dataset.wordsTopic || "";
      quote.textContent = btn.dataset.wordsQuote || "";
      if (!dialog.open) dialog.showModal();
    });
  }
  section.querySelector("[data-words-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { opener?.focus({ preventScroll: true }); opener = null; });
}
