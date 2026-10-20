/* The page is static and may be served for days after it was built. This marks events that
   have ended as ended, and moves the "Today" mark to the real today. It never adds or removes
   events: what is listed is what the last publish listed. It reads the week's rows (.ev, .day)
   and the event cards (.evcard), which carry their own date. */

import { t } from "./text.js";

const now = Date.now();
for (const ev of document.querySelectorAll(".ev[data-ends], .evcard[data-ends]")) {
  if (Date.parse(ev.dataset.ends) < now) ev.classList.add("is-past");
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
