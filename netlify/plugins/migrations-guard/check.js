/* Which migrations a deploy would not carry. Netlify applies only the migrations a deploy brings with it, just before it
 * publishes, and a deploy brings only what its build copied from netlify/database/migrations into
 * .netlify/internal/db/migrations. That copy is Netlify's "Netlify Database setup" step. On the owner's laptop it ran on
 * both publishes (20 and 23 October 2026: "Loading migrations from netlify/database/migrations directory"); on
 * 16 October 2026 three of Badger SPILL's builds ran without it, carried no migrations, and published code ahead of
 * the database. Copied from Badger SPILL's guard (badger-spill netlify/plugins/migrations-guard/check.js).
 * The names Netlify accepts are the ones it copies: <number>_<slug>/migration.sql or <number>_<slug>.sql. */

import fs from "node:fs";
import path from "node:path";

const DIR = /^\d+_[a-z0-9_-]+$/;
const FILE = /^\d+_[a-z0-9_-]+\.sql$/;

/* Every migration in `srcDir`, as { name, file }: name is what Netlify calls it, file its SQL. */
export function migrationsIn(srcDir) {
  if (!fs.existsSync(srcDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(srcDir).sort()) {
    const full = path.join(srcDir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (DIR.test(entry) && fs.existsSync(path.join(full, "migration.sql"))) out.push({ name: entry, file: path.join(full, "migration.sql") });
    } else if (FILE.test(entry)) {
      out.push({ name: entry.replace(/\.sql$/, ""), file: full });
    }
  }
  return out;
}

/* { total, missing: [name], changed: [name] }: the migrations in `srcDir` that `distDir` lacks, or holds different SQL for. */
export function unstaged(srcDir, distDir) {
  const all = migrationsIn(srcDir);
  const missing = [];
  const changed = [];
  for (const m of all) {
    const copy = path.join(distDir, m.name, "migration.sql");
    if (!fs.existsSync(copy)) missing.push(m.name);
    else if (!fs.readFileSync(copy).equals(fs.readFileSync(m.file))) changed.push(m.name);
  }
  return { total: all.length, missing, changed };
}
