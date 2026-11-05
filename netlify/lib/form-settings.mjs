import { one, tx } from "./db.mjs";
import { HttpError } from "./http.mjs";
import { chicagoInstant } from "../../src/shared/chicago-time.mjs";

export const emptyFormSettings = () => ({ opensAt: "", closesAt: "", deadline: "", title: null, introduction: null, closedMessage: null });
export const COPY_FIELDS = ["title", "introduction", "closedMessage"];
export function formInstant(value) {
  if (!value) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new HttpError(400, "settings.date");
  const instant = chicagoInstant(...value.split("T"));
  if (!instant) throw new HttpError(400, "settings.date");
  return Date.parse(instant);
}
export async function readFormSettings(key) {
  const row = await one("SELECT version, settings FROM form_settings WHERE form_key=$1", [key]);
  return { version: row?.version || 0, ...emptyFormSettings(), ...row?.settings };
}
export function effectiveForm(def, settings, manualState, now = Date.now()) {
  const opens = formInstant(settings.opensAt), closes = formInstant(settings.closesAt), at = Number(now);
  const before = opens !== null && at < opens, after = closes !== null && at >= closes;
  const reason = manualState !== "open" ? "manual" : before ? "scheduled" : after ? "ended" : null;
  return {
    def: { ...def, ...(settings.title !== null ? { title: settings.title, settingsTitle: true } : {}), ...(settings.introduction !== null ? { intro: settings.introduction.split(/\n\s*\n/).filter(Boolean), settingsIntroduction: true } : {}), ...(settings.closedMessage !== null ? { closedMessage: settings.closedMessage } : {}), intakeWindow: { opensAt: settings.opensAt, closesAt: settings.closesAt, deadline: settings.deadline } },
    state: reason ? "closed" : "open", manualState, stateReason: reason, settings,
  };
}
export function validateFormSettings(input) {
  const keys = ["version", "opensAt", "closesAt", "deadline", ...COPY_FIELDS];
  if (!input || Object.keys(input).some(k => !keys.includes(k)) || !Number.isInteger(input.version) || input.version < 0) throw new HttpError(400, "settings.shape");
  const value = {};
  for (const k of ["opensAt", "closesAt", "deadline"]) {
    if (typeof input[k] !== "string") throw new HttpError(400, "settings.shape");
    formInstant(input[k]); value[k] = input[k];
  }
  const opens = formInstant(value.opensAt), closes = formInstant(value.closesAt);
  if (opens !== null && closes !== null && opens >= closes) throw new HttpError(400, "settings.order");
  for (const k of COPY_FIELDS) {
    const v = input[k];
    if (v !== null && (typeof v !== "string" || (k !== "introduction" && !v.trim()) || v.length > (k === "title" ? 200 : 8000))) throw new HttpError(400, "settings.words");
    value[k] = v === null ? null : v.trim();
  }
  return value;
}

/* Both the full controls and setup use this write inside their own transaction. */
export async function writeFormSettings(t, key, input, by) {
  const value = validateFormSettings(input);
  const updated = input.version === 0
    ? await t.one("INSERT INTO form_settings(form_key,version,settings,changed_by) VALUES($1,1,$2::jsonb,$3) ON CONFLICT(form_key) DO NOTHING RETURNING version", [key, JSON.stringify(value), by])
    : await t.one("UPDATE form_settings SET version=version+1,settings=$2::jsonb,changed_by=$3,changed_at=now() WHERE form_key=$1 AND version=$4 RETURNING version", [key, JSON.stringify(value), by, input.version]);
  if (!updated) throw new HttpError(409, "settings.conflict");
  await t.query("INSERT INTO form_settings_history(form_key,version,settings,changed_by) VALUES($1,$2,$3::jsonb,$4)", [key, updated.version, JSON.stringify(value), by]);
  return { version: updated.version, ...value };
}
export async function saveFormSettings(key, input, by) {
  validateFormSettings(input);
  return tx(t => writeFormSettings(t, key, input, by));
}
