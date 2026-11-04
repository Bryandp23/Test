import { requireApiUser } from "@/lib/server/auth";
import { saveEvent, setStatus } from "@/lib/server/events";
import { handle, json, readJson } from "@/lib/server/http";
import { sanitizeInput } from "@/lib/server/sanitize";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const body = await readJson<{ input: unknown; publish?: boolean }>(req);
  const input = sanitizeInput(body.input);
  const r = await saveEvent({ input, userId: user.id, publish: !!body.publish });
  if (body.publish) await setStatus(r.id, "publish", user.id);
  return json({ id: r.id, slug: r.slug }, 201);
});
