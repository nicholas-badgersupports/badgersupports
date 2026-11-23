/* The exact shapes of two internal identifiers, for the server and the build only.
 *
 * The source-exposure audit (F-2, 15 November 2026) found both shapes printed in the shipped
 * form rules (src/shared/forms.mjs, which every form page imports). They live here instead:
 * the build publishes only forms.mjs and event-state.mjs from src/shared, so nothing in this
 * file reaches a browser. A shape is not a secret, but it is not a visitor's business either.
 *
 * Neither identifier authorizes anything by itself, and the server never treats one as if it
 * did — the audit asked for that confirmation, and it is recorded here because this file is
 * where the shapes are defined:
 *   - a hiring-cycle id is filing metadata. Intake stores it as a submission's context and
 *     Connect files by it; no state, switch or answer is ever decided by it (hiringContext
 *     below, and netlify/lib/intake.mjs).
 *   - an agreement value names a legal document's version and hash, and intake checks both
 *     against the document's current version and hash before filing; a value that merely
 *     looks right is refused (netlify/lib/intake.mjs, agreementsOf).
 */

export const HIRING_CYCLE_ID_RE = /^hc-[0-9a-f]{12}$/;

/* Cycle context is filing metadata, never an answer or permission. Explicit invalid context
   remains present but empty so the receiver cannot silently file it by another intake period. */
export function hiringContext(key, input) {
  if (key !== "recommendation-letter") return {};
  const multi = typeof input?.getAll === "function";
  if (!(multi ? input.has("_cycle") : Object.hasOwn(input || {}, "_cycle"))) return {};
  const values = multi ? input.getAll("_cycle") : Array.isArray(input._cycle) ? input._cycle : [input._cycle];
  const value = values.length === 1 && typeof values[0] === "string" ? values[0] : "";
  return { hiringCycleId: HIRING_CYCLE_ID_RE.test(value) ? value : "" };
}

export const AGREE_VALUE_RE = /^([1-9][0-9]{0,8}):([0-9a-f]{64})$/;
