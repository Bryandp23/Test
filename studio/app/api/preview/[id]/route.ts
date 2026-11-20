// Aperçu isolé des fichiers HTML importés.
// Le document est servi avec une CSP `sandbox` (origine opaque : aucun accès aux cookies, au stockage
// ni à l'application) et affiché dans une iframe `sandbox`. Aucune requête réseau sortante n'est autorisée
// hormis les images et feuilles de style (rendu fidèle des emails / newsletters).
import { NextRequest } from "next/server";
import { getUser } from "@/lib/server/auth";
import { asUser } from "@/lib/server/db";
import { readFileText } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const user = await getUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  const row = await asUser(user.id, async (tx) =>
    (await tx.query<{ storage_path: string; kind: string }>(`select storage_path, kind from public.publication_attachments where id = $1 and status = 'ready'`, [id]))[0],
  );
  if (!row || row.kind !== "html") return new Response("Introuvable", { status: 404 });
  let html: string;
  try {
    html = await readFileText(row.storage_path);
  } catch (e) {
    return new Response((e as Error).message, { status: 422 });
  }
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "content-security-policy":
        "sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; media-src * data:; frame-ancestors 'self'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
