/* The edit button's store: words staff changed on the site, kept in content_edits (migration 002)
 * until a publish carries them into content/edits.json (src/shared/edits.mjs says how the build
 * lays that file over the shipped content).
 *
 * The build's editable map (server.json) says, for every word the button can reach, what the
 * pages show now (shown) and what the shipped files say where an edit moved it (floor). A row here
 * is the newest words for one place, and it is "waiting to publish" while the pages still show
 * something else. On a local copy the rig rebuilds after each save, so nothing waits there.
 *
 * Rows are never deleted. Putting the original back saves the shipped words like any other edit,
 * so the next download carries the undo as well.
 */

import { many, tx } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { HttpError } from "./http.mjs";
import { EDITS_SCHEMA, editProblem } from "../../src/shared/edits.mjs";

const PAGE_RE = /^pg-[a-z0-9-]{1,60}$/;

const editable = () => serverContent().editable || {};
const original = (e) => (e.floor !== undefined ? e.floor : e.shown);

async function saved() {
  return new Map((await many("SELECT target, value, edited_name, edited_at FROM content_edits")).map((r) => [r.target, r]));
}

function entry(target, e, row) {
  return {
    target,
    shown: e.shown,
    original: original(e),
    current: row ? row.value : e.shown,
    waiting: !!row && row.value !== e.shown,
    ...(e.where ? { where: e.where } : {}),
    ...(row ? { by: row.edited_name, at: new Date(row.edited_at).toISOString() } : {}),
  };
}

/* Every word the button can reach from one page: the page's own blocks, then the menus, footer
   and lines every page shares. */
export async function editSource(pageId) {
  if (!PAGE_RE.test(String(pageId || ""))) throw new HttpError(400, "edit.page");
  const rows = await saved();
  const own = `page:${pageId}:`;
  const out = [];
  for (const [target, e] of Object.entries(editable())) {
    if (target.startsWith(own) || target.startsWith("site:") || target.startsWith("text:")) out.push(entry(target, e, rows.get(target)));
  }
  return out;
}

export async function editEntry(target) {
  const e = editable()[target];
  return e ? entry(target, e, (await saved()).get(target)) : null;
}

/* How many saved edits the live pages do not show yet. */
export async function waitingCount() {
  const map = editable();
  let n = 0;
  for (const [target, r] of await saved()) if (map[target] && map[target].shown !== r.value) n++;
  return n;
}

/* Save one edit. expected is the words the editor started from: if someone else saved in between,
   this refuses (409) and says what is there now, rather than overwrite it unseen. */
export async function saveEdit(who, { target, expected, value } = {}) {
  const e = editable()[String(target || "")];
  if (!e) throw new HttpError(400, "edit.target");
  if (typeof expected !== "string") throw new HttpError(400, "edit.value");
  const problem = editProblem(target, value, original(e));
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
    return { changed: true };
  });
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
