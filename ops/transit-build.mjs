/* Refresh the bus page's data from Madison Metro's current GTFS.
 *
 *   node ops/transit-build.mjs
 *
 * Downloads the static feed (https://transitdata.cityofmadison.com/GTFS/mmt_gtfs.zip)
 * and rewrites the two artifacts ops/transit.mjs builds from it:
 * content/transit/transit-data.json for the visitor's browser, and
 * content/transit/schedule.json for the site's own function, which merges it
 * with Metro's live GTFS-RT feeds. Run it each Metro schedule period — the
 * feed's own start and end dates are written into both files, the page prints
 * them in its credit line, and a feed whose end date has passed is the sign
 * this run is owed. docs/research/EXPLORE-TRANSIT-VERIFICATION-2026-11-11.md
 * records the licence the data is used under. */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import { buildTransitData } from "./transit.mjs";
import { isDirect } from "./direct.mjs";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const GTFS_URL = "https://transitdata.cityofmadison.com/GTFS/mmt_gtfs.zip";

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

export async function refreshTransit({ fetchImpl = fetch, dir = path.join(ROOT, "content/transit") } = {}) {
  const res = await fetchImpl(GTFS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`the GTFS download answered ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const files = {
    stopsTxt: unzipText(buf, "stops.txt"), routesTxt: unzipText(buf, "routes.txt"),
    tripsTxt: unzipText(buf, "trips.txt"), stopTimesTxt: unzipText(buf, "stop_times.txt"),
    shapesTxt: unzipText(buf, "shapes.txt"), calendarTxt: unzipText(buf, "calendar.txt"),
    calendarDatesTxt: unzipText(buf, "calendar_dates.txt"), feedInfoTxt: unzipText(buf, "feed_info.txt"),
  };
  const panels = JSON.parse(fs.readFileSync(path.join(dir, "panels.json"), "utf8")).panels;
  const { client, schedule } = buildTransitData({ ...files, panels });
  const downloaded = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "transit-data.json"), JSON.stringify({ downloaded, ...client }) + "\n");
  fs.writeFileSync(path.join(dir, "schedule.json"), JSON.stringify({ downloaded, ...schedule }) + "\n");
  return { client, schedule };
}

/* isDirect compares real paths: compared as written, an invocation through a link (a worktree alias,
   macOS's temporary folder) never matched the module's own address, and the command silently did
   nothing — the failure ops/deps-match.mjs's note records for its own check. */
if (isDirect(import.meta.url)) {
  const { client, schedule } = await refreshTransit();
  console.log(`transit: ${client.routes.length} routes (${client.routes.filter((r) => r.campus).length} campus), ${client.stops.length} stops, ${schedule.patterns.length} patterns, ${schedule.trips.length} trips, feed ${client.feed.version} (${client.feed.start} to ${client.feed.end})`);
}
