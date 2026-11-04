import { cookies } from "next/headers";
import { connectionForBrowser, disconnect, setAutoAdd } from "@/lib/server/connections";
import { BROWSER_COOKIE, readBrowserKey } from "@/lib/server/browser";
import { handle, json, readJson, requestOrigin } from "@/lib/server/http";

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !!origin && new URL(origin).host === new URL(requestOrigin(req)).host;
}

async function conn(id: string) {
  const jar = await cookies();
  return connectionForBrowser(readBrowserKey(jar.get(BROWSER_COOKIE)?.value), id);
}

/** Active / désactive l'ajout automatique des futures inscriptions (consentement explicite, révocable). */
export const PATCH = handle(async (req: Request) => {
  if (!sameOrigin(req)) return json({ error: "Origine non autorisée." }, 403);
  const body = await readJson<{ connectionId: string; autoAdd: boolean; consent?: boolean }>(req);
  const c = await conn(body.connectionId);
  if (!c) return json({ error: "Connexion introuvable." }, 404);
  if (body.autoAdd && body.consent !== true) return json({ error: "Votre accord explicite est nécessaire." }, 400);
  await setAutoAdd(c, !!body.autoAdd);
  return json({ ok: true });
});

/** Déconnexion : jetons supprimés définitivement, révocation chez le fournisseur lorsqu'elle est possible. */
export const DELETE = handle(async (req: Request) => {
  if (!sameOrigin(req)) return json({ error: "Origine non autorisée." }, 403);
  const body = await readJson<{ connectionId: string }>(req);
  const c = await conn(body.connectionId);
  if (!c) return json({ error: "Connexion introuvable." }, 404);
  const r = await disconnect(c);
  return json({ ok: true, provider: c.provider, revokedAtProvider: r.revokedAtProvider });
});
