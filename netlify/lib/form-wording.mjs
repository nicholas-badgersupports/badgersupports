/* The words on this site's forms as changed in Connect (Connect's formwords.mjs).
 *
 * The base: each form's words, under the slot ids src/shared/forms.mjs gives them, go to Connect's
 * publicFormDefinitions the first time this instance draws that version of the form, and again whenever those words
 * change. Connect can only edit a slot it was sent. A send that fails is tried again a minute later; it never stops a
 * form from being drawn.
 *
 * The changes: publicFormWording, read at most once a minute per instance. Connect lists only forms ever edited, and
 * only their changed slots; `slots: {}` means every word was put back. A failed read keeps the last good answer this
 * instance had, or none, in which case forms show the site's own words. Nothing about who edited is received.
 */
import { call, serviceConfigNow, canonicalJson, sha256Hex } from "./connect.mjs";
import { wordingSlots, withWording } from "../../src/shared/forms.mjs";

export const FORM_WORDING_SCHEMA = "bss.form-wording/1";
const FRESH_MS = 60_000;
const RETRY_MS = 60_000;
const TIMEOUT_MS = 4000;
const sent = new Map();          // form key -> { sig, until } : the base this instance last sent, or a failed send's wait
let read = { until: 0, forms: null, source: "" };

export function forgetFormWording() { sent.clear(); read = { until: 0, forms: null, source: "" }; }

async function sendBase(cfg, def, now) {
  const slots = wordingSlots(def);
  if (!Object.keys(slots).length) return;
  const sig = `${cfg.url}|${def.version}|${sha256Hex(canonicalJson(slots))}`;
  const was = sent.get(def.key);
  if (was && (was.sig === sig || (was.failedSig === sig && was.until > now))) return;
  try {
    const r = await call(cfg, { action: "publicFormDefinitions", forms: [{ id: def.key, version: def.version, slots }] }, { timeout: TIMEOUT_MS });
    if (!Array.isArray(r.forms) || r.forms[0]?.id !== def.key) throw Object.assign(new Error("Unexpected reply"), { code: "connect.bad-reply" });
    sent.set(def.key, { sig });
  } catch (e) {
    console.error(`form wording: the base for ${def.key} could not be sent (${e.code || "error"})`);
    sent.set(def.key, { ...was, failedSig: sig, until: now + RETRY_MS });
  }
}

async function changesNow(cfg, now) {
  if (read.source === cfg.url && read.until > now) return read.forms;
  let forms = read.source === cfg.url ? read.forms : null;
  try {
    const r = await call(cfg, { action: "publicFormWording" }, { timeout: TIMEOUT_MS });
    if (r.schema !== FORM_WORDING_SCHEMA || !r.forms || typeof r.forms !== "object" || Array.isArray(r.forms)) throw Object.assign(new Error("Unexpected reply"), { code: "connect.bad-reply" });
    forms = r.forms;
  } catch (e) {
    console.error(`form wording: Connect's changes could not be read (${e.code || "error"})`);
  }
  read = { until: now + FRESH_MS, forms, source: cfg.url };
  return forms;
}

/* The form as it should read now. Without Connect set up, the form as it came. */
export async function wordedForm(def, { now = Date.now() } = {}) {
  const cfg = serviceConfigNow();
  if (!cfg || !def?.key) return def;
  await sendBase(cfg, def, now);
  const changes = (await changesNow(cfg, now))?.[def.key]?.slots;
  return withWording(def, changes);
}
