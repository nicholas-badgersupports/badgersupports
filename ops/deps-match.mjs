/* Whether the installed packages (node_modules) are the ones package-lock.json names. The publish file runs this before
 * the checks and installs with `npm ci` when they differ, because the deploy copies node_modules as it finds it.
 *
 *   node ops/deps-match.mjs [name …]
 *
 * Exit 0 and one line: every package the lockfile requires is installed at its locked version, every optional one that is
 * installed is at its locked version, nothing else sits at the top of node_modules, and each package named on the command
 * line is printed with its version.
 * Exit 1: one line per difference. Exit 2: the lockfile or node_modules cannot be read.
 *
 * A package the lockfile marks optional may be absent: npm decides which optional packages to install by rules the lockfile
 * does not hold, and the same lockfile installs a different set on a Mac and on Linux.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "node_modules/";

function installedVersion(root, key) {
  try { return JSON.parse(fs.readFileSync(path.join(root, key, "package.json"), "utf8")).version ?? null; } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

/* { checked, differences, versions }: `checked` counts the packages found installed and compared. */
export function depsDiffer(root, { names = [] } = {}) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  if (!lock.packages || typeof lock.packages !== "object") throw new Error("package-lock.json has no packages list (lockfile version 2 or newer is needed)");
  const differences = [];
  const locked = new Set();
  let checked = 0;
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (!key.startsWith(PREFIX) || entry.link) continue;
    locked.add(key);
    const name = key.slice(PREFIX.length);
    const version = installedVersion(root, key);
    if (version === null) {
      if (!entry.optional) differences.push(`missing: ${name} ${entry.version}`);
      continue;
    }
    checked++;
    if (version !== entry.version) differences.push(`${name}: installed ${version}, package-lock.json names ${entry.version}`);
  }
  const top = path.join(root, "node_modules");
  if (!fs.existsSync(top)) differences.push("missing: the node_modules folder");
  else for (const dir of fs.readdirSync(top)) {
    if (dir.startsWith(".")) continue;
    const here = dir.startsWith("@") ? fs.readdirSync(path.join(top, dir)).map((n) => `${dir}/${n}`) : [dir];
    for (const n of here) if (!locked.has(PREFIX + n)) differences.push(`not in package-lock.json: ${n}`);
  }
  const versions = names.map((n) => `${n} ${installedVersion(root, PREFIX + n) ?? "not installed"}`);
  return { checked, differences, versions };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  let r;
  try { r = depsDiffer(root, { names: process.argv.slice(2) }); } catch (e) {
    console.log(`deps: could not compare node_modules with package-lock.json (${e.message})`);
    process.exit(2);
  }
  if (r.differences.length) {
    console.log(`deps: ${r.differences.length} difference(s) between node_modules and package-lock.json (${r.checked} packages compared):`);
    for (const d of r.differences) console.log(`  ${d}`);
    process.exit(1);
  }
  console.log(`deps: node_modules matches package-lock.json, ${r.checked} packages compared${r.versions.length ? `; ${r.versions.join(", ")}` : ""}.`);
}
