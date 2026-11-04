import { cookies } from "next/headers";
import { ADMIN_COOKIE, login } from "@/lib/server/auth";
import { cookieSecure } from "@/lib/server/browser";
import { handle, json, readJson, requestOrigin } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(requestOrigin(req)).host) return json({ error: "Origine non autorisée." }, 403);
  const { email, password } = await readJson<{ email: string; password: string }>(req);
  if (!email || !password) return json({ error: "Indiquez votre email et votre mot de passe." }, 400);
  const r = await login(email, password);
  if (!r.ok)
    return json(
      { error: r.reason === "limited" ? "Trop de tentatives. Patientez 15 minutes ou contactez un administrateur." : "Email ou mot de passe incorrect." },
      r.reason === "limited" ? 429 : 401
    );
  (await cookies()).set(ADMIN_COOKIE, r.token, { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return json({ ok: true });
});
