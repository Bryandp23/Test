import { requireApiUser } from "@/lib/server/auth";
import { statsCsv } from "@/lib/server/stats";
import { handle } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  await requireApiUser(req);
  const u = new URL(req.url);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = re.test(u.searchParams.get("du") ?? "") ? u.searchParams.get("du")! : "2000-01-01";
  const to = re.test(u.searchParams.get("au") ?? "") ? u.searchParams.get("au")! : "2100-01-01";
  return new Response(await statsCsv(from, to), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ephec-calendar-statistiques-${from}-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
});
