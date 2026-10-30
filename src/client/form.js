/* Native forms, enhanced. Without this file a form still works: it posts to the intake API,
 * which answers with the corrected form or the confirmation. With it:
 *   - branches open and close as answers change (the server drops hidden answers regardless);
 *   - answers are checked with the server's own rules before sending;
 *   - each form carries one idempotency key, so pressing Send twice, or again after a network
 *     failure, can never create a second submission;
 *   - a form closed while the tab was open says so before anyone types more, and again if they
 *     press Send — the server refuses either way;
 *   - a form whose questions changed while the tab was open says so, and at Send the server's
 *     reply, the form as it now stands with the answers that still fit, takes this one's place;
 *   - a file question sends its PDF on its own as soon as it is chosen, and the form sends only
 *     the id the server gave it (netlify/lib/files.mjs). Send waits for an upload in progress.
 * A preview (data-preview, prototype builds only) checks answers the same way and sends nothing.
 * Analytics: this file announces "form_start" and "form_submit_success" as DOM events with the
 * form key only. It never reads answers into them.
 */

import { visibility, validateAnswers, readRaw, errorText, allQuestions, QUESTION_TYPES } from "./forms.mjs";
import { t } from "./text.js";

const STALE_MS = 10 * 60 * 1000;

const announce = (name, detail) => document.dispatchEvent(new CustomEvent("bss:analytics", { detail: { name, ...detail } }));
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

function rawFrom(form, def) {
  return readRaw(def, new FormData(form));
}

function jsonBody(form) {
  const fd = new FormData(form);
  const out = {};
  for (const k of new Set(fd.keys())) {
    const all = fd.getAll(k);
    out[k] = all.length > 1 ? all : all[0];
  }
  return out;
}

function applyVisibility(form, def) {
  const vis = visibility(def, validateAnswers(def, rawFrom(form, def)).answers);
  for (const sec of form.querySelectorAll("[data-section]")) {
    const show = vis.sections.has(sec.dataset.section);
    sec.hidden = !show;
  }
  for (const f of form.querySelectorAll(".field[data-show-if]")) f.hidden = !vis.questions.has(f.dataset.q);
  for (const p of form.querySelectorAll("[data-only-if]")) p.hidden = true;
  for (const box of form.querySelectorAll(".choices")) {
    const otherRadio = box.querySelector("[data-other]");
    const otherText = box.querySelector(".other-text");
    if (otherRadio && otherText) otherText.hidden = !otherRadio.checked;
  }
}

/* A question's own help stays named by its control whether or not an error is showing. */
const helpOf = (control) => control.closest(".field")?.querySelector(":scope > .field-help");

function describe(control, errorId) {
  const ids = [helpOf(control)?.id, errorId].filter(Boolean).join(" ");
  if (ids) control.setAttribute("aria-describedby", ids);
  else control.removeAttribute("aria-describedby");
}

/* A long answer shows the room left once a tenth of it remains, so words the box cuts off at its
   limit (a long paste, say) are not lost unseen. A screen reader hears it when it first shows and
   again at none left, not at every key, as in SPILL's home.js. Without this file the box still
   stops at its limit and the server refuses anything longer. */
function counters(form) {
  for (const box of form.querySelectorAll("textarea[maxlength]:not([inputmode])")) {
    const left = Object.assign(document.createElement("p"), { className: "field-left", hidden: true });
    const say = Object.assign(document.createElement("p"), { className: "sr-only" });
    say.setAttribute("role", "status");
    box.after(left, say);
    let was = "room";
    const update = () => {
      const n = Math.max(0, box.maxLength - box.value.length);
      const now = n === 0 ? "none" : n <= box.maxLength / 10 ? "near" : "room";
      left.hidden = now === "room";
      left.textContent = t("form.left", { n: n.toLocaleString() });
      if (now !== was && now !== "room") say.textContent = left.textContent;
      was = now;
    };
    box.addEventListener("input", update);
    box.addEventListener("blur", () => { say.textContent = ""; });
    update();
    say.textContent = "";
  }
}

function clearErrors(form) {
  for (const f of form.querySelectorAll(".field.has-error")) f.classList.remove("has-error");
  for (const p of form.querySelectorAll(".field-error")) p.remove();
  for (const c of form.querySelectorAll("[aria-invalid]")) { c.removeAttribute("aria-invalid"); describe(c, null); }
  const sum = form.querySelector("[data-error-summary]");
  sum.hidden = true;
  sum.removeAttribute("role");
}

function showErrors(form, def, errors) {
  clearErrors(form);
  const qs = allQuestions(def).filter(({ q }) => errors[q.id]).map(({ q }) => q);
  for (const q of qs) {
    const field = form.querySelector(`.field[data-q="${q.id}"]`);
    if (!field) continue;
    field.classList.add("has-error");
    const p = Object.assign(document.createElement("p"), { className: "field-error", id: `e-${q.id}`, textContent: errorText(errors[q.id], q, t) });
    // After the question's words and help, before its control, where the server puts it too.
    const above = field.querySelector(":scope > .field-help") || field.querySelector(":scope > legend, :scope > label[for], :scope > .q-label");
    if (above) above.after(p); else field.prepend(p);
    const control = field.querySelector(`#f-${q.id}`);
    if (control) { control.setAttribute("aria-invalid", "true"); describe(control, p.id); }
  }
  const sum = form.querySelector("[data-error-summary]");
  sum.querySelector("p").textContent = qs.length === 1 ? t("form.errors.one") : t("form.errors.many", { n: qs.length });
  sum.querySelector("[data-error-list]").replaceChildren(...qs.map((q) => {
    const li = document.createElement("li");
    li.append(Object.assign(document.createElement("a"), { href: `#f-${q.id}`, textContent: errorText(errors[q.id], q, t) }));
    return li;
  }));
  sum.hidden = false;
  sum.setAttribute("role", "alert");
  sum.focus();
}

function notice(form, title, ...lines) {
  const n = form.querySelector("[data-form-notice]");
  n.replaceChildren(Object.assign(document.createElement("h2"), { textContent: title }), ...lines.filter(Boolean).map((l) => Object.assign(document.createElement("p"), { textContent: l })));
  n.hidden = false;
}

function done(form, def, ref) {
  const panel = document.createElement("div");
  panel.className = "done-panel";
  panel.dataset.formDone = "";
  const h = Object.assign(document.createElement("h2"), { textContent: def.confirmation?.title || t("form.done.title"), tabIndex: -1 });
  const p = document.createElement("p");
  const [before, after = ""] = t("form.done.ref").split("{{ref}}");
  p.append(before, Object.assign(document.createElement("span"), { className: "ref", textContent: ref }), after);
  panel.append(h, p, ...(def.confirmation?.body || []).map((t) => Object.assign(document.createElement("p"), { textContent: t })));
  form.replaceWith(panel);
  h.focus();
}

/* An id that passes the form rules, for a preview's file that never leaves the browser. */
function previewFileId() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_");
}

const isPdf = (file) => file.type === "application/pdf" || (!file.type && /\.pdf$/i.test(file.name));

/* One file question: the chosen PDF goes up at once, on its own, and its id goes into the hidden
   input the form sends. Choosing again replaces it at once: the older upload is stopped, its reply
   is ignored, and Send stops waiting for it (ops/interact.mjs shows each case in a browser). */
function uploader(form, key, box, { preview, uploads, onClosed, onSettled }) {
  const input = box.querySelector("[data-file]");
  const id = box.querySelector("[data-file-id]");
  const status = box.querySelector("[data-upload-status]");
  const q = box.dataset.upload;
  const maxMb = QUESTION_TYPES.file.maxBytes / (1024 * 1024);
  let turn = 0;
  let going = null; // the upload in progress for this question, so a new choice can stop it
  const say = (text) => { status.textContent = text; };
  const fail = (text) => { id.value = ""; input.value = ""; say(text); };
  input.addEventListener("change", async () => {
    const mine = ++turn;
    // A new choice ends the old one at once: whatever it was, nothing of it is going up any more.
    if (going) going.abort();
    going = null;
    uploads.delete(q);
    onSettled();
    const file = input.files && input.files[0];
    id.value = "";
    if (!file) { say(""); return; }
    if (!isPdf(file)) { fail(t("form.upload.notPdf")); return; }
    if (file.size > QUESTION_TYPES.file.maxBytes) { fail(t("form.upload.tooBig", { max: maxMb })); return; }
    if (preview) { id.value = previewFileId(); say(t("form.preview.file", { name: file.name })); return; }
    say(t("form.upload.uploading", { name: file.name }));
    uploads.add(q);
    const stop = going = new AbortController();
    try {
      const res = await fetch(`/api/forms/${key}/files?q=${encodeURIComponent(q)}`, {
        method: "POST",
        headers: { "content-type": "application/pdf", accept: "application/json", "x-file-name": encodeURIComponent(file.name) },
        body: file,
        signal: stop.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (mine !== turn) return;
      if (res.ok && body.ok && body.fileId) { id.value = body.fileId; say(t("form.upload.done", { name: file.name })); return; }
      if (body.error === "form.closed") { fail(""); onClosed(body.closedMessage || ""); return; }
      if (body.error === "file.notPdf") fail(t("form.upload.notPdf"));
      else if (body.error === "file.tooBig") fail(t("form.upload.tooBig", { max: maxMb }));
      else if (body.error === "rate.limited") fail(t("form.status.rateLimited"));
      else fail(t("form.upload.failed"));
    } catch {
      if (mine === turn) fail(t("form.upload.failed"));
    } finally {
      if (mine === turn) { going = null; uploads.delete(q); onSettled(); }
    }
  });
}

/* The questions changed while the tab was open, and Send's reply carries the form as it now stands
   (netlify/lib/router.mjs formSubmit): the answers that still fit, any new questions, each problem
   marked, and anything typed for a question that is gone listed under the notice, not sent. It
   takes this form's place and is enhanced the same way, keeping this form's key, so the next Send
   is still the same submission. An uploaded file that still has its question stays, and says so.
   The markup is the server's render of the text table (src/render/form.mjs), so it adds no word. */
function swapForm(form, markup) {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  const next = doc.querySelector(`form[data-form="${form.dataset.form}"]`);
  const island = next?.querySelector(`#form-def-${form.dataset.form}`);
  if (!island) return false;
  for (const box of next.querySelectorAll("[data-upload]")) {
    const was = form.querySelector(`[data-upload="${box.dataset.upload}"]`);
    const kept = box.querySelector("[data-file-id]").value;
    if (was && kept && was.querySelector("[data-file-id]").value === kept) box.querySelector("[data-upload-status]").textContent = was.querySelector("[data-upload-status]").textContent;
  }
  form.replaceWith(next);
  enhance(next, { started: true });
  next.querySelector("[data-error-summary]:not([hidden])")?.focus();
  return true;
}

function enhance(form, { started = false } = {}) {
  const key = form.dataset.form;
  const def = JSON.parse(document.getElementById(`form-def-${key}`).textContent);
  const submit = form.querySelector("[data-submit]");
  const status = form.querySelector("[data-form-status]");
  const idem = form.querySelector("[data-idem]");
  const preview = "preview" in form.dataset;
  if (!idem.value) idem.value = newKey();
  form.noValidate = true;
  /* A resource named by the address (?resource=<id>) is chosen on the page as it first loads, when
     the list holds it and nothing is chosen yet. A page redrawn after Send keeps what was sent. */
  if (!started) {
    const params = new URLSearchParams(location.search);
    for (const sel of form.querySelectorAll("select[data-from-address]")) {
      const want = params.get(sel.name);
      if (want && !sel.value && [...sel.options].some((o) => o.value === want)) sel.value = want;
    }
  }
  let checkedAt = 0;
  let closed = false;
  const uploads = new Set(); // file questions with an upload in progress

  const close = (message) => {
    closed = true;
    submit.disabled = true;
    notice(form, t("form.closedNow.title"), message, t("form.closedNow.body"));
  };

  const checkState = async () => {
    checkedAt = Date.now();
    try {
      const res = await fetch(`/api/forms/${key}/state`, { headers: { accept: "application/json" }, cache: "no-store" });
      const s = await res.json();
      if (s.state === "closed") close(s.closedMessage || "");
      // Newer questions than this page has: say so now, and Send brings them in with the answers kept.
      else if (s.version && s.version !== def.version) notice(form, t("form.updated.title"), t("form.updated.ahead"));
    } catch { /* offline: the server still decides at Send */ }
  };

  // "Wait for your file" goes once nothing is going up, so it never outlasts the upload it meant.
  const settled = () => { if (!uploads.size && status.textContent === t("form.upload.wait")) status.textContent = ""; };
  for (const box of form.querySelectorAll("[data-upload]")) uploader(form, key, box, { preview, uploads, onClosed: close, onSettled: settled });
  counters(form);
  applyVisibility(form, def);
  // A preview is of a closed form, so it neither asks whether the form is open nor counts a start.
  if (!preview) {
    checkState();
    document.addEventListener("visibilitychange", () => {
      if (form.isConnected && document.visibilityState === "visible" && Date.now() - checkedAt > STALE_MS) checkState();
    });
  }

  form.addEventListener("input", () => {
    if (!started && !preview) { started = true; announce("form_start", { form: key }); }
    applyVisibility(form, def);
  });
  form.addEventListener("change", () => applyVisibility(form, def));

  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending || closed) return;
    if (uploads.size) { status.textContent = t("form.upload.wait"); return; }
    const check = validateAnswers(def, rawFrom(form, def));
    if (!check.ok) { showErrors(form, def, check.errors); return; }
    clearErrors(form);
    if (preview) { status.textContent = t("form.preview.sent"); return; }
    sending = true;
    submit.disabled = true;
    status.textContent = t("form.sending");
    let res, body;
    try {
      res = await fetch(form.action, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(jsonBody(form)) });
      body = await res.json();
    } catch {
      status.textContent = t("form.status.network");
      sending = false; submit.disabled = false;
      return;
    }
    sending = false;
    if (res.ok && body.ok) {
      announce("form_submit_success", { form: key });
      done(form, def, body.ref);
      return;
    }
    submit.disabled = false;
    status.textContent = "";
    if (body.error === "form.closed") { close(body.closedMessage || ""); return; }
    if (body.error === "answers.invalid") {
      if (body.form && swapForm(form, body.form)) return;
      if (body.version && body.version !== def.version) notice(form, t("form.updated.title"), t("form.updated.body"));
      // An upload the server no longer has is chosen again from scratch.
      for (const [id, code] of Object.entries(body.errors || {})) {
        const box = code === "file-missing" && form.querySelector(`[data-upload="${id}"]`);
        if (box) { box.querySelector("[data-file-id]").value = ""; box.querySelector("[data-file]").value = ""; box.querySelector("[data-upload-status]").textContent = ""; }
      }
      showErrors(form, def, body.errors || {});
      return;
    }
    if (body.error === "rate.limited") { status.textContent = t("form.status.rateLimited"); return; }
    status.textContent = t("form.status.serverError");
  });
}

for (const form of document.querySelectorAll("form[data-form]")) enhance(form);
