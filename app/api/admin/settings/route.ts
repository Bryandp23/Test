import { requireApiUser } from "@/lib/server/auth";
import { saveSettings } from "@/lib/server/settings";
import { handle, json, readJson } from "@/lib/server/http";
import { isHttpUrl } from "@/lib/validation";

export const PUT = handle(async (req: Request) => {
  await requireApiUser(req, "admin");
  const b = await readJson<Record<string, unknown>>(req);
  const url = typeof b.publicBaseUrl === "string" ? b.publicBaseUrl.trim().replace(/\/+$/, "") : "";
  if (url && !isHttpUrl(url)) return json({ error: "L'adresse publique doit commencer par https://" }, 400);
  if (typeof b.logoUrl === "string" && b.logoUrl && !isHttpUrl(b.logoUrl)) return json({ error: "Le lien du logo doit commencer par https://" }, 400);
  const reminder = b.defaultReminderMinutes;
  await saveSettings({
    publicBaseUrl: url,
    defaultReminderMinutes: typeof reminder === "number" && reminder >= 0 && reminder <= 40320 ? reminder : null,
    organizerName: String(b.organizerName ?? "").slice(0, 200),
    organizerEmail: String(b.organizerEmail ?? "").slice(0, 200),
    organizerPhone: String(b.organizerPhone ?? "").slice(0, 50),
    logoUrl: String(b.logoUrl ?? "").slice(0, 1000),
    enableYahoo: b.enableYahoo === true,
    statsRetentionDays: Math.max(30, Math.min(1095, Number(b.statsRetentionDays) || 395)),
  });
  return json({ ok: true });
});
