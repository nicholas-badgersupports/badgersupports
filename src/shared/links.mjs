const ANCHOR = /^#[a-z0-9-]{1,80}$/;
const PATH = /^\/[a-z0-9\-/]*(\?[a-z]+=[a-z0-9_-]+)?(#[a-z0-9-]{1,80})?$/;

/* Source links and saved link values share the same protocol and markup restrictions. */
export function linkProblem(value) {
  if (typeof value !== "string") return "edit.value";
  const v = value.trim();
  if (!v) return "edit.empty";
  if (/[\s<>"'`\\]/.test(v)) return "edit.markup";
  if (v.length > 500) return "edit.long";
  if (v.startsWith("//")) return "edit.link";
  if (PATH.test(v) || ANCHOR.test(v)) return null;
  if (/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return null;
  if (/^tel:\+?[0-9-]{3,20}$/.test(v)) return null;
  let u;
  try { u = new URL(v); } catch { return "edit.link"; }
  return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") ? null : "edit.link";
}
