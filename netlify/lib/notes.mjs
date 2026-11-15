/* Notes mode's store: the notes editors pin to pages with the edit button, kept as one document
 * beside the published revision (published.mjs), never in the edits file, a revision, or anything
 * a visitor is served. A note is a work record — where it is pinned, what it says, who wrote it,
 * and a fingerprint of what it was pinned to — so the note itself is the only place it lives, and
 * removing one is withdrawing that record, which asks no reason.
 *
 *   { schema: "bss.notes/1", version: n, notes: [note, …] }
 *
 * A note: { id, page: { name, route }, anchor: { kind, id, text }, selector, pos: { dx, dy },
 * text, author, createdAt, fingerprint, state: "open" | "cleared", clearedAt? }. The anchor's
 * first layer is the edits system's own target for the words; the selector is the way back when
 * those words have been re-rendered, and pos places the pin inside the anchor's box.
 *
 * Every write names the document version it read, and a write from a stale copy is refused (409)
 * with the document as it now stands — the guard the edit save's `expected` gives one word, given
 * here to the whole list, so two editors noting at once cannot silently drop each other's notes.
 * A note is marked cleared by the client, never here: this file stores the state it is given.
 */

import crypto from "node:crypto";
import { HttpError } from "./http.mjs";
import { editorNotesGet, editorNotesSet } from "./published.mjs";

export const NOTES_SCHEMA = "bss.notes/1";
const NOTES_LIMIT = 1000;

const str = (v, max) => (typeof v === "string" && v.length <= max ? v : null);
const frac = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);

async function doc() {
  const was = await editorNotesGet().catch(() => null);
  if (was && was.schema === NOTES_SCHEMA && Array.isArray(was.notes) && Number.isInteger(was.version)) return was;
  return { schema: NOTES_SCHEMA, version: 0, notes: [] };
}

function refuseStale(body, was) {
  if (!Number.isInteger(body?.version)) throw new HttpError(400, "notes.shape");
  if (body.version !== was.version) throw new HttpError(409, "notes.conflict", { version: was.version, notes: was.notes });
}

async function write(was, notes) {
  const next = { schema: NOTES_SCHEMA, version: was.version + 1, notes };
  await editorNotesSet(next);
  return { version: next.version, notes: next.notes };
}

/* The whole list, as it stands: every editor sees every note, open and cleared alike. */
export async function listNotes() {
  const was = await doc();
  return { version: was.version, notes: was.notes };
}

/* A note's words: required, and no longer than the edit box's own limit. */
function noteText(body) {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 2000) throw new HttpError(400, "notes.text");
  return text;
}

/* Create a note, change one's words, or mark one cleared. Changing the words leaves the
   fingerprint as it was made: a reworded note does not clear itself. */
export async function saveNote(who, body) {
  const was = await doc();
  refuseStale(body, was);
  if (body.id != null) {
    const note = was.notes.find((n) => n.id === body.id);
    if (!note) throw new HttpError(404, "notes.unknown");
    if (body.state === "cleared") {
      if (note.state !== "cleared") { note.state = "cleared"; note.clearedAt = new Date().toISOString(); }
    } else {
      note.text = noteText(body);
    }
    return write(was, was.notes);
  }
  if (was.notes.length >= NOTES_LIMIT) throw new HttpError(400, "notes.full");
  const page = body.page && typeof body.page === "object" ? body.page : {};
  const anchor = body.anchor && typeof body.anchor === "object" ? body.anchor : {};
  const pos = body.pos && typeof body.pos === "object" ? body.pos : {};
  const name = str(page.name, 120);
  const route = str(page.route, 200);
  const kind = anchor.kind === "edit-target" || anchor.kind === "selector" ? anchor.kind : null;
  const anchorId = str(anchor.id ?? "", 300);
  const anchorText = str(anchor.text ?? "", 80);
  const selector = str(body.selector, 600);
  const fingerprint = typeof body.fingerprint === "string" && /^(|[0-9a-f]{16,64})$/.test(body.fingerprint) ? body.fingerprint : null;
  const dx = frac(pos.dx), dy = frac(pos.dy);
  if (name == null || route == null || !route.startsWith("/") || kind == null || anchorId == null || anchorText == null
    || selector == null || fingerprint == null || dx == null || dy == null) throw new HttpError(400, "notes.shape");
  const note = {
    id: `n${crypto.randomBytes(6).toString("hex")}`,
    page: { name, route },
    anchor: { kind, id: anchorId, text: anchorText },
    selector,
    pos: { dx, dy },
    text: noteText(body),
    author: who.name || "",
    createdAt: new Date().toISOString(),
    fingerprint,
    state: "open",
  };
  return write(was, [...was.notes, note]);
}

/* Take one note off the list, whichever state it is in. */
export async function removeNote(who, body) {
  const was = await doc();
  refuseStale(body, was);
  if (!was.notes.some((n) => n.id === body.id)) throw new HttpError(404, "notes.unknown");
  return write(was, was.notes.filter((n) => n.id !== body.id));
}

/* Clear all: every note, open and cleared — or, with scope "cleared", only the cleared ones. */
export async function clearNotes(who, body) {
  const was = await doc();
  refuseStale(body, was);
  if (body.scope != null && body.scope !== "all" && body.scope !== "cleared") throw new HttpError(400, "notes.shape");
  return write(was, body.scope === "cleared" ? was.notes.filter((n) => n.state !== "cleared") : []);
}
