/* Resolve source wall times at their actual hour. A repeated hour defaults to its earlier
   occurrence; a validated source instant can select either occurrence. A gap has no instant. */
const zone = "America/Chicago";
const wall = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const offsets = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" });
const dayOffsets = new Map();

function matches(instant, date, time) {
  if (!Number.isFinite(instant)) return false;
  const p = Object.fromEntries(wall.formatToParts(instant).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time;
}

export function validChicagoInstant(value, date, time) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::00(?:\.0{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return matches(Date.parse(value), date, time);
}

export function chicagoInstant(date, time, supplied = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return null;
  if (validChicagoInstant(supplied, date, time)) return supplied;
  if (!dayOffsets.has(date)) {
    const noon = Date.parse(`${date}T12:00:00Z`);
    if (!Number.isFinite(noon)) return null;
    const choices = [-1, 0, 1].map(n => offsets.formatToParts(noon + n * 86400000).find(p => p.type === "timeZoneName").value.replace("GMT", "") || "+00:00");
    if (dayOffsets.size >= 512) dayOffsets.clear();
    dayOffsets.set(date, [...new Set(choices)]);
  }
  return dayOffsets.get(date).map(off => `${date}T${time}:00${off}`)
    .filter(iso => matches(Date.parse(iso), date, time))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null;
}
