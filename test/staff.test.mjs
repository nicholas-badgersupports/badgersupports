/* Staff sign-in through Connect, submissions carried to Connect, and the edit button, end to end
   through the router against a fresh PGlite database.

   Connect is played by a fake that checks every call's signature with its own code (not
   connect.mjs), the way Connect's public-service.mjs does, and answers like Connect: a signed
   note for a sign-in code it issued, one stored copy per submission ref. The secrets are test
   values made up here; nobody in this file is a real person. */

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freshServer, workshopAnswers, post, ORIGIN } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { useConnect } from "../netlify/lib/connect.mjs";
import { deliverDue, deliveriesSettled } from "../netlify/lib/deliver.mjs";
import { serverContent, useContent } from "../netlify/lib/content.mjs";
import { many, one, q } from "../netlify/lib/db.mjs";
import { readEditsFile } from "../src/shared/edits.mjs";
import { build, loadContent } from "../ops/build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONNECT = "http://connect.test";
const ip = (n = 1) => ({ ip: `203.0.113.${n}` });

afterEach(() => useConnect(null));

/* ------------------------------------------------------------------ a fake Connect */

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const hmac = (key, s) => b64u(crypto.createHmac("sha256", key).update(s).digest());

/* Connect's canonical JSON for a flat note: keys sorted, nothing else to it. */
const sortedJson = (o) => JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));

function fakeConnect({ scopes = ["forms.read:*", "site.edit", "site.publish"], name = "Robin Example" } = {}) {
  const keyId = "test-key-1";
  const secret = "test-service-secret-made-up-for-this-file-only";
  const ssoSecret = "test-sso-secret-made-up-for-this-file-only-too";
  const codes = new Map();
  const seenNonces = new Set();
  const fake = {
    scopes, name,
    sso: "ok",        // ok | refuse | badsig | wrongnonce | down
    ingest: "ok",     // ok | refuse | down
    received: [],
    stored: new Map(),
    verifiers: [],
    /* Connect's sign-in page: the director signs in, and Connect hands back a one-time code. */
    approve(location) {
      assert.ok(location.startsWith(`${CONNECT}/public-sso.html#`), `sign-in goes to Connect's page, not ${location}`);
      const f = new URLSearchParams(location.split("#")[1]);
      const code = b64u(crypto.randomBytes(24));
      codes.set(code, { client: f.get("client"), challenge: f.get("challenge"), redirect: f.get("redirect"), nonce: f.get("nonce"), used: false });
      return { code, state: f.get("state"), fragment: f };
    },
  };

  async function fetch(href, init) {
    if (fake.sso === "down" && JSON.parse(init.body).action === "publicSsoToken") throw new TypeError("fetch failed");
    if (fake.ingest === "down" && JSON.parse(init.body).action === "publicFormIngest") throw new TypeError("fetch failed");
    const u = new URL(href);
    assert.equal(u.origin, CONNECT);
    assert.equal(u.pathname, "/api");
    assert.equal(init.method, "POST");
    const h = new Headers(init.headers);
    const ts = h.get("x-public-timestamp"), nonce = h.get("x-public-nonce");
    const base = `${ts}\n${nonce}\nPOST\n/api\n${crypto.createHash("sha256").update(init.body).digest("hex")}`;
    const reply = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    const unknown = () => reply({ ok: false, error: "Unknown action." });
    if (h.get("x-public-key-id") !== keyId) return unknown();
    if (h.get("x-public-signature") !== hmac(secret, base)) return unknown();
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300 || seenNonces.has(nonce)) return unknown();
    seenNonces.add(nonce);
    const body = JSON.parse(init.body);

    if (body.action === "publicSsoToken") {
      if (fake.sso === "refuse") return unknown();
      const c = codes.get(body.code);
      if (!c || c.used || c.client !== "badgersupports-public" || body.client !== c.client || body.redirect !== c.redirect) return unknown();
      if (b64u(crypto.createHash("sha256").update(body.verifier).digest()) !== c.challenge) return unknown();
      c.used = true;
      fake.verifiers.push(body.verifier);
      const now = Math.floor(Date.now() / 1000);
      const assertion = {
        v: 1, iss: CONNECT, aud: "badgersupports-public", iat: now, exp: now + 120,
        nonce: fake.sso === "wrongnonce" ? "someone-elses-nonce" : c.nonce,
        sub: "u-test-0001", name: fake.name, active: true, scopes: fake.scopes,
      };
      const sig = fake.sso === "badsig" ? hmac("not-the-shared-secret", sortedJson(assertion)) : hmac(ssoSecret, sortedJson(assertion));
      return reply({ ok: true, assertion, sig });
    }

    if (body.action === "publicFormIngest") {
      if (fake.ingest === "refuse") return unknown();
      fake.received.push(body);
      const stored = fake.stored.has(body.ref) ? "already" : "new";
      fake.stored.set(body.ref, body);
      return reply({ ok: true, ref: body.ref, stored });
    }
    return unknown();
  }

  fake.cfg = { url: CONNECT, keyId, secret, ssoSecret, fetch };
  return fake;
}

/* ------------------------------------------------------------------ a browser, roughly */

const setCookies = (res) => res.headers.getSetCookie();
const cookieValue = (res, name) => {
  const c = setCookies(res).find((x) => x.startsWith(`${name}=`));
  return c === undefined ? undefined : c.slice(name.length + 1).split(";")[0];
};

function get(pathname, { cookie, origin = ORIGIN, json = true } = {}) {
  return new Request(origin + pathname, { headers: { ...(json ? { accept: "application/json" } : { accept: "text/html" }), ...(cookie ? { cookie } : {}) } });
}

/* Start, sign in at the fake Connect, come back. Returns the callback reply and the cookie jar. */
async function signIn(fake, { returnTo = "/staff/" } = {}) {
  const start = await handle(get(`/api/auth/start?return=${encodeURIComponent(returnTo)}`, { json: false }), ip());
  assert.equal(start.status, 302);
  const state = cookieValue(start, "bss_auth");
  const { code, state: sentState } = fake.approve(start.headers.get("location"));
  assert.equal(sentState, state, "the state in the fragment is the one in the cookie");
  const back = await handle(get(`/api/auth/callback?state=${sentState}&code=${code}`, { cookie: `bss_auth=${state}`, json: false }), ip());
  const session = cookieValue(back, "bss_staff");
  return { start, back, state, code, cookie: session ? `bss_staff=${session}; bss_staff_hint=1` : "" };
}

const staffPost = (pathname, body, cookie, opts = {}) => post(pathname, body, { headers: { cookie }, ...opts });

/* ------------------------------------------------------------------ sign-in */

test("a director signs in through Connect, and the staff page knows who they are", async () => {
  await freshServer();
  const fake = fakeConnect();
  useConnect(fake.cfg);

  const { start, back, state, cookie } = await signIn(fake);
  const loc = start.headers.get("location");
  const f = new URLSearchParams(loc.split("#")[1]);
  assert.equal(f.get("client"), "badgersupports-public");
  assert.equal(f.get("redirect"), `${ORIGIN}/api/auth/callback`);
  assert.ok(f.get("challenge") && f.get("nonce"));
  assert.ok(!loc.split("#")[0].includes("?"), "nothing about the sign-in is in the query string, where servers log it");
  const authCookie = setCookies(start).find((c) => c.startsWith("bss_auth="));
  assert.match(authCookie, /HttpOnly/);
  assert.match(authCookie, /SameSite=Lax/);
  assert.match(authCookie, /Max-Age=600/);
  assert.equal(start.headers.get("cache-control"), "no-store");
  assert.ok(state.length >= 32);

  assert.equal(back.status, 302);
  assert.equal(back.headers.get("location"), "/staff/");
  const jar = setCookies(back);
  assert.match(jar.find((c) => c.startsWith("bss_staff=")), /HttpOnly.*Max-Age=28800/);
  const hint = jar.find((c) => c.startsWith("bss_staff_hint="));
  assert.ok(hint.startsWith("bss_staff_hint=1;") && !/HttpOnly/.test(hint), "the hint is readable by the page and says only 1");
  assert.match(jar.find((c) => c.startsWith("bss_auth=")), /Max-Age=0/, "the start cookie is spent");
  assert.equal(fake.verifiers.length, 1);
  assert.ok(!loc.includes(fake.verifiers[0]), "the verifier never went near the browser");

  const me = await handle(get("/api/staff/me", { cookie }), ip());
  assert.equal(me.status, 200);
  assert.equal(me.headers.get("cache-control"), "no-store");
  const body = await me.json();
  assert.equal(body.name, "Robin Example");
  assert.equal(body.canEdit, true);
  assert.equal(body.canPublish, true);
  assert.equal(body.canRead, true);
  assert.equal(body.connectUrl, CONNECT);
  assert.equal(body.waiting, 0);
  assert.equal(typeof body.text["edit.button"], "string");
  const row = await one("SELECT sub, name, scopes FROM staff_sessions");
  assert.deepEqual({ ...row }, { sub: "u-test-0001", name: "Robin Example", scopes: ["forms.read:*", "site.edit", "site.publish"] });

  // The staff page asks first whether anyone is signed in, and is always answered.
  const status = await handle(get("/api/auth/status", { cookie }), ip());
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { ok: true, signedIn: true, configured: true });
  assert.deepEqual(await (await handle(get("/api/auth/status"), ip())).json(), { ok: true, signedIn: false, configured: true });

  // Signing out ends this site's session, and the hint goes with it.
  const out = await handle(staffPost("/api/auth/signout", {}, cookie, { json: false }), ip());
  assert.equal(out.status, 303);
  assert.equal(out.headers.get("location"), "/staff/");
  assert.match(setCookies(out).find((c) => c.startsWith("bss_staff_hint=")), /Max-Age=0/);
  const after = await handle(get("/api/staff/me", { cookie }), ip());
  assert.equal(after.status, 401);
  assert.deepEqual(await after.json(), { ok: false, error: "auth.required", configured: true });
});

test("on https the cookies are __Host- cookies, sent only over https", async () => {
  await freshServer();
  const fake = fakeConnect();
  useConnect(fake.cfg);
  const start = await handle(get("/api/auth/start", { origin: "https://site.test", json: false }), ip());
  const c = setCookies(start).find((x) => x.startsWith("__Host-bss_auth="));
  assert.ok(c, "the start cookie is a __Host- cookie");
  assert.match(c, /Secure/);
  assert.match(c, /Path=\//);
  assert.ok(!/Domain=/i.test(c));
  assert.equal(new URLSearchParams(start.headers.get("location").split("#")[1]).get("redirect"), "https://site.test/api/auth/callback");
});

test("a sign-in start works once, only in the browser that began it, and not for long", async () => {
  await freshServer();
  const fake = fakeConnect();
  useConnect(fake.cfg);

  const start = await handle(get("/api/auth/start", { json: false }), ip());
  const state = cookieValue(start, "bss_auth");
  const { code } = fake.approve(start.headers.get("location"));

  // Another browser carrying the same link has no start cookie.
  const elsewhere = await handle(get(`/api/auth/callback?state=${state}&code=${code}`, { json: false }), ip());
  assert.equal(elsewhere.status, 400);
  assert.match(await elsewhere.text(), /Unable to sign in/);

  const ok = await handle(get(`/api/auth/callback?state=${state}&code=${code}`, { cookie: `bss_auth=${state}`, json: false }), ip());
  assert.equal(ok.status, 302);
  const replay = await handle(get(`/api/auth/callback?state=${state}&code=${code}`, { cookie: `bss_auth=${state}`, json: false }), ip());
  assert.equal(replay.status, 400);
  assert.match(await replay.text(), /ran out/);
  assert.equal((await one("SELECT count(*)::int AS n FROM staff_sessions")).n, 1);

  // A start left for more than ten minutes is gone.
  const late = await handle(get("/api/auth/start", { json: false }), ip());
  const lateState = cookieValue(late, "bss_auth");
  const lateCode = fake.approve(late.headers.get("location")).code;
  await q("UPDATE auth_starts SET expires_at = now() - interval '1 second' WHERE used_at IS NULL");
  const stale = await handle(get(`/api/auth/callback?state=${lateState}&code=${lateCode}`, { cookie: `bss_auth=${lateState}`, json: false }), ip());
  assert.equal(stale.status, 400);

  // Where to land afterwards is a path on this site, never another site.
  const away = await handle(get(`/api/auth/start?return=${encodeURIComponent("//elsewhere.test/")}`, { json: false }), ip());
  assert.equal(away.status, 302);
  assert.equal((await one("SELECT return_to FROM auth_starts ORDER BY created_at DESC, return_to LIMIT 1")).return_to, "/staff/");
});

test("Connect saying no, a note that does not check out, or Connect not answering, signs nobody in", async () => {
  await freshServer();
  for (const [mode, status, words] of [["refuse", 403, /did not confirm/], ["badsig", 403, /did not confirm/], ["wrongnonce", 403, /did not confirm/], ["down", 502, /./]]) {
    const fake = fakeConnect();
    fake.sso = mode;
    useConnect(fake.cfg);
    const { back } = await signIn(fake);
    assert.equal(back.status, status, mode);
    assert.match(await back.text(), words, mode);
    assert.equal(cookieValue(back, "bss_staff"), undefined, `${mode}: no session cookie`);
  }
  // Connect knows them but gives them nothing to do here.
  const none = fakeConnect({ scopes: [] });
  useConnect(none.cfg);
  assert.equal((await signIn(none)).back.status, 403);
  assert.equal((await one("SELECT count(*)::int AS n FROM staff_sessions")).n, 0);
});

test("with Connect not set up, signing in says so, and answers wait rather than vanish", async () => {
  const keep = ["CONNECT_URL", "PUBLIC_SITE_SERVICE_KEY_ID", "PUBLIC_SITE_SERVICE_SECRET", "PUBLIC_SSO_SECRET"].map((k) => [k, process.env[k]]);
  for (const [k] of keep) delete process.env[k];
  try {
    await freshServer();
    useConnect(null);
    const start = await handle(get("/api/auth/start", { json: false }), ip());
    assert.equal(start.status, 503);
    assert.match(await start.text(), /not set up/);
    const me = await handle(get("/api/staff/me"), ip());
    assert.equal(me.status, 401);
    assert.deepEqual(await me.json(), { ok: false, error: "auth.required", configured: false });
    assert.deepEqual(await (await handle(get("/api/auth/status"), ip())).json(), { ok: true, signedIn: false, configured: false });
    const sent = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0101-aaaa" })), ip());
    assert.equal(sent.status, 200);
    await deliveriesSettled();
    assert.equal((await one("SELECT state FROM outbox WHERE kind = 'connect.ingest'")).state, "pending");
  } finally {
    for (const [k, v] of keep) if (v !== undefined) process.env[k] = v;
  }
});

test("a director reads only the forms Connect lets them read, edits only with site.edit, and downloads only with site.publish", async () => {
  await freshServer();
  const reader = fakeConnect({ scopes: ["forms.read:workshop-request"] });
  useConnect(reader.cfg);
  const { cookie } = await signIn(reader);
  const me = await (await handle(get("/api/staff/me", { cookie }), ip())).json();
  assert.equal(me.canRead, true);
  assert.equal(me.canEdit, false);
  assert.equal(me.canPublish, false);
  const forms = await (await handle(get("/api/staff/forms", { cookie }), ip())).json();
  assert.deepEqual(forms.forms.map((f) => f.key), ["workshop-request"]);
  for (const [req, label] of [
    [get("/api/staff/forms/programming-feedback/submissions", { cookie }), "another form's answers"],
    [get("/api/staff/edit/source?page=pg-home", { cookie }), "the edit button's words"],
    [get("/api/staff/edits", { cookie }), "the edits file"],
    [staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to Content", value: "Skip ahead" }, cookie), "saving an edit"],
  ]) {
    const res = await handle(req, ip());
    assert.equal(res.status, 403, label);
    assert.equal((await res.json()).error, "staff.forbidden", label);
  }

  const editor = fakeConnect({ scopes: ["site.edit"] });
  useConnect(editor.cfg);
  const e = await signIn(editor);
  const list = await (await handle(get("/api/staff/forms", { cookie: e.cookie }), ip())).json();
  assert.deepEqual(list.forms, []);
  assert.equal((await handle(staffPost("/api/staff/outbox/retry", {}, e.cookie), ip())).status, 403);
  const em = await (await handle(get("/api/staff/me", { cookie: e.cookie }), ip())).json();
  assert.deepEqual([em.canEdit, em.canPublish, em.waiting], [true, false, 0], "an editor still sees how many changes wait");
  for (const p of ["/api/staff/edits", "/api/staff/edits?download=1"]) {
    const res = await handle(get(p, { cookie: e.cookie }), ip());
    assert.equal(res.status, 403, `an editor without site.publish: ${p}`);
  }

  // Publishing without editing: the file, never the edit button. Connect set to hide first names
  // sends an empty name, and the page says only "Signed in".
  const publisher = fakeConnect({ scopes: ["site.publish"], name: "" });
  useConnect(publisher.cfg);
  const pb = await signIn(publisher);
  const pm = await (await handle(get("/api/staff/me", { cookie: pb.cookie }), ip())).json();
  assert.deepEqual([pm.name, pm.canEdit, pm.canPublish, pm.canRead], ["", false, true, false]);
  assert.equal((await handle(get("/api/staff/edits?download=1", { cookie: pb.cookie }), ip())).status, 200);
  assert.equal((await handle(get("/api/staff/edit/source?page=pg-home", { cookie: pb.cookie }), ip())).status, 403);
  assert.equal((await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to Content", value: "Skip ahead" }, pb.cookie), ip())).status, 403);

  // A made-up session is nobody, and a post from another site is refused before anything else.
  assert.equal((await handle(get("/api/staff/me", { cookie: `bss_staff=${"A".repeat(43)}` }), ip())).status, 401);
  const forged = await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to Content", value: "Skip ahead" }, e.cookie, { origin: "http://elsewhere.test" }), ip());
  assert.equal(forged.status, 403);
  assert.equal((await forged.json()).error, "origin.refused");
});

/* ------------------------------------------------------------------ forms into Connect */

test("a submission reaches Connect after its reply, as the words the person chose", async () => {
  await freshServer();
  const fake = fakeConnect();
  useConnect(fake.cfg);
  const res = await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0201-aaaa", projection: "no" })), ip());
  assert.equal(res.status, 200);
  const { ref } = await res.json();
  await deliveriesSettled();

  assert.equal(fake.received.length, 1);
  const got = fake.received[0];
  assert.equal(got.ref, ref);
  assert.equal(got.form, "workshop-request");
  assert.equal(got.formTitle, serverContent().forms["workshop-request"].title);
  assert.equal(got.version, 1);
  assert.equal(got.anonymous, false);
  assert.deepEqual(got.answers.topics, ["Stress management and self-care"], "option words, not ids");
  assert.equal(got.answers.projection, "No");
  assert.equal(got.answers.affiliation, "Example Hall Council");
  assert.ok(got.columns.some((c) => c.id === "topics" && c.label), "Connect is told every column the form can have");
  assert.ok(!Number.isNaN(Date.parse(got.receivedAt)));

  const out = await one("SELECT o.state, o.attempts FROM outbox o JOIN submissions s ON s.id = o.submission_id WHERE s.ref = $1 AND o.kind = 'connect.ingest'", [ref]);
  assert.deepEqual({ ...out }, { state: "sent", attempts: 0 });
  assert.deepEqual((await many("SELECT kind FROM submission_events WHERE kind = 'delivered'")).map((r) => r.kind), ["delivered"]);

  // Pressing Send again is the same submission, and nothing more goes to Connect.
  await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0201-aaaa", projection: "no" })), ip());
  await deliveriesSettled();
  assert.equal(fake.received.length, 1);
});

test("a delivery that fails waits longer each time, shows as failing, and Try again sends it", async () => {
  await freshServer();
  const fake = fakeConnect();
  fake.ingest = "refuse";
  useConnect(fake.cfg);
  const { ref } = await (await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0301-aaaa" })), ip())).json();
  await deliveriesSettled();

  const row = () => one(`SELECT o.state, o.attempts, o.last_error, extract(epoch FROM o.next_at - now())::int AS wait
                           FROM outbox o JOIN submissions s ON s.id = o.submission_id WHERE s.ref = $1 AND o.kind = 'connect.ingest'`, [ref]);
  let r = await row();
  assert.equal(r.state, "failed");
  assert.equal(r.attempts, 1);
  assert.equal(r.last_error, "connect.refused");
  assert.ok(r.wait > 100 && r.wait <= 120, `two minutes, not ${r.wait}s`);
  await deliverDue();
  assert.equal((await row()).attempts, 1, "nothing is sent again before its wait is up");
  await deliverDue({ force: true });
  r = await row();
  assert.equal(r.attempts, 2);
  assert.ok(r.wait > 220 && r.wait <= 240, `four minutes, not ${r.wait}s`);
  await q("UPDATE outbox SET attempts = 12 WHERE kind = 'connect.ingest'");
  await deliverDue({ force: true });
  assert.ok((await row()).wait <= 6 * 3600, "never more than six hours");

  // The staff page shows it failing; Try again sends it once Connect takes it.
  const { cookie } = await signIn(fake);
  const forms = await (await handle(get("/api/staff/forms", { cookie }), ip())).json();
  await deliveriesSettled();
  assert.equal(forms.connect, true);
  const wr = forms.forms.find((f) => f.key === "workshop-request");
  assert.equal(wr.total, 1);
  assert.equal(wr.delivery.failed, 1);
  assert.equal(wr.delivery.lastError, "connect.refused");

  fake.ingest = "ok";
  const retry = await handle(staffPost("/api/staff/outbox/retry", {}, cookie), ip());
  assert.equal(retry.status, 200);
  const rb = await retry.json();
  assert.equal(rb.sent, 1);
  assert.equal(rb.failed, 0);
  assert.equal(rb.forms.find((f) => f.key === "workshop-request").delivery.sent, 1);
  assert.equal((await row()).state, "sent");
  assert.ok(fake.stored.has(ref));

  const answers = await (await handle(get("/api/staff/forms/workshop-request/submissions", { cookie }), ip())).json();
  assert.equal(answers.total, 1);
  assert.equal(answers.items[0].ref, ref);
  assert.equal(answers.items[0].delivery, "sent");
  assert.equal(answers.items[0].answers.topics, "Stress management and self-care");
  assert.ok(answers.columns.some((c) => c.id === "topics"));

  // Connect not answering at all is a failure like any other, never a lost submission.
  fake.ingest = "down";
  await handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0302-bbbb", affiliation: "Another Example Hall" })), ip());
  await deliveriesSettled();
  assert.deepEqual((await many("SELECT state FROM outbox WHERE kind = 'connect.ingest' ORDER BY id")).map((x) => x.state), ["sent", "failed"]);
  assert.equal((await one("SELECT last_error FROM outbox WHERE kind = 'connect.ingest' AND state = 'failed'")).last_error, "connect.unreachable");
});

/* ------------------------------------------------------------------ the edit button */

const HERO = "page:pg-home:b-home-hero/title";

test("the edit button saves words, will not overwrite someone else's unseen, and puts the original back", async () => {
  await freshServer();
  const fake = fakeConnect({ scopes: ["site.edit", "site.publish"] });
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);

  const source = await (await handle(get("/api/staff/edit/source?page=pg-home", { cookie }), ip())).json();
  const hero = source.entries.find((e) => e.target === HERO);
  assert.ok(hero, "the home page's title can be edited");
  assert.equal(hero.waiting, false);
  assert.ok(source.entries.some((e) => e.target === "text:page.skip"), "lines every page shares come too");
  assert.ok(source.entries.some((e) => e.target.startsWith("site:nav/")), "and the menus");
  assert.ok(!source.entries.some((e) => e.target.startsWith("page:pg-about:")), "but not other pages' words");
  assert.equal((await handle(get("/api/staff/edit/source?page=../etc", { cookie }), ip())).status, 400);

  const saved = await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: hero.current, value: "  badger supports, together  " }, cookie), ip());
  assert.equal(saved.status, 200);
  const s = await saved.json();
  assert.equal(s.changed, true);
  assert.equal(s.entry.current, "badger supports, together", "trimmed");
  assert.equal(s.entry.waiting, true);
  assert.equal(s.entry.by, "Robin Example");
  assert.equal(s.waiting, 1);
  assert.equal((await (await handle(get("/api/staff/me", { cookie }), ip())).json()).waiting, 1);

  // Someone who opened the box before that save cannot overwrite it without seeing it.
  const stale = await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: hero.current, value: "badger supports!" }, cookie), ip());
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { ok: false, error: "edit.conflict", current: "badger supports, together" });

  for (const [value, code] of [["<b>badger</b>", "edit.markup"], ["   ", "edit.empty"], ["https://elsewhere.test/", "edit.value"], ["x".repeat(2001), "edit.long"], [42, "edit.value"]]) {
    const bad = await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: "badger supports, together", value }, cookie), ip());
    assert.equal(bad.status, 422, code);
    assert.equal((await bad.json()).error, code);
  }
  for (const target of ["page:pg-home:b-home-hero/id", "page:pg-home:b-nowhere/title", "text:no.such.key", "nonsense"]) {
    const bad = await handle(staffPost("/api/staff/edit/save", { target, expected: "", value: "words" }, cookie), ip());
    assert.equal(bad.status, 400, target);
    assert.equal((await bad.json()).error, "edit.target", target);
  }

  // Putting the original back is a save like any other, and the row stays.
  const back = await (await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: "badger supports, together", value: hero.original }, cookie), ip())).json();
  assert.equal(back.changed, true);
  assert.equal(back.entry.waiting, false);
  assert.equal(back.waiting, 0);
  const rows = await many("SELECT target, value, previous, edited_by FROM content_edits");
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ target: HERO, value: hero.original, previous: "badger supports, together", edited_by: "u-test-0001" }]);
  const file = await (await handle(get("/api/staff/edits", { cookie }), ip())).json();
  assert.deepEqual(file.edits, {}, "an edit equal to the shipped words is not in the file");

  // A local copy rebuilds after each save; a save that changes nothing does not.
  let rebuilt = 0;
  const ctx = { ...ip(), afterEdit: async () => { rebuilt++; } };
  await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to Content", value: "Skip to the page" }, cookie), ctx);
  await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to the page", value: "Skip to the page" }, cookie), ctx);
  assert.equal(rebuilt, 1);
});

test("the download is the file a publish lays over the site, and the built pages show the new words", async () => {
  await freshServer();
  const fake = fakeConnect({ scopes: ["site.edit", "site.publish"] });
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);
  const shipped = serverContent().editable;
  for (const [target, value] of [[HERO, "badger supports, together"], ["text:page.skip", "Skip to the page"], ["site:nav/0/label", "What we run"]]) {
    const res = await handle(staffPost("/api/staff/edit/save", { target, expected: shipped[target].shown, value }, cookie), ip());
    assert.equal(res.status, 200, target);
  }

  const dl = await handle(get("/api/staff/edits?download=1", { cookie }), ip());
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get("content-disposition"), 'attachment; filename="edits.json"');
  assert.equal(dl.headers.get("cache-control"), "no-store");
  const file = JSON.parse(await dl.text());
  assert.equal(file.schema, "bss.edits/1");
  assert.deepEqual(file.edits, { [HERO]: "badger supports, together", "site:nav/0/label": "What we run", "text:page.skip": "Skip to the page" });

  // The build reads it as content/edits.json would be read.
  const edits = readEditsFile(file);
  const c = loadContent({ edits });
  assert.deepEqual([...c.edits.applied].sort(), Object.keys(file.edits).sort());
  assert.deepEqual(c.edits.skipped, []);
  assert.equal(c.pages.find((p) => p.id === "pg-home").blocks.find((b) => b.id === "b-home-hero").title, "badger supports, together");
  assert.equal(c.text["page.skip"], "Skip to the page");
  assert.equal(c.site.nav[0].label, "What we run");
  assert.deepEqual(c.editable[HERO], { ...c.editable[HERO], shown: "badger supports, together", floor: shipped[HERO].shown });

  const out = path.join(ROOT, "local/test-build-edits");
  await build({ out, serverDir: path.join(ROOT, "local/test-build-edits-server"), media: false, today: "2026-10-20", edits });
  const home = fs.readFileSync(path.join(out, "index.html"), "utf8");
  assert.match(home, /badger supports, together/);
  assert.match(home, /Skip to the page/);
  assert.match(home, /What we run/);

  // Once that publish is live, nothing waits, and the next download still carries the words.
  useContent({ ...serverContent(), editable: c.editable, text: c.text, site: c.site });
  const me = await (await handle(get("/api/staff/me", { cookie }), ip())).json();
  assert.equal(me.waiting, 0);
  const again = await (await handle(get("/api/staff/edits", { cookie }), ip())).json();
  assert.deepEqual(again.edits, file.edits);
  // And putting one back after the publish carries the undo in the next file.
  await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to the page", value: "Skip to Content" }, cookie), ip());
  const undo = await (await handle(get("/api/staff/edits", { cookie }), ip())).json();
  assert.equal(undo.edits["text:page.skip"], undefined);
  assert.equal(undo.waiting, 1);
});
