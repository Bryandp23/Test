import { requireApiUser } from "@/lib/server/auth";
import { saveSettings } from "@/lib/server/settings";
import { randomToken, sha256 } from "@/lib/server/crypto";
import { handle, json } from "@/lib/server/http";

/** Génère la clé d'API du système d'inscription. Seule son empreinte est conservée. */
export const POST = handle(async (req: Request) => {
  await requireApiUser(req, "admin");
  const key = `ecal_${randomToken(32)}`;
  await saveSettings({ integrationKeyHash: sha256(key) });
  return json({ key });
});
