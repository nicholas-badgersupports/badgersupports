/* Files that go up with an application: one PDF of at most 3 MB for a file question (a resume, a
 * cover letter). Portfolios are links, never uploads.
 *
 * A file goes up in its own request as soon as it is chosen, so a refused file is said at once and
 * Send carries only its id. It is kept in the uploads table (migration 003), never on disk, and
 * nothing reads one back: there is no route, and so no address, that serves a file. Send claims
 * it for the submission in the transaction that saves the answers (intake.mjs); the answer then
 * holds the file's name, size and digest, never its bytes. Connect will collect the bytes through
 * the outbox; until it confirms, they stay here. An upload nobody claimed is deleted after a day.
 */

import crypto from "node:crypto";
import { q } from "./db.mjs";
import { HttpError } from "./http.mjs";
import { questionById, QUESTION_TYPES } from "../../src/shared/forms.mjs";

const PDF_MAGIC = "%PDF-";
const NAME_MAX = 120;

export const isPdfType = (type) => /^application\/pdf\s*(;|$)/i.test(String(type || ""));

/* The question a file is for: one of type file, on the form as it stands, while it is open. */
export function fileQuestion(form, id) {
  if (form.state !== "open") throw new HttpError(409, "form.closed", { closedMessage: form.closedMessage });
  const qn = questionById(form.def, String(id || ""));
  if (!qn || qn.type !== "file") throw new HttpError(404, "file.question");
  return qn;
}

/* The file's own name, as words: no folders, no control characters, at most 120 characters with
   its extension kept. Directors read it; nothing uses it as a path. */
export function fileName(header) {
  let s = String(header || "");
  try { s = decodeURIComponent(s); } catch { /* sent unencoded */ }
  s = s.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return "file.pdf";
  if (s.length <= NAME_MAX) return s;
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(s)?.[0] || "";
  return s.slice(0, NAME_MAX - ext.length) + ext;
}

/* One file, checked and kept; returns its new id. The bytes must open as a PDF does, whatever
   the name or type claims, so a renamed picture is refused. */
export async function storeFile(form, qn, { name, bytes }) {
  if (bytes.length > QUESTION_TYPES.file.maxBytes) throw new HttpError(413, "file.tooBig");
  if (bytes.subarray(0, PDF_MAGIC.length).toString("latin1") !== PDF_MAGIC) throw new HttpError(415, "file.notPdf");
  const fileId = crypto.randomBytes(24).toString("base64url");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  await q("DELETE FROM uploads WHERE submission_id IS NULL AND created_at < now() - interval '1 day'");
  await q(`INSERT INTO uploads (file_id, form_key, question, name, type, bytes, sha256, data)
           VALUES ($1, $2, $3, $4, 'application/pdf', $5, $6, $7)`,
    [fileId, form.def.key, qn.id, name, bytes.length, sha256, bytes]);
  return fileId;
}

/* Send's half, inside its transaction. Each file answer's id becomes the file's record — the
   answer a submission keeps — or, for an id that is unknown, expired, for another question or
   already sent, an error on that question. */
export async function fileRecords(t, def, answers) {
  const out = { ...answers };
  const errors = {};
  const ids = [];
  for (const [id, v] of Object.entries(answers)) {
    if (questionById(def, id)?.type !== "file") continue;
    const recs = [];
    for (const fileId of v) {
      const r = await t.one(
        `SELECT name, type, bytes, sha256 FROM uploads
          WHERE file_id = $1 AND form_key = $2 AND question = $3 AND submission_id IS NULL FOR UPDATE`,
        [fileId, def.key, id]);
      if (!r) { errors[id] = "file-missing"; break; }
      recs.push({ fileId, name: r.name, type: r.type, bytes: r.bytes, sha256: r.sha256 });
      ids.push(fileId);
    }
    out[id] = recs;
  }
  return Object.keys(errors).length ? { errors } : { answers: out, ids };
}

export async function claimFiles(t, submissionId, ids) {
  if (ids.length) await t.query("UPDATE uploads SET submission_id = $1, claimed_at = now() WHERE file_id = ANY($2::text[])", [submissionId, ids]);
}
