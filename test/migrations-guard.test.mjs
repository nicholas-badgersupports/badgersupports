/* The migrations guard (netlify/plugins/migrations-guard): a deploy whose build didn't pack every migration stops
 * before it publishes. Badger SPILL's guard, after its 16 October 2026 builds published code ahead of the database. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unstaged, migrationsIn } from "../netlify/plugins/migrations-guard/check.js";
import { onPostBuild } from "../netlify/plugins/migrations-guard/index.js";
import { MIGRATIONS_DIR, migrationFiles } from "../netlify/lib/db.mjs";

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bss-guard-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

/* What Netlify's copy step makes of a migrations folder (measured on the 23 October publish: one folder per
   migration under .netlify/internal/db/migrations). */
function packed(src) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "bss-guard-dist-"));
  for (const m of migrationsIn(src)) {
    fs.mkdirSync(path.join(dist, m.name), { recursive: true });
    fs.copyFileSync(m.file, path.join(dist, m.name, "migration.sql"));
  }
  return dist;
}

const run = (src, dist) => {
  let failed = null;
  const logged = [];
  const log = console.log;
  console.log = (s) => logged.push(s);
  try {
    onPostBuild({ constants: { DB_MIGRATIONS_SRC: src, DB_MIGRATIONS_DIST: dist }, utils: { build: { failBuild: (m) => { failed = m; } } } });
  } finally { console.log = log; }
  return { failed, logged };
};

test("Netlify takes the same migrations the local rig applies, each a numbered folder with a migration.sql", () => {
  const netlify = migrationsIn(MIGRATIONS_DIR).map((m) => m.name);
  assert.deepEqual(netlify, migrationFiles().map((m) => m.name));
  assert.deepEqual(netlify.slice(0, 2), ["001_intake", "002_staff"]);
  assert.ok(netlify.every((n) => /^\d{3}_[a-z0-9_-]+$/.test(n)), netlify.join());
});

test("a build that packed every migration passes", () => {
  const r = run(MIGRATIONS_DIR, packed(MIGRATIONS_DIR));
  assert.equal(r.failed, null);
  assert.match(r.logged.join(), /all \d+ migrations are packed/);
});

test("a build that packed none stops, naming them, and says nothing was published", () => {
  const r = run(MIGRATIONS_DIR, path.join(os.tmpdir(), "bss-guard-nothing-here"));
  const names = migrationsIn(MIGRATIONS_DIR).map((m) => m.name);
  assert.ok(r.failed.includes(`${names.length} of ${names.length} not packed (${names.join(", ")})`), r.failed);
  assert.match(r.failed, /Nothing was published/);
  assert.match(r.failed, /PUBLISH-WEBSITE-2026-10-23\.command/);
});

test("one missing, one stale copy: both named; strays and other files are ignored as Netlify ignores them", () => {
  const src = tree({
    "001_a/migration.sql": "SELECT 1;",
    "002_b/migration.sql": "SELECT 2;",
    "003_c.sql": "SELECT 3;",
    ".DS_Store": "finder",
    "notes/migration.sql": "not a migration",
    "README.md": "words",
  });
  const dist = tree({ "001_a/migration.sql": "SELECT 1;", "002_b/migration.sql": "SELECT 'old';" });
  assert.deepEqual(unstaged(src, dist), { total: 3, missing: ["003_c"], changed: ["002_b"] });
  assert.match(run(src, dist).failed, /1 of 3 not packed \(003_c\); 1 packed with different SQL \(002_b\)/);
  fs.writeFileSync(path.join(dist, "002_b/migration.sql"), "SELECT 2;");
  fs.mkdirSync(path.join(dist, "003_c"));
  fs.writeFileSync(path.join(dist, "003_c/migration.sql"), "SELECT 3;");
  assert.equal(run(src, dist).failed, null);
});

test("netlify.toml runs the guard, and the function carries the migrations", () => {
  const toml = fs.readFileSync("netlify.toml", "utf8");
  assert.match(toml, /\[\[plugins\]\]\s*\n\s*package = "\.\/netlify\/plugins\/migrations-guard"/);
  assert.ok(fs.existsSync("netlify/plugins/migrations-guard/manifest.yml"));
  assert.match(toml, /included_files = \[[^\]]*"netlify\/database\/migrations\/\*\*"/);
});
