import { getPublicEventBySlug } from "@/lib/server/events";
import { buildIcs, icsFilename } from "@/lib/ics";
import { getBaseUrl } from "@/lib/server/settings";
import { currentUser } from "@/lib/server/auth";
import { requestOrigin } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Fichier iCalendar pour import (Apple, Outlook bureau, Thunderbird…).
// GET sans effet de bord : les robots de prévisualisation des emails peuvent l'ouvrir sans fausser les statistiques.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const ev = await getPublicEventBySlug(slug);
  const allowed = ev && (ev.status === "published" || ev.status === "cancelled" || (url.searchParams.get("preview") && (await currentUser())));
  if (!ev || !allowed) return new Response("Événement introuvable", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

  const ids = url.searchParams.get("s")?.split(",").filter(Boolean);
  const cancelFile = ev.status === "cancelled" || url.searchParams.has("annulation");
  let sessions = ev.sessions.filter((s) => (cancelFile ? true : s.status === "active"));
  if (ids?.length) sessions = sessions.filter((s) => ids.includes(s.id));
  if (sessions.length === 0) return new Response("Aucune séance sélectionnée", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });

  const pageUrl = `${await getBaseUrl(requestOrigin(req))}/e/${ev.slug}`;
  const body = buildIcs(ev, sessions, { pageUrl, method: cancelFile ? "CANCEL" : "PUBLISH" });
  const filename = cancelFile ? icsFilename(ev).replace(/\.ics$/, "-annulation.ics") : icsFilename(ev);
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
