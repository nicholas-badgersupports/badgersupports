/* The website's half of Connect's editors for form wording and legal documents (Exchange CONNECT-EDITORS-S8), without
   Connect: slot ids, laying changed words, the agreement question, the legal reader and the legal block. The same paths
   against Connect's own server code are in connect-paired-s8.test.mjs. All words are fictional. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../ops/build.mjs";
import { wordingSlots, withWording, definitionProblems, validateAnswers, answerColumns } from "../src/shared/forms.mjs";
import { legalDocuments, legalNow, forgetLegal } from "../netlify/lib/legal.mjs";
import { useConnect } from "../netlify/lib/connect.mjs";
import { useStore, memoryStore } from "../netlify/lib/published.mjs";
import { legalParagraphs } from "../src/render/blocks/legal.mjs";
import { renderForm } from "../src/render/form.mjs";

const form = (key) => JSON.parse(fs.readFileSync(path.join(ROOT, "content/forms", `${key}.json`), "utf8"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const t = (k, v = {}) => `${k}${Object.keys(v).length ? JSON.stringify(v) : ""}`;

test("every form's words have slot ids Connect accepts, within its limits, and no id is a slot", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "content/forms"))) {
    const def = form(f.replace(/\.json$/, ""));
    const slots = wordingSlots(def);
    const ids = Object.keys(slots);
    assert.ok(ids.length > 0 && ids.length <= 800, `${f}: ${ids.length} slots`);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/, `${f}: ${id}`);
    assert.ok(Object.values(slots).every((w) => typeof w === "string" && w.trim() && w.length <= 4000));
    assert.equal(slots.title, def.title);
  }
});

test("changed words land on their slot only; ids, versions and unknown or unsafe slots are untouched", () => {
  const def = form("workshop-request");
  const q = def.sections.flatMap((s) => s.questions).find((x) => x.options?.length);
  const o = q.options[0];
  const out = withWording(def, { title: "Fictional Title", [`question:${q.id}.option:${o.id}.label`]: "Fictional option", "question:nope.label": "Ignored", [`question:${q.id}.label`]: "Two\nlines" });
  assert.equal(out.title, "Fictional Title");
  const q2 = out.sections.flatMap((s) => s.questions).find((x) => x.id === q.id);
  assert.equal(q2.options[0].label, "Fictional option");
  assert.equal(q2.options[0].id, o.id);
  assert.equal(q2.label, q.label, "words with a line break are not one line, so they are ignored");
  assert.equal(out.version, def.version);
  assert.equal(def.title, form("workshop-request").title, "the shipped definition is not changed");
  assert.equal(withWording(def, {}), def);
});

test("an agreement question names one document, is always asked, travels as an agreement and never as an answer column", () => {
  const def = form("workshop-request");
  const plain = def.sections.find((s) => !s.showIf);
  plain.questions.push({ id: "agree_terms", type: "agree", doc: "fictional-terms", label: "I agree to the fictional terms.", required: true });
  assert.deepEqual(definitionProblems(def), []);
  const bad = structuredClone(def);
  bad.sections.find((s) => !s.showIf).questions.at(-1).required = false;
  assert.deepEqual(definitionProblems(bad).map((p) => p.code), ["agree-required"]);
  bad.sections.find((s) => !s.showIf).questions.at(-1).doc = "Not A Doc";
  assert.ok(definitionProblems(bad).some((p) => p.code === "agree-doc-shape"));
  assert.ok(!answerColumns(def).some((c) => c.id === "agree_terms"));
  const r = validateAnswers(def, { agree_terms: "2:" + "a".repeat(64) });
  assert.equal(r.errors.agree_terms, undefined);
  assert.equal(validateAnswers(def, { agree_terms: "yes" }).errors.agree_terms, "confirm-needed");
  assert.equal(validateAnswers(def, {}).errors.agree_terms, "required");
});

test("the agreement box carries the version and fingerprint it shows, and the document's words are escaped", () => {
  const def = form("workshop-request");
  const words = "Fictional <b>terms</b>.\n\nContact hello@example.org.";
  def.sections.find((s) => !s.showIf).questions.push({ id: "agree_terms", type: "agree", doc: "fictional-terms", label: "I agree.", required: true, current: { title: "Fictional Terms", version: 3, sha256: sha(words), words } });
  const out = String(renderForm(def, { t }));
  assert.match(out, new RegExp(`value="3:${sha(words)}"`));
  assert.match(out, /&lt;b&gt;terms&lt;\/b&gt;/);
  assert.match(out, /<a href="mailto:hello@example.org">hello@example.org<\/a>/);
  assert.match(out, /form\.agree\.read\{&quot;title&quot;:&quot;Fictional Terms&quot;\}/);
});

test("legal words: blank lines make paragraphs, ## a heading, https and email addresses links, nothing else markup", () => {
  const out = String(legalParagraphs("## Fictional heading\n\nOne line\nsecond line, see https://example.org/a.\n\n<script>x</script>"));
  assert.match(out, /<h2>Fictional heading<\/h2>/);
  assert.match(out, /<p>One line<br>second line, see <a href="https:\/\/example.org\/a">https:\/\/example.org\/a<\/a>\.<\/p>/);
  assert.match(out, /&lt;script&gt;/);
});

test("the legal reader drops a document whose fingerprint does not match, and falls back to its last good answer", async () => {
  const good = { id: "privacy-policy", title: "Fictional Privacy Policy", version: 2, words: "Fictional words.", sha256: sha("Fictional words."), publishedAt: "2026-11-09T12:00:00Z" };
  const docs = legalDocuments({ schema: "bss.legal-documents/1", documents: [good, { ...good, id: "tampered", sha256: sha("other") }] });
  assert.deepEqual(Object.keys(docs), ["privacy-policy"]);
  assert.throws(() => legalDocuments({ schema: "bss.other/1", documents: [] }));
  let down = false;
  useStore(memoryStore());
  useConnect({ url: "https://connect.example.test", keyId: "k", secret: "x".repeat(40), fetch: async () => { if (down) throw new TypeError("fictional outage"); return { json: async () => ({ ok: true, schema: "bss.legal-documents/1", documents: [good] }) }; } });
  const old = console.error; console.error = () => {};
  try {
    forgetLegal();
    assert.equal((await legalNow())["privacy-policy"].version, 2);
    down = true; forgetLegal();
    assert.equal((await legalNow())["privacy-policy"].version, 2, "the last good answer stands in");
    useStore(memoryStore()); forgetLegal();
    assert.equal(await legalNow(), null);
  } finally { console.error = old; useConnect(null); forgetLegal(); }
});
