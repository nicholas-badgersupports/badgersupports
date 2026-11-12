/* Email links copy first (owner, 12 Nov 2026): the address a mailto: href carries, the copy
   itself with its fallback, and the built pages carrying the popup's words. Behaviour in a real
   browser — the popup, its buttons, Escape — is ops/interact.mjs, part "email links". */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "../ops/build.mjs";
import { emailAddress, copyText } from "../src/client/email.js";

test("the address is the part of the href before any subject, decoded", () => {
  assert.equal(emailAddress("mailto:directors@badgersupports.org"), "directors@badgersupports.org");
  assert.equal(emailAddress("mailto:hello@badgersupports.org?subject=Pickup"), "hello@badgersupports.org");
  assert.equal(emailAddress("MAILTO:accessibility@badgersupports.org"), "accessibility@badgersupports.org");
  assert.equal(emailAddress("mailto:badgersupports+subscribe@g-groups.wisc.edu"), "badgersupports+subscribe@g-groups.wisc.edu");
  assert.equal(emailAddress("mailto:a%40example.org"), "a@example.org");
  assert.equal(emailAddress("mailto:%zz@example.org"), "%zz@example.org");
});

test("anything that is not a mailto: href carries no address", () => {
  assert.equal(emailAddress("https://badgersupports.org/"), "");
  assert.equal(emailAddress("/contact/"), "");
  assert.equal(emailAddress(""), "");
  assert.equal(emailAddress(null), "");
  assert.equal(emailAddress("mailto:"), "");
});

test("a working clipboard API is used, once, with the address", async () => {
  const seen = [];
  const clipboard = { writeText: async (text) => { seen.push(text); } };
  assert.equal(await copyText("a@example.org", { clipboard, doc: undefined }), true);
  assert.deepEqual(seen, ["a@example.org"]);
});

/* A document stand-in for the legacy path: it records the textarea it was given and answers
   execCommand as told. */
function legacyDoc(answer) {
  const made = [];
  return {
    made,
    body: { append: (node) => { node.attached = true; } },
    createElement: (tag) => {
      const node = {
        tag, value: "", style: {}, attached: false, selected: false,
        setAttribute() {}, select() { this.selected = true; }, remove() { this.attached = false; },
      };
      made.push(node);
      return node;
    },
    execCommand: () => answer,
  };
}

test("a refused clipboard API falls back to the textarea way", async () => {
  const clipboard = { writeText: async () => { throw new Error("denied"); } };
  const doc = legacyDoc(true);
  assert.equal(await copyText("a@example.org", { clipboard, doc }), true);
  assert.equal(doc.made.length, 1);
  assert.equal(doc.made[0].value, "a@example.org");
  assert.equal(doc.made[0].selected, true);
  assert.equal(doc.made[0].attached, false);
});

test("no clipboard API at all uses the textarea way directly", async () => {
  const doc = legacyDoc(true);
  assert.equal(await copyText("a@example.org", { clipboard: undefined, doc }), true);
  assert.equal(doc.made.length, 1);
});

test("when neither way works the copy reports false, so nothing claims it happened", async () => {
  const clipboard = { writeText: async () => { throw new Error("denied"); } };
  assert.equal(await copyText("a@example.org", { clipboard, doc: legacyDoc(false) }), false);
  assert.equal(await copyText("a@example.org", { clipboard: undefined, doc: undefined }), false);
});

test("a built page carries the popup's words and the email script", async () => {
  const out = path.join(ROOT, "local", "test-build-email-copy");
  await build({ out, serverDir: path.join(out, "_server"), media: false, today: "2026-11-12", edits: {} });
  const home = fs.readFileSync(path.join(out, "index.html"), "utf8");
  assert.match(home, /<a href="mailto:directors@badgersupports\.org">/, "the footer link keeps its mailto: href");
  const island = /<script type="application\/json" id="bss-text">([\s\S]*?)<\/script>/.exec(home);
  assert.ok(island, "the page carries the words island");
  const words = JSON.parse(island[1]);
  assert.equal(words["email.copied"], "Email address copied");
  assert.equal(words["email.copyAgain"], "Copy again");
  assert.equal(words["email.openMail"], "Open in mail app");
  const jsDir = fs.readdirSync(path.join(out, "assets/js"), { recursive: true }).map(String);
  assert.ok(jsDir.some((f) => f.endsWith("email.js")), "email.js ships with the page scripts");
  const siteDir = path.join(out, "assets/js");
  const emailFile = jsDir.find((f) => f.endsWith("email.js"));
  const emailJs = fs.readFileSync(path.join(siteDir, emailFile), "utf8");
  assert.match(emailJs, /mailto:/, "the shipped script still keys on mailto:");
  assert.match(emailJs, /iconSvg\("copy"\)/, "the Copy again button is the copy icon");
  assert.match(emailJs, /iconSvg\("mail"\)/, "the Open in mail app button is the envelope icon");
  assert.match(emailJs, /aria-label/, "each icon button keeps its words as its accessible name");
  assert.ok(fs.existsSync(path.join(ROOT, "src/client/email.js")));
});
