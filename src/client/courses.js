/* Discover Classes by Interest (src/render/blocks/courses.mjs): the interest buttons narrow
   the course list in the visitor's own browser. Nothing chosen here is stored or sent
   anywhere — the courses are all already on the page, and a button press only hides the
   ones outside the interest and says how many are left. Without this script every course
   shows, in its group. */

import { t } from "./text.js";

for (const box of document.querySelectorAll("[data-courses]")) {
  const tools = box.querySelector("[data-cls-tools]");
  const count = box.querySelector("[data-cls-count]");
  const cards = [...box.querySelectorAll("[data-cls]")];
  const groups = [...box.querySelectorAll("[data-cls-group]")];
  const buttons = [...box.querySelectorAll("[data-interest]")];
  if (!tools || !count || !cards.length) continue;
  let interest = "";
  const apply = () => {
    let shown = 0;
    for (const card of cards) {
      const on = !interest || (card.dataset.interests || "").split(" ").includes(interest);
      card.hidden = !on;
      if (on) shown++;
    }
    for (const g of groups) g.hidden = ![...g.querySelectorAll("[data-cls]")].some((c) => !c.hidden);
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.interest === interest));
    count.textContent = shown === cards.length
      ? (cards.length === 1 ? t("classes.count.one") : t("classes.count.all", { n: cards.length }))
      : t("classes.count.some", { shown, total: cards.length });
  };
  for (const b of buttons) b.addEventListener("click", () => { interest = b.dataset.interest; apply(); });
  tools.hidden = false;
  apply();
}
