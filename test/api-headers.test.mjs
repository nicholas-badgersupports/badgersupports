/* The API's JSON answers carry the hardened headers the pages get (SECURITY-PUBLIC, P-4). The pages'
   Content-Security-Policy and Referrer-Policy are written by the build into _headers, which Netlify
   lays over static files, not over a function's answer — so the function's JSON went out with only
   Cache-Control and X-Content-Type-Options. These are the function's own answers, through the router. */

import test from "node:test";
import assert from "node:assert/strict";
import { freshServer, ORIGIN } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";

const get = (path) => new Request(ORIGIN + path, { headers: { accept: "application/json" } });
const ip = { ip: "198.51.100.20" };

function hardened(res, what) {
  assert.equal(res.headers.get("content-security-policy"), "default-src 'none'; sandbox", `${what}: the policy a JSON answer allows — nothing loads from it`);
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin", `${what}: the pages' referrer policy`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff", `${what}: as before`);
  assert.match(res.headers.get("content-type") || "", /application\/json/, `${what}: still JSON`);
}

test("a JSON answer carries the hardened headers, on a success, a refusal and a miss", async () => {
  await freshServer();
  hardened(await handle(get("/api/forms/workshop-request/state"), ip), "a form's state");
  const refusal = await handle(get("/api/staff/me"), ip);
  hardened(refusal, "a staff refusal");
  assert.equal(refusal.headers.get("cache-control"), "no-store", "a refusal is still never stored");
  hardened(await handle(get("/api/no-such-thing"), ip), "a miss");
});
