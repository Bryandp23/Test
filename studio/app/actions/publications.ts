"use server";
import { z } from "zod";
import { run, UserError, zDate, zId, zTime, zUrl } from "@/lib/server/action";
import { applyOrder, getPublicationDetail, getPublicationSummary, log, nextPosition, NotFound } from "@/lib/server/repo";
import type { Queryable } from "@/lib/server/db";
import { copyFile, removeFiles } from "@/lib/server/storage";
import { brusselsToUtcIso } from "@/lib/time";
import { randomUUID } from "node:crypto";

const zCreate = z.object({
  cycle_id: zId,
  session_id: zId.nullable().default(null),
  title: z.string().trim().min(1, "Le titre est requis").max(200),
  body: z.string().max(100000).default(""),
  channel_tag_id: zId.nullable().default(null),
  format_tag_id: zId.nullable().default(null),
  audience_tag_id: zId.nullable().default(null),
  nature_tag_id: zId.nullable().default(null),
  production_status: z.enum(["idee", "a_creer", "en_cours", "pret"]).default("a_creer"),
  target_date: zDate.default(null),
  target_time: zTime.default(null),
});

async function assertPlacement(tx: Queryable, cycleId: string, sessionId: string | null) {
  const c = await tx.query(`select 1 from public.cycles where id = $1`, [cycleId]);
  if (!c.length) throw new NotFound("Cycle introuvable");
  if (sessionId) {
    const s = await tx.query(`select 1 from public.sessions where id = $1 and cycle_id = $2`, [sessionId, cycleId]);
    if (!s.length) throw new UserError("Cette session n'appartient pas au cycle choisi.");
  }
}

export async function createPublication(input: unknown) {
  return run(async (tx) => {
    const p = zCreate.parse(input);
    await assertPlacement(tx, p.cycle_id, p.session_id);
    // Le public du cycle est repris par défaut.
    let audience = p.audience_tag_id;
    if (!audience) audience = (await tx.query<{ a: string | null }>(`select audience_tag_id as a from public.cycles where id = $1`, [p.cycle_id]))[0]?.a ?? null;
    const pos = await nextPosition(tx, "publications", `where cycle_id = $1 and session_id is not distinct from $2`, [p.cycle_id, p.session_id]);
    const [row] = await tx.query<{ id: string }>(
      `insert into public.publications (cycle_id, session_id, title, body, channel_tag_id, format_tag_id, audience_tag_id, nature_tag_id,
         production_status, target_date, target_time, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [p.cycle_id, p.session_id, p.title, p.body, p.channel_tag_id, p.format_tag_id, audience, p.nature_tag_id, p.production_status, p.target_date, p.target_time, pos],
    );
    await log(tx, { entity_type: "publication", entity_id: row.id, publication_id: row.id, action: "created", to: p.production_status });
    return getPublicationSummary(tx, row.id);
  });
}

export async function getPublication(id: string) {
  return run((tx) => getPublicationDetail(tx, zId.parse(id)));
}

const zPatch = z
  .object({
    title: z.string().trim().min(1, "Le titre est requis").max(200),
    description: z.string().max(5000),
    body: z.string().max(100000),
    notes: z.string().max(20000),
    channel_tag_id: zId.nullable(),
    format_tag_id: zId.nullable(),
    audience_tag_id: zId.nullable(),
    nature_tag_id: zId.nullable(),
    production_status: z.enum(["idee", "a_creer", "en_cours", "pret"]),
    target_date: zDate,
    target_time: zTime,
  })
  .partial();

const LOGGED: Record<string, string> = { production_status: "production", target_date: "target_date", title: "title" };

/** Modification des champs éditoriaux. La diffusion passe par des actions dédiées (confirmation explicite). */
export async function updatePublication(id: string, patch: unknown) {
  return run(async (tx) => {
    zId.parse(id);
    const p = zPatch.parse(patch);
    const keys = Object.keys(p) as (keyof typeof p)[];
    if (!keys.length) return getPublicationSummary(tx, id);
    const cur = (await tx.query<Record<string, unknown>>(`select * from public.publications where id = $1`, [id]))[0];
    if (!cur) throw new NotFound("Publication introuvable");
    if (p.target_date === null) p.target_time = null;
    const cols = Object.keys(p);
    const sets = cols.map((k, i) => `${k} = $${i + 2}`).join(", ");
    await tx.query(`update public.publications set ${sets}, updated_at = now() where id = $1`, [id, ...cols.map((k) => p[k as keyof typeof p])]);
    for (const k of cols) {
      if (LOGGED[k] && cur[k] !== p[k as keyof typeof p]) {
        await log(tx, { entity_type: "publication", entity_id: id, publication_id: id, action: LOGGED[k], from: (cur[k] as string) ?? null, to: (p[k as keyof typeof p] as string) ?? null });
      }
    }
    return getPublicationSummary(tx, id);
  });
}

const zDiffusion = z.discriminatedUnion("to", [
  z.object({ to: z.literal("programme"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise"), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure requise"), platform: z.string().max(120).default("") }),
  z.object({ to: z.literal("publie"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise"), time: zTime.default(null), url: z.union([zUrl, z.literal("")]).default("") }),
  z.object({ to: z.literal("annule") }),
  z.object({ to: z.literal("a_programmer") }),
]);

/**
 * Changement de statut de diffusion, toujours sur action explicite de l'utilisateur.
 * « Programmé » exige une date de programmation confirmée : l'application ne publie rien elle-même.
 */
export async function setDiffusion(id: string, input: unknown) {
  return run(async (tx) => {
    zId.parse(id);
    const d = zDiffusion.parse(input);
    const cur = (await tx.query<{ diffusion_status: string; target_date: string | null }>(`select diffusion_status, target_date from public.publications where id = $1`, [id]))[0];
    if (!cur) throw new NotFound("Publication introuvable");
    if (d.to === "programme") {
      const at = brusselsToUtcIso(d.date, d.time);
      await tx.query(
        `update public.publications set diffusion_status = 'programme', scheduled_at = $2, scheduled_platform = $3,
           target_date = coalesce(target_date, $4), updated_at = now() where id = $1`,
        [id, at, d.platform, d.date],
      );
      await log(tx, { entity_type: "publication", entity_id: id, publication_id: id, action: "diffusion", from: cur.diffusion_status, to: "programme", meta: { scheduled_at: at, platform: d.platform } });
    } else if (d.to === "publie") {
      const at = brusselsToUtcIso(d.date, d.time ?? "12:00");
      await tx.query(
        `update public.publications set diffusion_status = 'publie', published_at = $2, published_url = $3, updated_at = now() where id = $1`,
        [id, at, d.url],
      );
      await log(tx, { entity_type: "publication", entity_id: id, publication_id: id, action: "diffusion", from: cur.diffusion_status, to: "publie", meta: { published_at: at, url: d.url } });
    } else if (d.to === "annule") {
      await tx.query(`update public.publications set diffusion_status = 'annule', updated_at = now() where id = $1`, [id]);
      await log(tx, { entity_type: "publication", entity_id: id, publication_id: id, action: "diffusion", from: cur.diffusion_status, to: "annule" });
    } else {
      await tx.query(
        `update public.publications set diffusion_status = 'a_programmer', scheduled_at = null, scheduled_platform = '', published_at = null, published_url = '', updated_at = now() where id = $1`,
        [id],
      );
      await log(tx, { entity_type: "publication", entity_id: id, publication_id: id, action: "diffusion", from: cur.diffusion_status, to: "a_programmer" });
    }
    return getPublicationDetail(tx, id);
  });
}

/**
 * Déplacement / réordonnancement : place la publication dans (cycle, session) et applique l'ordre de la ligne cible.
 * Une session incompatible avec le cycle cible est refusée ; vers un autre cycle sans session, elle rejoint les contenus généraux.
 */
export async function movePublication(id: string, input: unknown) {
  return run(async (tx) => {
    zId.parse(id);
    const m = z.object({ cycle_id: zId, session_id: zId.nullable(), order: z.array(zId).max(5000).optional() }).parse(input);
    const cur = (await tx.query<{ cycle_id: string; session_id: string | null }>(`select cycle_id, session_id from public.publications where id = $1`, [id]))[0];
    if (!cur) throw new NotFound("Publication introuvable");
    await assertPlacement(tx, m.cycle_id, m.session_id);
    const moved = cur.cycle_id !== m.cycle_id || cur.session_id !== m.session_id;
    if (moved) {
      // Deux étapes pour ne jamais violer la contrainte (session, cycle).
      await tx.query(`update public.publications set session_id = null where id = $1`, [id]);
      await tx.query(`update public.publications set cycle_id = $2, session_id = $3, updated_at = now() where id = $1`, [id, m.cycle_id, m.session_id]);
    }
    let order = m.order;
    if (!order || !order.includes(id)) {
      const rows = await tx.query<{ id: string }>(
        `select id from public.publications where cycle_id = $1 and session_id is not distinct from $2 and id <> $3 order by position, created_at`,
        [m.cycle_id, m.session_id, id],
      );
      order = [...rows.map((r) => r.id), id];
    }
    const valid = await tx.query<{ id: string }>(
      `select id from public.publications where id = any($1::uuid[]) and cycle_id = $2 and session_id is not distinct from $3`,
      [order, m.cycle_id, m.session_id],
    );
    const ok = new Set(valid.map((r) => r.id));
    await applyOrder(tx, "publications", order.filter((x) => ok.has(x)));
    if (moved) {
      await log(tx, {
        entity_type: "publication",
        entity_id: id,
        publication_id: id,
        action: "moved",
        from: `${cur.cycle_id}/${cur.session_id ?? ""}`,
        to: `${m.cycle_id}/${m.session_id ?? ""}`,
      });
    }
    return getPublicationSummary(tx, id);
  });
}

/** Crée une copie indépendante (texte, métadonnées, fichiers recopiés, liens, tags). Diffusion remise à zéro. */
export async function duplicatePublication(id: string) {
  return run(async (tx, user) => {
    zId.parse(id);
    const src = (await tx.query<Record<string, unknown>>(`select * from public.publications where id = $1`, [id]))[0];
    if (!src) throw new NotFound("Publication introuvable");
    const [row] = await tx.query<{ id: string }>(
      `insert into public.publications (cycle_id, session_id, title, description, channel_tag_id, format_tag_id, audience_tag_id, nature_tag_id,
         production_status, diffusion_status, body, target_date, target_time, notes, position)
       select cycle_id, session_id, left(title || ' (copie)', 200), description, channel_tag_id, format_tag_id, audience_tag_id, nature_tag_id,
         production_status, 'a_programmer', body, target_date, target_time, notes, position + 0.5
       from public.publications where id = $1 returning id`,
      [id],
    );
    const atts = await tx.query<{ id: string; kind: string; storage_path: string; thumb_path: string | null; name: string; mime: string; size_bytes: number; width: number | null; height: number | null; duration_s: number | null; position: number }>(
      `select * from public.publication_attachments where publication_id = $1 and status = 'ready' order by position`,
      [id],
    );
    for (const a of atts) {
      const newId = randomUUID();
      const ext = a.storage_path.split(".").pop();
      const path = `${user.id}/${row.id}/${newId}.${ext}`;
      await copyFile(a.storage_path, path);
      let thumb: string | null = null;
      if (a.thumb_path) {
        thumb = `${user.id}/${row.id}/${newId}.thumb.webp`;
        await copyFile(a.thumb_path, thumb).catch(() => (thumb = null));
      }
      await tx.query(
        `insert into public.publication_attachments (id, publication_id, kind, storage_path, thumb_path, name, mime, size_bytes, width, height, duration_s, status, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ready',$12)`,
        [newId, row.id, a.kind, path, thumb, a.name, a.mime, a.size_bytes, a.width, a.height, a.duration_s, a.position],
      );
    }
    await tx.query(
      `insert into public.publication_links (publication_id, url, title, kind, position) select $2, url, title, kind, position from public.publication_links where publication_id = $1`,
      [id, row.id],
    );
    await tx.query(`insert into public.publication_tags (publication_id, tag_id) select $2, tag_id from public.publication_tags where publication_id = $1`, [id, row.id]);
    const order = await tx.query<{ id: string }>(
      `select id from public.publications where cycle_id = $1 and session_id is not distinct from $2 order by position, created_at`,
      [src.cycle_id, src.session_id],
    );
    await applyOrder(tx, "publications", order.map((r) => r.id));
    await log(tx, { entity_type: "publication", entity_id: row.id, publication_id: row.id, action: "duplicated", meta: { from: id } });
    return { publication: await getPublicationSummary(tx, row.id), order: order.map((r) => r.id) };
  });
}

export async function setArchived(id: string, archived: boolean) {
  return run(async (tx) => {
    zId.parse(id);
    await tx.query(`update public.publications set archived_at = ${archived ? "now()" : "null"}, updated_at = now() where id = $1`, [id]);
    await log(tx, { entity_type: "publication", entity_id: id, publication_id: id, action: archived ? "archived" : "unarchived" });
    return getPublicationSummary(tx, id);
  });
}

export async function deletePublication(id: string) {
  const res = await run(async (tx) => {
    zId.parse(id);
    const files = await tx.query<{ storage_path: string; thumb_path: string | null }>(
      `select storage_path, thumb_path from public.publication_attachments where publication_id = $1`,
      [id],
    );
    const del = await tx.query(`delete from public.publications where id = $1 returning id`, [id]);
    if (!del.length) throw new NotFound("Publication introuvable");
    return files.flatMap((f) => [f.storage_path, f.thumb_path ?? ""]);
  });
  if (res.ok) await removeFiles(res.data).catch(() => undefined);
  return res.ok ? { ok: true as const, data: true } : res;
}

export async function setPublicationTags(id: string, tagIds: string[]) {
  return run(async (tx) => {
    zId.parse(id);
    const list = z.array(zId).max(50).parse(tagIds);
    await tx.query(`delete from public.publication_tags where publication_id = $1`, [id]);
    if (list.length) {
      await tx.query(
        `insert into public.publication_tags (publication_id, tag_id)
         select $1, t.id from public.tags t where t.id = any($2::uuid[]) and t.dimension = 'libre' on conflict do nothing`,
        [id, list],
      );
    }
    await tx.query(`update public.publications set updated_at = now() where id = $1`, [id]);
    return getPublicationSummary(tx, id);
  });
}

// --- Liens --------------------------------------------------------------------

const zLink = z.object({
  url: zUrl,
  title: z.string().trim().max(200).default(""),
  kind: z.enum(["externe", "page", "publication"]).default("externe"),
});

export async function addLink(publicationId: string, input: unknown) {
  return run(async (tx) => {
    zId.parse(publicationId);
    const l = zLink.parse(input);
    const exists = await tx.query(`select 1 from public.publications where id = $1`, [publicationId]);
    if (!exists.length) throw new NotFound("Publication introuvable");
    await tx.query(
      `insert into public.publication_links (publication_id, url, title, kind, position)
       values ($1,$2,$3,$4,(select coalesce(max(position),0)+1 from public.publication_links where publication_id = $1))`,
      [publicationId, l.url, l.title, l.kind],
    );
    await log(tx, { entity_type: "publication", entity_id: publicationId, publication_id: publicationId, action: "link_added", to: l.url });
    return getPublicationDetail(tx, publicationId);
  });
}

export async function deleteLink(linkId: string) {
  return run(async (tx) => {
    zId.parse(linkId);
    const r = await tx.query<{ publication_id: string }>(`delete from public.publication_links where id = $1 returning publication_id`, [linkId]);
    if (!r.length) throw new NotFound("Lien introuvable");
    return getPublicationDetail(tx, r[0].publication_id);
  });
}
