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
 * A library photo is found by its picture in its own block, and is outlined and opened like words.
 * A value is named by what it is and the section it sits in (nameOf), never by its key alone. The box
 * for words inside a link offers the link's address, and lists the section's other values.
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
const blockEl = (target) => (blockOf(target) ? document.querySelector(`[data-block="${blockOf(target)}"]`) : null);

/* The section a target sits in, by the section's own heading as the page shows it now. */
function sectionOf(target) {
  if (kindOf(target) === "site") return t("edit.value.site");
  const s = blockEl(target);
  const by = s?.getAttribute("aria-labelledby");
  const name = norm((by && document.getElementById(by)?.textContent) || s?.getAttribute("aria-label") || "");
  return name ? `“${short(name)}”` : t("edit.value.page");
}

/* A value that is not words, named by its field (an entry of a list by the list's) and its section. */
const FIELD = { media: "photo", photos: "photo" };
function nameOf(entry) {
  if (!entry.kind) return entry.where || "";
  const path = entry.target.split("/");
  const last = /^\d+$/.test(path.at(-1)) ? path.at(-2) : path.at(-1);
  const field = FIELD[last] || last;
  const what = table[`edit.field.${field}`] ? t(`edit.field.${field}`) : t("edit.field.other");
  return t("edit.value.where", { what, section: sectionOf(entry.target) });
}

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
  // A library photo: its picture in its own block, one each, in order, for a photo shown twice.
  for (const e of entries.values()) {
    if (e.kind !== "media") continue;
    const s = blockEl(e.target);
    const img = s && [...s.querySelectorAll(`picture.media-${CSS.escape(e.current)} img`)].find((n) => !claimed.has(n));
    if (!img) continue;
    claimed.add(img);
    marks.set(e.target, [img]);
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

/* Words name themselves; a photo is given its name while outlined, and its own back after. */
const named = new Map();      // element -> the aria-label it had, or null
function markAll(on) {
  for (const [target, nodes] of marks) for (const n of nodes) {
    if (on) {
      n.setAttribute("data-edit-target", target);
      if (n.tabIndex < 0 && !n.hasAttribute("tabindex")) { n.tabIndex = 0; added.add(n); }
      if (entries.get(target)?.kind && !named.has(n)) { named.set(n, n.getAttribute("aria-label")); n.setAttribute("aria-label", nameOf(entries.get(target))); }
    } else {
      n.removeAttribute("data-edit-target");
      if (added.has(n)) { n.removeAttribute("tabindex"); added.delete(n); }
      if (named.has(n)) { const was = named.get(n); if (was == null) n.removeAttribute("aria-label"); else n.setAttribute("aria-label", was); named.delete(n); }
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
  notesOff();
  drawBar();
  ui.toggle.focus();
}

/* A click on marked words, or Enter or Space on them — or on the link or button they sit in —
   opens the box instead of doing what the page would. While Notes mode is on, clicks are the
   notes' (noteClick, below), and this stands aside. */
function pick(e) {
  if (!editing || notesOn || e.target.closest?.("[data-edit-ui]")) return;
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

/* The address of the link the chosen words are, or sit in: a link value of the same block whose
   address is the one the link has on the page. */
function linkOf(entry, from) {
  const a = !entry.kind && from?.closest?.("a[href]");
  if (!a) return null;
  return [...entries.values()].find((e) => e.kind === "link" && e.current === a.getAttribute("href") && kindOf(e.target) === kindOf(entry.target) && fits(e.target, a)) || null;
}

/* The values of the section an entry is in, other than the entry itself. */
function sectionValues(entry) {
  if (kindOf(entry.target) === "text") return [];
  return [...entries.values()].filter((e) => e.kind && e.target !== entry.target && kindOf(e.target) === kindOf(entry.target) && blockOf(e.target) === blockOf(entry.target));
}

function pickButton(e, from) {
  const where = e.kind ? nameOf(e) : e.where || "";
  const b = el("button", { type: "button", className: "edit-pick" }, el("span", { textContent: short(e.current) }), where ? el("span", { className: "edit-pick-where", textContent: where }) : null);
  b.addEventListener("click", () => open(e, from || b));
  return b;
}

function open(entry, from) {
  if (!entry) return;
  opened = { entry, from };
  const d = ui.dialog;
  const fresh = control(entry);
  d.value.replaceWith(fresh);
  d.value = fresh;
  const where = nameOf(entry);
  d.where.textContent = where;
  d.where.hidden = !where;
  d.linkTo = linkOf(entry, from);
  d.link.hidden = !d.linkTo;
  const others = sectionValues(entry);
  d.section.hidden = !others.length;
  d.section.open = false;
  d.sectionTitle.textContent = t("edit.section.title", { n: others.length });
  d.sectionList.replaceChildren(el("ul", {}, ...others.map((e) => el("li", {}, pickButton(e, from)))));
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
  if (!d.box.open) d.box.showModal();
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
    if (filter && !`${e.current} ${e.kind ? nameOf(e) : e.where || ""} ${e.target}`.toLowerCase().includes(filter)) continue;
    (kindOf(e.target) === "page" ? here : everywhere).push(e);
  }
  const item = (e) => el("li", {}, pickButton(e));
  const group = (id, title, list) => (list.length ? [el("h3", { id, textContent: title }), el("ul", {}, ...list.map(item))] : []);
  ui.moreList.replaceChildren(
    ...group("edit-more-here", t("edit.more.here"), here),
    ...group("edit-more-site", t("edit.more.site"), everywhere),
    ...(here.length || everywhere.length ? [] : [el("p", { textContent: t("edit.more.none") })]));
}

/* The pencil the render side draws (src/render/icons.mjs), built here as nodes: the edit
   button is a circle carrying this alone, as Connect's is (owner, 13 Nov 2026). */
function pencil() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "ic");
  svg.setAttribute("data-i", "pencil");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of ["M15.5 4.5l4 4L9 19l-5 1 1-5z", "M13.5 6.5l4 4"]) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

/* The copy icon the render side draws (src/render/icons.mjs), built here as nodes, the way
   pencil() above is: two overlapping pages. */
function copyIcon() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "ic");
  svg.setAttribute("data-i", "copy");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const rect = document.createElementNS(NS, "rect");
  for (const [k, v] of Object.entries({ x: "9", y: "9", width: "11.5", height: "11.5", rx: "1.5" })) rect.setAttribute(k, v);
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", "M15.5 9V5.5a1 1 0 0 0-1-1h-10a1 1 0 0 0 1 1v10a1 1 0 0 0 1 1H9");
  svg.append(rect, p);
  return svg;
}

/* ---------- notes mode ---------- */

/* Notes mode is a mode of this edit tool, nothing more: while it is on, a click anywhere pins a
 * note to what was clicked, and the notes live server-side (netlify/lib/notes.mjs) where every
 * editor sees them. They are never part of a page: the pin layer is this tool's own, drawn only
 * for someone who may edit, and leaving edit mode turns the mode off. A note carries a
 * fingerprint of what it was pinned to; when the editor comes back and that fingerprint no
 * longer matches, the note is marked cleared — it leaves the page and the copied list, and is
 * counted here until the list is opened or the notes are copied. It is not deleted. A note whose
 * pinned words are not on the page any more is not cleared: nothing about a missing element
 * proves the fix was made, so it waits in the list to be removed by hand. */

let notesOn = false;
let notesDoc = null;          // { version, notes } as the server last answered, or null
let clearedUnseen = 0;        // notes this visit's checks have cleared, not yet seen in the list or a copy
let noteOpened = null;        // { note } for a saved note, { draft, pin } for one not yet saved
let pinLayer = null;

const here = () => location.pathname;
const openNotes = () => (notesDoc ? notesDoc.notes.filter((n) => n.state === "open") : []);

/* A note's number: open notes grouped by page, pages in the order they were first noted, notes
   in the order they were made, numbered through — the order Copy notes prints, so a pin's
   number is its number in the copied list. */
function noteNumbers(list = openNotes()) {
  const pages = [];
  for (const n of list) if (!pages.includes(n.page.route)) pages.push(n.page.route);
  const map = new Map();
  let i = 0;
  for (const route of pages) for (const n of list.filter((x) => x.page.route === route)) map.set(n.id, ++i);
  return map;
}

/* The elements a note could be pinned to on this page: its edit target's marked elements first,
   then whatever its selector finds. */
function candidatesOf(note) {
  const out = [];
  if (note.anchor.kind === "edit-target" && marks.has(note.anchor.id)) out.push(...marks.get(note.anchor.id).filter((n) => n.isConnected));
  if (note.selector) {
    try { const n = document.querySelector(note.selector); if (n && !out.includes(n)) out.push(n); } catch { /* a selector the page no longer matches is no candidate */ }
  }
  return out;
}

const resolveAnchor = (note) => candidatesOf(note)[0] || null;

/* Open notes that belong to this page but are not on it any more. */
const missingHere = () => openNotes().filter((n) => n.page.route === here() && !candidatesOf(n).length);

/* The way back to an element: a path of tags and classes from the nearest ancestor with an id,
   with a position among its same-tag siblings where the tag alone is not enough. */
function selectorOf(elm) {
  const parts = [];
  let n = elm;
  while (n && n !== document.body && parts.length < 8) {
    if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
    let seg = n.tagName.toLowerCase();
    const cls = [...n.classList].filter((c) => !c.startsWith("note-")).slice(0, 2);
    if (cls.length) seg += `.${cls.map((c) => CSS.escape(c)).join(".")}`;
    const parent = n.parentElement;
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === n.tagName);
      if (same.length > 1) seg += `:nth-of-type(${same.indexOf(n) + 1})`;
    }
    parts.unshift(seg);
    n = parent;
  }
  return parts.join(" > ");
}

/* What a note is pinned to, in words: its text; every link destination in it, in order; every
   photo's source and alt text, in order; and its own styling — its class and inline style, and
   the computed style a stylesheet change would move. A fix that changes only the styling, a
 * link's destination or a photo therefore changes the fingerprint, as one that changes the
   words does. Without a digest to take (no crypto.subtle), the fingerprint is empty and the
   note is never cleared by a check: a note is not cleared on a guess. */
const FP_STYLES = ["color", "background-color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-decoration-line", "text-align", "display", "visibility", "opacity",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left"];
async function fingerprintOf(elm) {
  if (!crypto?.subtle) return "";
  const links = [...(elm.matches?.("a[href]") ? [elm] : []), ...elm.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") || "");
  const imgs = [...(elm.matches?.("img") ? [elm] : []), ...elm.querySelectorAll("img")].map((i) => `${i.getAttribute("src") || ""}|${i.getAttribute("alt") || ""}`);
  const cs = getComputedStyle(elm);
  const parts = [
    `text:${norm(elm.textContent || "")}`,
    `href:${links.join("\n")}`,
    `img:${imgs.join("\n")}`,
    `class:${elm.getAttribute("class") || ""}`,
    `style:${elm.getAttribute("style") || ""}`,
    `computed:${FP_STYLES.map((p) => cs.getPropertyValue(p)).join("|")}`,
  ].join("\n");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function loadNotes() {
  const r = await call("/api/staff/notes").catch(() => ({ status: 0, body: {} }));
  if (r.status === 401) { say(t("edit.error.ended"), " ", signInAgain(false)); return false; }
  if (r.status !== 200 || !r.body.ok) { say(t("edit.error.failed")); return false; }
  notesDoc = { version: r.body.version, notes: r.body.notes };
  return true;
}

/* A write the server refused as stale is retried once against the document as it now stands;
   the second refusal is the editor's to see. Returns the call's answer. */
async function notesWrite(url, body) {
  let r = await call(url, { ...body, version: notesDoc.version }).catch(() => ({ status: 0, body: {} }));
  if (r.status === 409 && await loadNotes()) r = await call(url, { ...body, version: notesDoc.version }).catch(() => ({ status: 0, body: {} }));
  if (r.status === 200 && r.body.ok) notesDoc = { version: r.body.version, notes: r.body.notes };
  return r;
}

/* On entering the mode: every open note on this page is checked against what it was pinned to.
   One whose fingerprint no longer matches is marked cleared on the server; one whose element is
   gone is left open, for the list. */
async function checkNotes() {
  const ids = openNotes().filter((n) => n.page.route === here()).map((n) => n.id);
  for (const id of ids) {
    const note = notesDoc.notes.find((n) => n.id === id && n.state === "open");
    if (!note || !note.fingerprint) continue;
    const cands = candidatesOf(note);
    if (!cands.length) continue;
    let same = false;
    for (const c of cands) { if (await fingerprintOf(c) === note.fingerprint) { same = true; break; } }
    if (same) continue;
    const r = await notesWrite("/api/staff/notes/save", { id: note.id, state: "cleared" });
    if (r.status === 200) clearedUnseen++;
  }
}

async function toggleNotes() {
  if (notesOn) { notesOff(); drawBar(); return; }
  if (!await loadNotes()) return;
  notesOn = true;
  drawPins();
  drawBar();
  await checkNotes();
  drawPins();
  drawBar();
}

function notesOff() {
  notesOn = false;
  if (pinLayer) pinLayer.replaceChildren();
  if (ui) { ui.noteList.hidden = true; if (ui.noteDialog.box.open) ui.noteDialog.box.close(); }
}

/* ---------- pins ---------- */

function placePin(pin, elm, pos) {
  const r = elm.getBoundingClientRect();
  pin.style.left = `${window.scrollX + r.left + pos.dx * r.width}px`;
  pin.style.top = `${window.scrollY + r.top + pos.dy * r.height}px`;
}

/* Two pins pinned near each other land on top of one another: a pin is a 28px disc seated where
   its click fell, and nothing in the stored position keeps two discs apart. After every
   placement this walks the page's pins in reading order and moves any pin that would touch an
   earlier one straight down, a step at a time, until it is clear — or up, when the foot of the
   window is in the way. Only the drawing moves: the stored position still names the same point
   of the same element, the number still matches the list, and the pin still opens its own note.
   The same pass SPILL's editor runs (its 26px disc steps 30; this 28px disc steps 32). */
const PIN_STEP = 32;   // a disc's 28px plus a 4px gap
function separatePins() {
  if (!pinLayer) return;
  const pins = [...pinLayer.querySelectorAll(".note-pin")];
  pins.sort((a, b) => (parseFloat(a.style.top) - parseFloat(b.style.top)) || (parseFloat(a.style.left) - parseFloat(b.style.left)));
  const placed = [];
  for (const pin of pins) {
    const x = parseFloat(pin.style.left);
    let y = parseFloat(pin.style.top);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const touches = (cy) => placed.some((p) => Math.abs(p.x - x) < PIN_STEP && Math.abs(p.y - cy) < PIN_STEP);
    if (touches(y)) {
      let moved = y;
      for (let i = 0; i < 8 && touches(moved); i++) moved += PIN_STEP;
      if (touches(moved) || moved + 14 > window.scrollY + window.innerHeight) {
        moved = y;
        for (let i = 0; i < 8 && touches(moved); i++) moved -= PIN_STEP;
        moved = Math.max(window.scrollY + 14, moved);
      }
      pin.style.top = `${moved}px`;
      y = moved;
    }
    placed.push({ x, y });
  }
}

function drawPins() {
  if (!pinLayer) return;
  pinLayer.replaceChildren();
  if (!notesOn || !notesDoc) return;
  const numbers = noteNumbers();
  for (const note of openNotes().filter((n) => n.page.route === here())) {
    const elm = resolveAnchor(note);
    if (!elm) continue;
    const pin = el("button", { type: "button", className: "note-pin", textContent: String(numbers.get(note.id) || "") });
    pin.setAttribute("aria-label", t("edit.notes.title", { n: numbers.get(note.id) || "" }));
    pin.dataset.noteId = note.id;
    pin.style.zIndex = String(numbers.get(note.id) || "");
    pin.addEventListener("click", (e) => { e.stopPropagation(); openNote({ note }, pin); });
    pinLayer.append(pin);
    placePin(pin, elm, note.pos);
  }
  separatePins();
}

/* Pins sit on their elements, so they are placed again whenever the page moves under them. */
function placePins() {
  if (!notesOn || !notesDoc || !pinLayer) return;
  for (const pin of [...pinLayer.children]) {
    if (!pin.dataset.noteId) continue;
    const note = notesDoc.notes.find((n) => n.id === pin.dataset.noteId);
    const elm = note && resolveAnchor(note);
    if (elm) placePin(pin, elm, note.pos);
  }
  separatePins();
}

/* A click while the mode is on pins a note where it fell, before the page or the word editor can
   take it. The Safety Exit is never taken: it leaves the page, notes or not. */
async function noteClick(e) {
  if (!notesOn || !editing || e.target.closest?.("[data-edit-ui]") || e.target.closest?.("[data-safety-exit]")) return;
  e.preventDefault();
  e.stopPropagation();
  const marked = e.target.closest?.("[data-edit-target]");
  const elm = marked || e.target;
  if (!(elm instanceof Element)) return;
  const r = elm.getBoundingClientRect();
  const pos = { dx: r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0, dy: r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0 };
  const draft = {
    page: { name: pageName(), route: here() },
    anchor: { kind: marked ? "edit-target" : "selector", id: marked ? marked.getAttribute("data-edit-target") : "", text: short(norm(elm.textContent || "")) },
    selector: selectorOf(elm),
    pos,
    fingerprint: await fingerprintOf(elm),
  };
  const pin = el("button", { type: "button", className: "note-pin", textContent: String(prospectiveNumber(draft)) });
  pin.style.zIndex = String(prospectiveNumber(draft));
  pinLayer.append(pin);
  placePin(pin, elm, pos);
  separatePins();
  openNote({ draft, pin }, pin);
}

/* The page's name for a note and the copied list: its title, without the site's name after it. */
function pageName() {
  const title = document.title.split("—")[0].trim();
  return title || here();
}

/* The number a note being made will carry, from the list as it will stand with it in. */
function prospectiveNumber(draft) {
  const ghost = { id: "draft", page: draft.page, state: "open" };
  return noteNumbers([...openNotes(), ghost]).get("draft") || "";
}

/* ---------- the note box ---------- */

function openNote(opening, from) {
  noteOpened = { ...opening, from };
  const d = ui.noteDialog;
  const note = opening.note;
  const numbers = noteNumbers();
  const n = note ? numbers.get(note.id) : prospectiveNumber(opening.draft);
  d.heading.textContent = t("edit.notes.title", { n: n || "" }).trim();
  d.value.setAttribute("aria-label", d.heading.textContent);
  d.where.textContent = `${t("edit.notes.on")} ${note ? note.anchor.text : opening.draft.anchor.text}`;
  d.value.value = note ? note.text : "";
  d.status.textContent = "";
  d.save.disabled = false;
  d.remove.hidden = !note;
  if (!d.box.open) d.box.showModal();
  d.value.focus();
}

async function saveNote() {
  const mine = noteOpened;
  if (!mine) return;
  const d = ui.noteDialog;
  const text = d.value.value.trim();
  if (!text) { d.status.textContent = t("edit.error.empty"); return; }
  d.save.disabled = true;
  d.status.textContent = t("edit.saving");
  const body = mine.draft
    ? { page: mine.draft.page, anchor: mine.draft.anchor, selector: mine.draft.selector, pos: mine.draft.pos, fingerprint: mine.draft.fingerprint, text }
    : { id: mine.note.id, text };
  const r = await notesWrite("/api/staff/notes/save", body);
  if (r.status === 200 && r.body.ok) {
    if (mine.pin) mine.pin.remove();
    noteOpened = null;
    d.box.close();
    drawPins();
    drawBar();
    return;
  }
  d.save.disabled = false;
  if (r.status === 401) { d.status.replaceChildren(t("edit.error.signedOut"), " ", signInAgain(true)); return; }
  d.status.textContent = t("edit.error.failed");
}

async function removeNote() {
  const mine = noteOpened;
  if (!mine?.note) return;
  const d = ui.noteDialog;
  d.save.disabled = true;
  const r = await notesWrite("/api/staff/notes/remove", { id: mine.note.id });
  if (r.status === 200 && r.body.ok) {
    noteOpened = null;
    d.box.close();
    drawPins();
    drawBar();
    return;
  }
  d.save.disabled = false;
  d.status.textContent = r.status === 401 ? t("edit.error.ended") : t("edit.error.failed");
}

/* ---------- the notes list and Copy notes ---------- */

function noteItem(note, n) {
  const label = n ? t("edit.notes.title", { n }) : short(note.anchor.text);
  const b = el("button", { type: "button", className: "edit-pick" },
    el("span", { textContent: label }),
    el("span", { className: "edit-pick-where", textContent: short(note.text) }));
  b.addEventListener("click", () => {
    ui.noteList.hidden = true;
    drawBar();
    const elm = note.page.route === here() ? resolveAnchor(note) : null;
    if (elm) elm.scrollIntoView({ block: "center" });
    openNote({ note }, b);
  });
  return b;
}

function notesList() {
  const numbers = noteNumbers();
  const missing = missingHere();
  const groups = [];
  const pages = [];
  for (const n of openNotes()) if (!pages.includes(n.page.route)) pages.push(n.page.route);
  for (const route of pages) {
    const list = openNotes().filter((n) => n.page.route === route && !missing.includes(n));
    if (list.length) groups.push([list[0].page.name, list.map((n) => noteItem(n, numbers.get(n.id)))]);
  }
  const cleared = notesDoc.notes.filter((n) => n.state === "cleared");
  if (cleared.length) groups.push([t("edit.notes.cleared", { n: cleared.length }), cleared.map((n) => noteItem(n, null))]);
  if (missing.length) groups.push([t("edit.notes.notOnPage"), missing.map((n) => noteItem(n, numbers.get(n.id)))]);
  ui.noteListGroups.replaceChildren(...groups.flatMap(([title, items]) => [el("h3", { textContent: title }), el("ul", { className: "edit-more-list" }, ...items.map((b) => el("li", {}, b)))]));
  ui.clearAll.textContent = t("edit.notes.clearAll");
  delete ui.clearAll.dataset.armed;
}

async function clearAllNotes() {
  const b = ui.clearAll;
  if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = t("edit.notes.clearAll.armed"); return; }
  const r = await notesWrite("/api/staff/notes/clear", { scope: "all" });
  if (r.status === 200 && r.body.ok) { clearedUnseen = 0; notesList(); drawPins(); drawBar(); }
}

/* What was pinned, in words an agent can act on without seeing the page. Off this page, or with
   the element gone, the words are the text itself. */
function positionOf(note) {
  const elm = note.page.route === here() ? resolveAnchor(note) : null;
  let what = "text";
  if (elm) {
    const tag = elm.tagName.toLowerCase();
    if (tag === "h1") what = "pageHeading";
    else if (/^h[2-6]$/.test(tag)) what = "heading";
    else if (tag === "a") what = "link";
    else if (tag === "button" || elm.getAttribute("role") === "button") what = "button";
    else if (tag === "img" || tag === "picture") what = "photo";
    else if (tag === "ul" || tag === "ol") what = "list";
    else if (tag === "p") what = "paragraph";
  }
  const v = note.pos.dy < 1 / 3 ? t("edit.notes.pos.upper") : note.pos.dy > 2 / 3 ? t("edit.notes.pos.lower") : "";
  const h = note.pos.dx < 1 / 3 ? t("edit.notes.pos.left") : note.pos.dx > 2 / 3 ? t("edit.notes.pos.right") : "";
  const where = [v, h].filter(Boolean).join(" ") || t("edit.notes.pos.centre");
  const WHAT = { pageHeading: () => t("edit.notes.what.pageHeading"), heading: () => t("edit.notes.what.heading"), link: () => t("edit.notes.what.link"), button: () => t("edit.notes.what.button"), photo: () => t("edit.notes.what.photo"), list: () => t("edit.notes.what.list"), paragraph: () => t("edit.notes.what.paragraph"), text: () => t("edit.notes.what.text") };
  return t("edit.notes.position", { what: WHAT[what](), where });
}

function copyText() {
  const numbers = noteNumbers();
  const open = openNotes();
  const lines = [
    t("edit.notes.copyHead", { n: open.length }),
    t("edit.notes.copiedBy", { when: when(new Date().toISOString()), name: me.name || "" }),
    t("edit.notes.copyIntro"),
    "",
  ];
  const pages = [];
  for (const n of open) if (!pages.includes(n.page.route)) pages.push(n.page.route);
  let first = true;
  for (const route of pages) {
    for (const note of open.filter((x) => x.page.route === route)) {
      if (!first) lines.push("");
      first = false;
      lines.push(t("edit.notes.pageLine", { n: numbers.get(note.id), name: note.page.name, url: `${location.origin}${note.page.route}` }));
      const missing = note.page.route === here() && !candidatesOf(note).length;
      if (missing) lines.push(t("edit.notes.notFound"));
      else if (note.anchor.kind === "edit-target") lines.push(t("edit.notes.whereLine", { snippet: `"${note.anchor.text}"`, kind: note.anchor.kind, id: note.anchor.id }));
      else lines.push(t("edit.notes.whereSelector", { snippet: `"${note.anchor.text}"`, selector: note.selector }));
      if (!missing) lines.push(t("edit.notes.positionLine", { position: positionOf(note) }));
      lines.push(t("edit.notes.noteLine", { text: note.text }));
    }
  }
  return lines.join("\n");
}

async function copyNotes() {
  const text = copyText();
  try { await navigator.clipboard.writeText(text); }
  catch {
    const area = el("textarea", { value: text });
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  clearedUnseen = 0;
  drawBar();
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
  /* The button's face is the pencil alone (owner, 13 Nov 2026): its words ride as its label and
     its tooltip instead, the same words in the same states as when they were printed on it. */
  const label = editing ? t("edit.done") : me.waiting ? t("edit.buttonWaiting", { n: me.waiting }) : t("edit.button");
  ui.toggle.title = label;
  ui.toggle.setAttribute("aria-label", label);
  ui.toggle.setAttribute("aria-pressed", String(editing));
  ui.moreButton.hidden = !editing;
  ui.moreButton.setAttribute("aria-expanded", String(!ui.more.hidden));
  const open = notesDoc ? notesDoc.notes.filter((n) => n.state === "open").length : 0;
  ui.notesPill.hidden = !editing;
  ui.notesPill.textContent = t("edit.notes", { n: open });
  ui.notesPill.setAttribute("aria-pressed", String(notesOn));
  ui.notesCopy.hidden = !(editing && notesOn);
  ui.notesListButton.hidden = !(editing && notesOn);
  ui.notesListButton.textContent = clearedUnseen > 0 ? t("edit.notes.cleared", { n: clearedUnseen }) : missingHere().length ? t("edit.notes.notOnPage") : t("edit.notes.list");
  ui.notesListButton.setAttribute("aria-expanded", String(!ui.noteList.hidden));
  ui.refresh.hidden = !(me.waiting > 0);
}

function build() {
  liveLine = el("p", { className: "edit-live" });
  liveLine.setAttribute("role", "status");
  const toggle = el("button", { type: "button", className: "edit-toggle" }, pencil());
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

  /* Notes mode's seats in the bar: the pill beside the pencil, and while the mode is on, Copy
     notes and the button that opens the list. The list is the More words panel's shape; the note
     box is the word box's. The pins live on the page itself, in a layer of this tool's own. */
  const notesPill = el("button", { type: "button", className: "btn btn--quiet edit-notes-pill", hidden: true });
  notesPill.addEventListener("click", toggleNotes);
  /* Copy notes is the icon alone wherever it sits (owner, 15 Nov 2026): its words ride as its
     label and its tooltip, the way the edit button's do. In the bar it shares the pill's line;
     in the list it shares the heading's. */
  const copyButton = (props = {}) => {
    const b = el("button", { type: "button", className: "btn btn--quiet edit-copy-notes", title: t("edit.notes.copy"), ...props }, copyIcon());
    b.setAttribute("aria-label", t("edit.notes.copy"));
    b.addEventListener("click", copyNotes);
    return b;
  };
  const notesCopy = copyButton({ hidden: true });
  const notesListButton = el("button", { type: "button", className: "btn btn--quiet", hidden: true });
  notesListButton.setAttribute("aria-controls", "edit-notes-list");
  const noteListGroups = el("div", {});
  const listCopy = copyButton();
  const clearAll = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.notes.clearAll") });
  clearAll.addEventListener("click", clearAllNotes);
  const listClose = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.close") });
  const noteList = el("div", { className: "edit-more edit-notes-list", id: "edit-notes-list", hidden: true },
    el("div", { className: "edit-notes-head" }, el("h2", { textContent: t("edit.notes.list") }), listCopy),
    noteListGroups, clearAll, listClose);
  notesListButton.addEventListener("click", () => {
    noteList.hidden = !noteList.hidden;
    if (!noteList.hidden) { notesList(); clearedUnseen = 0; }
    drawBar();
  });
  listClose.addEventListener("click", () => { noteList.hidden = true; drawBar(); notesListButton.focus(); });

  const noteBox = el("dialog", { className: "edit-dialog" });
  noteBox.setAttribute("aria-labelledby", "note-d-h");
  const noteHeading = el("h2", { id: "note-d-h" });
  const noteWhere = el("p", { className: "edit-where" });
  const noteValue = el("textarea", { id: "note-d-v", rows: 4, maxLength: 2000 });
  const noteStatus = el("p", { className: "edit-status" });
  noteStatus.setAttribute("role", "status");
  const noteSave = el("button", { type: "submit", className: "btn", textContent: t("edit.save") });
  const noteRemove = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.notes.remove") });
  const noteDone = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.notes.done") });
  const noteForm = el("form", { className: "edit-form" },
    noteHeading, noteWhere, noteValue, noteStatus,
    el("div", { className: "edit-actions" }, noteSave, noteRemove, noteDone));
  noteForm.addEventListener("submit", (e) => { e.preventDefault(); saveNote(); });
  noteRemove.addEventListener("click", removeNote);
  noteDone.addEventListener("click", () => noteBox.close());
  noteBox.addEventListener("close", () => {
    if (noteOpened?.pin) noteOpened.pin.remove();
    if (noteOpened?.from?.isConnected) noteOpened.from.focus();
    noteOpened = null;
  });
  noteBox.append(noteForm);

  pinLayer = el("div", { className: "note-pins" });
  pinLayer.setAttribute("data-edit-ui", "");
  document.body.append(pinLayer);
  window.addEventListener("scroll", placePins, { capture: true, passive: true });
  window.addEventListener("resize", placePins);

  /* Refresh Now, in the bar while saved changes wait: the save's own next step, instead of a
     trip to the staff page's Words view to find the same button. The server checks the scope
     again (netlify/lib/router.mjs, refresh). */
  const refresh = el("button", { type: "button", className: "btn btn--quiet edit-refresh", textContent: t("edit.refresh"), hidden: true });
  refresh.addEventListener("click", async () => {
    if (refresh.getAttribute("aria-busy") === "true") return;
    refresh.setAttribute("aria-busy", "true");
    const label = refresh.textContent;
    refresh.textContent = t("edit.refreshing");
    const r = await call("/api/staff/refresh", {}).catch(() => ({ status: 0, body: {} }));
    refresh.removeAttribute("aria-busy");
    refresh.textContent = label;
    if (r.status === 200) { me.waiting = 0; drawBar(); say(t("edit.refreshed")); return; }
    if (r.status === 429) { say(t("edit.refreshSoon")); return; }
    if (r.status === 401) { say(t("edit.error.ended"), " ", signInAgain(false)); return; }
    say(t("edit.error.failed"));
  });

  const bar = el("div", { className: "edit-bar" }, liveLine, moreButton, notesPill, notesCopy, notesListButton, refresh, toggle);
  /* The Safety Exit keeps the corner: the bar takes the pill in as its last seat, so the edit
     button rests at its left with their bottoms on one line and neither covers the other
     (owner, 13 Nov 2026). The pill's own words, link and destination are untouched, and the
     press site.js bound to the element itself moves with it. */
  const exit = document.querySelector("[data-safety-exit]");
  if (exit) bar.append(exit);
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
  const link = el("button", { type: "button", className: "btn btn--quiet", textContent: t("edit.link"), hidden: true });
  link.addEventListener("click", () => open(ui.dialog.linkTo, opened.from));
  const sectionTitle = el("summary");
  const sectionList = el("div", { className: "edit-section-list" });
  const section = el("details", { className: "edit-section", hidden: true }, sectionTitle, sectionList);
  const form = el("form", { className: "edit-form" },
    el("h2", { id: "edit-d-h", textContent: t("edit.dialog.title") }), where, key,
    el("label", { htmlFor: "edit-d-v", textContent: t("edit.dialog.label") }), value, original, by, status,
    el("div", { className: "edit-actions" }, saveB, revert, cancel), link, section, earlier);
  form.addEventListener("submit", (e) => { e.preventDefault(); save(ui.dialog.value.value); });
  revert.addEventListener("click", () => save(opened.entry.original));
  cancel.addEventListener("click", () => box.close());
  box.addEventListener("close", () => { if (opened?.from?.isConnected) opened.from.focus(); });
  box.append(form);

  const root = el("div", { className: "edit-ui" }, more, noteList, bar, box, noteBox);
  root.setAttribute("data-edit-ui", "");
  document.body.append(root);
  ui = { toggle, more, moreButton, moreList: moreList_, find, refresh, notesPill, notesCopy, notesListButton, noteList, noteListGroups, clearAll, noteDialog: { box: noteBox, heading: noteHeading, where: noteWhere, value: noteValue, status: noteStatus, save: noteSave, remove: noteRemove }, dialog: { box, where, key, value, original, by, status, save: saveB, revert, history: earlier, versions: versionList, link, linkTo: null, section, sectionTitle, sectionList } };
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
  document.addEventListener("click", noteClick, true);
}

start();
