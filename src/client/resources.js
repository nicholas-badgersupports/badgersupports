/* The resource list's topics, search and Additional Details (src/render/blocks/resources.mjs).
   The search is Connect's Find a Resource search: every word typed must appear on the card. When
   nothing matches, it tries words that begin the same way ("psychologist" finds "psychology") and
   says so. The topic and the search stay in the address (?topic=, ?q=), so a link opens the same
   list; an old address word for a topic (?topic=health) opens that topic, and an unknown one shows
   everything. */

import { t } from "./text.js";

const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/* A card's own words: its name, what it is, who it suits, its chips and its details, without the
   labels and links every card shares ("Recommended For", "Phone:", Report a Problem). */
const own = (el) => {
  if (!el) return "";
  const c = el.cloneNode(true);
  for (const x of c.querySelectorAll("b, .res-lead, .res-report")) x.remove();
  return c.textContent;
};
/* "psychologist" -> "psycholog": the start a word must share with a card's word on the second try. */
const stem = (w) => w.slice(0, Math.min(w.length, Math.max(5, w.length - 3)));

for (const box of document.querySelectorAll("[data-resources]")) {
  const tools = box.querySelector("[data-res-tools]");
  const input = box.querySelector("[data-res-q]");
  const clear = box.querySelector("[data-res-clear]");
  const reset = box.querySelector("[data-res-reset]");
  const count = box.querySelector("[data-res-count]");
  const relaxed = box.querySelector("[data-res-relaxed]");
  const none = box.querySelector("[data-res-none]");
  const list = box.querySelector(".res-list");
  if (!tools || !input || !list || !count) continue;
  const buttons = [...box.querySelectorAll("[data-topic]")];
  const labelOf = new Map(buttons.filter((b) => b.dataset.category).map((b) => [b.dataset.category, b.textContent]));
  const items = [...list.querySelectorAll("[data-res]")].map((li) => {
    const cats = (li.dataset.cats || "").split(" ").filter(Boolean);
    const hay = words([li.querySelector("h3"), li.querySelector(".res-what"), li.querySelector(".res-fit"), li.querySelector(".res-tags"), li.querySelector(".res-more-body")].map(own).concat(li.dataset.aka || "", cats.map((c) => labelOf.get(c) || "")).join(" "));
    return { li, cats, hay, hayWords: hay.split(" ") };
  });
  let topic = "";

  const apply = () => {
    const q = words(input.value).split(" ").filter(Boolean);
    const cat = buttons.find((b) => b.dataset.topic === topic)?.dataset.category || "";
    const pool = items.filter((it) => !cat || it.cats.includes(cat));
    let shown = q.length ? pool.filter((it) => q.every((w) => it.hay.includes(w))) : pool;
    let loose = false;
    if (q.length && !shown.length) {
      shown = pool.filter((it) => q.every((w) => { const s = stem(w); return it.hayWords.some((h) => h.startsWith(s)); }));
      loose = shown.length > 0;
    }
    const on = new Set(shown);
    for (const it of items) it.li.hidden = !on.has(it);
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.topic === topic));
    if (clear) clear.hidden = !input.value;
    if (relaxed) relaxed.hidden = !loose;
    if (none) none.hidden = shown.length > 0;
    list.hidden = !shown.length;
    count.textContent = shown.length === items.length
      ? (items.length === 1 ? t("resources.count.one") : t("resources.count.all", { n: items.length }))
      : t("resources.count.some", { shown: shown.length, total: items.length });
    const url = new URL(location.href);
    if (topic) url.searchParams.set("topic", topic); else url.searchParams.delete("topic");
    if (input.value.trim()) url.searchParams.set("q", input.value.trim()); else url.searchParams.delete("q");
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  };

  for (const b of buttons) b.addEventListener("click", () => { topic = b.dataset.topic; apply(); });
  input.addEventListener("input", apply);
  clear?.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
  reset?.addEventListener("click", () => { input.value = ""; topic = ""; apply(); input.focus(); });

  const params = new URLSearchParams(location.search);
  const want = (params.get("topic") || "").toLowerCase();
  topic = (want && buttons.find((b) => b.dataset.topic === want || (b.dataset.aliases || "").split(" ").includes(want))?.dataset.topic) || "";
  input.value = params.get("q") || "";
  tools.hidden = false;
  apply();
  /* On a phone the topics are one sliding row: bring a topic the address chose into sight. */
  const row = box.querySelector(".res-topics");
  const chosen = topic && buttons.find((b) => b.dataset.topic === topic);
  if (row && chosen && row.scrollWidth > row.clientWidth) {
    row.scrollLeft += chosen.getBoundingClientRect().left - row.getBoundingClientRect().left - parseFloat(getComputedStyle(row).paddingLeft || "0");
  }

  /* Additional Details opens in place without JavaScript. With it, the details open in one
     dialog for the whole list: the card's name, what it is, who it suits, the details and its
     button. The page stays where it was and the focus goes back to the card. */
  const dialog = box.querySelector("[data-res-dialog]");
  const head = box.querySelector("[data-res-dtitle]");
  const body = box.querySelector("[data-res-dbody]");
  if (!dialog || !head || !body || typeof dialog.showModal !== "function") continue;
  let opener = null;
  let y = 0;
  for (const it of items) {
    const summary = it.li.querySelector(".res-more > summary");
    if (!summary) continue;
    summary.addEventListener("click", (e) => {
      e.preventDefault();
      opener = summary;
      head.textContent = it.li.querySelector("h3")?.textContent || "";
      const parts = [".res-what", ".res-fit", ".res-more-body"].map((s) => it.li.querySelector(s)).filter(Boolean).map((el) => el.cloneNode(true));
      const go = it.li.querySelector(".res-go");
      if (go) { const foot = document.createElement("p"); foot.className = "res-dialog-foot"; foot.append(go.cloneNode(true)); parts.push(foot); }
      body.replaceChildren(...parts);
      y = window.scrollY;
      document.documentElement.classList.add("res-pinned");
      dialog.showModal();
    });
  }
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("res-pinned");
    window.scrollTo(0, y);
    opener?.focus();
  });
  box.querySelector("[data-res-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
}
