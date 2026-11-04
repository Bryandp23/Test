import { requireApiUser } from "@/lib/server/auth";
import { q1 } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/crypto";
import { handle, json, readJson } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireApiUser(req, "admin");
  const b = await readJson<{ name: string; email: string; role: string; password: string }>(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!String(b.name ?? "").trim()) return json({ error: "Indiquez le nom." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Adresse email invalide." }, 400);
  if (String(b.password ?? "").length < 12) return json({ error: "Le mot de passe doit contenir au moins 12 caractères." }, 400);
  if (await q1(`select 1 from users where email=$1`, [email])) return json({ error: "Un compte existe déjà avec cet email." }, 409);
  await q1(`insert into users (email, name, role, password_hash) values ($1,$2,$3,$4)`, [
    email,
    String(b.name).trim().slice(0, 120),
    b.role === "admin" ? "admin" : "editor",
    await hashPassword(b.password),
  ]);
  return json({ ok: true }, 201);
});
