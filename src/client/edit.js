/* The edit button, for staff whose Connect role includes site.edit (netlify/lib/staff.mjs). site.js
 * loads this file only on a browser where someone has signed in; it asks the server who that is
 * and draws nothing for anyone else. Its words come from that answer too, so a visitor's page
 * carries none of them.
 *
 * Edit text marks every word on the page that can be changed. Choosing one opens a box with the
 * words, their permanent key, what the site shipped with, who changed them last, and under Earlier
 * versions every version saved, each of which Restore saves again as the newest. Saving keeps the
 * change and publishes it (netlify/lib/edits.mjs, published.mjs): the pages are drawn with it, every
 * cache in under 30 minutes, the page it is on at once.
 * Words not on the screen right now — a line shown only when something goes wrong, a label read
 * aloud — are under More words, as are the lines every page shares; its search finds keys too.
 * So are the values that are not words (a link, a photo from the library, a layout choice, a number,
 * a section switched on or off, its dates), each opened with a control of its kind; the server checks
 * each again (src/shared/edits.mjs, valueProblem).
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
let historyAsked = 0;         // the newest ask for Earlier versions; an older answer is dropped

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
      if (kindOf(e.target) !== kind || e.kind) continue;
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
    if (got === 401) { say(t("edit.error.ended"), " ", signInAgain(false)); return; }
    if (got !== 200) { say(t("edit.error.failed")); return; }
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

const when = (at) => new Date(at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });

/* The control for an entry: the words' box, or one that fits a value of its kind. Same id, so the label
   and the form read it the same way. */
function control(entry) {
  const id = "edit-d-v";
  const k = entry.kind;
  if (!k) return el("textarea", { id, rows: 4, maxLength: 2000 });
  if (k === "choice" || k === "icon" || k === "boolean") {
    const options = k === "boolean" ? [["true", t("edit.on")], ["false", t("edit.off")]] : (entry.options || [entry.current]).map((o) => [o, o]);
    return el("select", { id }, ...options.map(([v, label]) => el("option", { value: v, textContent: label })));
  }
  if (k === "date") return el("input", { id, type: "date" });
  if (k === "number") return el("input", { id, type: "number", min: 0, max: 99, step: 1 });
  return el("input", { id, type: "text", inputMode: k === "link" ? "url" : "text", maxLength: 500, spellcheck: false });
}

function open(entry, from) {
  if (!entry) return;
  opened = { entry, from };
  const d = ui.dialog;
  const fresh = control(entry);
  d.value.replaceWith(fresh);
  d.value = fresh;
  d.where.textContent = entry.where || "";
  d.where.hidden = !entry.where;
  d.key.replaceChildren(`${t("edit.key")} `, el("code", { textContent: entry.target }));
  d.value.value = entry.current;
  d.original.textContent = t("edit.original", { words: entry.original });
  d.by.textContent = entry.by ? t("edit.lastBy", { name: entry.by, when: when(entry.at) }) : "";
  d.by.hidden = !entry.by;
  d.revert.hidden = entry.current === entry.original;
  d.status.textContent = entry.waiting ? t("edit.waitingNote") : "";
  d.save.disabled = d.revert.disabled = false;
  historyAsked++;
  d.history.open = false;
  d.versions.replaceChildren();
  d.box.showModal();
  d.value.focus();
}

/* Other words saved here before, newest first (netlify/lib/edits.mjs, editHistory), asked for when
   Earlier versions is opened. The words in the box are not listed again, and words saved more than
   once are listed once, at their newest. Restore saves one again through save(), so it passes the
   same checks as typing it and becomes the newest. An answer for words the box has moved on from,
   or to an ask that a newer one replaced, is dropped. */
async function versions() {
  const d = ui.dialog;
  if (!opened || !d.history.open) return;
  const mine = opened;
  const ask = ++historyAsked;
  d.versions.replaceChildren(el("p", { className: "edit-by", textContent: t("edit.history.loading") }));
  const r = await call(`/api/staff/edit/history?target=${encodeURIComponent(mine.entry.target)}`).catch(() => ({ status: 0, body: {} }));
  if (ask !== historyAsked || opened !== mine || !d.box.open) return;
  if (r.status === 401) { d.versions.replaceChildren(el("p", {}, t("edit.error.ended"), " ", signInAgain(true))); return; }
  if (r.status !== 200 || !Array.isArray(r.body.versions)) { d.versions.replaceChildren(el("p", { textContent: t("edit.history.failed") })); return; }
  const seen = new Set([mine.entry.current]);
  const list = r.body.versions.filter((v) => !seen.has(v.value) && seen.add(v.value));
  if (!list.length) { d.versions.replaceChildren(el("p", { className: "edit-by", textContent: t("edit.history.none") })); return; }
  d.versions.replaceChildren(el("ol", { className: "edit-versions" }, ...list.map((v, i) => {
    const words = el("p", { id: `edit-v-${i}`, className: "edit-version-words", textContent: v.value });
    const by = el("p", { className: "edit-by", textContent: t("edit.history.by", { name: v.by, when: when(v.at) }) });
    const restore = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.restore") });
    restore.setAttribute("aria-describedby", words.id);
    restore.addEventListener("click", () => save(v.value));
    return el("li", {}, words, by, restore);
  })));
}

/* The box can be closed, and other words opened in it, while a save is still going. Its answer then
   changes the words on the page and says how it went on the bar, but leaves the box to the words
   now in it: it neither closes it nor writes into it. */
async function save(value) {
  const mine = opened;
  const { entry } = mine;
  const d = ui.dialog;
  d.save.disabled = d.revert.disabled = true;
  d.status.textContent = t("edit.saving");
  const r = await call("/api/staff/edit/save", { target: entry.target, expected: entry.current, value }).catch(() => ({ status: 0, body: {} }));
  const here = opened === mine && d.box.open;
  if (here) d.save.disabled = d.revert.disabled = false;
  if (r.status === 200 && r.body.ok) {
    const next = r.body.entry || { ...entry, current: value.trim() };
    entries.set(entry.target, next);
    for (const n of marks.get(entry.target) || []) show(n, next.current);
    me.waiting = r.body.waiting;
    if (here) d.box.close();
    drawBar();
    say(next.waiting ? t("edit.savedWaiting") : t("edit.saved"));
    return;
  }
  if (r.status === 409 && typeof r.body.current === "string") entries.set(entry.target, { ...entry, current: r.body.current });
  if (!here) {
    if (r.status === 401) say(t("edit.error.ended"), " ", signInAgain(false));
    else say(t("edit.error.failed"));
    return;
  }
  if (r.status === 409 && typeof r.body.current === "string") {
    opened.entry = entries.get(entry.target);
    d.value.value = r.body.current;
    d.status.textContent = t("edit.conflict");
    versions();
    return;
  }
  if (r.status === 401) { d.status.replaceChildren(t("edit.error.signedOut"), " ", signInAgain(true)); return; }
  const why = String(r.body.error || "").split(".")[1] || "";
  d.status.textContent = (why && t(`edit.error.${why}`)) || t("edit.error.failed");
}

/* ---------- more words ---------- */

function moreList() {
  const filter = norm(ui.find.value).toLowerCase();
  const here = [], everywhere = [];
  for (const e of entries.values()) {
    if (kindOf(e.target) !== "text" && marks.has(e.target)) continue;
    if (filter && !`${e.current} ${e.where || ""} ${e.target}`.toLowerCase().includes(filter)) continue;
    (kindOf(e.target) === "page" ? here : everywhere).push(e);
  }
  const item = (e) => {
    // a value that is not a word is named by its key, which says where it sits
    const where = e.where || (e.kind ? e.target : "");
    const b = el("button", { type: "button", className: "edit-pick" }, el("span", { textContent: short(e.current) }), where ? el("span", { className: "edit-pick-where", textContent: where }) : null);
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
function say(...words) {
  liveLine.textContent = "";
  requestAnimationFrame(() => { liveLine.replaceChildren(...words); });
}

/* Sign in again, coming back to this page (held to netlify/lib/staff.mjs, returnPath). From the box
   it opens a new tab, so the words typed there are still there to save. */
function signInAgain(newTab) {
  const path = /^\/(?!\/)[A-Za-z0-9\-._~/]*$/.test(location.pathname) && location.pathname.length <= 200 ? location.pathname : "/staff/";
  return el("a", { href: `/api/auth/start?return=${encodeURIComponent(path)}`, textContent: t("edit.signInAgain"), ...(newTab ? { target: "_blank", rel: "noopener" } : {}) });
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
  const key = el("p", { className: "edit-key" });
  const value = control({});
  const original = el("p", { className: "edit-original" });
  const by = el("p", { className: "edit-by" });
  const status = el("p", { className: "edit-status" });
  status.setAttribute("role", "status");
  const saveB = el("button", { type: "submit", className: "btn", textContent: t("edit.save") });
  const revert = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.revert") });
  const cancel = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.cancel") });
  const versionList = el("div", { className: "edit-versions-list" });
  const earlier = el("details", { className: "edit-history" }, el("summary", { textContent: t("edit.history.title") }), versionList);
  earlier.addEventListener("toggle", versions);
  const form = el("form", { className: "edit-form" },
    el("h2", { id: "edit-d-h", textContent: t("edit.dialog.title") }), where, key,
    el("label", { htmlFor: "edit-d-v", textContent: t("edit.dialog.label") }), value, original, by, status,
    el("div", { className: "edit-actions" }, saveB, revert, cancel), earlier);
  form.addEventListener("submit", (e) => { e.preventDefault(); save(ui.dialog.value.value); });
  revert.addEventListener("click", () => save(opened.entry.original));
  cancel.addEventListener("click", () => box.close());
  box.addEventListener("close", () => { if (opened?.from?.isConnected) opened.from.focus(); });
  box.append(form);

  const root = el("div", { className: "edit-ui" }, more, bar, box);
  root.setAttribute("data-edit-ui", "");
  document.body.append(root);
  ui = { toggle, more, moreButton, moreList: moreList_, find, dialog: { box, where, key, value, original, by, status, save: saveB, revert, history: earlier, versions: versionList } };
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
