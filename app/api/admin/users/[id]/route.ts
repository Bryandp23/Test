import { requireApiUser } from "@/lib/server/auth";
import { q, q1 } from "@/lib/server/db";
import { handle, json, readJson } from "@/lib/server/http";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireApiUser(req, "admin");
  const { id } = await params;
  if (id === me.id) return json({ error: "Vous ne pouvez pas modifier votre propre rôle ou statut." }, 400);
  const b = await readJson<{ role?: string; active?: boolean }>(req);
  const u = await q1<{ id: string }>(`select id from users where id=$1`, [id]);
  if (!u) return json({ error: "Utilisateur introuvable." }, 404);
  if (b.role === "admin" || b.role === "editor") await q(`update users set role=$2 where id=$1`, [id, b.role]);
  if (typeof b.active === "boolean") {
    await q(`update users set active=$2 where id=$1`, [id, b.active]);
    if (!b.active) await q(`delete from admin_sessions where user_id=$1`, [id]);
  }
  return json({ ok: true });
});
