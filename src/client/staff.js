/* The staff page's tools, drawn once someone is signed in (netlify/lib/staff.mjs). With nobody
 * signed in the page stays as the build drew it: the words and the Sign in button. With someone:
 *   - who they are, and Sign out (a plain form, so it works however the page is);
 *   - the forms their Connect role lets them read, each with how many answers it holds and
 *     whether those reached Connect, a button to send any still waiting, and the latest answers
 *     to one form on request;
 *   - for anyone who may change words, how to, and how many changes wait to publish;
 *   - for anyone who may publish, the file a publish needs.
 * Nothing here is counted, and nothing is kept in the browser.
 */

import { t } from "./text.js";

const app = document.querySelector("[data-staff-app]");
const signIn = document.querySelector("[data-staff-signin]");
const WHEN = { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" };

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k != null && k !== false));
  return n;
};
const when = (iso) => new Date(iso).toLocaleString("en-US", WHEN);

async function call(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method, credentials: "same-origin",
    headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

let status;
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

function formCard(f, connect) {
  const panel = el("div", { className: "staff-answers", id: `answers-${f.key}`, hidden: true });
  const toggle = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.answers.show") });
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panel.id);
  toggle.addEventListener("click", async () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    if (open) {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = t("staff.answers.show");
      return;
    }
    toggle.disabled = true;
    const r = await call(`/api/staff/forms/${encodeURIComponent(f.key)}/submissions`).catch(() => ({ status: 0, body: {} }));
    toggle.disabled = false;
    if (r.status !== 200) { say(t("staff.loadError")); return; }
    panel.replaceChildren(r.body.items.length ? answersTable(r.body) : el("p", { textContent: t("staff.answers.none") }));
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = t("staff.answers.hide");
  });
  const state = el("span", { className: `staff-chip is-${f.state}`, textContent: t(`staff.forms.state.${f.state}`) });
  return el("li", { className: "staff-form" },
    el("h3", {}, el("span", { textContent: f.title }), " ", state),
    el("p", { textContent: f.total ? `${t(f.total === 1 ? "staff.forms.count.one" : "staff.forms.count.other", { n: f.total })} · ${t("staff.forms.latest", { when: when(f.latest) })}` : t("staff.forms.none") }),
    deliveryLine(f, connect),
    f.total ? toggle : null,
    panel);
}

function formsSection(me) {
  const list = el("ul", { className: "staff-forms" });
  const off = el("p", { className: "staff-note", textContent: t("staff.delivery.off"), hidden: true });
  const retry = el("button", { type: "button", className: "btn btn--quiet", textContent: t("staff.retry"), hidden: true });
  const work = me.connectUrl ? el("p", {}, el("a", { href: `${me.connectUrl}/`, textContent: t("staff.answers.openConnect") })) : null;

  function draw(r) {
    list.replaceChildren(...r.forms.map((f) => formCard(f, r.connect)));
    if (!r.forms.length) list.replaceChildren(el("li", { textContent: t("staff.forms.empty") }));
    off.hidden = r.connect;
    retry.hidden = !r.connect || !r.forms.some((f) => f.delivery.pending || f.delivery.failed);
  }
  retry.addEventListener("click", async () => {
    retry.disabled = true;
    const r = await call("/api/staff/outbox/retry", { method: "POST", body: {} }).catch(() => ({ status: 0, body: {} }));
    retry.disabled = false;
    if (r.status !== 200) { say(t("staff.loadError")); return; }
    draw(r.body);
    say(t("staff.retried", { sent: r.body.sent, failed: r.body.failed }));
  });

  const section = el("section", { className: "staff-part" }, el("h2", { id: "staff-forms-h", textContent: t("staff.forms.title") }), off, list, retry, work);
  section.setAttribute("aria-labelledby", "staff-forms-h");
  call("/api/staff/forms").then((r) => {
    if (r.status !== 200) throw new Error("forms");
    draw(r.body);
  }).catch(() => list.replaceChildren(el("li", { textContent: t("staff.loadError") })));
  return section;
}

/* ---------- words ---------- */

function editSection(me) {
  const line = el("p", { textContent: me.waiting ? t(me.waiting === 1 ? "staff.edit.waiting.one" : "staff.edit.waiting.other", { n: me.waiting }) : t("staff.edit.none") });
  const download = me.canPublish && el("a", { className: "btn", href: "/api/staff/edits?download=1", download: "edits.json", textContent: t("staff.edit.download") });
  const section = el("section", { className: "staff-part" },
    el("h2", { id: "staff-edit-h", textContent: t("staff.edit.title") }),
    me.canEdit && el("p", { textContent: t("staff.edit.how") }),
    line,
    download && el("p", {}, download),
    download && el("p", { className: "staff-note", textContent: t("staff.edit.publish") }));
  section.setAttribute("aria-labelledby", "staff-edit-h");
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

async function start() {
  if (!app) return;
  const s = await call("/api/auth/status").catch(() => ({ status: 0, body: {} }));
  if (s.status === 200 && !s.body.signedIn) {
    forgetHint();
    if (s.body.configured === false) {
      signIn.hidden = true;
      signIn.after(el("p", { className: "staff-note", textContent: t("staff.notConfigured") }));
    }
    return;
  }
  const r = s.status === 200 ? await call("/api/staff/me").catch(() => ({ status: 0, body: {} })) : s;
  if (r.status === 401) return;
  if (r.status !== 200) {
    signIn.after(el("p", { className: "staff-note", textContent: t("staff.loadError") }));
    return;
  }
  const me = r.body;
  status = el("p", { className: "sr-only" });
  status.setAttribute("role", "status");
  signIn.hidden = true;
  app.replaceChildren(...[whoBar(me), me.canRead && formsSection(me), (me.canEdit || me.canPublish) && editSection(me), status].filter(Boolean));
  if (!me.canRead && !me.canEdit && !me.canPublish) app.prepend(el("p", { className: "staff-note", textContent: t("staff.nothing") }));
  app.hidden = false;
}

start();
