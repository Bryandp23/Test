import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { mode } from "./config";
import { sign, verify } from "./local-secret";
import { supabaseServer } from "./supabase";

export interface User {
  id: string;
  email: string;
}

export const LOCAL_COOKIE = "studio_local_session";
const LOCAL_TTL_S = 60 * 60 * 24 * 30;

export function localCredentials() {
  return {
    email: (process.env.STUDIO_LOCAL_EMAIL ?? "studio@ephec.local").toLowerCase(),
    password: process.env.STUDIO_LOCAL_PASSWORD ?? "Studio-EPHEC-2026!",
  };
}
/** Identifiant stable dérivé de l'email (format UUID) pour le mode local. */
export function localUserId(email: string): string {
  const h = createHash("sha256").update("studio-local:" + email).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function makeLocalSessionCookie(email: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + LOCAL_TTL_S })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export const getUser = cache(async (): Promise<User | null> => {
  const m = mode();
  if (m === "supabase") {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
  }
  if (m === "local") {
    const raw = (await cookies()).get(LOCAL_COOKIE)?.value;
    if (!raw) return null;
    const [payload, sig] = raw.split(".");
    if (!payload || !sig || !verify(payload, sig)) return null;
    try {
      const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (typeof x !== "number" || x < Date.now() / 1000) return null;
      if (e !== localCredentials().email) return null;
      return { id: localUserId(e), email: e };
    } catch {
      return null;
    }
  }
  return null;
});

/** Pour les pages : redirige vers /login. */
export async function requireUserPage(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export class AuthError extends Error {
  code = "UNAUTHENTICATED";
}
/** Pour les actions serveur et routes API. */
export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) throw new AuthError("Session expirée. Reconnectez-vous.");
  return u;
}
