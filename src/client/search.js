/* Site-wide search (src/render/blocks/sitesearch.mjs). The visitor's words are matched against
   the build's index of the site's public pages (/search-index.json), here in the browser, so
   nothing typed is sent anywhere. Every word typed must appear in a page's title or its words;
   when nothing matches, it tries words that begin the same way ("psychologist" finds
   "psychology") and says so, as the resource list's search does. The words stay in the address
   (?q=), so a link opens the same results. Until the index arrives, and if it never arrives,
   the page's own list of every page stays in place. */

import { t } from "./text.js";

const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/* "psychologist" -> "psycholog": the start a word must share with a page's word on the second try. */
const stem = (w) => w.slice(0, Math.min(w.length, Math.max(5, w.length - 3)));
const ELLIPSIS = "…";

/* A short piece of a page's words around the first typed word, so a result shows why it
   matched. With no word typed (the whole list), the start of the page's words. */
function excerpt(text, q) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  let at = 0;
  if (q.length) {
    const low = clean.toLowerCase();
    const hits = q.map((w) => low.indexOf(w)).filter((i) => i >= 0);
    if (hits.length) at = Math.max(0, Math.min(...hits) - 60);
  }
  const tail = clean.slice(at);
  let out = tail.slice(0, 180);
  if (tail.length > 180) {
    const cut = out.lastIndexOf(" ");
    if (cut > 40) out = out.slice(0, cut);
    out += ELLIPSIS;
  }
  if (at > 0) {
    const cut = out.indexOf(" ");
    if (cut >= 0 && cut < 40) out = out.slice(cut + 1);
    out = ELLIPSIS + out;
  }
  return out;
}

for (const box of document.querySelectorAll("[data-search]")) {
  const tools = box.querySelector("[data-srch-tools]");
  const input = box.querySelector("[data-srch-q]");
  const clear = box.querySelector("[data-srch-clear]");
  const reset = box.querySelector("[data-srch-reset]");
  const retry = box.querySelector("[data-srch-retry]");
  const again = box.querySelector("[data-srch-again]");
  const count = box.querySelector("[data-srch-count]");
  const relaxed = box.querySelector("[data-srch-relaxed]");
  const none = box.querySelector("[data-srch-none]");
  const list = box.querySelector("[data-srch-list]");
  const all = box.querySelector("[data-srch-all]");
  if (!tools || !input || !list || !count) continue;

  /* The index, once it has arrived: each page with the words it is matched by. */
  let pages = null;

  const apply = () => {
    const q = words(input.value).split(" ").filter(Boolean);
    if (clear) clear.hidden = !input.value;
    if (!pages) { count.textContent = t("search.loading"); return; }
    let shown = q.length ? pages.filter((p) => q.every((w) => p.hay.includes(w))) : pages;
    let loose = false;
    if (q.length && !shown.length) {
      shown = pages.filter((p) => q.every((w) => { const s = stem(w); return p.hayWords.some((h) => h.startsWith(s)); }));
      loose = shown.length > 0;
    }
    list.replaceChildren(...shown.map((p) => {
      const li = document.createElement("li");
      li.className = "srch-card";
      const h = document.createElement("h3");
      const a = document.createElement("a");
      a.href = p.path;
      a.textContent = p.title;
      h.append(a);
      li.append(h);
      const ex = excerpt(p.text, q);
      if (ex) {
        const par = document.createElement("p");
        par.className = "srch-excerpt";
        par.textContent = ex;
        li.append(par);
      }
      return li;
    }));
    list.hidden = !shown.length;
    if (all) all.hidden = true;
    if (none) none.hidden = shown.length > 0;
    if (relaxed) relaxed.hidden = !loose;
    count.textContent = shown.length === pages.length
      ? (pages.length === 1 ? t("search.count.one") : t("search.count.all", { n: pages.length }))
      : t("search.count.some", { shown: shown.length, total: pages.length });
    const url = new URL(location.href);
    if (input.value.trim()) url.searchParams.set("q", input.value.trim()); else url.searchParams.delete("q");
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  };

  const load = async () => {
    if (again) again.hidden = true;
    count.textContent = t("search.loading");
    try {
      const r = await fetch("/search-index.json", { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      const got = await r.json();
      pages = (got.pages || []).filter((p) => p && p.path && p.title).map((p) => {
        const hay = words(`${p.title} ${p.text || ""}`);
        return { ...p, hay, hayWords: hay.split(" ") };
      });
      apply();
    } catch {
      pages = null;
      count.textContent = t("search.failed");
      if (again) again.hidden = false;
    }
  };

  input.addEventListener("input", apply);
  clear?.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
  reset?.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
  retry?.addEventListener("click", load);

  input.value = new URLSearchParams(location.search).get("q") || "";
  tools.hidden = false;
  load();
}
