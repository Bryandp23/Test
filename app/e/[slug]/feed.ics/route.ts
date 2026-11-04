import { getPublicEventBySlug } from "@/lib/server/events";
import { buildIcs } from "@/lib/ics";
import { getBaseUrl } from "@/lib/server/settings";
import { requestOrigin } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Flux d'abonnement (webcal) : le calendrier du participant le relit périodiquement.
// Contient aussi les séances annulées (STATUS:CANCELLED) pour que les calendriers les retirent ou les barrent.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await getPublicEventBySlug(slug);
  if (!ev || (ev.status !== "published" && ev.status !== "cancelled")) return new Response("Introuvable", { status: 404 });
  const pageUrl = `${await getBaseUrl(requestOrigin(req))}/e/${ev.slug}`;
  const body = buildIcs(ev, ev.sessions, { pageUrl, calendarName: `EPHEC — ${ev.title}`, includeCancelled: true });
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="ephec-${ev.slug}.ics"`,
      "cache-control": "public, max-age=300",
    },
  });
}
