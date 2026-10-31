/* The staff page's tools, drawn once someone is signed in (netlify/lib/staff.mjs). Before that, the
 * page is in one of these states, each with one thing to do next:
 *   - never signed in on this browser: the Sign in button at once; the page asks only whether
 *     sign-in is switched on here (/api/auth/status);
 *   - signed in before (the hint cookie): "Checking your sign-in" stands where the button is, from
 *     the first frame (src/render/layout.mjs), until /api/staff/me answers;
 *   - that sign-in has ended: says so above the button, and forgets the hint;
 *   - sign-in is not switched on: says so, with no button;
 *   - the check failed: says so, with Try again.
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
 *     page, reorder the menu; and the published versions, with Bring back for a publisher, asked twice.
 * Only what the account may use is drawn. Reading answers ends sooner than the rest of a session
 * (netlify/lib/staff.mjs, sessionFrom); after that the forms part asks for a fresh sign-in instead.
 * A check that is run again wins over one still on its way, and leaving the page takes the tools
 * off it, so a page a browser keeps for Back holds no answers; coming back to it checks again.
 * Nothing here is counted, and nothing is kept in the browser.
 */

import { t } from "./text.js";

const app = document.querySelector("[data-staff-app]");
const signIn = document.querySelector("[data-staff-signin]");
const signInLink = signIn?.querySelector("a");
const checking = document.querySelector("[data-staff-checking]");
const intro = document.querySelector("[data-staff-intro]");
const quote = document.querySelector("[data-staff-quote]");
const heading = app?.closest(".staff")?.querySelector("h1");
const WHEN = { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" };
const HINT = /(?:^|;\s*)bss_staff_hint=1(?:;|$)/;

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k != null && k !== false));
  return n;
};
const when = (iso) => new Date(iso).toLocaleString("en-US", WHEN);
const offline = () => ({ status: 0, body: {} });

/* Where Sign in comes back to: ?return= when it names a page on this site, held to the server's
   own rule (netlify/lib/staff.mjs, returnPath), else this page. */
const back = (() => {
  const v = new URLSearchParams(location.search).get("return") || "";
  return v.length <= 200 && /^\/(?!\/)[A-Za-z0-9\-._~/]*$/.test(v) ? v : "/staff/";
})();
if (signInLink && back !== "/staff/") signInLink.href = `/api/auth/start?return=${encodeURIComponent(back)}`;

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

/* What stands in place of something the server would not give, with its words for saying aloud:
   a fresh sign-in, the reason, or that it failed. */
function refused(r) {
  if (isAgain(r)) return [readAgain(), t("staff.readAgain")];
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
  return parts.length ? el("p", { className: d.failed ? "staff-delivery is-failing" : "staff-delivery", textContent: parts.join(" · ") }) : null;
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
  return box;
}

/* Open or Close for one form (router.mjs, formSwitch). Open asks again, naming the form, before anything is
   sent; Close goes at once. The chip and the button follow the server's answer, never the click. */
function switchControl(f, chip) {
  const box = el("div", { className: "staff-switch" });
  const shown = () => box.querySelector("button");
  function draw() {
    chip.className = `staff-chip is-${f.state}`;
    chip.textContent = t(`staff.forms.state.${f.state}`);
    const button = el("button", { type: "button", className: "btn btn--quiet", textContent: t(f.state === "open" ? "staff.switch.close" : "staff.switch.open") });
    button.addEventListener("click", () => (f.state === "open" ? send(button, "closed") : ask()));
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
    draw();
    const words = [t(f.state === "open" ? "staff.switch.opened" : "staff.switch.closed", { title: f.title }), r.body.purgeError ? t("staff.switch.slow") : ""].filter(Boolean).join(" ");
    box.append(el("p", { textContent: words }));
    shown().focus();
    say(words);
  }
  draw();
  return box;
}

function formCard(f, connect) {
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
  return el("li", { className: "staff-form" },
    el("h3", {}, el("span", { textContent: f.title }), " ", state),
    read ? el("p", { textContent: f.total ? `${t(f.total === 1 ? "staff.forms.count.one" : "staff.forms.count.other", { n: f.total })} · ${t("staff.forms.latest", { when: when(f.latest) })}` : t("staff.forms.none") }) : null,
    read ? deliveryLine(f, connect) : null,
    read && f.total ? toggle : null,
    read ? panel : null,
    f.canSwitch ? switchControl(f, state) : null);
}

function formsSection(me) {
  const list = el("ul", { className: "staff-forms" });
  const off = el("p", { className: "staff-note", textContent: t("staff.delivery.off"), hidden: true });
  const retry = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.retry"), hidden: true });
  const retryProblem = el("div", { hidden: true });
  const again = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.tryAgain") });
  const work = me.connectUrl ? el("a", { href: `${me.connectUrl}/`, textContent: t("staff.answers.openConnect") }) : null;

  function draw(r) {
    list.replaceChildren(...r.forms.map((f) => formCard(f, r.connect)));
    if (!r.forms.length) list.replaceChildren(el("li", { textContent: t("staff.forms.empty") }));
    off.hidden = r.connect;
    retry.hidden = !r.connect || !r.forms.some((f) => f.delivery.pending || f.delivery.failed);
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
    el("p", { textContent: t("staff.forms.how") }), me.readAgain ? readAgain() : null, off, list, retryProblem,
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
  const download = me.canPublish && el("a", { className: "btn", href: "/api/staff/edits?download=1", download: "edits.json", textContent: t("staff.edit.download") });
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
    line,
    update,
    el("div", { className: "staff-actions" }, refresh),
    problem,
    download && el("p", {}, download),
    download && el("p", { className: "staff-note", textContent: t("staff.edit.publish") }));
  section.setAttribute("aria-labelledby", "staff-edit-h");
  return section;
}

/* ---------- pages ---------- */

/* Set by the versions part: a change saved in the pages part lists its new version there too. */
let published = () => {};

/* Each change names the version of the pages it started from; a refusal keeps what was typed and says why. */
const PAGE_ERRORS = { "page.path": "path", "page.path.reserved": "reserved", "page.path.taken": "taken", "page.title": "title",
  "page.description": "description", "page.fixed": "fixed", "page.retireTo": "retireTo", "menu.entry": "menu", "menu.group": "menu" };
const STATE_CHIP = { live: "is-open", draft: "is-closed", retired: "is-closed" };
let fieldCount = 0;
function field(label, input) {
  input.id = `staff-field-${++fieldCount}`;
  return el("div", { className: "field" }, el("label", { htmlFor: input.id, textContent: label }), input);
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

function pagesSection(me) {
  const body = el("div", {}, el("p", { textContent: t("staff.pages.loading") }));
  const problem = el("div", { hidden: true });
  const preview = previewBox();
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-pages-h", textContent: t("staff.pages.title") }),
    el("p", { textContent: t("staff.pages.how") }), problem, body, preview.box);
  section.setAttribute("aria-labelledby", "staff-pages-h");
  let now = null;

  const show = (box, words) => { problem.replaceChildren(box); problem.hidden = false; say(words); };
  function failed(r) {
    if (r.status === 409) return show(noteBox(t("staff.pages.conflict")), t("staff.pages.conflict"));
    if (r.status === 422 || r.status === 400) { const w = t(`staff.pages.error.${PAGE_ERRORS[r.body.error] || "failed"}`); return show(noteBox(w), w); }
    const [box, words] = r.status === 0 ? [noteBox(t("staff.pages.error.failed")), t("staff.pages.error.failed")] : refused(r);
    return show(box, words);
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
    const button = (words, onclick) => actions.push(el("button", { type: "button", className: "btn btn--quiet", textContent: words, onclick }));
    if (p.state !== "retired") button(t("staff.pages.preview"), () => preview.show(p));
    if (!p.fixed && me.canEdit) button(t("staff.pages.copy"), () => {
      const title = textInput(p.title), where = textInput(p.path, { spellcheck: false });
      open(form([field(t("staff.pages.field.title"), title), field(t("staff.pages.field.path"), where)], t("staff.pages.copy.button"),
        () => ({ action: "copy", page: p.id, title: title.value, path: where.value }), t("staff.pages.done.copy")));
    });
    if (!p.fixed && p.state !== "retired" && me.canEdit) button(t("staff.pages.details"), () => {
      const title = textInput(p.title), about = el("textarea", { value: p.description, rows: 3 });
      const mayMove = p.state === "draft" || me.canPublish;
      const where = textInput(p.path, { spellcheck: false, disabled: !mayMove });
      open(form([field(t("staff.pages.field.title"), title), field(t("staff.pages.field.description"), about), field(t("staff.pages.field.path"), where),
        !mayMove && el("p", { className: "staff-note", textContent: t("staff.pages.details.liveAddress") })].filter(Boolean), t("staff.pages.details.button"),
      () => ({ action: "details", page: p.id, title: title.value, description: about.value, ...(mayMove && where.value !== p.path ? { path: where.value } : {}) }), t("staff.pages.done.details")));
    });
    if (p.state === "draft" && me.canPublish) button(t("staff.pages.publish"), () => {
      const group = choice([["-", t("staff.pages.menu.none")], ...groups], "-"), name = textInput(p.title);
      open(form([field(t("staff.pages.field.group"), group), field(t("staff.pages.field.label"), name)], t("staff.pages.publish.button"),
        () => ({ action: "publish", page: p.id, ...(group.value === "-" ? {} : { group: group.value, label: name.value }) }), t("staff.pages.done.publish")));
    });
    if (!p.fixed && (p.state === "draft" ? me.canEdit : p.state === "live" && me.canPublish)) button(p.state === "draft" ? t("staff.pages.discard") : t("staff.pages.retire"), () => {
      const to = choice([["", t("staff.pages.retire.nowhere")], ...live.map((x) => [x.id, `${x.title} (${x.path})`])], "");
      open(form([el("p", { textContent: t("staff.pages.retire.confirm", { title: p.title }) }), p.state === "live" && field(t("staff.pages.field.to"), to)].filter(Boolean),
        t("staff.pages.retire.yes"), () => ({ action: "retire", page: p.id, ...(p.state === "live" && to.value ? { to: to.value } : {}) }), t("staff.pages.done.retire")));
    });
    return el("li", { className: "staff-form" },
      el("h3", {}, p.title, el("span", { className: `staff-chip ${STATE_CHIP[p.state]}`, textContent: t(`staff.pages.state.${p.state}`) })),
      el("p", { textContent: p.path }), actions.length && el("div", { className: "staff-actions" }, ...actions), drawer);
  }

  /* The menu, reordered here and saved once. Up and Down move an entry within its level. */
  function menuPart() {
    let order = now.menu.map((x) => ({ ...x, children: x.children ? [...x.children] : undefined }));
    const list = el("ol", { className: "staff-menu" });
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
    const row = (arr, i, x) => el("li", {}, el("span", { textContent: x.label }),
      arrow(x, -1, "↑", i === 0, () => move(arr, i, -1)),
      arrow(x, 1, "↓", i === arr.length - 1, () => move(arr, i, 1)),
      takeOff(x, () => { arr.splice(i, 1); drawList(); }),
      x.children && el("ol", {}, ...x.children.map((c, k) => row(x.children, k, c))));
    function drawList(focus) {
      list.replaceChildren(...order.map((x, i) => row(order, i, x)));
      const b = focus && list.querySelector(`[data-key="${focus}"]`);
      (b && !b.disabled ? b : save).focus();
    }
    list.replaceChildren(...order.map((x, i) => row(order, i, x)));
    save.addEventListener("click", () => send(save, { action: "menu", menu: order.map((x) => ({ id: x.id, ...(x.children ? { children: x.children.map((c) => c.id) } : {}) })) }, t("staff.pages.done.menu")));
    const part = el("div", { className: "staff-form" }, el("h3", { textContent: t("staff.pages.menu.title") }), el("p", { textContent: t("staff.pages.menu.how") }), list, el("div", { className: "staff-actions" }, save));
    return part;
  }

  /* Drafts first, then the pages on the site by address, then retired pages made here. */
  const RANK = { draft: 0, live: 1, retired: 2 };
  function draw() {
    const shown = now.pages.filter((p) => p.state !== "retired" || p.made)
      .sort((a, b) => RANK[a.state] - RANK[b.state] || a.path.localeCompare(b.path));
    body.replaceChildren(...[me.canEdit && addForm, el("ul", { className: "staff-forms" }, ...shown.map(card)), me.canPublish && menuPart()].filter(Boolean));
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

/* The hint that tells every page to load the edit button; a session that ended elsewhere leaves it
   behind, and this page is where it is noticed. */
const forgetHint = () => { document.cookie = `bss_staff_hint=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; };

/* ---------- the states before the tools ---------- */

/* Under the button: why there are no tools, and Try again when a check failed. Made once, so focus
   stays on Try again while it checks again. */
const state = el("div", { className: "staff-state", hidden: true });
const stateNote = el("p", { className: "staff-note" });
const tryAgain = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.tryAgain") });
state.append(stateNote, tryAgain);
signIn?.after(state);
tryAgain.addEventListener("click", () => { if (!isBusy(tryAgain)) start(); });

function note(words, retry = false) {
  stateNote.textContent = words || "";
  tryAgain.hidden = !retry;
  state.hidden = !words;
}

/* "checking", "signIn" or "none": what stands where the button is. The words before it show again. */
function before(mode) {
  checking.hidden = mode !== "checking";
  signIn.hidden = mode !== "signIn";
  intro.hidden = false;
  if (quote) quote.hidden = !quote.textContent || mode !== "signIn";
}

function showTools(me) {
  before("none");
  note("");
  intro.hidden = true;
  if (quote) quote.hidden = true;
  const forms = me.canRead || me.canSwitch ? formsSection(me) : me.readAgain && readAgainSection();
  const onward = back !== "/staff/" && el("p", {}, el("a", { className: "btn", href: back, textContent: t("staff.returnTo") }));
  const pages = me.canEdit || me.canPublish;
  app.replaceChildren(...[onward, whoBar(me), forms, pages && editSection(me), pages && pagesSection(me), pages && versionsSection(me)].filter(Boolean));
  if (!forms && !me.canEdit && !me.canPublish) app.prepend(el("p", { className: "staff-note", textContent: t("staff.nothing") }));
  app.hidden = false;
  say(me.name ? t("staff.signedInAs", { name: me.name }) : t("staff.signedIn"));
}

/* One check of who is here. `fresh()` turns false once a newer check has started, or the page was
   left, and its answer is then dropped. */
async function check(hinted, fresh) {
  if (!hinted) {
    const s = await call("/api/auth/status").catch(offline);
    if (!fresh()) return;
    if (s.status !== 200) { note(t("staff.loadError"), true); say(t("staff.loadError")); return; }
    if (!s.body.signedIn) {
      if (s.body.configured === false) { before("none"); note(t("staff.notConfigured")); }
      else before("signIn");
      return;
    }
    before("checking"); // signed in, though the hint has gone
  }
  const r = await call("/api/staff/me").catch(offline);
  if (!fresh()) return;
  if (r.status === 200) { showTools(r.body); return; }
  if (r.status === 401) {
    forgetHint();
    if (r.body.configured === false) { before("none"); note(t("staff.notConfigured")); return; }
    before("signIn");
    note(t("staff.ended"));
    say(t("staff.ended"));
    return;
  }
  before(hinted ? "none" : "signIn");
  note(t("staff.loadError"), true);
  say(t("staff.loadError"));
}

/* Connect GOOGLE-SIGNIN: one quote from Connect's one shared list, picked once per page load and kept while the page
   stands. None when the list is empty, switched off in Connect, or does not load; it never holds up signing in. It
   stands only beside the Sign in button. */
async function loadQuote() {
  if (!quote) return;
  const r = await call("/api/signin-quotes").catch(offline);
  const list = Array.isArray(r.body.quotes) ? r.body.quotes.filter((x) => typeof x === "string" && x) : [];
  if (!list.length) return;
  quote.textContent = list[Math.floor(Math.random() * list.length)];
  quote.hidden = signIn.hidden;
}

let runs = 0;
async function start() {
  const run = ++runs;
  const hinted = HINT.test(document.cookie);
  const had = state.contains(document.activeElement);
  document.documentElement.classList.remove("staff-hint");
  // Pressed Try again: it stays where it is, busy, while the page checks again.
  if (had) { stateNote.textContent = t("staff.checking"); tryAgain.setAttribute("aria-busy", "true"); }
  else note("");
  before(had ? "none" : hinted ? "checking" : "signIn");
  await check(hinted, () => run === runs);
  if (run !== runs) return;
  tryAgain.removeAttribute("aria-busy");
  // Try again has gone: focus goes to what replaced it, the button or the page's heading.
  if (had && (state.hidden || tryAgain.hidden)) (signIn.hidden ? heading : signInLink)?.focus();
}

if (app) {
  /* Leaving: the tools come off before a browser keeps the page for Back, so it holds no answers,
     and any reply still on its way is dropped. Coming back to a kept page checks again. */
  addEventListener("pagehide", () => {
    runs++;
    app.replaceChildren();
    app.hidden = true;
    note("");
    before(HINT.test(document.cookie) ? "checking" : "signIn");
  });
  addEventListener("pageshow", (e) => { if (e.persisted) start(); });
  start();
  loadQuote();
}
