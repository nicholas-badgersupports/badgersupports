/* The Wall of Support's fill: the notes a production build stands in behind
 * Connect's approved notes, so the wall always stands full.
 *
 * The six are the wall's own notes, from the "Notes" tab of "WEB Tech
 * Dashboard" (Google Sheets, Badger Supports shared drive — the sheet the wall
 * has always read; ops/wall-notes.mjs), rows 5, 7, 19, 23, 37 and 49, in that
 * order, wording exactly as the sheet holds them. Nicholas approved all six as
 * the built-in defaults on 13 Nov 2026.
 *
 * A fill, not an all-or-nothing floor (his direction, 23 Nov 2026): Connect's
 * approved notes always stand first and in full, and the defaults take only
 * the places left under the wall's display count — one fewer default for each
 * approved note, so the defaults move off one by one as the wall fills with
 * real notes, and none stands once approved notes reach the display count.
 * They carry fixture: false and no label — real notes from the wall's own
 * sheet, not samples typed for review — so the wall renders them exactly as
 * it renders Connect's notes.
 *
 * Only six defaults exist, so a wall with fewer than two approved notes
 * stands short of the display count: it shows every approved note and all
 * six defaults rather than repeat a note or invent one.
 */

export const WALL_DEFAULT_NOTES = [
  "You belong here",
  "You're not alone!",
  "The world is better with you in it",
  "Be kind to yourself",
  "It gets better, I promise",
  "Your feelings are valid",
];

/* How many notes the wall displays at once: the wall block's own "show"
   (content/pages/home.json). The fill tops a list up to this count. */
export const WALL_DISPLAY_COUNT = 8;

const real = (n) => typeof n === "string" && n.trim();

/* The wall a production build publishes: Connect's approved notes first, in
   full, with the defaults filling the places left under the display count.
   A default whose words an approved note already carries never stands
   twice, and a list already at the display count is returned untouched. */
export function wallWithDefaults(wall, display = WALL_DISPLAY_COUNT) {
  const approved = (wall && Array.isArray(wall.notes) ? wall.notes : []).filter(real);
  if (!approved.length) return { schema: "bss.wall-fixture/1", fixture: false, source: "defaults", notes: [...WALL_DEFAULT_NOTES] };
  if (approved.length >= display) return wall;
  const fill = WALL_DEFAULT_NOTES.filter((d) => !approved.includes(d)).slice(0, display - approved.length);
  if (!fill.length) return wall;
  return { ...wall, notes: [...approved, ...fill] };
}
