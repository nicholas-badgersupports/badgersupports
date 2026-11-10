/* The website's legal documents, published in Connect (its publicLegalDocuments, signed like every server call).
 *
 * legalNow() answers { id: { id, title, version, sha256, words, publishedAt } } for each document Connect has published,
 * or null when there is no answer to give. A document whose fingerprint does not match its words is dropped: the
 * fingerprint is what a person agrees to, so a mismatched one could never be agreed to.
 *
 * Read at most once a minute per instance. A good answer is also kept in the publication store, and a failed read
 * falls back to it: these are published public words, not anyone's record. With neither, the answer is null and
 * callers fall back on their own (the privacy page keeps the site's words; a form asking for an agreement stays shut).
 */
import { call, serviceConfigNow, sha256Hex } from "./connect.mjs";
import { noteGet, noteSet } from "./published.mjs";

export const LEGAL_SCHEMA = "bss.legal-documents/1";
export const LEGAL_DOC_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const FRESH_MS = 60_000;
const STORE = "public-legal-documents";
let held = { until: 0, value: undefined, source: "" };

export function forgetLegal() { held = { until: 0, value: undefined, source: "" }; }

export function legalDocuments(reply) {
  if (!reply || reply.schema !== LEGAL_SCHEMA || !Array.isArray(reply.documents)) throw Object.assign(new Error("Unexpected legal documents"), { code: "connect.bad-reply" });
  const out = {};
  for (const d of reply.documents) {
    if (!d || !LEGAL_DOC_RE.test(String(d.id)) || Object.hasOwn(out, d.id) || !Number.isInteger(d.version) || d.version < 1) continue;
    if (typeof d.words !== "string" || typeof d.title !== "string" || !d.title.trim() || sha256Hex(Buffer.from(d.words, "utf8")) !== d.sha256) continue;
    out[d.id] = { id: d.id, title: d.title.trim(), version: d.version, sha256: d.sha256, words: d.words, publishedAt: typeof d.publishedAt === "string" ? d.publishedAt : "" };
  }
  return out;
}

export async function legalNow({ now = Date.now() } = {}) {
  const cfg = serviceConfigNow();
  if (!cfg) return null;
  if (held.source === cfg.url && held.until > now && held.value !== undefined) return held.value;
  let value = null;
  try {
    value = legalDocuments(await call(cfg, { action: "publicLegalDocuments" }));
    await noteSet(STORE, { source: cfg.url, at: now, documents: value }).catch(() => {});
  } catch (e) {
    console.error(`public content: legal documents could not be read (${e.code || "error"})`);
    try {
      const kept = await noteGet(STORE);
      value = kept?.source === cfg.url && kept.documents && typeof kept.documents === "object" ? kept.documents : null;
    } catch { value = null; }
  }
  held = { until: now + FRESH_MS, value, source: cfg.url };
  return value;
}
