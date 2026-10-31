/* Staff sign-in, through Connect. This site keeps no accounts and no passwords: Connect says who
 * someone is and what they may do here, and this file keeps that for a working day.
 *
 *   1. GET /api/auth/start      a random state (in a short cookie) and a PKCE verifier (kept
 *                               here); the browser goes to Connect's sign-in page with the state,
 *                               the verifier's hash and where to come back, all in the fragment.
 *   2. Connect                  the director signs in there as they always do, and is sent back
 *                               with a one-time code and the same state.
 *   3. GET /api/auth/callback   the state must match the cookie and a start not yet used; the code
 *                               and verifier are traded server to server for Connect's signed note
 *                               (connect.mjs); a session row and an HttpOnly cookie follow.
 *
 * Scopes come from the note: forms.read:<key> (or forms.read:*) to read a form's answers here,
 * site.edit to change words on the site, site.publish to download them for a publish. A super admin
 * sets which roles hold which in Connect; the note also leaves the name empty when Connect is set
 * not to share first names. A second cookie, bss_staff_hint, says only "someone
 * signed in on this browser" so the pages know to load the edit button; it carries nothing a
 * script could use, and every staff call checks the real session.
 *
 * Signing out here ends this site's session only. How long Connect's note holds (sessionFrom):
 *   - Until CONNECT_SESSION_STATUS=on turns on Connect's publicSsoStatus check, reading
 *     answers lasts an hour from signing in; after that the page asks for a fresh sign-in, while
 *     editing and publishing words last the working day. Someone switched off in Connect cannot sign
 *     in again, and so loses the answers within the hour.
 *   - With it on, a session is checked again ten minutes after Connect last vouched for it. Fewer
 *     scopes take effect at once, more never do (sign in again for those), and switched off ends the
 *     session. Connect not answering, or answering with anything that does not check out, keeps the
 *     session as it was for half an hour from that last answer, then nothing works until it answers.
 * docs/ARCHITECTURE.md, "Staying signed in", has the Connect side.
 */

import crypto from "node:crypto";
import { q, one } from "./db.mjs";
import { HttpError } from "./http.mjs";
import { connectConfig, tradeCode, sessionStatus, randomB64u, sha256Hex, sha256B64u, CLIENT_ID } from "./connect.mjs";

const SESSION_HOURS = 8;
const START_MINUTES = 10;
const READ_MINUTES = 60;    // status check off: reading answers, from signing in
const CHECK_MINUTES = 10;   // status check on: ask Connect again this long after its last answer
const GRACE_MINUTES = 30;   // status check on: Connect silent this long after its last answer, and nothing works
export const HINT = "bss_staff_hint";

const secure = (req) => new URL(req.url).protocol === "https:";

/* On https the cookies are __Host- cookies: this host only, every path, never sent in the clear. */
const names = (req) => (secure(req) ? { session: "__Host-bss_staff", auth: "__Host-bss_auth" } : { session: "bss_staff", auth: "bss_auth" });

const callbackUrl = (req) => `${new URL(req.url).origin}/api/auth/callback`;

function readCookies(req) {
  const out = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* a mangled cookie is no cookie */ }
  }
  return out;
}

function cookie(req, name, value, { maxAge, httpOnly = true }) {
  return [`${name}=${value}`, "Path=/", "SameSite=Lax", httpOnly ? "HttpOnly" : null, secure(req) ? "Secure" : null, `Max-Age=${maxAge}`].filter(Boolean).join("; ");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Where to land after signing in: a path on this site, nothing else. */
export function returnPath(v) {
  const s = String(v || "");
  return s.length <= 200 && /^\/(?!\/)[A-Za-z0-9\-._~/]*$/.test(s) ? s : "/staff/";
}

function redirect(location, cookies, status = 302) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status, headers });
}

export async function startSignIn(req) {
  const cfg = connectConfig();
  if (!cfg) throw new HttpError(503, "auth.unavailable");
  const state = randomB64u(24), verifier = randomB64u(48), nonce = randomB64u(16);
  await q("DELETE FROM auth_starts WHERE expires_at < now() - interval '1 day'");
  await q("DELETE FROM staff_sessions WHERE expires_at < now()");
  await q(`INSERT INTO auth_starts (state_hash, verifier, nonce, return_to, expires_at)
           VALUES ($1, $2, $3, $4, now() + ($5::int * interval '1 minute'))`,
    [sha256Hex(state), verifier, nonce, returnPath(new URL(req.url).searchParams.get("return")), START_MINUTES]);
  const fragment = new URLSearchParams({ client: CLIENT_ID, state, challenge: sha256B64u(verifier), redirect: callbackUrl(req), nonce });
  return redirect(`${cfg.url}/public-sso.html#${fragment}`, [cookie(req, names(req).auth, state, { maxAge: START_MINUTES * 60 })]);
}

export async function finishSignIn(req) {
  const cfg = connectConfig();
  if (!cfg) throw new HttpError(503, "auth.unavailable");
  const u = new URL(req.url);
  const state = u.searchParams.get("state") || "", code = u.searchParams.get("code") || "";
  const n = names(req);
  const jar = readCookies(req);
  if (!state || !code || !safeEqual(jar[n.auth] || "", state)) throw new HttpError(400, "auth.state");
  // Spent in the statement that reads it: a second use of the same state finds nothing.
  const start = await one(`UPDATE auth_starts SET used_at = now()
                            WHERE state_hash = $1 AND used_at IS NULL AND expires_at > now()
                        RETURNING verifier, nonce, return_to`, [sha256Hex(state)]);
  if (!start) throw new HttpError(400, "auth.expired");
  let who;
  try {
    who = await tradeCode(cfg, { code, verifier: start.verifier, redirect: callbackUrl(req), nonce: start.nonce });
  } catch (e) {
    if (e?.code === "connect.unreachable" || e?.code === "connect.bad-reply") throw new HttpError(502, "auth.unreachable");
    throw new HttpError(403, "auth.refused");
  }
  if (!who.scopes.length) throw new HttpError(403, "auth.refused");
  if (jar[n.session]) await q("DELETE FROM staff_sessions WHERE id_hash = $1", [sha256Hex(jar[n.session])]);
  const id = randomB64u(32);
  /* `method` (Connect GOOGLE-SIGNIN): kept so the status check can ask about the route this session came by. */
  await q(`INSERT INTO staff_sessions (id_hash, sub, name, scopes, expires_at, method)
           VALUES ($1, $2, $3, $4::jsonb, now() + ($5::int * interval '1 hour'), $6)`,
    [sha256Hex(id), who.sub, who.name, JSON.stringify(who.scopes), SESSION_HOURS, who.method === "google" ? "google" : "password"]);
  const age = SESSION_HOURS * 3600;
  return redirect(start.return_to, [
    cookie(req, n.session, id, { maxAge: age }),
    cookie(req, HINT, "1", { maxAge: age, httpOnly: false }),
    cookie(req, n.auth, "", { maxAge: 0 }),
  ]);
}

/* The signed-in person, or null. With the status check off, an hour on, reading answers moves to
   `lapsed`: the router answers auth.again for it, and the staff page offers a fresh sign-in. */
export async function sessionFrom(req) {
  const id = readCookies(req)[names(req).session];
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const hash = sha256Hex(id);
  const row = await one(`SELECT sub, name, scopes, method, extract(epoch FROM now() - coalesce(checked_at, created_at))::float8 / 60 AS minutes
                         FROM staff_sessions WHERE id_hash = $1 AND expires_at > now()`, [hash]);
  if (!row) return null;
  const who = { sub: row.sub, name: row.name, scopes: row.scopes };
  const cfg = connectConfig();
  if (!cfg?.statusCheck) {
    if (row.minutes < READ_MINUTES) return who;
    const reads = (s) => s.startsWith("forms.read:");
    return { ...who, scopes: who.scopes.filter((s) => !reads(s)), lapsed: who.scopes.filter(reads) };
  }
  if (row.minutes < CHECK_MINUTES) return who;
  let note;
  try { note = await sessionStatus(cfg, row.sub, row.method); } catch { return row.minutes < GRACE_MINUTES ? who : null; }
  const scopes = note.active ? narrower(who.scopes, note.scopes) : [];
  if (!scopes.length) {
    await q("DELETE FROM staff_sessions WHERE id_hash = $1", [hash]);
    return null;
  }
  await q("UPDATE staff_sessions SET scopes = $2::jsonb, name = $3, checked_at = now() WHERE id_hash = $1", [hash, JSON.stringify(scopes), note.name]);
  return { ...who, name: note.name, scopes };
}

/* What both notes allow, so a check can take scopes away but never add one. */
const narrower = (was, now) => [...new Set([...now.filter((s) => can({ scopes: was }, s)), ...was.filter((s) => can({ scopes: now }, s))])];

export async function signOut(req, { asJson = false } = {}) {
  const n = names(req);
  const id = readCookies(req)[n.session];
  if (id) await q("DELETE FROM staff_sessions WHERE id_hash = $1", [sha256Hex(id)]);
  const gone = [cookie(req, n.session, "", { maxAge: 0 }), cookie(req, HINT, "", { maxAge: 0, httpOnly: false })];
  if (!asJson) return redirect("/staff/", gone, 303);
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  for (const c of gone) headers.append("set-cookie", c);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

/* forms.read:* covers every form; any other scope must be named exactly. */
export function can(who, scope) {
  if (!who) return false;
  const kind = scope.split(":")[0];
  return who.scopes.includes(scope) || who.scopes.includes(`${kind}:*`);
}
