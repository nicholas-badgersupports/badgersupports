/* The only file that knows which database this is. Modelled on Badger SPILL's netlify/lib/db.mjs.
 *
 *   DEPLOYED  Netlify Database through @netlify/database (its pg-compatible pool).
 *   LOCAL     PGlite — Postgres compiled to WebAssembly, in-process — when LOCAL_DB=pglite: the dev
 *             server and every test. The same migrations run on boot, so a green local run is
 *             evidence about the deployed SQL, not about a stand-in.
 *
 * With neither, every route that needs the database answers 503 config.missing: production fails
 * closed. PGlite is never bundled into the deployed function (netlify.toml external_node_modules).
 *
 * Handlers use q(text, params) and tx(fn). Values are always parameters ($1, $2 …).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(HERE, "..", "database", "migrations");

let adapter = null;

const shape = (r) => ({ rows: r.rows || [], rowCount: r.rowCount ?? r.affectedRows ?? (r.rows || []).length });

function pgAdapter(pool) {
  return {
    kind: "pg",
    query: async (text, params = []) => shape(await pool.query(text, params)),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({ query: async (t, p = []) => shape(await client.query(t, p)) });
        await client.query("COMMIT");
        return out;
      } catch (err) {
        try { await client.query("ROLLBACK"); } catch { /* connection may be gone */ }
        throw err;
      } finally {
        client.release();
      }
    },
    async end() { await pool.end(); },
  };
}

function pgliteAdapter(db) {
  return {
    kind: "pglite",
    query: async (text, params = []) => shape(await db.query(text, params)),
    transaction: (fn) => db.transaction((t) => fn({ query: async (q, p = []) => shape(await t.query(q, p)) })),
    exec: (sql) => db.exec(sql),
    end: () => db.close(),
  };
}

/* A fresh in-memory database with every migration applied. Tests take one each. */
export async function freshPglite(dir) {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = dir ? new PGlite(dir) : new PGlite();
  await db.waitReady;
  const a = pgliteAdapter(db);
  await migrate(a);
  return a;
}

async function createAdapter() {
  if (process.env.LOCAL_DB === "pglite") return freshPglite(process.env.LOCAL_DB_DIR || undefined);
  if (process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL) {
    const { getDatabase } = await import("@netlify/database");
    return pgAdapter(getDatabase().pool);
  }
  throw Object.assign(new Error("No database is configured."), { code: "config.missing" });
}

export function getAdapter() {
  if (!adapter) adapter = createAdapter().catch((e) => { adapter = null; throw e; });
  return adapter;
}

/* Tests and the dev server install their own. */
export function useAdapter(a) { adapter = Promise.resolve(a); }

export async function q(text, params = []) { return (await getAdapter()).query(text, params); }
export async function one(text, params = []) { return (await q(text, params)).rows[0] || null; }
export async function many(text, params = []) { return (await q(text, params)).rows; }

const RETRYABLE = new Set(["40001", "40P01"]);

/* fn(tx) in one transaction, retried on a serialization failure or deadlock. Nothing that leaves
   the database (mail, fetch) happens inside fn: that is what the outbox is for. */
export async function tx(fn) {
  const a = await getAdapter();
  for (let attempt = 1; ; attempt++) {
    try {
      return await a.transaction(async (raw) => fn({
        query: raw.query,
        one: async (t, p) => (await raw.query(t, p)).rows[0] || null,
        many: async (t, p) => (await raw.query(t, p)).rows,
      }));
    } catch (err) {
      if (attempt < 3 && RETRYABLE.has(err?.code)) continue;
      throw err;
    }
  }
}

export function migrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR).sort()
    .map((name) => ({ name, file: path.join(MIGRATIONS_DIR, name, "migration.sql") }))
    .filter((m) => existsSync(m.file));
}

/* Every migration, in order. Each is idempotent; bss_migrations records what ran. */
export async function migrate(a) {
  const run = (sql) => (a.exec ? a.exec(sql) : a.query(sql));
  await run("CREATE TABLE IF NOT EXISTS bss_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  for (const m of migrationFiles()) {
    await run(readFileSync(m.file, "utf8"));
    await a.query("INSERT INTO bss_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [m.name]);
  }
}
