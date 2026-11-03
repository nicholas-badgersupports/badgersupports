/* Instants are supplied by the approved event source. No browser/server time zone changes their order. */
export function eventState(event, now) {
  const start = Date.parse(event.startsAt), end = Date.parse(event.endsAt);
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return "unknown";
  if (now >= end) return "ended";
  return now >= start ? "happening" : "upcoming";
}
