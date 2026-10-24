/* Responsive variants for every photo in media/manifest.json.
 *
 * Reads each original from local/media-originals/ (never committed), checks its sha256 against
 * the manifest, and writes AVIF, WebP and JPEG at the fixed widths in src/render/media.mjs.
 * Encoded files are cached in local/media-cache/ under their final names, so a rebuild with no
 * new photos encodes nothing.
 *
 * A photo slot may also hold a link (src/render/media.mjs). buildLinks() fetches each linked photo
 * once into local/media-links/ — the link's sha256 names the file, with a .json record beside it —
 * and encodes it like a library photo. A machine that keeps local/ never fetches a link twice: to
 * pick up a changed photo at the same address there, delete its two files in local/media-links/.
 * A fresh build machine (Netlify) has no local/ and fetches every link on every build.
 *
 * A "derived:<id>" source is a floor map drawn by ops/room-map.mjs from the photo <id>. The build
 * draws it when its original is missing, and checks the drawing against the manifest's sha256.
 *
 *   node ops/media.mjs            # variants into dist/media/
 *   node ops/media.mjs --fetch    # first download any missing original from its source
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import url from "node:url";
import sharp from "sharp";
import { variantWidths, variantName, privateHost, photoHostOk } from "../src/render/media.mjs";
import { drawRoomMap, ROOM_MAPS } from "./room-map.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const ORIG = path.join(ROOT, "local", "media-originals");
const CACHE = path.join(ROOT, "local", "media-cache");
const LINKS = path.join(ROOT, "local", "media-links");
const MAX_BYTES = 25 * 1024 * 1024;
const FETCH_MS = 30000;
const MAX_HOPS = 5;
const QUALITY = { avif: 50, webp: 72, jpg: 76 };

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const DERIVED = "derived:";

function parentOf(item, items) {
  const parent = items.find((p) => p.id === item.source.slice(DERIVED.length));
  if (!parent) throw new Error(`${item.id}: its source ${item.source} names no photo in the manifest`);
  return parent;
}

export function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "media", "manifest.json"), "utf8"));
}

async function fetchOriginal(item) {
  if (item.source.startsWith(DERIVED)) throw new Error(`${item.id}: is drawn by ops/room-map.mjs, not downloaded`);
  // A drive: source is a cropped copy of a photo in the shared Drive, not a public file: there is
  // nothing to download, and the crop is what the sha256 records.
  if (item.source.startsWith("drive:")) throw new Error(`${item.id}: comes from the shared Drive (${item.source.slice(6)}). Copy and crop it from the synced Drive, then save it as local/media-originals/${item.localFile}`);
  const res = await fetch(item.source, { headers: { "User-Agent": "Mozilla/5.0 (BSS media fetch)", Referer: item.sourcePage } });
  if (!res.ok) throw new Error(`${item.id}: source answered ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256(buf) !== item.sha256) throw new Error(`${item.id}: downloaded file does not match the manifest's sha256 — the source photo changed; review it before updating the manifest`);
  fs.mkdirSync(ORIG, { recursive: true });
  fs.writeFileSync(path.join(ORIG, item.localFile), buf);
  return buf;
}

async function deriveOriginal(item, items, originalsDir) {
  const parent = parentOf(item, items), spec = ROOM_MAPS[item.localFile];
  if (spec?.from !== parent.localFile) throw new Error(`${item.id}: ops/room-map.mjs draws no ${item.localFile} from ${parent.localFile}`);
  const from = path.join(originalsDir, parent.localFile);
  const parentBuf = fs.existsSync(from) ? fs.readFileSync(from) : await fetchOriginal(parent);
  if (sha256(parentBuf) !== parent.sha256) throw new Error(`${parent.id}: local original does not match the manifest's sha256`);
  const { png } = await drawRoomMap(parentBuf, spec);
  if (sha256(png) !== item.sha256) throw new Error(`${item.id}: the map ops/room-map.mjs draws does not match the manifest's sha256 — the script changed; look at the new map before updating the manifest`);
  fs.mkdirSync(originalsDir, { recursive: true });
  fs.writeFileSync(path.join(originalsDir, item.localFile), png);
  return png;
}

/* Every variant of one photo into outDir, from the cache where it can; returns how many it encoded. */
async function encodeItem(item, buf, outDir, files, log, cacheDir = CACHE) {
  let encoded = 0;
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const w of variantWidths(item)) {
    for (const ext of ["avif", "webp", "jpg"]) {
      const name = variantName(item, w, ext);
      const cached = path.join(cacheDir, name);
      if (!fs.existsSync(cached)) {
        // sharp drops all metadata unless asked to keep it: no camera, place or device data ships
        let img = sharp(buf, { failOn: "error" }).rotate().resize({ width: w, withoutEnlargement: true });
        if (ext === "avif") img = img.avif({ quality: QUALITY.avif, effort: 4 });
        if (ext === "webp") img = img.webp({ quality: QUALITY.webp });
        if (ext === "jpg") img = img.flatten({ background: "#FAF7F2" }).jpeg({ quality: QUALITY.jpg, mozjpeg: true, progressive: true });
        await img.toFile(cached);
        encoded++;
        log(`encoded ${name}`);
      }
      fs.copyFileSync(cached, path.join(outDir, name));
      files.push({ id: item.id, name, width: w, ext, bytes: fs.statSync(cached).size });
    }
  }
  return encoded;
}

/* Every original a build cannot get, one line each with how to get it, before anything is encoded:
   a fresh copy of the site (no local/) learns the whole gap in one run, not one photo per run.
   A drive: original can never be fetched; a public one only when fetchMissing is set; a derived:
   one is drawn whenever its parent can be had. */
export function missingOriginals(items, { fetchMissing = false, originalsDir = ORIG } = {}) {
  const canGet = (item) => fs.existsSync(path.join(originalsDir, item.localFile))
    || (item.source.startsWith(DERIVED) ? canGet(parentOf(item, items)) : fetchMissing && !item.source.startsWith("drive:"));
  return items.filter((item) => !canGet(item))
    .map((item) => item.source.startsWith("drive:")
      ? `${item.id}: copy it from the synced Drive (${item.source.slice(6)}) to local/media-originals/${item.localFile}`
      : item.source.startsWith(DERIVED)
        ? `${item.id}: ops/room-map.mjs draws it from ${parentOf(item, items).id}, which is missing`
        : `${item.id}: run the build with --fetch-media, or copy local/media-originals/${item.localFile} from the laptop`);
}

/* Returns { files: [{ name, bytes }], encoded: n }. */
export async function buildMedia(outDir, { fetchMissing = false, log = () => {}, originalsDir = ORIG } = {}) {
  const manifest = loadManifest();
  const missing = missingOriginals(manifest.items, { fetchMissing, originalsDir });
  if (missing.length) throw new Error(`${missing.length} of ${manifest.items.length} photo originals are missing (docs/DESIGN.md, "Building away from the laptop"):\n  ${missing.join("\n  ")}`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  let encoded = 0;
  for (const item of manifest.items) {
    const src = path.join(originalsDir, item.localFile);
    const buf = fs.existsSync(src) ? fs.readFileSync(src)
      : item.source.startsWith(DERIVED) ? await deriveOriginal(item, manifest.items, originalsDir) : await fetchOriginal(item);
    if (sha256(buf) !== item.sha256) throw new Error(`${item.id}: local original does not match the manifest's sha256`);
    encoded += await encodeItem(item, buf, outDir, files, log);
  }
  return { files, encoded };
}

/* The address to fetch for a pasted link. A Google Drive file link is a viewer page, not a photo,
   so it becomes Drive's thumbnail address for that file (undocumented by Google, and the file must
   be shared as "Anyone with the link"). Everything else is fetched as pasted. */
export function fetchableUrl(link) {
  const u = new URL(link);
  if (/(^|\.)drive\.google\.com$/.test(u.hostname) || u.hostname === "docs.google.com") {
    if (/\/folders\//.test(u.pathname)) throw new Error(`${link} is a Drive folder; open the photo and copy its own link`);
    const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || u.searchParams.get("id");
    if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w2400`;
  }
  return link;
}

/* Redirects are followed one at a time so each address is checked before it is asked: a published
   build gives the pasted link's own rules (https, no private address, a host on PHOTO_HOSTS) to
   every address it is sent on to, or an allowed host could hand the fetch to any server. */
async function fetchLink(link, { production = false } = {}) {
  const signal = AbortSignal.timeout(FETCH_MS);
  let at = new URL(fetchableUrl(link)), res;
  for (let hop = 0; ; hop++) {
    res = await fetch(at, { redirect: "manual", signal, headers: { "User-Agent": "Mozilla/5.0 (BSS media fetch)" } });
    if (res.status < 300 || res.status > 399 || !res.headers.get("location")) break;
    await res.body?.cancel();
    if (hop === MAX_HOPS) throw new Error(`redirected more than ${MAX_HOPS} times`);
    at = new URL(res.headers.get("location"), at);
    const refused = !/^https?:$/.test(at.protocol) ? "is not a web address"
      : !production ? null
      : at.protocol !== "https:" ? "does not start with https://"
      : at.username || at.password ? "carries a user name or password"
      : privateHost(at.hostname) ? "is a private address"
      : !photoHostOk(at.hostname) ? `is on ${at.hostname}, which a published build does not fetch from` : null;
    if (refused) throw new Error(`redirected to ${/^https?:$/.test(at.protocol) ? at.origin : at.protocol}, which ${refused}`);
  }
  if (!res.ok) throw new Error(`answered ${res.status}`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) throw new Error(`is a ${type || "page"}, not a photo. Right-click the photo and copy its image address; for Google Drive, share the file as "Anyone with the link" and paste the file's link`);
  if (Number(res.headers.get("content-length")) > MAX_BYTES) throw new Error("is larger than 25 MB");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("is larger than 25 MB");
  return buf;
}

/* Fetch (once) and encode every linked photo.
   links: [{ id, link, alt, focal }] from photoRef(). Returns { items, files, encoded, fetched }, where
   items are manifest-shaped entries for the context, the stylesheet and the server. */
export async function buildLinks(links, outDir, { fetchMissing = false, production = false, log = () => {}, cacheDir = LINKS, encodeDir = CACHE } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const items = [], files = [];
  let encoded = 0, fetched = 0;
  for (const r of links) {
    const key = sha256(Buffer.from(r.link)).slice(0, 32);
    const img = path.join(cacheDir, `${key}.img`), rec = path.join(cacheDir, `${key}.json`);
    let buf;
    if (fs.existsSync(img)) buf = fs.readFileSync(img);
    else if (!fetchMissing) throw new Error(`photo link ${r.link} has not been fetched yet. Run: node ops/build.mjs --fetch-media`);
    else {
      try { buf = await fetchLink(r.link, { production }); } catch (e) { throw new Error(`photo link ${r.link} ${e.name === "TimeoutError" ? "did not answer in 30 seconds" : e.message}`); }
      fetched++;
      log(`fetched ${r.link}`);
    }
    let meta;
    try { meta = await sharp(buf, { failOn: "error" }).metadata(); } catch { throw new Error(`photo link ${r.link} is not a photo this build can read`); }
    const turned = (meta.orientation || 1) >= 5;
    const item = {
      id: r.id,
      link: r.link,
      width: turned ? meta.height : meta.width,
      height: turned ? meta.width : meta.height,
      sha256: sha256(buf),
      alt: r.alt,
      focal: r.focal || [50, 50],
    };
    if (!fs.existsSync(img)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(img, buf);
      fs.writeFileSync(rec, JSON.stringify({ link: r.link, fetched: new Date().toISOString(), sha256: item.sha256, width: item.width, height: item.height, format: meta.format }, null, 2) + "\n");
    }
    encoded += await encodeItem(item, buf, outDir, files, log, encodeDir);
    items.push(item);
  }
  return { items, files, encoded, fetched };
}

/* What a linked photo will look like to the renderer when photos are not being built (tests,
   --no-media): its cached record if there is one, otherwise a 4:3 placeholder. */
export function linkPlaceholders(links, { cacheDir = LINKS } = {}) {
  return links.map((r) => {
    const rec = path.join(cacheDir, `${sha256(Buffer.from(r.link)).slice(0, 32)}.json`);
    const m = fs.existsSync(rec) ? JSON.parse(fs.readFileSync(rec, "utf8")) : { width: 1600, height: 1200, sha256: "0".repeat(64) };
    return { id: r.id, link: r.link, width: m.width, height: m.height, sha256: m.sha256, alt: r.alt, focal: r.focal || [50, 50] };
  });
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const out = path.join(ROOT, "dist", "media");
  const r = await buildMedia(out, { fetchMissing: process.argv.includes("--fetch"), log: console.log });
  console.log(`${r.files.length} variants, ${r.encoded} newly encoded`);
}
