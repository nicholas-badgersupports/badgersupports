/* Place names have one full form on this site. A place entered anywhere by a short name is
   shown by its full name: the Student Mental Health Hub is also saved — in Connect's rooms and
   in campus listings — as "S-MHH", and the two are the same place (owner, 12 Nov 2026: merge
   them, and wherever the short name is typed or entered it becomes the full name on its own).
   Every feed that brings place text in passes it through canonicalPlaceName at its one door:
   ops/connect-feed.mjs for a room Connect names that matches no known place (a room that does
   match is named by content/connect-feed.json, whose words for the Hub include the short name),
   and ops/campus-feed.mjs where the three campus lists become one. Renderers never rewrite
   names; a place a content file names is shown as the file names it. */

export const STUDENT_MENTAL_HEALTH_HUB = "Student Mental Health Hub";

/* The short forms of a place's name, as normalized word sequences, and the name that shows. */
const FULL_BY_SHORT = new Map([
  ["s mhh", STUDENT_MENTAL_HEALTH_HUB],
  ["s m h h", STUDENT_MENTAL_HEALTH_HUB],
  ["smhh", STUDENT_MENTAL_HEALTH_HUB],
]);

const wordsOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/ +/g, " ");

/* A short name standing in a longer place string: "S-MHH" or "SMHH" as its own word. */
const SHORT_IN_TEXT = /\bs(?:[\s.\-]*mhh|mhh)\b/gi;

/* The place name as this site shows it: a value that is the short name, or carries it as its
   own word, names the Student Mental Health Hub; anything else is returned as written. A value
   that is not a string (a feed that states no place) passes through untouched. */
export function canonicalPlaceName(name) {
  if (typeof name !== "string" || !name.trim()) return name;
  const whole = FULL_BY_SHORT.get(wordsOf(name));
  if (whole) return whole;
  return name.replace(SHORT_IN_TEXT, STUDENT_MENTAL_HEALTH_HUB);
}
