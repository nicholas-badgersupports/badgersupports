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
import { useConnect, resetQuoteCache } from "../netlify/lib/connect.mjs";
import { deliverDue, deliveriesSettled } from "../netlify/lib/deliver.mjs";
import { serverContent, useContent } from "../netlify/lib/content.mjs";
import { many, one, q, migrate } from "../netlify/lib/db.mjs";
import { readEditsFile } from "../src/shared/edits.mjs";
import { build, loadContent } from "../ops/build.mjs";
import { currentRevision, useStore, memoryStore, usePurger } from "../netlify/lib/published.mjs";
import { handlePage, useDist } from "../netlify/lib/pages.mjs";
import { currentForm, setSwitch } from "../netlify/lib/intake.mjs";
import { launchForms } from "../src/shared/forms.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONNECT = "http://connect.test";
const ip = (n = 1) => ({ ip: `203.0.113.${n}` });

afterEach(() => useConnect(null));

/* ------------------------------------------------------------------ a fake Connect */

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const hmac = (key, s) => b64u(crypto.createHmac("sha256", key).update(s).digest());

/* Connect's canonical JSON for a flat note: keys sorted, nothing else to it. */
const sortedJson = (o) => JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));

function fakeConnect({ scopes = ["forms.read:*", "site.edit", "site.publish"], name = "Robin Example", statusCheck = false } = {}) {
  const keyId = "test-key-1";
  const secret = "test-service-secret-made-up-for-this-file-only";
  const ssoSecret = "test-sso-secret-made-up-for-this-file-only-too";
  const codes = new Map();
  const seenNonces = new Set();
  const fake = {
    scopes, name,
    active: true,     // switched off in Connect when false
    sso: "ok",        // ok | refuse | badsig | wrongnonce | down
    ingest: "ok",     // ok | refuse | down
    status: "ok",     // ok | refuse | badsig | replay | down: publicSsoStatus, the proposed action
    statusCalls: 0,
    firstStatus: null,
    received: [],
    stored: new Map(),
    verifiers: [],
    method: null,     // "google" or "password" on the sign-in note; null sends none, as Connect did before GOOGLE-SIGNIN
    googleOn: true,   // Connect's Google route: switched off, a status check about a Google-opened session says inactive
    statusMethods: [],
    quotes: [],       // publicSigninQuotes: Connect's one shared list, [] when its Show switch is off
    quoteCalls: 0,
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
    if (fake.status === "down" && JSON.parse(init.body).action === "publicSsoStatus") throw new TypeError("fetch failed");
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
        ...(fake.method ? { method: fake.method } : {}),
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

    /* The proposed status action (docs/ARCHITECTURE.md, "Staying signed in"): a fresh note for one
       person, signed like a sign-in note, with active false and no scopes once they are switched off. */
    if (body.action === "publicSsoStatus") {
      fake.statusCalls += 1;
      if (fake.status === "refuse") return unknown();
      if (fake.status === "replay" && fake.firstStatus) return reply(fake.firstStatus);
      if (body.client !== "badgersupports-public" || typeof body.sub !== "string" || typeof body.nonce !== "string") return unknown();
      const now = Math.floor(Date.now() / 1000);
      fake.statusMethods.push(body.method);
      const on = fake.active && body.sub === "u-test-0001" && (body.method !== "google" || fake.googleOn);
      const assertion = {
        v: 1, iss: CONNECT, aud: "badgersupports-public", iat: now, exp: now + 120, nonce: body.nonce,
        sub: body.sub, name: on ? fake.name : "", active: on, scopes: on ? fake.scopes : [],
        ...(body.method === "google" ? { method: "google" } : {}),
      };
      const out = { ok: true, assertion, sig: hmac(fake.status === "badsig" ? "not-the-shared-secret" : ssoSecret, sortedJson(assertion)) };
      fake.firstStatus ??= out;
      return reply(out);
    }
    /* Connect GOOGLE-SIGNIN: the one shared list of sign-in quotes, for this client's own key only. */
    if (body.action === "publicSigninQuotes") {
      fake.quoteCalls += 1;
      if (fake.quotes === "down") throw new TypeError("fetch failed");
      return reply({ ok: true, quotes: fake.quotes });
    }
    return unknown();
  }

  fake.cfg = { url: CONNECT, keyId, secret, ssoSecret, fetch, statusCheck };
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
    const said = await start.text();
    assert.match(said, /not set up/);
    assert.match(said, /<a href="\/staff\/">/);
    // Sent from another page: the way back still carries it, and an address off the site is dropped.
    const from = await (await handle(get(`/api/auth/start?return=${encodeURIComponent("/forms/workshop-request/")}`, { json: false }), ip())).text();
    assert.match(from, /<a href="\/staff\/\?return=%2Fforms%2Fworkshop-request%2F">/);
    const away = await (await handle(get(`/api/auth/start?return=${encodeURIComponent("//elsewhere.test/")}`, { json: false }), ip())).text();
    assert.match(away, /<a href="\/staff\/">/);
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
    [get("/api/staff/edit/history?target=text:page.skip", { cookie }), "the versions of some words"],
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
  assert.equal((await handle(get("/api/staff/edit/history?target=text:page.skip", { cookie: pb.cookie }), ip())).status, 403);
  assert.equal((await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to Content", value: "Skip ahead" }, pb.cookie), ip())).status, 403);

  // A made-up session is nobody, and a post from another site is refused before anything else.
  assert.equal((await handle(get("/api/staff/me", { cookie: `bss_staff=${"A".repeat(43)}` }), ip())).status, 401);
  const forged = await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to Content", value: "Skip ahead" }, e.cookie, { origin: "http://elsewhere.test" }), ip());
  assert.equal(forged.status, 403);
  assert.equal((await forged.json()).error, "origin.refused");
});

/* ------------------------------------------------------------------ how long Connect's word lasts */

/* Moves every session's sign-in, and its last word from Connect, this many minutes into the past. */
const age = (minutes) => q(`UPDATE staff_sessions SET created_at = created_at - $1::int * interval '1 minute',
                                   checked_at = coalesce(checked_at, created_at) - $1::int * interval '1 minute'`, [minutes]);
const meFor = async (cookie) => {
  const r = await handle(get("/api/staff/me", { cookie }), ip());
  return r.status === 200 ? r.json() : r.status;
};
const answersFor = (cookie, key = "workshop-request") => handle(get(`/api/staff/forms/${key}/submissions`, { cookie }), ip());
const refusal = async (res) => [res.status, (await res.json()).error];
const SKIP = { target: "text:page.skip", expected: "Skip to Content", value: "Skip ahead" };

test("with no status check from Connect, reading answers needs a sign-in within the hour, and words last the working day", async () => {
  await freshServer();
  const fake = fakeConnect();
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);
  assert.equal((await answersFor(cookie)).status, 200);
  await age(59);
  assert.equal((await meFor(cookie)).canRead, true, "59 minutes after signing in, answers can still be read");

  await age(2);
  const later = await meFor(cookie);
  assert.deepEqual([later.canRead, later.readAgain, later.canEdit, later.canPublish], [false, true, true, true], "an hour on, reading stops and the page says to sign in again");
  assert.deepEqual(await refusal(await answersFor(cookie)), [403, "auth.again"], "a direct request for answers is refused");
  assert.deepEqual(await refusal(await handle(staffPost("/api/staff/outbox/retry", {}, cookie), ip())), [403, "auth.again"]);
  assert.deepEqual((await (await handle(get("/api/staff/forms", { cookie }), ip())).json()).forms, [], "no form is listed");
  assert.equal((await handle(staffPost("/api/staff/edit/save", SKIP, cookie), ip())).status, 200, "changing words still works");
  assert.equal((await handle(get("/api/staff/edits?download=1", { cookie }), ip())).status, 200, "and so does the publish file");
  assert.equal(fake.statusCalls, 0, "nothing asked Connect");

  const again = await signIn(fake);
  assert.equal((await meFor(again.cookie)).canRead, true, "signing in again gives reading back");
  assert.equal((await answersFor(again.cookie)).status, 200);

  // A reader of one form is told to sign in again for that form, and never for another.
  const reader = fakeConnect({ scopes: ["forms.read:workshop-request"] });
  useConnect(reader.cfg);
  const r = await signIn(reader);
  await age(61);
  const rm = await meFor(r.cookie);
  assert.deepEqual([rm.canRead, rm.readAgain, rm.canEdit], [false, true, false]);
  assert.deepEqual(await refusal(await answersFor(r.cookie)), [403, "auth.again"]);
  assert.deepEqual(await refusal(await answersFor(r.cookie, "programming-feedback")), [403, "staff.forbidden"]);

  // Someone who never read answers is not asked to sign in again to read them.
  const editor = fakeConnect({ scopes: ["site.edit"] });
  useConnect(editor.cfg);
  const e = await signIn(editor);
  await age(61);
  const em = await meFor(e.cookie);
  assert.deepEqual([em.canRead, em.readAgain, em.canEdit], [false, false, true]);
  assert.deepEqual(await refusal(await answersFor(e.cookie)), [403, "staff.forbidden"]);
});

test("with Connect's status check on, a session is checked again after ten minutes: fewer scopes take effect, and switched off ends it", async () => {
  await freshServer();
  const fake = fakeConnect({ statusCheck: true });
  useConnect(fake.cfg);
  let { cookie } = await signIn(fake);
  assert.equal((await meFor(cookie)).canRead, true);
  assert.equal(fake.statusCalls, 0, "a new note is not checked again at once");

  fake.scopes = ["site.edit"];
  await age(9);
  assert.equal((await meFor(cookie)).canPublish, true, "nine minutes on, the note still stands");
  assert.equal(fake.statusCalls, 0);
  await age(2);
  const narrowed = await meFor(cookie);
  assert.deepEqual([narrowed.canRead, narrowed.canEdit, narrowed.canPublish, narrowed.readAgain], [false, true, false, false], "Connect took reading and publishing away");
  assert.equal(fake.statusCalls, 1);
  assert.deepEqual(await refusal(await answersFor(cookie)), [403, "staff.forbidden"]);
  assert.equal((await meFor(cookie)).canEdit, true);
  assert.equal(fake.statusCalls, 1, "checked once, then trusted for ten minutes");

  fake.scopes = ["forms.read:*", "site.edit", "site.publish"];
  await age(11);
  assert.deepEqual([(await meFor(cookie)).canRead, fake.statusCalls], [false, 2], "a check never adds access; signing in again does");

  // Every form narrowed to one leaves that one.
  ({ cookie } = await signIn(fake));
  fake.scopes = ["forms.read:workshop-request", "site.edit", "site.publish"];
  await age(11);
  assert.deepEqual((await (await handle(get("/api/staff/forms", { cookie }), ip())).json()).forms.map((f) => f.key), ["workshop-request"]);
  assert.deepEqual(await refusal(await answersFor(cookie, "programming-feedback")), [403, "staff.forbidden"]);

  // Switched off in Connect: the next check ends the session here.
  fake.active = false;
  await age(11);
  assert.equal(await meFor(cookie), 401);
  assert.equal((await answersFor(cookie)).status, 401, "a direct request for answers is refused");
  assert.equal((await handle(staffPost("/api/staff/edit/save", SKIP, cookie), ip())).status, 401);
  assert.equal((await (await handle(get("/api/auth/status", { cookie }), ip())).json()).signedIn, false);
  const id = cookie.match(/bss_staff=([^;]+)/)[1];
  assert.equal((await one("SELECT count(*)::int AS n FROM staff_sessions WHERE id_hash = $1", [crypto.createHash("sha256").update(id).digest("hex")])).n, 0, "the session row is gone");
});

test("a Google-opened Connect session is kept as one, the status check says so, and Connect switching Google off ends it here", async () => {
  await freshServer();
  const fake = fakeConnect({ statusCheck: true });
  fake.method = "google";
  useConnect(fake.cfg);
  const g = await signIn(fake);
  assert.equal((await meFor(g.cookie)).canRead, true);
  assert.deepEqual((await many("SELECT method FROM staff_sessions")).map((x) => x.method), ["google"]);

  // A password sign-in beside it, and a note from a Connect that sends no method, are password ones.
  fake.method = null;
  const p = await signIn(fake);
  assert.deepEqual((await many("SELECT method FROM staff_sessions ORDER BY method")).map((x) => x.method), ["google", "password"]);

  await age(11);
  assert.equal((await meFor(g.cookie)).canRead, true);
  assert.equal((await meFor(p.cookie)).canRead, true);
  assert.deepEqual([...fake.statusMethods].sort(), ["google", "password"], "each check asks about the route its own session came by");

  // Connect's Google route switched off: the Google-opened session ends at its next check, the password one does not.
  fake.googleOn = false;
  await age(11);
  assert.equal(await meFor(g.cookie), 401, "the Google-opened session ends");
  assert.equal((await answersFor(g.cookie)).status, 401);
  assert.equal((await meFor(p.cookie)).canRead, true, "the password one carries on");
  assert.deepEqual((await many("SELECT method FROM staff_sessions")).map((x) => x.method), ["password"], "only the Google row is gone");

  // Without the status check, a method alone changes nothing about how long a session lasts.
  await freshServer();
  const quiet = fakeConnect();
  quiet.method = "google";
  useConnect(quiet.cfg);
  const q1 = await signIn(quiet);
  quiet.googleOn = false;
  await age(30);
  assert.equal((await meFor(q1.cookie)).canEdit, true, "with CONNECT_SESSION_STATUS off, Connect is not asked");
  assert.equal(quiet.statusCalls, 0);
});

test("the staff page's quote comes from Connect's one list, read at most every five minutes, and is none when there is nothing to show", async () => {
  await freshServer();
  resetQuoteCache();
  const quotesNow = async () => {
    const r = await handle(get("/api/signin-quotes"), ip());
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    return (await r.json()).quotes;
  };
  assert.deepEqual(await quotesNow(), [], "Connect not set up: no quote");

  const fake = fakeConnect();
  fake.quotes = ["Be kind; everyone you meet is fighting a hard battle.", "x".repeat(301), 7];
  useConnect(fake.cfg);
  resetQuoteCache();
  assert.deepEqual(await quotesNow(), ["Be kind; everyone you meet is fighting a hard battle."], "only plain lines within the limit");
  fake.quotes = [];
  assert.deepEqual(await quotesNow(), ["Be kind; everyone you meet is fighting a hard battle."], "kept for five minutes");
  assert.equal(fake.quoteCalls, 1);
  resetQuoteCache();
  assert.deepEqual(await quotesNow(), [], "Show switched off in Connect: no quote");
  fake.quotes = "down";
  resetQuoteCache();
  assert.deepEqual(await quotesNow(), [], "Connect not answering: no quote, and nothing is refused");
  const asked = fake.quoteCalls;
  fake.quotes = ["Back again."];
  assert.deepEqual(await quotesNow(), [], "a failure is kept for a minute, so Connect is not asked on every page");
  assert.equal(fake.quoteCalls, asked);

  // The page itself: no help folded under the button, and a quote line the browser fills, empty until it does.
  const page = await handle(new Request(ORIGIN + "/staff/", { headers: { accept: "text/html" } }), ip());
  if (page.status === 200) {
    const body = await page.text();
    assert.doesNotMatch(body, /About Signing In|data-staff-help/);
  }
  const built = fs.readFileSync(path.join(ROOT, "src/render/blocks/staff.mjs"), "utf8");
  assert.match(built, /data-staff-quote hidden/);
  assert.doesNotMatch(built, /staff-help|helpTitle/);
});

test("with the status check on, Connect not answering keeps a session as it was for half an hour, then nothing works until it answers", async () => {
  for (const mode of ["down", "refuse", "badsig", "replay"]) {
    await freshServer();
    const fake = fakeConnect({ statusCheck: true });
    useConnect(fake.cfg);
    const { cookie } = await signIn(fake);
    await age(11);
    assert.equal((await meFor(cookie)).canRead, true, `${mode}: a first check, which a replay will resend`);

    fake.status = mode;
    fake.scopes = ["site.edit"];
    await age(11);
    const kept = await meFor(cookie);
    assert.deepEqual([kept.canRead, kept.canPublish], [true, true], `${mode}: eleven minutes after Connect's last answer, kept as it was`);

    await age(20);
    assert.equal(await meFor(cookie), 401, `${mode}: half an hour on, refused`);
    assert.equal((await answersFor(cookie)).status, 401, mode);
    assert.equal((await handle(staffPost("/api/staff/outbox/retry", {}, cookie), ip())).status, 401, mode);
    assert.equal((await handle(staffPost("/api/staff/edit/save", SKIP, cookie), ip())).status, 401, mode);
    assert.equal((await one("SELECT count(*)::int AS n FROM staff_sessions")).n, 1, `${mode}: an outage is not a sign-out`);

    fake.status = "ok";
    const back = await meFor(cookie);
    assert.deepEqual([back.canRead, back.canEdit, back.canPublish], [false, true, false], `${mode}: Connect answering again brings the session back, as Connect now says`);
  }
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

test("opening the staff page sends nothing, and Try again sends only the forms the reader may read", async () => {
  await freshServer();
  const fake = fakeConnect({ scopes: ["forms.read:*"] });
  fake.ingest = "refuse";
  useConnect(fake.cfg);
  const send = async (path, body) => (await (await handle(post(path, body), ip())).json()).ref;
  const workshop = await send("/api/forms/workshop-request/submit", workshopAnswers({ _key: "k-0401-aaaa" }));
  const feedback = await send("/api/forms/programming-feedback/submit", {
    _form: "programming-feedback", _version: "1", _key: "k-0402-bbbb", category: "craft", craft_activity: "bracelets_f26", craft_enjoyed: "Calm room.",
  });
  await deliveriesSettled();
  // Both failed once and are due again; Connect now takes anything it is sent.
  await q("UPDATE outbox SET next_at = now() WHERE kind = 'connect.ingest'");
  fake.ingest = "ok";
  const rows = async () => Object.fromEntries((await many(
    `SELECT s.form_key, o.state FROM outbox o JOIN submissions s ON s.id = o.submission_id WHERE o.kind = 'connect.ingest'`)).map((r) => [r.form_key, r.state]));
  const as = async (scopes) => { fake.scopes = scopes; return (await signIn(fake)).cookie; };
  const retry = (cookie, opts) => handle(staffPost("/api/staff/outbox/retry", {}, cookie, opts), ip());
  assert.deepEqual(await rows(), { "workshop-request": "failed", "programming-feedback": "failed" });

  // Reading is reading, even for a reader of every form.
  const all = await as(["forms.read:*"]);
  assert.equal((await handle(get("/api/staff/forms", { cookie: all }), ip())).status, 200);
  await deliveriesSettled();
  assert.deepEqual(await rows(), { "workshop-request": "failed", "programming-feedback": "failed" }, "opening the staff page sent something");
  assert.equal(fake.received.length, 0);

  // A reader of a form with nothing waiting sends nothing.
  const other = await retry(await as(["forms.read:email-list"]));
  assert.equal(other.status, 200);
  assert.deepEqual(((b) => [b.sent, b.failed, b.forms.map((f) => f.key)])(await other.json()), [0, 0, ["email-list"]]);
  assert.deepEqual(await rows(), { "workshop-request": "failed", "programming-feedback": "failed" }, "an unrelated reader's Try again sent another form");

  // Editing or publishing words is not reading answers.
  const editor = await retry(await as(["site.edit", "site.publish"]));
  assert.deepEqual([editor.status, (await editor.json()).error], [403, "staff.forbidden"]);

  // Asked directly, without a session or from another site, the server says no and sends nothing.
  const reader = await as(["forms.read:workshop-request"]);
  assert.equal((await retry("")).status, 401);
  assert.equal((await retry(reader, { origin: "https://elsewhere.example" })).status, 403);
  assert.equal((await retry(reader, { headers: { cookie: reader, "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal(fake.received.length, 0);

  // A reader of one form sends that form's answers and leaves the other's alone.
  const mine = await retry(reader);
  const mb = await mine.json();
  assert.deepEqual([mb.sent, mb.failed, mb.forms.map((f) => f.key)], [1, 0, ["workshop-request"]]);
  assert.deepEqual(await rows(), { "workshop-request": "sent", "programming-feedback": "failed" });
  assert.deepEqual(fake.received.map((b) => b.ref), [workshop]);

  // forms.read:* covers every form, so its Try again sends the rest.
  const rest = await (await retry(all)).json();
  assert.deepEqual([rest.sent, rest.failed], [1, 0]);
  assert.deepEqual(fake.received.map((b) => b.ref), [workshop, feedback]);
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
  assert.equal(s.entry.by, "Robin Example");
  // A permitted save publishes (owner, 24 Oct 2026): it is revision 1, and nothing waits.
  assert.equal(s.published?.n, 1, "the save is the published revision");
  assert.equal(s.publishError, null);
  assert.equal(s.entry.waiting, false);
  assert.equal(s.waiting, 0);
  const me = await (await handle(get("/api/staff/me", { cookie }), ip())).json();
  assert.equal(me.waiting, 0);
  assert.equal(me.published.n, 1);
  assert.deepEqual((await currentRevision({ fresh: true })).edits, { [HERO]: "badger supports, together" });

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
  assert.equal(back.published.n, 2, "putting it back publishes too");
  assert.deepEqual((await currentRevision({ fresh: true })).edits, {});
  const rows = await many("SELECT target, value, previous, edited_by FROM content_edits");
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ target: HERO, value: hero.original, previous: "badger supports, together", edited_by: "u-test-0001" }]);
  const file = await (await handle(get("/api/staff/edits", { cookie }), ip())).json();
  assert.deepEqual(file.edits, {}, "an edit equal to the shipped words is not in the file");

  // Each save that changes words publishes the next revision; a save that changes nothing publishes nothing.
  const changed = await (await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to Content", value: "Skip to the page" }, cookie), ip())).json();
  assert.equal(changed.published.n, 3);
  const same = await (await handle(staffPost("/api/staff/edit/save", { target: "text:page.skip", expected: "Skip to the page", value: "Skip to the page" }, cookie), ip())).json();
  assert.equal(same.changed, false);
  assert.equal(same.published, null);
  assert.equal((await currentRevision({ fresh: true })).n, 3);
});

test("every saved version is kept, newest first, and Restore saves an earlier one again as the newest", async () => {
  const db = await freshServer();
  const fake = fakeConnect({ scopes: ["site.edit"] });
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);
  const history = (target) => handle(get(`/api/staff/edit/history?target=${encodeURIComponent(target)}`, { cookie }), ip());
  const save = async (expected, value) => (await handle(staffPost("/api/staff/edit/save", { target: HERO, expected, value }, cookie), ip())).json();
  const shipped = serverContent().editable[HERO].shown;

  const none = await history(HERO);
  assert.equal(none.status, 200);
  assert.equal(none.headers.get("cache-control"), "no-store");
  assert.deepEqual(await none.json(), { ok: true, target: HERO, original: shipped, versions: [] });

  await save(shipped, "first words");
  await save("first words", "second words");
  await save("second words", "second words"); // nothing changed, so no new version
  const two = await (await history(HERO)).json();
  assert.deepEqual(two.versions.map((v) => v.value), ["second words", "first words"]);
  assert.ok(two.versions.every((v) => v.by === "Robin Example" && !Number.isNaN(Date.parse(v.at))));
  assert.ok(!JSON.stringify(two).includes("u-test-0001"), "Connect's id for the person stays on the server");

  // Restore is a save of an earlier version's words: the same checks, and it becomes the newest.
  const restored = await save("second words", two.versions[1].value);
  assert.deepEqual([restored.changed, restored.entry.current], [true, "first words"]);
  const stale = await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: "second words", value: "second words" }, cookie), ip());
  assert.equal(stale.status, 409, "a Restore from a box opened before that is refused like any stale save");
  const three = await (await history(HERO)).json();
  assert.deepEqual(three.versions.map((v) => v.value), ["first words", "second words", "first words"]);
  assert.deepEqual(three.versions.slice(1).map((v) => v.id), two.versions.map((v) => v.id), "earlier versions keep their place");

  // The history only grows: every row is exactly as it was written.
  const rows = await many("SELECT value, previous, edited_by FROM content_edit_history WHERE target = $1 ORDER BY id", [HERO]);
  assert.deepEqual(rows.map((r) => [r.value, r.previous, r.edited_by]), [
    ["first words", shipped, "u-test-0001"], ["second words", "first words", "u-test-0001"], ["first words", "second words", "u-test-0001"]]);

  for (const target of ["text:no.such.key", "page:pg-home:b-home-hero/id", "nonsense", ""]) {
    const bad = await history(target);
    assert.equal(bad.status, 400, target);
    assert.equal((await bad.json()).error, "edit.target", target);
  }

  // Words saved before the history existed start it with their latest version, once.
  await q("INSERT INTO content_edits (target, value, previous, edited_by, edited_name) VALUES ($1, $2, $3, $4, $5)",
    ["text:page.skip", "Skip ahead", "Skip to Content", "u-test-0002", "Sam Example"]);
  await migrate(db);
  await migrate(db);
  const kept = await (await history("text:page.skip")).json();
  assert.deepEqual(kept.versions.map((v) => [v.value, v.by]), [["Skip ahead", "Sam Example"]]);
  assert.equal((await many("SELECT 1 FROM content_edit_history WHERE target = $1", [HERO])).length, 3, "and nothing else is copied");
});

test("values that are not words: each kind is checked on the server, saved with history, and published like words", async () => {
  await freshServer();
  const fake = fakeConnect({ scopes: ["site.edit"] });
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);
  const shipped = serverContent().editable;
  const save = async (target, value) => {
    const res = await handle(staffPost("/api/staff/edit/save", { target, expected: shipped[target].shown, value }, cookie), ip());
    return [res.status, await res.json()];
  };
  const cases = [
    ["page:pg-home:b-home-hero/primary/href", "link", "/about/what-we-do/", [["http://elsewhere.example/", "edit.link"], ["javascript:alert(1)", "edit.link"], ["https://user:pw@example.org/", "edit.link"], ["/a page/", "edit.markup"]]],
    ["page:pg-home:b-home-hero/circles/0/media", "media", "m-peer-couch", [["https://elsewhere.example/x.jpg", "edit.media"], ["m-no-such-photo", "edit.media"]]],
    ["page:pg-home:b-home-announce/enabled", "boolean", "false", [["maybe", "edit.choice"]]],
    ["page:pg-home:b-home-announce/endsOn", "date", "2026-12-01", [["2026-02-30", "edit.date"], ["soon", "edit.date"]]],
    ["page:pg-craft-nights:b-cn-next/show", "choice", "all", [["everything", "edit.choice"]]],
    ["page:pg-craft-nights:b-cn-next/count", "number", "4", [["-1", "edit.number"], ["4.5", "edit.number"], ["1000", "edit.number"]]],
    ["site:nav/0/children/0/href", "link", "https://example.org/about", [["ftp://example.org/", "edit.link"]]],
  ];
  for (const [target, kind, good, bad] of cases) {
    assert.equal(shipped[target]?.kind, kind, `${target} is a ${kind}`);
    const source = await (await handle(get(`/api/staff/edit/source?page=${target.split(":")[1].startsWith("pg-") ? target.split(":")[1] : "pg-home"}`, { cookie }), ip())).json();
    assert.equal(source.entries.find((e) => e.target === target)?.kind, kind, `the edit box is told ${target} is a ${kind}`);
    for (const [value, code] of bad) {
      const [status, body] = await save(target, value);
      assert.deepEqual([status, body.error], [422, code], `${target} refuses ${value}`);
    }
    const [status, body] = await save(target, good);
    assert.equal(status, 200, target);
    assert.equal(body.entry.current, good);
    assert.ok(body.published?.n >= 1, `${target} is published`);
  }
  const revision = await currentRevision({ fresh: true });
  assert.deepEqual(Object.keys(revision.edits).sort(), cases.map((c) => c[0]).sort());
  // A line filled in where it shows can be changed too, keeping each placeholder.
  assert.equal(shipped["text:strip.count"]?.shown, "{{n}} of {{total}}");
  const [dropped, why] = await save("text:strip.count", "{{n}} photos");
  assert.deepEqual([dropped, why.error], [422, "edit.placeholder"]);
  assert.equal((await save("text:strip.count", "Photo {{n}} of {{total}}"))[0], 200);
  // History and Restore are the same as for words.
  const hist = await (await handle(get(`/api/staff/edit/history?target=${encodeURIComponent(cases[0][0])}`, { cookie }), ip())).json();
  assert.deepEqual(hist.versions.map((v) => v.value), ["/about/what-we-do/"]);
});

test("a save whose revision cannot be written is kept and says so, and Refresh now publishes it", async () => {
  await freshServer();
  const fake = fakeConnect({ scopes: ["site.edit"] });
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);
  const hero = serverContent().editable[HERO];
  let down = true;
  const store = memoryStore();
  useStore({ kind: "flaky", get: (k) => (down ? Promise.reject(new Error("store down")) : store.get(k)), set: (k, v) => (down ? Promise.reject(new Error("store down")) : store.set(k, v)) });
  const was = console.error;
  console.error = () => {};
  try {
    const s = await (await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: hero.shown, value: "badger supports, kept" }, cookie), ip())).json();
    assert.equal(s.changed, true);
    assert.equal(s.published, null);
    assert.equal(s.publishError, "publish.unavailable");
    assert.equal(s.entry.current, "badger supports, kept", "the words are kept");
    assert.equal(s.entry.waiting, true, "and are not on the site yet");
    const me = await (await handle(get("/api/staff/me", { cookie }), ip())).json();
    assert.equal(me.publishError, "publish.unavailable", "the staff page is told why");
    down = false;
    const r = await handle(staffPost("/api/staff/refresh", {}, cookie), ip());
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.published.n, 1);
    assert.equal(body.publishError, undefined);
    assert.deepEqual((await store.get("current")).edits, { [HERO]: "badger supports, kept" });
  } finally { console.error = was; }
});

test("Refresh now: editors and publishers only, from this site, JSON, bounded, and it clears only the pages and the feeds", async () => {
  await freshServer();
  const cleared = [];
  usePurger(async (tags) => { cleared.push(...tags); });
  try {
    const as = async (opts) => { const f = fakeConnect(opts); useConnect(f.cfg); return signIn(f); };
    const reader = await as({ scopes: ["forms.read:*"] });
    const editor = await as({ scopes: ["site.edit"] });
    const publisher = await as({ scopes: ["site.publish"], name: "Avery Example" });
    const refresh = (cookie, opts) => handle(staffPost("/api/staff/refresh", {}, cookie, opts), ip());

    assert.equal((await handle(post("/api/staff/refresh", {}), ip())).status, 401, "signed out");
    const denied = await refresh(reader.cookie);
    assert.equal(denied.status, 403, "reading answers is not editing; no title grants it");
    assert.equal((await denied.json()).error, "staff.forbidden");
    assert.equal((await refresh(editor.cookie, { origin: "https://elsewhere.example" })).status, 403, "a page elsewhere cannot send it");
    assert.equal((await refresh(editor.cookie, { json: false })).status, 415, "a plain form post cannot either");
    assert.deepEqual(cleared, [], "nothing was cleared by a refused ask");

    const ok = await refresh(editor.cookie);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.deepEqual(cleared, ["page", "events"]);
    assert.equal((await refresh(publisher.cookie)).status, 429, "one a minute for the whole site");
    await q("DELETE FROM rate_limits WHERE bucket = 'refresh:site'");
    assert.equal((await refresh(publisher.cookie)).status, 200, "site.publish may refresh too");
    // The fake Connect gives each account the same Connect id (u-test-0001), so these count as one person's:
    // three so far, the refused one included.
    for (let i = 0; i < 2; i++) { await q("DELETE FROM rate_limits WHERE bucket = 'refresh:site'"); assert.equal((await refresh(editor.cookie)).status, 200); }
    await q("DELETE FROM rate_limits WHERE bucket = 'refresh:site'");
    assert.equal((await refresh(editor.cookie)).status, 200, "the sixth in the hour");
    await q("DELETE FROM rate_limits WHERE bucket = 'refresh:site'");
    assert.equal((await refresh(editor.cookie)).status, 429, "and no seventh");
  } finally { usePurger(null); }
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
  assert.equal(undo.waiting, 0, "the save published the undo (owner, 24 Oct 2026: a permitted save publishes)");
});

/* ------------------------------------------------------------------ §12, against the local rig (fixture) */

test("§12 staff-only caching: every private, sign-in and form answer is no-store and carries nothing for the CDN", async () => {
  await freshServer();
  const fake = fakeConnect();
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);
  await handle(post("/api/forms/workshop-request/submit", workshopAnswers()), ip(7));
  const shipped = serverContent().editable;
  const asked = [
    get("/api/staff/me", { cookie }), get("/api/staff/forms", { cookie }), get("/api/staff/forms/workshop-request/submissions", { cookie }),
    get("/api/staff/edit/source?page=pg-home", { cookie }), get(`/api/staff/edit/history?target=${encodeURIComponent(HERO)}`, { cookie }),
    get("/api/staff/edits", { cookie }), get("/api/staff/edits?download=1", { cookie }), get("/api/staff/nowhere", { cookie }),
    get("/api/staff/me"), get("/api/auth/status", { cookie }), get("/api/auth/start", { json: false }), get("/api/auth/callback?state=x&code=y", { json: false }),
    staffPost("/api/staff/edit/save", { target: HERO, expected: shipped[HERO].shown, value: "badger supports, cached nowhere" }, cookie),
    staffPost("/api/staff/outbox/retry", {}, cookie), staffPost("/api/staff/refresh", {}, cookie),
    post("/api/forms/workshop-request/submit", workshopAnswers({ group_notes: "A second request." })), post("/api/auth/signout", {}, { headers: { cookie } }),
  ];
  for (const req of asked) {
    const res = await handle(req, ip(8));
    const where = `${req.method} ${new URL(req.url).pathname}${new URL(req.url).search} (${res.status})`;
    assert.equal(res.headers.get("cache-control"), "no-store", where);
    for (const h of ["netlify-cdn-cache-control", "cdn-cache-control", "netlify-cache-tag", "netlify-vary"]) assert.equal(res.headers.get(h), null, `${where}: ${h}`);
  }
});

test("§12 analytics leakage: a page the API draws is not counted and not for search engines", async () => {
  await freshServer();
  const pages = [
    await handle(post("/api/forms/workshop-request/submit", { ...workshopAnswers(), email: "not an email" }, { json: false }), ip(9)),
    await handle(get("/api/auth/callback?state=x&code=y", { json: false }), ip(9)),
    await handle(get("/api/calendar/connect-nothing.ics", { json: false }), ip(9)),
    await handle(post("/api/mood", { mood: "great" }, { json: false }), ip(9)),
  ];
  for (const res of pages) {
    const body = await res.text();
    assert.match(res.headers.get("content-type"), /^text\/html/);
    assert.match(body, /data-analytics="none"/, `${res.status}: not counted`);
    assert.match(body, /<meta name="robots" content="noindex">/, `${res.status}: not for search engines`);
  }
});

test("§12 editor to public page: a save is on the page the next visitor gets, and Restore puts it back", async () => {
  await freshServer();
  const out = path.join(ROOT, "local/test-build-editor-to-page");
  await build({ out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-20" });
  const content = JSON.parse(fs.readFileSync(path.join(out, "_server/server.json"), "utf8"));
  useContent(content);
  useDist(out);
  const fake = fakeConnect({ scopes: ["site.edit"] });
  useConnect(fake.cfg);
  const { cookie } = await signIn(fake);
  const visitor = async () => (await handlePage(new Request(`${ORIGIN}/`), { today: "2026-10-20" })).text();
  const before = await visitor();
  assert.equal(before, fs.readFileSync(path.join(out, "index.html"), "utf8"));
  const shown = content.editable[HERO].shown;
  const s = await (await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: shown, value: "Made-up words for the visitor" }, cookie), ip())).json();
  assert.equal(s.published.n, 1);
  const after = await visitor();
  assert.match(after, /Made-up words for the visitor/);
  assert.doesNotMatch(after, /Robin Example|u-test-0001/, "nothing about the editor reaches the page");
  const back = await (await handle(staffPost("/api/staff/edit/save", { target: HERO, expected: "Made-up words for the visitor", value: shown }, cookie), ip())).json();
  assert.equal(back.published.n, 2);
  assert.equal(await visitor(), before, "putting the words back gives the build's page byte for byte");
});

/* ------------------------------------------------------------------ the form switch (item 17) */

test("item 17: the switch opens and closes a form with no deploy, Open needs a second yes, and only forms.switch may use it", async () => {
  await freshServer();
  const out = path.join(ROOT, "local/test-build-form-switch");
  await build({ out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-20" });
  useContent(JSON.parse(fs.readFileSync(path.join(out, "_server/server.json"), "utf8")));
  useDist(out);
  const cleared = [];
  usePurger(async (tags) => { cleared.push(...tags); });
  try {
    const as = async (opts) => { const f = fakeConnect(opts); useConnect(f.cfg); return signIn(f); };
    const reader = await as({ scopes: ["forms.read:*"] });
    const other = await as({ scopes: ["forms.switch:workshop-request"] });
    const switcher = await as({ scopes: ["forms.switch:*"], name: "Avery Example" });
    const flip = (cookie, key, body, opts) => handle(staffPost(`/api/staff/forms/${key}/switch`, body, cookie, opts), ip());
    const visitor = async (p) => (await handlePage(new Request(`${ORIGIN}${p}`), { today: "2026-10-20" })).text();
    const FORM = "resource-problem", PAGE = "/forms/resource-problem/";
    const before = await visitor(PAGE);
    assert.equal(before, fs.readFileSync(path.join(out, "forms/resource-problem/index.html"), "utf8"), "no switch row: the build's page byte for byte");
    assert.match(before, /data-form-closed="resource-problem"/);

    assert.equal((await handle(post(`/api/staff/forms/${FORM}/switch`, { state: "open", confirm: FORM }), ip())).status, 401, "signed out");
    assert.deepEqual(await refusal(await flip(reader.cookie, FORM, { state: "open", confirm: FORM })), [403, "staff.forbidden"], "reading answers is not switching");
    assert.deepEqual(await refusal(await flip(other.cookie, FORM, { state: "open", confirm: FORM })), [403, "staff.forbidden"], "another form's switch");
    assert.equal((await flip(switcher.cookie, FORM, { state: "open", confirm: FORM }, { origin: "https://elsewhere.example" })).status, 403, "a page elsewhere");
    assert.equal((await flip(switcher.cookie, FORM, { state: "open", confirm: FORM }, { json: false })).status, 415, "a plain form post");
    assert.deepEqual(await refusal(await flip(switcher.cookie, FORM, { state: "open" })), [409, "switch.confirm"], "Open with no second yes");
    assert.deepEqual(await refusal(await flip(switcher.cookie, FORM, { state: "open", confirm: "workshop-request" })), [409, "switch.confirm"], "a yes for another form");
    assert.deepEqual(await refusal(await flip(switcher.cookie, FORM, { state: "on" })), [400, "switch.state"]);
    assert.deepEqual(await refusal(await flip(switcher.cookie, "no-such-form", { state: "closed" })), [404, "form.unknown"]);
    assert.equal((await many("SELECT * FROM form_state")).length, 0, "nothing refused was written");
    assert.deepEqual(cleared, [], "and nothing was cleared");

    const opened = await flip(switcher.cookie, FORM, { state: "open", confirm: FORM });
    assert.equal(opened.status, 200);
    assert.equal(opened.headers.get("cache-control"), "no-store");
    assert.deepEqual(await opened.json(), { ok: true, key: FORM, state: "open" });
    assert.deepEqual({ ...(await one("SELECT state, changed_by FROM form_state WHERE form_key = $1", [FORM])) }, { state: "open", changed_by: "u-test-0001" });
    assert.deepEqual(cleared.sort(), [`form:${FORM}`, "page:pg-form-resource-problem"], "its page and its state answer, nothing else");
    const open = await visitor(PAGE);
    assert.doesNotMatch(open, /data-form-closed/);
    assert.match(open, /<button type="submit" class="btn" data-submit>/, "the next visitor gets the form");
    assert.doesNotMatch(open, /Avery Example|u-test-0001/, "nothing about the director reaches the page");
    const state = await handle(new Request(`${ORIGIN}/api/forms/${FORM}/state`), ip());
    assert.equal((await state.json()).state, "open");
    assert.equal(state.headers.get("netlify-cache-tag"), `form:${FORM}`, "the state answer can be cleared by its own tag");

    const list = await (await handle(get("/api/staff/forms", { cookie: switcher.cookie }), ip())).json();
    const card = list.forms.find((f) => f.key === FORM);
    assert.deepEqual([card.state, card.canSwitch, card.canRead, card.total], ["open", true, false, 0], "a switcher sees the switch, not the answers");
    const me = await (await handle(get("/api/staff/me", { cookie: switcher.cookie }), ip())).json();
    assert.deepEqual([me.canSwitch, me.canRead], [true, false]);
    const rlist = await (await handle(get("/api/staff/forms", { cookie: reader.cookie }), ip())).json();
    assert.equal(rlist.forms.find((f) => f.key === FORM).canSwitch, false);

    cleared.length = 0;
    const closed = await flip(switcher.cookie, FORM, { state: "closed" });
    assert.deepEqual(await closed.json(), { ok: true, key: FORM, state: "closed" }, "Close needs no second yes");
    assert.deepEqual(cleared.sort(), [`form:${FORM}`, "page:pg-form-resource-problem"]);
    assert.match(await visitor(PAGE), /data-form-closed="resource-problem"/);

    // A door to a form shows its state on the pages that carry the door: the home page and Get Involved.
    cleared.length = 0;
    const doors = async () => [await visitor("/"), await visitor("/join/get-involved/")].map((h) => (h.match(/chip--closed/g) || []).length);
    const shut = await doors();
    assert.ok(shut.every((n) => n > 0), "the staff application's door says Applications Closed");
    assert.equal((await flip(switcher.cookie, "staff-application", { state: "open", confirm: "staff-application" })).status, 200);
    assert.deepEqual(cleared.sort(), ["form:staff-application", "page:pg-get-involved", "page:pg-home"]);
    assert.deepEqual(await doors(), shut.map((n) => n - 1), "open: the doors drop the tag");
    await flip(switcher.cookie, "staff-application", { state: "closed" });
    assert.deepEqual(await doors(), shut);
  } finally { usePurger(null); }
});

test("item 17: a switch the CDN could not clear still holds, and the reply says the pages may lag", async () => {
  await freshServer();
  usePurger(async () => { throw Object.assign(new Error("down"), { code: "purge.unavailable" }); });
  try {
    const f = fakeConnect({ scopes: ["forms.switch:workshop-request"] });
    useConnect(f.cfg);
    const { cookie } = await signIn(f);
    const r = await handle(staffPost("/api/staff/forms/workshop-request/switch", { state: "closed" }, cookie), ip());
    assert.deepEqual(await r.json(), { ok: true, key: "workshop-request", state: "closed", purgeError: "purge.unavailable" });
    assert.equal((await currentForm("workshop-request")).state, "closed", "the server refuses a send at once");
  } finally { usePurger(null); }
});

test("item 17: at launch a form points to its Google Form until the switch decides; then the switch alone says open or closed", async () => {
  await freshServer();
  useContent({ ...serverContent(), forms: launchForms(serverContent().forms) });
  const at = await currentForm("workshop-request");
  assert.equal(at.state, "closed");
  assert.match(at.def.elsewhere, /^https:\/\/docs\.google\.com\/forms\//, "no switch row: the launch build's link stands");
  await setSwitch("workshop-request", "open", "test");
  const open = await currentForm("workshop-request");
  assert.deepEqual([open.state, open.def.elsewhere], ["open", undefined]);
  await setSwitch("workshop-request", "closed", "test");
  const shut = await currentForm("workshop-request");
  assert.deepEqual([shut.state, shut.def.elsewhere], ["closed", undefined], "closed by a director: its own message, not the Google Form");
});

/* ------------------------------------------------------------------ pages: drafts, preview, restore (item 16) */

let pagesBuild = null;
/* One build for these cases, a fresh database and store for each, and every purge recorded. */
async function pagesSite(t) {
  await freshServer();
  if (!pagesBuild) {
    const out = path.join(ROOT, "local/test-build-pages");
    await build({ out, serverDir: path.join(out, "_server"), media: false, today: "2026-10-20" });
    pagesBuild = { out, content: JSON.parse(fs.readFileSync(path.join(out, "_server/server.json"), "utf8")) };
  }
  useContent(pagesBuild.content);
  useDist(pagesBuild.out);
  const cleared = [];
  usePurger(async (tags) => { cleared.push(...tags); });
  t.after(() => usePurger(null));
  const as = async (scopes, name) => { const f = fakeConnect({ scopes, name }); useConnect(f.cfg); return (await signIn(f)).cookie; };
  return { cleared, as, content: pagesBuild.content };
}
const pagesNow = async (cookie) => (await handle(get("/api/staff/pages", { cookie }), ip())).json();
const change = async (cookie, body, opts) => { const r = await handle(staffPost("/api/staff/pages", body, cookie, opts), ip()); return { status: r.status, body: await r.json() }; };
const visit = (p) => handlePage(new Request(`${ORIGIN}${p}`), { today: "2026-10-20" });
const preview = (cookie, id) => handle(get(`/api/staff/preview/${id}`, { cookie, json: false }), ip());
const saveWord = async (cookie, target, expected, value) => (await handle(staffPost("/api/staff/edit/save", { target, expected, value }, cookie), ip())).json();
const sourceOf = async (cookie, id) => (await (await handle(get(`/api/staff/edit/source?page=${id}`, { cookie }), ip())).json()).entries;
const menuOf = (html) => html.match(/<nav\b[\s\S]*?<\/nav>/)[0];

test("item 16: a new page is a draft only staff can preview; its words save like any other; a publisher puts it on", async (t) => {
  const { as, cleared } = await pagesSite(t);
  const editor = await as(["site.edit"]);
  const publisher = await as(["site.edit", "site.publish"], "Avery Example");
  const before = await pagesNow(editor);
  assert.equal(before.ok, true);
  assert.ok(before.pages.some((p) => p.id === "pg-press" && p.state === "live" && p.path === "/operations/press/"));
  const made = await change(editor, { action: "add", expected: before.version, title: "Spring Retreat", path: "/programs/spring-retreat/" });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const id = made.body.page;
  assert.equal(id, "pg-spring-retreat");
  assert.equal((await visit("/programs/spring-retreat/")).status, 404, "nobody outside the staff page sees a draft");
  const pv = await preview(editor, id);
  assert.equal(pv.status, 200);
  assert.equal(pv.headers.get("cache-control"), "no-store");
  assert.match(pv.headers.get("x-robots-tag") || "", /noindex/);
  assert.match(pv.headers.get("content-security-policy") || "", /frame-ancestors 'self'/);
  assert.match(await pv.text(), /<h1[^>]*>Spring Retreat</);
  assert.equal((await preview("", id)).status, 401);
  assert.equal((await preview(editor, "pg-nobody-made-this")).status, 404);

  const head = (await sourceOf(editor, id)).find((e) => /^page:pg-spring-retreat:b-[a-z0-9-]+\/title$/.test(e.target));
  assert.ok(head, "the new page's words are in the edit list");
  assert.equal((await saveWord(editor, head.target, head.current, "Spring Retreat 2027")).changed, true);
  assert.match(await (await preview(editor, id)).text(), /Spring Retreat 2027/);
  assert.equal((await visit("/programs/spring-retreat/")).status, 404, "a saved word does not put a draft on");

  const now = await pagesNow(editor);
  assert.equal((await change(editor, { action: "publish", expected: now.version, page: id, group: "nav-programs", label: "Spring Retreat" })).status, 403);
  cleared.length = 0;
  const on = await change(publisher, { action: "publish", expected: now.version, page: id, group: "nav-programs", label: "Spring Retreat" });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.ok(on.body.published?.n >= 1);
  assert.ok(cleared.includes("page"), "every page is cleared: the menu is on each, and the address was the 404 page");
  const live = await visit("/programs/spring-retreat/");
  assert.equal(live.status, 200);
  assert.match(await live.text(), /Spring Retreat 2027/);
  assert.match(menuOf(await (await visit("/")).text()), /<a [^>]*href="\/programs\/spring-retreat\/"[^>]*>\s*Spring Retreat\s*</, "in the menu, linked here");
  assert.equal((await pagesNow(editor)).pages.find((p) => p.id === id).state, "live");
});

test("item 16: a copy is a draft with new ids and the words as they stand, and none of the original's history", async (t) => {
  const { as, content } = await pagesSite(t);
  const editor = await as(["site.edit"]);
  const PR = "page:pg-press:b-pr-head/title";
  assert.equal((await saveWord(editor, PR, content.editable[PR].shown, "Press and Mentions")).changed, true);
  const v = await pagesNow(editor);
  const r = await change(editor, { action: "copy", expected: v.version, page: "pg-press", title: "Press Kit", path: "/operations/press-kit/" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const id = r.body.page;
  assert.equal(id, "pg-press-kit");
  const html = await (await preview(editor, id)).text();
  assert.match(html, /Press and Mentions/, "the words as they stand now");
  assert.match(html, /<title>Press Kit — Badger Supports<\/title>/);
  const original = new Set(Object.keys(content.editable).filter((k) => k.startsWith("page:pg-press:")).map((k) => k.split(":")[2].split("/")[0]));
  const copied = await sourceOf(editor, id);
  const own = copied.filter((e) => e.target.startsWith(`page:${id}:`));
  assert.ok(own.length >= 3);
  for (const e of own) assert.ok(!original.has(e.target.split(":")[2].split("/")[0]), `a new block id: ${e.target}`);
  const h = await (await handle(get(`/api/staff/edit/history?target=${encodeURIComponent(own[0].target)}`, { cookie: editor }), ip())).json();
  assert.deepEqual(h.versions, []);
  assert.equal((await visit("/operations/press/")).status, 200, "the original stays on");
  assert.equal((await visit("/operations/press-kit/")).status, 404, "the copy is a draft");
  const again = await change(editor, { action: "copy", expected: r.body.version, page: "pg-press", title: "Press Kit", path: "/operations/press-kit/" });
  assert.deepEqual([again.status, again.body.error], [422, "page.path.taken"]);
  const other = await change(editor, { action: "copy", expected: r.body.version, page: "pg-press", title: "Press Kit", path: "/press-kit/" });
  assert.equal(other.body.page, "pg-press-kit-2", "an id is never used twice");
  for (const page of ["pg-staff", "pg-not-found"]) {
    const no = await change(editor, { action: "copy", expected: other.body.version, page, title: "A Copy", path: "/a-copy/" });
    assert.deepEqual([no.status, no.body.error], [422, "page.fixed"], page);
  }
});

test("item 16: a retired page leaves the menu, its address goes where the publisher says or to the 404 page, and its id stays used", async (t) => {
  const { as } = await pagesSite(t);
  const editor = await as(["site.edit"]);
  const publisher = await as(["site.edit", "site.publish"]);
  const v = await pagesNow(publisher);
  const what = v.pages.find((p) => p.path === "/about/what-we-do/").id;
  assert.equal((await change(editor, { action: "retire", expected: v.version, page: "pg-press", to: what })).status, 403);
  const r = await change(publisher, { action: "retire", expected: v.version, page: "pg-press", to: what });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const p of ["/operations/press/", "/operations/press"]) {
    const res = await visit(p);
    assert.equal(res.status, 301, p);
    assert.equal(res.headers.get("location"), "/about/what-we-do/");
    assert.match(res.headers.get("netlify-cache-tag") || "", /(^|,)page(,|$)/, "a purge reaches the move");
  }
  const faq = await change(publisher, { action: "retire", expected: r.body.version, page: "pg-about-faq" });
  assert.equal(faq.status, 200, JSON.stringify(faq.body));
  const gone = await visit("/about/faq/");
  assert.equal(gone.status, 404);
  assert.doesNotMatch(menuOf(await (await visit("/")).text()), /href="\/about\/faq\/"/, "off the menu");
  const taken = await change(editor, { action: "add", expected: faq.body.version, title: "Press", path: "/operations/press/" });
  assert.deepEqual([taken.status, taken.body.error], [422, "page.path.taken"]);
  const fresh = await change(editor, { action: "add", expected: faq.body.version, title: "Press", path: "/press/" });
  assert.equal(fresh.body.page, "pg-press-2", "a retired page's id is never given again");
  for (const page of ["pg-home", "pg-not-found", "pg-staff"]) {
    const no = await change(publisher, { action: "retire", expected: fresh.body.version, page });
    assert.deepEqual([no.status, no.body.error], [422, "page.fixed"], page);
  }
  const listed = (await pagesNow(editor)).pages.find((p) => p.id === "pg-press");
  assert.equal(listed.state, "retired");
});

test("item 16: a new address keeps the old one working, and the menu reorders by entry, so its saved words follow", async (t) => {
  const { as, content } = await pagesSite(t);
  const editor = await as(["site.edit"]);
  const publisher = await as(["site.edit", "site.publish"]);
  const ABOUT = "site:nav/0/label";
  assert.equal((await saveWord(editor, ABOUT, content.editable[ABOUT].shown, "Who We Are")).changed, true);
  const v = await pagesNow(publisher);
  assert.equal((await change(editor, { action: "details", expected: v.version, page: "pg-about-faq", path: "/about/questions/" })).status, 403);
  const moved = await change(publisher, { action: "details", expected: v.version, page: "pg-about-faq", path: "/about/questions/" });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal((await visit("/about/questions/")).status, 200);
  for (const p of ["/about/faq/", "/about/faq"]) {
    const res = await visit(p);
    assert.deepEqual([res.status, res.headers.get("location")], [301, "/about/questions/"], p);
  }
  let menu = menuOf(await (await visit("/")).text());
  assert.match(menu, /href="\/about\/questions\/"/);
  assert.doesNotMatch(menu, /href="\/about\/faq\/"/);

  const m = (await pagesNow(publisher)).menu;
  assert.deepEqual(m.slice(0, 2).map((x) => x.id), ["nav-about", "nav-programs"]);
  const order = [m[1], m[0], ...m.slice(2)].map((x) => ({ id: x.id, ...(x.children ? { children: x.children.map((c) => c.id) } : {}) }));
  const re = await change(publisher, { action: "menu", expected: moved.body.version, menu: order });
  assert.equal(re.status, 200, JSON.stringify(re.body));
  menu = menuOf(await (await visit("/")).text());
  assert.ok(menu.indexOf("Programs") < menu.indexOf("Who We Are"), "Programs first, and About keeps its saved name");
  for (const bad of [[...order, { id: "nav-nobody" }], [...order, { id: order[0].id }]]) {
    const no = await change(publisher, { action: "menu", expected: re.body.version, menu: bad });
    assert.deepEqual([no.status, no.body.error], [422, "menu.entry"]);
  }
  const back = await change(publisher, { action: "details", expected: re.body.version, page: "pg-about-faq", path: "/about/faq/" });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal((await visit("/about/faq/")).status, 200, "moving back takes the address back");
  assert.equal((await visit("/about/questions/")).headers.get("location"), "/about/faq/");
});

test("item 16: a stale tab is refused with what is there now; bad addresses and titles are refused; visitors reach none of it", async (t) => {
  const { as } = await pagesSite(t);
  const editor = await as(["site.edit"]);
  const reader = await as(["forms.read:*"]);
  const v = await pagesNow(editor);
  const first = await change(editor, { action: "add", expected: v.version, title: "First Page", path: "/first-page/" });
  assert.equal(first.status, 200);
  const stale = await change(editor, { action: "add", expected: v.version, title: "Second Page", path: "/second-page/" });
  assert.deepEqual([stale.status, stale.body.error, stale.body.current], [409, "pages.conflict", first.body.version]);
  for (const p of ["/api/x/", "/assets/x/", "/staff/x/", "no-slash/", "/no-final-slash", "/Caps/", "/two//slashes/", "/a/b/c/d/e/", "/", "/home/", "/about/faq/"]) {
    const no = await change(editor, { action: "add", expected: first.body.version, title: "A Page", path: p });
    assert.equal(no.status, 422, p);
    assert.match(no.body.error, /^page\.path/, p);
  }
  for (const title of ["", "   ", "x".repeat(121)]) {
    const no = await change(editor, { action: "add", expected: first.body.version, title, path: "/a-page/" });
    assert.deepEqual([no.status, no.body.error], [422, "page.title"]);
  }
  const unknown = await change(editor, { action: "fly", expected: first.body.version });
  assert.deepEqual([unknown.status, unknown.body.error], [400, "pages.action"]);
  assert.equal((await change(editor, { action: "add", expected: first.body.version, title: "A Page", path: "/a-page/" }, { json: false })).status, 415);
  assert.equal((await handle(get("/api/staff/pages"), ip())).status, 401);
  assert.equal((await handle(get("/api/staff/pages", { cookie: reader }), ip())).status, 403);
  assert.equal((await change("", { action: "add", expected: first.body.version, title: "A Page", path: "/a-page/" })).status, 401);
  assert.equal((await preview(reader, first.body.page)).status, 403);
});

test("item 16: an earlier version of the site comes back as the newest, words and pages together, and only a publisher may bring it", async (t) => {
  const { as, content } = await pagesSite(t);
  const editor = await as(["site.edit"]);
  const publisher = await as(["site.edit", "site.publish"]);
  const shown = content.editable[HERO].shown;
  const a = await saveWord(publisher, HERO, shown, "Made-up words, version A");
  assert.equal(a.published.n, 1);
  const v = await pagesNow(publisher);
  const made = await change(publisher, { action: "add", expected: v.version, title: "Winter Fair", path: "/winter-fair/" });
  const on = await change(publisher, { action: "publish", expected: made.body.version, page: made.body.page });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal((await visit("/winter-fair/")).status, 200);
  const b = await saveWord(publisher, HERO, "Made-up words, version A", "Made-up words, version B");
  const list = await (await handle(get("/api/staff/versions", { cookie: editor }), ip())).json();
  assert.equal(list.ok, true);
  assert.deepEqual(list.versions.map((x) => x.n), [b.published.n, ...list.versions.slice(1).map((x) => x.n)]);
  assert.equal(list.versions.at(-1).n, 1);
  const restore = (cookie, n, expected) => handle(staffPost(`/api/staff/versions/${n}/restore`, { expected }, cookie), ip());
  assert.equal((await restore(editor, 1, list.expected)).status, 403);
  const stale = await restore(publisher, 1, "0:0");
  assert.equal(stale.status, 409);
  const res = await restore(publisher, 1, list.expected);
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.published.n, b.published.n + 1, "the earlier version is published as the newest");
  const home = await (await visit("/")).text();
  assert.match(home, /Made-up words, version A/);
  assert.doesNotMatch(home, /version B/);
  assert.equal((await visit("/winter-fair/")).status, 404, "a page made since that version comes off");
  const listed = (await pagesNow(editor)).pages.find((p) => p.id === made.body.page);
  assert.equal(listed.state, "retired", "and stays listed, so its id is never given again");
  const h = await (await handle(get(`/api/staff/edit/history?target=${encodeURIComponent(HERO)}`, { cookie: editor }), ip())).json();
  assert.deepEqual(h.versions.slice(0, 3).map((x) => x.value), ["Made-up words, version A", "Made-up words, version B", "Made-up words, version A"], "history only grows");
});
