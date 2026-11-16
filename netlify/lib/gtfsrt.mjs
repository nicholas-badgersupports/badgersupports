/* GTFS-RT, read by hand. Madison Metro publishes its live feeds (Trip Updates,
 * Vehicle Positions, Alerts) as protocol-buffer messages
 * (https://metromap.cityofmadison.com/gtfsrt/trips, /vehicles, /alerts) under
 * the City's developer licence (docs/research/EXPLORE-TRANSIT-VERIFICATION-2026-11-11.md
 * and TRANSIT-API-RESEARCH-2026-11-15.md). The site needs a few dozen fields of
 * the format, so this decodes just those, field number by field number, with no
 * dependency: a generic wire walker, then one small reader per message.
 *
 * What comes out is plain data:
 *   { timestamp, tripUpdates: [{ tripId, routeId, dir, relationship, delay,
 *       stops: [{ stopId, seq, arrivalDelay, arrivalTime, departureDelay,
 *       departureTime, relationship }] }],
 *     vehicles: [{ tripId, routeId, dir, lat, lon, bearing, vehicleId, timestamp }],
 *     alerts: [{ routes, stops, header, description, url, effect }] }
 * A relationship is the feed's own enum number (TripDescriptor: 3 is CANCELED;
 * StopTimeUpdate: 1 is SKIPPED). A delay is seconds, signed; a time is unix
 * seconds. A field the feed did not send stays null — never a guess.
 *
 * Metro's feed speaks two dialects of the format, both read here (measured on
 * the live feed, 15 Nov 2026): its stop_time_update messages ride at TripUpdate
 * field 2 where the published format puts them at field 3 — a candidate at
 * either number counts as a stop update only when it is shaped like one (a
 * varint sequence and a stop id), so a vehicle descriptor at field 2 is never
 * mistaken for one — and its alerts carry the title at field 10 and the body at
 * field 11, where the published format puts them at 9 and 10; the title is the
 * first of 9/10 the feed sent, the body the other one, or field 11's. Its stop
 * times are absolute times, not delays. */

/* A varint, accumulated as a BigInt: a negative int32 delay travels sign-extended
 * to 64 bits, a value a double cannot hold exactly, and its low bits are the
 * delay itself. Callers convert with num/snum once the sign is settled. */
function varint(buf, i) {
  let v = 0n, shift = 0n;
  while (i < buf.length) {
    const b = buf[i++];
    v |= BigInt(b & 0x7f) << shift;
    if (!(b & 0x80)) return [v, i];
    shift += 7n;
    if (shift > 63n) throw new Error("gtfsrt: a varint runs too long");
  }
  throw new Error("gtfsrt: a varint runs off the end");
}

/* One message as a list of { n, wt, v }: v is a number for a varint, a Buffer
 * for a length-delimited field, a float for a 32-bit field. */
function fields(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    let tag;
    [tag, i] = varint(buf, i);
    const n = Number(tag >> 3n), wt = Number(tag & 7n);
    if (wt === 0) { let v; [v, i] = varint(buf, i); out.push({ n, wt, v }); }
    else if (wt === 2) { let len; [len, i] = varint(buf, i); len = Number(len); out.push({ n, wt, v: buf.subarray(i, i + len) }); i += len; }
    else if (wt === 5) { out.push({ n, wt, v: buf.readFloatLE(i) }); i += 4; }
    else if (wt === 1) { out.push({ n, wt, v: Number(buf.readBigInt64LE(i)) }); i += 8; }
    else throw new Error(`gtfsrt: wire type ${wt} is not one this reader follows`);
  }
  return out;
}

const first = (fs, n) => fs.find((f) => f.n === n)?.v;
const all = (fs, n) => fs.filter((f) => f.n === n).map((f) => f.v);
const str = (fs, n) => { const v = first(fs, n); return v == null ? null : Buffer.from(v).toString("utf8"); };
const num = (fs, n) => { const v = first(fs, n); return v == null ? null : typeof v === "bigint" ? Number(v) : v; };
/* A signed field sent as a varint (delays): GTFS-RT encodes StopTimeEvent.delay
 * as int32, which travels as a plain two's-complement varint sign-extended to
 * 64 bits, not zigzag. A raw value at or above 2^63 is that negative. */
const snum = (fs, n) => { const v = first(fs, n); return v == null ? null : Number(v >= (1n << 63n) ? v - (1n << 64n) : v); };

function tripDescriptor(buf) {
  if (!buf) return {};
  const fs = fields(buf);
  return { tripId: str(fs, 1), routeId: str(fs, 5), dir: num(fs, 6), relationship: num(fs, 4) };
}

function stopTimeEvent(buf) {
  if (!buf) return {};
  const fs = fields(buf);
  return { delay: snum(fs, 1), time: num(fs, 2) };
}

function translated(buf) {
  if (!buf) return null;
  const en = all(fields(buf), 1).map((t) => { const fs = fields(t); return { text: str(fs, 1), lang: str(fs, 2) }; });
  const pick = en.find((t) => !t.lang || t.lang.startsWith("en")) || en[0];
  return pick?.text ?? null;
}

export function decodeFeed(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const top = fields(buf);
  const header = fields(first(top, 1) || Buffer.alloc(0));
  const out = { timestamp: num(header, 3), tripUpdates: [], vehicles: [], alerts: [] };
  for (const entityBuf of all(top, 2)) {
    const e = fields(entityBuf);
    const tu = first(e, 3), veh = first(e, 4), alert = first(e, 5);
    if (tu) {
      const fs = fields(tu);
      const trip = tripDescriptor(first(fs, 1));
      /* Stop updates at field 3 (the published format) or field 2 (Metro's):
       * a candidate counts only when it is shaped like one — a varint stop
       * sequence and a stop id — so the vehicle descriptor the format puts at
       * field 2 (string fields) is never read as a stop. */
      const stopBufs = [...all(fs, 3), ...all(fs, 2)].filter((s) => {
        const sf = fields(s);
        return sf.some((f) => f.n === 1 && f.wt === 0) && sf.some((f) => f.n === 4 && f.wt === 2);
      });
      out.tripUpdates.push({
        ...trip,
        delay: snum(fs, 5),
        stops: stopBufs.map((s) => {
          const sf = fields(s);
          const arr = stopTimeEvent(first(sf, 2));
          const dep = stopTimeEvent(first(sf, 3));
          return {
            stopId: str(sf, 4), seq: num(sf, 1),
            arrivalDelay: arr.delay ?? null, arrivalTime: arr.time ?? null,
            departureDelay: dep.delay ?? null, departureTime: dep.time ?? null,
            relationship: num(sf, 5),
          };
        }),
      });
    } else if (veh) {
      const fs = fields(veh);
      const trip = tripDescriptor(first(fs, 1));
      const pos = first(fs, 2) ? fields(first(fs, 2)) : [];
      const vd = first(fs, 8) ? fields(first(fs, 8)) : [];
      out.vehicles.push({
        ...trip,
        lat: num(pos, 1), lon: num(pos, 2), bearing: num(pos, 3),
        vehicleId: str(vd, 1), timestamp: num(fs, 5),
      });
    } else if (alert) {
      const fs = fields(alert);
      const routes = [], stops = [];
      for (const selBuf of all(fs, 5)) {
        const sel = fields(selBuf);
        const r = str(sel, 2); if (r) routes.push(r);
        const s = str(sel, 5); if (s) stops.push(s);
        const t = tripDescriptor(first(sel, 4));
        if (t.routeId) routes.push(t.routeId);
      }
      const at9 = translated(first(fs, 9)), at10 = translated(first(fs, 10)), at11 = translated(first(fs, 11));
      out.alerts.push({
        routes: [...new Set(routes)], stops: [...new Set(stops)],
        header: at9 ?? at10, description: at11 ?? (at9 != null ? at10 : null),
        url: translated(first(fs, 8)),
        effect: num(fs, 7),
      });
    }
  }
  return out;
}
