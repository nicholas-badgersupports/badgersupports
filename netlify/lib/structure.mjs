/* The page structure's store: every version of the document src/shared/structure.mjs describes, one row each in
 * site_structure (migration 008), newest last. The newest row is the structure now; rows are never changed or
 * deleted, so any version can be brought back. A change names the version it started from and is refused (409)
 * when another landed first, rather than overwrite it unseen. A change is published like a saved word: the router
 * writes the next revision (published.mjs), which carries the structure to the page function.
 *
 * Restoring a published revision writes its words and its structure again as the newest, through the same checks
 * as a save. It never deletes a page: a page made since that revision is retired, so its id is never given again.
 */

import { one, many, tx } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { HttpError } from "./http.mjs";
import { editableFor, revisionEdits, original, problemFor } from "./edits.mjs";
import { redirectFor } from "./pages.mjs";
import { emptyStructure, applyChange, isProblem, menuOutline, stateOf, FIXED_PAGES } from "../../src/shared/structure.mjs";
import { composeSite } from "../../src/render/site.mjs";

const parse = (d) => (typeof d === "string" ? JSON.parse(d) : d);

/* { version, doc }: version "0" and an empty document before any change. `q` is a transaction's handle, or the pool. */
export async function structureNow(q = { one }) {
  const row = await q.one("SELECT id, doc FROM site_structure ORDER BY id DESC LIMIT 1");
  return row ? { version: String(row.id), doc: parse(row.doc) } : { version: "0", doc: emptyStructure() };
}

/* The newest saved-word row, the other half of what a restore must find unchanged. */
const stampNow = async (q = { one }) => Number((await q.one("SELECT max(id) AS id FROM content_edit_history"))?.id || 0);
/* What a restore names as the state it started from. */
export const restoreToken = async () => `${(await structureNow()).version}:${await stampNow()}`;

/* The site as saved now, published or not: every saved word and the structure now, drafts included. */
export async function siteAsSaved(doc) {
  const snap = serverContent().render;
  if (!snap) throw new HttpError(503, "pages.unavailable");
  return composeSite(snap, await revisionEdits(doc), doc);
}

/* The editor's list: every page the build's files or the staff page made, with its state, and the menu. */
export async function pagesList() {
  const { version, doc } = await structureNow();
  const site = await siteAsSaved(doc);
  const shortTitle = (t) => String(t || "").replace(new RegExp(` — ${site.site.name}$`), "");
  const pages = site.all
    .filter((p) => site.authored.has(p.id) || doc.pages[p.id]?.page)
    .map((p) => ({ id: p.id, path: p.file ? `/${p.file}` : p.path, title: shortTitle(p.title), description: p.description || "",
      state: stateOf(doc, p.id), made: !!doc.pages[p.id]?.page, fixed: FIXED_PAGES.has(p.id) }));
  return { version, menu: menuOutline(site.site.nav), pages };
}

/* The scope a change needs, from the state of the page it names: words and drafts are an editor's (site.edit); what
   visitors can reach, the menu, a live page's address and bringing back a version are a publisher's (site.publish). */
export function scopeFor(change, doc) {
  const draft = change.page && doc.pages[change.page]?.state === "draft";
  switch (change.action) {
    case "add": case "copy": return "site.edit";
    case "details": return change.path !== undefined && !draft ? "site.publish" : "site.edit";
    case "retire": return draft ? "site.edit" : "site.publish";
    default: return "site.publish";
  }
}

/* Apply one change for `who`, after `allow(scope)` has said they may. Returns { version, page? }. */
export async function changeStructure(who, change, allow) {
  const before = await structureNow();
  allow(scopeFor(change, before.doc));
  if (String(change.expected) !== before.version) throw new HttpError(409, "pages.conflict", { current: before.version });
  const c = serverContent();
  const site = await siteAsSaved(before.doc);
  let out;
  try {
    out = applyChange(before.doc, change, {
      pages: site.all, authored: site.authored, menu: menuOutline(site.site.nav),
      site: { name: site.site.name, description: site.site.description }, redirected: (p) => !!redirectFor(c, p),
    });
  } catch (e) {
    if (isProblem(e)) throw new HttpError(e.status, e.code);
    throw e;
  }
  const version = await tx(async (t) => {
    await t.query("LOCK TABLE site_structure IN EXCLUSIVE MODE");
    const now = await structureNow(t);
    if (now.version !== before.version) throw new HttpError(409, "pages.conflict", { current: now.version });
    const row = await t.one(
      "INSERT INTO site_structure (doc, action, page_id, edited_by, edited_name) VALUES ($1::jsonb, $2, $3, $4, $5) RETURNING id",
      [JSON.stringify(out.doc), change.action, out.page || null, who.sub, who.name]);
    return String(row.id);
  });
  return { version, page: out.page };
}

/* The structure a restore writes: the revision's, with every page made since it retired rather than dropped. */
function restoredDoc(theirs, ours) {
  const doc = structuredClone(theirs || emptyStructure());
  for (const [id, r] of Object.entries(ours.pages)) {
    if (r.page && !doc.pages[id]) doc.pages[id] = { state: "retired", page: r.page, ...(r.path ? { path: r.path } : {}), ...(r.oldPaths ? { oldPaths: r.oldPaths } : {}) };
  }
  return doc;
}

/* Bring back published revision `revision` as the newest: each place whose words differ is saved again (with its
   history row, as a save is), and the structure is written again, all in one transaction. A value the build no longer
   accepts stays as it is and is counted. `expected` is restoreToken() as the editor read it. */
export async function restoreRevision(who, revision, expected) {
  const now = await structureNow();
  const doc = restoredDoc(revision.structure, now.doc);
  const map = editableFor(doc);
  const rows = new Map((await many("SELECT target, value FROM content_edits")).map((r) => [r.target, r.value]));
  const changes = [];
  let skipped = 0;
  for (const [target, e] of Object.entries(map)) {
    const want = revision.edits?.[target] ?? original(e);
    const have = rows.has(target) ? rows.get(target) : e.shown;
    if (want === have) continue;
    if (problemFor(target, e, want)) { skipped++; continue; }
    changes.push([target, want, have]);
  }
  const version = await tx(async (t) => {
    await t.query("LOCK TABLE site_structure IN EXCLUSIVE MODE");
    const s = await structureNow(t);
    if (`${s.version}:${await stampNow(t)}` !== String(expected)) throw new HttpError(409, "versions.conflict", { current: `${s.version}:${await stampNow(t)}` });
    for (const [target, value, previous] of changes) {
      await t.query(
        `INSERT INTO content_edits (target, value, previous, edited_by, edited_name) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (target) DO UPDATE SET value = EXCLUDED.value, previous = content_edits.value,
           edited_by = EXCLUDED.edited_by, edited_name = EXCLUDED.edited_name, edited_at = now()`,
        [target, value, previous, who.sub, who.name]);
      await t.query("INSERT INTO content_edit_history (target, value, previous, edited_by, edited_name) VALUES ($1, $2, $3, $4, $5)",
        [target, value, previous, who.sub, who.name]);
    }
    const row = await t.one(
      "INSERT INTO site_structure (doc, action, page_id, edited_by, edited_name) VALUES ($1::jsonb, $2, NULL, $3, $4) RETURNING id",
      [JSON.stringify(doc), `restore:${revision.n}`, who.sub, who.name]);
    return String(row.id);
  });
  return { version, words: changes.length, skipped };
}
