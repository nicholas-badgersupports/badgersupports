/* Site-wide search (src/render/blocks/sitesearch.mjs). The visitor's words are matched against
   the build's index of the site's public pages and its resources (/search-index.json), here in
   the browser, so nothing typed is sent anywhere. Every word typed must appear in an entry's
   title or its words; results are ordered by where the words matched, a title match ahead of
   a match in the words (QOL proposal 2). A short word (four letters or fewer) must appear as
   a word of its own, so "rent" does not find "parent" (QOL proposal 5). When nothing matches,
   it tries words from the same root ("anxious" finds "anxiety", "psychologist" finds
   "psychology") and words that begin the same way, and says so, as the resource list's search
   does. The words stay in the address (?q=), so a link opens the same results. Results render
   only in response to a query (UX placement audit finding 3, ruled 16 Nov 2026): with nothing
   typed the page shows the search box and the count of pages the search covers, and no list.
   The Try Again button appears only when the index load has actually failed. */

import { t } from "./text.js";

const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/* "psychologist" -> "psycholog": the start a word must share with a page's word on the second try. */
const stem = (w) => w.slice(0, Math.min(w.length, Math.max(5, w.length - 3)));
/* A word's root, by the endings English words trade among themselves: "anxious" and "anxiety"
   both come to "anxi", "psychologist" and "psychology" to "psycholog", "depressed" and
   "depression" to "depress". Endings are stripped one at a time, in this order, from the word
   as the ones before it leave it. Short words keep themselves, and no ending whose loss would
   leave less than the word's own start. */
const stemOf = (w) => {
  if (w.length <= 3) return w;
  let s = w;
  for (const [end, put] of [["ies", "i"], ["iety", "i"], ["ious", "i"], ["ness", ""], ["ology", "olog"], ["ical", ""], ["ing", ""], ["edly", ""], ["ed", ""], ["ist", ""], ["ion", ""], ["ment", ""], ["ous", ""], ["ly", ""], ["y", "i"], ["es", ""], ["s", ""]]) {
    if (s.length > end.length && s.endsWith(end)) s = s.slice(0, s.length - end.length) + put;
  }
  return s;
};
/* Whether one typed word hits a field: a short word must stand as a word of its own in the
   field's word set; a longer one may sit inside a longer word ("counsel" in "counseling"). */
const hitsWord = (w, hay, set) => (w.length <= 4 ? set.has(w) : hay.includes(w));
/* The second try: a page word from the same root, or one that begins the way the typed word
   begins. A word of three letters or fewer gets no shared-beginning try — its beginning is
   too little to go on — so "car" cannot reach "care" here either; at four letters the shared
   beginning is the word itself ("exam" finds "example"), and longer words share a shortened
   start ("psychologist" finds "psychology"). */
const looseHit = (w, page) => page.stems.has(stemOf(w)) || (w.length >= 4 && page.hayWords.some((h) => h.startsWith(stem(w))));
const ELLIPSIS = "…";

/* The 988 record's own crisis words (its aka list in the resource catalogue): when the
   visitor's words are among them, the crisis block stands above the results, as the
   resource list's safety cards are never held back. */
const CRISIS_WORDS = new Set(["suicide", "suicidal", "988"]);
const CRISIS_PHRASES = ["kill myself", "hurt myself", "self harm"];
const isCrisis = (q) => q.some((w) => CRISIS_WORDS.has(w)) || CRISIS_PHRASES.some((p) => q.join(" ").includes(p));

/* A short piece of a page's words around the first typed word, so a result shows why it
   matched. */
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
  const crisisEl = box.querySelector("[data-srch-crisis]");
  const closestWrap = box.querySelector("[data-srch-closest-wrap]");
  const closestList = box.querySelector("[data-srch-closest]");
  const resourcesLink = box.querySelector("[data-srch-resources]");
  const list = box.querySelector("[data-srch-list]");
  if (!tools || !input || !list || !count) continue;

  /* The index, once it has arrived: each page with the words it is matched by. */
  let pages = null;

  /* Where the words matched decides the order: a word standing as its own word in the title
     first, then a word inside a title word, then a word of its own in the text, then a word
     inside a text word. Equal scores keep the index's order, so the order is steady. */
  const score = (p, q) => q.reduce((n, w) => n
    + (p.titleSet.has(w) ? 8 : w.length > 4 && p.titleHay.includes(w) ? 4 : p.textSet.has(w) ? 2 : w.length > 4 && p.textHay.includes(w) ? 1 : 0), 0);
  /* The no-matches block's suggestions: the pages that come closest — a page scores for
     each typed word it carries whole, and half as much for a word that begins the same
     way (the second try's rule). Index order breaks ties; at most three are offered. */
  const closest = (q) => {
    const scored = [];
    for (const p of pages) {
      let score = 0;
      for (const w of q) {
        if (p.hayWords.includes(w)) score += 2;
        else { const s = stem(w); if (p.hayWords.some((h) => h.startsWith(s))) score += 1; }
      }
      if (score) scored.push({ p, score });
    }
    return scored.sort((a, z) => z.score - a.score).slice(0, 3).map((x) => x.p);
  };

  const apply = () => {
    const q = words(input.value).split(" ").filter(Boolean);
    if (clear) clear.hidden = !input.value;
    if (crisisEl) crisisEl.hidden = !isCrisis(q);
    if (!pages) { count.textContent = t("search.loading"); return; }
    if (!q.length) {
      list.replaceChildren();
      list.hidden = true;
      if (none) none.hidden = true;
      if (relaxed) relaxed.hidden = true;
      count.textContent = pages.length === 1 ? t("search.count.one") : t("search.count.all", { n: pages.length });
      const url = new URL(location.href);
      url.searchParams.delete("q");
      if (url.href !== location.href) history.replaceState(history.state, "", url);
      return;
    }
    let shown = pages.filter((p) => q.every((w) => hitsWord(w, p.hay, p.haySet)));
    let loose = false;
    if (q.length && !shown.length) {
      shown = pages.filter((p) => q.every((w) => looseHit(w, p)));
      loose = shown.length > 0;
    }
    if (q.length) shown = shown.slice().sort((a, z) => score(z, q) - score(a, q));
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
    if (none) none.hidden = shown.length > 0;
    if (!shown.length && q.length) {
      if (closestWrap && closestList) {
        const near = closest(q);
        closestList.replaceChildren(...near.map((p) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = p.path;
          a.textContent = p.title;
          li.append(a);
          return li;
        }));
        closestWrap.hidden = !near.length;
      }
      if (resourcesLink) resourcesLink.href = `/resources/?q=${encodeURIComponent(input.value.trim())}`;
    }
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
        const titleHay = words(p.title);
        const textHay = words(p.text || "");
        const hay = words(`${p.title} ${p.text || ""}`);
        const hayWords = hay.split(" ").filter(Boolean);
        return {
          ...p, hay, hayWords, haySet: new Set(hayWords),
          titleHay, titleSet: new Set(titleHay.split(" ").filter(Boolean)),
          textHay, textSet: new Set(textHay.split(" ").filter(Boolean)),
          stems: new Set(hayWords.map(stemOf)),
        };
      });
      apply();
    } catch {
      pages = null;
      list.replaceChildren();
      list.hidden = true;
      if (none) none.hidden = true;
      if (relaxed) relaxed.hidden = true;
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
