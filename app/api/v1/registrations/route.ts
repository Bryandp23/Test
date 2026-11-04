import crypto from "node:crypto";
import { q1 } from "@/lib/server/db";
import { getBaseUrl, getSettings } from "@/lib/server/settings";
import { emailHmac, randomToken, sha256 } from "@/lib/server/crypto";
import { getPublicEventBySlug } from "@/lib/server/events";
import { autoAddForRegistration } from "@/lib/server/connections";
import { handle, json, readJson, requestOrigin } from "@/lib/server/http";

/**
 * API d'intégration (Phase 3) pour le système d'inscription de l'EPHEC.
 *
 * POST /api/v1/registrations
 * Authorization: Bearer <clé d'intégration>
 * { "event": "<identifiant court de l'événement>", "externalRef": "<id d'inscription>", "email": "<facultatif>" }
 *
 * Réponse : { url } — lien personnalisé à placer dans l'email (ex. champ personnalisé ActiveCampaign).
 * Si l'email est fourni et que le participant a activé « ajout automatique », l'événement est ajouté à son agenda.
 * L'email n'est jamais stocké en clair (empreinte HMAC uniquement).
 */
export const POST = handle(async (req: Request) => {
  const settings = await getSettings();
  const auth = req.headers.get("authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? sha256(auth.slice(7).trim()) : "";
  const expected = settings.integrationKeyHash ?? "";
  if (!expected || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected)))
    return json({ error: "Clé d'intégration invalide." }, 401);

  const b = await readJson<{ event?: string; externalRef?: string; email?: string }>(req);
  const ev = b.event ? await getPublicEventBySlug(b.event) : null;
  if (!ev || ev.status !== "published") return json({ error: "Événement inconnu ou non publié." }, 404);
  const ref = typeof b.externalRef === "string" ? b.externalRef.slice(0, 120) : null;
  const email = typeof b.email === "string" && b.email.includes("@") ? b.email : null;

  let row = ref ? await q1<{ token: string }>(`select token from registrations where event_id=$1 and external_ref=$2`, [ev.id, ref]) : null;
  if (!row) {
    row = await q1<{ token: string }>(`insert into registrations (event_id, token, external_ref, email_hmac) values ($1,$2,$3,$4) returning token`, [
      ev.id,
      randomToken(12),
      ref,
      email ? emailHmac(email) : null,
    ]);
  }
  const base = await getBaseUrl(requestOrigin(req));
  const pageUrl = `${base}/e/${ev.slug}`;
  const auto = email ? await autoAddForRegistration(email, ev, pageUrl) : [];
  return json({
    url: `${pageUrl}?r=${row!.token}`,
    autoAdded: auto.map((a) => ({ provider: a.provider, added: a.results.filter((r) => r.outcome === "added" || r.outcome === "already").length, errors: a.results.filter((r) => r.outcome === "error").length })),
  });
});
