/* Discover Classes by Interest (src/render/blocks/courses.mjs): the interest tiles are
   the front door — one interest open at a time, its courses beneath it — and inside the
   open interest, the availability buttons and the search box narrow the list: a course
   shows when it fits both. The search's rule is the one this page has always kept: every
   word typed must be a word of the course's subject, number or name, or the start of one
   ("fung" finds "Fungi"). Nothing chosen or typed here is stored or sent anywhere.
 *
 * The page arrives with the first interest's first courses. The whole catalogue rides in
 * a data file beside the page (courses-data.json, named by the section's
 * data-courses-src), one group of cards per interest, fetched the first time the visitor
 * opens, scrolls to or filters the list — the site search's way of working
 * (src/client/search.js): while it is on its way the count line says so, and if it does
 * not arrive the count line says that instead and offers Try Again, with the first
 * courses still standing. A tile pressed before the list arrives is remembered and
 * opened when it lands. */

import { t } from "./text.js";

/* A search's words, and a card's: lower case, a space where a letter meets a digit (so
   "botany333" reads as "botany 333"), and nothing kept but letters and digits. */
const words = (s) => String(s || "").toLowerCase().replace(/([a-z])([0-9])/g, "$1 $2").replace(/([0-9])([a-z])/g, "$1 $2").replace(/[^a-z0-9]+/g, " ").trim();
/* Every word typed must be a card's word, or — at three letters or more — the start of
   one, so a short word never matches inside a longer one ("30" does not find "300"). */
const matches = (cardWords, q) => q.every((w) => cardWords.some((h) => h === w || (w.length >= 3 && h.startsWith(w))));

for (const box of document.querySelectorAll("[data-courses]")) {
  const tools = box.querySelector("[data-cls-tools]");
  const input = box.querySelector("[data-cls-q]");
  const clear = box.querySelector("[data-cls-clear]");
  const none = box.querySelector("[data-cls-none]");
  const reset = box.querySelector("[data-cls-reset]");
  const count = box.querySelector("[data-cls-count]");
  const again = box.querySelector("[data-cls-again]");
  const tiles = [...box.querySelectorAll("[data-interest]")];
  const availBtns = [...box.querySelectorAll("[data-avail]")];
  const groupEl = box.querySelector("[data-cls-group]");
  const groupHead = box.querySelector("[data-cls-grouphead]");
  const listEl = groupEl?.querySelector(".cls-list");
  if (!tools || !input || !count || !groupEl || !listEl) continue;
  let interest = tiles.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.interest || tiles[0]?.dataset.interest || "";
  let avail = "all";
  /* The cards of the open interest, and — once the data file lands — every interest's
     cards, parsed and held ready (a course under two interests is held twice, once in
     each, as the file carries it). */
  let cards = [...listEl.querySelectorAll("[data-cls]")];
  let pool = null;
  /* Each card's searchable words, from the subject, number and name the renderer wrote
     on it (data-search); rebuilt whenever the card set is. */
  let index = new Map();
  const reindex = () => { index = new Map(cards.map((c) => [c, words(c.dataset.search).split(" ").filter(Boolean)])); };
  reindex();
  let full = false;
  let asking = null;

  const countWords = (n) => (n === 1 ? t("classes.count.one") : t("classes.count.all", { n }));
  function apply() {
    for (const b of tiles) b.setAttribute("aria-pressed", String(b.dataset.interest === interest));
    for (const b of availBtns) b.setAttribute("aria-pressed", String(b.dataset.avail === avail));
    if (clear) clear.hidden = !input.value;
    if (!full) return;
    const q = words(input.value).split(" ").filter(Boolean);
    let shown = 0;
    for (const card of cards) {
      const open = card.hasAttribute("data-open");
      const on = (avail === "all" || (avail === "open" ? open : !open))
        && (!q.length || matches(index.get(card) || [], q));
      card.hidden = !on;
      if (on) shown++;
    }
    if (none) none.hidden = shown > 0;
    count.textContent = shown === cards.length
      ? countWords(cards.length)
      : t("classes.count.some", { shown, total: cards.length });
  }
  function openInterest(id) {
    interest = id;
    if (!pool) { apply(); return; }
    const held = pool.get(id) || [];
    listEl.replaceChildren(...held);
    cards = held;
    groupEl.dataset.clsGroup = id;
    const tile = tiles.find((b) => b.dataset.interest === id);
    const label = tile?.querySelector(".cls-tile-label")?.textContent || id;
    if (groupHead) groupHead.textContent = `${label} — ${countWords(held.length)}`;
    reindex();
    apply();
  }

  const load = async () => {
    if (again) again.hidden = true;
    count.textContent = t("classes.loading");
    try {
      const r = await fetch(box.dataset.coursesSrc, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      const got = await r.json();
      const built = new Map();
      for (const g of got.groups || []) {
        /* The cards are the build's renderer's own markup, every word from text.json;
           parsed in a document of its own, where nothing loads or runs until placed. */
        const doc = new DOMParser().parseFromString((g.cards || []).join(""), "text/html");
        built.set(g.id, [...doc.body.children]);
      }
      if (!built.size) throw new Error("empty");
      pool = built;
      full = true;
      openInterest(interest);
    } catch {
      count.textContent = t("classes.failed");
      if (again) again.hidden = false;
    } finally { asking = null; }
  };
  const poke = () => { if (!full && !asking) asking = load(); };

  for (const b of tiles) b.addEventListener("click", () => { openInterest(b.dataset.interest); poke(); });
  for (const b of availBtns) b.addEventListener("click", () => { avail = b.dataset.avail; apply(); poke(); });
  input.addEventListener("input", () => { apply(); poke(); });
  clear?.addEventListener("click", () => { input.value = ""; apply(); poke(); input.focus(); });
  reset?.addEventListener("click", () => { input.value = ""; avail = "all"; apply(); poke(); input.focus(); });
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
