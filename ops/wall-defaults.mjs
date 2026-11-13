/* The Wall of Support's floor: the notes a production build stands in when
 * Connect's approved list comes back empty, so a published wall is never blank.
 *
 * The six are the wall's own notes, from the "Notes" tab of "WEB Tech
 * Dashboard" (Google Sheets, Badger Supports shared drive — the sheet the wall
 * has always read; ops/wall-notes.mjs), rows 5, 7, 19, 23, 37 and 49, in that
 * order, wording exactly as the sheet holds them. Nicholas approved all six as
 * the built-in defaults on 13 Nov 2026.
 *
 * A floor, not an addition: when Connect sends even one approved note, none of
 * these appear. They carry fixture: false and no label — real notes from the
 * wall's own sheet, not samples typed for review — so the wall renders them
 * exactly as it renders Connect's notes.
 */

export const WALL_DEFAULT_NOTES = [
  "You belong here",
  "You're not alone!",
  "The world is better with you in it",
  "Be kind to yourself",
  "It gets better, I promise",
  "Your feelings are valid",
];

/* The wall a production build publishes: the list it was given when that list
   carries any note with words in it, otherwise the approved defaults. */
export function wallWithDefaults(wall) {
  if (wall && Array.isArray(wall.notes) && wall.notes.some((n) => typeof n === "string" && n.trim())) return wall;
  return { schema: "bss.wall-fixture/1", fixture: false, source: "defaults", notes: [...WALL_DEFAULT_NOTES] };
}
