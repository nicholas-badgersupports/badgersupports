/* One calendar file per dated event, at /calendar/<event id>.ics, so "Add to calendar" works in
 * any calendar app with no account and no script. Times are written in UTC from the row's
 * Chicago instants, so no client has to know the time zone. Lines are escaped and folded as
 * RFC 5545 asks.
 */

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/* Fold at 75 octets: continuation lines start with one space. */
function fold(line) {
  const out = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export const icsPath = (eventId) => `/calendar/${eventId}.ics`;

/* Where a card's calendar button goes. A site built from Connect's list points it at the API, which
   writes the file from Connect's current list (netlify/lib/live-events.mjs), so an event moved or
   added since the last publish gets the right time; a site built from the fixture keeps the files
   the build wrote. */
export const calendarHref = (ctx, eventId) => (ctx.liveEvents ? `/api/calendar/${eventId}.ics` : icsPath(eventId));

/* row: from src/render/events.mjs. place: the room record or null. origin: the site's origin. */
export function eventIcs(row, { place, origin, stamp }) {
  const where = place ? [place.name, place.building, place.address].filter(Boolean).join(", ") : "";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Badger Supports//Public site//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${row.event}@badgersupports.org`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${utc(row.startsAt)}`,
    `DTEND:${utc(row.endsAt)}`,
    `SUMMARY:${esc(row.title)}`,
    ...(where ? [`LOCATION:${esc(where)}`] : []),
    ...(row.note || row.tagline ? [`DESCRIPTION:${esc([row.tagline, row.note].filter(Boolean).join(" "))}`] : []),
    ...(row.href ? [`URL:${row.href.startsWith("http") ? row.href : origin + row.href}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
