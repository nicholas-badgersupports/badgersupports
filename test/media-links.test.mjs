/* Swapping a photo by pasting a link: every slot takes a library id, a link, or { link, alt, focal }.
   The fetch tests talk only to a server this file starts on 127.0.0.1 — never the internet. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import sharp from "sharp";
import { ROOT } from "../ops/build.mjs";
import { buildLinks, fetchableUrl, linkPlaceholders } from "../ops/media.mjs";
import { photoRef, photoProblems, photoSlots, picture, linkId, photoHostOk } from "../src/render/media.mjs";
import { makeContext } from "../src/render/context.mjs";

const DIR = path.join(ROOT, "local", "test-build-links");
const LIB = new Set(["m-people-welcome"]);
let server, base;

test.before(async () => {
  fs.rmSync(DIR, { recursive: true, force: true });
  const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#b60000" } }).png().toBuffer();
  server = http.createServer((req, res) => {
    if (req.url === "/photo.png") return res.writeHead(200, { "Content-Type": "image/png" }).end(png);
    if (req.url === "/page") return res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><p>a page</p>");
    if (req.url === "/fake.jpg") return res.writeHead(200, { "Content-Type": "image/jpeg" }).end("not a photo");
    if (req.url === "/hop") return res.writeHead(302, { Location: "/photo.png" }).end();
    if (req.url === "/loop") return res.writeHead(302, { Location: "/loop" }).end();
    if (req.url === "/to-http") return res.writeHead(302, { Location: `${base}/photo.png` }).end();
    if (req.url === "/to-other") return res.writeHead(301, { Location: "https://example.org/a.jpg" }).end();
    if (req.url === "/to-private") return res.writeHead(307, { Location: "https://192.168.1.4/a.jpg" }).end();
    if (req.url === "/to-file") return res.writeHead(302, { Location: "file:///etc/hosts" }).end();
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("a slot holds a library id, a link, or a link with its description and focal point", () => {
  assert.deepEqual(photoRef("m-people-welcome"), { id: "m-people-welcome", link: null, alt: null, focal: null });
  const a = photoRef("https://example.org/a.jpg");
  assert.equal(a.link, "https://example.org/a.jpg");
  assert.match(a.id, /^l-[0-9a-f]{12}$/);
  assert.equal(photoRef("https://example.org/a.jpg").id, a.id, "the same link is the same photo");
  const b = photoRef({ link: "https://example.org/a.jpg", alt: "Two students painting", focal: [40, 30] });
  assert.equal(b.alt, "Two students painting");
  assert.deepEqual(b.focal, [40, 30]);
  assert.notEqual(b.id, a.id, "a different focal point is its own crop");
  assert.equal(b.id, linkId("https://example.org/a.jpg", [40, 30]));
  assert.equal(photoRef({ media: "m-x" }), null);
  assert.equal(photoRef(7), null);
});

test("the build names what is wrong with a photo slot", () => {
  const p = (ref, o = {}) => photoProblems(ref, { media: LIB, ...o });
  assert.deepEqual(p("m-people-welcome"), []);
  assert.deepEqual(p("https://example.org/a.jpg"), []);
  assert.match(p("m-nobody").join(), /not in media\/manifest\.json/);
  assert.match(p("http://example.org/a.jpg").join(), /must start with https/);
  assert.deepEqual(p("http://127.0.0.1:9/a.png"), [], "a local test server is allowed outside production");
  assert.match(p("http://127.0.0.1:9/a.png", { production: true }).join(), /https/);
  assert.match(p("https://192.168.1.4/a.jpg", { production: true }).join(), /private address/);
  assert.match(p("https://user:pw@example.org/a.jpg").join(), /user name or password/);
  assert.match(p("https://drive.google.com/drive/folders/abc123").join(), /Drive folder/);
  assert.match(p("https://drive.google.com/drive/u/1/folders/abc123").join(), /Drive folder/);
  assert.match(p({ link: "https://example.org/a.jpg", focal: [120, 5] }).join(), /focal/);
  assert.match(p({ link: "https://example.org/a.jpg", alt: 4 }).join(), /alt must be text/);
  assert.match(p({ media: "m-people-welcome" }).join(), /library id, a link/);
  assert.match(p("https://example.org/" + "a".repeat(2000)).join(), /2000/);
});

test("a published build takes a link only from Google Drive and the organisation's own sites", () => {
  const p = (ref) => photoProblems(ref, { media: LIB, production: true });
  for (const ok of ["https://drive.google.com/file/d/1AbC/view", "https://docs.google.com/uc?id=1AbC", "https://lh3.googleusercontent.com/d/1AbC",
    "https://lh7-us.googleusercontent.com/x", "https://badgersupports.org/a.jpg", "https://home.badgersupports.org/a.jpg",
    "https://supportbadgers.org/a.jpg", "https://badgerspill.org/a.jpg"]) assert.deepEqual(p(ok), [], ok);
  assert.match(p("https://example.org/a.jpg").join(), /is on example\.org, which a published build does not fetch from; put the photo in Google Drive/);
  for (const h of ["evilbadgersupports.org", "badgersupports.org.example.com", "googleusercontent.com.example.com", "drive.google.com.", "photos.google.com"]) assert.equal(photoHostOk(h), false, h);
  assert.deepEqual(photoProblems("https://example.org/a.jpg", { media: LIB }), [], "a laptop preview fetches from anywhere");
  assert.deepEqual(p("m-people-welcome"), [], "a library photo has no host");
  assert.equal(p("https://192.168.1.4/a.jpg").length, 1, "a private address is named once, not twice");
});

test("every photo slot in a record is found, wherever it sits", () => {
  const slots = photoSlots({
    photos: ["m-a", "https://example.org/b.jpg"],
    circles: [{ media: "m-c", label: "x" }, { media: { link: "https://example.org/d.jpg" } }],
    steps: [{ id: "s-1", photo: null }, { id: "s-2", photo: "m-e" }],
    events: [{ id: "e1", media: "m-f" }],
  });
  assert.deepEqual(slots.map((s) => s.at), ["photos[0]", "photos[1]", "circles[0].media", "circles[1].media", "steps[1].photo", "events[0].media"]);
});

test("a Drive file link is fetched from Drive's photo address; a folder is refused", () => {
  assert.equal(fetchableUrl("https://drive.google.com/file/d/1AbC_d-E/view?usp=sharing"), "https://drive.google.com/thumbnail?id=1AbC_d-E&sz=w2400");
  assert.equal(fetchableUrl("https://drive.google.com/open?id=1AbC"), "https://drive.google.com/thumbnail?id=1AbC&sz=w2400");
  assert.throws(() => fetchableUrl("https://drive.google.com/drive/folders/1INw"), /Drive folder/);
  assert.equal(fetchableUrl("https://example.org/a.jpg?x=1"), "https://example.org/a.jpg?x=1");
});

test("a linked photo is fetched once, then built from the copy kept in local/", async () => {
  const out = path.join(DIR, "dist", "media");
  const opts = { cacheDir: path.join(DIR, "links"), encodeDir: path.join(DIR, "cache") };
  const links = [photoRef({ link: `${base}/photo.png`, alt: "A red square", focal: [50, 20] })];
  await assert.rejects(buildLinks(links, out, opts), /has not been fetched yet/);

  const first = await buildLinks(links, out, { ...opts, fetchMissing: true });
  assert.equal(first.fetched, 1);
  assert.ok(first.encoded > 0);
  const [item] = first.items;
  assert.deepEqual([item.width, item.height, item.alt], [640, 480, "A red square"]);
  assert.deepEqual(item.focal, [50, 20]);
  for (const f of first.files) assert.ok(fs.existsSync(path.join(out, f.name)), f.name);
  const kept = fs.readdirSync(opts.cacheDir).sort();
  assert.equal(kept.length, 2);
  assert.ok(kept[0].endsWith(".img") && kept[1].endsWith(".json"));

  const again = await buildLinks(links, out, { ...opts, fetchMissing: true });
  assert.deepEqual([again.fetched, again.encoded], [0, 0]);
  assert.deepEqual(linkPlaceholders(links, { cacheDir: opts.cacheDir })[0].sha256, item.sha256);
});

test("a link that is not a photo is refused by name", async () => {
  const out = path.join(DIR, "dist2");
  const opts = { cacheDir: path.join(DIR, "links-bad"), encodeDir: path.join(DIR, "cache"), fetchMissing: true };
  await assert.rejects(buildLinks([photoRef(`${base}/page`)], out, opts), /\/page is a text\/html, not a photo/);
  await assert.rejects(buildLinks([photoRef(`${base}/missing.jpg`)], out, opts), /missing\.jpg answered 404/);
  await assert.rejects(buildLinks([photoRef(`${base}/fake.jpg`)], out, opts), /fake\.jpg is not a photo this build can read/);
  assert.equal(fs.existsSync(opts.cacheDir) ? fs.readdirSync(opts.cacheDir).length : 0, 0, "nothing refused is kept");
});

test("a redirect is followed one hop at a time, and a published build checks every hop", async () => {
  const out = path.join(DIR, "dist3");
  const opts = { cacheDir: path.join(DIR, "links-hops"), encodeDir: path.join(DIR, "cache"), fetchMissing: true };
  const [item] = (await buildLinks([photoRef(`${base}/hop`)], out, opts)).items;
  assert.deepEqual([item.width, item.height], [640, 480], "a relative redirect is followed");
  await assert.rejects(buildLinks([photoRef(`${base}/loop`)], out, opts), /redirected more than 5 times/);
  await assert.rejects(buildLinks([photoRef(`${base}/to-file`)], out, opts), /redirected to file:, which is not a web address/);
  const prod = { ...opts, cacheDir: path.join(DIR, "links-hops-prod"), production: true };
  await assert.rejects(buildLinks([photoRef(`${base}/to-http`)], out, prod), /redirected to http:\/\/127\.0\.0\.1:\d+, which does not start with https/);
  await assert.rejects(buildLinks([photoRef(`${base}/to-other`)], out, prod), /redirected to https:\/\/example\.org, which is on example\.org/);
  await assert.rejects(buildLinks([photoRef(`${base}/to-private`)], out, prod), /which is a private address/);
  assert.equal(fs.existsSync(prod.cacheDir) ? fs.readdirSync(prod.cacheDir).length : 0, 0, "nothing refused is kept");
});

test("without photos being built, a link renders from a placeholder and reads its fallback description", () => {
  const links = [photoRef("https://example.org/never-fetched.jpg")];
  const [ph] = linkPlaceholders(links, { cacheDir: path.join(DIR, "none") });
  assert.deepEqual([ph.width, ph.height], [1600, 1200]);
  const ctx = makeContext({ site: {}, media: { items: [ph] }, text: { "media.linkAlt": "A photo from a Badger Supports event." } });
  const out = String(picture(ctx, "https://example.org/never-fetched.jpg", { sizes: "100vw" }));
  assert.match(out, /alt="A photo from a Badger Supports event\."/);
  assert.match(out, new RegExp(`class="media-${ph.id}"`));
  assert.throws(() => picture(ctx, "https://example.org/other.jpg", { sizes: "100vw" }), /was not fetched/);
});
