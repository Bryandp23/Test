import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addSessions, getProvider, saveConnection } from "@/lib/server/connections";
import { unsign } from "@/lib/server/crypto";
import { getBaseUrl } from "@/lib/server/settings";
import { requestOrigin } from "@/lib/server/http";
import { BROWSER_COOKIE, BROWSER_COOKIE_MAX_AGE, cookieSecure, newBrowserKey, readBrowserKey } from "@/lib/server/browser";
import { getPublicEventBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: pid } = await params;
  const url = new URL(req.url);
  const base = await getBaseUrl(requestOrigin(req));
  const jar = await cookies();
  const raw = unsign(jar.get("ec_oauth")?.value);
  let st: { state: string; verifier: string; provider: string; slug: string; s: string; t: number } | null = null;
  try {
    st = raw ? JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) : null;
  } catch {
    st = null;
  }
  const back = (q: string) => {
    const target = st?.slug ? `${base}/e/${st.slug}?${q}#ajouter` : `${base}/mes-calendriers?${q}`;
    const res = NextResponse.redirect(target);
    res.cookies.set("ec_oauth", "", { path: "/api/oauth", maxAge: 0 });
    return res;
  };

  if (url.searchParams.get("error")) return back(`connexion_erreur=${url.searchParams.get("error") === "access_denied" ? "refus" : "echec"}`);
  const p = getProvider(pid);
  if (!st || !p || st.provider !== p.id || st.state !== url.searchParams.get("state") || Date.now() - st.t > 10 * 60_000)
    return back("connexion_erreur=expire");
  const code = url.searchParams.get("code");
  if (!code) return back("connexion_erreur=echec");

  try {
    const tokens = await p.exchangeCode(code, st.verifier, `${base}/api/oauth/${p.id}/callback`);
    const email = await p.accountEmail(tokens.accessToken);
    let browserKey = readBrowserKey(jar.get(BROWSER_COOKIE)?.value);
    let newCookie: string | null = null;
    if (!browserKey) {
      const nb = newBrowserKey();
      browserKey = nb.key;
      newCookie = nb.cookie;
    }
    const conn = await saveConnection({ browserKey, provider: p.id, email, ...tokens });

    // Le participant a demandé l'ajout : on l'exécute tout de suite. Le résultat affiché sera relu en base (vérifié).
    if (st.slug) {
      const ev = await getPublicEventBySlug(st.slug);
      if (ev && ev.status === "published") {
        const wanted = st.s ? st.s.split(",") : ev.sessions.filter((s) => s.status === "active").map((s) => s.id);
        await addSessions(conn, ev, wanted, `${base}/e/${ev.slug}`).catch((e) => console.error("[oauth:add]", e));
      }
    }
    const res = back(`connexion=${p.id}`);
    if (newCookie) res.cookies.set(BROWSER_COOKIE, newCookie, { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: BROWSER_COOKIE_MAX_AGE });
    return res;
  } catch (e) {
    console.error("[oauth:callback]", e);
    return back("connexion_erreur=echec");
  }
}
