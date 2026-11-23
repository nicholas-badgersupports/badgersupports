/* The staff page's tools, drawn once someone is signed in (netlify/lib/staff.mjs). This module is
 * the console half of the split the source-exposure audit prescribed (F-1, 15 November 2026): it is
 * never published with the site's pages. The build holds it back (.build/staff-client/, ops/build.mjs)
 * and the API serves it only to a signed-in staff session (/api/staff/client/, netlify/lib/router.mjs),
 * so the console's code and words are no longer public reading. The public half — the states before
 * sign-in, and the loading of this half once /api/staff/me answers — is src/client/staff-signin.js;
 * this half's words arrive with that answer (staffText in netlify/lib/router.mjs), not in the page.
 * Sent here with ?return=/some/page/, Sign in comes back to that page. With someone signed in:
 *   - who they are, and Sign out (a plain form, so it works however the page is);
 *   - the forms their Connect role lets them read, each with how many answers it holds and
 *     whether those reached Connect, a button to send any still waiting, and the latest answers
 *     to one form on request; and the forms it lets them open and close, with Open (asked twice)
 *     or Close;
 *   - for anyone who may change words, how to, and how many saved changes are not on the site yet;
 *   - for anyone who may change or publish words: that changes take up to 30 minutes to show, when
 *     the site last updated (or that the last update failed), and Refresh now (router.mjs, refresh);
 *   - for anyone who may publish, the edits file, for a build (netlify/lib/edits.mjs);
 *   - for anyone who may change or publish words, the pages (structure.mjs): add or copy a draft, preview it at desktop
 *     and phone width, change its title, search description and address; for a publisher, put a draft on, retire a
 *     page, reorder the menu, and change the site's name, search description and accessibility email (one save for
 *     the three); for a publisher, each room's words and its steps' words and photos; and the published versions, with
 *     Bring back for a publisher, asked twice.
 * Only what the account may use is drawn. Reading answers ends sooner than the rest of a session
 * (netlify/lib/staff.mjs, sessionFrom); after that the forms part asks for a fresh sign-in instead.
 * The shell's check that is run again wins over one still on its way, and leaving the page takes
 * the tools off it, so a page a browser keeps for Back holds no answers; coming back to it checks
 * again. Nothing here is counted, and nothing is kept in the browser.
 */

import { t } from "./text.js";
import { formSetupWizard } from "./form-setup.js";

const app = document.querySelector("[data-staff-app]");
const WHEN = { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" };

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k != null && k !== false));
  return n;
};
const when = (iso) => new Date(iso).toLocaleString("en-US", WHEN);
const offline = () => ({ status: 0, body: {} });

/* A button at work: busy at once, so a second press does nothing, and its words change only once
   the wait is long enough to notice, so a quick answer does not flicker. Returns the undo. */
function busy(button, words) {
  const label = button.textContent;
  button.setAttribute("aria-busy", "true");
  const timer = setTimeout(() => { button.textContent = words; }, 200);
  return () => { clearTimeout(timer); button.removeAttribute("aria-busy"); button.textContent = label; };
}
const isBusy = (button) => button.getAttribute("aria-busy") === "true";

async function call(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method, credentials: "same-origin",
    headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const noteBox = (words, ...more) => el("div", { className: "staff-note" }, el("p", { textContent: words }), ...more);
const signInAgain = () => el("p", {}, el("a", { className: "btn", href: "/api/auth/start?return=/staff/", textContent: t("staff.signInAgain") }));
/* In place of the forms, or of one form's answers, once reading needs a fresh sign-in. */
const readAgain = () => noteBox(t("staff.readAgain"), signInAgain());
const isAgain = (r) => r.status === 403 && r.body.error === "auth.again";
/* In place of a publish action, once publishing needs a fresher sign-in (H-P1). */
const publishAgain = () => noteBox(t("staff.publishAgain"), signInAgain());
const isFresh = (r) => r.status === 403 && r.body.error === "auth.fresh";

/* What stands in place of something the server would not give, with its words for saying aloud:
   a fresh sign-in, the reason, or that it failed. */
function refused(r) {
  if (isAgain(r)) return [readAgain(), t("staff.readAgain")];
  if (isFresh(r)) return [publishAgain(), t("staff.publishAgain")];
  if (r.status === 401) return [noteBox(t("staff.ended"), signInAgain()), t("staff.ended")];
  if (r.status === 403) return [noteBox(t("staff.forbidden")), t("staff.forbidden")];
  return [noteBox(t("staff.loadError")), t("staff.loadError")];
}

const status = el("p", { className: "sr-only" });
status.setAttribute("role", "status");
app?.after(status);
function say(words) {
  status.textContent = "";
  // A fresh line each time, so a screen reader reads the same words twice in a row.
  requestAnimationFrame(() => { status.textContent = words; });
}

/* ---------- forms ---------- */

function deliveryLine(f, connect) {
  const d = f.delivery;
  const parts = [];
  if (!connect) return null;
  if (d.sent) parts.push(t("staff.delivery.sent", { n: d.sent }));
  if (d.pending) parts.push(t("staff.delivery.waiting", { n: d.pending }));
  if (d.failed) parts.push(t("staff.delivery.failed", { n: d.failed }));
  if (d.stuck) parts.push(t("staff.delivery.stuck", { n: d.stuck }));
  return parts.length ? el("p", { className: d.failed || d.stuck ? "staff-delivery is-failing" : "staff-delivery", textContent: parts.join(" · ") }) : null;
}

function answersTable(r) {
  const cols = [{ id: "#ref", label: t("staff.answers.ref") }, { id: "#at", label: t("staff.answers.received") }, { id: "#to", label: t("staff.answers.delivery") }, ...r.columns];
  const head = el("tr", {}, ...cols.map((c) => el("th", { scope: "col", textContent: c.label })));
  const rows = r.items.map((it) => el("tr", {}, ...cols.map((c) => {
    if (c.id === "#ref") return el("th", { scope: "row", textContent: it.ref });
    if (c.id === "#at") return el("td", { textContent: when(it.receivedAt) });
    if (c.id === "#to") return el("td", { textContent: t(`staff.row.${it.delivery}`) });
    return el("td", { textContent: it.answers[c.id] ?? "" });
  })));
  const caption = el("caption", { textContent: t("staff.answers.caption", { title: r.title, shown: r.items.length, total: r.total }) });
  const box = el("div", { className: "staff-table", tabIndex: 0 }, el("table", {}, caption, el("thead", {}, head), el("tbody", {}, ...rows)));
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", t("staff.answers.region", { title: r.title }));
  /* An answer whose form definition could not be read stands in the table with its answers
     withheld (PF-10); the note under the table says why its row is empty. */
  if (!r.items.some((it) => it.withheld)) return box;
  return el("div", {}, box, noteBox(t("staff.answers.withheld")));
}

/* Open or Close for one form (router.mjs, formSwitch). Open asks again, naming the form, before anything is
   sent; Close goes at once. The chip and the button follow the server's answer, never the click. */
function switchControl(f, chip) {
  const box = el("div", { className: "staff-switch" });
  const shown = () => box.querySelector("button");
  function draw() {
    chip.className = `staff-chip is-${f.state}`;
    chip.textContent = t(f.stateReason === "scheduled" ? "staff.formSettings.scheduled" : f.stateReason === "ended" ? "staff.formSettings.ended" : `staff.forms.state.${f.state}`);
    const enabled = (f.manualState || f.state) === "open";
    const button = el("button", { type: "button", className: "btn btn--quiet", textContent: t(enabled ? "staff.switch.close" : "staff.switch.open") });
    button.addEventListener("click", () => (enabled ? send(button, "closed") : ask()));
    box.replaceChildren(el("div", { className: "staff-actions" }, button));
  }
  function ask() {
    const yes = el("button", { type: "button", className: "btn", textContent: t("staff.switch.yes") });
    const no = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.switch.cancel") });
    yes.addEventListener("click", () => send(yes, "open"));
    no.addEventListener("click", () => { draw(); shown().focus(); });
    box.replaceChildren(noteBox(t("staff.switch.confirm", { title: f.title }), el("div", { className: "staff-actions" }, yes, no)));
    yes.focus();
  }
  async function send(button, state) {
    if (isBusy(button)) return;
    const done = busy(button, t(state === "open" ? "staff.switch.opening" : "staff.switch.closing"));
    const r = await call(`/api/staff/forms/${encodeURIComponent(f.key)}/switch`, { method: "POST", body: state === "open" ? { state, confirm: f.key } : { state } }).catch(offline);
    done();
    if (!box.isConnected) return;
    if (r.status !== 200) {
      const [why, words] = r.body.error === "switch.empty" ? [noteBox(t("staff.switch.empty")), t("staff.switch.empty")] : refused(r);
      draw();
      box.append(why);
      shown().focus();
      say(words);
      return;
    }
    f.state = r.body.state;
    f.manualState = r.body.manualState || r.body.state;
    f.stateReason = r.body.stateReason;
    draw();
    const words = [t(f.stateReason === "scheduled" ? "staff.formSettings.enabledLater" : f.stateReason === "ended" ? "staff.formSettings.ended" : f.state === "open" ? "staff.switch.opened" : "staff.switch.closed", { title: f.title }), r.body.purgeError ? t("staff.switch.slow") : ""].filter(Boolean).join(" ");
    box.append(el("p", { textContent: words }));
    shown().focus();
    say(words);
  }
  draw();
  return box;
}

function formSettingsControl(f, saved) {
  if (!f.settings || (!f.canSwitch && !f.canEdit)) return null;
  const summary = el("summary", { textContent: t("staff.formSettings.title") });
  const box = el("details", { className: "staff-form-settings" }, summary);
  const inputs = {}, initial = {}, fields = [];
  for (const k of ["opensAt", "deadline", "closesAt", "title", "introduction", "closedMessage"]) {
    const date = ["opensAt", "closesAt", "deadline"].includes(k);
    if (date ? !f.canSwitch : !f.canEdit) continue;
    const value = date ? f.settings[k] : f.settings[k] ?? f.defaults[k];
    const input = el(date || k === "title" ? "input" : "textarea", { ...(date ? { type: "datetime-local" } : k === "title" ? { type: "text", maxLength: 200 } : { rows: 4, maxLength: 8000 }), value: value || "" });
    input.id = `settings-${f.key}-${k}`; inputs[k] = input; initial[k] = input.value;
    const label = k === "deadline" && f.key === "staff-application" ? "priority" : k === "title" ? "titleLabel" : k;
    fields.push(el("div", { className: "field" }, el("label", { htmlFor: input.id, textContent: t(`staff.formSettings.${label}`) }), input));
  }
  const note = el("p", { textContent: t("staff.formSettings.help") });
  const error = el("p", { role: "alert", hidden: true });
  const button = el("button", { type: "submit", className: "btn", textContent: t("staff.formSettings.save") });
  const form = el("form", { noValidate: true }, note, ...fields, error, button);
  form.addEventListener("submit", async e => {
    e.preventDefault(); if (isBusy(button)) return;
    const body = { ...f.settings };
    for (const [k,input] of Object.entries(inputs)) if (input.value !== initial[k]) body[k] = input.value;
    const done = busy(button, t("staff.formSettings.saving"));
    const r = await call(`/api/staff/forms/${encodeURIComponent(f.key)}/settings`, { method: "POST", body }).catch(offline); done();
    if (!form.isConnected) return;
    if (r.status !== 200) {
      error.hidden = false;
      error.textContent = t(r.body.error === "settings.conflict" ? "staff.formSettings.conflict" : r.body.error?.startsWith("settings.") ? "staff.formSettings.invalid" : r.status === 403 ? "staff.forbidden" : "staff.loadError");
      say(error.textContent); return;
    }
    saved(r.body.forms.find(x => x.key === f.key));
    say(t("staff.formSettings.saved") + (r.body.purgeError ? " " + t("staff.switch.slow") : ""));
  });
  box.append(form); return box;
}

/* A form's saved dates are Chicago wall times (netlify/lib/form-settings.mjs), not instants:
   they are shown as written, so the line reads the same in any browser. */
const whenLocal = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || "");
  if (!m) return v || "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
};

function formCard(f, connect, connectUrl) {
  const panel = el("div", { className: "staff-answers", id: `answers-${f.key}`, hidden: true });
  const toggle = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.answers.show") });
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panel.id);
  toggle.addEventListener("click", async () => {
    if (isBusy(toggle)) return;
    const open = toggle.getAttribute("aria-expanded") === "true";
    if (open) {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = t("staff.answers.show");
      return;
    }
    const done = busy(toggle, t("staff.answers.loading"));
    const r = await call(`/api/staff/forms/${encodeURIComponent(f.key)}/submissions`).catch(offline);
    done();
    if (!toggle.isConnected) return; // the page was left or drawn again meanwhile
    if (r.status !== 200) {
      // The reason shows where the answers would be; Show answers again tries again.
      const [box, words] = refused(r);
      panel.replaceChildren(box);
      panel.hidden = false;
      say(words);
      return;
    }
    panel.replaceChildren(r.body.items.length ? answersTable(r.body) : el("p", { textContent: t("staff.answers.none") }));
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = t("staff.answers.hide");
  });
  const state = el("span", { className: `staff-chip is-${f.state}`, textContent: t(`staff.forms.state.${f.state}`) });
  // A form someone may switch but not read shows its title and switch only: no counts, no answers.
  const read = f.canRead !== false;
  /* This form's queue in Connect (its Website Forms pane, scoped to the form), in a new tab so
     the console keeps its place. The section's own link at the foot stays for the whole queue. */
  const inConnect = read && connectUrl ? el("a", { className: "btn btn--quiet", href: `${connectUrl}/#/admin/webforms/${encodeURIComponent(f.key)}`, target: "_blank", rel: "noopener", textContent: t("staff.answers.inConnect") }) : null;
  /* The saved start and stop on the card's face, beside the switch they govern, so neither has
     to be opened out of the fold to be checked. Only for a form whose dates are set. */
  const dates = f.settings && (f.settings.opensAt || f.settings.closesAt)
    ? el("p", { className: "staff-form-dates", textContent: [f.settings.opensAt && `${t("staff.formSettings.opensAt")}: ${whenLocal(f.settings.opensAt)}`, f.settings.closesAt && `${t("staff.formSettings.closesAt")}: ${whenLocal(f.settings.closesAt)}`].filter(Boolean).join(" · ") })
    : null;
  const card = el("li", { className: "staff-form" },
    el("h3", {}, el("span", { textContent: f.title }), " ", state),
    read ? el("p", { textContent: f.total ? `${t(f.total === 1 ? "staff.forms.count.one" : "staff.forms.count.other", { n: f.total })} · ${t("staff.forms.latest", { when: when(f.latest) })}` : t("staff.forms.none") }) : null,
    read ? deliveryLine(f, connect) : null,
    read && (f.total || inConnect) ? el("div", { className: "staff-actions" }, f.total ? toggle : null, inConnect) : null,
    read ? panel : null,
    dates,
    f.canSwitch ? switchControl(f, state) : null,
    formSettingsControl(f, updated => { const next = formCard(updated, connect, connectUrl); card.replaceWith(next); next.querySelector("summary")?.focus(); }));
  card.dataset.formCard = f.key;
  return card;
}

function formsSection(me, onData) {
  const list = el("ul", { className: "staff-forms" });
  const setupPlace = el("div");
  const setup = el("button", { type: "button", className: "btn", textContent: t("staff.setup.start"), hidden: true });
  setup.addEventListener("click", async () => {
    if (isBusy(setup)) return;
    const done = busy(setup, t("staff.setup.loading"));
    const r = await call("/api/staff/forms").catch(offline); done();
    if (!setup.isConnected) return;
    if (r.status !== 200) { const [why, words] = refused(r); setupPlace.replaceChildren(why); say(words); return; }
    setup.hidden = true; list.hidden = true;
    setupPlace.replaceChildren(formSetupWizard({ forms: r.body.forms, connectUrl: me.connectUrl, call, say, busy,
      onSaved: updated => { const old = list.querySelector(`[data-form-card="${updated.key}"]`); old?.replaceWith(formCard(updated, r.body.connect, me.connectUrl)); },
      onClose: key => { setupPlace.replaceChildren(); list.hidden = false; setup.hidden = false; const card = key ? list.querySelector(`[data-form-card="${key}"]`) : null; const target = card?.querySelector("summary"); if (target) { target.parentElement.open = true; target.focus(); } else setup.focus(); }
    }));
  });
  /* Show only the forms carrying a failed or stuck delivery. The tick stands only while some
     form does, and a list drawn again with none left clears it, so the filter never hides the
     whole list behind a problem that has gone. */
  let onlyProblems = false;
  const problems = new Map();
  const problemsTick = el("input", { type: "checkbox" });
  const problemsWrap = el("div", { className: "staff-actions", hidden: true },
    el("label", {}, problemsTick, " ", t("staff.forms.problemsOnly")));
  problemsTick.addEventListener("change", () => {
    onlyProblems = problemsTick.checked;
    for (const card of list.querySelectorAll("[data-form-card]")) card.hidden = onlyProblems && !problems.get(card.dataset.formCard);
    say(t("staff.forms.problemsOnly"));
  });
  const off = el("p", { className: "staff-note", textContent: t("staff.delivery.off"), hidden: true });
  const retry = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.retry"), hidden: true });
  const retryProblem = el("div", { hidden: true });
  const again = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.tryAgain") });
  const work = me.connectUrl ? el("a", { href: `${me.connectUrl}/`, textContent: t("staff.answers.openConnect") }) : null;

  function draw(r) {
    problems.clear();
    for (const f of r.forms) problems.set(f.key, !!(f.delivery?.failed || f.delivery?.stuck));
    problemsWrap.hidden = !r.forms.some((f) => problems.get(f.key));
    if (problemsWrap.hidden) onlyProblems = false;
    problemsTick.checked = onlyProblems;
    list.replaceChildren(...r.forms.map((f) => { const card = formCard(f, r.connect, me.connectUrl); card.hidden = onlyProblems && !problems.get(f.key); return card; }));
    setup.hidden = !r.forms.some(f => f.settings && (f.canEdit || f.canSwitch));
    if (!r.forms.length) list.replaceChildren(el("li", { textContent: t("staff.forms.empty") }));
    off.hidden = r.connect;
    retry.hidden = !r.connect || !r.forms.some((f) => f.delivery.pending || f.delivery.failed || f.delivery.stuck);
    /* The overview hears what the forms are carrying: answers waiting, failed or stuck, or no Connect at all. */
    onData?.({ connect: !!r.connect, pending: r.forms.reduce((n, f) => n + (f.delivery?.pending || 0), 0), failed: r.forms.reduce((n, f) => n + (f.delivery?.failed || 0), 0), stuck: r.forms.reduce((n, f) => n + (f.delivery?.stuck || 0), 0) });
  }
  retry.addEventListener("click", async () => {
    if (isBusy(retry)) return;
    const done = busy(retry, t("staff.retrying"));
    const r = await call("/api/staff/outbox/retry", { method: "POST", body: {} }).catch(offline);
    done();
    if (!retry.isConnected) return;
    if (r.status !== 200) {
      const [box, words] = refused(r);
      if (isAgain(r) || r.status === 401) retry.hidden = true;
      retryProblem.replaceChildren(box);
      retryProblem.hidden = false;
      say(words);
      return;
    }
    retryProblem.hidden = true;
    draw(r.body);
    say(t("staff.retried", { sent: r.body.sent, failed: r.body.failed }));
  });

  /* The list, and Try again in its place when it fails to load. */
  async function load() {
    const had = document.activeElement === again;
    const done = busy(again, t("staff.tryAgain"));
    const r = await call("/api/staff/forms").catch(offline);
    done();
    if (!section.isConnected) return; // the page was left meanwhile
    if (r.status === 200) { draw(r.body); return; }
    const [box, words] = refused(r);
    if (r.status !== 401 && r.status !== 403) box.append(el("p", {}, again));
    list.replaceChildren(el("li", {}, box));
    if (had) again.focus();
    say(words);
  }
  again.addEventListener("click", () => { if (!isBusy(again)) load(); });

  const section = el("section", { className: "staff-part" }, el("h2", { id: "staff-forms-h", textContent: t("staff.forms.title") }),
    el("p", { textContent: t("staff.forms.how") }), me.readAgain ? readAgain() : null, off, el("div", { className: "staff-actions staff-setup-launch" }, setup), setupPlace, problemsWrap, list, retryProblem,
    el("div", { className: "staff-actions" }, retry, ...(work ? [work] : [])));
  section.setAttribute("aria-labelledby", "staff-forms-h");
  load();
  return section;
}

function readAgainSection() {
  const section = el("section", { className: "staff-part" }, el("h2", { id: "staff-forms-h", textContent: t("staff.forms.title") }), readAgain());
  section.setAttribute("aria-labelledby", "staff-forms-h");
  return section;
}

/* ---------- words ---------- */

/* When the pages were last drawn with new words, or why the last update did not reach them. */
const updateLine = (me) => (me.publishError ? t("staff.edit.updateFailed")
  : t("staff.edit.timing", { when: me.published ? when(me.published.at) : t("staff.edit.neverUpdated") }));

function editSection(me) {
  const line = el("p", { textContent: me.waiting ? t(me.waiting === 1 ? "staff.edit.waiting.one" : "staff.edit.waiting.other", { n: me.waiting }) : t("staff.edit.none") });
  const update = el("p", { textContent: updateLine(me) });
  const refresh = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.edit.refresh") });
  const problem = el("div", { hidden: true });
  const download = me.canPublish && !me.publishAgain && el("a", { className: "btn", href: "/api/staff/edits?download=1", download: "edits.json", textContent: t("staff.edit.download") });
  refresh.addEventListener("click", async () => {
    if (isBusy(refresh)) return;
    const done = busy(refresh, t("staff.edit.refreshing"));
    const r = await call("/api/staff/refresh", { method: "POST", body: {} }).catch(offline);
    done();
    if (!refresh.isConnected) return;
    if (r.status !== 200) {
      const [box, words] = r.status === 429 ? [noteBox(t("staff.edit.refreshSoon")), t("staff.edit.refreshSoon")] : refused(r);
      problem.replaceChildren(box);
      problem.hidden = false;
      say(words);
      return;
    }
    problem.hidden = true;
    update.textContent = updateLine(r.body);
    say(r.body.publishError || r.body.purgeError ? t("staff.edit.updateFailed") : t("staff.edit.refreshed"));
  });
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-edit-h", textContent: t("staff.edit.title") }),
    me.canEdit && el("p", { textContent: t("staff.edit.how") }),
    /* Refresh Now stands with the waiting line it answers, not a line below it. */
    el("div", { className: "staff-actions" }, line, refresh),
    update,
    problem,
    me.publishAgain && publishAgain(),
    download && el("p", {}, download),
    download && el("p", { className: "staff-note", textContent: t("staff.edit.publish") }));
  section.setAttribute("aria-labelledby", "staff-edit-h");
  return section;
}

/* ---------- pages ---------- */

/* Set by the versions part: a change saved in the pages part lists its new version there too. */
let published = () => {};
/* Set by the pages part: a change saved elsewhere (a room) draws the pages list again, so its version is the newest. */
let pagesChanged = () => {};

/* Each change names the version of the pages it started from; a refusal keeps what was typed and says why. */
const PAGE_ERRORS = { "page.path": "path", "page.path.reserved": "reserved", "page.path.taken": "taken", "page.title": "title",
  "page.description": "description", "page.fixed": "fixed", "page.retireTo": "retireTo", "menu.entry": "menu", "menu.group": "menu",
  "settings.name": "siteName", "settings.description": "description", "settings.email": "email", "settings.safetyExitUrl": "safetyExit", "settings.mood": "mood", "settings.craftPhotoCount": "craftCount", "settings.craftLayout": "craftLayout" };
const STATE_CHIP = { live: "is-open", draft: "is-closed", retired: "is-closed" };
let fieldCount = 0;
/* A labelled field; `help`, when given, goes between the label and the control and is read with the control. */
function field(label, input, help = null) {
  input.id = `staff-field-${++fieldCount}`;
  const note = help && el("div", { className: "field-help", id: `${input.id}-help` }, el("p", { textContent: help }));
  if (note) input.setAttribute("aria-describedby", note.id);
  return el("div", { className: "field" }, el("label", { htmlFor: input.id, textContent: label }), note, input);
}
const textInput = (value = "", extra = {}) => el("input", { type: "text", value, autocomplete: "off", ...extra });
function choice(options, value) {
  const s = el("select", {}, ...options.map(([v, words]) => el("option", { value: v, textContent: words })));
  s.value = value;
  return s;
}

/* The page as it will look once on the site, in a frame at desktop or phone width, scaled to fit. */
function previewBox() {
  const frame = el("iframe", { title: t("staff.pages.previewFrame") });
  const holder = el("div", { className: "staff-preview-frame" }, frame);
  const label = el("p");
  const open = el("a", { className: "btn btn--quiet", target: "_blank", rel: "noopener", textContent: t("staff.pages.previewOpen") });
  const sizes = [["desktop", 1280, 860], ["phone", 390, 760]];
  let size = sizes[0];
  const fit = () => {
    const [, w, h] = size;
    const k = Math.min(1, holder.clientWidth / w || 1);
    Object.assign(frame.style, { width: `${w}px`, height: `${h}px`, transform: `scale(${k})` });
    holder.style.height = `${Math.round(h * k)}px`;
  };
  const buttons = sizes.map(([key], i) => {
    const b = el("button", { type: "button", className: "btn btn--quiet", textContent: t(`staff.pages.preview.${key}`) });
    b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", () => { size = sizes[i]; buttons.forEach((x, j) => x.setAttribute("aria-pressed", String(j === i))); fit(); });
    return b;
  });
  addEventListener("resize", fit);
  const box = el("div", { className: "staff-preview", hidden: true }, label, el("div", { className: "staff-actions" }, ...buttons, open), holder);
  return { box, show(p) { label.textContent = t("staff.pages.previewOf", { title: p.title }); frame.src = open.href = `/api/staff/preview/${p.id}`; box.hidden = false; fit(); box.scrollIntoView({ block: "nearest" }); } };
}

/* One page's sections: move them with the arrows and save the order; copy, retire, put back and add each save at
   once. Every change names the version of the pages it started from, as the pages part does. */
const SECTION_ERRORS = { "section.head": "head", "section.kind": "kind", "section.linked": "linked", "section.words": "words", "section.title": "title" };
function sectionsBox(me, changed) {
  const heading = el("h3", { id: "staff-sections-h", tabIndex: -1 });
  const pageBar = el("div", { className: "staff-actions" });
  const pageSlot = el("div");
  const problem = el("div", { hidden: true });
  const list = el("ol", { className: "staff-menu staff-sections" });
  const save = el("button", { type: "button", className: "btn", textContent: t("staff.sections.save") });
  const confirm = el("div", { className: "staff-drawer", hidden: true });
  const retired = el("div");
  const addWrap = el("div");
  const box = el("div", { className: "staff-form staff-sections-box", hidden: true }, heading, pageBar, pageSlot, problem, list, el("div", { className: "staff-actions" }, save), confirm, retired, addWrap);
  box.setAttribute("role", "region");
  box.setAttribute("aria-labelledby", "staff-sections-h");
  let page = null, now = null, order = [];
  const named = (x) => x.name || t(`staff.sections.kind.${x.type}`);
  const show = (words) => { problem.replaceChildren(noteBox(words)); problem.hidden = false; say(words); };

  async function load(focus) {
    const r = await call(`/api/staff/sections/${page.id}`).catch(offline);
    if (!box.isConnected) return;
    if (r.status !== 200) { const [b] = refused(r); list.replaceChildren(el("li", {}, b)); return; }
    now = r.body;
    order = [...now.sections];
    draw(focus);
  }
  async function send(button, change, done, focus) {
    if (isBusy(button)) return false;
    const undo = busy(button, t("staff.pages.saving"));
    const r = await call("/api/staff/pages", { method: "POST", body: { ...change, page: page.id, expected: now.version } }).catch(offline);
    undo();
    if (!box.isConnected) return false;
    if (r.status !== 200) {
      if (r.status === 409) { show(t("staff.pages.conflict")); await load(); return false; }
      if (r.status === 422 || r.status === 400 || r.status === 404) { show(t(`staff.sections.error.${SECTION_ERRORS[r.body.error] || "changed"}`)); return false; }
      const [b, words] = r.status === 0 ? [noteBox(t("staff.pages.error.failed")), t("staff.pages.error.failed")] : refused(r);
      problem.replaceChildren(b); problem.hidden = false; say(words);
      return false;
    }
    problem.hidden = true;
    confirm.hidden = true;
    say(r.body.publishError ? t("staff.edit.updateFailed") : done);
    published();
    changed();
    await load(focus);
    return true;
  }
  const iconButton = (words, label, onclick, extra = {}) => {
    const b = el("button", { type: "button", className: "btn btn--quiet", textContent: words, onclick, ...extra });
    b.setAttribute("aria-label", label);
    return b;
  };
  const mayRetire = () => (page.state === "draft" ? me.canEdit : me.canPublish);
  function row(x, i) {
    const fixedAt = (j) => !order[j] || order[j].head;
    const move = (by) => { const j = i + by; [order[i], order[j]] = [order[j], order[i]]; draw(`${x.id}:${by}`); };
    const arrow = (by, sign) => {
      const b = iconButton(sign, t(by < 0 ? "staff.sections.up" : "staff.sections.down", { name: named(x) }), () => move(by), { disabled: x.head || fixedAt(i + by) });
      b.dataset.key = `${x.id}:${by}`;
      return b;
    };
    const label = el("span", {}, named(x), el("span", { className: "staff-kind", textContent: ` · ${t(`staff.sections.kind.${x.type}`)}` }));
    if (x.head) return el("li", {}, label);
    return el("li", {}, label,
      arrow(-1, "↑"), arrow(1, "↓"),
      x.copy && iconButton(t("staff.sections.copy"), t("staff.sections.copyName", { name: named(x) }), (e) => send(e.currentTarget, { action: "sectionCopy", section: x.id }, t("staff.sections.done.copy"))),
      mayRetire() && iconButton(t("staff.sections.retire"), t("staff.sections.retireName", { name: named(x) }), () => {
        const yes = el("button", { type: "button", className: "btn", textContent: t("staff.pages.retire.yes") });
        yes.addEventListener("click", () => send(yes, { action: "sectionRetire", section: x.id }, t("staff.sections.done.retire")));
        confirm.replaceChildren(el("p", { textContent: t("staff.sections.retire.confirm", { name: named(x) }) }),
          el("div", { className: "staff-actions" }, yes, el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.pages.cancel"), onclick: () => { confirm.hidden = true; } })));
        confirm.hidden = false;
        yes.focus();
      }));
  }
  function addForm() {
    const title = textInput(), words = el("textarea", { rows: 4 });
    const after = choice(now.sections.map((x) => [x.id, named(x)]).filter((_, i) => i >= now.sections.reduce((n, x, k) => (x.head ? k : n), 0)), now.sections.at(-1)?.id || "");
    const go = el("button", { type: "submit", className: "btn", textContent: t("staff.sections.add.button") });
    const f = el("form", { className: "staff-add" }, el("h4", { textContent: t("staff.sections.add.title") }),
      field(t("staff.sections.field.title"), title), field(t("staff.sections.field.words"), words), field(t("staff.sections.field.after"), after), el("div", { className: "staff-actions" }, go));
    f.addEventListener("submit", async (e) => { e.preventDefault(); await send(go, { action: "sectionAdd", title: title.value, words: words.value, after: after.value }, t("staff.sections.done.add")); });
    return f;
  }
  function draw(focus) {
    heading.textContent = t("staff.sections.title", { title: page.title });
    list.replaceChildren(...order.map(row));
    const moved = order.some((x, i) => x.id !== now.sections[i].id);
    save.disabled = !moved;
    retired.replaceChildren(...(now.retired.length ? [el("h4", { textContent: t("staff.sections.retired") }),
      el("ul", { className: "staff-menu" }, ...now.retired.map((x) => el("li", {}, el("span", { textContent: named(x) }),
        iconButton(t("staff.sections.back"), t("staff.sections.backName", { name: named(x) }), (e) => send(e.currentTarget, { action: "sectionBack", section: x.id }, t("staff.sections.done.back"))))))] : []));
    addWrap.replaceChildren(...(me.canEdit ? [addForm()] : []));
    if (!focus) return;
    const [id, by] = focus.split(":");
    const b = [`${id}:${by}`, `${id}:${-by}`].map((k) => list.querySelector(`[data-key="${k}"]`)).find((x) => x && !x.disabled);
    (b || save).focus();
  }
  save.addEventListener("click", () => send(save, { action: "sectionOrder", order: order.map((x) => x.id) }, t("staff.sections.done.order")));
  return {
    box,
    attach(nodes, drawer) { pageBar.replaceChildren(...nodes); pageSlot.replaceChildren(drawer); },
    async show(p) {
      page = p;
      problem.hidden = true;
      confirm.hidden = true;
      box.hidden = false;
      heading.textContent = t("staff.sections.title", { title: p.title });
      list.replaceChildren(el("li", { textContent: t("staff.pages.loading") }));
      box.scrollIntoView({ block: "nearest" });
      heading.focus();
      await load();
    },
  };
}

function pagesSection(me, onData) {
  const body = el("div", {}, el("p", { textContent: t("staff.pages.loading") }));
  const problem = el("div", { hidden: true });
  const preview = previewBox();
  const sections = sectionsBox(me, () => load());
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-pages-h", textContent: t("staff.pages.title") }),
    el("p", { textContent: t("staff.pages.how") }), problem, body, sections.box, preview.box);
  section.setAttribute("aria-labelledby", "staff-pages-h");
  let now = null;

  /* `where`: the box a refusal is shown in, the part's own or the one at the top of the pages. */
  const show = (box, words, where = problem) => { where.replaceChildren(box); where.hidden = false; say(words); };
  function failed(r, where) {
    if (r.status === 409) return show(noteBox(t("staff.pages.conflict")), t("staff.pages.conflict"), where);
    if (r.status === 422 || r.status === 400) { const w = t(`staff.pages.error.${PAGE_ERRORS[r.body.error] || "failed"}`); return show(noteBox(w), w, where); }
    const [box, words] = r.status === 0 ? [noteBox(t("staff.pages.error.failed")), t("staff.pages.error.failed")] : refused(r);
    return show(box, words, where);
  }
  async function load() {
    const r = await call("/api/staff/pages").catch(offline);
    if (!section.isConnected) return;
    if (r.status !== 200) { const [box] = refused(r); body.replaceChildren(box); return; }
    now = r.body;
    draw();
  }
  /* Send one change; on success the list is drawn again from the server. Returns whether it saved. */
  async function send(button, change, done) {
    if (isBusy(button)) return false;
    const undo = busy(button, t("staff.pages.saving"));
    const r = await call("/api/staff/pages", { method: "POST", body: { ...change, expected: now.version } }).catch(offline);
    undo();
    if (!section.isConnected) return false;
    if (r.status !== 200) { failed(r); if (r.status === 409) await load(); return false; }
    problem.hidden = true;
    say(r.body.publishError ? t("staff.edit.updateFailed") : done);
    published();
    await load();
    return true;
  }

  const addTitle = textInput();
  const addPath = textInput("/", { spellcheck: false });
  const addButton = el("button", { type: "submit", className: "btn", textContent: t("staff.pages.add.button") });
  const addForm = el("form", { className: "staff-form staff-add" }, el("h3", { textContent: t("staff.pages.add.title") }),
    field(t("staff.pages.field.title"), addTitle), field(t("staff.pages.field.path"), addPath), el("div", { className: "staff-actions" }, addButton));
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await send(addButton, { action: "add", title: addTitle.value, path: addPath.value }, t("staff.pages.done.add"))) { addTitle.value = ""; addPath.value = "/"; }
  });

  function card(p) {
    const drawer = el("div", { className: "staff-drawer", hidden: true });
    const open = (...kids) => { drawer.replaceChildren(...kids); drawer.hidden = false; drawer.querySelector("input, select, button")?.focus(); };
    const cancel = () => el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.pages.cancel"), onclick: () => { drawer.hidden = true; } });
    const form = (fields, words, make, done) => {
      const go = el("button", { type: "submit", className: "btn", textContent: words });
      const f = el("form", {}, ...fields, el("div", { className: "staff-actions" }, go, cancel()));
      f.addEventListener("submit", (e) => { e.preventDefault(); send(go, make(), done); });
      return f;
    };
    const live = now.pages.filter((x) => x.state === "live" && x.id !== p.id);
    const groups = [["", t("staff.pages.menu.top")], ...now.menu.filter((x) => x.children).map((x) => [x.id, x.label])];
    const actions = [];
    const side = [];
    const button = (words, onclick) => actions.push(el("button", { type: "button", className: "btn btn--quiet", textContent: words, onclick }));
    const sideButton = (words, onclick) => side.push(el("button", { type: "button", className: "btn btn--quiet", textContent: words, onclick }));
    if (p.state !== "retired") button(t("staff.pages.preview"), () => preview.show(p));
    if (p.state !== "retired" && p.sections && me.canEdit) button(t("staff.sections.open"), () => { sections.show(p); sections.attach(side, drawer); });
    if (!p.fixed && me.canEdit) sideButton(t("staff.pages.copy"), () => {
      const title = textInput(p.title), where = textInput(p.path, { spellcheck: false });
      open(form([field(t("staff.pages.field.title"), title), field(t("staff.pages.field.path"), where)], t("staff.pages.copy.button"),
        () => ({ action: "copy", page: p.id, title: title.value, path: where.value }), t("staff.pages.done.copy")));
    });
    if (!p.fixed && p.state !== "retired" && me.canEdit) sideButton(t("staff.pages.details"), () => {
      const title = textInput(p.title), about = el("textarea", { value: p.description, rows: 3 });
      const mayMove = p.state === "draft" || me.canPublish;
      const where = textInput(p.path, { spellcheck: false, disabled: !mayMove });
      open(form([field(t("staff.pages.field.title"), title), field(t("staff.pages.field.description"), about), field(t("staff.pages.field.path"), where),
        !mayMove && el("p", { className: "staff-note", textContent: t("staff.pages.details.liveAddress") })].filter(Boolean), t("staff.pages.details.button"),
      () => ({ action: "details", page: p.id, title: title.value, description: about.value, ...(mayMove && where.value !== p.path ? { path: where.value } : {}) }), t("staff.pages.done.details")));
    });
    if (p.state === "draft" && me.canPublish) sideButton(t("staff.pages.publish"), () => {
      const group = choice([["-", t("staff.pages.menu.none")], ...groups], "-"), name = textInput(p.title);
      open(form([field(t("staff.pages.field.group"), group), field(t("staff.pages.field.label"), name)], t("staff.pages.publish.button"),
        () => ({ action: "publish", page: p.id, ...(group.value === "-" ? {} : { group: group.value, label: name.value }) }), t("staff.pages.done.publish")));
    });
    if (!p.fixed && (p.state === "draft" ? me.canEdit : p.state === "live" && me.canPublish)) sideButton(p.state === "draft" ? t("staff.pages.discard") : t("staff.pages.retire"), () => {
      const to = choice([["", t("staff.pages.retire.nowhere")], ...live.map((x) => [x.id, `${x.title} (${x.path})`])], "");
      open(form([el("p", { textContent: t("staff.pages.retire.confirm", { title: p.title }) }), p.state === "live" && field(t("staff.pages.field.to"), to)].filter(Boolean),
        t("staff.pages.retire.yes"), () => ({ action: "retire", page: p.id, ...(p.state === "live" && to.value ? { to: to.value } : {}) }), t("staff.pages.done.retire")));
    });
    /* A retired page goes back to where it was retired from (the list's `back`): on the site, a publisher's; as a draft, an
       editor's. Nothing else changes, unlike bringing back an earlier version. */
    if (p.state === "retired" && !p.fixed && (p.back === "draft" ? me.canEdit : me.canPublish)) sideButton(t("staff.pages.putBack"), () => {
      const ask = t(p.back === "draft" ? "staff.pages.putBack.confirmDraft" : "staff.pages.putBack.confirm", { title: p.title });
      open(form([el("p", { textContent: ask })], t("staff.pages.putBack.yes"), () => ({ action: "putBack", page: p.id }), t("staff.pages.done.putBack")));
    });
    return el("li", { className: "staff-form" },
      el("h3", {}, p.title, el("span", { className: `staff-chip ${STATE_CHIP[p.state]}`, textContent: t(`staff.pages.state.${p.state}`) })),
      el("p", { textContent: p.path }), actions.length && el("div", { className: "staff-actions" }, ...actions), drawer);
  }

  /* The menu, reordered here and saved once. Up and Down move an entry within its level; an entry taken off is listed
     under Off the Menu, and Put Back returns it to the end of its own group (the top, when that group is off too). */
  function menuPart() {
    let order = now.menu.map((x) => ({ ...x, children: x.children ? [...x.children] : undefined }));
    let offEntries = (now.offMenu || []).map((x) => ({ ...x, children: x.children ? [...x.children] : undefined }));
    const list = el("ol", { className: "staff-menu" });
    const offList = el("div");
    const save = el("button", { type: "button", className: "btn", textContent: t("staff.pages.menu.save") });
    const move = (arr, i, by) => { const j = i + by; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; drawList(`${arr[j].id}:${by}`); };
    const arrow = (x, by, sign, off, onclick) => {
      const b = el("button", { type: "button", className: "btn btn--quiet", textContent: sign, disabled: off, onclick });
      b.setAttribute("aria-label", t(by < 0 ? "staff.pages.menu.up" : "staff.pages.menu.down", { label: x.label }));
      b.dataset.key = `${x.id}:${by}`;
      return b;
    };
    const takeOff = (x, onclick) => {
      const b = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.pages.menu.takeOff"), onclick });
      b.setAttribute("aria-label", t("staff.pages.menu.remove", { label: x.label }));
      return b;
    };
    const row = (arr, i, x, group = "") => el("li", {}, el("span", { textContent: x.label }),
      arrow(x, -1, "↑", i === 0, () => move(arr, i, -1)),
      arrow(x, 1, "↓", i === arr.length - 1, () => move(arr, i, 1)),
      takeOff(x, () => { arr.splice(i, 1); offEntries.push({ ...x, group }); drawList(null); }),
      x.children && el("ol", {}, ...x.children.map((c, k) => row(x.children, k, c, x.id))));
    const putBack = (x) => {
      offEntries = offEntries.filter((y) => y !== x);
      const { group, ...entry } = x;
      const home = group && order.find((y) => y.id === group && y.children);
      (home ? home.children : order).push(entry);
      drawList(`${x.id}:-1`);
    };
    const offRow = (x) => {
      const b = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.pages.menu.back"), onclick: () => putBack(x) });
      b.setAttribute("aria-label", t("staff.pages.menu.backName", { label: x.label }));
      const words = x.children ? t("staff.pages.menu.offGroup", { label: x.label, entries: x.children.map((c) => c.label).join(", ") }) : x.label;
      return el("li", {}, el("span", { textContent: words }), b);
    };
    function drawList(focus) {
      list.replaceChildren(...order.map((x, i) => row(order, i, x)));
      offList.replaceChildren(...(offEntries.length ? [el("h4", { textContent: t("staff.pages.menu.off") }), el("ul", { className: "staff-menu" }, ...offEntries.map(offRow))] : []));
      if (focus === undefined) return;
      const b = focus && list.querySelector(`[data-key="${focus}"]`);
      (b && !b.disabled ? b : save).focus();
    }
    drawList();
    save.addEventListener("click", () => send(save, { action: "menu", menu: order.map((x) => ({ id: x.id, ...(x.children ? { children: x.children.map((c) => c.id) } : {}) })) }, t("staff.pages.done.menu")));
    const part = el("div", { className: "staff-form" }, el("h3", { textContent: t("staff.pages.menu.title") }), el("p", { textContent: t("staff.pages.menu.how") }), list, el("div", { className: "staff-actions" }, save), offList);
    return part;
  }

  /* Drafts first, then the pages on the site by address, then retired pages made here. */
  const RANK = { draft: 0, live: 1, retired: 2 };
  function draw() {
    const shown = now.pages.filter((p) => p.state !== "retired" || p.made)
      .sort((a, b) => RANK[a.state] - RANK[b.state] || a.path.localeCompare(b.path));
    body.replaceChildren(...[me.canEdit && addForm, el("ul", { className: "staff-forms" }, ...shown.map(card)), me.canPublish && menuPart()].filter(Boolean));
    /* The overview hears how many pages are still drafts. */
    onData?.({ drafts: now.pages.filter((p) => p.state === "draft").length });
  }
  pagesChanged = () => { if (section.isConnected) load(); };
  load();
  return section;
}

/* ---------- settings ---------- */

function settingsSection(me) {
  const body = el("div", {}, el("p", { textContent: t("staff.pages.loading") }));
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-settings-h", textContent: t("staff.settings.title") }), body);
  section.setAttribute("aria-labelledby", "staff-settings-h");
  let now = null;

  /* `where`: the box a refusal is shown in. */
  const show = (box, words, where) => { where.replaceChildren(box); where.hidden = false; say(words); };
  function failed(r, where) {
    if (r.status === 409) return show(noteBox(t("staff.pages.conflict")), t("staff.pages.conflict"), where);
    if (r.status === 422 || r.status === 400) { const w = t(`staff.pages.error.${PAGE_ERRORS[r.body.error] || "failed"}`); return show(noteBox(w), w, where); }
    const [box, words] = r.status === 0 ? [noteBox(t("staff.pages.error.failed")), t("staff.pages.error.failed")] : refused(r);
    return show(box, words, where);
  }
  async function load() {
    const r = await call("/api/staff/pages").catch(offline);
    if (!section.isConnected) return;
    if (r.status !== 200) { const [box] = refused(r); body.replaceChildren(box); return; }
    now = r.body;
    syncSettings();
    draw();
  }
  function draw() {
    body.replaceChildren(settingsPart(), moodPart());
  }

  /* The site's settings, a publisher's: its name, search description, accessibility email, Safety Exit
     destination and the Craft Nights gallery's photo count and layout, saved together as one change. The
     fields are made once, so what was typed stays through a refusal and through the list being drawn again;
     they take the saved values only when first drawn and after a save that lands. The part keeps its own version token
     and the values that token stands for (`seen`): a stale save is refused with the settings saved since (structure.mjs),
     each shown under its field when it differs from what the fields started with, and only then does the token move to
     theirs, so Save Settings again replaces them knowingly. A refusal with nothing new to show (settings already seen,
     or back to what the fields started with: another part's change) is sent again once with the new token. A list drawn
     again moves the token only when its settings are the ones already seen. The settings live with the
     pages in the server's answer, so this part in its own view reads that answer for itself, and after a save
     tells the pages part to draw again: a save here moves the version the pages part's changes name. */
  const settingsProblem = el("div", { hidden: true });
  const siteName = textInput();
  const siteDescription = el("textarea", { rows: 4 });
  const siteEmail = el("input", { type: "email", autocomplete: "off", spellcheck: false });
  const siteSafetyExit = el("input", { type: "url", autocomplete: "off", spellcheck: false });
  const siteCraftCount = el("input", { type: "number", min: 1, max: 12, step: 1, autocomplete: "off" });
  const siteCraftLayout = choice([["row", t("staff.settings.layout.row")], ["grid", t("staff.settings.layout.grid")]], "row");
  const SETTINGS = [["name", siteName], ["description", siteDescription], ["accessibilityEmail", siteEmail],
    ["safetyExitUrl", siteSafetyExit], ["craftPhotoCount", siteCraftCount], ["craftLayout", siteCraftLayout]];
  const settingsSave = el("button", { type: "submit", className: "btn", textContent: t("staff.settings.save") });
  const settingsFields = {
    name: field(t("staff.settings.field.name"), siteName, t("staff.settings.help.name")),
    description: field(t("staff.settings.field.description"), siteDescription, t("staff.settings.help.description")),
    accessibilityEmail: field(t("staff.settings.field.email"), siteEmail, t("staff.settings.help.email")),
    safetyExitUrl: field(t("staff.settings.field.safetyExit"), siteSafetyExit, t("staff.settings.help.safetyExit")),
    craftPhotoCount: field(t("staff.settings.field.craftCount"), siteCraftCount, t("staff.settings.help.craftCount")),
    craftLayout: field(t("staff.settings.field.craftLayout"), siteCraftLayout, t("staff.settings.help.craftLayout")),
  };
  const sinceLines = Object.fromEntries(SETTINGS.map(([k, input]) => {
    const line = el("p", { className: "staff-since", id: `${input.id}-since`, hidden: true });
    settingsFields[k].append(line);
    return [k, line];
  }));
  const settingsForm = el("form", { className: "staff-form staff-settings", noValidate: true },
    settingsProblem, ...Object.values(settingsFields),
    el("div", { className: "staff-actions" }, settingsSave));
  /* The gallery's two values read as the words the form holds: the count the site's default (six) when
     none is saved, the layout "row" when none is saved — the defaults structure.mjs draws with. */
  const valuesOf = (site) => ({ name: site?.name || "", description: site?.description || "", accessibilityEmail: site?.accessibilityEmail || "", safetyExitUrl: site?.safetyExitUrl || "", craftPhotoCount: site?.craftPhotoCount == null ? "6" : String(site.craftPhotoCount), craftLayout: site?.craftLayout || "row" });
  const sameValues = (a, b) => SETTINGS.every(([k]) => a[k] === b[k]);
  let started = null, seen = null;
  /* The line under a field: the value saved since, or none (null). Read with the field while it shows. */
  function showSince(k, value) {
    const [, input] = SETTINGS.find(([x]) => x === k);
    const line = sinceLines[k];
    line.hidden = value === null;
    line.textContent = value === null ? "" : t("staff.settings.since", { value: value === "" ? t("staff.settings.none") : value });
    const ids = (input.getAttribute("aria-describedby") || "").split(" ").filter((x) => x && x !== line.id);
    input.setAttribute("aria-describedby", [...ids, ...(value === null ? [] : [line.id])].join(" "));
  }
  const fillSettings = () => {
    started = valuesOf(now.site);
    seen = { version: now.version, values: started };
    for (const [k, input] of SETTINGS) { input.value = started[k]; showSince(k, null); }
  };
  function syncSettings() {
    if (seen && sameValues(valuesOf(now.site), seen.values)) seen = { ...seen, version: now.version };
  }
  async function saveSettings(again = true) {
    if (isBusy(settingsSave)) return;
    const settings = Object.fromEntries(SETTINGS.map(([k, input]) => [k, input.value]));
    const undo = busy(settingsSave, t("staff.pages.saving"));
    const r = await call("/api/staff/pages", { method: "POST", body: { action: "settings", settings, expected: seen.version } }).catch(offline);
    undo();
    if (!section.isConnected) return;
    if (r.status === 409 && r.body.site && r.body.current) {
      const theirs = valuesOf(r.body.site);
      const known = sameValues(theirs, seen.values);
      seen = { version: r.body.current, values: theirs };
      for (const [k] of SETTINGS) showSince(k, theirs[k] === started[k] ? null : theirs[k]);
      const differs = SETTINGS.some(([k]) => theirs[k] !== started[k]);
      if (known || !differs) {
        if (again) return saveSettings(false);
        show(noteBox(t("staff.pages.error.failed")), t("staff.pages.error.failed"), settingsProblem);
      } else show(noteBox(t("staff.settings.conflict")), t("staff.settings.conflict"), settingsProblem);
      await load();
      pagesChanged();
      return;
    }
    if (r.status !== 200) { failed(r, settingsProblem); return; }
    settingsProblem.hidden = true;
    say(r.body.publishError ? t("staff.edit.updateFailed") : t("staff.settings.done"));
    published();
    pagesChanged();
    await load();
    fillSettings();
  }
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveSettings();
    // The list is drawn again after a save or a stale tab, which moves the form: focus goes back to its button.
    if (settingsForm.isConnected && (!document.activeElement || document.activeElement === document.body)) settingsSave.focus();
  });
  function settingsPart() {
    if (!started) fillSettings();
    return settingsForm;
  }

  /* The feeling check-in's set, a publisher's, saved as one settings change like the settings above:
     each feeling's emoji, word, colour and reply lines, in the order they show. The rows are filled
     from what the server says the check-in shows now (now.moodCheckin: the build's set with any saved
     one laid over it). A feeling keeps the id it was filled with — the day's counts are kept under it,
     so renaming the word keeps them — and a feeling added here is given an id from its word when the
     set is collected. The rows are filled again whenever the part is drawn and what they hold is what
     they were filled with, so a set saved elsewhere is picked up; rows a publisher is part-way
     through changing are left alone. */
  const moodRowsBox = el("div", { className: "staff-mood-rows" });
  const moodAdd = el("button", { type: "button", className: "btn", textContent: t("staff.mood.add") });
  const moodSave = el("button", { type: "submit", className: "btn", textContent: t("staff.mood.save") });
  const moodProblem = el("div", { hidden: true });
  const moodForm = el("form", { className: "staff-form staff-mood", noValidate: true },
    el("h3", { textContent: t("staff.mood.title") }), el("p", { textContent: t("staff.mood.help") }), moodProblem,
    moodRowsBox, el("div", { className: "staff-actions" }, moodAdd, moodSave));
  let moodFilled = null;
  function moodRow(m = {}) {
    const emoji = textInput(m.emoji || "");
    const label = textInput(m.label || "");
    const color = el("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(m.color || "") ? m.color : "#b60000" });
    const messages = el("textarea", { rows: 3 });
    messages.value = (m.messages || []).join("\n");
    const remove = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.mood.remove") });
    const row = el("div", { className: "staff-mood-row" },
      field(t("staff.mood.field.emoji"), emoji), field(t("staff.mood.field.label"), label),
      field(t("staff.mood.field.color"), color), field(t("staff.mood.field.messages"), messages),
      el("div", { className: "staff-mood-remove" }, remove));
    row.dataset.id = m.id || "";
    row.mood = { emoji, label, color, messages, remove };
    remove.addEventListener("click", () => { row.remove(); moodSync(); });
    return row;
  }
  const moodSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "feeling";
  function collectMood() {
    const used = new Set();
    return [...moodRowsBox.children].map((row) => {
      const f = row.mood;
      let id = row.dataset.id || moodSlug(f.label.value);
      const base = id; let n = 2;
      while (used.has(id)) id = `${base}_${n++}`;
      used.add(id);
      return { id, emoji: f.emoji.value.trim(), label: f.label.value.trim(), color: f.color.value,
        messages: f.messages.value.split("\n").map((x) => x.trim()).filter(Boolean) };
    });
  }
  function moodSync() {
    moodAdd.disabled = moodRowsBox.children.length >= 8;
    for (const row of moodRowsBox.children) row.mood.remove.disabled = moodRowsBox.children.length <= 1;
  }
  function fillMood() {
    moodRowsBox.replaceChildren(...(now.moodCheckin?.moods || []).map(moodRow));
    moodSync();
    moodFilled = JSON.stringify(collectMood());
  }
  function moodPart() {
    if (moodFilled === null || JSON.stringify(collectMood()) === moodFilled) fillMood();
    return moodForm;
  }
  moodAdd.addEventListener("click", () => {
    const row = moodRow();
    moodRowsBox.append(row);
    moodSync();
    row.mood.emoji.focus();
  });
  moodForm.addEventListener("submit", async (e) => {
    e.preventDefault();
  /* The check-in's save, on the settings endpoint with this view's version token, as the settings
     form's save works: a refusal shows in the form's own box, a stale token reloads the view, and a
     save that lands announces itself and moves the pages part's version too. */
  async function sendMood() {
    if (isBusy(moodSave)) return false;
    const undo = busy(moodSave, t("staff.pages.saving"));
    const r = await call("/api/staff/pages", { method: "POST", body: { action: "settings", settings: { moodCheckin: { moods: collectMood() } }, expected: seen.version } }).catch(offline);
    undo();
    if (!section.isConnected) return false;
    if (r.status !== 200) { failed(r, moodProblem); if (r.status === 409) await load(); return false; }
    moodProblem.hidden = true;
    say(r.body.publishError ? t("staff.edit.updateFailed") : t("staff.mood.done"));
    published();
    pagesChanged();
    await load();
    return true;
  }
    if (await sendMood()) fillMood();
    // The list is drawn again after a save, which moves the form: focus goes back to its button.
    if (moodForm.isConnected && (!document.activeElement || document.activeElement === document.body)) moodSave.focus();
  });

  load();
  return section;
}

/* ---------- rooms ---------- */

/* Rooms, a publisher's: each room's words and its steps' words and photos, one room open at a time and saved as one
   change. The open room's form is made once, so what was typed stays through a refusal and through the list being
   drawn again. It keeps its own version token and the values the token stands for (`seen`), as Site Settings does: a
   stale save is refused with the room as saved since, shown under each field that differs from what the form started
   with, and only then does the token move, so Save Room again replaces them knowingly. A refusal with nothing new to
   show (another change) is sent again once with the new token. Only the fields that differ from the room as last known
   saved are sent, so a room keeps the files' value for every field nobody changed. */
const ROOM_WORDS = ["name", "short", "building", "where", "address"];
const roomLabel = (k) => ({ name: t("staff.rooms.field.name"), short: t("staff.rooms.field.short"), building: t("staff.rooms.field.building"),
  where: t("staff.rooms.field.where"), address: t("staff.rooms.field.address"), note: t("staff.rooms.field.note"), steps: t("staff.rooms.field.steps") })[k];
const roomHelp = (k) => ({ name: t("staff.rooms.help.name"), short: t("staff.rooms.help.short"), address: t("staff.rooms.help.address") })[k] || null;
const ROOM_ERRORS = { "room.name": "name", "room.short": "short", "room.building": "building", "room.where": "where", "room.address": "address", "room.note": "note", "room.text": "steps" };
function roomsSection() {
  const body = el("div", {}, el("p", { textContent: t("staff.pages.loading") }));
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-rooms-h", textContent: t("staff.rooms.title") }), el("p", { textContent: t("staff.rooms.how") }), body);
  section.setAttribute("aria-labelledby", "staff-rooms-h");
  let list = null, open = null;

  /* The value a field shows for a room, and a value as the line under a field names it. */
  const valuesOf = (r) => ({ ...Object.fromEntries([...ROOM_WORDS, "note"].map((k) => [k, r[k] || ""])),
    steps: Object.fromEntries(r.steps.map((x) => [x.id, { text: x.text || "", photo: x.photo || null }])) });
  const photoName = (id) => (id === null ? t("staff.rooms.photo.none") : list.photos.find((p) => p.id === id)?.alt || id);
  const sinceWords = (v) => t("staff.settings.since", { value: v === "" ? t("staff.settings.none") : v });

  function roomForm(room) {
    const box = el("div", { hidden: true });
    const lines = new Map();
    /* The line under a control: what was saved since, or nothing (null). Read with the control while it shows. */
    const since = (key, control) => {
      const line = el("p", { className: "staff-since", id: `${control.id}-since`, hidden: true });
      lines.set(key, { line, control });
      return line;
    };
    const showSince = (key, words) => {
      const { line, control } = lines.get(key);
      line.hidden = words === null;
      line.textContent = words === null ? "" : sinceWords(words);
      const ids = (control.getAttribute("aria-describedby") || "").split(" ").filter((x) => x && x !== line.id);
      control.setAttribute("aria-describedby", [...ids, ...(words === null ? [] : [line.id])].join(" "));
    };
    const inputs = {};
    const fields = ROOM_WORDS.map((k) => {
      inputs[k] = textInput();
      const f = field(roomLabel(k), inputs[k], roomHelp(k));
      f.append(since(k, inputs[k]));
      return f;
    });
    const steps = room.steps.map((s, i) => {
      const legend = el("legend", { id: `staff-room-${room.id}-${s.id}-h`, textContent: t("staff.rooms.step", { n: i + 1 }) });
      const text = el("textarea", { rows: 4 });
      text.setAttribute("aria-labelledby", legend.id);
      text.id = `staff-room-${room.id}-${s.id}-text`;
      const photo = el("select", {}, el("option", { value: "", textContent: t("staff.rooms.photo.none") }),
        ...list.photos.map((p) => el("option", { value: p.id, textContent: p.alt.length > 90 ? `${p.alt.slice(0, 89)}…` : p.alt || p.id })));
      const thumb = el("img", { className: "staff-thumb", alt: "", width: 96, height: 72, hidden: true });
      const look = () => { const p = list.photos.find((x) => x.id === photo.value); thumb.hidden = !p; if (p) thumb.src = p.src; };
      photo.addEventListener("change", look);
      const photoField = field(t("staff.rooms.field.photo"), photo);
      photoField.append(thumb, since(`${s.id}/photo`, photo));
      inputs[`${s.id}/text`] = text;
      inputs[`${s.id}/photo`] = photo;
      return { look, el: el("fieldset", { className: "staff-step" }, legend, el("div", { className: "field" }, text, since(`${s.id}/text`, text)), photoField) };
    });
    inputs.note = el("textarea", { rows: 3 });
    const noteField = field(roomLabel("note"), inputs.note);
    noteField.append(since("note", inputs.note));
    const save = el("button", { type: "submit", className: "btn", textContent: t("staff.rooms.save") });
    const cancel = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.pages.cancel") });
    const form = el("form", { className: "staff-room", noValidate: true }, box, ...fields, ...steps.map((x) => x.el), noteField,
      el("div", { className: "staff-actions" }, save, cancel));

    const typed = () => ({ ...Object.fromEntries([...ROOM_WORDS, "note"].map((k) => [k, inputs[k].value])),
      steps: Object.fromEntries(room.steps.map((s) => [s.id, { text: inputs[`${s.id}/text`].value, photo: inputs[`${s.id}/photo`].value || null }])) });
    let started = null, seen = null;
    const fill = (r) => {
      started = valuesOf(r);
      seen = { version: list.version, values: started };
      for (const [k, input] of Object.entries(inputs)) {
        const [sid, part] = k.split("/");
        input.value = part ? (started.steps[sid][part] || "") : started[k];
        showSince(k, null);
      }
      steps.forEach((x) => x.look());
      box.hidden = true;
    };
    /* Only what differs from the room as last known saved: what the form opened with, or, after a stale tab, the values
       saved since, so a second Save Room puts every field the form shows over theirs. */
    const changed = () => {
      const now = typed();
      const base = seen.values;
      const out = {};
      for (const k of [...ROOM_WORDS, "note"]) if (now[k] !== base[k]) out[k] = now[k];
      for (const s of room.steps) {
        const a = now.steps[s.id], b = base.steps[s.id];
        const step = { ...(a.text !== b.text ? { text: a.text } : {}), ...(a.photo !== b.photo ? { photo: a.photo } : {}) };
        if (Object.keys(step).length) (out.steps ||= {})[s.id] = step;
      }
      return out;
    };
    const say2 = (words) => { box.replaceChildren(noteBox(words)); box.hidden = false; say(words); };
    const sameAs = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    async function send(again = true) {
      if (isBusy(save)) return;
      const fieldsNow = changed();
      if (!Object.keys(fieldsNow).length) return say2(t("staff.rooms.unchanged"));
      const undo = busy(save, t("staff.pages.saving"));
      const r = await call("/api/staff/pages", { method: "POST", body: { action: "room", room: room.id, fields: fieldsNow, expected: seen.version } }).catch(offline);
      undo();
      if (!section.isConnected) return;
      if (r.status === 409 && r.body.room && r.body.current) {
        const theirs = valuesOf(r.body.room);
        const known = sameAs(theirs, seen.values);
        seen = { version: r.body.current, values: theirs };
        let differs = false;
        for (const k of [...ROOM_WORDS, "note"]) { const d = theirs[k] !== started[k]; differs ||= d; showSince(k, d ? theirs[k] : null); }
        for (const s of room.steps) for (const part of ["text", "photo"]) {
          const d = theirs.steps[s.id][part] !== started.steps[s.id][part];
          differs ||= d;
          showSince(`${s.id}/${part}`, d ? (part === "photo" ? photoName(theirs.steps[s.id].photo) : theirs.steps[s.id].text) : null);
        }
        if ((known || !differs) && again) return send(false);
        say2(known || !differs ? t("staff.pages.error.failed") : t("staff.rooms.conflict"));
        await load();
        return;
      }
      if (r.status === 422 || r.status === 400) {
        const k = ROOM_ERRORS[r.body.error];
        return say2(k ? t("staff.rooms.error.words", { field: roomLabel(k), max: list.limits[k === "steps" ? "text" : k] })
          : r.body.error === "room.photo" ? t("staff.rooms.error.photo") : t("staff.pages.error.failed"));
      }
      if (r.status !== 200) { const [, words] = r.status === 0 ? [null, t("staff.pages.error.failed")] : refused(r); return say2(words); }
      say(r.body.publishError ? t("staff.edit.updateFailed") : t("staff.rooms.done"));
      published();
      pagesChanged();
      await load();
      const fresh = list.rooms.find((x) => x.id === room.id);
      if (fresh) fill(fresh);
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await send();
      // The list is drawn again after a save or a stale tab, which moves the form: focus goes back to its button.
      if (form.isConnected && (!document.activeElement || document.activeElement === document.body)) save.focus();
    });
    cancel.addEventListener("click", () => { const id = open.id; open = null; draw(); section.querySelector(`[data-room="${id}"]`)?.focus(); });
    fill(room);
    return { id: room.id, form, first: inputs.name, seen: () => seen, syncTo: (r) => { if (sameAs(valuesOf(r), seen.values)) seen = { ...seen, version: list.version }; } };
  }

  function draw() {
    const items = list.rooms.map((r) => {
      const change = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.rooms.open") });
      change.setAttribute("aria-label", t("staff.rooms.openName", { name: r.name }));
      change.dataset.room = r.id;
      change.setAttribute("aria-expanded", String(open?.id === r.id));
      change.addEventListener("click", () => {
        if (open?.id === r.id) return open.first.focus();
        open = roomForm(r);
        draw();
        open.first.focus();
      });
      return el("li", { className: "staff-form" }, el("h3", { textContent: r.name }), el("p", { textContent: [r.building, r.where].filter(Boolean).join(" · ") }),
        el("div", { className: "staff-actions" }, change), open?.id === r.id && open.form);
    });
    body.replaceChildren(el("ul", { className: "staff-forms" }, ...items));
  }
  async function load() {
    const r = await call("/api/staff/rooms").catch(offline);
    if (!section.isConnected) return;
    if (r.status !== 200) { const [box] = refused(r); body.replaceChildren(box); return; }
    list = r.body;
    const mine = open && list.rooms.find((x) => x.id === open.id);
    if (mine) open.syncTo(mine);
    draw();
  }
  load();
  return section;
}

/* ---------- hub events ---------- */

/* A refused event save, said in the event's own words: [the code, the field's label key, its limit]. */
const EVENT_WORD_ERRORS = { "event.description": ["staff.events.field.description", "description"],
  "event.label": ["staff.events.field.label", "label"], "event.lead": ["staff.events.field.lead", "lead"],
  "event.body": ["staff.events.field.body", "paragraph"], "event.details": ["staff.events.field.details", "detail"],
  "event.peopleTitle": ["staff.events.field.peopleTitle", "sectionTitle"], "event.directionsTitle": ["staff.events.field.directionsTitle", "directionsTitle"],
  "event.highlights": ["staff.events.field.highlightsTitle", "sectionTitle"], "event.programme": ["staff.events.field.programmeTitle", "sectionTitle"] };

/* The Hub Events part: every Student Mental Health Hub event and its own page, made and changed here.
   An event is saved whole, as one change that publishes, the way a room's words are; the form is
   built once per event, so what was typed stands through a refusal or a stale tab, and a second save
   then goes over what was saved since, knowingly. A new event's id and address are the server's to
   give (its title's words, under /initiatives/), unless an address is typed for it. */
function eventsSection() {
  const body = el("div", {}, el("p", { textContent: t("staff.pages.loading") }));
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-events-h", textContent: t("staff.events.title") }), el("p", { textContent: t("staff.events.how") }), body);
  section.setAttribute("aria-labelledby", "staff-events-h");
  let list = null, open = null;

  const lines = (ta) => ta.value.split("\n").map((x) => x.trim()).filter(Boolean);
  const photoOption = (p) => el("option", { value: p.id, textContent: p.alt.length > 90 ? `${p.alt.slice(0, 89)}…` : p.alt || p.id });
  /* A library photo choice with the photo itself beside it, as a room step's is. Returns [field, select]. */
  const photoField = (label, value) => {
    const select = el("select", {}, el("option", { value: "", textContent: t("staff.events.photo.none") }), ...list.photos.map(photoOption));
    select.value = value || "";
    const thumb = el("img", { className: "staff-thumb", alt: "", width: 96, height: 72, hidden: true });
    const look = () => { const p = list.photos.find((x) => x.id === select.value); thumb.hidden = !p; if (p) thumb.src = p.src; };
    select.addEventListener("change", look);
    look();
    const f = field(label, select);
    f.append(thumb);
    return [f, select];
  };
  const iconSelect = (value) => {
    const s = el("select", {}, el("option", { value: "", textContent: t("staff.events.icon.none") }),
      ...list.icons.map((n) => el("option", { value: n, textContent: n })));
    s.value = value || "";
    return s;
  };
  /* A repeatable set of rows (buttons, people, points, items): each row is built by `make`, read by
     its own read(); rows are live elements, so adding or taking one away keeps what the others hold. */
  const rowSet = (make, addKey) => {
    const holder = el("div", {});
    const rows = [];
    const renumber = () => rows.forEach((r) => r.draw?.());
    const add = (value) => { const row = make(value, () => { row.el.remove(); rows.splice(rows.indexOf(row), 1); renumber(); }); rows.push(row); holder.append(row.el); renumber(); };
    const addBtn = el("button", { type: "button", className: "btn btn--quiet", textContent: t(addKey) });
    addBtn.addEventListener("click", () => add(null));
    return { el: el("div", {}, holder, el("div", { className: "staff-actions" }, addBtn)), add,
      read: () => rows.map((r) => r.read()).filter(Boolean) };
  };
  const linkRow = (headingKey) => (value, remove) => {
    const label = textInput(value?.label || "");
    const href = textInput(value?.href || "");
    const icon = iconSelect(value?.icon);
    const away = el("button", { type: "button", className: "btn btn--quiet" });
    const box = el("fieldset", { className: "staff-step" }, el("legend", {}),
      field(t("staff.events.field.linkLabel"), label), field(t("staff.events.field.linkHref"), href),
      field(t("staff.events.field.linkIcon"), icon), el("div", { className: "staff-actions" }, away));
    const legend = box.querySelector("legend");
    const n = () => [...box.parentElement.children].indexOf(box) + 1;
    away.addEventListener("click", remove);
    const draw = () => { legend.textContent = t(headingKey, { n: n() }); away.textContent = t("staff.events.removeLink", { n: n() }); };
    return { el: box, draw, read: () => {
      const l = label.value.trim(), h = href.value.trim();
      if (!l && !h) return null;
      return { label: l, href: h, ...(icon.value ? { icon: icon.value } : {}) };
    } };
  };

  function eventForm(ev) {
    const isNew = !ev;
    const box = el("div", { hidden: true });
    const say2 = (words) => { box.replaceChildren(noteBox(words)); box.hidden = false; say(words); };
    const title = textInput(ev?.title || "");
    const path = textInput(ev?.path || "");
    const label = textInput(ev?.label || "");
    const lead = textInput(ev?.lead || "");
    const description = el("textarea", { rows: 2, value: ev?.description || "" });
    const bodyTa = el("textarea", { rows: 5, value: (ev?.body || []).join("\n") });
    const detailsTa = el("textarea", { rows: 3, value: (ev?.details || []).join("\n") });
    const [hp1, hs1] = photoField(t("staff.events.photo", { n: 1 }), ev?.photos?.[0]);
    const [hp2, hs2] = photoField(t("staff.events.photo", { n: 2 }), ev?.photos?.[1]);
    const [hp3, hs3] = photoField(t("staff.events.photo", { n: 3 }), ev?.photos?.[2]);
    const primaryLabel = textInput(ev?.primary?.label || "");
    const primaryHref = textInput(ev?.primary?.href || "");
    const moreLinks = rowSet(linkRow("staff.events.link"), "staff.events.addLink");
    (ev?.links || []).forEach((l) => moreLinks.add(l));
    const peopleTitle = textInput(ev?.peopleTitle || "");
    const people = rowSet((value, remove) => {
      const [pf, ps] = photoField(t("staff.events.field.personPhoto"), value?.photo);
      const name = textInput(value?.name || "");
      const role = textInput(value?.role || "");
      const line = textInput(value?.line || "");
      const away = el("button", { type: "button", className: "btn btn--quiet" });
      const box2 = el("fieldset", { className: "staff-step" }, el("legend", {}), pf,
        field(t("staff.events.field.personName"), name), field(t("staff.events.field.personRole"), role),
        field(t("staff.events.field.personLine"), line), el("div", { className: "staff-actions" }, away));
      const legend = box2.querySelector("legend");
      const n = () => [...box2.parentElement.children].indexOf(box2) + 1;
      away.addEventListener("click", remove);
      return { el: box2, draw: () => { legend.textContent = t("staff.events.person", { n: n() }); away.textContent = t("staff.events.removePerson", { n: n() }); },
        read: () => { const nm = name.value.trim();
          if (!nm && !role.value.trim() && !line.value.trim() && !ps.value) return null;
          return { photo: ps.value || null, name: nm, role: role.value.trim(), line: line.value.trim() }; } };
    }, "staff.events.addPerson");
    (ev?.people || []).forEach((p) => people.add(p));
    const hiTitle = textInput(ev?.highlights?.title || "");
    const hiBody = el("textarea", { rows: 3, value: (ev?.highlights?.body || []).join("\n") });
    const hiItems = rowSet((value, remove) => {
      const icon = iconSelect(value?.icon);
      const text = textInput(value?.text || "");
      const away = el("button", { type: "button", className: "btn btn--quiet" });
      const box2 = el("fieldset", { className: "staff-step" }, el("legend", {}),
        field(t("staff.events.field.itemIcon"), icon), field(t("staff.events.field.itemText"), text),
        el("div", { className: "staff-actions" }, away));
      const legend = box2.querySelector("legend");
      const n = () => [...box2.parentElement.children].indexOf(box2) + 1;
      away.addEventListener("click", remove);
      return { el: box2, draw: () => { legend.textContent = t("staff.events.item", { n: n() }); away.textContent = t("staff.events.removeItem", { n: n() }); },
        read: () => { const tx = text.value.trim(); if (!tx && !icon.value) return null;
          return { ...(icon.value ? { icon: icon.value } : {}), text: tx }; } };
    }, "staff.events.addItem");
    (ev?.highlights?.items || []).forEach((it) => hiItems.add(it));
    const [hip1, his1] = photoField(t("staff.events.photo", { n: 1 }), ev?.highlights?.photos?.[0]);
    const [hip2, his2] = photoField(t("staff.events.photo", { n: 2 }), ev?.highlights?.photos?.[1]);
    const prTitle = textInput(ev?.programme?.title || "");
    const program = choice([["peer", t("staff.events.program.peer")], ["craft", t("staff.events.program.craft")], ["workshops", t("staff.events.program.workshops")]], ev?.programme?.program || "peer");
    const topics = rowSet((value, remove) => {
      const term = textInput(value?.term || "");
      const text = textInput(value?.text || "");
      const href = textInput(value?.href || "");
      const away = el("button", { type: "button", className: "btn btn--quiet" });
      const box2 = el("fieldset", { className: "staff-step" }, el("legend", {}),
        field(t("staff.events.field.topicTerm"), term), field(t("staff.events.field.topicText"), text),
        field(t("staff.events.field.topicHref"), href), el("div", { className: "staff-actions" }, away));
      const legend = box2.querySelector("legend");
      const n = () => [...box2.parentElement.children].indexOf(box2) + 1;
      away.addEventListener("click", remove);
      return { el: box2, draw: () => { legend.textContent = t("staff.events.topic", { n: n() }); away.textContent = t("staff.events.removeTopic", { n: n() }); },
        read: () => { const tm = term.value.trim();
          if (!tm && !text.value.trim() && !href.value.trim()) return null;
          return { term: tm, text: text.value.trim(), ...(href.value.trim() ? { href: href.value.trim() } : {}) }; } };
    }, "staff.events.addTopic");
    (ev?.programme?.topics || []).forEach((tp) => topics.add(tp));
    const [pp1, ps1] = photoField(t("staff.events.photo", { n: 1 }), ev?.programme?.photos?.[0]);
    const [pp2, ps2] = photoField(t("staff.events.photo", { n: 2 }), ev?.programme?.photos?.[1]);
    const prLinks = rowSet(linkRow("staff.events.link"), "staff.events.addLink");
    (ev?.programme?.links || []).forEach((l) => prLinks.add(l));
    const galleryFields = [];
    const gallerySelects = [];
    for (let i = 0; i < 4; i++) { const [f, s] = photoField(t("staff.events.photo", { n: i + 1 }), ev?.gallery?.[i]); galleryFields.push(f); gallerySelects.push(s); }
    const place = el("select", {}, el("option", { value: "", textContent: t("staff.events.place.none") }),
      ...list.places.map((p) => el("option", { value: p.id, textContent: p.name })));
    place.value = ev?.place || "";
    const directionsTitle = textInput(ev?.directionsTitle || "");
    const shown = el("input", { type: "checkbox" });
    shown.checked = !ev?.hidden;
    const save = el("button", { type: "submit", className: "btn", textContent: t("staff.events.save") });
    const cancel = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.pages.cancel") });
    const form = el("form", { className: "staff-room", noValidate: true }, box,
      field(t("staff.events.field.title"), title),
      field(t("staff.events.field.path"), path, t("staff.events.help.path")),
      field(t("staff.events.field.label"), label, t("staff.events.help.label")),
      field(t("staff.events.field.lead"), lead),
      field(t("staff.events.field.description"), description),
      field(t("staff.events.field.body"), bodyTa, t("staff.events.help.body")),
      field(t("staff.events.field.details"), detailsTa, t("staff.events.help.details")),
      el("h3", { textContent: t("staff.events.field.photos") }), el("p", { className: "field-help", textContent: t("staff.events.help.photos") }), hp1, hp2, hp3,
      field(t("staff.events.field.primaryLabel"), primaryLabel),
      field(t("staff.events.field.primaryHref"), primaryHref),
      el("h3", { textContent: t("staff.events.field.links") }), moreLinks.el,
      field(t("staff.events.field.peopleTitle"), peopleTitle, t("staff.events.help.peopleTitle")),
      el("h3", { textContent: t("staff.events.field.people") }), people.el,
      field(t("staff.events.field.highlightsTitle"), hiTitle, t("staff.events.help.highlightsTitle")),
      field(t("staff.events.field.highlightsBody"), hiBody),
      el("h3", { textContent: t("staff.events.field.items") }), hiItems.el,
      el("h3", { textContent: t("staff.events.field.highlightsPhotos") }), hip1, hip2,
      field(t("staff.events.field.programmeTitle"), prTitle, t("staff.events.help.programmeTitle")),
      field(t("staff.events.field.program"), program),
      el("h3", { textContent: t("staff.events.field.topics") }), topics.el,
      el("h3", { textContent: t("staff.events.field.programmePhotos") }), pp1, pp2,
      el("h3", { textContent: t("staff.events.field.programmeLinks") }), prLinks.el,
      el("h3", { textContent: t("staff.events.field.gallery") }), el("p", { className: "field-help", textContent: t("staff.events.help.gallery") }), ...galleryFields,
      field(t("staff.events.field.place"), place),
      field(t("staff.events.field.directionsTitle"), directionsTitle),
      field(t("staff.events.field.shown"), shown),
      el("div", { className: "staff-actions" }, save, cancel));
    const read = () => ({ schema: "bss.hubevent/1", ...(ev?.id ? { id: ev.id } : {}),
      ...(path.value.trim() ? { path: path.value.trim() } : {}),
      hidden: !shown.checked, order: ev?.order ?? nextOrder(), title: title.value.trim(),
      description: description.value.trim(), label: label.value.trim(), lead: lead.value.trim(),
      body: lines(bodyTa), details: lines(detailsTa),
      photos: [hs1.value, hs2.value, hs3.value].filter(Boolean),
      primary: primaryLabel.value.trim() || primaryHref.value.trim() ? { label: primaryLabel.value.trim(), href: primaryHref.value.trim() } : null,
      links: moreLinks.read(), peopleTitle: peopleTitle.value.trim(), people: people.read(),
      highlights: hiTitle.value.trim() ? { title: hiTitle.value.trim(), body: lines(hiBody), items: hiItems.read(), photos: [his1.value, his2.value].filter(Boolean) } : null,
      programme: prTitle.value.trim() ? { program: program.value, title: prTitle.value.trim(), topics: topics.read(), photos: [ps1.value, ps2.value].filter(Boolean), links: prLinks.read() } : null,
      gallery: gallerySelects.map((s) => s.value).filter(Boolean),
      place: place.value || null, directionsTitle: directionsTitle.value.trim() });
    let started = null, seenVersion = list.version, startedRecord = ev ? JSON.stringify(ev) : null;
    const sameAs = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    started = read();
    async function send() {
      if (isBusy(save)) return;
      const rec = read();
      if (sameAs(rec, started)) return say2(t("staff.events.unchanged"));
      const undo = busy(save, t("staff.pages.saving"));
      const r = await call("/api/staff/pages", { method: "POST", body: { action: "event", events: [rec], expected: seenVersion } }).catch(offline);
      undo();
      if (!section.isConnected) return;
      if (r.status === 409 && r.body.current) {
        seenVersion = r.body.current;
        if (Array.isArray(r.body.events)) { list = { ...list, version: r.body.current, events: r.body.events }; }
        say2(t("staff.events.conflict"));
        draw();
        return;
      }
      if (r.status === 422 || r.status === 400) {
        const code = r.body.error || "";
        if (code === "event.title") return say2(t("staff.events.error.title", { max: list.limits.title }));
        if (code === "event.photo") return say2(t("staff.events.error.photo"));
        if (code === "event.link") return say2(t("staff.events.error.link"));
        if (code === "event.path" || code === "event.id" || code === "event.unknown") return say2(t("staff.events.error.path"));
        if (code === "event.place") return say2(t("staff.events.error.place"));
        if (code === "event.people") return say2(t("staff.events.error.people"));
        if (code === "event.icon") return say2(t("staff.events.error.icon"));
        const w = EVENT_WORD_ERRORS[code];
        if (w) return say2(t("staff.events.error.words", { field: t(w[0]), max: list.limits[w[1]] }));
        return say2(t("staff.pages.error.failed"));
      }
      if (r.status !== 200) { const [, words] = r.status === 0 ? [null, t("staff.pages.error.failed")] : refused(r); return say2(words); }
      say(r.body.publishError ? t("staff.edit.updateFailed") : t("staff.events.done"));
      published();
      pagesChanged();
      const id = r.body.event || ev?.id;
      await load();
      const fresh = list.events.find((x) => x.id === id);
      if (fresh) { open = eventForm(fresh); draw(); }
    }
    form.addEventListener("submit", async (e) => { e.preventDefault(); await send(); if (form.isConnected && (!document.activeElement || document.activeElement === document.body)) save.focus(); });
    cancel.addEventListener("click", () => { open = null; draw(); });
    return { id: ev?.id || null, isNew, form, first: title,
      syncTo: (fresh) => { if (fresh && startedRecord === JSON.stringify(fresh)) seenVersion = list.version; } };
  }
  const nextOrder = () => (list.events.reduce((m, e) => Math.max(m, e.order || 0), 0) + 1);

  async function move(ev, dir) {
    const i = list.events.indexOf(ev);
    const other = list.events[i + dir];
    if (!other) return;
    const a = { ...ev, order: other.order }, b = { ...other, order: ev.order };
    const r = await call("/api/staff/pages", { method: "POST", body: { action: "event", events: [a, b], expected: list.version } }).catch(offline);
    if (!section.isConnected) return;
    if (r.status !== 200) { const [, words] = r.status === 0 ? [null, t("staff.pages.error.failed")] : refused(r); say(words); await load(); return; }
    say(t("staff.events.done"));
    published();
    pagesChanged();
    await load();
  }

  function draw() {
    const items = list.events.map((ev, i) => {
      const change = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.events.open") });
      change.setAttribute("aria-label", t("staff.events.openName", { name: ev.title }));
      change.dataset.event = ev.id;
      change.setAttribute("aria-expanded", String(open?.id === ev.id));
      change.addEventListener("click", () => {
        if (open?.id === ev.id) return open.first.focus();
        open = eventForm(ev);
        draw();
        open.first.focus();
      });
      const up = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.events.up"), disabled: i === 0 });
      up.addEventListener("click", () => move(ev, -1));
      const down = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.events.down"), disabled: i === list.events.length - 1 });
      down.addEventListener("click", () => move(ev, 1));
      const look = el("a", { className: "btn btn--quiet", target: "_blank", rel: "noopener", href: `/api/staff/preview/pg-${ev.id}`, textContent: t("staff.events.look") });
      return el("li", { className: "staff-form" },
        el("h3", { textContent: ev.title }),
        el("p", { textContent: [ev.label, ev.path].filter(Boolean).join(" · ") }),
        ...(ev.hidden ? [el("p", {}, el("span", { className: "staff-chip is-closed", textContent: t("staff.events.hidden") }))] : []),
        el("div", { className: "staff-actions" }, change, up, down, look),
        open?.id === ev.id && open.form);
    });
    const fresh = el("button", { type: "button", className: "btn", textContent: t("staff.events.new") });
    fresh.addEventListener("click", () => { open = eventForm(null); draw(); open.first.focus(); });
    body.replaceChildren(el("ul", { className: "staff-forms" }, ...items),
      ...(open?.isNew ? [open.form] : []),
      el("div", { className: "staff-actions" }, fresh));
  }
  async function load() {
    const r = await call("/api/staff/events").catch(offline);
    if (!section.isConnected) return;
    if (r.status !== 200) { const [box] = refused(r); body.replaceChildren(box); return; }
    list = r.body;
    if (open && !open.isNew) { const mine = list.events.find((x) => x.id === open.id); if (mine) open.syncTo(mine); }
    draw();
  }
  load();
  return section;
}

/* ---------- earlier versions ---------- */

function versionsSection(me) {
  const body = el("div", {}, el("p", { textContent: t("staff.pages.loading") }));
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-versions-h", textContent: t("staff.versions.title") }), el("p", { textContent: t("staff.versions.how") }), body);
  section.setAttribute("aria-labelledby", "staff-versions-h");
  async function load(words) {
    const r = await call("/api/staff/versions").catch(offline);
    if (!section.isConnected) return;
    if (r.status !== 200) { const [box] = refused(r); body.replaceChildren(box); return; }
    const { versions, expected } = r.body;
    if (!versions.length) { body.replaceChildren(el("p", { textContent: r.body.publishError ? t("staff.versions.failed") : t("staff.versions.none") })); return; }
    const items = versions.map((v, i) => {
      const line = el("p", { textContent: t("staff.versions.item", { n: v.n, when: when(v.at), by: v.by || "—" }) });
      if (i === 0) return el("li", { className: "staff-form" }, line, el("p", { className: "staff-chip is-open", textContent: t("staff.versions.current") }));
      if (!me.canPublish) return el("li", { className: "staff-form" }, line);
      const ask = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.versions.restore", { n: v.n }) });
      const confirm = el("div", { className: "staff-drawer", hidden: true });
      ask.addEventListener("click", () => {
        const yes = el("button", { type: "button", className: "btn", textContent: t("staff.versions.yes") });
        const no = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.pages.cancel"), onclick: () => { confirm.hidden = true; ask.focus(); } });
        yes.addEventListener("click", async () => {
          if (isBusy(yes)) return;
          const undo = busy(yes, t("staff.pages.saving"));
          const back = await call(`/api/staff/versions/${v.n}/restore`, { method: "POST", body: { expected } }).catch(offline);
          undo();
          if (!section.isConnected) return;
          if (back.status === 200) return load(t("staff.versions.done", { n: v.n, m: back.body.published?.n ?? "—" }));
          const words2 = back.status === 409 ? t("staff.versions.conflict") : refused(back)[1];
          if (back.status === 409) return load(words2);
          confirm.replaceChildren(noteBox(words2));
          say(words2);
        });
        confirm.replaceChildren(el("p", { textContent: t("staff.versions.confirm", { n: v.n }) }), el("div", { className: "staff-actions" }, yes, no));
        confirm.hidden = false;
        yes.focus();
      });
      return el("li", { className: "staff-form" }, line, el("div", { className: "staff-actions" }, ask), confirm);
    });
    body.replaceChildren(el("ul", { className: "staff-forms" }, ...items));
    if (words) say(words);
  }
  published = () => { if (section.isConnected) load(); };
  load();
  return section;
}

/* ---------- who ---------- */

function whoBar(me) {
  const out = el("form", { className: "staff-who", method: "post", action: "/api/auth/signout" },
    el("p", { textContent: me.name ? t("staff.signedInAs", { name: me.name }) : t("staff.signedIn") }),
    el("button", { type: "submit", className: "btn btn--quiet", textContent: t("staff.signOut") }));
  return out;
}

/* ---------- the handover ---------- */

/* The shell (staff-signin.js) hands over once /api/staff/me has answered: who is here, where Sign
   in was to come back to, and enter(), which takes the sign-in states off the page for good. */
let shellApi = null;
export function mount(me, shell) {
  shellApi = shell;
  showTools(me);
}

/* ---------- overview ---------- */

/* The landing view, in SPILL's Today shape: what needs attention first, in the order it blocks the
   site, each line the whole way into the view that deals with it; then a card for every other view
   this account may use. The session note already carries the words state; the forms and pages parts
   report what they find as they load (answers waiting or failed, pages still drafts) through the
   two notes returned here, and the list is drawn again whenever one lands. An account with no tool
   at all gets the standing note instead, where it stood before. */
function overviewSection(me, go, offered, bare) {
  const TITLES = { forms: "staff.forms.title", words: "staff.edit.title", pages: "staff.pages.title",
    rooms: "staff.rooms.title", events: "staff.events.title", versions: "staff.versions.title", settings: "staff.settings.title" };
  const LINES = { forms: t("staff.overview.tool.forms"), words: t("staff.overview.tool.words"), pages: t("staff.overview.tool.pages"),
    rooms: t("staff.overview.tool.rooms"), events: t("staff.overview.tool.events"), versions: t("staff.overview.tool.versions"), settings: t("staff.overview.tool.settings") };
  const found = { deliveries: null, drafts: null };
  const needs = el("div", { className: "staff-needs" });
  const draw = () => {
    if (bare) { needs.replaceChildren(el("p", { className: "staff-note", textContent: t("staff.nothing") })); return; }
    const items = [];
    if (me.publishError) items.push(["words", t("staff.edit.updateFailed")]);
    const d = found.deliveries;
    if (d && !d.connect) items.push(["forms", t("staff.delivery.off")]);
    else if (d) {
      if (d.stuck) items.push(["forms", t(d.stuck === 1 ? "staff.overview.stuckSend.one" : "staff.overview.stuckSend.other", { n: d.stuck })]);
      if (d.failed) items.push(["forms", t(d.failed === 1 ? "staff.overview.failedSend.one" : "staff.overview.failedSend.other", { n: d.failed })]);
      if (d.pending) items.push(["forms", t(d.pending === 1 ? "staff.overview.waitingSend.one" : "staff.overview.waitingSend.other", { n: d.pending })]);
    }
    if (me.waiting) items.push(["words", t(me.waiting === 1 ? "staff.edit.waiting.one" : "staff.edit.waiting.other", { n: me.waiting })]);
    if (found.drafts) items.push(["pages", t(found.drafts === 1 ? "staff.overview.drafts.one" : "staff.overview.drafts.other", { n: found.drafts })]);
    needs.replaceChildren(...(items.length ? items.map(([view, line]) => {
      const a = el("a", { className: "staff-need", href: `#${view}` },
        el("span", { textContent: line }), el("span", { className: "staff-need-go", textContent: t(TITLES[view]) }));
      a.addEventListener("click", (e) => { e.preventDefault(); go(view); });
      return a;
    }) : [el("div", { className: "staff-clear" },
      el("p", { textContent: t("staff.overview.clear") }),
      ...(offered.some(([id]) => id === "words") ? [el("p", { className: "staff-note", textContent: updateLine(me) })] : []))]));
  };
  const cards = el("div", { className: "staff-tools" }, ...offered.map(([id, titleKey]) => {
    const a = el("a", { className: "staff-tool", href: `#${id}` },
      el("span", { className: "staff-tool-name", textContent: t(titleKey) }),
      el("span", { textContent: LINES[id] }));
    a.addEventListener("click", (e) => { e.preventDefault(); go(id); });
    return a;
  }));
  /* What visitors cannot see, one click away: the Find Your People section is switched off on
     the home page (content/pages/home.json, b-home-explore) until it is ready for release, so
     its two doors stand here instead, where anyone signed in can open them. */
  const hiddenLink = (href, words) => el("a", { className: "staff-need", href },
    el("span", { textContent: words }),
    el("span", { className: "staff-need-go", textContent: t("staff.overview.hidden.open") }));
  const hidden = el("div", { className: "staff-hidden" },
    el("h3", { textContent: t("staff.overview.hidden.title") }),
    el("div", { className: "staff-needs" },
      hiddenLink("/explore/events/", t("staff.overview.hidden.events")),
      hiddenLink("/explore/", t("staff.overview.hidden.explore"))));
  const part = el("section", { className: "staff-part" },
    el("h2", { id: "staff-overview-h", textContent: t("staff.nav.overview") }),
    el("p", { textContent: t("staff.overview.how") }), needs, cards, hidden);
  part.setAttribute("aria-labelledby", "staff-overview-h");
  draw();
  return { part, noteForms: (d) => { found.deliveries = d; draw(); }, notePages: (d) => { found.drafts = d.drafts; draw(); } };
}

function showTools(me) {
  shellApi.enter();
  /* One view at a time under the section menu, the shape Connect's app uses: the tools open on the
     overview, every job lives in its own view, and the menu stays above whichever view is open, so
     nothing is a scroll through the other jobs. The view named by the address's hash opens when
     this account may use it; the menu and the overview's cards write the hash as they go, so a
     reload, and a kept page checking again on pageshow, lands back where the person was working.
     Every part still loads as it is built: the menu only shows and hides views, so no part's state
     — typed words, an open card, a stale token — is ever rebuilt by moving between views. */
  let overview = null;
  const forms = me.canRead || me.canSwitch || me.canEdit ? formsSection(me, (d) => overview?.noteForms(d)) : me.readAgain && readAgainSection();
  const pages = me.canEdit || me.canPublish;
  const views = [];
  const add = (id, node, titleKey) => { if (node) views.push([id, node, titleKey]); };
  add("forms", forms, "staff.forms.title");
  add("words", pages && editSection(me), "staff.edit.title");
  add("pages", pages && pagesSection(me, (d) => overview?.notePages(d)), "staff.pages.title");
  add("rooms", me.canPublish && roomsSection(), "staff.rooms.title");
  add("events", me.canPublish && eventsSection(), "staff.events.title");
  add("versions", pages && versionsSection(me), "staff.versions.title");
  add("settings", me.canPublish && settingsSection(me), "staff.settings.title");
  /* Find a setting: one box over every view's own words — the labels of its fields, its folds
     named by the card they sit on, and its headings — that takes the editor to the one they
     named: its view opens, a fold holding it opens, and the place is ringed and focused. The
     index is read from the page as it stands when the box is used, so a part that has not
     loaded yet is simply not in it. */
  const words = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const findInput = el("input", { type: "search", id: "staff-find" });
  const findResults = el("div", { className: "staff-find-results" });
  const findBox = el("div", { className: "staff-find" },
    el("label", { htmlFor: "staff-find", textContent: t("staff.find.label") }), findInput, findResults);
  const viewTitles = () => Object.fromEntries([["overview", t("staff.nav.overview")], ...views.map(([id, , k]) => [id, t(k)])]);
  function findIndex() {
    const out = [];
    const seen = new Set();
    const add = (name, target, view) => {
      const n = words(name);
      if (!n || seen.has(target)) return;
      seen.add(target);
      out.push({ name: n, target, view });
    };
    for (const [id, node] of [["overview", overview.part], ...views]) {
      for (const lab of node.querySelectorAll("label[for]")) {
        const control = document.getElementById(lab.getAttribute("for"));
        if (control) add(lab.textContent, control, id);
      }
      for (const sum of node.querySelectorAll("summary")) {
        const title = sum.closest(".staff-form")?.querySelector("h3")?.textContent || "";
        add(`${words(title)} — ${words(sum.textContent)}`, sum, id);
      }
      for (const h of node.querySelectorAll("h2, h3")) add(h.textContent, h, id);
    }
    return out;
  }
  function findJump(hit) {
    for (const n of document.querySelectorAll(".staff-found")) n.classList.remove("staff-found");
    show(hit.view, false);
    for (let n = hit.target; n; n = n.parentElement) if (n.tagName === "DETAILS") n.open = true;
    findResults.replaceChildren();
    findInput.value = "";
    hit.target.scrollIntoView({ block: "center" });
    hit.target.classList.add("staff-found");
    setTimeout(() => hit.target.classList.remove("staff-found"), 3000);
    if (!/^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(hit.target.tagName)) hit.target.tabIndex = -1;
    hit.target.focus?.({ preventScroll: true });
    say(hit.name);
  }
  findInput.addEventListener("input", () => {
    const q = words(findInput.value).toLowerCase();
    if (q.length < 2) { findResults.replaceChildren(); return; }
    const hits = findIndex().filter((h) => h.name.toLowerCase().includes(q)).slice(0, 8);
    const titles = viewTitles();
    findResults.replaceChildren(...(hits.length
      ? hits.map((h) => {
          const b = el("button", { type: "button", className: "btn btn--quiet" }, el("span", { textContent: h.name }), " ", el("span", { className: "staff-find-view", textContent: titles[h.view] || "" }));
          b.addEventListener("click", () => findJump(h));
          return b;
        })
      : [el("p", { textContent: t("staff.find.none") })]));
  });
  overview = overviewSection(me, (id) => show(id, true), views.map(([id, , titleKey]) => [id, titleKey]), !views.length);
  const all = [["overview", overview.part], ...views.map(([id, node]) => [id, node])];
  const links = {};
  const list = el("ul", {}, ...[["overview", t("staff.nav.overview")], ...views.map(([id, , titleKey]) => [id, t(titleKey)])].map(([id, label]) => {
    const a = el("a", { className: "secnav-item", href: `#${id}`, textContent: label });
    a.addEventListener("click", (e) => { e.preventDefault(); show(id, true); });
    links[id] = a;
    return el("li", {}, a);
  }));
  /* The menu scrolls sideways when its words run wider than the bar — on a phone the last views
     sit off the right edge with nothing to say they are there. A button stands at each end while
     the menu can scroll that way, and a press scrolls one comfortable step; at an end, and
     whenever the whole menu fits, that button is not there, so a wide screen's bar is unchanged. */
  const scrollBtn = (words, dir) => {
    const b = el("button", { type: "button", className: "btn staff-nav-scroll", ariaLabel: words },
      el("span", { ariaHidden: "true", textContent: dir < 0 ? "‹" : "›" }));
    b.addEventListener("click", () => list.scrollBy({ left: dir * Math.max(list.clientWidth * 0.8, 160), behavior: "smooth" }));
    return b;
  };
  const backBtn = scrollBtn(t("staff.nav.scrollBack"), -1);
  const fwdBtn = scrollBtn(t("staff.nav.scrollForward"), 1);
  const nav = el("nav", { className: "secnav staff-nav", ariaLabel: t("staff.nav.label") }, backBtn, list, fwdBtn);
  const fitScrollBtns = () => {
    const max = list.scrollWidth - list.clientWidth;
    backBtn.hidden = !(max > 1 && list.scrollLeft > 1);
    fwdBtn.hidden = !(max > 1 && list.scrollLeft < max - 1);
  };
  list.addEventListener("scroll", fitScrollBtns, { passive: true });
  new ResizeObserver(fitScrollBtns).observe(list);
  document.fonts?.ready.then(fitScrollBtns);
  function show(id, focus = false) {
    const current = id === "overview" || views.some(([v]) => v === id) ? id : "overview";
    for (const [v, node] of all) node.hidden = v !== current;
    for (const [v, a] of Object.entries(links)) { if (v === current) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
    history.replaceState(null, "", `#${current}`);
    if (focus) { const h = all.find(([v]) => v === current)[1].querySelector("h2"); if (h) { h.tabIndex = -1; h.focus(); } }
  }
  const onward = shellApi.back !== "/staff/" && el("p", {}, el("a", { className: "btn", href: shellApi.back, textContent: t("staff.returnTo") }));
  app.replaceChildren(...[onward, whoBar(me), views.length ? findBox : null, nav, ...all.map(([, node]) => node)].filter(Boolean));
  show(location.hash.slice(1));
  requestAnimationFrame(fitScrollBtns);
  app.hidden = false;
  say(me.name ? t("staff.signedInAs", { name: me.name }) : t("staff.signedIn"));
}
