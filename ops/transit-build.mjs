/* Refresh the Bus Route Explorer's topology from Madison Metro's current GTFS.
 *
 *   node ops/transit-build.mjs
 *
 * Downloads the static feed (https://transitdata.cityofmadison.com/GTFS/mmt_gtfs.zip), reads the
 * four files the topology needs, and rewrites content/transit/topology.json. Run it each Metro
 * schedule period; the feed's own start and end dates are written into the file it produces, and
 * docs/research/EXPLORE-TRANSIT-VERIFICATION-2026-11-11.md records the licence it is used under.
 * Only route→stop membership and stop names/coordinates are kept: no times enter the site's data.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import { buildTopology } from "./transit.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const GTFS_URL = "https://transitdata.cityofmadison.com/GTFS/mmt_gtfs.zip";
const WANT = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt", "feed_info.txt"];

/* Just enough ZIP to read a GTFS copy: stored and deflated entries, found by the central
 * directory at the end of the file. */
export function unzipText(buf, name) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) break;
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const entryName = buf.toString("utf8", at + 46, at + 46 + nameLen);
    if (entryName === name) {
      const lNameLen = buf.readUInt16LE(localAt + 26);
      const lExtraLen = buf.readUInt16LE(localAt + 28);
      const dataAt = localAt + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataAt, dataAt + size);
      if (method === 0) return raw.toString("utf8");
      if (method === 8) return zlib.inflateRawSync(raw).toString("utf8");
      throw new Error(`zip entry ${name} uses method ${method}`);
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip has no ${name}`);
}

export async function refreshTopology({ fetchImpl = fetch, out = path.join(ROOT, "content/transit/topology.json") } = {}) {
  const res = await fetchImpl(GTFS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`the GTFS download answered ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const files = {};
  for (const name of WANT) files[`${name.replace(".txt", "")}Txt`] = unzipText(buf, name);
  const topology = buildTopology({ stopsTxt: files.stopsTxt, routesTxt: files.routesTxt, tripsTxt: files.tripsTxt, stopTimesTxt: files.stop_timesTxt, feedInfoTxt: files.feed_infoTxt });
  const out_data = { schema: "bss.transit-topology/1", downloaded: new Date().toISOString().slice(0, 10), credit: "Data provided under license granted by City of Madison, WI, Metro Transit.", ...topology };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(out_data) + "\n");
  return out_data;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const t = await refreshTopology();
  console.log(`topology: ${t.routes.length} routes, ${t.stops.length} stops, feed ${t.feed.version} (${t.feed.start} to ${t.feed.end})`);
}
