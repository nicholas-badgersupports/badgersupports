/* The address lookup's rate limit (workflow audit PF-7): /api/geocode was the one public route
   with no per-connection limit, proxying a shared public geocoder. It now carries the mood tap's
   thirty an hour. The Census service is stubbed; nothing here leaves the machine. */

import test from "node:test";
import assert from "node:assert/strict";
import { freshServer } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";

const census = () => new Response(JSON.stringify({
  result: { addressMatches: [{ matchedAddress: "500 State St, MADISON, WI, 53703", coordinates: { x: -89.4, y: 43.07 }, addressComponents: { city: "MADISON", state: "WI", zip: "53703" } }] },
}), { status: 200, headers: { "content-type": "application/json" } });

test("thirty lookups an hour from one connection, then a 429; another connection is unaffected", async () => {
  await freshServer();
  const real = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = async () => { asked++; return census(); };
  try {
    const get = (ip) => handle(new Request("http://site.test/api/geocode?q=500+State+St", { headers: { accept: "application/json" } }), { ip });
    for (let i = 0; i < 30; i++) assert.equal((await get("198.51.100.7")).status, 200, `lookup ${i + 1} answers`);
    const over = await get("198.51.100.7");
    assert.equal(over.status, 429);
    assert.equal((await over.json()).error, "rate.limited");
    assert.equal(asked, 30, "the refused lookup never reached the geocoder");
    assert.equal((await get("198.51.100.8")).status, 200, "the limit is per connection, not the site's");
  } finally {
    globalThis.fetch = real;
  }
});
