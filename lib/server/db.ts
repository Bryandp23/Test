import "server-only";
// Accès PostgreSQL.
// - Production : DATABASE_URL (PostgreSQL / Supabase) via `pg`.
// - Développement et démonstration : PGlite (PostgreSQL compilé en WebAssembly, fichiers dans ./data).
// Le même SQL fonctionne dans les deux cas.
import { SCHEMA_MIGRATIONS } from "./schema";
import { databaseUrl, isServerless } from "./config";

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}
interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

type G = typeof globalThis & { __ephecDb?: Promise<Db> };
const g = globalThis as G;

async function createPg(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
  return {
    async query(sql, params) {
      const r = await pool.query(sql, params as unknown[]);
      return r.rows;
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const res = await fn({ query: async (s, p) => (await client.query(s, p as unknown[])).rows });
        await client.query("COMMIT");
        return res;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = dir === "memory" ? new PGlite() : new PGlite(dir);
  await db.waitReady;
  // PGlite traite une requête à la fois : on sérialise pour éviter les entrelacements de transactions.
  let chain: Promise<unknown> = Promise.resolve();
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn, fn);
    chain = p.catch(() => undefined);
    return p;
  };
  return {
    query: (sql, params) => run(async () => (await db.query(sql, params as unknown[])).rows as never),
    transaction: (fn) =>
      run(() => db.transaction(async (tx) => fn({ query: async (s, p) => (await tx.query(s, p as unknown[])).rows as never }))),
  };
}

async function init(): Promise<Db> {
  // DATABASE_URL, ou la variable posée automatiquement par Netlify DB / Vercel Postgres.
  const url = databaseUrl();
  if (!url && isServerless()) throw Object.assign(new Error("Aucune base de données configurée (DATABASE_URL ou Netlify DB)."), { code: "CONFIG" });
  let db: Db;
  if (url) db = await createPg(url);
  else {
    const dir = process.env.PGLITE_DIR ?? "./data/pglite";
    if (dir !== "memory") {
      const fs = await import("node:fs");
      fs.mkdirSync(dir, { recursive: true });
    }
    db = await createPglite(dir);
  }
  await migrate(db);
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db);
  return db;
}

async function migrate(db: Db) {
  await db.query(`create table if not exists schema_migrations (version int primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query<{ version: number }>(`select version from schema_migrations`)).map((r) => r.version));
  for (const m of SCHEMA_MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.transaction(async (tx) => {
      for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await tx.query(stmt);
      await tx.query(`insert into schema_migrations(version) values ($1)`, [m.version]);
    });
  }
}

export function getDb(): Promise<Db> {
  if (!g.__ephecDb) {
    g.__ephecDb = init().catch((e) => {
      g.__ephecDb = undefined;
      throw e;
    });
  }
  return g.__ephecDb;
}

export async function q<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function q1<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (t: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}
