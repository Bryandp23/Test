import { requireApiUser } from "@/lib/server/auth";
import { duplicateEvent, getEventRowById, setStatus } from "@/lib/server/events";
import { propagateChanges } from "@/lib/server/connections";
import { getBaseUrl } from "@/lib/server/settings";
import { handle, json, readJson, requestOrigin } from "@/lib/server/http";
import { cancelEmailText } from "@/lib/email";

type Ctx = { params: Promise<{ id: string }> };
const ACTIONS = ["publish", "cancel", "restore", "archive", "unarchive", "duplicate"] as const;

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(req);
  const { id } = await params;
  const { action, reason } = await readJson<{ action: (typeof ACTIONS)[number]; reason?: string }>(req);
  if (!ACTIONS.includes(action)) return json({ error: "Action inconnue." }, 400);
  const ev = await getEventRowById(id);
  if (!ev) return json({ error: "Événement introuvable." }, 404);

  if (action === "duplicate") {
    const r = await duplicateEvent(id, user.id);
    return json({ id: r.id });
  }
  const { changedSessionIds } = await setStatus(id, action, user.id, reason);
  const origin = requestOrigin(req);
  const sync = changedSessionIds.length ? await propagateChanges(id, changedSessionIds, origin) : null;
  const url = `${await getBaseUrl(origin)}/e/${ev.row.slug}`;
  return json({
    ok: true,
    sync,
    cancelEmail: action === "cancel" ? cancelEmailText({ title: ev.row.title, reason: reason?.trim() || null, url }) : null,
  });
});
