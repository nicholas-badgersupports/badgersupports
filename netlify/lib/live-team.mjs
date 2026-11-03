/* Public profiles are read on a page draw, never kept in a second roster or a warm cache.
   Production HTML and media contain no built-in people to resurrect after an opt-out.
   Uploaded photos use a fixed Connect path; visitor input can never choose a fetch origin. */
import { call, serviceConfigNow } from "./connect.mjs";
import { mapTeam, TEAM_EXPORT } from "../../ops/connect-feed.mjs";

export const PHOTO_ID = /^p[0-9a-f]{24}$/;
const VERSION = /^[0-9a-f]{32}$/;
const PHOTO_MAX = 4 * 1024 * 1024;

export function publicUpload(value, origin) {
  try {
    const u = new URL(value);
    const id = u.pathname.slice(3);
    const version = u.searchParams.get("v");
    if (u.origin !== new URL(origin).origin || !u.pathname.startsWith("/p/") || !PHOTO_ID.test(id)
        || u.username || u.password || u.hash || [...u.searchParams.keys()].some((k) => k !== "v")
        || u.searchParams.getAll("v").length > 1 || (version !== null && !VERSION.test(version))) return null;
    return { uploadId: id, ...(version ? { version } : {}) };
  } catch { return null; }
}

export async function teamNow() {
  const cfg = serviceConfigNow();
  if (!cfg) throw Object.assign(new Error("Team profiles are not connected."), { code: "team.unavailable" });
  const reply = await call(cfg, { action: "publicTeam" });
  if (reply.schema !== TEAM_EXPORT || !Array.isArray(reply.people)) throw Object.assign(new Error("Team profiles could not be read."), { code: "team.bad-reply" });
  const { team } = mapTeam(reply);
  for (const p of team.people) if (p.photo) {
    const photo = publicUpload(p.photo.link, cfg.url);
    if (photo && photo.uploadId === p.id) p.photo = { ...photo, alt: p.photo.alt || "" };
    else delete p.photo;
  }
  return team;
}

/* Connect checks that the uploaded image still belongs to an eligible public profile. No profile
   export is needed per image. Redirects are refused, including redirects back to the allowed host. */
export async function teamPhoto(req, id) {
  const u = new URL(req.url), versions = u.searchParams.getAll("v");
  const failure = (status) => new Response(null, { status, headers: { "cache-control": "no-store", "netlify-cdn-cache-control": "no-store", "x-content-type-options": "nosniff" } });
  if (!PHOTO_ID.test(id) || versions.length > 1 || [...u.searchParams.keys()].some((k) => k !== "v") || (versions.length && !VERSION.test(versions[0]))) return failure(400);
  const cfg = serviceConfigNow();
  if (!cfg) return failure(503);
  const target = new URL(`/p/${id}`, cfg.url);
  if (versions.length) target.searchParams.set("v", versions[0]);
  try {
    const r = await (cfg.fetch || globalThis.fetch)(target.href, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { accept: "image/png,image/jpeg,image/webp,image/avif" } });
    if (r.status === 404 || r.status === 403) { await r.body?.cancel(); return failure(404); }
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (r.status !== 200 || !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(type) || Number(r.headers.get("content-length")) > PHOTO_MAX) { await r.body?.cancel(); return failure(502); }
    const reader = r.body?.getReader();
    if (!reader) return failure(502);
    const chunks = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > PHOTO_MAX) { await reader.cancel(); return failure(502); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    const magic = type === "image/png" ? body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : type === "image/jpeg" ? body[0] === 255 && body[1] === 216 && body[2] === 255
      : type === "image/webp" ? body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP"
      : body.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(body.toString("ascii", 8, Math.min(body.length, 40)));
    if (!magic) return failure(502);
    return new Response(req.method === "HEAD" ? null : body, { headers: { "content-type": type, "x-content-type-options": "nosniff", "cache-control": "public, max-age=0, must-revalidate", "netlify-cdn-cache-control": "public, s-maxage=300", "netlify-vary": "query=v", "netlify-cache-tag": "page,team-photo" } });
  } catch { return failure(502); }
}
