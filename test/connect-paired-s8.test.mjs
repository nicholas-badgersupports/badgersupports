/* The website against Connect's own server code for the four edit paths of Connect Session 8
   (Exchange CONNECT-EDITORS-S8): alumni history, form wording, legal documents and agreements.

   Connect runs in this process from the checkout CONNECT_ROOT names, on its in-memory database, signed with a
   throwaway service key. The website's signed calls reach Connect's real /api handler through the fetch the test
   installs; nothing leaves this machine. Every person, answer and word is fictional.

     CONNECT_ROOT="../../BSS Intranet Transfer v23" node --test test/connect-paired-s8.test.mjs

   Without CONNECT_ROOT every case is skipped, so the ordinary suite never imports another repository. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const CONNECT_ROOT = process.env.CONNECT_ROOT ? path.resolve(process.env.CONNECT_ROOT) : "";
const skip = !CONNECT_ROOT && "Set CONNECT_ROOT to a Connect checkout with Session 8";

const KEY_ID = "paired-s8", SECRET = "paired-s8-service-key-not-a-secret-anywhere";
let connect = null;

async function startConnect() {
  if (connect) return connect;
  process.env.BSI_LOCAL_DB = "1";
  delete process.env.BSI_LOCAL_DB_PATH;
  process.env.MAIL_TRANSPORT_KEY = "paired-s8-transport-key-not-for-live";
  process.env.PUBLIC_SITE_SERVICE_KEYS = JSON.stringify({ [KEY_ID]: { secret: SECRET } });
  const imp = (rel) => import(url.pathToFileURL(path.join(CONNECT_ROOT, rel)).href);
  const { sql } = await imp("netlify/lib/db.mjs");
  const { createSession } = await imp("netlify/lib/auth.mjs");
  const handler = (await imp("netlify/functions/api.mjs")).default;
  const SUPER = "paired-super@example.org";
  await sql`INSERT INTO people (username, name, tier, active, must_change, profile) VALUES (${SUPER}, ${"Sasha Fictional"}, ${"super"}, TRUE, FALSE, ${JSON.stringify({ internalTitle: "Fictional Chair" })}::jsonb)`;
  const cookie = `bsi_sess=${await createSession(SUPER, "super")}`;
  const post = async (action, body = {}) => {
    const res = await handler(new Request("https://home.badgersupports.org/api", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ action, ...body }) }), {});
    return res.json();
  };
  assert.equal((await post("acceptNotice")).ok, true, "the fictional super admin agrees to Connect's notice");
  const cfg = {
    url: "https://home.badgersupports.org", keyId: KEY_ID, secret: SECRET, ssoSecret: "s".repeat(40),
    fetch: (href, init) => handler(new Request(href, { method: init.method, headers: init.headers, body: init.body }), {}),
  };
  connect = { sql, asSuper: post, cfg };
  return connect;
}

const ALUMNI = (heading, name) => [{ id: "g-paired-1", heading, organization: "BSS", people: [{ id: "a-paired-1", name, years: "2020–2022", titles: ["Fictional Chair"] }] }];
const SITE_PRIVACY_WORDS = "By accessing or using the Services, you consent to this Privacy Policy.";

test.describe("published pages read Connect", { skip }, () => {
  let pages, site;
  test.before(async () => {
    const c = await startConnect();
    const { ROOT, build } = await import("../ops/build.mjs");
    const { useContent } = await import("../netlify/lib/content.mjs");
    const { useConnect } = await import("../netlify/lib/connect.mjs");
    const { useStore, memoryStore } = await import("../netlify/lib/published.mjs");
    pages = await import("../netlify/lib/pages.mjs");
    const out = path.join(ROOT, "local/test-connect-paired-s8");
    await build({ production: true, connectConfig: c.cfg, out, serverDir: path.join(out, "_server"), media: false, today: "2026-11-09" });
    site = JSON.parse(fs.readFileSync(path.join(out, "_server/server.json")));
    site.render.alumniSource.enabled = true;
    useContent(site); useConnect(c.cfg); pages.useDist(out); useStore(memoryStore());
  });
  // Each read is a fresh minute: the legal reader keeps an answer for one (netlify/lib/legal.mjs).
  const page = async (p) => { (await import("../netlify/lib/legal.mjs")).forgetLegal(); return (await pages.handlePage(new Request(`https://site.test${p}`), { today: "2026-11-09" })).text(); };

  test("alumni history: Connect's saved list shows, and the next save shows without a publish", async () => {
    const first = await connect.asSuper("adminSaveAlumniHistory", { expectedRevision: "", groups: ALUMNI("Fictional Board", "Rowan Fictional") });
    assert.equal(first.ok, true, JSON.stringify(first));
    let body = await page("/join/alumni/");
    assert.match(body, /Rowan Fictional/);
    const saved = await connect.asSuper("adminSaveAlumniHistory", { expectedRevision: first.revision, groups: ALUMNI("Fictional Board, Renamed", "Rowan Fictional-Renamed") });
    assert.equal(saved.ok, true, JSON.stringify(saved));
    body = await page("/join/alumni/");
    assert.match(body, /Rowan Fictional-Renamed/);
    assert.match(body, /Fictional Board, Renamed/);
  });

  test("privacy policy: the site's words until Connect publishes one, then Connect's current version", async () => {
    let body = await page("/operations/privacy-policy/");
    assert.ok(body.includes(SITE_PRIVACY_WORDS), "before Connect publishes, the page keeps its own words");
    const words = "Fictional privacy words, version one.\n\nA second fictional paragraph, with https://example.org/more.";
    const first = await connect.asSuper("adminPublishLegalDocument", { doc: "privacy-policy", expectedVersion: 0, title: "Fictional Privacy Policy", words, reason: "Fictional first publish" });
    assert.equal(first.ok, true, JSON.stringify(first));
    body = await page("/operations/privacy-policy/");
    assert.match(body, /Fictional privacy words, version one\./);
    assert.match(body, /<p>A second fictional paragraph/);
    assert.ok(!body.includes(SITE_PRIVACY_WORDS), "Connect's version replaces the site's words");
    assert.ok(!body.includes("Effective date / last updated"), "the head drops the site version's own date");
    const second = await connect.asSuper("adminPublishLegalDocument", { doc: "privacy-policy", expectedVersion: 1, title: "Fictional Privacy Policy", words: "Fictional privacy words, version two.", reason: "Fictional second publish" });
    assert.equal(second.ok, true, JSON.stringify(second));
    body = await page("/operations/privacy-policy/");
    assert.match(body, /Fictional privacy words, version two\./);
    assert.doesNotMatch(body, /version one/);
  });
});

test.describe("forms read their words from Connect and carry agreements", { skip }, () => {
  let h, intake, deliver, db, conn, content;
  test.before(async () => {
    const c = await startConnect();
    h = await import("./helpers.mjs");
    intake = await import("../netlify/lib/intake.mjs");
    deliver = await import("../netlify/lib/deliver.mjs");
    db = await import("../netlify/lib/db.mjs");
    conn = await import("../netlify/lib/connect.mjs");
    content = await import("../netlify/lib/content.mjs");
    await h.freshServer();
    conn.useConnect(c.cfg);
  });

  test("form wording: the website sends its words as the base; Connect's saved change shows on the form", async () => {
    const before = await intake.currentForm("workshop-request");
    const label = before.def.sections.flatMap((s) => s.questions).find((q) => q.id === "name").label;
    const st = await connect.asSuper("adminFormWording", { form: "workshop-request" });
    assert.equal(st.ok, true, JSON.stringify(st).slice(0, 300));
    assert.equal(st.base?.slots?.["question:name.label"], label, "the base holds the website's own label");
    assert.equal(st.base?.slots?.title, before.def.title);
    const saved = await connect.asSuper("adminSaveFormWording", { form: "workshop-request", expectedVersion: st.version, baseSha256: st.baseSha256, changes: { "question:name.label": "Your full fictional name" } });
    assert.equal(saved.ok, true, JSON.stringify(saved).slice(0, 300));
    const { forgetFormWording } = await import("../netlify/lib/form-wording.mjs");
    forgetFormWording();
    const after = await intake.currentForm("workshop-request");
    assert.equal(after.def.sections.flatMap((s) => s.questions).find((q) => q.id === "name").label, "Your full fictional name");
    assert.equal(after.def.version, before.def.version, "words change; the form's version and ids do not");
  });

  test("agreements: a form that asks for one is closed until Connect publishes the document, checks the version at Send, and delivers it", async () => {
    const c = await startConnect();
    const forms = content.serverContent().forms;
    const def = structuredClone(forms["programming-feedback"]);
    def.sections.filter((x) => !x.showIf).at(-1).questions.push({ id: "agree_terms", type: "agree", doc: "fictional-terms", label: "I agree to the fictional terms.", required: true });
    forms["programming-feedback"] = def;
    const { forgetLegal } = await import("../netlify/lib/legal.mjs");
    forgetLegal();
    let form = await intake.currentForm("programming-feedback");
    assert.equal(form.state, "closed", "nothing published to agree to: the form does not open");
    const v1 = await connect.asSuper("adminPublishLegalDocument", { doc: "fictional-terms", expectedVersion: 0, title: "Fictional Terms", words: "Fictional terms, one.", reason: "Fictional" });
    assert.equal(v1.ok, true, JSON.stringify(v1));
    forgetLegal();
    form = await intake.currentForm("programming-feedback");
    const agree = form.def.sections.flatMap((s) => s.questions).find((q) => q.id === "agree_terms");
    assert.equal(form.state, form.manualState === "open" ? "open" : "closed");
    assert.equal(agree.current.version, 1);
    assert.equal(agree.current.words, "Fictional terms, one.");
    const sha1 = crypto.createHash("sha256").update("Fictional terms, one.").digest("hex");
    assert.equal(agree.current.sha256, sha1);

    // Opened for the fictional run the way a director's switch would.
    await intake.setSwitch("programming-feedback", "open", "paired-test");
    const answers = (token) => {
      const a = { _form: "programming-feedback", _version: String(def.version), agree_terms: token };
      for (const q of def.sections.flatMap((s) => s.questions)) if (q.required && q.id !== "agree_terms") a[q.id] = q.options ? q.options[0].id : q.type === "confirm" ? "yes" : "Fictional words.";
      return a;
    };
    const send = async (token) => (await (await import("../netlify/lib/router.mjs")).handle(h.post("/api/forms/programming-feedback/submit", answers(token)), { ip: "198.51.100.9" })).json();

    const ok = await send(`1:${sha1}`);
    assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
    await deliver.deliveriesSettled();
    await deliver.deliverOnce({ force: true });
    const kept = await c.sql`SELECT context, answers FROM public_form_submissions WHERE ref = ${ok.ref}`;
    assert.equal(kept.length, 1);
    assert.deepEqual(kept[0].context.agreements, [{ doc: "fictional-terms", version: 1, sha256: sha1 }]);
    assert.ok(!Object.hasOwn(kept[0].answers || {}, "agree_terms"), "an agreement is not an answer");

    const v2 = await connect.asSuper("adminPublishLegalDocument", { doc: "fictional-terms", expectedVersion: 1, title: "Fictional Terms", words: "Fictional terms, two.", reason: "Fictional" });
    assert.equal(v2.ok, true);
    forgetLegal();
    const stale = await send(`1:${sha1}`);
    assert.equal(stale.ok, false);
    assert.equal(stale.error, "answers.invalid");
    assert.equal(stale.errors.agree_terms, "agreement-out-of-date");

    // Sent against version two, then version three is published before the outbox runs: Connect refuses, and the
    // row waits as failed with a reason a director can read, never stored as agreeing to words nobody saw.
    const sha2 = crypto.createHash("sha256").update("Fictional terms, two.").digest("hex");
    const reach = c.cfg.fetch;
    c.cfg.fetch = async (href, init) => { if (JSON.parse(init.body).action === "publicFormIngest") throw new TypeError("fictional outage"); return reach(href, init); };
    const late = await send(`2:${sha2}`);
    assert.equal(late.ok, true, JSON.stringify(late).slice(0, 300));
    await deliver.deliveriesSettled();
    c.cfg.fetch = reach;
    await connect.asSuper("adminPublishLegalDocument", { doc: "fictional-terms", expectedVersion: 2, title: "Fictional Terms", words: "Fictional terms, three.", reason: "Fictional" });
    await deliver.deliverOnce({ force: true });
    const row = await db.one("SELECT o.state, o.last_error FROM outbox o JOIN submissions s ON s.id = o.submission_id WHERE s.ref = $1 AND o.kind = 'connect.ingest'", [late.ref]);
    assert.deepEqual(row, { state: "failed", last_error: "agreement.out-of-date" });
  });
});
