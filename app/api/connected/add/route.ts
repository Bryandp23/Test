import { cookies } from "next/headers";
import { addSessions, connectionForBrowser } from "@/lib/server/connections";
import { BROWSER_COOKIE, readBrowserKey } from "@/lib/server/browser";
import { getPublicEventBySlug } from "@/lib/server/events";
import { getBaseUrl } from "@/lib/server/settings";
import { handle, json, readJson, requestOrigin } from "@/lib/server/http";
import { ProviderError } from "@/lib/server/providers/types";

// Ajout confirmé via API (Mode B). Idempotent : plusieurs clics ne créent jamais de doublon.
const inFlight = new Set<string>();

export const POST = handle(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(requestOrigin(req)).host) return json({ error: "Origine non autorisée." }, 403);
  const body = await readJson<{ slug: string; connectionId: string; sessionIds: string[] }>(req);
  const jar = await cookies();
  const key = readBrowserKey(jar.get(BROWSER_COOKIE)?.value);
  const conn = key ? await connectionForBrowser(key, body.connectionId) : null;
  if (!conn) return json({ error: "Votre agenda n'est plus connecté sur cet appareil.", reconnect: true }, 401);
  const ev = await getPublicEventBySlug(body.slug);
  if (!ev || ev.status !== "published") return json({ error: "Cet événement n'est pas disponible." }, 404);
  const ids = Array.isArray(body.sessionIds) ? body.sessionIds.filter((s) => typeof s === "string").slice(0, 100) : [];
  if (ids.length === 0) return json({ error: "Aucune séance sélectionnée." }, 400);

  const lock = `${conn.id}:${ev.id}`;
  if (inFlight.has(lock)) return json({ error: "Ajout déjà en cours, patientez un instant." }, 409);
  inFlight.add(lock);
  try {
    const results = await addSessions(conn, ev, ids, `${await getBaseUrl(requestOrigin(req))}/e/${ev.slug}`);
    return json({ results });
  } catch (e) {
    if (e instanceof ProviderError && e.kind === "auth")
      return json({ error: "L'accès à votre agenda a expiré ou a été retiré.", reconnect: true }, 401);
    throw e;
  } finally {
    inFlight.delete(lock);
  }
});
