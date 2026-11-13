/* Discover Classes by Interest (src/render/blocks/courses.mjs): the interest buttons narrow
   the course list in the visitor's own browser. Nothing chosen here is stored or sent
   anywhere.

   The page arrives with the first courses of each group. The whole catalogue rides in a
   data file beside the page (courses-data.json, named by the section's data-courses-src),
   fetched the first time the visitor opens, scrolls to or filters the list — the site
   search's way of working (src/client/search.js): while it is on its way the count line
   says so, and if it does not arrive the count line says that instead and offers Try
   Again, with the first courses still standing. A button pressed before the list arrives
   is remembered and applied when it lands. */

import { t } from "./text.js";

for (const box of document.querySelectorAll("[data-courses]")) {
  const tools = box.querySelector("[data-cls-tools]");
  const count = box.querySelector("[data-cls-count]");
  const again = box.querySelector("[data-cls-again]");
  const buttons = [...box.querySelectorAll("[data-interest]")];
  if (!tools || !count) continue;
  let cards = [...box.querySelectorAll("[data-cls]")];
  let groups = [...box.querySelectorAll("[data-cls-group]")];
  let interest = "";
  /* Whether the whole catalogue is on the page yet, and the fetch under way, if any. */
  let full = false;
  let asking = null;

  const apply = () => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.interest === interest));
    if (!full) return;
    let shown = 0;
    for (const card of cards) {
      const on = !interest || (card.dataset.interests || "").split(" ").includes(interest);
      card.hidden = !on;
      if (on) shown++;
    }
    for (const g of groups) g.hidden = ![...g.querySelectorAll("[data-cls]")].some((c) => !c.hidden);
    count.textContent = shown === cards.length
      ? (cards.length === 1 ? t("classes.count.one") : t("classes.count.all", { n: cards.length }))
      : t("classes.count.some", { shown, total: cards.length });
  };

  const load = async () => {
    if (again) again.hidden = true;
    count.textContent = t("classes.loading");
    try {
      const r = await fetch(box.dataset.coursesSrc, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      const got = await r.json();
      const built = [];
      for (const g of got.groups || []) {
        const div = document.createElement("div");
        div.className = "cls-group";
        div.dataset.clsGroup = g.id;
        const h = document.createElement("h3");
        h.textContent = g.heading;
        const ul = document.createElement("ul");
        ul.className = "cls-list";
        /* The cards are the build's renderer's own markup, every word from text.json;
           parsed in a document of its own, where nothing loads or runs until placed. */
        const doc = new DOMParser().parseFromString((g.cards || []).join(""), "text/html");
        ul.append(...doc.body.children);
        div.append(h, ul);
        built.push(div);
      }
      if (!built.length) throw new Error("empty");
      const wrap = groups[0]?.parentElement || box.querySelector(".wrap");
      const scope = box.querySelector(".cls-scope");
      for (const g of groups) g.remove();
      for (const div of built) wrap.insertBefore(div, scope);
      cards = [...box.querySelectorAll("[data-cls]")];
      groups = built;
      full = true;
      apply();
    } catch {
      count.textContent = t("classes.failed");
      if (again) again.hidden = false;
    } finally { asking = null; }
  };
  const poke = () => { if (!full && !asking) asking = load(); };

  for (const b of buttons) b.addEventListener("click", () => { interest = b.dataset.interest; apply(); poke(); });
  box.querySelector("[data-cls-retry]")?.addEventListener("click", poke);
  box.addEventListener("pointerdown", poke);
  box.addEventListener("focusin", poke);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); poke(); } }, { rootMargin: "600px" });
    io.observe(box);
  }
  tools.hidden = false;
  apply();
}
