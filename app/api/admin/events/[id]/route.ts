import { requireApiUser } from "@/lib/server/auth";
import { getEventRowById, saveEvent, setStatus, toEventInput } from "@/lib/server/events";
import { propagateChanges } from "@/lib/server/connections";
import { getBaseUrl } from "@/lib/server/settings";
import { handle, json, readJson, requestOrigin } from "@/lib/server/http";
import { sanitizeInput } from "@/lib/server/sanitize";
import { changeEmailText } from "@/lib/email";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  await requireApiUser(req);
  const { id } = await params;
  const r = await getEventRowById(id);
  if (!r) return json({ error: "Événement introuvable." }, 404);
  return json({ id, status: r.row.status, slug: r.row.slug, input: toEventInput(r.row, r.sessions) });
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(req);
  const { id } = await params;
  const existing = await getEventRowById(id);
  if (!existing) return json({ error: "Événement introuvable." }, 404);
  const body = await readJson<{ input: unknown; publish?: boolean }>(req);
  const input = sanitizeInput(body.input);
  const live = existing.row.status === "published" || existing.row.status === "cancelled";
  const r = await saveEvent({ id, input, userId: user.id, publish: live || !!body.publish });
  if (body.publish && existing.row.status === "draft") await setStatus(id, "publish", user.id);

  // Propagation aux calendriers connectés (API officielles) pour les séances dont le contenu a changé.
  const origin = requestOrigin(req);
  const sync = live ? await propagateChanges(id, r.changedSessionIds, origin) : null;
  const after = await getEventRowById(id);
  const url = `${await getBaseUrl(origin)}/e/${r.slug}`;
  return json({
    id,
    slug: r.slug,
    changes: live ? r.changes : [],
    sync,
    changeEmail: live && r.changes.length ? changeEmailText({ title: input.title, changes: r.changes, url }) : null,
    input: after ? toEventInput(after.row, after.sessions) : input,
  });
});
