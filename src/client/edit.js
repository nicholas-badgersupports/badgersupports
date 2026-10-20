/* The edit button, for staff whose Connect role includes site.edit (netlify/lib/staff.mjs). site.js
 * loads this file only on a browser where someone has signed in; it asks the server who that is
 * and draws nothing for anyone else. Its words come from that answer too, so a visitor's page
 * carries none of them.
 *
 * Edit text marks every word on the page that can be changed. Choosing one opens a box with the
 * words, what the site shipped with, and who changed them last. Saving keeps the change at once
 * (netlify/lib/edits.mjs); visitors see it after the next publish, or at once on a local copy.
 * Words not on the screen right now — a line shown only when something goes wrong, a label read
 * aloud — are under More words, as are the lines every page shares.
 *
 * Finding a word on the page: the deepest element whose text is exactly that word, inside its own
 * block for a page's words, outside every block for the menus and footer. Words the page builds in
 * a way that does not match (a paragraph with a link inside it) are left to More words.
 */

let table = {};
const t = (key, vars = {}) => String(table[key] ?? "").replace(/\{\{(\w+)\}\}/g, (m, v) => (v in vars ? String(vars[v]) : m));

const SKIP = "script, style, template, svg, option, noscript, [data-edit-ui]";
const SHORT = 90;

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k != null && k !== false));
  return n;
};
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const short = (s) => (s.length > SHORT ? `${s.slice(0, SHORT - 1)}…` : s);
const kindOf = (target) => target.split(":")[0];
const blockOf = (target) => (kindOf(target) === "page" ? target.split(":")[2].split("/")[0] : null);

async function call(url, body) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET", credentials: "same-origin",
    headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

let me = null;
let entries = null;           // target -> entry, from the server
const marks = new Map();      // target -> [elements showing it]
const added = new Set();      // elements given a tabindex here, to take it away again
let editing = false;
let ui = null;
let opened = null;            // the entry the box is showing

/* ---------- finding words on the page ---------- */

function textIndex() {
  const index = new Map();
  for (const node of document.body.querySelectorAll("*")) {
    if (node.closest(SKIP)) continue;
    const words = norm(node.textContent);
    if (!words || words.length > 2100) continue;
    if ([...node.children].some((c) => norm(c.textContent) === words)) continue;
    if (!index.has(words)) index.set(words, []);
    index.get(words).push(node);
  }
  return index;
}

function fits(target, node) {
  const block = node.closest("[data-block]")?.getAttribute("data-block") || null;
  if (kindOf(target) === "page") return block === blockOf(target);
  if (kindOf(target) === "site") return block === null;
  return true;
}

function place() {
  const index = textIndex();
  const claimed = new Set();
  const twins = new Map();
  const scope = (e) => `${blockOf(e.target) ?? kindOf(e.target)}\n${norm(e.shown)}`;
  for (const e of entries.values()) twins.set(scope(e), (twins.get(scope(e)) || 0) + 1);
  marks.clear();
  for (const kind of ["page", "site", "text"]) {
    for (const e of entries.values()) {
      if (kindOf(e.target) !== kind) continue;
      const found = (index.get(norm(e.shown)) || []).filter((n) => !claimed.has(n) && fits(e.target, n));
      // Two places in one block with the same words: one element each, in order.
      const take = twins.get(scope(e)) > 1 ? found.slice(0, 1) : found;
      for (const n of take) claimed.add(n);
      if (take.length) marks.set(e.target, take);
    }
  }
}

function show(node, words) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let first = true;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data.trim() || n.parentElement.closest(SKIP)) continue;
    n.data = first ? words : "";
    first = false;
  }
}

/* ---------- edit mode ---------- */

function markAll(on) {
  for (const [target, nodes] of marks) for (const n of nodes) {
    if (on) {
      n.setAttribute("data-edit-target", target);
      if (n.tabIndex < 0 && !n.hasAttribute("tabindex")) { n.tabIndex = 0; added.add(n); }
    } else {
      n.removeAttribute("data-edit-target");
      if (added.has(n)) { n.removeAttribute("tabindex"); added.delete(n); }
    }
  }
}

async function load() {
  const page = document.body.dataset.page;
  const r = await call(`/api/staff/edit/source?page=${encodeURIComponent(page)}`).catch(() => ({ status: 0, body: {} }));
  if (r.status !== 200) return r.status;
  entries = new Map(r.body.entries.map((e) => [e.target, e]));
  place();
  return 200;
}

async function enter() {
  if (!entries) {
    ui.toggle.disabled = true;
    const got = await load();
    ui.toggle.disabled = false;
    if (got !== 200) { say(got === 401 ? t("edit.error.signedOut") : t("edit.error.failed")); return; }
  }
  editing = true;
  document.documentElement.classList.add("is-editing");
  markAll(true);
  drawBar();
  say(t("edit.hint"));
}

function leave() {
  editing = false;
  document.documentElement.classList.remove("is-editing");
  markAll(false);
  ui.more.hidden = true;
  drawBar();
  ui.toggle.focus();
}

/* A click on marked words, or Enter or Space on them — or on the link or button they sit in —
   opens the box instead of doing what the page would. */
function pick(e) {
  if (!editing || e.target.closest?.("[data-edit-ui]")) return;
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  const inside = e.type === "keydown" && e.target.matches?.("a, button, summary") ? e.target.querySelector("[data-edit-target]") : null;
  const node = e.target.closest?.("[data-edit-target]") || inside;
  if (!node) return;
  e.preventDefault();
  e.stopPropagation();
  open(entries.get(node.getAttribute("data-edit-target")), node);
}

/* ---------- the box ---------- */

function open(entry, from) {
  if (!entry) return;
  opened = { entry, from };
  const d = ui.dialog;
  d.where.textContent = entry.where || "";
  d.where.hidden = !entry.where;
  d.value.value = entry.current;
  d.original.textContent = t("edit.original", { words: entry.original });
  d.by.textContent = entry.by ? t("edit.lastBy", { name: entry.by, when: new Date(entry.at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) }) : "";
  d.by.hidden = !entry.by;
  d.revert.hidden = entry.current === entry.original;
  d.status.textContent = entry.waiting ? t("edit.waitingNote") : "";
  d.box.showModal();
  d.value.focus();
}

async function save(value) {
  const { entry } = opened;
  const d = ui.dialog;
  d.save.disabled = d.revert.disabled = true;
  d.status.textContent = t("edit.saving");
  const r = await call("/api/staff/edit/save", { target: entry.target, expected: entry.current, value }).catch(() => ({ status: 0, body: {} }));
  d.save.disabled = d.revert.disabled = false;
  if (r.status === 200 && r.body.ok) {
    const next = r.body.entry || { ...entry, current: value.trim() };
    entries.set(entry.target, next);
    for (const n of marks.get(entry.target) || []) show(n, next.current);
    me.waiting = r.body.waiting;
    d.box.close();
    drawBar();
    say(next.waiting ? t("edit.savedWaiting") : t("edit.saved"));
    return;
  }
  if (r.status === 409 && typeof r.body.current === "string") {
    entries.set(entry.target, { ...entry, current: r.body.current });
    opened.entry = entries.get(entry.target);
    d.value.value = r.body.current;
    d.status.textContent = t("edit.conflict");
    return;
  }
  if (r.status === 401) { d.status.textContent = t("edit.error.signedOut"); return; }
  const why = String(r.body.error || "").split(".")[1] || "";
  d.status.textContent = (why && t(`edit.error.${why}`)) || t("edit.error.failed");
}

/* ---------- more words ---------- */

function moreList() {
  const filter = norm(ui.find.value).toLowerCase();
  const here = [], everywhere = [];
  for (const e of entries.values()) {
    if (kindOf(e.target) !== "text" && marks.has(e.target)) continue;
    if (filter && !`${e.current} ${e.where || ""}`.toLowerCase().includes(filter)) continue;
    (kindOf(e.target) === "page" ? here : everywhere).push(e);
  }
  const item = (e) => {
    const b = el("button", { type: "button", className: "edit-pick" }, el("span", { textContent: short(e.current) }), e.where ? el("span", { className: "edit-pick-where", textContent: e.where }) : null);
    b.addEventListener("click", () => open(e, b));
    return el("li", {}, b);
  };
  const group = (id, title, list) => (list.length ? [el("h3", { id, textContent: title }), el("ul", {}, ...list.map(item))] : []);
  ui.moreList.replaceChildren(
    ...group("edit-more-here", t("edit.more.here"), here),
    ...group("edit-more-site", t("edit.more.site"), everywhere),
    ...(here.length || everywhere.length ? [] : [el("p", { textContent: t("edit.more.none") })]));
}

/* ---------- the bar ---------- */

let liveLine;
function say(words) {
  liveLine.textContent = "";
  requestAnimationFrame(() => { liveLine.textContent = words; });
}

function drawBar() {
  ui.toggle.textContent = editing ? t("edit.done") : me.waiting ? t("edit.buttonWaiting", { n: me.waiting }) : t("edit.button");
  ui.toggle.setAttribute("aria-pressed", String(editing));
  ui.moreButton.hidden = !editing;
  ui.moreButton.setAttribute("aria-expanded", String(!ui.more.hidden));
}

function build() {
  liveLine = el("p", { className: "edit-live" });
  liveLine.setAttribute("role", "status");
  const toggle = el("button", { type: "button", className: "btn edit-toggle" });
  toggle.addEventListener("click", () => (editing ? leave() : enter()));
  const more = el("div", { className: "edit-more", id: "edit-more", hidden: true });
  const moreButton = el("button", { type: "button", className: "btn btn--quiet edit-more-button", textContent: t("edit.more"), hidden: true });
  moreButton.setAttribute("aria-controls", "edit-more");
  const find = el("input", { type: "search", id: "edit-find", className: "edit-find" });
  const moreList_ = el("div", { className: "edit-more-list" });
  const close = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.close") });
  more.append(el("h2", { textContent: t("edit.more.title") }), el("label", { htmlFor: "edit-find", textContent: t("edit.more.find") }), find, moreList_, close);
  moreButton.addEventListener("click", () => {
    more.hidden = !more.hidden;
    if (!more.hidden) { moreList(); find.focus(); }
    drawBar();
  });
  close.addEventListener("click", () => { more.hidden = true; drawBar(); moreButton.focus(); });
  find.addEventListener("input", moreList);

  const bar = el("div", { className: "edit-bar" }, liveLine, moreButton, toggle);
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", t("edit.region"));

  const box = el("dialog", { className: "edit-dialog" });
  box.setAttribute("aria-labelledby", "edit-d-h");
  const where = el("p", { className: "edit-where" });
  const value = el("textarea", { id: "edit-d-v", rows: 4, maxLength: 2000 });
  const original = el("p", { className: "edit-original" });
  const by = el("p", { className: "edit-by" });
  const status = el("p", { className: "edit-status" });
  status.setAttribute("role", "status");
  const saveB = el("button", { type: "submit", className: "btn", textContent: t("edit.save") });
  const revert = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.revert") });
  const cancel = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.cancel") });
  const form = el("form", { className: "edit-form" },
    el("h2", { id: "edit-d-h", textContent: t("edit.dialog.title") }), where,
    el("label", { htmlFor: "edit-d-v", textContent: t("edit.dialog.label") }), value, original, by, status,
    el("div", { className: "edit-actions" }, saveB, revert, cancel));
  form.addEventListener("submit", (e) => { e.preventDefault(); save(value.value); });
  revert.addEventListener("click", () => save(opened.entry.original));
  cancel.addEventListener("click", () => box.close());
  box.addEventListener("close", () => { if (opened?.from?.isConnected) opened.from.focus(); });
  box.append(form);

  const root = el("div", { className: "edit-ui" }, more, bar, box);
  root.setAttribute("data-edit-ui", "");
  document.body.append(root);
  ui = { toggle, more, moreButton, moreList: moreList_, find, dialog: { box, where, value, original, by, status, save: saveB, revert } };
  drawBar();
}

async function start() {
  const r = await call("/api/staff/me").catch(() => ({ status: 0, body: {} }));
  // A session that ended elsewhere: drop the hint so the next page does not ask again.
  if (r.status === 401) document.cookie = `bss_staff_hint=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (r.status !== 200 || !r.body.canEdit) return;
  me = r.body;
  table = me.text || {};
  build();
  document.addEventListener("click", pick, true);
  document.addEventListener("keydown", pick, true);
}

start();
