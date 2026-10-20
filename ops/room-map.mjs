/* Floor maps for rooms the live site has no map for, drawn from one it has.
 *
 * The live SAC Caucus directions page shows the SAC 4th-floor plan with the Caucus Room in orange.
 * The same plan already labels the Hearing Room (4201) and the Multi-Purpose Room (4213), so each of
 * those rooms gets its own copy of the plan with the orange moved onto it (owner, 20 Oct 2026: "edit
 * the image of the map to show where the rooms are"). Nothing is drawn from a guess: the room is the
 * grey area the plan itself draws around the seed point, and the run stops if that area is not the
 * size the spec below expects.
 *
 *   node ops/room-map.mjs     # writes every map below into local/media-originals/ and prints its sha256
 *
 * ops/media.mjs calls drawRoomMap() itself for a manifest item whose source is "derived:<parent id>"
 * and whose original is missing, so a fresh machine needs no extra step.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import url from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const ORIG = path.join(ROOT, "local", "media-originals");

// Measured on the live plan (1280 × 766): rooms are flat grey, walls black, and the one marked room
// is flat orange. No other pixel on the plan carries colour.
const ROOM = 209, LABEL = 240, MARK = [247, 147, 29];
const MARKED = [358, 486, 506, 726]; // the Caucus Room's orange, 3 px wider all round

/* Output file → the parent original, a point inside the room, and the box the room must fill. */
export const ROOM_MAPS = {
  "room-sac-hearing-map.png": { from: "room-sac-4th-floor-map.png", seed: [580, 700], room: [507, 481, 648, 723] },
  "room-sac-multipurpose-map.png": { from: "room-sac-4th-floor-map.png", seed: [100, 700], room: [16, 481, 206, 723] },
};

const clamp = (v) => Math.max(0, Math.min(1, v));

export async function drawRoomMap(parentBuf, spec) {
  const { data, info } = await sharp(parentBuf, { failOn: "error" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = Buffer.from(data);
  const at = (x, y) => (y * W + x) * 3;

  // 1. Take the orange off the Caucus Room. A pixel there is a mix of orange and one grey (room, wall
  //    or label), and r − b says how much orange: put grey room in its place, and fade the label to
  //    the faint grey every other room's label has. A label's soft edge works out a little darker
  //    than the room, and would leave a dark rim round each letter: only a wall's edge stays dark.
  for (let y = MARKED[1]; y <= MARKED[3]; y++) for (let x = MARKED[0]; x <= MARKED[2]; x++) {
    const i = at(x, y), a = clamp((px[i] - px[i + 2]) / (MARK[0] - MARK[2]));
    if (!a) { px[i] = px[i + 1] = px[i + 2] = Math.round((px[i] + px[i + 1] + px[i + 2]) / 3); continue; } // the walls' blue-grey fringe
    let under = a > 0.98 ? ROOM : (px[i + 2] - a * MARK[2]) / (1 - a); // the grey under the orange
    if (under > ROOM) under = ROOM + (under - ROOM) * (LABEL - ROOM) / (255 - ROOM);
    else if (under > 150) under = ROOM;
    px[i] = px[i + 1] = px[i + 2] = Math.round(a * ROOM + (1 - a) * under);
  }

  // 2. The room: every room-grey pixel joined to the seed.
  const lum = (x, y) => px[at(x, y)];
  const inRoom = new Uint8Array(W * H);
  const stack = [spec.seed];
  let [x0, y0, x1, y1] = [W, H, 0, 0];
  if (Math.abs(lum(...spec.seed) - ROOM) > 6) throw new Error(`seed ${spec.seed} is not on a room`);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H || inRoom[y * W + x] || Math.abs(lum(x, y) - ROOM) > 6) continue;
    inRoom[y * W + x] = 1;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const box = [x0, y0, x1, y1];
  if (box.some((v, k) => Math.abs(v - spec.room[k]) > 4)) throw new Error(`the room around ${spec.seed} spans ${box}, not ${spec.room}: the plan changed or the fill leaked`);

  // 3. Its label and anything else drawn inside it: whatever the outside of the box cannot reach.
  const outside = new Uint8Array(W * H);
  const edge = [];
  for (let x = x0; x <= x1; x++) edge.push([x, y0], [x, y1]);
  for (let y = y0; y <= y1; y++) edge.push([x0, y], [x1, y]);
  while (edge.length) {
    const [x, y] = edge.pop();
    if (x < x0 || y < y0 || x > x1 || y > y1 || outside[y * W + x] || inRoom[y * W + x]) continue;
    outside[y * W + x] = 1;
    edge.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const area = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!outside[y * W + x]) area[y * W + x] = 1;

  // 4. Two pixels out into the wall's soft edge, never into the corridor's white.
  for (let step = 0; step < 2; step++) {
    const add = [];
    for (let y = Math.max(1, y0 - 2); y <= Math.min(H - 2, y1 + 2); y++) for (let x = Math.max(1, x0 - 2); x <= Math.min(W - 2, x1 + 2); x++) {
      const k = y * W + x;
      if (!area[k] && lum(x, y) < ROOM - 6 && (area[k - 1] || area[k + 1] || area[k - W] || area[k + W])) add.push(k);
    }
    for (const k of add) area[k] = 1;
  }

  // 5. Orange in: room grey becomes orange, black stays black, and the label goes white as the
  //    Caucus Room's is.
  for (let k = 0; k < W * H; k++) {
    if (!area[k]) continue;
    const i = k * 3, v = px[i];
    for (let c = 0; c < 3; c++) {
      px[i + c] = v >= ROOM
        ? Math.round(MARK[c] + clamp((v - 215) / (LABEL - 215)) * (255 - MARK[c]))
        : Math.round(v + clamp(v / (ROOM - 6)) * (MARK[c] - ROOM));
    }
  }
  return { png: await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer(), box };
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  for (const [out, spec] of Object.entries(ROOM_MAPS)) {
    const { png, box } = await drawRoomMap(fs.readFileSync(path.join(ORIG, spec.from)), spec);
    fs.writeFileSync(path.join(ORIG, out), png);
    console.log(`${out}: room ${box}, ${png.length} bytes, sha256 ${crypto.createHash("sha256").update(png).digest("hex")}`);
  }
}
