/* The Campus Events Explorer's filters, calendar and refresh (src/render/blocks/exploreevents.mjs).
 * The page arrives with the build's read of the feeds rendered as the first cards; the same data
 * rides in a file beside the page (events-data.json, named by the section's data-ce-data), fetched
 * the first time the visitor opens, searches or filters the explorer — the site search's way of
 * working. Only then does this ask /api/campus-events for the current read (the feeds are re-read
 * there at most every few minutes; a failed read there keeps the last good list) and filter in the
 * browser. Until the file lands, the controls hold their state and the rendered cards stand; if it
 * does not arrive, the count line says so and offers Try Again. Nothing typed is sent anywhere:
 * the only requests are the reads themselves. Cards are built with textContent, so feed text can
 * never become markup.
 *
 * The list is revealed in steps, the way the Resources list is: the first PAGE matches show and
 * Show More reveals the next PAGE of the same filtered set; any change to the filters starts the
 * reveal again. The Badger Supports toggle beside the source menu is the same filter as that
 * menu's Badger Supports choice — it sets the menu, and the menu sets it — limiting the list to
 * the events the Connect feed marks as Badger Supports' own (badger: true). */

import { t } from "./text.js";

const TZ = "America/Chicago";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const dayLong = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const monthName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" });
const monthLong = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", year: "numeric" });
const clock = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const updatedFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const dayOf = (iso) => dayKey.format(new Date(iso));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

for (const box of document.querySelectorAll("[data-campus-events]")) {
  let data = { events: [], interests: [], updated: null, stale: false, today: dayKey.format(new Date()) };
  /* False until the data file beside the page has landed: until then render() leaves the
     rendered first cards standing and the controls only hold their state. */
  let loaded = false;
  const tools = box.querySelector("[data-ce-tools]");
  const q = box.querySelector("[data-ce-q]");
  const cat = box.querySelector("[data-ce-cat]");
  const src = box.querySelector("[data-ce-src]");
  const from = box.querySelector("[data-ce-from]");
  const to = box.querySelector("[data-ce-to]");
  const chips = [...box.querySelectorAll("[data-ce-interest]")];
  const views = [...box.querySelectorAll("[data-ce-view]")];
  const reset = box.querySelector("[data-ce-reset]");
  const count = box.querySelector("[data-ce-count]");
  const updated = box.querySelector("[data-ce-updated]");
  const retryRow = box.querySelector("[data-ce-retry]");
  const list = box.querySelector("[data-ce-list]");
  const cal = box.querySelector("[data-ce-cal]");
  const none = box.querySelector("[data-ce-none]");
  const moreRow = box.querySelector("[data-ce-more-row]");
  const moreBtn = box.querySelector("[data-ce-more]");
  const badgerBtn = box.querySelector("[data-ce-badger]");
  const PAGE = 12;
  const state = { interests: new Set(), view: "list", month: null, limit: PAGE, sig: null };

  const interestOf = (id) => (data.interests || []).find((i) => i.id === id);
  function matches(e) {
    const day = dayOf(e.start);
    if (from.value && day < from.value) return false;
    if (to.value && day > to.value) return false;
    if (cat.value && !e.categories.includes(cat.value)) return false;
    if (src.value && !e.sources.some((s) => s.source === src.value)) return false;
    if (state.interests.size) {
      const tags = new Set(e.tags.map((x) => x.toLowerCase()));
      const cats = new Set(e.categories.map((x) => x.toLowerCase()));
      const hit = [...state.interests].some((id) => { const i = interestOf(id); return i && (i.tags.some((x) => tags.has(x.toLowerCase())) || i.categories.some((x) => cats.has(x.toLowerCase()))); });
      if (!hit) return false;
    }
    if (q.value.trim()) {
      const hay = norm(`${e.title} ${e.place || ""} ${e.organizer || ""} ${e.blurb || ""}`);
      if (!norm(q.value).split(" ").every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const filtered = () => data.events.filter(matches);

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function card(e) {
    const li = el("li", `cecard${e.badger ? " is-badger" : ""}`);
    const date = el("div", "cecard-date"); date.setAttribute("aria-hidden", "true");
    const start = new Date(e.start);
    date.append(el("span", "dow", dayName.format(start)), el("span", "dom", String(Number(dayOf(e.start).slice(8)))), el("span", "mon", monthName.format(start)));
    const isToday = dayOf(e.start) === data.today;
    if (isToday) date.classList.add("is-today");
    const body = el("div", "cecard-body");
    const h = el("h3");
    const first = e.sources[0];
    if (first?.url) { const a = el("a", null, e.title); a.href = first.url; h.append(a); } else h.textContent = e.title;
    body.append(h);
    if (e.badger) body.append(el("p", "cecard-program", t("explore.events.program")));
    const when = e.allDay ? t("explore.events.allDay") : `${clock.format(start)}${e.end ? `–${clock.format(new Date(e.end))}` : ""}`;
    const meta = el("p", "cecard-meta");
    const sr = el("span", "sr-only", `${dayLong.format(start)}, `); meta.append(sr); if (isToday) meta.append(el("span", "cecard-today", t("schedule.today"))); meta.append(document.createTextNode(when + (e.place ? ` · ${e.place}` : "")));
    body.append(meta);
    if (e.organizer) body.append(el("p", "cecard-org", e.organizer));
    if (e.blurb) body.append(el("p", "cecard-blurb", e.blurb));
    if (e.cost) body.append(el("p", "cecard-cost", e.cost));
    if (e.status === "soldOut") body.append(el("p", "cecard-status", t("explore.events.soldOut")));
    const source = el("p", "cecard-source");
    e.sources.forEach((s, i) => {
      if (i) source.append(document.createTextNode(" · "));
      source.append(document.createTextNode(t("explore.events.sourceLine", { name: s.name })));
      if (s.url) { const a = el("a", null, t("explore.events.official")); a.href = s.url; source.append(document.createTextNode(" — "), a); }
    });
    body.append(source);
    li.append(date, body);
    return li;
  }

  function renderCalendar(events) {
    cal.replaceChildren();
    const base = state.month ? new Date(`${state.month}-15T12:00:00Z`) : new Date();
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const head = el("div", "cecal-head");
    const title = el("h3", "cecal-title", monthLong.format(first));
    const prev = el("button", "cecal-nav", t("explore.events.prevMonth")); prev.type = "button";
    const next = el("button", "cecal-nav", t("explore.events.nextMonth")); next.type = "button";
    prev.addEventListener("click", () => { state.month = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1)).toISOString().slice(0, 7); render(); });
    next.addEventListener("click", () => { state.month = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)).toISOString().slice(0, 7); render(); });
    head.append(prev, title, next);
    cal.append(head);
    const grid = el("div", "cecal-grid");
    grid.setAttribute("role", "grid");
    for (let d = 0; d < 7; d++) grid.append(el("span", "cecal-dow", t(`date.dow.${d}`)));
    const startPad = first.getUTCDay();
    for (let i = 0; i < startPad; i++) grid.append(el("span", "cecal-pad"));
    const daysIn = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const byDay = new Map();
    for (const e of events) { const k = dayOf(e.start); byDay.set(k, [...(byDay.get(k) || []), e]); }
    for (let d = 1; d <= daysIn; d++) {
      const key = `${first.toISOString().slice(0, 8)}${String(d).padStart(2, "0")}`;
      const todays = byDay.get(key) || [];
      const cell = el("div", "cecal-day");
      if (key === data.today) cell.classList.add("is-today");
      cell.append(el("span", "cecal-dom", String(d)));
      for (const e of todays.slice(0, 3)) {
        const b = el("button", "cecal-ev", e.title); b.type = "button";
        b.setAttribute("aria-label", `${e.title}, ${dayLong.format(new Date(e.start))}`);
        b.addEventListener("click", () => { from.value = key; to.value = key; setView("list"); render(); });
        cell.append(b);
      }
      if (todays.length > 3) cell.append(el("span", "cecal-more", t("explore.events.more", { n: todays.length - 3 })));
      grid.append(cell);
    }
    cal.append(grid);
  }

  function setView(v) {
    state.view = v;
    for (const b of views) b.setAttribute("aria-pressed", String(b.dataset.ceView === v));
    if (!loaded) { poke(); return; }
    list.hidden = v !== "list";
    cal.hidden = v !== "calendar";
  }

  function render() {
    if (!loaded) return;
    list.hidden = state.view !== "list";
    cal.hidden = state.view !== "calendar";
    const events = filtered();
    /* The reveal counts the filtered set: when the filters change, the first PAGE shows again. */
    const sig = [q.value, cat.value, src.value, from.value, to.value, [...state.interests].sort().join(",")].join("§");
    if (sig !== state.sig) { state.sig = sig; state.limit = PAGE; }
    if (badgerBtn) badgerBtn.setAttribute("aria-pressed", String(src.value === "badger"));
    count.textContent = events.length ? t(events.length === 1 ? "explore.events.count.one" : "explore.events.count.other", { n: events.length }) : t("explore.events.count.none");
    if (updated) updated.textContent = data.updated ? t("explore.events.updated", { when: updatedFmt.format(new Date(data.updated)) }) : "";
    none.hidden = events.length > 0;
    if (moreRow) moreRow.hidden = !(state.view === "list" && events.length > state.limit);
    if (state.view === "calendar") { list.replaceChildren(); renderCalendar(events); }
    else { cal.replaceChildren(); list.replaceChildren(...events.slice(0, state.limit).map(card)); }
  }

  /* The build's read, fetched once, the first time the explorer is used: what the page used to
     carry in a JSON island. When it lands, whatever state the controls already hold is
     rendered, and the live read (refresh) follows as it always has. */
  let asking = null;
  async function load() {
    count.textContent = t("explore.events.loading");
    try {
      const res = await fetch(box.dataset.ceData, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error("bad answer");
      const got = await res.json();
      if (!got || !Array.isArray(got.events)) throw new Error("bad answer");
      data = { events: got.events, interests: got.interests || [], updated: got.updated || null, stale: !!got.stale, today: got.today || data.today };
      loaded = true;
      retryRow.hidden = true;
      render();
      refresh();
    } catch {
      retryRow.hidden = false;
      count.textContent = t("explore.events.failed");
    } finally { asking = null; }
  }
  const poke = () => { if (!loaded && !asking) asking = load(); };

  async function refresh() {
    try {
      const res = await fetch("/api/campus-events", { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error("bad answer");
      const got = await res.json();
      if (!got.ok || !Array.isArray(got.events)) throw new Error("bad answer");
      data = { events: got.events, interests: got.interests || data.interests, updated: got.updated || null, stale: !!got.stale, today: got.today || data.today };
      retryRow.hidden = true;
      render();
    } catch {
      retryRow.hidden = false;
      if (!data.events.length) count.textContent = t("explore.events.failed");
    }
  }

  for (const chip of chips) chip.addEventListener("click", () => {
    poke();
    const id = chip.dataset.ceInterest;
    if (state.interests.has(id)) { state.interests.delete(id); chip.setAttribute("aria-pressed", "false"); }
    else { state.interests.add(id); chip.setAttribute("aria-pressed", "true"); }
    render();
  });
  for (const b of views) b.addEventListener("click", () => { setView(b.dataset.ceView); render(); });
  moreBtn?.addEventListener("click", () => {
    poke();
    state.limit += PAGE;
    render();
    // The last reveal retires the button; keep the reader's place by moving focus to the count.
    if (moreRow?.hidden) count.focus({ preventScroll: true });
  });
  badgerBtn?.addEventListener("click", () => {
    poke();
    src.value = src.value === "badger" ? "" : "badger";
    render();
  });
  reset.addEventListener("click", () => {
    poke();
    q.value = ""; cat.value = ""; src.value = ""; from.value = ""; to.value = "";
    state.interests.clear();
    for (const chip of chips) chip.setAttribute("aria-pressed", "false");
    setView("list"); render();
  });
  box.querySelector("[data-ce-retrybtn]")?.addEventListener("click", () => { if (!loaded) poke(); else refresh(); });
  for (const input of [q, cat, src, from, to]) input.addEventListener("input", () => { poke(); render(); });
  if (tools) tools.hidden = false;
  /* A plain arrival leaves the rendered first cards standing until a first use — a press, a
     keystroke, the explorer scrolling into view. */
  box.addEventListener("pointerdown", poke);
  box.addEventListener("focusin", poke);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); poke(); } }, { rootMargin: "600px" });
    io.observe(box);
  }
}
