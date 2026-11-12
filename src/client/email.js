/* Email links, on every page (site.js loads this with it): pressing one never opens a mail
 * program uninvited. The address is copied, and a small popup says so and offers the two ways
 * on: copy it again, or open the mail program after all. The link keeps its mailto: href, so
 * without this file the link behaves as a plain email link. A press another control already
 * claimed, a changed press (a modifier key, a button other than the main one) and the popup's
 * own Open link are left to the browser. */

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

let pop = null, mark = null, noteText = null, addrLine = null, openLink = null;
let opener = null, address = "";

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
  copy.textContent = t("email.copyAgain");
  copy.addEventListener("click", async () => say(await copyText(address)));

  openLink = document.createElement("a");
  openLink.className = "btn";
  openLink.textContent = t("email.openMail");
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
  pop.addEventListener("click", (e) => { if (e.target === pop) pop.close(); });
  pop.addEventListener("close", () => { if (opener && opener.isConnected) opener.focus({ preventScroll: true }); });
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
    void open(link, link.href, addr);
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") start();
