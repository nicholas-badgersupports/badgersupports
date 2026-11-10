/* A form's shipped intake window, for the build and the server only: the browser never imports this
   (it ships src/shared/forms.mjs alone). Times are Chicago wall times, "YYYY-MM-DDTHH:MM". */

import { chicagoInstant } from "./chicago-time.mjs";

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const WINDOW_KEYS = ["opensAt", "closesAt", "deadline"];

/* Each problem with a definition's intakeWindow, as { code, at } rows like definitionProblems(). */
export function windowProblems(def) {
  const win = def?.intakeWindow;
  if (win === undefined) return [];
  if (!win || typeof win !== "object" || Array.isArray(win) || Object.keys(win).some((k) => !WINDOW_KEYS.includes(k))) return [{ code: "window-shape", at: "intakeWindow" }];
  const out = [];
  for (const k of WINDOW_KEYS) if (win[k] !== undefined && !(DATETIME_RE.test(String(win[k])) && chicagoInstant(...win[k].split("T")))) out.push({ code: "window-date", at: `intakeWindow.${k}` });
  if (!out.length && win.opensAt && win.closesAt && instant(win.opensAt) >= instant(win.closesAt)) out.push({ code: "window-order", at: "intakeWindow" });
  return out;
}

function instant(v) {
  return DATETIME_RE.test(String(v || "")) ? Date.parse(chicagoInstant(...v.split("T")) || "") : NaN;
}

/* Whether `at` (ms) falls outside a shipped intake window ({ opensAt, closesAt }, Chicago wall
   times). Returns "scheduled" before it opens, "ended" from its close on, or null inside it. */
export function windowReason(win, at) {
  if (!win) return null;
  const opens = instant(win.opensAt), closes = instant(win.closesAt);
  if (Number.isFinite(opens) && at < opens) return "scheduled";
  if (Number.isFinite(closes) && at >= closes) return "ended";
  return null;
}

/* The forms as a build serves them: each in its own shipped state, and an open form whose shipped
   intake window has not begun or has ended served closed with its own message. A switch row and a
   director's saved dates win over this, at Send (netlify/lib/intake.mjs) and on the pages that show
   the form (netlify/lib/pages.mjs). The content itself is not changed. */
export function servedForms(forms, at = Date.now()) {
  return Object.fromEntries(Object.entries(forms).map(([key, def]) => [key, def.state === "open" && windowReason(def.intakeWindow, at) ? { ...def, state: "closed" } : def]));
}

