import { q1 } from "@/lib/server/db";
import { configuredProviders } from "@/lib/server/connections";
import { configProblems } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = configProblems().map((p) => p.name);
  if (missing.length) return Response.json({ ok: false, missing }, { status: 503 });
  try {
    await q1(`select 1`);
    return Response.json({ ok: true, database: "ok", calendarApis: configuredProviders() });
  } catch {
    return Response.json({ ok: false, database: "indisponible" }, { status: 503 });
  }
}
