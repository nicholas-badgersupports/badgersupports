/* Turning an event source into dated rows.
 *
 * The source has two kinds of entry: recurring (a weekday and times) and dated (one day). The
 * homepage asks for "the next N days" and "the next K dated events after that". Everything is in
 * America/Chicago and kept as plain YYYY-MM-DD and HH:MM strings until it is printed, so no
 * machine time zone can move an event to the wrong day.
 *
 * Each row also carries ISO instants (with the Chicago offset of that day), which the browser
 * uses to grey out an event that has ended since the page was built — the page is static and may
 * be served for days before the next publish.
 */

import { TZ } from "./context.mjs";


export function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export const weekday = (date) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

/* Day and month names come from the text registry (date.dow.*, date.mon.* …). */
export function dateParts(date, t) {
  const [y, m, d] = date.split("-").map(Number);
  const w = weekday(date);
  return { dow: t(`date.dow.${w}`), dowLong: t(`date.dowLong.${w}`), dom: d, mon: t(`date.mon.${m - 1}`), monLong: t(`date.monLong.${m - 1}`), year: y };
}

/* "-05:00" or "-06:00" for a Chicago calendar day (taken at noon, away from the switch hour). */
export function chicagoOffset(date) {
  const [y, m, d] = date.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 17));
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(noon).find((p) => p.type === "timeZoneName").value;
  const off = name.replace("GMT", "");
  return off === "" ? "+00:00" : off;
}

/* The days an event over several days runs, short ("Fri Oct 23 – Sun Oct 25") and in full for a screen reader,
   or null for one day. Words from the text registry (events.days, events.daysLong). */
export function dayRange(r, t) {
  if (!r.until || !r.from || r.until === r.from) return null;
  const a = dateParts(r.from, t), b = dateParts(r.until, t);
  return {
    short: t("events.days", { from: `${a.dow} ${a.mon} ${a.dom}`, to: `${b.dow} ${b.mon} ${b.dom}` }),
    long: t("events.daysLong", { from: `${a.dowLong}, ${a.monLong} ${a.dom}`, to: `${b.dowLong}, ${b.monLong} ${b.dom}` }),
  };
}

/* Whether a row's event runs on `day`: its one day, or any day from its first to its last. */
export const runsOn = (r, day) => (r.from || r.date) <= day && day <= (r.until || r.date);

/* 5–6 PM · 5:30–7:30 PM · 11:30 AM–1 PM */
export function timeRange(start, end, t) {
  const fmt = (hm) => {
    const [h, m] = hm.split(":").map(Number);
    const h12 = ((h + 11) % 12) + 1;
    return { text: m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`, ap: h < 12 ? t("time.am") : t("time.pm") };
  };
  // a no-break space keeps "PM" with its hour when a narrow date column wraps the line
  const a = fmt(start);
  if (!end) return `${a.text}\u00a0${a.ap}`;
  const b = fmt(end);
  return a.ap === b.ap ? `${a.text}–${b.text}\u00a0${b.ap}` : `${a.text}\u00a0${a.ap}–${b.text}\u00a0${b.ap}`;
}

/* The last day a dated event runs: its endDate when it runs over several days, otherwise its own day. */
export const lastDay = (e) => (e.endDate && e.endDate > e.date ? e.endDate : e.date);

function row(src, e, date) {
  const place = src.places?.[e.place] || null;
  const off = chicagoOffset(date);
  // a dated event's first and last day; a weekly one's row is its one day
  const dated = e.weekday === undefined;
  const last = dated ? lastDay(e) : date;
  return {
    id: `${e.id}@${date}`,
    program: e.program || "other",
    series: e.series || null,
    title: e.title,
    short: e.short || e.title,
    note: e.note || null,
    date,
    from: dated ? e.date : date,
    until: last,
    start: e.start,
    end: e.end || null,
    startsAt: `${date}T${e.start}:00${off}`,
    endsAt: `${last}T${e.end || e.start}:00${chicagoOffset(last)}`,
    place,
    placeId: e.place || null,
    signup: e.signup || "none",
    signupUrl: e.signupUrl || null,
    href: e.href || null,
    tagline: e.tagline || null,
    media: e.media || null,
    event: e.id,
  };
}

/* Rows from `from` (inclusive) for `days` days, recurring and dated together, in time order. */
export function rowsBetween(src, from, days) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const w = weekday(date);
    for (const e of src.recurring || []) {
      if (e.weekday !== w) continue;
      if (e.from && date < e.from) continue;
      if (e.until && date > e.until) continue;
      if ((e.skip || []).includes(date)) continue;
      out.push(row(src, e, date));
    }
    for (const e of src.dated || []) if (e.date <= date && date <= lastDay(e)) out.push(row(src, e, date));
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

/* Which events a block asks for: `which` is a program, or { program, series }. A series (a page's own
   events, such as Dogs on Call; content/connect-feed.json) wins over the program; neither is every event. */
function wanted(which) {
  const w = which && typeof which === "object" ? which : { program: which };
  return (e) => (w.series ? e.series === w.series : !w.program || e.program === w.program);
}

/* The next `count` dated (one-off) events still running on or after `from`, optionally for one program or series.
   One that began before `from` and has not ended comes first. */
export function nextDated(src, from, count, which = null) {
  const keep = wanted(which);
  return (src.dated || [])
    .filter((e) => lastDay(e) >= from && keep(e))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, count)
    .map((e) => row(src, e, e.date));
}

/* The `count` most recent dated events over before `before`, newest first, optionally for one program or series. */
export function lastDated(src, before, count, which = null) {
  const keep = wanted(which);
  return (src.dated || [])
    .filter((e) => lastDay(e) < before && keep(e))
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
    .slice(0, count)
    .map((e) => row(src, e, e.date));
}

export function groupByDate(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date).push(r);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }));
}
