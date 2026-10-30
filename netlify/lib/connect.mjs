/* The only file that talks to Badger Supports Connect (home.badgersupports.org).
 *
 * Calls, all signed server to server and never made from a browser:
 *   publicSsoToken    trade the one-time code Connect's sign-in page sent back for a signed note
 *                     of who this is and what they may do here (staff.mjs).
 *   publicSsoStatus   PROPOSED CHANGE, not in Connect yet: a fresh note for someone already signed
 *                     in, so a session here follows Connect within minutes (staff.mjs). Made only
 *                     with CONNECT_SESSION_STATUS=on; docs/ARCHITECTURE.md, "Staying signed in".
 *   publicFormIngest  hand one submission to Connect's Website Forms queue (deliver.mjs).
 *   publicEvents      the public event list, which the build reads (ops/connect-feed.mjs) and the
 *                     events refresh reads again between publishes (live-events.mjs).
 *
 * THE SIGNATURE IS CONNECT'S, BYTE FOR BYTE (its netlify/lib/public-service.mjs):
 * base64url(HMAC-SHA256(secret, ts \n nonce \n POST \n /api \n hex(sha256(raw body)))), in
 * x-public-key-id / x-public-timestamp / x-public-nonce / x-public-signature. Connect answers every
 * failure the same way ("Unknown action."), so a refusal here is reported as connect.refused and
 * never guessed at.
 *
 * Configuration is environment only, never a file in this repository:
 *   CONNECT_URL                  Connect's origin, e.g. https://home.badgersupports.org
 *   PUBLIC_SITE_SERVICE_KEY_ID   the key id Connect lists in PUBLIC_SITE_SERVICE_KEYS
 *   PUBLIC_SITE_SERVICE_SECRET   that key's secret (32 characters or more)
 *   PUBLIC_SSO_SECRET            the secret Connect signs sign-in notes with (32 or more)
 * With any of them missing, staff sign-in answers "not set up" and submissions wait in the outbox.
 *   CONNECT_SESSION_STATUS       "on" once Connect answers publicSsoStatus. Anything else, and
 *                                reading answers lasts an hour from signing in (staff.mjs).
 */

import crypto from "node:crypto";

export const CLIENT_ID = "badgersupports-public";
const TIMEOUT_MS = 8000;
const STATUS_TIMEOUT_MS = 4000;   // a status check holds up a staff request, so it waits less

let override;

/* Tests and the local rig install their own, including a fake fetch. null puts the environment back. */
export function useConnect(cfg) { override = cfg; }

export function connectConfig() {
  if (override !== undefined && override !== null) return override;
  const cfg = serviceConfig();
  const ssoSecret = String(process.env.PUBLIC_SSO_SECRET || "");
  return cfg && ssoSecret.length >= 32 ? { ...cfg, ssoSecret, statusCheck: process.env.CONNECT_SESSION_STATUS === "on" } : null;
}

/* Connect's address and the service key, without the sign-in secret: enough for the reads the build
   and the events refresh make. Null when any is missing. */
export function serviceConfig(env = process.env) {
  const url = String(env.CONNECT_URL || "").replace(/\/+$/, "");
  const keyId = String(env.PUBLIC_SITE_SERVICE_KEY_ID || "");
  const secret = String(env.PUBLIC_SITE_SERVICE_SECRET || "");
  if (!/^https?:\/\/[^\s/]+$/.test(url) || !keyId || secret.length < 32) return null;
  return { url, keyId, secret, fetch: globalThis.fetch };
}

/* The one a test or the local rig installed, else serviceConfig(). */
export const serviceConfigNow = () => (override !== undefined && override !== null ? override : serviceConfig());

/* ------------------------------------------------------------------ the signature */

export function canonicalJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (typeof value === "object") {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export const sha256Hex = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const sha256B64u = (s) => crypto.createHash("sha256").update(s).digest("base64url");
export const hmacB64u = (key, s) => crypto.createHmac("sha256", key).update(s).digest("base64url");
export const randomB64u = (bytes) => crypto.randomBytes(bytes).toString("base64url");

export const signatureBase = (ts, nonce, method, path, body) =>
  `${ts}\n${nonce}\n${String(method).toUpperCase()}\n${path}\n${sha256Hex(body || "")}`;

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* One signed POST to Connect's /api. Returns Connect's JSON, or throws connect.unreachable /
   connect.refused / connect.bad-reply. */
export async function call(cfg, body, { timeout = TIMEOUT_MS } = {}) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = randomB64u(18);
  const target = new URL("/api", cfg.url);
  const headers = {
    "content-type": "application/json",
    "x-public-key-id": cfg.keyId,
    "x-public-timestamp": ts,
    "x-public-nonce": nonce,
    "x-public-signature": hmacB64u(cfg.secret, signatureBase(ts, nonce, "POST", target.pathname, raw)),
  };
  let res;
  try {
    res = await (cfg.fetch || globalThis.fetch)(target.href, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(timeout) });
  } catch {
    throw Object.assign(new Error("Connect did not answer."), { code: "connect.unreachable" });
  }
  let out;
  try { out = await res.json(); } catch { throw Object.assign(new Error("Connect's answer was not JSON."), { code: "connect.bad-reply" }); }
  if (!out || out.ok !== true) throw Object.assign(new Error("Connect refused the call."), { code: "connect.refused", reply: out });
  return out;
}

/* ------------------------------------------------------------------ sign-in */

/* Trade the code for Connect's signed note, and check the note. Returns { sub, name, scopes }. */
export async function tradeCode(cfg, { code, verifier, redirect, nonce }) {
  const r = await call(cfg, { action: "publicSsoToken", code, verifier, client: CLIENT_ID, redirect });
  return verifyAssertion(cfg, r.assertion, r.sig, { nonce });
}

/* sub, when given, makes this a status note: it must be about that person, and active may be false.
   A sign-in note must say active. */
export function verifyAssertion(cfg, assertion, sig, { nonce, sub, now = Date.now() } = {}) {
  const bad = () => { throw Object.assign(new Error("Connect's sign-in note did not check out."), { code: "auth.invalid" }); };
  if (!assertion || typeof assertion !== "object" || typeof sig !== "string") bad();
  if (!safeEqual(hmacB64u(cfg.ssoSecret, canonicalJson(assertion)), sig)) bad();
  const s = now / 1000;
  if (assertion.v !== 1 || assertion.aud !== CLIENT_ID) bad();
  if (sub === undefined ? assertion.active !== true : typeof assertion.active !== "boolean" || assertion.sub !== sub) bad();
  if (!Number.isFinite(assertion.exp) || assertion.exp <= s || !Number.isFinite(assertion.iat) || assertion.iat > s + 60) bad();
  if ((assertion.nonce || "") !== (nonce || "")) bad();
  if (typeof assertion.sub !== "string" || !assertion.sub || typeof assertion.name !== "string") bad();
  if (!Array.isArray(assertion.scopes) || !assertion.scopes.every((x) => typeof x === "string")) bad();
  /* `method` (Connect GOOGLE-SIGNIN, 30 October 2026): how the Connect session behind the note was opened. Signed with
     the rest; a note from a Connect that does not send it is a password one. */
  return { sub: assertion.sub.slice(0, 200), name: assertion.name.slice(0, 80), scopes: assertion.scopes.slice(0, 50), active: assertion.active,
           method: assertion.method === "google" ? "google" : "password" };
}

/* PROPOSED CHANGE: Connect has no publicSsoStatus yet. Asks whether the person behind a session is
   still active here, and with what; the note is bound to this call by its nonce, so an old answer
   cannot be sent again. Returns { active, name, scopes }; throws as call() does, or auth.invalid. */
/* `method` (Connect GOOGLE-SIGNIN): the session's own, from its sign-in note. Connect holds a Google-opened session to
   its Google route — switched off there, the answer is `active: false` — and a password one to the password gates. */
export async function sessionStatus(cfg, sub, method = "password") {
  const nonce = randomB64u(16);
  const r = await call(cfg, { action: "publicSsoStatus", client: CLIENT_ID, sub, nonce, method: method === "google" ? "google" : "password" }, { timeout: STATUS_TIMEOUT_MS });
  return verifyAssertion(cfg, r.assertion, r.sig, { nonce, sub });
}

/* Connect's one shared list of sign-in quotes (Connect GOOGLE-SIGNIN, publicSigninQuotes): the list when its Show switch
   is on, [] otherwise. Read for the staff page, five minutes per instance; any failure is no quote and never blocks
   signing in. Nothing about anyone is sent or received, and this site keeps no copy anyone can edit. */
/* A failed read is kept for a minute too, so a page opened again and again while Connect is down does not ask it each time. */
let quoteCache = { until: 0, quotes: null };
export function resetQuoteCache() { quoteCache = { until: 0, quotes: null }; }
export async function signinQuotes(cfg, now = Date.now()) {
  if (!cfg) return [];
  if (quoteCache.quotes && now < quoteCache.until) return quoteCache.quotes;
  try {
    const r = await call(cfg, { action: "publicSigninQuotes" }, { timeout: STATUS_TIMEOUT_MS });
    const quotes = (Array.isArray(r.quotes) ? r.quotes : []).filter((x) => typeof x === "string" && x && x.length <= 300).slice(0, 500);
    quoteCache = { until: now + 5 * 60 * 1000, quotes };
    return quotes;
  } catch {
    quoteCache = { until: now + 60 * 1000, quotes: [] };
    return [];
  }
}

/* ------------------------------------------------------------------ form delivery */

/* One submission into Connect's Website Forms. Connect keeps one copy per ref, so sending the
   same ref twice is harmless: it answers stored "already". */
export async function deliverForm(cfg, payload) {
  const r = await call(cfg, { action: "publicFormIngest", ...payload });
  return { ref: r.ref, stored: r.stored };
}
