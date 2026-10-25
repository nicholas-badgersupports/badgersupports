/* The two applications (WORK.md item 14): their definitions, the question types they brought
   (links, ranking, phone, file), and a resume going up on its own before Send. End to end through
   the router against a fresh PGlite database. The file is a few bytes that open as a PDF does;
   nobody in this file is a real person. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { freshServer, post, ORIGIN } from "./helpers.mjs";
import { handle } from "../netlify/lib/router.mjs";
import { many, one, q } from "../netlify/lib/db.mjs";
import { serverContent } from "../netlify/lib/content.mjs";
import { ingestPayload, definitionFor } from "../netlify/lib/deliver.mjs";
import { latestAnswers } from "../netlify/lib/answers.mjs";
import { publicDefinition } from "../src/render/form.mjs";
import { definitionProblems, validateAnswers, readRaw, answerWords, errorText, allQuestions, questionById, QUESTION_TYPES } from "../src/shared/forms.mjs";
import { makeT, resolveText } from "../src/shared/text.mjs";

const load = (k) => JSON.parse(fs.readFileSync(new URL(`../content/forms/${k}.json`, import.meta.url)));
const t = makeT(resolveText(JSON.parse(fs.readFileSync(new URL("../content/text.json", import.meta.url)))));
const ip = (n = 1) => ({ ip: `192.0.2.${n}` });
const STAFF = "staff-application";
const PDF = Buffer.from("%PDF-1.4\n% a made-up file for the tests\n%%EOF\n");
const SOME_ID = "A".repeat(32);

function staffAnswers(over = {}) {
  return {
    _form: STAFF, _version: "2",
    eligibility: "yes", ai_use: "yes",
    email: "river@example.org", name: "River Example", semesters: "s3", phone: "555-0199",
    about: "A made-up applicant.", campus_resource: "A made-up answer.",
    workflow: ["long_term"], facilitating: "unsure", skills_programs: ["plan_events", "deliver_workshops"],
    "directorate_rank.programs": "1", "directorate_rank.engagement": "2", "directorate_rank.wellness_support": "3", "directorate_rank.business_development": "4",
    experience: "Made-up experience.", interest: "Made-up interest.",
    meeting_hours: "yes", total_hours: "8", work_study: "no", commitments: "Made-up commitments.",
    portfolio: "https://example.org/work\nhttps://example.org/more",
    referral_ack: "yes", ai_use_final: "yes",
    ...over,
  };
}

const openStaff = () => q("INSERT INTO form_state (form_key, state, changed_by) VALUES ($1, 'open', 'test')", [STAFF]);

const upload = (question, bytes, { key = STAFF, type = "application/pdf", name = "resume.pdf", n = 1 } = {}) => handle(new Request(`${ORIGIN}/api/forms/${key}/files?q=${question}`, {
  method: "POST",
  headers: { "content-type": type, accept: "application/json", origin: ORIGIN, "x-file-name": encodeURIComponent(name) },
  body: bytes,
}), ip(n));

const fileIdFor = async (question = "resume", name = "resume.pdf") => {
  const res = await upload(question, PDF, { name });
  assert.equal(res.status, 200);
  return (await res.json()).fileId;
};

/* ------------------------------------------------------------------ the definitions */

test("both applications pass the form rules, closed as shipped and open", () => {
  for (const key of [STAFF, "volunteer-application"]) {
    const def = load(key);
    assert.equal(def.state, "closed", key);
    assert.deepEqual(definitionProblems(def), [], key);
    assert.deepEqual(definitionProblems({ ...def, state: "open" }), [], `${key} open`);
  }
});

test("the applications ask what was ruled: uploads only for a resume and cover letter, portfolios as links, Connect's directorates", () => {
  const staff = load(STAFF);
  const vol = load("volunteer-application");
  const files = (def) => allQuestions(def).filter(({ q }) => q.type === "file").map(({ q }) => q.id);
  assert.deepEqual(files(staff), ["resume", "cover_letter"]);
  assert.deepEqual(files(vol), ["resume"]);
  assert.equal(questionById(staff, "resume").required, true);
  assert.equal(questionById(vol, "resume").required, true);
  assert.notEqual(questionById(staff, "cover_letter").required, true);
  assert.equal(questionById(staff, "portfolio").type, "links");
  assert.equal(questionById(staff, "portfolio").maxLinks, 5);
  assert.equal(questionById(staff, "phone").required, true, "staff asks for a phone number");
  assert.notEqual(questionById(vol, "phone").required, true, "volunteers may leave it out");
  for (const def of [staff, vol]) assert.notEqual(questionById(def, "skills_initiatives").required, true, def.key);
  assert.deepEqual(questionById(staff, "directorate_rank").options.map((o) => o.id), ["engagement", "programs", "wellness_support", "business_development"]);
  for (const id of ["work_study", "commitments"]) assert.equal(questionById(staff, id).confidential, true, id);
});

test("what the browser is given leaves out every review note, proposal, source and workflow", () => {
  for (const key of [STAFF, "volunteer-application"]) {
    const def = load(key);
    const notes = [];
    const walk = (v) => {
      if (!v || typeof v !== "object") return;
      for (const [k, x] of Object.entries(v)) {
        if (["review", "proposed", "source", "workflow"].includes(k)) notes.push(JSON.stringify(x));
        else walk(x);
      }
    };
    walk(def);
    assert.ok(notes.length > 5, `${key} has notes to keep out`);
    const pub = JSON.stringify(publicDefinition(def));
    assert.doesNotMatch(pub, /"(review|proposed|source|workflow|help|confidential)":/, key);
    for (const n of notes) assert.ok(!pub.includes(n.slice(1, 60)), `${key}: ${n.slice(0, 60)}`);
  }
});

/* ------------------------------------------------------------------ the new question types */

test("links: https only, at most five, one per line, never with a password in them", () => {
  const def = load(STAFF);
  const check = (portfolio) => validateAnswers(def, readRaw(def, staffAnswers({ portfolio, resume: SOME_ID })));
  assert.deepEqual(check(" https://example.org/a \r\n\nhttps://example.org/b").answers.portfolio, ["https://example.org/a", "https://example.org/b"]);
  assert.deepEqual(check(["https://example.org/a"]).answers.portfolio, ["https://example.org/a"]);
  for (const bad of ["http://example.org", "example.org", "javascript:alert(1)", "https://user:pw@example.org", "https://example org", "https://localhost/x"])
    assert.equal(check(bad).errors.portfolio, "link-shape", bad);
  assert.equal(check(Array.from({ length: 6 }, (_, i) => `https://example.org/${i}`).join("\n")).errors.portfolio, "links-too-many");
  assert.equal(check(`https://example.org/${"a".repeat(2001)}`).errors.portfolio, "link-too-long");
  assert.equal(check("").errors.portfolio, undefined, "optional");
  assert.equal(errorText("links-too-many", questionById(def, "portfolio"), t).includes("5"), true);
});

test("a ranking gives each option its own place; an optional one may be left blank, but not half done", () => {
  const def = load(STAFF);
  const qn = questionById(def, "directorate_rank");
  const check = (ranks) => validateAnswers(def, readRaw(def, {
    ...staffAnswers({ resume: SOME_ID }),
    "directorate_rank.programs": undefined, "directorate_rank.engagement": undefined, "directorate_rank.wellness_support": undefined, "directorate_rank.business_development": undefined,
    ...Object.fromEntries(Object.entries(ranks).map(([k, v]) => [`directorate_rank.${k}`, v])),
  }));
  const full = check({ programs: "1", engagement: "2", wellness_support: "3", business_development: "4" });
  assert.equal(full.ok, true, JSON.stringify(full.errors));
  assert.deepEqual(full.answers.directorate_rank, ["programs", "engagement", "wellness_support", "business_development"]);
  assert.deepEqual(answerWords(qn, full.answers.directorate_rank).slice(0, 2), ["1. Programs", "2. Engagement"]);
  assert.equal(check({ programs: "1", engagement: "1", wellness_support: "3", business_development: "4" }).errors.directorate_rank, "rank-repeated");
  assert.equal(check({ programs: "1", engagement: "2", wellness_support: "3", business_development: "5" }).errors.directorate_rank, "rank-shape");
  assert.equal(check({ programs: "first", engagement: "2", wellness_support: "3", business_development: "4" }).errors.directorate_rank, "rank-shape");
  assert.equal(check({ programs: "1" }).errors.directorate_rank, "rank-incomplete");
  const blank = check({});
  assert.equal(blank.errors.directorate_rank, undefined);
  assert.equal(blank.answers.directorate_rank, undefined);
  // An option the form does not have is ignored, never stored.
  assert.equal(check({ programs: "1", engagement: "2", wellness_support: "3", business_development: "4", spill: "5" }).answers.directorate_rank.includes("spill"), false);
  assert.equal(errorText("rank-incomplete", { ...qn, required: true }, t), errorText("required", { ...qn, required: true }, t), "a required ranking is not offered blank as a way out");
});

test("a phone number is refused only for its length, never its format", () => {
  const def = load(STAFF);
  const check = (phone) => validateAnswers(def, readRaw(def, staffAnswers({ phone, resume: SOME_ID })));
  for (const ok of ["555 0100", "+44 20 7946 0000", "555-0199 ext. 2", "call after 5"]) assert.equal(check(ok).errors.phone, undefined, ok);
  assert.equal(check("1".repeat(QUESTION_TYPES.tel.max + 1)).errors.phone, "too-long");
  assert.equal(check("").errors.phone, "required");
  const vol = load("volunteer-application");
  assert.equal(validateAnswers(vol, readRaw(vol, { phone: "" })).errors.phone, undefined, "optional for volunteers");
});

/* ------------------------------------------------------------------ files, end to end */

test("a PDF goes up on its own, and Send claims it: the answer keeps its name, size and digest, never its bytes", async () => {
  await freshServer();
  await openStaff();
  const fileId = await fileIdFor();
  assert.match(fileId, /^[A-Za-z0-9_-]{32}$/);
  const kept = await one("SELECT name, type, bytes, submission_id FROM uploads WHERE file_id = $1", [fileId]);
  assert.deepEqual({ ...kept }, { name: "resume.pdf", type: "application/pdf", bytes: PDF.length, submission_id: null });

  const res = await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ _key: "k-app-0001", resume: fileId })), ip());
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.match(body.ref, /^SA-/);
  const sub = await one("SELECT id, answers FROM submissions WHERE ref = $1", [body.ref]);
  assert.equal((await one("SELECT submission_id FROM uploads WHERE file_id = $1", [fileId])).submission_id, sub.id);
  assert.deepEqual(Object.keys(sub.answers.resume[0]).sort(), ["bytes", "fileId", "name", "sha256", "type"]);
  assert.equal(sub.answers.resume[0].bytes, PDF.length);
  assert.doesNotMatch(JSON.stringify(sub.answers), new RegExp(PDF.toString("base64").slice(0, 16)));
  assert.deepEqual(sub.answers.directorate_rank, ["programs", "engagement", "wellness_support", "business_development"]);
  assert.deepEqual(sub.answers.portfolio, ["https://example.org/work", "https://example.org/more"]);
  assert.deepEqual((await many("SELECT kind FROM outbox ORDER BY id")).map((r) => r.kind), ["connect.ingest", "sheets.backup"]);
});

test("a file that is not a PDF, or is over 3 MB, is refused as soon as it is chosen", async () => {
  await freshServer();
  await openStaff();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
  const renamed = await upload("resume", jpeg, { name: "resume.pdf" });
  assert.equal(renamed.status, 415, "a picture named .pdf");
  assert.equal((await renamed.json()).error, "file.notPdf");
  const typed = await upload("resume", PDF, { type: "image/jpeg" });
  assert.equal(typed.status, 415, "sent as a picture");
  const max = QUESTION_TYPES.file.maxBytes;
  const big = Buffer.concat([PDF, Buffer.alloc(max + 1 - PDF.length)]);
  const over = await upload("resume", big);
  assert.equal(over.status, 413);
  assert.equal((await over.json()).error, "file.tooBig");
  assert.equal((await upload("resume", big.subarray(0, max))).status, 200, "exactly 3 MB is allowed");
  assert.equal((await one("SELECT count(*)::int AS n FROM uploads")).n, 1);
});

test("a closed form takes no file, nor does a question that is not a file, and nothing serves one back", async () => {
  await freshServer();
  const closed = await upload("resume", PDF);
  assert.equal(closed.status, 409);
  const cb = await closed.json();
  assert.equal(cb.error, "form.closed");
  assert.match(cb.closedMessage, /closed/i);
  await openStaff();
  for (const question of ["name", "portfolio", "nothing", ""]) {
    const r = await upload(question, PDF);
    assert.equal(r.status, 404, question);
    assert.equal((await r.json()).error, "file.question", question);
  }
  assert.equal((await upload("resume", PDF, { key: "workshop-request" })).status, 404, "a form with no file question");
  const fileId = await fileIdFor();
  for (const path of [`/api/forms/${STAFF}/files`, `/api/forms/${STAFF}/files?id=${fileId}`]) {
    const r = await handle(new Request(ORIGIN + path), ip());
    assert.equal(r.status, 405, path);
    assert.doesNotMatch(await r.text(), /%PDF/);
  }
  const cross = await handle(new Request(`${ORIGIN}/api/forms/${STAFF}/files?q=resume`, { method: "POST", headers: { "content-type": "application/pdf", origin: "https://elsewhere.example" }, body: PDF }), ip());
  assert.equal(cross.status, 403, "a file from another site's page");
});

test("Send refuses a file it cannot match — unknown, already sent, or for another question — and a second resume", async () => {
  await freshServer();
  await openStaff();
  const send = async (key, resume) => {
    const r = await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ _key: key, resume })), ip());
    return { status: r.status, body: await r.json() };
  };
  const unknown = await send("k-app-0101", SOME_ID);
  assert.equal(unknown.status, 422);
  assert.deepEqual(unknown.body.errors, { resume: "file-missing" });

  const letter = await fileIdFor("cover_letter", "letter.pdf");
  assert.deepEqual((await send("k-app-0102", letter)).body.errors, { resume: "file-missing" }, "a cover letter is not a resume");

  const a = await fileIdFor();
  const b = await fileIdFor("resume", "resume-2.pdf");
  assert.deepEqual((await send("k-app-0103", [a, b])).body.errors, { resume: "files-too-many" });

  assert.equal((await send("k-app-0104", a)).status, 200);
  assert.deepEqual((await send("k-app-0105", a)).body.errors, { resume: "file-missing" }, "a file goes with one application only");
  assert.equal((await one("SELECT count(*)::int AS n FROM submissions")).n, 1);
  assert.equal((await one("SELECT count(*)::int AS n FROM uploads WHERE submission_id IS NOT NULL")).n, 1);

  const html = await (await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ resume: SOME_ID }), { json: false }), ip())).text();
  assert.match(html, /f-resume/, "without JavaScript the form comes back asking for the file again");
  assert.doesNotMatch(html, new RegExp(SOME_ID));
});

test("a resume chosen again: Send claims the replacement, and the first file goes nowhere", async () => {
  // The browser stops the first upload when the second is chosen (ops/interact.mjs); if the
  // first had already landed, it stays unclaimed and is cleared after a day (files.mjs).
  await freshServer();
  await openStaff();
  const first = await fileIdFor("resume", "old.pdf");
  const second = await fileIdFor("resume", "new.pdf");
  const res = await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ _key: "k-app-0151", resume: second })), ip());
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  const sub = await one("SELECT * FROM submissions WHERE ref = $1", [body.ref]);
  assert.equal((await one("SELECT submission_id FROM uploads WHERE file_id = $1", [first])).submission_id, null);
  assert.equal((await one("SELECT submission_id FROM uploads WHERE file_id = $1", [second])).submission_id, sub.id);
  const payload = ingestPayload(sub, serverContent().forms[STAFF]);
  assert.deepEqual(payload.files.map((f) => [f.fileId, f.name]), [[second, "new.pdf"]]);
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(first));
});

/* WORK.md item 1b: the application changes while someone has it open, after their resume is up. */
async function publishStaff(change) {
  const v3 = structuredClone(serverContent().forms[STAFF]);
  v3.version = 3;
  change(v3);
  await q("INSERT INTO form_versions (form_key, version, definition, published_by) VALUES ($1, 3, $2::jsonb, 'test')", [STAFF, JSON.stringify(v3)]);
}
const staffSection = (def, id) => def.sections.find((s) => s.id === id).questions;

test("a resume uploaded before the form changed: the reply keeps it, the file is not asked for again, and the next Send claims it", async () => {
  await freshServer();
  await openStaff();
  const fileId = await fileIdFor();
  await publishStaff((d) => staffSection(d, "finished").push({ id: "start_term", type: "short", label: "Which term could you start?", required: true }));
  const body = await (await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ _key: "k-app-0161", resume: fileId })), ip(2))).json();
  assert.deepEqual(Object.keys(body.errors), ["start_term"]);
  assert.match(body.form, new RegExp(`name="resume" value="${fileId}" data-file-id`), "the uploaded file's id is carried");
  const box = body.form.match(/<div class="upload" data-upload="resume">.*?<\/div>/s)?.[0] || "";
  assert.doesNotMatch(box.match(/<input[^>]*type="file"[^>]*>/)?.[0] ?? "required", /\brequired\b/, "and the file is not asked for again");
  assert.equal((await one("SELECT submission_id FROM uploads WHERE file_id = $1", [fileId])).submission_id, null, "nothing is claimed by a send that was refused");
  const res = await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ _key: "k-app-0161", _version: "3", resume: fileId, start_term: "Spring" })), ip(2));
  assert.equal(res.status, 200);
  const sub = await one("SELECT * FROM submissions");
  assert.deepEqual([sub.form_version, sub.version_seen], [3, 3]);
  assert.equal((await one("SELECT submission_id FROM uploads WHERE file_id = $1", [fileId])).submission_id, sub.id);
});

test("a file question retired after the upload: the send is accepted, that file is not claimed, and Connect is not told of it", async () => {
  await freshServer();
  await openStaff();
  const resume = await fileIdFor();
  const letter = await fileIdFor("cover_letter", "letter.pdf");
  await publishStaff((d) => { const qs = staffSection(d, "supplemental"); qs.splice(qs.findIndex((x) => x.id === "cover_letter"), 1); });
  const res = await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ _key: "k-app-0162", resume, cover_letter: letter })), ip(3));
  assert.equal(res.status, 200);
  const sub = await one("SELECT * FROM submissions");
  assert.equal("cover_letter" in sub.answers, false);
  assert.equal((await one("SELECT submission_id FROM uploads WHERE file_id = $1", [letter])).submission_id, null, "cleared after a day, like any unclaimed upload");
  const payload = ingestPayload(sub, await definitionFor(STAFF, sub.form_version));
  assert.deepEqual(payload.files.map((f) => f.question), ["resume"]);
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(letter));
});

test("Connect is told which files to collect and which answers are confidential; the staff page shows neither confidential answer", async () => {
  await freshServer();
  await openStaff();
  const fileId = await fileIdFor();
  const ref = (await (await handle(post(`/api/forms/${STAFF}/submit`, staffAnswers({ _key: "k-app-0201", resume: fileId })), ip())).json()).ref;
  const sub = await one("SELECT * FROM submissions WHERE ref = $1", [ref]);
  const def = serverContent().forms[STAFF];
  const payload = ingestPayload(sub, def);
  assert.equal(payload.files.length, 1);
  assert.deepEqual(Object.keys(payload.files[0]).sort(), ["bytes", "fileId", "name", "question", "sha256", "type"]);
  assert.equal(payload.files[0].question, "resume");
  assert.deepEqual(payload.answers.resume, ["resume.pdf (1 KB)"]);
  assert.equal(payload.answers.directorate_rank[0], "1. Programs");
  assert.deepEqual(payload.optionIds.directorate_rank, ["programs", "engagement", "wellness_support", "business_development"], "Connect maps by id, first choice first");
  assert.equal(payload.optionIds.facilitating, "unsure");
  assert.equal(payload.optionIds.semesters, "s3");
  for (const id of ["name", "portfolio", "resume", "about"]) assert.equal(id in payload.optionIds, false, id);
  assert.deepEqual(payload.answers.portfolio, ["https://example.org/work", "https://example.org/more"]);
  assert.equal(payload.answers.facilitating, questionById(def, "facilitating").options.find((o) => o.id === "unsure").label);
  const conf = payload.columns.filter((c) => c.confidential).map((c) => c.id);
  assert.deepEqual(conf, ["work_study", "commitments"]);
  assert.equal(payload.answers.commitments, "Made-up commitments.", "Connect gets them; it decides who reads them");

  const page = await latestAnswers(STAFF);
  assert.equal(page.items.length, 1);
  for (const id of conf) {
    assert.equal(page.columns.some((c) => c.id === id), false, id);
    assert.equal(page.items[0].answers[id], undefined, id);
  }
  assert.equal(page.items[0].answers.name, "River Example");
  assert.equal(page.items[0].answers.resume, "resume.pdf (1 KB)");
});

/* ------------------------------------------------------------------ the letter of referral / recommendation */

const LETTER = "recommendation-letter";
const letterAnswers = (over = {}) => ({
  _form: LETTER, _version: "1",
  name: "Sky Example", email: "sky@example.org", applicant: "River Example",
  ...over,
});

test("the letter form is the one recommend.badgersupports.org opens, built closed: a name, an email, the applicant, one PDF", () => {
  const def = load(LETTER);
  assert.equal(def.state, "closed");
  assert.deepEqual(definitionProblems(def), []);
  assert.deepEqual(definitionProblems({ ...def, state: "open" }), [], "open");
  assert.ok(def.source.aliases.includes("https://recommend.badgersupports.org/"));
  assert.deepEqual(allQuestions(def).filter(({ q }) => q.type === "file").map(({ q }) => q.id), ["letter"]);
  for (const id of ["name", "email", "applicant", "letter"]) assert.equal(questionById(def, id).required, true, id);
  assert.notEqual(questionById(def, "phone").required, true, "a phone number may be left out");
  assert.equal(allQuestions(def).some(({ q }) => q.confidential), false, "Connect's permissions decide who reads a letter");
  assert.doesNotMatch(JSON.stringify(publicDefinition(def)), /"(review|proposed|source|workflow|help|confidential)":/);
});

test("a letter goes up as a PDF and Send claims it; Connect is told to collect it from the question 'letter'", async () => {
  await freshServer();
  await q("INSERT INTO form_state (form_key, state, changed_by) VALUES ($1, 'open', 'test')", [LETTER]);
  const up = await upload("letter", PDF, { key: LETTER, name: "letter.pdf" });
  assert.equal(up.status, 200);
  const fileId = (await up.json()).fileId;
  assert.equal((await upload("resume", PDF, { key: LETTER })).status, 404, "the letter form asks for no resume");

  const missing = await handle(post(`/api/forms/${LETTER}/submit`, letterAnswers({ _key: "k-let-0001" })), ip());
  assert.equal(missing.status, 422);
  assert.deepEqual((await missing.json()).errors, { letter: "required" });

  const res = await handle(post(`/api/forms/${LETTER}/submit`, letterAnswers({ _key: "k-let-0002", letter: fileId })), ip());
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.match(body.ref, /^RL-/);
  const sub = await one("SELECT * FROM submissions WHERE ref = $1", [body.ref]);
  assert.equal((await one("SELECT submission_id FROM uploads WHERE file_id = $1", [fileId])).submission_id, sub.id);
  const payload = ingestPayload(sub, serverContent().forms[LETTER]);
  assert.deepEqual(payload.files.map((f) => [f.question, f.name]), [["letter", "letter.pdf"]]);
  assert.equal(payload.answers.applicant, "River Example");
  assert.deepEqual((await many("SELECT kind FROM outbox ORDER BY id")).map((r) => r.kind), ["connect.ingest", "sheets.backup"]);
});

test("the four request forms ask Google's own questions, built closed: the same answers required, Connect's directorates as owners", () => {
  const want = {
    "resource-request": { owner: "Engagement", required: ["email", "requesting"], alias: "https://forms.gle/GgfggAR7nRVSXrZPA" },
    "program-request": { owner: "Programs", required: ["name", "email", "on_behalf", "organization", "request_type", "group_size", "dates", "location", "access_needs", "notes"] },
    "referral-card-survey": { owner: "Programs", required: ["email"], alias: "https://forms.gle/eYdEzbosWkjfUQyN8" },
    "email-list": { owner: "Executive", required: ["email"], alias: "https://forms.gle/THmnT9QCdeeaoZx38" },
  };
  for (const [key, w] of Object.entries(want)) {
    const def = load(key);
    assert.equal(def.state, "closed", key);
    assert.deepEqual(definitionProblems(def), [], key);
    assert.deepEqual(definitionProblems({ ...def, state: "open" }), [], `${key} open`);
    assert.deepEqual(allQuestions(def).filter(({ q }) => q.required).map(({ q }) => q.id), w.required, key);
    assert.equal(allQuestions(def).some(({ q }) => q.type === "file" || q.confidential), false, `${key} takes no file and keeps nothing confidential`);
    assert.equal(def.workflow.owner, w.owner, key);
    assert.match(def.source.publishedId, /^1FAIpQL[\w-]+$/, key);
    if (w.alias) assert.ok(def.source.aliases.includes(w.alias), key);
    assert.doesNotMatch(JSON.stringify(publicDefinition(def)), /"(review|proposed|source|workflow|help|confidential)":/, key);
  }
  const cards = load("referral-card-survey");
  assert.equal(cards.workflow.receipt, "none", "the survey's address is for project news, not a receipt");
  assert.equal(validateAnswers(cards, readRaw(cards, { email: "river@example.org" })).ok, true, "every card question may be left blank");
  const list = load("email-list");
  assert.equal(list.workflow.receipt, "none", "the site never emails an address no one has confirmed");
  assert.equal(validateAnswers(list, readRaw(list, { email: "river@example.org" })).ok, true);
  assert.equal(validateAnswers(list, readRaw(list, { email: "river" })).ok, false, "an address is checked");
  const prog = load("program-request");
  const sent = validateAnswers(prog, readRaw(prog, {
    name: "River Example", email: "river@example.org", on_behalf: "__other", on_behalf__other: "A class", organization: "A class",
    request_type: ["peer_support_group", "collaboration"], group_size: "size_11_20", dates: "Any Tuesday", location: "Not sure", access_needs: "None", notes: "None",
  }));
  assert.equal(sent.ok, true, JSON.stringify(sent.errors));
  assert.equal(sent.answers.on_behalf__other, "A class");
});

test("a mailing-list request says it was received, never that the person is on the list: being invited, pending and subscribed are known only to the Google Group and to Connect", () => {
  const list = load("email-list");
  const said = [list.confirmation.title, ...list.confirmation.body].join(" ");
  assert.match(said, /not on the list yet/);
  assert.doesNotMatch(said.replace(/not on the list yet/g, ""), /\b(you are|you're|you’re|you have been) (now )?(on|added|subscribed|signed up|joined|in)\b|\bwelcome\b/i);
  assert.match(list.closedMessage, /Google Forms/);
  const words = list.sections.find((s) => s.questions.length === 0);
  assert.ok(words, "the add-yourself steps are words, not a question");
  assert.ok(words.intro.some((p) => p.links?.some((l) => l.href === "mailto:badgersupports+subscribe@g-groups.wisc.edu")), "and the address is a link");
});
