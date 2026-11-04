import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getProvider } from "@/lib/server/connections";
import { randomToken, sign } from "@/lib/server/crypto";
import { getBaseUrl } from "@/lib/server/settings";
import { requestOrigin } from "@/lib/server/http";
import { cookieSecure } from "@/lib/server/browser";

export const dynamic = "force-dynamic";
const OAUTH_COOKIE = "ec_oauth";


// Démarre l'autorisation OAuth 2.0 (code + PKCE). Aucun effet de bord si un robot suit le lien.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: pid } = await params;
  const url = new URL(req.url);
  const slug = url.searchParams.get("e") ?? "";
  const base = await getBaseUrl(requestOrigin(req));
  const back = /^[a-z0-9-]{4,64}$/.test(slug) ? `${base}/e/${slug}` : `${base}/mes-calendriers`;
  const p = getProvider(pid);
  if (!p || !p.configured()) return NextResponse.redirect(`${back}?connexion_erreur=indisponible#ajouter`);

  const state = randomToken(18);
  const verifier = randomToken(48);
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const payload = Buffer.from(
    JSON.stringify({ state, verifier, provider: p.id, slug, s: url.searchParams.get("s") ?? "", t: Date.now() })
  ).toString("base64url");
  const res = NextResponse.redirect(
    p.authorizeUrl({ state, codeChallenge: challenge, redirectUri: `${base}/api/oauth/${p.id}/callback` })
  );
  res.cookies.set(OAUTH_COOKIE, sign(payload), { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/api/oauth", maxAge: 600 });
  return res;
}
