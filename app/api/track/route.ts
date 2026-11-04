import { q1 } from "@/lib/server/db";
import { isBot, record } from "@/lib/server/stats";

// Mesure d'audience minimale, déclenchée uniquement par du JavaScript exécuté dans un vrai navigateur
// (les robots d'analyse de liens des messageries n'exécutent pas ce code ; les agents connus sont filtrés en plus).
export async function POST(req: Request) {
  if (isBot(req.headers.get("user-agent"))) return new Response(null, { status: 204 });
  let body: { slug?: string; kind?: string; provider?: string; device?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!body.slug || !/^[a-z0-9-]{4,64}$/.test(body.slug)) return new Response(null, { status: 204 });
  if (body.kind !== "view" && body.kind !== "click") return new Response(null, { status: 204 });
  const ev = await q1<{ id: string }>(`select id from events where slug=$1 and status in ('published','cancelled')`, [body.slug]);
  if (ev) await record(ev.id, body.kind, body.provider ?? "", body.device ?? "");
  return new Response(null, { status: 204 });
}
