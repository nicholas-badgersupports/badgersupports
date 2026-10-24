/* Requests in, responses out: body parsing with a size limit, JSON and HTML replies, the
 * same-origin check for posts, and the rate limiter. */

import crypto from "node:crypto";
import { tx } from "./db.mjs";

export const MAX_BODY = 64 * 1024;

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...NO_STORE, ...headers } });

export const htmlResponse = (status, text, headers = {}) =>
  new Response(text, { status, headers: { "content-type": "text/html; charset=utf-8", ...NO_STORE, ...headers } });

export const wantsJson = (req) => (req.headers.get("content-type") || "").startsWith("application/json") || (req.headers.get("accept") || "").startsWith("application/json");

export class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

/* JSON for the enhanced forms, URL-encoded for the no-JavaScript ones. Anything else, or more
   than MAX_BODY bytes, is refused before it is parsed. */
export async function readBody(req) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) throw new HttpError(413, "body.too-large");
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY) throw new HttpError(413, "body.too-large");
  const type = req.headers.get("content-type") || "";
  if (type.startsWith("application/json")) {
    try {
      const v = JSON.parse(text || "{}");
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
      return v;
    } catch { throw new HttpError(400, "body.invalid"); }
  }
  if (type.startsWith("application/x-www-form-urlencoded")) return new URLSearchParams(text);
  throw new HttpError(415, "body.type");
}

/* A file's bytes, as they came. More than max is refused before reading when the length is
   declared, and while reading when it is not: the reader stops at the first chunk past it. */
export async function readBytes(req, max) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) throw new HttpError(413, "file.tooBig");
  if (!req.body) return Buffer.alloc(0);
  const parts = [];
  let n = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, "file.tooBig");
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts, n);
}

/* A post must come from a page on this site. Browsers send Origin on every POST, and
   Sec-Fetch-Site where they support it; a request with neither is a script, which the rate
   limiter and validation still govern. */
export function sameOrigin(req) {
  const site = req.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) return false;
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return false;
  return true;
}

/* A keyed hash of the connection, so a counter can be kept without keeping an address. The key
   is RATE_SALT; production refuses to run without one. */
export function connectionHash(req, context) {
  const salt = process.env.RATE_SALT || (process.env.LOCAL_DB === "pglite" ? "local-only" : null);
  if (!salt) throw new HttpError(503, "config.missing");
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

/* Fixed window: at most `limit` in `windowSeconds` per bucket. Throws 429 past it. */
export async function rateLimit(bucket, limit, windowSeconds) {
  const now = Date.now();
  const start = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
  const n = await tx(async (t) => {
    await t.query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'");
    const r = await t.one(
      `INSERT INTO rate_limits (bucket, window_start, n) VALUES ($1, $2, 1)
       ON CONFLICT (bucket, window_start) DO UPDATE SET n = rate_limits.n + 1 RETURNING n`,
      [bucket, start]);
    return r.n;
  });
  if (n > limit) throw new HttpError(429, "rate.limited");
}
