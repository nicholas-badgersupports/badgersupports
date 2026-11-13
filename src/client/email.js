/* Email links, on every page (site.js loads this with it): pressing one never opens a mail
 * program uninvited. The address is copied, and a small popup says so and offers the two ways
 * on: copy it again, or open the mail program after all. The link keeps its mailto: href, so
 * without this file the link behaves as a plain email link. A press another control already
 * claimed, a changed press (a modifier key, a button other than the main one) and the popup's
 * own Open link are left to the browser. Left alone, the popup dismisses itself (the clock
 * below); it is never the only way out. */

import { t } from "./text.js";

/* The address a mailto: href carries: the part before any ?subject=…, decoded. Anything that
   is not a mailto: href gives "". */
export function emailAddress(href) {
  const m = /^mailto:([^?]*)/i.exec(String(href ?? ""));
  if (!m) return "";
  try { return decodeURIComponent(m[1]).trim(); } catch { return m[1].trim(); }
}

/* Copy, the clipboard API first and the long-standing textarea way behind it. False means
   neither worked, and the caller must not say the address was copied. The clipboard and the
   document are parameters so the suites can stand in for them. */
export async function copyText(text, { clipboard, doc } = {}) {
  const clip = clipboard ?? (typeof navigator !== "undefined" ? navigator.clipboard : undefined);
  if (clip && typeof clip.writeText === "function") {
    try { await clip.writeText(text); return true; } catch { /* the legacy way may still work */ }
  }
  const d = doc ?? (typeof document !== "undefined" ? document : undefined);
  if (!d || !d.body || typeof d.execCommand !== "function") return false;
  const area = d.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  d.body.append(area);
  try {
    area.select();
    return !!d.execCommand("copy");
  } catch { return false; } finally { area.remove(); }
}

/* The two actions are icons, not words (owner, 12 Nov 2026): the copy glyph and the envelope,
   drawn exactly as src/render/icons.mjs draws them (same parts, same wrapper), each button
   named by the words it replaced, as its label and its tooltip. */
const ICON_PARTS = {
  copy: [["rect", { x: "9", y: "9", width: "11.5", height: "11.5", rx: "1.5" }], ["path", { d: "M15.5 9V5.5a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1H9" }]],
  mail: [["rect", { x: "3.5", y: "6", width: "17", height: "12.5", rx: "1.2" }], ["path", { d: "m3.8 6.6 8.2 6.4 8.2-6.4" }]],
};
const SVG_NS = "http://www.w3.org/2000/svg";
function iconSvg(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ic");
  svg.setAttribute("data-i", name);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [tag, attrs] of ICON_PARTS[name]) {
    const part = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) part.setAttribute(k, v);
    svg.append(part);
  }
  return svg;
}

let pop = null, mark = null, noteText = null, addrLine = null, openLink = null;
let opener = null, address = "";

/* Self-dismiss (owner, 12 Nov 2026), on toast practice: left alone, the popup closes itself
   after six seconds — the toast standard is five, and this one carries an address to read and
   two actions. Hovering it, or keyboard focus on anything inside it, pauses the clock where
   it stands, as does a hidden tab; a press inside stops the clock for good, so the popup then
   closes only by ×, Escape, the backdrop, or scrolling its link out of sight — which closes
   it at once whatever state the clock is in. The timed close is a convenience, never the only
   way out: the instant closes stay, which is what WCAG 2.2.1 asks of a timed element. The
   clock's handlers install with the popup and guard on it being open, so pages where the
   popup never opens carry none of this. */
const AUTO_DISMISS_MS = 6000;
let clockTimer = 0, clockLeft = AUTO_DISMISS_MS, clockStarted = 0, clockEngaged = false;
const clockPauses = new Set();

function clockRun() {
  if (clockEngaged || !pop.open) return;
  clockStarted = Date.now();
  clockTimer = setTimeout(() => pop.close(), clockLeft);
}

function clockHold() {
  if (!clockTimer) return;
  clearTimeout(clockTimer);
  clockTimer = 0;
  clockLeft = Math.max(0, clockLeft - (Date.now() - clockStarted));
}

function clockSync() {
  if (clockEngaged || !pop.open) return;
  if (clockPauses.size) clockHold();
  else if (!clockTimer) clockRun();
}

function clockPause(reason, on) {
  if (on) clockPauses.add(reason);
  else clockPauses.delete(reason);
  clockSync();
}

/* A press inside means the reader is using the popup: no timed close after that. */
function clockEngage() {
  if (clockEngaged) return;
  clockEngaged = true;
  clearTimeout(clockTimer);
  clockTimer = 0;
}

/* Hover is judged by the pointer's place against the card's own rectangle, not by the
   dialog's hover state: a modal dialog's backdrop spans the whole screen, so its pointer
   enter/leave describe the screen, not the card. The last pointer place is noted from the
   moves and presses that reach the document, and from the press that opens the popup. */
let lastPointer = null;

function hoverSync() {
  if (!pop || !pop.open || !lastPointer) return;
  const r = pop.getBoundingClientRect();
  const inside = lastPointer.x >= r.left && lastPointer.x <= r.right && lastPointer.y >= r.top && lastPointer.y <= r.bottom;
  clockPause("hover", inside);
}

function notePointer(e) {
  if (typeof e.clientX !== "number") return;
  lastPointer = { x: e.clientX, y: e.clientY };
  hoverSync();
}

function clockFresh() {
  clearTimeout(clockTimer);
  clockTimer = 0;
  clockLeft = AUTO_DISMISS_MS;
  clockEngaged = false;
  clockPauses.clear();
  clockRun();
}

function clockStop() {
  clearTimeout(clockTimer);
  clockTimer = 0;
  clockPauses.clear();
}

/* Wholly out of sight, in any direction: the popup or the link that opened it. */
const outOfView = (r) => !r || r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth;

function scrolledAway() {
  if (!pop || !pop.open) return;
  if (outOfView(pop.getBoundingClientRect()) || (opener && outOfView(opener.getBoundingClientRect()))) pop.close();
}

function build() {
  pop = document.createElement("dialog");
  pop.className = "email-pop";
  pop.setAttribute("aria-labelledby", "email-pop-note");
  pop.tabIndex = -1;

  const note = document.createElement("p");
  note.className = "email-pop-note";
  note.id = "email-pop-note";
  note.setAttribute("aria-live", "polite");
  mark = document.createElement("span");
  mark.className = "email-pop-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "✓";
  noteText = document.createElement("span");
  note.append(mark, noteText);

  addrLine = document.createElement("p");
  addrLine.className = "email-pop-addr";
  addrLine.tabIndex = 0;

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn btn--quiet";
  copy.append(iconSvg("copy"));
  copy.setAttribute("aria-label", t("email.copyAgain"));
  copy.title = t("email.copyAgain");
  copy.addEventListener("click", async () => say(await copyText(address)));

  openLink = document.createElement("a");
  openLink.className = "btn";
  openLink.append(iconSvg("mail"));
  openLink.setAttribute("aria-label", t("email.openMail"));
  openLink.title = t("email.openMail");
  openLink.addEventListener("click", () => pop.close());

  const actions = document.createElement("div");
  actions.className = "email-pop-actions";
  actions.append(copy, openLink);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "email-pop-x";
  close.setAttribute("aria-label", t("email.close"));
  close.textContent = "×";
  close.addEventListener("click", () => pop.close());

  pop.append(note, addrLine, actions, close);
  /* A press on the dialog itself is its backdrop, and closes it; a press anywhere inside is
     the reader engaging, and stops the self-dismiss clock for good. */
  pop.addEventListener("click", (e) => { if (e.target === pop) pop.close(); else clockEngage(); });
  /* The clock pauses while the pointer rests on the card and while focus is on anything
     inside the popup; the popup's own opening focus is the dialog itself, which is its
     resting state, not a pause. */
  document.addEventListener("pointermove", notePointer, { capture: true, passive: true });
  document.addEventListener("pointerdown", notePointer, { capture: true, passive: true });
  pop.addEventListener("focusin", (e) => { if (e.target !== pop) clockPause("focus", true); });
  pop.addEventListener("focusout", (e) => {
    if (!e.relatedTarget || e.relatedTarget === pop || !pop.contains(e.relatedTarget)) clockPause("focus", false);
  });
  document.addEventListener("visibilitychange", () => clockPause("tab", document.hidden));
  /* Scrolling the popup or its link out of sight closes it at once, in every clock state. */
  window.addEventListener("scroll", scrolledAway, { capture: true, passive: true });
  pop.addEventListener("close", () => {
    clockStop();
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
  document.body.append(pop);
}

/* The note never claims a copy that did not happen: a failed copy names the address as the
   thing to copy, and the check mark stays hidden. */
function say(ok) {
  mark.hidden = !ok;
  noteText.textContent = t(ok ? "email.copied" : "email.copyFailed");
}

/* Beside the link that was pressed, kept inside the screen; on a phone-width screen, centred. */
function place(from) {
  const r = from.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight, edge = 8;
  let left, top;
  if (vw <= 640) { left = (vw - w) / 2; top = (vh - h) / 2; }
  else {
    left = Math.min(Math.max(r.left, edge), Math.max(vw - w - edge, edge));
    top = r.bottom + edge;
    if (top + h > vh - edge) top = r.top - h - edge;
    if (top < edge) top = edge;
  }
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

async function open(from, fullHref, addr) {
  if (!pop) build();
  opener = from;
  address = addr;
  addrLine.textContent = addr;
  openLink.href = fullHref;
  mark.hidden = true;
  noteText.textContent = "";
  if (!pop.open) {
    pop.showModal();
    place(from);
    pop.focus({ preventScroll: true });
  }
  clockFresh();
  hoverSync();
  say(await copyText(addr));
}

function start() {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest?.("a");
    if (!link || link.protocol !== "mailto:") return;
    if (pop && pop.contains(link)) return;
    const addr = emailAddress(link.getAttribute("href"));
    if (!addr) return;
    e.preventDefault();
    lastPointer = { x: e.clientX, y: e.clientY };
    void open(link, link.href, addr);
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") start();
