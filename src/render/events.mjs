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

/* 5–6 PM · 5:30–7:30 PM · 11:30 AM–1 PM */
export function timeRange(start, end, t) {
  const fmt = (hm) => {
    const [h, m] = hm.split(":").map(Number);
    const h12 = ((h + 11) % 12) + 1;
    return { text: m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`, ap: h < 12 ? t("time.am") : t("time.pm") };
  };
  const a = fmt(start);
  if (!end) return `${a.text} ${a.ap}`;
  const b = fmt(end);
  return a.ap === b.ap ? `${a.text}–${b.text} ${b.ap}` : `${a.text} ${a.ap}–${b.text} ${b.ap}`;
}

function row(src, e, date) {
  const place = src.places?.[e.place] || null;
  const off = chicagoOffset(date);
  return {
    id: `${e.id}@${date}`,
    program: e.program || "other",
    title: e.title,
    short: e.short || e.title,
    note: e.note || null,
    date,
    start: e.start,
    end: e.end || null,
    startsAt: `${date}T${e.start}:00${off}`,
    endsAt: `${date}T${e.end || e.start}:00${off}`,
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
    for (const e of src.dated || []) if (e.date === date) out.push(row(src, e, date));
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

/* The next `count` dated (one-off) events on or after `from`, optionally for one program. */
export function nextDated(src, from, count, program = null) {
  return (src.dated || [])
    .filter((e) => e.date >= from && (!program || e.program === program))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, count)
    .map((e) => row(src, e, e.date));
}

/* The `count` most recent dated events before `before`, newest first, optionally for one program. */
export function lastDated(src, before, count, program = null) {
  return (src.dated || [])
    .filter((e) => e.date < before && (!program || e.program === program))
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
