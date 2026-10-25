/* The edit button's store: words staff changed on the site, kept in content_edits (migration 002).
 * A save publishes them: the router writes every saved word as the next published revision
 * (published.mjs), and the pages are drawn with it (pages.mjs). The edits file (editsFile, below)
 * is the same words, for a build. src/shared/edits.mjs says how either is laid over the content.
 *
 * The build's editable map (server.json) says, for every word the button can reach, what the
 * build's pages show (shown) and what the shipped files say where an edit moved it (floor). A row here
 * is the newest words for one place, and it is "waiting" while the published revision (or, before
 * any revision, the build) still shows something else.
 *
 * Every save also adds a row to content_edit_history (migration 005), in the same transaction.
 * Rows in either table are never deleted, and history rows are never changed. Putting the original
 * back, or restoring an earlier version, saves those words like any other edit, so it becomes the
 * newest version and the next download carries it as well.
 */

import { many, tx } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { HttpError } from "./http.mjs";
import { EDITS_SCHEMA, editProblem, valueProblem } from "../../src/shared/edits.mjs";
import { ICONS } from "../../src/render/icons.mjs";
import { currentRevision } from "./published.mjs";

const PAGE_RE = /^pg-[a-z0-9-]{1,60}$/;

const editable = () => serverContent().editable || {};
const original = (e) => (e.floor !== undefined ? e.floor : e.shown);

async function saved() {
  return new Map((await many("SELECT target, value, edited_name, edited_at FROM content_edits")).map((r) => [r.target, r]));
}

/* What visitors are shown for a place: the published revision's words, or the build's before any revision.
   A revision that cannot be read counts as none, so a fault says "waiting" rather than "on the site". */
async function liveWords() {
  let r = null;
  try { r = await currentRevision(); } catch { r = null; }
  return (target, e) => (r ? (r.edits[target] ?? original(e)) : e.shown);
}

function entry(target, e, row, live) {
  return {
    target,
    shown: e.shown,
    original: original(e),
    current: row ? row.value : e.shown,
    waiting: !!row && row.value !== live(target, e),
    ...(e.where ? { where: e.where } : {}),
    ...(e.kind ? { kind: e.kind, ...(e.options ? { options: e.options } : {}) } : {}),
    ...(row ? { by: row.edited_name, at: new Date(row.edited_at).toISOString() } : {}),
  };
}

/* Every word the button can reach from one page: the page's own blocks, then the menus, footer
   and lines every page shares. */
export async function editSource(pageId) {
  if (!PAGE_RE.test(String(pageId || ""))) throw new HttpError(400, "edit.page");
  const rows = await saved();
  const live = await liveWords();
  const own = `page:${pageId}:`;
  const out = [];
  for (const [target, e] of Object.entries(editable())) {
    if (target.startsWith(own) || target.startsWith("site:") || target.startsWith("text:")) out.push(entry(target, e, rows.get(target), live));
  }
  return out;
}

export async function editEntry(target) {
  const e = editable()[target];
  return e ? entry(target, e, (await saved()).get(target), await liveWords()) : null;
}

/* How many saved edits the pages do not show yet. */
export async function waitingCount() {
  const map = editable();
  const live = await liveWords();
  let n = 0;
  for (const [target, r] of await saved()) if (map[target] && live(target, map[target]) !== r.value) n++;
  return n;
}

/* Save one edit. expected is the words the editor started from: if someone else saved in between,
   this refuses (409) and says what is there now, rather than overwrite it unseen. */
export async function saveEdit(who, { target, expected, value } = {}) {
  const e = editable()[String(target || "")];
  if (!e) throw new HttpError(400, "edit.target");
  if (typeof expected !== "string") throw new HttpError(400, "edit.value");
  // a value that is not a word is checked by its kind: a link https or on this site, a photo from the library,
  // a choice from its list (src/shared/edits.mjs, valueProblem)
  const problem = e.kind
    ? valueProblem(e.kind, value, { options: e.options || (e.kind === "icon" ? ICONS : []), media: new Set((serverContent().media?.items || []).map((m) => m.id)) })
    : editProblem(target, value, original(e));
  if (problem) throw new HttpError(422, problem);
  const words = value.trim();
  return tx(async (t) => {
    const row = await t.one("SELECT value FROM content_edits WHERE target = $1 FOR UPDATE", [target]);
    const current = row ? row.value : e.shown;
    if (expected !== current) throw new HttpError(409, "edit.conflict", { current });
    if (words === current) return { changed: false };
    await t.query(
      `INSERT INTO content_edits (target, value, previous, edited_by, edited_name) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (target) DO UPDATE SET value = EXCLUDED.value, previous = content_edits.value,
         edited_by = EXCLUDED.edited_by, edited_name = EXCLUDED.edited_name, edited_at = now()`,
      [target, words, current, who.sub, who.name]);
    await t.query(
      "INSERT INTO content_edit_history (target, value, previous, edited_by, edited_name) VALUES ($1, $2, $3, $4, $5)",
      [target, words, current, who.sub, who.name]);
    return { changed: true };
  });
}

export const HISTORY_LIMIT = 50;

/* Every version saved for one place, newest first, with who saved it. The newest is what the
   place holds now. Older than the newest HISTORY_LIMIT are kept but not listed. */
export async function editHistory(target) {
  const e = editable()[String(target || "")];
  if (!e) throw new HttpError(400, "edit.target");
  const rows = await many(
    "SELECT id, value, edited_name, edited_at FROM content_edit_history WHERE target = $1 ORDER BY id DESC LIMIT $2",
    [target, HISTORY_LIMIT]);
  return {
    target,
    original: original(e),
    versions: rows.map((r) => ({ id: String(r.id), value: r.value, by: r.edited_name, at: new Date(r.edited_at).toISOString() })),
  };
}

/* The file a publish needs, as the build reads it: the edits the pages already show, every saved
   row over them, and nothing that equals the shipped files. */
export async function editsFile() {
  const map = editable();
  const edits = {};
  for (const [target, e] of Object.entries(map)) if (e.floor !== undefined) edits[target] = e.shown;
  for (const [target, r] of await saved()) if (map[target]) edits[target] = r.value;
  for (const [target, words] of Object.entries(edits)) if (words === original(map[target])) delete edits[target];
  return { schema: EDITS_SCHEMA, edits: Object.fromEntries(Object.entries(edits).sort(([a], [b]) => a.localeCompare(b))) };
}
