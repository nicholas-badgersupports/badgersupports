/* Publish safety: the two faults Netlify refuses before it builds anything.
 *
 * Both are SPILL's lost day, 21–22 November 2026, and the owner's ruling of 22 November
 * made the checks permanent on all three sites. A netlify.toml that does not parse —
 * three header values stood unquoted — refused every SPILL deploy at the configuration
 * stage while the previous deploy kept answering, so publishes were recorded as live
 * that never served. Two migrations sharing a number refused the deploy at Netlify's
 * migration stage, the same refusal Connect met on 13 November 2026. Neither fault is
 * visible to a gate that never reads the file the way Netlify reads it, so this one
 * does: the parse is smol-toml's, a real TOML parser held as a devDependency for this
 * gate, and the migration scan compares the numbers themselves.
 *
 * The functions take the root to read, so a proof can point them at a fixture tree;
 * the gate in ops/check.mjs passes the repository root.
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

/* netlify.toml, parsed whole. One problem at most: the parser's own message, which
 * names the line and column Netlify would refuse at. */
export function tomlProblems(root) {
  const file = path.join(root, "netlify.toml");
  if (!fs.existsSync(file)) return [`netlify.toml is missing at ${file}`];
  try {
    parse(fs.readFileSync(file, "utf8"));
    return [];
  } catch (e) {
    return [`netlify.toml does not parse: ${String(e.message || e)}`];
  }
}

/* The migration names Netlify accepts are the ones its copy step takes (the
 * migrations-guard plugin's check.js reads the same two forms): a directory
 * <number>_<slug> holding migration.sql, or a file <number>_<slug>.sql. Numbers
 * must be unique across both forms — the platform validates the whole set's
 * numbers before it applies any of them. */
const DIR = /^(\d+)_[a-z0-9_-]+$/;
const FILE = /^(\d+)_[a-z0-9_-]+\.sql$/;

export function migrationNumberProblems(root) {
  const dir = path.join(root, "netlify", "database", "migrations");
  if (!fs.existsSync(dir)) return [];
  const byNumber = new Map();
  for (const entry of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const m = fs.statSync(full).isDirectory()
      ? (fs.existsSync(path.join(full, "migration.sql")) ? DIR.exec(entry) : null)
      : FILE.exec(entry);
    if (!m) continue;
    byNumber.set(m[1], [...(byNumber.get(m[1]) || []), entry]);
  }
  return [...byNumber.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([n, names]) => `migration number ${n} is shared by ${names.join(", ")} — Netlify refuses the whole deploy`);
}

export function publishSafetyProblems(root) {
  return [...tomlProblems(root), ...migrationNumberProblems(root)];
}
