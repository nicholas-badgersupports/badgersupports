/* Wall of Support notes, pulled from the wall's own Google Sheet.
 *
 *   node ops/wall-notes.mjs     pull the sheet's shown notes and rewrite content/fixtures/wall-notes.json
 *
 * The source is the Google Sheet the Wall of Support has always read: "WEB Tech
 * Dashboard" (Badger Supports shared drive, spreadsheet id
 * 1dc9UDIoHrRY-ggkLVMRIQ9MX6K8w45Mzn38tAhAr2Wo), tab "Notes". The old Google Sites
 * wall read it through the sheet's own Apps Script web app (see the
 * wallofsupportembed files in the shared drive; one sheet and one deployment also
 * serve the mood check-in widget, whose Log, Presets and Settings tabs are the
 * other tabs of the same workbook). The Notes tab has two columns, Note and Show;
 * a row whose Show reads "No" is hidden, and the web app answers only the shown
 * notes, in sheet order. This pull reads that same answer, so what lands here is
 * exactly what the sheet shows. The 2026-11-12 import was cross-checked against a
 * direct export of the sheet: 55 notes, identical in order and wording.
 *
 * Wording is never altered: a note is written exactly as the sheet holds it. A
 * note that is empty, longer than 280 characters, or an exact repeat of another
 * stops the pull and is reported (the site leaves such notes out of Connect's
 * export on the same rules — ops/connect-feed.mjs, mapWall). The file is written
 * only from a complete, checked answer, so the last good list stays.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { isDirect } from "./direct.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "content/fixtures/wall-notes.json");
const FEED = "https://script.google.com/macros/s/AKfycbxOWoKOECxZBcSb3arMnfidHdaWlTLXzr70D5KHEtbIGPnxN7TqmpUwtPYWL4ezasClcQ/exec";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX = 280;

const chicagoDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());

export function wallProblems(notes) {
  const problems = [];
  if (!Array.isArray(notes) || !notes.length) return ["the answer carries no notes list"];
  const seen = new Set();
  notes.forEach((n, i) => {
    if (typeof n !== "string" || !n.trim()) problems.push(`notes[${i}] is empty or not words`);
    else if (n.length > MAX) problems.push(`notes[${i}] is ${n.length} characters, over the ${MAX} a note may be`);
    else if (seen.has(n)) problems.push(`notes[${i}] repeats an earlier note word for word`);
    seen.add(n);
  });
  return problems;
}

export function wallFile(notes, day) {
  return {
    schema: "bss.wall-fixture/1",
    fixture: false,
    provenance: `ops/wall-notes.mjs, ${day}: the shown notes of the "Notes" tab of "WEB Tech Dashboard" (Google Sheets, Badger Supports shared drive, id 1dc9UDIoHrRY-ggkLVMRIQ9MX6K8w45Mzn38tAhAr2Wo), read through the sheet's own Apps Script web app — the list the Wall of Support has always read. A row whose Show column reads "No" is hidden and never sent; wording is unchanged.`,
    sourceUpdatedAt: day,
    notes,
    label: null,
  };
}

async function pull() {
  const res = await fetch(FEED, { headers: { "user-agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`the sheet's web app answered ${res.status}`);
  const data = await res.json();
  const problems = wallProblems(data?.notes);
  if (problems.length) throw new Error(`the pull is not usable:\n  ${problems.join("\n  ")}`);
  const file = wallFile(data.notes, chicagoDay());
  fs.writeFileSync(FILE, JSON.stringify(file, null, 2) + "\n");
  console.log(`wall notes: pulled ${data.notes.length} shown notes from the "Notes" tab of "WEB Tech Dashboard"; wrote content/fixtures/wall-notes.json`);
}

if (isDirect(import.meta.url)) {
  pull().catch((e) => { console.error(`wall notes: ${e.message}`); process.exit(1); });
}
