"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { mode } from "@/lib/server/config";
import { LOCAL_COOKIE, localCredentials, makeLocalSessionCookie } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

export interface LoginState {
  error?: string;
  info?: string;
}

const attempts = new Map<string, { n: number; until: number }>();

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/board";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  if (!email || !password) return { error: "Renseignez votre email et votre mot de passe." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${email}`;
  const a = attempts.get(key);
  if (a && a.until > Date.now()) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };

  const m = mode();
  if (m === "supabase") {
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const n = (a?.n ?? 0) + 1;
      attempts.set(key, { n, until: n >= 8 ? Date.now() + 5 * 60_000 : 0 });
      return { error: "Email ou mot de passe incorrect." };
    }
  } else if (m === "local") {
    const c = localCredentials();
    const ok =
      email === c.email && password.length === c.password.length && timingSafeEqual(Buffer.from(password), Buffer.from(c.password));
    if (!ok) {
      const n = (a?.n ?? 0) + 1;
      attempts.set(key, { n, until: n >= 8 ? Date.now() + 5 * 60_000 : 0 });
      return { error: "Email ou mot de passe incorrect." };
    }
    (await cookies()).set(LOCAL_COOKIE, makeLocalSessionCookie(email), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.STUDIO_INSECURE_COOKIE !== "1",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    redirect("/setup");
  }
  attempts.delete(key);
  redirect(next);
}

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (mode() !== "supabase") return { error: "Lien de connexion disponible uniquement avec Supabase." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Renseignez votre email." };
  const origin = (await headers()).get("origin") ?? "";
  const sb = await supabaseServer();
  // shouldCreateUser: false — application mono-utilisateur, aucun compte n'est créé depuis l'écran de connexion.
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: "Envoi impossible. Vérifiez l'adresse ou réessayez plus tard." };
  return { info: "Si un compte existe pour cette adresse, un lien de connexion vient d'être envoyé." };
}

export async function logout() {
  const m = mode();
  if (m === "supabase") await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(LOCAL_COOKIE);
  redirect("/login");
}
