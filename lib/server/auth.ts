import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { q, q1 } from "./db";
import { randomToken, sha256, verifyPassword } from "./crypto";

export type Role = "admin" | "editor";
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const ADMIN_COOKIE = "ec_admin";
const SESSION_HOURS = 12;

const attempts = new Map<string, { n: number; until: number }>();

/** Limite les tentatives de connexion (10 par quart d'heure et par adresse email). */
export function loginRateLimited(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) return false;
  return a.n >= 10;
}
function recordFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) attempts.set(key, { n: 1, until: now + 15 * 60_000 });
  else a.n++;
}

export async function login(email: string, password: string): Promise<{ ok: true; token: string } | { ok: false; reason: "invalid" | "limited" }> {
  const key = email.trim().toLowerCase();
  if (loginRateLimited(key)) return { ok: false, reason: "limited" };
  const u = await q1<{ id: string; password_hash: string; active: boolean }>(`select id, password_hash, active from users where email=$1`, [key]);
  // Vérification factice si l'utilisateur n'existe pas : même durée de réponse.
  const ok = u ? await verifyPassword(password, u.password_hash) : (await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA"), false);
  if (!u || !ok || !u.active) {
    recordFailure(key);
    return { ok: false, reason: "invalid" };
  }
  attempts.delete(key);
  const token = randomToken();
  await q(`insert into admin_sessions (token_hash, user_id, expires_at) values ($1,$2, now() + interval '${SESSION_HOURS} hours')`, [sha256(token), u.id]);
  await q(`update users set last_login_at=now() where id=$1`, [u.id]);
  await q(`delete from admin_sessions where expires_at < now()`);
  return { ok: true, token };
}

export async function logout() {
  const c = await cookies();
  const t = c.get(ADMIN_COOKIE)?.value;
  if (t) await q(`delete from admin_sessions where token_hash=$1`, [sha256(t)]);
  c.delete(ADMIN_COOKIE);
}

export async function currentUser(): Promise<AdminUser | null> {
  const c = await cookies();
  const t = c.get(ADMIN_COOKIE)?.value;
  if (!t) return null;
  const u = await q1<AdminUser>(
    `select u.id, u.email, u.name, u.role from admin_sessions s join users u on u.id = s.user_id
     where s.token_hash=$1 and s.expires_at > now() and u.active`,
    [sha256(t)]
  );
  if (u) await q(`update admin_sessions set expires_at = now() + interval '${SESSION_HOURS} hours' where token_hash=$1`, [sha256(t)]);
  return u;
}

/** Pour les pages : redirige vers la connexion. */
export async function requireUser(role?: Role): Promise<AdminUser> {
  const u = await currentUser();
  if (!u) redirect("/admin/login");
  if (role === "admin" && u.role !== "admin") redirect("/admin?interdit=1");
  return u;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Pour les API : vérifie la session, le rôle et l'origine (protection CSRF). */
export async function requireApiUser(req: Request, role?: Role): Promise<AdminUser> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!origin || !host || new URL(origin).host !== host) throw new HttpError(403, "Origine de la requête non autorisée.");
  }
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Votre session a expiré. Reconnectez-vous.");
  if (role === "admin" && u.role !== "admin") throw new HttpError(403, "Cette action est réservée aux administrateurs.");
  return u;
}
