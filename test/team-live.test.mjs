/* Real-handler export -> signed public reader -> runtime pages. The optional sibling fixture is
   produced by Connect's suite_public.mjs, not a hand-written substitute. Runtime mutations below
   remain fictional. The isolated two-repository run supplies the fixture and must not skip it. */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { build, ROOT } from "../ops/build.mjs";
import { mapTeam, readConnectFeed, readFeedRules } from "../ops/connect-feed.mjs";
import { useConnect, sha256Hex } from "../netlify/lib/connect.mjs";
import { useContent } from "../netlify/lib/content.mjs";
import { useDist, handlePage, previewResponse, PAGE_CACHE } from "../netlify/lib/pages.mjs";
import { teamPhoto, publicUpload } from "../netlify/lib/live-team.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { freshPglite, useAdapter, q } from "../netlify/lib/db.mjs";
import { memoryStore, useStore, usePurger } from "../netlify/lib/published.mjs";
import { emptyStructure } from "../src/shared/structure.mjs";

const FIXTURE_FILE = process.env.CONNECT_TEAM_FIXTURE || path.resolve(ROOT, "../connect-team-fixture.json");
const REAL = fs.existsSync(FIXTURE_FILE) ? JSON.parse(fs.readFileSync(FIXTURE_FILE, "utf8")) : null;
const ID = "p" + "a".repeat(24), VERSION = "b".repeat(32);
const FALLBACK = { ok: true, schema: "bss.team/1", people: [{ id: ID, slug: "fictional-person", name: "Fictional Person", group: "staff", bio: [], published: true }] };
const BASE = REAL || FALLBACK;
const RULES = readFeedRules(ROOT);
const RESOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fixtures/resources.json"), "utf8")).resources;
const OUT = path.join(ROOT, "local/test-build-live-team");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9l8AAAAASUVORK5CYII=", "base64");
let reply = structuredClone(BASE), down = false, photoKind = "ok", photoBytes = PNG, calls = [], photoCalls = [];
const cfg = {
  url: "https://home.badgersupports.org", keyId: "fictional-team-key", secret: "fictional-public-team-secret-32-chars-long",
  fetch: async (href, init) => {
    const u = new URL(href);
    assert.equal(u.origin, cfg.url);
    if (u.pathname.startsWith("/p/")) {
      photoCalls.push({ href, init });
      if (photoKind === "unavailable") throw new Error("fictional photo source unavailable");
      assert.equal(init.redirect, "manual");
      if (photoKind === "redirect") return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
      if (photoKind === "svg") return new Response("<svg></svg>", { headers: { "content-type": "image/svg+xml" } });
      if (photoKind === "large") return new Response(PNG, { headers: { "content-type": "image/png", "content-length": String(5 * 1024 * 1024) } });
      if (photoKind === "false-raster") return new Response("<html>not an image</html>", { headers: { "content-type": "image/png" } });
      if (photoKind === "stream-large") return new Response(new Uint8Array(5 * 1024 * 1024), { headers: { "content-type": "image/png" } });
      const p = reply.people.find((p) => p.id === u.pathname.slice(3) && p.published && p.photo);
      if (!p) return new Response(null, { status: 404 });
      return new Response(photoBytes, { headers: { "content-type": "image/png" } });
    }
    assert.equal(u.pathname, "/api");
    assert.equal(init.method, "POST");
    const h = new Headers(init.headers);
    const base = `${h.get("x-public-timestamp")}\n${h.get("x-public-nonce")}\nPOST\n/api\n${crypto.createHash("sha256").update(init.body).digest("hex")}`;
    assert.equal(h.get("x-public-signature"), crypto.createHmac("sha256", cfg.secret).update(base).digest("base64url"));
    const { action } = JSON.parse(init.body); calls.push(action);
    if (down && action === "publicTeam") throw new Error("fictional upstream unavailable");
    const response = action === "publicTeam" ? reply : action === "publicEvents" ? { ok: true, schema: 1, events: [], weekly: [], today: "2026-11-03", tz: "America/Chicago" }
      : action === "publicResourceExport" ? { ok: true, schema: 1, resources: RESOURCES } : { ok: true, schema: "bss.wall/1", notes: [] };
    return new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } });
  },
};
await build({ production: true, connectConfig: cfg, out: OUT, serverDir: path.join(OUT, "_server"), media: true, today: "2026-11-03" });
const SERVER = JSON.parse(fs.readFileSync(path.join(OUT, "_server/server.json"), "utf8"));
const db = await freshPglite();
useAdapter(db);
after(async () => { useConnect(null); usePurger(null); await db.end(); });
function reset() {
  reply = structuredClone(BASE); down = false; photoKind = "ok"; photoBytes = PNG; calls = []; photoCalls = [];
  useConnect(cfg); useContent(SERVER); useDist(OUT); useStore(memoryStore());
}
const visit = (p) => handlePage(new Request(`http://site.test${p}`), { today: "2026-11-03" });

test("real Connect handler export passes through the signed public reader and renders complete and incomplete people", { skip: !REAL && "Set CONNECT_TEAM_FIXTURE to the real-handler fixture" }, async () => {
  reset();
  assert.ok(REAL.people.some((p) => !p.name && !p.title && !p.role), "real export includes an unfinished account");
  const feed = await readConnectFeed(cfg, RULES);
  assert.equal(feed.problem, undefined);
  assert.equal(feed.team.people.length, REAL.people.length);
  const response = await visit("/about/our-team/");
  assert.equal(response.status, 200);
  const body = await response.text();
  for (const p of REAL.people) assert.match(body, new RegExp(`/about/our-team/${p.slug}/`));
  assert.match(body, /Team Member/);
  assert.doesNotMatch(body, /undefined|null|payrollSlot|workdayId|public_profile_settings/);
  assert.match(body, /src="\/api\/team-photo\/p[0-9a-f]{24}\?v=[0-9a-f]{32}"/);
  assert.doesNotMatch(body, /src="https:\/\/home\.badgersupports\.org/);
});

test("production artifacts contain no baked names, individual routes, aliases or profile media", () => {
  reset();
  for (const file of fs.readdirSync(OUT, { recursive: true, withFileTypes: true }).filter((d) => d.isFile())) {
    const full = path.join(file.parentPath ?? file.path, file.name);
    const value = fs.readFileSync(full, "utf8");
    for (const p of BASE.people) {
      if (p.name) assert.ok(!value.includes(p.name), path.relative(OUT, full));
      assert.ok(!value.includes(p.slug), path.relative(OUT, full));
      assert.ok(!full.includes(p.slug), "no downloadable person file");
    }
  }
  assert.deepEqual(SERVER.render.team.people, []);
  assert.deepEqual(SERVER.render.data.team.people, []);
});

test("after-build edits, new profiles, missing details, opt-outs and removal change routes and links without a rebuild", async () => {
  reset();
  const p = reply.people.find((p) => p.name), url = `/about/our-team/${p.slug}/`;
  assert.match(await (await visit(url)).text(), new RegExp(p.name));
  p.name = "Changed Fictional Name"; delete p.title; delete p.role; p.bio = [];
  let body = await (await visit(url)).text();
  assert.match(body, /Changed Fictional Name/);
  assert.doesNotMatch(body, /class="person-title"|undefined| is  at/);
  reply.people.push({ id: ID, slug: "added-after-build", group: "staff", bio: [], published: true });
  body = await (await visit("/about/our-team/")).text();
  assert.match(body, /href="\/about\/our-team\/added-after-build\/"/);
  assert.equal((await visit("/about/our-team/added-after-build/")).status, 200);
  assert.match(await (await visit("/about/our-team/added-after-build/")).text(), /<h1[^>]*>Team Member<\/h1>/);
  p.aliases = [["/about", "our-team", "directors", "old-fictional-address"].join("/")];
  const alias = await visit(p.aliases[0]);
  assert.equal(alias.status, 301);
  assert.equal(alias.headers.get("location"), url);
  assert.doesNotMatch(fs.readFileSync(path.join(OUT, "_redirects"), "utf8"), /\/about\/our-team\/directors\/\*/,
    "Netlify cannot intercept a live alias before the page function checks it");
  p.published = false;
  assert.equal((await visit(url)).status, 404);
  assert.doesNotMatch(await (await visit("/about/our-team/")).text(), /Changed Fictional Name/);
  reply.people = reply.people.filter((p) => p.slug !== "added-after-build");
  assert.equal((await visit("/about/our-team/added-after-build/")).status, 404);
  assert.ok(calls.filter((x) => x === "publicTeam").length >= 8, "each origin draw reads current eligibility; no warm team cache");
});

test("malformed individual data and unsafe optional fields do not break another eligible person", async () => {
  reset();
  reply.people.push({ id: "bad", slug: "../unsafe", group: "staff", bio: [], published: true });
  const p = reply.people[0]; p.phone = "PRIVATE-FIELD-NEVER-DISPLAY"; p.contact = ["private", "not-public.invalid"].join("@");
  p.photo = { url: "https://evil.invalid/tracker.png" };
  const response = await visit("/about/our-team/");
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, new RegExp(p.slug));
  assert.doesNotMatch(body, /unsafe|PRIVATE-FIELD|not-public|evil\.invalid/);
  p.photo = { url: "javascript:private" };
  assert.match(await (await visit("/about/our-team/")).text(), new RegExp(p.slug), "an unusable optional photo does not suppress an eligible person");
});

test("a canonical profile always wins over another person's alias, and duplicate aliases choose nobody", async () => {
  reset();
  reply.people = [
    { id: ID, slug: "alice", name: "Alice Fictional", group: "staff", bio: [], published: true },
    { id: "p" + "d".repeat(24), slug: "bob", name: "Bob Fictional", group: "staff", bio: [], published: true, aliases: ["/about/our-team/alice", "/about/our-team/shared-old", ["/about", "our-team", "directors", "shared-group"].join("/")] },
    { id: "p" + "e".repeat(24), slug: "casey", name: "Casey Fictional", group: "staff", bio: [], published: true, aliases: ["/about/our-team/shared-old", ["/about", "our-team", "directors", "shared-group"].join("/")] },
  ];
  const alice = await visit("/about/our-team/alice/");
  assert.equal(alice.status, 200);
  assert.equal(alice.headers.get("location"), null);
  assert.match(await alice.text(), /<h1[^>]*>Alice Fictional<\/h1>/);
  assert.equal((await visit("/about/our-team/shared-old/")).status, 404);
  assert.equal((await visit(["/about", "our-team", "directors", "shared-group/"].join("/"))).status, 404);
  assert.equal((await visit("/about/our-team/bob/")).status, 200);
});

test("Connect or revision failures show a truthful 503 and never restore old profiles from static files", async () => {
  reset();
  const p = reply.people.find((p) => p.name), url = `/about/our-team/${p.slug}/`;
  await visit(url);
  down = true;
  for (const asked of [url, "/about/our-team/"]) {
    const r = await visit(asked), body = await r.text();
    assert.equal(r.status, 503);
    assert.match(body, /Team profiles are temporarily unavailable/);
    assert.match(body, /href="[^"]+"[^>]*>Try Again<\/a>/);
    assert.doesNotMatch(body, new RegExp(p.name));
    assert.equal(r.headers.get("netlify-cdn-cache-control"), "no-store");
  }
  assert.equal((await visit("/about/faq/")).status, 200, "unrelated pages need no team connection");
  down = false;
  reply.people = [];
  assert.equal((await visit(url)).status, 404);
  useStore({ get: async () => { throw new Error("fictional revision outage"); } });
  assert.equal((await visit(url)).status, 503);
});

test("uploaded photos added or replaced after build use only the fixed same-origin bounded proxy", async () => {
  reset();
  const p = reply.people[0]; p.id = ID; p.photo = { url: `${cfg.url}/p/${ID}?v=${VERSION}` };
  let body = await (await visit(`/about/our-team/${p.slug}/`)).text();
  assert.ok(body.includes(`/api/team-photo/${ID}?v=${VERSION}`));
  const before = calls.length;
  let r = await teamPhoto(new Request(`http://site.test/api/team-photo/${ID}?v=${VERSION}`), ID);
  assert.equal(r.status, 200);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG);
  assert.equal(calls.length, before, "a photo does not export the team again");
  assert.equal(r.headers.get("netlify-cdn-cache-control"), "public, s-maxage=300");
  assert.match(r.headers.get("netlify-cache-tag"), /page/);
  const newer = "c".repeat(32); p.photo.url = `${cfg.url}/p/${ID}?v=${newer}`;
  body = await (await visit(`/about/our-team/${p.slug}/`)).text();
  assert.ok(body.includes(`?v=${newer}`));
  assert.equal((await teamPhoto(new Request(`http://site.test/api/team-photo/${ID}?v=${VERSION}`), ID)).status, 200, "the producer returns its current eligible upload for older version queries");
  p.photo.url = `${cfg.url}/p/${ID}`;
  assert.equal((await teamPhoto(new Request(`http://site.test/api/team-photo/${ID}`), ID)).status, 200, "older unversioned uploaded URLs remain bounded");
  for (const kind of ["redirect", "svg", "large", "false-raster", "stream-large"]) {
    photoKind = kind;
    assert.equal((await teamPhoto(new Request(`http://site.test/api/team-photo/${ID}`), ID)).status, 502, kind);
  }
  photoKind = "ok"; p.published = false;
  r = await teamPhoto(new Request(`http://site.test/api/team-photo/${ID}`), ID);
  assert.equal(r.status, 404); assert.equal(r.headers.get("cache-control"), "no-store");
  const fetches = photoCalls.length;
  assert.equal((await teamPhoto(new Request(`http://site.test/api/team-photo/${ID}?url=https://evil.invalid`), ID)).status, 400);
  assert.equal(photoCalls.length, fetches);
  for (const url of [`https://evil.invalid/p/${ID}`, `${cfg.url}/p/${ID}?v=bad`, `${cfg.url}/p/${ID}?v=${VERSION}&v=${VERSION}`]) assert.equal(publicUpload(url, cfg.url), null);
});

test("only the opening directory row and primary profile portrait receive high priority", async () => {
  reset();
  reply.people = Array.from({ length: 8 }, (_, i) => {
    const id = "p" + String(i + 1).padStart(24, "0");
    return { id, slug: `priority-person-${i}`, name: `Priority ${i} Fictional`, published: true,
      group: i < 2 ? "directors" : i < 5 ? "staff" : "advisors", order: i, bio: [],
      ...(i ? { photo: { url: `${cfg.url}/p/${id}?v=${VERSION}` } } : {}) };
  });
  const images = body => [...body.matchAll(/<img\b[^>]*data-team-portrait[^>]*>/g)].map(m => m[0]);
  const team = images(await (await visit("/about/our-team/")).text());
  assert.equal(team.length, 7);
  for (let i = 1; i < 8; i++) {
    const image = team.find(tag => tag.includes(reply.people[i].id));
    assert.ok(image, `portrait ${i}`);
    assert.match(image, i < 4 ? /fetchpriority="high"/ : /fetchpriority="low"/);
    assert.match(image, /loading="lazy"/);
    if (i < 4) { assert.match(image, /\ssrc=/); assert.doesNotMatch(image, /data-src=/); }
    else { assert.match(image, /data-src=/); assert.doesNotMatch(image, /\ssrc=/); }
  }
  const profile = images(await (await visit("/about/our-team/priority-person-2/")).text());
  assert.equal(profile.length, 3);
  assert.match(profile[0], /fetchpriority="high"/);
  assert.doesNotMatch(profile[0], /loading="lazy"/);
  for (const image of profile.slice(1)) {
    assert.match(image, /fetchpriority="low"/);
    assert.match(image, /loading="lazy"/);
    assert.match(image, /data-src=/); assert.doesNotMatch(image, /\ssrc=/);
  }
  const again = images(await (await visit("/about/our-team/")).text());
  assert.equal(again.filter(tag => tag.includes('fetchpriority="high"')).length, 3, "a new page draw gets a fresh row budget, including its missing-photo card");
});

test("photo revalidation checks current bytes and eligibility before returning a bodyless match", async () => {
  reset();
  reply.people = [{ id: ID, slug: "conditional-fictional", name: "Conditional Fictional", group: "staff", published: true, bio: [], photo: { url: `${cfg.url}/p/${ID}?v=${VERSION}` } }];
  const request = (tag, method = "GET") => teamPhoto(new Request(`http://site.test/api/team-photo/${ID}?v=${VERSION}`, { method, headers: tag ? { "if-none-match": tag } : {} }), ID);
  const initial = await request();
  assert.equal(initial.status, 200);
  const etag = initial.headers.get("etag");
  assert.match(etag, /^"[0-9a-f]{64}"$/);
  assert.deepEqual(Buffer.from(await initial.arrayBuffer()), PNG);
  for (const method of ["GET", "HEAD"]) for (const tag of [etag, `W/${etag}`, `"other,tag", W/${etag}`, "*"]) {
    const count = photoCalls.length, response = await request(tag, method);
    assert.equal(response.status, 304, `${method} ${tag}`);
    assert.equal(photoCalls.length, count + 1, "matching validators still consult the current source");
    assert.equal((await response.arrayBuffer()).byteLength, 0);
    for (const key of ["etag", "cache-control", "netlify-cdn-cache-control", "netlify-vary", "netlify-cache-tag"]) assert.equal(response.headers.get(key), initial.headers.get(key), key);
    assert.equal(response.headers.get("content-length"), null);
  }
  for (const tag of ['"different"', `*, ${etag}`, `garbage ${etag}`]) {
    const response = await request(tag);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
  }
  photoBytes = Buffer.concat([PNG, Buffer.from([0x80])]);
  const binary = await request(etag), firstBinaryTag = binary.headers.get("etag");
  assert.equal(binary.status, 200);
  photoBytes = Buffer.concat([PNG, Buffer.from([0x81])]);
  const changed = await request(firstBinaryTag);
  assert.equal(changed.status, 200, "changed bytes at the same source URL are sent again");
  assert.notEqual(changed.headers.get("etag"), firstBinaryTag, "binary bytes cannot be decoded as text before hashing");
  assert.deepEqual(Buffer.from(await changed.arrayBuffer()), photoBytes);
  const head = await request('"different"', "HEAD");
  assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const kind of ["redirect", "svg", "large", "false-raster", "stream-large", "unavailable"]) {
    photoKind = kind;
    const response = await request("*");
    assert.equal(response.status, 502, kind);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("etag"), null);
  }
  photoKind = "ok"; reply.people[0].published = false;
  const revoked = await request(etag);
  assert.equal(revoked.status, 404); assert.equal(revoked.headers.get("cache-control"), "no-store");
  assert.equal(revoked.headers.get("etag"), null);
});

test("existing Refresh Now authorization clears current team pages and photos without another cache layer", async () => {
  reset();
  const cleared = []; usePurger(async (tags) => cleared.push(...tags));
  const ask = (token) => handle(new Request("http://site.test/api/staff/refresh", { method: "POST", headers: { origin: "http://site.test", "content-type": "application/json", accept: "application/json", ...(token ? { cookie: `bss_staff=${token}` } : {}) }, body: "{}" }), { ip: "203.0.113.77" });
  assert.equal((await ask()).status, 401);
  const reader = crypto.randomBytes(32).toString("base64url"), editor = crypto.randomBytes(32).toString("base64url");
  for (const [token, scopes] of [[reader, ["forms.read:*"]], [editor, ["site.edit"]]]) await q("INSERT INTO staff_sessions (id_hash, sub, name, scopes, expires_at) VALUES ($1,$2,$3,$4::jsonb,now() + interval '1 hour')", [sha256Hex(token), "fictional", "Fictional Editor", JSON.stringify(scopes)]);
  assert.equal((await ask(reader)).status, 403);
  assert.deepEqual(cleared, []);
  const p = reply.people[0]; await visit(`/about/our-team/${p.slug}/`); p.name = "After Refresh Fictional";
  assert.equal((await ask(editor)).status, 200);
  assert.deepEqual(cleared, ["page", "events"]);
  assert.match(await (await visit(`/about/our-team/${p.slug}/`)).text(), /After Refresh Fictional/);
  const policy = PAGE_CACHE["netlify-cdn-cache-control"];
  assert.ok(Number(policy.match(/s-maxage=(\d+)/)[1]) + Number(policy.match(/stale-while-revalidate=(\d+)/)[1]) <= 1800);
});

test("staff previews use current team and person data while keeping draft edits, structure and private headers", async () => {
  reset();
  const p = reply.people.find((p) => p.name);
  const edits = { "page:pg-about-team:b-team/title": "Draft Team Heading" };
  const structure = emptyStructure(); structure.pages["pg-about-team"] = { title: "Preview Team Page Title" };
  let r = await previewResponse("pg-about-team", { edits, structure });
  assert.equal(r.status, 200);
  let body = await r.text();
  assert.match(body, /Draft Team Heading/);
  assert.match(body, /<title>Preview Team Page Title/);
  assert.ok(body.includes(p.name));
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  p.name = "Current Preview Fictional";
  r = await previewResponse(`pg-person-${p.slug}`, { edits: {}, structure: null });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<h1[^>]*>Current Preview Fictional<\/h1>/);
  reply.people.push({ id: ID, slug: "new-preview-person", group: "staff", bio: [], published: true });
  assert.equal((await previewResponse("pg-person-new-preview-person", { edits: {}, structure: null })).status, 200);
  p.published = false;
  assert.equal(await previewResponse(`pg-person-${p.slug}`, { edits: {}, structure: null }), null);
  const before = calls.length;
  assert.equal((await previewResponse("pg-about-faq", { edits: {}, structure: null })).status, 200);
  assert.equal(calls.length, before, "an unrelated/missing preview never reads team data");
  down = true;
  r = await previewResponse("pg-about-team", { edits, structure: null });
  assert.equal(r.status, 503);
  body = await r.text();
  assert.match(body, /Draft Team Heading|Team profiles are temporarily unavailable/);
  assert.doesNotMatch(body, /Current Preview Fictional/);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const prototype = structuredClone(SERVER);
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fixtures/team.json"), "utf8"));
  prototype.liveTeam = false; prototype.prototype = true;
  prototype.render.prototype = true; prototype.render.production = false;
  prototype.render.team = fixture; prototype.render.data.team = fixture;
  useContent(prototype);
  const called = calls.length;
  r = await previewResponse("pg-about-team", { edits: {}, structure: null });
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes(fixture.people.find((p) => p.published).name));
  assert.equal(calls.length, called, "prototype previews retain fixtures without contacting Connect");
});

test("phone and desktop render current team, profile navigation and outage without browser calls to Connect", async () => {
  reset();
  const face = reply.people[0]; face.id = ID; face.photo = { url: `${cfg.url}/p/${ID}?v=${VERSION}` };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) for (const javaScriptEnabled of [true, false]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, javaScriptEnabled });
      page.setDefaultTimeout(10000);
      const failures = [], external = []; page.on("pageerror", (e) => failures.push(e.message));
      page.on("request", (r) => { if (new URL(r.url()).hostname === "home.badgersupports.org") external.push(r.url()); });
      const origin = "http://site.test";
      let siteHold = null;
      await page.route("**/*", async (route) => {
        const incoming = route.request(), u = new URL(incoming.url());
        if (u.origin !== origin) return route.abort();
        const request = new Request(incoming.url(), { method: incoming.method(), headers: incoming.headers() });
        if (u.pathname.endsWith("/site.js") && siteHold) { siteHold.seen = true; await siteHold.promise; }
        let response;
        if (u.pathname.startsWith("/api/")) response = await handle(request, { ip: "203.0.113.78" });
        else if (u.pathname.startsWith("/assets/") || u.pathname.startsWith("/media/")) {
          const file = path.join(OUT, u.pathname);
          const types = { ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".woff2": "font/woff2", ".avif": "image/avif", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
          response = fs.existsSync(file) ? new Response(fs.readFileSync(file), { headers: { "content-type": types[path.extname(file)] || "application/octet-stream" } }) : new Response(null, { status: 404 });
        } else response = await handlePage(request);
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      });
      const proof = path.join(ROOT, "local/team-live-proof"); fs.mkdirSync(proof, { recursive: true });
      const savedPhoto = face.photo;
      async function paintedPortrait(target, selector, cached = false) {
        face.photo = savedPhoto; photoKind = "ok";
        if (cached) { let release; const promise = new Promise(resolve => { release = resolve; }); siteHold = { promise, release, seen: false }; }
        const photoReady = page.waitForResponse(r => new URL(r.url()).pathname === `/api/team-photo/${ID}` && r.status() === 200);
        await page.goto(origin + target, { waitUntil: cached ? "commit" : "load" });
        const frame = page.locator(selector);
        if (cached) {
          await page.waitForFunction(selector => { const image = document.querySelector(selector + " img"); return image?.complete && image.naturalWidth > 0; }, selector);
          assert.ok(siteHold.seen, "the actual portrait handler's module was held until its image completed");
          siteHold.release(); siteHold = null; await page.waitForLoadState("load");
        }
        await (await photoReady).finished(); await frame.scrollIntoViewIfNeeded();
        if (javaScriptEnabled) await page.waitForFunction(selector => { const image = document.querySelector(selector + " img"); return image?.complete && image.naturalWidth > 0 && image.closest("picture").classList.contains("is-loaded"); }, selector);
        else assert.equal(await frame.locator("noscript svg feImage").count(), 1);
        const successImage = await frame.screenshot();
        const suffix = target === "/about/our-team/" ? "card" : "profile";
        fs.writeFileSync(path.join(proof, `portrait-success-${suffix}-${width}-${javaScriptEnabled}.png`), successImage);
        const failedVersion = crypto.createHash("sha256").update(`${target}:${width}:${javaScriptEnabled}`).digest("hex").slice(0, 32);
        face.photo = { url: `${cfg.url}/p/${ID}?v=${failedVersion}` }; photoKind = "svg";
        await page.reload(); await frame.scrollIntoViewIfNeeded();
        await page.waitForFunction(selector => document.querySelector(selector + " img")?.complete, selector);
        assert.equal(await frame.locator("picture").evaluate(el => getComputedStyle(el).opacity), "0");
        const failedImage = await frame.screenshot();
        fs.writeFileSync(path.join(proof, `portrait-failed-${suffix}-${width}-${javaScriptEnabled}.png`), failedImage);
        delete face.photo; await page.reload(); await frame.scrollIntoViewIfNeeded();
        const missingImage = await frame.screenshot();
        assert.deepEqual(failedImage, missingImage, "a failed portrait paints the same clean initials as a missing portrait, without a broken-image icon");
        assert.notDeepEqual(successImage, missingImage, "the successful raster actually covers the initials, with scripts on or off");
        face.photo = savedPhoto; photoKind = "ok";
      }
      await paintedPortrait("/about/our-team/", `.person-link[href="/about/our-team/${face.slug}/"] .person-photo`);
      await paintedPortrait(`/about/our-team/${face.slug}/`, ".profile-photo", javaScriptEnabled);
      await page.goto(`${origin}/about/our-team/`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px team`);
      await page.screenshot({ path: path.join(proof, `team-${width}-${javaScriptEnabled}.png`), fullPage: true });
      await page.locator(".person-link").first().focus();
      await page.keyboard.press("Enter");
      await page.locator(".profile h1").waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px profile`);
      await page.screenshot({ path: path.join(proof, `profile-${width}-${javaScriptEnabled}.png`), fullPage: true });
      assert.deepEqual(failures, []); assert.deepEqual(external, []);
      down = true;
      const r = await page.goto(`${origin}/about/our-team/`);
      assert.equal(r.status(), 503); await page.getByText("Team profiles are temporarily unavailable. Please try again later.").waitFor();
      await page.screenshot({ path: path.join(proof, `unavailable-${width}-${javaScriptEnabled}.png`), fullPage: true });
      down = false;
      const token = crypto.randomBytes(32).toString("base64url");
      await q("INSERT INTO staff_sessions (id_hash, sub, name, scopes, expires_at) VALUES ($1,$2,$3,$4::jsonb,now() + interval '1 hour')", [sha256Hex(token), "fictional-preview", "Fictional Preview Editor", JSON.stringify(["site.edit"])]);
      await page.context().addCookies([{ name: "bss_staff", value: token, url: origin }]);
      const preview = await page.goto(`${origin}/api/staff/preview/pg-about-team`);
      assert.equal(preview.status(), 200);
      assert.equal(preview.headers()["cache-control"], "no-store");
      assert.ok(await page.locator(".person-link").count());
      await page.screenshot({ path: path.join(proof, `preview-team-${width}-${javaScriptEnabled}.png`), fullPage: true });
      if (javaScriptEnabled && width === 390) {
        const originalPeople = reply.people;
        try {
          reply.people = Array.from({ length: 12 }, (_, i) => ({ id: "p" + String(i + 100).padStart(24, "0"), slug: `deferred-${i}-fictional`, name: `Deferred ${i} Fictional`, group: "staff", published: true, order: i, bio: [] }));
          reply.people.push({ ...face, group: "volunteers" });
          await page.goto(`${origin}/about/our-team/`);
          const selector = `.person-link[href="/about/our-team/${face.slug}/"] img[data-team-portrait]`;
          const late = page.locator(selector);
          assert.equal(await late.getAttribute("src"), null, "a distant card waits for a viewport or focus decision");
          await late.scrollIntoViewIfNeeded();
          await page.waitForFunction(selector => {
            const image = document.querySelector(selector);
            return image?.complete && image.naturalWidth > 0 && image.closest("picture").classList.contains("is-loaded");
          }, selector);
          assert.equal(await late.getAttribute("data-src"), null);
          assert.match(await late.getAttribute("src"), new RegExp(`/api/team-photo/${ID}`));
        } finally { reply.people = originalPeople; }
      }
      await page.close();
    }
  } finally { await browser.close(); }
});


test("profile aliases and bounded public order pass while private fields stay excluded", () => {
  const safe = "/about/our-team/previous-fictional";
  const p = { id: ID, slug: "fictional-person", published: true, group: "staff", aliases: [safe, safe, "/staff/", "https://evil.invalid/", "/about/our-team/../escape", "/about/our-team//empty", safe + "?secret=private", safe + "/", 1], credentials: "PRIVATE-CREDENTIALS", order: 77, email: "PRIVATE-EMAIL" };
  const mapped = mapTeam({ people: [p] }).team.people[0];
  assert.deepEqual(mapped.aliases, [safe]);
  assert.equal(mapped.credentials, undefined); assert.equal(mapped.order, 77); assert.equal(mapped.email, undefined);
});

test("public order is a separate optional bounded integer field, never a copied private object", () => {
  const base = { id: ID, slug: "ordered-fictional", published: true, group: "staff", publicDisplay: { title: "PRIVATE-DISPLAY-OBJECT" } };
  for (const order of [0, 99999]) {
    const result = mapTeam({ people: [{ ...base, order }] });
    assert.equal(result.team.people[0].order, order);
    assert.equal(result.team.people[0].publicDisplay, undefined);
    assert.ok(!JSON.stringify(result).includes("PRIVATE-DISPLAY-OBJECT"));
  }
  for (const order of [-1, 100000, 1.2, "77", NaN, Infinity, null, false, {}]) {
    const result = mapTeam({ people: [{ ...base, order }] });
    assert.equal(result.team.people.length, 1);
    assert.equal(result.team.people[0].order, undefined);
    assert.ok(result.dropped.some(s => s.includes("invalid public order omitted")));
  }
});

test("unnamed profiles use a neutral contact action without inventing a first name", async () => {
  reset();
  reply.people = [{ id: ID, slug: "unnamed-contact", published: true, group: "staff", bio: [], contact: "fictional@example.org" }];
  const r = await visit("/about/our-team/unnamed-contact/");
  assert.equal(r.status, 200); const body = await r.text();
  assert.match(body, /Contact This Person/); assert.doesNotMatch(body, /Contact Team/);
});

test("team preview render failures stay private and never restore personal snapshots", async () => {
  reset();
  const broken = structuredClone(SERVER);
  const block = broken.render.floor.pages.find(p => p.id === "pg-about-team").blocks.find(b => b.type === "team");
  for (const b of broken.render.floor.pages.find(p => p.id === "pg-about-team").blocks) if (b.type === "team") b.type = "unknown-renderer";
  useContent(broken);
  const r = await previewResponse("pg-about-team", { edits: {}, structure: null });
  assert.equal(r.status, 503); assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("netlify-cdn-cache-control"), "no-store");
  assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  assert.match(await r.text(), /Team profiles are temporarily unavailable/);
});


test("prototype team pages retain fixtures even when the snapshot has Connect export metadata", async () => {
  reset();
  const prototype = structuredClone(SERVER), fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fixtures/team.json"), "utf8"));
  prototype.prototype = true; prototype.render.prototype = true; prototype.render.production = false;
  prototype.render.team = fixture; prototype.render.data.team = fixture;
  useContent(prototype);
  const before = calls.length, r = await visit("/about/our-team/");
  assert.equal(r.status, 200); assert.ok((await r.text()).includes(fixture.people.find(p => p.published).name));
  assert.equal(calls.length, before);
});

test("a public team render failure returns a truthful body for GET and none for HEAD", async () => {
  reset();
  const broken = structuredClone(SERVER);
  for (const b of broken.render.floor.pages.find(p => p.id === "pg-about-team").blocks) if (b.type === "team") b.type = "unknown-renderer";
  useContent(broken);
  const r = await visit("/about/our-team/");
  assert.equal(r.status, 503); assert.match(await r.text(), /Team profiles are temporarily unavailable/);
  const head = await handlePage(new Request("http://site.test/about/our-team/", { method: "HEAD" }));
  assert.equal(head.status, 503); assert.equal(await head.text(), "");
  assert.equal(head.headers.get("netlify-cdn-cache-control"), "no-store");
});
