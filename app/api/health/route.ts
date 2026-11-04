import { q1 } from "@/lib/server/db";
import { configuredProviders } from "@/lib/server/connections";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await q1(`select 1`);
    return Response.json({ ok: true, database: "ok", calendarApis: configuredProviders() });
  } catch {
    return Response.json({ ok: false, database: "indisponible" }, { status: 503 });
  }
}
