/* The page is static and may be served for days after it was built. This marks events that
   have ended as ended, and moves the "Today" mark to the real today. It reads the week's rows
   (.ev, .day) and the event cards (.evcard), which carry their own date.

   On a page built from Connect's events (body data-refresh="events", src/render/layout.mjs) it
   then asks for the page's event blocks again (/api/events/<page id>, netlify/lib/live-events.mjs),
   rendered by the build's own renderer from Connect's list now, so an event added, moved or taken
   off in Connect shows without a publish. A block with data-live parts has only those swapped, and
   only the ones that changed, so its photos stay; any other block's section is replaced when its
   answer differs from the page; an empty answer hides it. A block the page was published without
   cannot be added, which is why a list that found nothing still publishes an empty hidden section.
   If the asking fails in any way, the page stays as it was published. */

import { t } from "./text.js";

function mark() {
  const now = Date.now();
  for (const ev of document.querySelectorAll(".ev[data-ends], .evcard[data-ends]")) {
    ev.classList.toggle("is-past", Date.parse(ev.dataset.ends) < now);
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  for (const day of document.querySelectorAll(".day[data-date], .evcard[data-date]")) {
    const isToday = day.dataset.date === today;
    day.classList.toggle("is-today", isToday);
    const block = day.querySelector(".dateblock, .evcard-date");
    const tag = day.querySelector(".today-tag");
    if (tag && !isToday) tag.remove();
    if (!tag && isToday && block) block.append(Object.assign(document.createElement("span"), { className: "today-tag", textContent: t("schedule.today") }));
  }
}

/* The page's event sections as published, read before mark() changes their classes. */
const sections = new Map();
for (const s of document.querySelectorAll("main [data-block]")) {
  sections.set(s.dataset.block, { el: s, html: s.outerHTML, live: [...s.querySelectorAll("[data-live]")].map((p) => p.outerHTML) });
}

mark();

/* The answer is the build's renderer's own markup, every word from text.json; parsed in a document
   of its own, where nothing loads or runs until it is placed. */
const parse = (markup) => new DOMParser().parseFromString(markup, "text/html").body.firstElementChild;
const keys = (parts) => parts.map((p) => p.dataset.live).join(" ");

/* Compared as the browser writes them out, on both sides, so quoting and entities never count as a
   change. A section with live parts only ever has those parts swapped: what is around them is the
   block's own words and photos, which change only with a publish, and other scripts (strip.js) may
   have touched it. */
function swap(id, markup) {
  const was = sections.get(id);
  if (!was || !was.el.isConnected) return;
  if (!markup) { was.el.hidden = true; return; }
  const fresh = parse(markup);
  if (!fresh || fresh.dataset.block !== id) return;
  const parts = [...was.el.querySelectorAll("[data-live]")];
  const freshParts = [...fresh.querySelectorAll("[data-live]")];
  if (parts.length && parts.length === was.live.length && keys(parts) === keys(freshParts)) {
    parts.forEach((p, i) => { if (was.live[i] !== freshParts[i].outerHTML) p.replaceWith(freshParts[i]); });
    return;
  }
  if (fresh.outerHTML !== was.html) was.el.replaceWith(fresh);
}

if (document.body.dataset.refresh === "events" && sections.size) {
  fetch(`/api/events/${encodeURIComponent(document.body.dataset.page)}`, { headers: { accept: "application/json" }, credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .then((reply) => {
      if (!reply?.ok || !reply.blocks || typeof reply.blocks !== "object") return;
      for (const [id, markup] of Object.entries(reply.blocks)) if (typeof markup === "string") swap(id, markup);
      mark();
    })
    .catch(() => {});
}
