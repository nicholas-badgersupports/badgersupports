/* ops/deps-match.mjs: whether node_modules holds what package-lock.json names, on a made-up tree per case. The
   publish file installs with npm ci when this finds a difference, so each kind of difference is a case here. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { depsDiffer } from "../ops/deps-match.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ops/deps-match.mjs");
const LOCK = {
  lockfileVersion: 3,
  packages: {
    "": { name: "example" },
    "node_modules/sharp": { version: "0.35.5", dev: true },
    "node_modules/@img/sharp-darwin-arm64": { version: "0.35.5", optional: true, os: ["darwin"], cpu: ["arm64"] },
    "node_modules/@img/sharp-linux-x64": { version: "0.35.5", optional: true, os: ["linux"], cpu: ["x64"] },
    "node_modules/@img/sharp-wasm32": { version: "0.35.5", optional: true },
    "node_modules/@emnapi/runtime": { version: "1.11.3", optional: true },
    "node_modules/sharp/node_modules/detect-libc": { version: "2.1.2" },
    "node_modules/linked": { version: "1.0.0", link: true },
  },
};
/* What npm installed from the real lockfile on the Mac (2 Nov 2026): the darwin binary, and neither sharp-wasm32 nor
   @emnapi/runtime, though the lockfile gives them no os or cpu. */
const MAC_INSTALLED = ["sharp", "@img/sharp-darwin-arm64", "sharp/node_modules/detect-libc"];

/* A tree holding the lockfile and the named packages at the given versions (the lockfile's when not given). */
function tree(installed, versions = {}, lock = LOCK) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deps-match-"));
  fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lock));
  fs.mkdirSync(path.join(root, "node_modules", ".bin"), { recursive: true });
  for (const name of installed) {
    const dir = path.join(root, "node_modules", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version: versions[name] || lock.packages[`node_modules/${name}`]?.version || "9.9.9" }));
  }
  return root;
}

test("a tree installed from the lockfile on a Mac matches: an optional package npm left out is npm's choice", () => {
  const r = depsDiffer(tree(MAC_INSTALLED), { names: ["sharp"] });
  assert.deepEqual(r.differences, []);
  assert.equal(r.checked, 3, "every installed package compared");
  assert.deepEqual(r.versions, ["sharp 0.35.5"]);
  assert.deepEqual(depsDiffer(tree([...MAC_INSTALLED, "@img/sharp-wasm32", "@emnapi/runtime"])).differences, [], "and so is one npm put in, as on Linux");
});

test("each kind of difference is named: an old version, a missing required package, an optional one at another version, an extra", () => {
  assert.deepEqual(depsDiffer(tree(MAC_INSTALLED, { sharp: "0.34.4" })).differences, ["sharp: installed 0.34.4, package-lock.json names 0.35.5"]);
  assert.deepEqual(depsDiffer(tree(MAC_INSTALLED.filter((n) => n !== "sharp/node_modules/detect-libc"))).differences, ["missing: sharp/node_modules/detect-libc 2.1.2"], "a nested package");
  assert.deepEqual(depsDiffer(tree(MAC_INSTALLED.filter((n) => n !== "sharp"))).differences, ["missing: sharp 0.35.5"]);
  assert.deepEqual(depsDiffer(tree(MAC_INSTALLED, { "@img/sharp-darwin-arm64": "0.34.4" })).differences, ["@img/sharp-darwin-arm64: installed 0.34.4, package-lock.json names 0.35.5"], "installed, an optional package must be the locked version");
  assert.deepEqual(depsDiffer(tree([...MAC_INSTALLED, "left-behind", "@img/sharp-libvips-darwin-arm64"])).differences.sort(), ["not in package-lock.json: @img/sharp-libvips-darwin-arm64", "not in package-lock.json: left-behind"], "left at the top of node_modules");
});

test("the command: exit 0 with one line, 1 with the differences, 2 when it cannot read", () => {
  const run = (root, args = []) => {
    fs.mkdirSync(path.join(root, "ops"), { recursive: true });
    fs.copyFileSync(SCRIPT, path.join(root, "ops", "deps-match.mjs"));
    return spawnSync(process.execPath, [path.join(root, "ops", "deps-match.mjs"), ...args], { encoding: "utf8" });
  };
  const lock = { lockfileVersion: 3, packages: { "node_modules/sharp": { version: "0.35.5" } } };
  const same = run(tree(["sharp"], {}, lock), ["sharp"]);
  assert.equal(same.status, 0, same.stdout + same.stderr);
  assert.equal(same.stdout, "deps: node_modules matches package-lock.json, 1 packages compared; sharp 0.35.5.\n");
  const old = run(tree(["sharp"], { sharp: "0.34.4" }, lock));
  assert.equal(old.status, 1);
  assert.match(old.stdout, /^deps: 1 difference\(s\)[\s\S]*sharp: installed 0\.34\.4, package-lock\.json names 0\.35\.5/);
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "deps-match-"));
  const none = run(bare);
  assert.equal(none.status, 2);
  assert.match(none.stdout, /could not compare node_modules with package-lock\.json/);
  const unreadable = tree(["sharp"], {}, lock);
  fs.writeFileSync(path.join(unreadable, "node_modules", "sharp", "package.json"), "{ not json");
  assert.equal(run(unreadable).status, 2, "a package.json that cannot be read stops the comparison");
  const noModules = tree([], {}, lock);
  fs.rmSync(path.join(noModules, "node_modules"), { recursive: true });
  const r = run(noModules);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /missing: the node_modules folder/);
});

/* macOS's temporary folder (/var/folders/…) is a link to /private/var/folders/…, so on a Mac the command above runs
   through a link. Node names the module by its real path and argv[1] by the path it was given. */
test("the command answers when its folder is reached through a link, as macOS's temporary folder is", () => {
  const lock = { lockfileVersion: 3, packages: { "node_modules/sharp": { version: "0.35.5" } } };
  const root = tree(["sharp"], {}, lock);
  fs.mkdirSync(path.join(root, "ops"));
  fs.copyFileSync(SCRIPT, path.join(root, "ops", "deps-match.mjs"));
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "deps-link-")), "site");
  fs.symlinkSync(root, link, "dir");
  const r = spawnSync(process.execPath, [path.join(link, "ops", "deps-match.mjs"), "sharp"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "deps: node_modules matches package-lock.json, 1 packages compared; sharp 0.35.5.\n", "a silent exit 0 reads as a match in the publish file");
});
