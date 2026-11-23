/* The resource list's topics, search and Additional Details (src/render/blocks/resources.mjs).
   The search is Connect's Find a Resource search: every word typed must appear on the card, and
   the matches are ordered by where the words matched — the card's name first, then the words
   it is also known by, its topics, what it is, and its details (QOL proposal 2). A short word
   must appear as a word of its own (QOL proposal 5). When nothing matches, it tries words from
   the same root ("anxious" finds "anxiety") and words that begin the same way ("psychologist"
   finds "psychology") and says so. The topic, the search and the filters stay in the address (?topic=, ?q=, ?cost=, ?where=,
   ?how=), so a link opens the same list; an old address word for a topic (?topic=health) opens that
   topic, and an unknown one shows everything. Within a filter group any pressed option matches; across
   groups every group must. What is in use shows as chips that each remove themselves, beside Clear All.
   The filters fold behind Filters at every width; it counts the ones pressed, and they stay folded when an address
   presses some: the chips already show them. The chips are one row that slides, so the row is one height however many
   are in use; the page's inline script reserves it for an address that carries a filter, so the list does not move.

   The page arrives with the first set of cards — the set the reveal below shows first. The whole list
   is fetched from /api/resources (the section's data-res-src), which draws it from the catalogue as
   it stands, with the build's data file beside the page (resources-data.json, data-res-file) as the
   fallback — fetched the first time the visitor opens, scrolls to, searches or filters the list, or at once when
   the address itself carries list state — the site search's way of working (src/client/search.js).
   While it is on its way the count line says so; if it does not arrive the count line says that instead
   and offers Try Again, with the first set still standing and its details still opening in place.
   Choices made before the list lands live in the tools' own state and are applied when it does.

   The tools card sticks under the site header for the length of the list, so the search,
   the Filters button and the topics stay reachable mid-list (UX placement audit Finding 2,
   16 Nov 2026); a sentinel below marks it stuck so it can travel compact. Each card's
   report links stand at its foot, outside Additional Details, on the details' own line
   as icon buttons, in the same order they are seen — they are part of no card's
   searchable words, as before. */

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
/* A word's root, by the endings English words trade among themselves: "anxious" and "anxiety"
   both come to "anxi", "psychologist" and "psychology" to "psycholog", "depressed" and
   "depression" to "depress". Endings are stripped one at a time, in this order, from the word
   as the ones before it leave it. Short words keep themselves. The site search's own copy of
   this (src/client/search.js) is the same list, so the two searches hear words alike. */
const stemOf = (w) => {
  if (w.length <= 3) return w;
  let s = w;
  for (const [end, put] of [["ies", "i"], ["iety", "i"], ["ious", "i"], ["ness", ""], ["ology", "olog"], ["ical", ""], ["ing", ""], ["edly", ""], ["ed", ""], ["ist", ""], ["ion", ""], ["ment", ""], ["ous", ""], ["ly", ""], ["y", "i"], ["es", ""], ["s", ""]]) {
    if (s.length > end.length && s.endsWith(end)) s = s.slice(0, s.length - end.length) + put;
  }
  return s;
};
/* Whether one typed word hits a field: a short word (four letters or fewer) must stand as a
   word of its own in the field's word set, so "rent" does not find "parent" and "car" does
   not find "care" (QOL proposal 5); a longer one may sit inside a longer word ("counsel" in
   "counseling"). */
const hitsWord = (w, hay, set) => (w.length <= 4 ? set.has(w) : hay.includes(w));
/* The second try: a card word from the same root, or one that begins the way the typed word
   begins. A word of three letters or fewer gets no shared-beginning try — its beginning is
   too little to go on — so "car" cannot reach "care" here either; at four letters the shared
   beginning is the word itself ("exam" finds "example"), and longer words share a shortened
   start ("psychologist" finds "psychology"). */
const looseHit = (w, it) => it.stems.has(stemOf(w)) || (w.length >= 4 && it.hayWords.some((h) => h.startsWith(stem(w))));

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
  const again = box.querySelector("[data-res-again]");
  /* The no-matches block's way into the site search: it carries the words typed, as the
     address does (?q=), so the other search opens on the same words. */
  const noneSearch = box.querySelector("[data-res-none-search]");
  /* The cards the search, topics and filters work on. The page carries only the first set,
     so this is built when the whole list has been fetched and swapped in (buildItems,
     below); until then it is null and apply() keeps only the tools' own state. An address
     that carries list state fetches the list at once (fromAddress), so the state in the
     tools can settle as it did when every card was on the page. */
  let items = null;
  let fromAddress = false;
  let topic = "";

  /* Progressive reveal: the list opens with the first PAGE matches and a Show More button
     reveals the next PAGE, so a long list never lands all at once. The reveal is worked out
     inside apply(), so it follows the search, the topic and the filters exactly: any change
     to what matches starts the reveal again. A safety resource is never held back by the
     reveal — it stays visible whenever it matches. Without the script the first set shows. */
  const PAGE = 12;
  const moreRow = box.querySelector("[data-res-more-row]");
  let limit = PAGE;
  let lastSig = null;

  /* The whole list is on the page: index its cards, and wire Additional Details to the one
     dialog, as the script always has (below, where the dialog's own words stand). */
  function buildItems() {
    items = [...list.querySelectorAll("[data-res]")].map((li) => {
      const cats = (li.dataset.cats || "").split(" ").filter(Boolean);
      /* The card's words by where they stand on it, so a match can be weighed (below): the
         name, the words it is also known by, its topics, what it is and who it suits, and
         its details. The whole hay is the same words joined, as the search has always read. */
      const field = (s) => { const hay = words(s); return { hay, set: new Set(hay.split(" ").filter(Boolean)) }; };
      const fields = {
        name: field(own(li.querySelector("h3"))),
        aka: field(li.dataset.aka || ""),
        cats: field(cats.map((c) => labelOf.get(c) || "").join(" ")),
        main: field([li.querySelector(".res-what"), li.querySelector(".res-fit"), li.querySelector(".res-tags")].map(own).join(" ")),
        body: field(own(li.querySelector(".res-more-body"))),
      };
      const hay = words([li.querySelector("h3"), li.querySelector(".res-what"), li.querySelector(".res-fit"), li.querySelector(".res-tags"), li.querySelector(".res-more-body")].map(own).concat(li.dataset.aka || "", cats.map((c) => labelOf.get(c) || "")).join(" "));
      const hayWords = hay.split(" ").filter(Boolean);
      const vals = Object.fromEntries(GROUPS.map((g) => [g, (li.dataset[g] || "").split(" ").filter(Boolean)]));
      return { li, cats, hay, hayWords, haySet: new Set(hayWords), stems: new Set(hayWords.map(stemOf)), fields, vals };
    });
    wireDialog();
  }

  /* On a phone the topics are one sliding row: bring a topic the address chose into sight. */
  const settleChosen = () => {
    const row = box.querySelector(".res-topics");
    const chosen = topic && buttons.find((b) => b.dataset.topic === topic);
    if (row && chosen && row.scrollWidth > row.clientWidth) {
      row.scrollLeft += chosen.getBoundingClientRect().left - row.getBoundingClientRect().left - parseFloat(getComputedStyle(row).paddingLeft || "0");
    }
  };

  /* Additional Details opens in place without JavaScript — and does until the whole list
     lands. With it, the details open in one dialog for the whole list: the card's name,
     what it is, who it suits, the details and its button. The page stays where it was and
     the focus goes back to the card. */
  function wireDialog() {
    const dialog = box.querySelector("[data-res-dialog]");
    const head = box.querySelector("[data-res-dtitle]");
    const body = box.querySelector("[data-res-dbody]");
    if (!dialog || !head || !body || typeof dialog.showModal !== "function") return;
    let opener = null;
    let y = 0;
    for (const it of items) {
      const summary = it.li.querySelector(".res-more > summary");
      if (!summary) continue;
      summary.addEventListener("click", (e) => {
        e.preventDefault();
        opener = summary;
        head.textContent = it.li.querySelector("h3")?.textContent || "";
        if (it.li.dataset.cat) dialog.dataset.cat = it.li.dataset.cat; else delete dialog.dataset.cat;
        /* The pop-up in one tidy order: the topic line first (the primary topic in its
           colour, the card's other topics quiet, cost and where beside them), what it is,
           who it suits, then the facts — the phone, and the detail rows (hours, where,
           email) — and at the foot the button with the two report actions standing
           beside it as icon buttons on its own row, not as two more lines of text. */
        const parts = [];
        const tags = it.li.querySelector(".res-tags");
        if (tags) parts.push(tags.cloneNode(true));
        for (const s of [".res-what", ".res-fit"]) { const el = it.li.querySelector(s); if (el) parts.push(el.cloneNode(true)); }
        const tel = it.li.querySelector(".res-tel");
        if (tel) parts.push(tel.cloneNode(true));
        const moreBody = it.li.querySelector(".res-more-body");
        if (moreBody) parts.push(moreBody.cloneNode(true));
        const foot = document.createElement("div");
        foot.className = "res-dialog-foot";
        const go = it.li.querySelector(".res-go");
        if (go) foot.append(go.cloneNode(true));
        const rep = it.li.querySelector(".res-report");
        if (rep) { const rc = rep.cloneNode(true); rc.classList.add("res-dialog-report"); foot.append(rc); }
        if (foot.childNodes.length) parts.push(foot);
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
  /* The address carries the list's state, so a link opens the same list: kept at whatever
     stage the list itself has reached. */
  const keepAddress = () => {
    const url = new URL(location.href);
    if (topic) url.searchParams.set("topic", topic); else url.searchParams.delete("topic");
    if (input.value.trim()) url.searchParams.set("q", input.value.trim()); else url.searchParams.delete("q");
    for (const g of GROUPS) if (pressed[g].size) url.searchParams.set(g, [...pressed[g]].join(",")); else url.searchParams.delete(g);
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  };

  /* What the tools themselves show — which buttons are pressed, how many filters are in
     use, the chips that name them — is true before the whole list arrives, so it is kept
     here on every change; the list work waits for the list (applyList). */
  const apply = () => {
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
        x.addEventListener("click", () => { u.off(); apply(); poke(); (chips.querySelector("button") || input).focus(); });
        li.append(x); return li;
      }));
      active.hidden = !used.length;
    }
    if (clear) clear.hidden = !input.value;
    keepAddress();
    if (items) applyList();
  };

  /* Where the words matched decides a card's place (QOL proposal 2): per typed word, the best
     field it hits — the name ahead of the words the card is also known by, those ahead of its
     topics, then what it is and who it suits, then its details; a word standing as its own
     word ahead of the same word inside a longer one. Equal scores keep the catalogue's order,
     so the order is steady. */
  const WEIGH = [["name", 16, 8], ["aka", 12, 6], ["cats", 10, 5], ["main", 6, 3], ["body", 4, 2]];
  const scoreOf = (it, q) => q.reduce((n, w) => n + (WEIGH.map(([f, whole, inside]) => {
    const fld = it.fields[f];
    return fld.set.has(w) ? whole : w.length > 4 && fld.hay.includes(w) ? inside : 0;
  }).reduce((a, b) => Math.max(a, b), 0)), 0);

  /* The list itself: what matches, the reveal over it, and the count of what is showing. */
  const applyList = () => {
    const q = words(input.value).split(" ").filter(Boolean);
    const cat = buttons.find((b) => b.dataset.topic === topic)?.dataset.category || "";
    const pool = items.filter((it) => (!cat || it.cats.includes(cat)) && GROUPS.every((g) => !pressed[g].size || it.vals[g].some((v) => pressed[g].has(v))));
    let shown = q.length ? pool.filter((it) => q.every((w) => hitsWord(w, it.hay, it.haySet))) : pool;
    let loose = false;
    if (q.length && !shown.length) {
      shown = pool.filter((it) => q.every((w) => looseHit(w, it)));
      loose = shown.length > 0;
    }
    if (q.length) shown = shown.slice().sort((a, z) => scoreOf(z, q) - scoreOf(a, q));
    const on = new Set(shown);
    const sig = [topic, q.join(" "), GROUPS.map((g) => [...pressed[g]].sort().join(",")).join("|"), shown.map((it) => it.li.dataset.res).join(",")].join("§");
    if (sig !== lastSig) { lastSig = sig; limit = PAGE; }
    let seen = 0, visible = 0;
    for (const it of items) if (!on.has(it)) it.li.hidden = true;
    /* The reveal walks the matches in their ranked order, and the cards are laid in that
       order too, so what is read first is what matched best; with no words typed the order
       is the catalogue's own, restored the same way. A safety resource is never held back. */
    for (const it of shown) {
      const exempt = it.cats.includes("safety_survivor_support");
      if (!exempt) seen++;
      it.li.hidden = !exempt && seen > limit;
      if (!it.li.hidden) visible++;
    }
    for (const it of shown) list.append(it.li);
    const held = shown.filter((it) => !it.cats.includes("safety_survivor_support")).length;
    if (moreRow) moreRow.hidden = !(shown.length > 0 && held > limit);
    if (relaxed) relaxed.hidden = !loose;
    if (none) none.hidden = shown.length > 0;
    if (noneSearch) noneSearch.href = "/search/" + (input.value.trim() ? `?q=${encodeURIComponent(input.value.trim())}` : "");
    list.hidden = !shown.length;
    count.textContent = visible === items.length
      ? (items.length === 1 ? t("resources.count.one") : t("resources.count.all", { n: items.length }))
      : t("resources.count.some", { shown: visible, total: items.length });
  };

  /* The whole list, fetched once, the first time it is used: the first set is swapped for
     every card, the index and the dialog are built over them (buildItems), and whatever
     state the tools already hold is applied. */
  let asking = null;
  /* One source of the whole list: the cards are the renderer's own markup, every word from
     text.json; parsed in a document of its own, where nothing loads or runs until placed. */
  const fetchList = async (url) => {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    const got = await r.json();
    const doc = new DOMParser().parseFromString((got.cards || []).join(""), "text/html");
    if (!doc.body.querySelector("[data-res]")) throw new Error("empty");
    return doc;
  };
  const load = async () => {
    if (again) again.hidden = true;
    count.textContent = t("resources.loading");
    try {
      /* The list as it stands now, from /api/resources (PF-4); the build's file beside the
         page (data-res-file) is the fallback, as it was the only source before. */
      let doc;
      try { doc = await fetchList(box.dataset.resSrc); } catch { doc = await fetchList(box.dataset.resFile); }
      list.replaceChildren(...doc.body.children);
      buildItems();
      apply();
      if (fromAddress) { fromAddress = false; settleChosen(); }
    } catch {
      count.textContent = t("resources.failed");
      if (again) again.hidden = false;
    } finally { asking = null; }
  };
  const poke = () => { if (!items && !asking) asking = load(); };

  for (const b of buttons) b.addEventListener("click", () => { topic = b.dataset.topic; apply(); poke(); });
  /* The no-matches block's topic buttons: pressing one clears the search and the filters
     and opens that topic, as the topic row itself would. */
  for (const b of box.querySelectorAll("[data-res-none-topic]")) b.addEventListener("click", () => {
    topic = b.dataset.resNoneTopic;
    input.value = "";
    for (const g of GROUPS) pressed[g].clear();
    apply();
    poke();
    buttons.find((x) => x.dataset.topic === topic)?.focus();
  });
  box.querySelector("[data-res-more]")?.addEventListener("click", () => {
    limit += PAGE;
    apply();
    poke();
    // The last reveal retires the button; keep the reader's place by moving focus to the count.
    if (items && moreRow?.hidden) count.focus({ preventScroll: true });
  });
  box.querySelector("[data-res-retry]")?.addEventListener("click", poke);
  input.addEventListener("input", () => { apply(); poke(); });
  clear?.addEventListener("click", () => { input.value = ""; apply(); poke(); input.focus(); });
  const clearAll = () => { input.value = ""; topic = ""; for (const g of GROUPS) pressed[g].clear(); apply(); poke(); input.focus(); };
  reset?.addEventListener("click", clearAll);
  box.querySelector("[data-res-clearall]")?.addEventListener("click", clearAll);
  for (const b of fbuttons) b.addEventListener("click", () => { const set = pressed[b.dataset.fgroup]; if (set.has(b.dataset.fopt)) set.delete(b.dataset.fopt); else set.add(b.dataset.fopt); apply(); poke(); });
  ftoggle?.addEventListener("click", () => { const open = ftoggle.getAttribute("aria-expanded") !== "true"; ftoggle.setAttribute("aria-expanded", String(open)); fpanel?.classList.toggle("is-open", open); poke(); });

  const params = new URLSearchParams(location.search);
  const want = (params.get("topic") || "").toLowerCase();
  topic = (want && buttons.find((b) => b.dataset.topic === want || (b.dataset.aliases || "").split(" ").includes(want))?.dataset.topic) || "";
  input.value = params.get("q") || "";
  for (const g of GROUPS) for (const v of (params.get(g) || "").split(",")) if (fbuttons.some((b) => b.dataset.fgroup === g && b.dataset.fopt === v)) pressed[g].add(v);
  tools.hidden = false;
  apply();
  /* The tools stick under the site header while the list scrolls (the stylesheet holds
     the sticking). A sentinel just above them marks when they are stuck, so the stuck
     bar travels compact: the search label and hint are kept for assistive tech but not
     shown, and the topics ride in one sliding row, as they already do on a phone. The
     mark is read from the sentinel's place on every scroll, not from an intersection
     observer: a jump scroll (a scrollbar drag, an anchor) can carry the sentinel from
     below the screen to above it without it ever intersecting, and the observer would
     never fire. */
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  tools.before(sentinel);
  const header = document.querySelector(".site-header");
  const markStuck = () => tools.classList.toggle("is-stuck", sentinel.getBoundingClientRect().top <= (header ? header.getBoundingClientRect().bottom : 0) + 2);
  addEventListener("scroll", markStuck, { passive: true });
  addEventListener("resize", markStuck);
  markStuck();
  /* An address that carries list state opens that list: the whole catalogue is fetched at
     once, and the state applies when it lands. A plain arrival leaves the first set
     standing until a first use — a press, a keystroke, the list scrolling into view. */
  if (topic || input.value.trim() || GROUPS.some((g) => pressed[g].size)) { fromAddress = true; poke(); }
  box.addEventListener("pointerdown", poke);
  box.addEventListener("focusin", poke);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); poke(); } }, { rootMargin: "600px" });
    io.observe(box);
  }
}
