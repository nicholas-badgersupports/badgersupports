/* Instants preserve validated source timestamps or resolved Chicago wall times. Gaps stay unknown. */
export function eventState(event, now) {
  const start = Date.parse(event.startsAt), end = Date.parse(event.endsAt);
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "unknown";
  if (now >= end) return "ended";
  return now >= start ? "happening" : "upcoming";
}
