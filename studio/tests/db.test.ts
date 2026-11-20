// Intégration : schéma réel sur PGlite (même SQL que Supabase), contraintes d'intégrité.
import { describe, expect, it, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS, LOCAL_AUTH_SHIM, splitSql } from "@/lib/server/migrations";

const db = new PGlite();
const U = "11111111-1111-4111-a111-111111111111";
beforeAll(async () => {
  for (const s of splitSql(LOCAL_AUTH_SHIM)) await db.query(s);
  for (const m of MIGRATIONS.filter((m) => m.target === "all")) for (const s of splitSql(m.sql)) await db.query(s);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: U })]);
});

describe("schéma", () => {
  it("owner_id = auth.uid() par défaut", async () => {
    const r = await db.query<{ owner_id: string }>(`insert into cycles (name) values ('A') returning owner_id`);
    expect(r.rows[0].owner_id).toBe(U);
  });
  it("une publication ne peut pas pointer vers la session d'un autre cycle", async () => {
    const [a, b] = (await db.query<{ id: string }>(`insert into cycles (name) values ('X'),('Y') returning id`)).rows;
    const s = (await db.query<{ id: string }>(`insert into sessions (cycle_id, title) values ($1, 'S') returning id`, [a.id])).rows[0];
    await expect(db.query(`insert into publications (cycle_id, session_id, title) values ($1, $2, 'P')`, [b.id, s.id])).rejects.toThrow();
    const p = (await db.query<{ id: string }>(`insert into publications (cycle_id, session_id, title) values ($1, $2, 'P') returning id`, [a.id, s.id])).rows[0];
    await db.query(`delete from sessions where id = $1`, [s.id]);
    const after = (await db.query<{ cycle_id: string; session_id: string | null }>(`select cycle_id, session_id from publications where id = $1`, [p.id])).rows[0];
    expect(after).toEqual({ cycle_id: a.id, session_id: null });
  });
  it("« programmé » exige une date de programmation confirmée", async () => {
    const c = (await db.query<{ id: string }>(`insert into cycles (name) values ('Z') returning id`)).rows[0];
    await expect(db.query(`insert into publications (cycle_id, title, diffusion_status, target_date) values ($1, 'P', 'programme', '2027-01-01')`, [c.id])).rejects.toThrow();
  });
});
