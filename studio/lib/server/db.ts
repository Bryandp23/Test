import "server-only";
// Accès PostgreSQL.
// - Supabase : DATABASE_URL (pooler Supavisor, mode transaction, port 6543) via `pg`.
//   Chaque requête applicative s'exécute dans une transaction avec le rôle `authenticated`
//   et les claims JWT de l'utilisateur : les politiques RLS s'appliquent réellement.
// - Local : PGlite (PostgreSQL en WebAssembly) dans ./data/pglite. Même SQL.
import { MIGRATIONS, LOCAL_AUTH_SHIM, splitSql } from "./migrations";
import { databaseUrl, dataDir, mode } from "./config";

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}
interface Db {
  kind: "pg" | "pglite";
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

type G = typeof globalThis & { __studioDb?: Promise<Db> };
const g = globalThis as G;

// Types renvoyés sous forme de chaînes stables (aucune conversion de fuseau implicite).
function tsToIso(v: string): string {
  // "2026-11-20 10:00:00+00" → ISO 8601
  let s = v.replace(" ", "T");
  if (/[+-]\d\d$/.test(s)) s += ":00";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}
const PARSERS: Record<number, (v: string) => unknown> = {
  1082: (v) => v, // date
  1083: (v) => v.slice(0, 5), // time → HH:MM
  1114: (v) => tsToIso(v + "+00"),
  1184: tsToIso, // timestamptz
  20: (v) => Number(v), // int8
  700: (v) => Number(v),
  701: (v) => Number(v),
};

async function createPg(url: string): Promise<Db> {
  const pg = await import("pg");
  for (const [oid, fn] of Object.entries(PARSERS)) pg.types.setTypeParser(Number(oid), fn);
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
  });
  return {
    kind: "pg",
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const res = await fn({ query: async (s, p) => (await client.query(s, p as unknown[])).rows });
        await client.query("commit");
        return res;
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const parsers = Object.fromEntries(Object.entries(PARSERS).map(([k, f]) => [Number(k), f]));
  const db = dir === "memory" ? new PGlite({ parsers }) : new PGlite(dir, { parsers });
  await db.waitReady;
  let chain: Promise<unknown> = Promise.resolve();
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn, fn);
    chain = p.catch(() => undefined);
    return p;
  };
  return {
    kind: "pglite",
    transaction: (fn) =>
      run(() => db.transaction(async (tx) => fn({ query: async (s, p) => (await tx.query(s, p as unknown[])).rows as never }))),
  };
}

async function init(): Promise<Db> {
  const m = mode();
  if (m === "unconfigured") throw Object.assign(new Error("Configuration Supabase manquante."), { code: "CONFIG" });
  let db: Db;
  if (m === "supabase") db = await createPg(databaseUrl()!);
  else {
    const dir = process.env.PGLITE_DIR ?? `${dataDir()}/pglite`;
    if (dir !== "memory") (await import("node:fs")).mkdirSync(dir, { recursive: true });
    db = await createPglite(dir);
  }
  await migrate(db, m === "supabase");
  return db;
}

async function migrate(db: Db, supabase: boolean) {
  await db.transaction(async (tx) => {
    if (!supabase) for (const s of splitSql(LOCAL_AUTH_SHIM)) await tx.query(s);
    await tx.query(
      `create table if not exists public.studio_migrations (version int primary key, name text not null, applied_at timestamptz not null default now())`,
    );
    // Table technique : pas d'accès via l'API Supabase.
    await tx.query(`alter table public.studio_migrations enable row level security`);
  });
  const done = await db.transaction((tx) => tx.query<{ version: number }>(`select version from public.studio_migrations`));
  const applied = new Set(done.map((r) => r.version));
  for (const mig of MIGRATIONS) {
    if (applied.has(mig.version)) continue;
    if (mig.target === "supabase" && !supabase) continue;
    try {
      await db.transaction(async (tx) => {
        for (const stmt of splitSql(mig.sql)) await tx.query(stmt);
        await tx.query(`insert into public.studio_migrations(version, name) values ($1, $2)`, [mig.version, mig.name]);
      });
    } catch (e) {
      // Le bucket et ses politiques peuvent aussi être créés à la main (voir docs/DEPLOIEMENT.md).
      if (mig.target === "supabase") console.error(`[studio] migration ${mig.version} (${mig.name}) non appliquée :`, e);
      else throw e;
    }
  }
}

export function getDb(): Promise<Db> {
  if (!g.__studioDb) {
    g.__studioDb = init().catch((e) => {
      g.__studioDb = undefined;
      throw e;
    });
  }
  return g.__studioDb;
}

/** Exécute fn dans une transaction au nom de l'utilisateur (RLS actives sur Supabase). */
export async function asUser<T>(userId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    if (db.kind === "pg") await tx.query(`select set_config('role', 'authenticated', true)`);
    return fn(tx);
  });
}
