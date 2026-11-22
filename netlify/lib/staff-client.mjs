/* The staff console's client modules, held back from the published site.
 *
 * The source-exposure audit (F-1, 15 November 2026) found the console's code downloadable by
 * anyone from the site's asset folder. The build now minifies those modules into
 * .build/staff-client/ (ops/build.mjs), the functions carry that folder (netlify.toml,
 * included_files), and the router serves a module from here only behind a signed-in staff
 * session (router.mjs, staffClient). Only the four names the console is made of are ever
 * served; anything else is not found.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".build", "staff-client");
const NAMES = new Set(["staff.js", "form-setup.js", "edit.js", "text.js"]);

let dir = DEFAULT_DIR;
/* A test points this at its own build's held-back folder. */
export function useStaffClientDir(next) { dir = next || DEFAULT_DIR; }

export function staffClientFile(name) {
  if (!NAMES.has(name)) return null;
  try { return readFileSync(join(dir, name), "utf8"); } catch { return null; }
}
