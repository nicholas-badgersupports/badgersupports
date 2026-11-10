/* The resource list's topics, search and Additional Details (src/render/blocks/resources.mjs).
   The search is Connect's Find a Resource search: every word typed must appear on the card. When
   nothing matches, it tries words that begin the same way ("psychologist" finds "psychology") and
   says so. The topic, the search and the filters stay in the address (?topic=, ?q=, ?cost=, ?where=,
   ?how=), so a link opens the same list; an old address word for a topic (?topic=health) opens that
   topic, and an unknown one shows everything. Within a filter group any pressed option matches; across
   groups every group must. What is in use shows as chips that each remove themselves, beside Clear All.
   On a phone the filters fold behind More Filters, which counts the ones pressed. */

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
  const fbuttons = [...box.querySelectorAll("[data-fopt]")];
  const GROUPS = [...new Set(fbuttons.map((b) => b.dataset.fgroup))];
  const pressed = Object.fromEntries(GROUPS.map((g) => [g, new Set()]));
  const active = box.querySelector("[data-res-active]"), chips = box.querySelector("[data-res-chips]");
  const ftoggle = box.querySelector("[data-res-ftoggle]"), fpanel = box.querySelector("[data-res-fpanel]"), fcount = box.querySelector("[data-res-fcount]");
  const labelOf = new Map(buttons.filter((b) => b.dataset.category).map((b) => [b.dataset.category, b.textContent]));
  const items = [...list.querySelectorAll("[data-res]")].map((li) => {
    const cats = (li.dataset.cats || "").split(" ").filter(Boolean);
    const hay = words([li.querySelector("h3"), li.querySelector(".res-what"), li.querySelector(".res-fit"), li.querySelector(".res-tags"), li.querySelector(".res-more-body")].map(own).concat(li.dataset.aka || "", cats.map((c) => labelOf.get(c) || "")).join(" "));
    const vals = Object.fromEntries(GROUPS.map((g) => [g, (li.dataset[g] || "").split(" ").filter(Boolean)]));
    return { li, cats, hay, hayWords: hay.split(" "), vals };
  });
  let topic = "";

  const apply = () => {
    const q = words(input.value).split(" ").filter(Boolean);
    const cat = buttons.find((b) => b.dataset.topic === topic)?.dataset.category || "";
    const pool = items.filter((it) => (!cat || it.cats.includes(cat)) && GROUPS.every((g) => !pressed[g].size || it.vals[g].some((v) => pressed[g].has(v))));
    let shown = q.length ? pool.filter((it) => q.every((w) => it.hay.includes(w))) : pool;
    let loose = false;
    if (q.length && !shown.length) {
      shown = pool.filter((it) => q.every((w) => { const s = stem(w); return it.hayWords.some((h) => h.startsWith(s)); }));
      loose = shown.length > 0;
    }
    const on = new Set(shown);
    for (const it of items) it.li.hidden = !on.has(it);
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.topic === topic));
    for (const b of fbuttons) b.setAttribute("aria-pressed", String(pressed[b.dataset.fgroup].has(b.dataset.fopt)));
    const nf = GROUPS.reduce((n, g) => n + pressed[g].size, 0);
    if (fcount) { fcount.hidden = !nf; fcount.textContent = nf ? String(nf) : ""; }
    if (active && chips) {
      const used = [];
      if (topic) used.push({ label: buttons.find((b) => b.dataset.topic === topic)?.textContent || topic, off: () => { topic = ""; } });
      if (input.value.trim()) used.push({ label: `“${input.value.trim()}”`, off: () => { input.value = ""; } });
      for (const b of fbuttons) if (pressed[b.dataset.fgroup].has(b.dataset.fopt)) used.push({ label: b.textContent, off: () => { pressed[b.dataset.fgroup].delete(b.dataset.fopt); } });
      chips.replaceChildren(...used.map((u) => {
        const li = document.createElement("li"), x = document.createElement("button"), sr = document.createElement("span");
        x.type = "button"; x.className = "res-chip"; sr.className = "sr-only"; sr.textContent = `${t("resources.chip.remove")}: `;
        x.append(sr, u.label);
        x.addEventListener("click", () => { u.off(); apply(); (chips.querySelector("button") || input).focus(); });
        li.append(x); return li;
      }));
      active.hidden = !used.length;
    }
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
    for (const g of GROUPS) if (pressed[g].size) url.searchParams.set(g, [...pressed[g]].join(",")); else url.searchParams.delete(g);
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  };

  for (const b of buttons) b.addEventListener("click", () => { topic = b.dataset.topic; apply(); });
  input.addEventListener("input", apply);
  clear?.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
  const clearAll = () => { input.value = ""; topic = ""; for (const g of GROUPS) pressed[g].clear(); apply(); input.focus(); };
  reset?.addEventListener("click", clearAll);
  box.querySelector("[data-res-clearall]")?.addEventListener("click", clearAll);
  for (const b of fbuttons) b.addEventListener("click", () => { const set = pressed[b.dataset.fgroup]; if (set.has(b.dataset.fopt)) set.delete(b.dataset.fopt); else set.add(b.dataset.fopt); apply(); });
  ftoggle?.addEventListener("click", () => { const open = ftoggle.getAttribute("aria-expanded") !== "true"; ftoggle.setAttribute("aria-expanded", String(open)); fpanel?.classList.toggle("is-open", open); });

  const params = new URLSearchParams(location.search);
  const want = (params.get("topic") || "").toLowerCase();
  topic = (want && buttons.find((b) => b.dataset.topic === want || (b.dataset.aliases || "").split(" ").includes(want))?.dataset.topic) || "";
  input.value = params.get("q") || "";
  for (const g of GROUPS) for (const v of (params.get(g) || "").split(",")) if (fbuttons.some((b) => b.dataset.fgroup === g && b.dataset.fopt === v)) pressed[g].add(v);
  if (ftoggle && GROUPS.some((g) => pressed[g].size)) { ftoggle.setAttribute("aria-expanded", "true"); fpanel?.classList.add("is-open"); }
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
