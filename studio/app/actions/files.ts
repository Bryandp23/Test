"use server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { run, UserError, zId } from "@/lib/server/action";
import { applyOrder, getPublicationSummary, log, NotFound, signAttachments } from "@/lib/server/repo";
import { createUploadTarget, fileExists, removeFiles, signedDownloadUrl, type UploadTarget } from "@/lib/server/storage";
import { ACCEPTED, normalizeMime, type Attachment } from "@/lib/domain";
import { MAX_UPLOAD_MB } from "@/lib/server/config";

const zFile = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().max(200),
  size: z.number().int().min(1, "Fichier vide").max(MAX_UPLOAD_MB * 1024 * 1024, `Fichier trop volumineux (maximum ${MAX_UPLOAD_MB} Mo)`),
  withThumb: z.boolean().default(false),
});

export interface PreparedUpload {
  attachmentId: string;
  name: string;
  file: UploadTarget;
  thumb: UploadTarget | null;
}

const EXT_FOR: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "text/html": "html",
};

/** Étape 1 : vérifie les fichiers, crée les pièces jointes « en attente » et renvoie des URLs d'envoi signées. */
export async function prepareUploads(publicationId: string, files: unknown) {
  return run(async (tx, user) => {
    zId.parse(publicationId);
    const list = z.array(zFile).min(1).max(50).parse(files);
    const pub = await tx.query(`select 1 from public.publications where id = $1`, [publicationId]);
    if (!pub.length) throw new NotFound("Publication introuvable");
    // Nettoyage des envois abandonnés depuis plus d'un jour.
    const stale = await tx.query<{ storage_path: string; thumb_path: string | null }>(
      `delete from public.publication_attachments where publication_id = $1 and status = 'pending' and created_at < now() - interval '1 day' returning storage_path, thumb_path`,
      [publicationId],
    );
    if (stale.length) await removeFiles(stale.flatMap((s) => [s.storage_path, s.thumb_path ?? ""])).catch(() => undefined);
    let pos = (await tx.query<{ p: number }>(`select coalesce(max(position),0) as p from public.publication_attachments where publication_id = $1`, [publicationId]))[0].p;
    const out: PreparedUpload[] = [];
    for (const f of list) {
      const mime = normalizeMime(f.name, f.mime);
      if (!mime) throw new UserError(`Type de fichier non pris en charge : ${f.name}`);
      const kind = ACCEPTED[mime];
      const id = randomUUID();
      const ext = EXT_FOR[mime] ?? (f.name.includes(".") ? f.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "bin");
      const path = `${user.id}/${publicationId}/${id}.${ext}`;
      const thumbPath = f.withThumb ? `${user.id}/${publicationId}/${id}.thumb.webp` : null;
      await tx.query(
        `insert into public.publication_attachments (id, publication_id, kind, storage_path, thumb_path, name, mime, size_bytes, status, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)`,
        [id, publicationId, kind, path, thumbPath, f.name, mime, f.size, ++pos],
      );
      out.push({
        attachmentId: id,
        name: f.name,
        file: await createUploadTarget(path, mime),
        thumb: thumbPath ? await createUploadTarget(thumbPath, "image/webp") : null,
      });
    }
    return out;
  });
}

/** Étape 2 : l'envoi est terminé, on vérifie la présence du fichier puis on le rend visible. */
export async function completeUpload(attachmentId: string, meta: unknown) {
  return run(async (tx) => {
    zId.parse(attachmentId);
    const m = z
      .object({
        width: z.number().int().positive().max(100000).nullable().default(null),
        height: z.number().int().positive().max(100000).nullable().default(null),
        duration_s: z.number().nonnegative().max(86400).nullable().default(null),
        thumbUploaded: z.boolean().default(false),
      })
      .parse(meta);
    const a = (await tx.query<{ publication_id: string; storage_path: string; thumb_path: string | null; name: string }>(
      `select publication_id, storage_path, thumb_path, name from public.publication_attachments where id = $1`,
      [attachmentId],
    ))[0];
    if (!a) throw new NotFound("Pièce jointe introuvable");
    if (!(await fileExists(a.storage_path))) throw new UserError("Le fichier n'a pas été reçu par le stockage. Réessayez.");
    const thumb = m.thumbUploaded && a.thumb_path && (await fileExists(a.thumb_path)) ? a.thumb_path : null;
    const [row] = await tx.query<Omit<Attachment, "url" | "thumb_url">>(
      `update public.publication_attachments set status = 'ready', width = $2, height = $3, duration_s = $4, thumb_path = $5
       where id = $1 returning id, publication_id, kind, storage_path, thumb_path, name, mime, size_bytes, width, height, duration_s, status, position`,
      [attachmentId, m.width, m.height, m.duration_s, thumb],
    );
    await tx.query(`update public.publications set updated_at = now() where id = $1`, [a.publication_id]);
    await log(tx, { entity_type: "publication", entity_id: a.publication_id, publication_id: a.publication_id, action: "file_added", to: a.name });
    const [att] = await signAttachments([row]);
    return { attachment: att, summary: await getPublicationSummary(tx, a.publication_id) };
  });
}

/** Envoi échoué ou annulé : supprime la pièce jointe en attente. */
export async function abortUpload(attachmentId: string) {
  const res = await run(async (tx) => {
    zId.parse(attachmentId);
    const r = await tx.query<{ storage_path: string; thumb_path: string | null }>(
      `delete from public.publication_attachments where id = $1 and status = 'pending' returning storage_path, thumb_path`,
      [attachmentId],
    );
    return r.flatMap((x) => [x.storage_path, x.thumb_path ?? ""]);
  });
  if (res.ok) await removeFiles(res.data).catch(() => undefined);
  return { ok: true as const, data: true };
}

export async function deleteAttachment(attachmentId: string) {
  const res = await run(async (tx) => {
    zId.parse(attachmentId);
    const r = await tx.query<{ publication_id: string; storage_path: string; thumb_path: string | null; name: string }>(
      `delete from public.publication_attachments where id = $1 returning publication_id, storage_path, thumb_path, name`,
      [attachmentId],
    );
    if (!r.length) throw new NotFound("Pièce jointe introuvable");
    await log(tx, { entity_type: "publication", entity_id: r[0].publication_id, publication_id: r[0].publication_id, action: "file_removed", from: r[0].name });
    return { files: [r[0].storage_path, r[0].thumb_path ?? ""], summary: await getPublicationSummary(tx, r[0].publication_id) };
  });
  if (!res.ok) return res;
  await removeFiles(res.data.files).catch(() => undefined);
  return { ok: true as const, data: res.data.summary };
}

export async function reorderAttachments(publicationId: string, ids: string[]) {
  return run(async (tx) => {
    zId.parse(publicationId);
    const list = z.array(zId).max(200).parse(ids);
    const own = await tx.query<{ id: string }>(`select id from public.publication_attachments where publication_id = $1`, [publicationId]);
    const set = new Set(own.map((r) => r.id));
    await applyOrder(tx, "publication_attachments", list.filter((i) => set.has(i)));
    await tx.query(`update public.publications set updated_at = now() where id = $1`, [publicationId]);
    return getPublicationSummary(tx, publicationId);
  });
}

export async function downloadUrl(attachmentId: string) {
  return run(async (tx) => {
    zId.parse(attachmentId);
    const a = (await tx.query<{ storage_path: string; name: string }>(`select storage_path, name from public.publication_attachments where id = $1`, [attachmentId]))[0];
    if (!a) throw new NotFound("Pièce jointe introuvable");
    return signedDownloadUrl(a.storage_path, a.name);
  });
}

/** Médiathèque : toutes les pièces jointes, les plus récentes d'abord. */
export async function listMedia() {
  return run(async (tx) => {
    const rows = await tx.query<Omit<Attachment, "url" | "thumb_url">>(
      `select a.id, a.publication_id, a.kind, a.storage_path, a.thumb_path, a.name, a.mime, a.size_bytes, a.width, a.height, a.duration_s, a.status, a.position
       from public.publication_attachments a where a.status = 'ready' order by a.created_at desc limit 1000`,
    );
    // Pour la grille, seules les miniatures / images sont signées (les vidéos sans miniature aussi).
    const light = rows.map((r) => ({ ...r }));
    return signAttachments(light);
  });
}
