/* The form render nonce (workflow audit PF-8): without JavaScript a submission carried no
   idempotency key, so the server derived one from the answers alone for the day — and two
   different people's identical answers became one submission. Each drawing of a form now
   carries a nonce the server minted, folded into the derived key: the same drawing sent twice
   is still one submission; a separately drawn form's identical answers are a second. */

import test from "node:test";
import assert from "node:assert/strict";
import { freshServer, workshopAnswers, post } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { many } from "../netlify/lib/db.mjs";
import { loadContent } from "../ops/build.mjs";
import { renderForm } from "../src/render/form.mjs";
import { makeT } from "../src/shared/text.mjs";

const ip = (n = 1) => ({ ip: `198.51.100.${n}` });
const nonceOf = (markup) => markup.match(/name="_nonce" value="([^"]+)"/)?.[1];

test("every drawing of a form carries its own nonce", () => {
  const c = loadContent({ edits: {} });
  const t = makeT(c.text);
  const def = c.forms["workshop-request"];
  const a = nonceOf(String(renderForm(def, { t })));
  const b = nonceOf(String(renderForm(def, { t })));
  assert.ok(a && b, "both drawings carry a nonce");
  assert.notEqual(a, b, "and they are not the same drawing's");
  assert.equal(nonceOf(String(renderForm(def, { t, nonce: "carried-through" }))), "carried-through",
    "a correction reply keeps the nonce it was sent with, so the resend derives the same key");
});

test("no-JavaScript: one drawing sent twice is one submission; a second drawing's identical answers are another", async () => {
  await freshServer();
  const send = (nonce, n) => handle(post("/api/forms/workshop-request/submit", workshopAnswers({ _nonce: nonce })), ip(n));
  const first = await (await send("drawing-one", 1)).json();
  const again = await (await send("drawing-one", 2)).json();
  assert.equal(again.ref, first.ref, "the same drawing's double-press is the same submission");
  const other = await (await send("drawing-two", 3)).json();
  assert.notEqual(other.ref, first.ref, "another person's identical answers, on their own drawing, are their own submission");
  assert.equal((await many("SELECT id FROM submissions WHERE form_key = 'workshop-request'")).length, 2);
});
