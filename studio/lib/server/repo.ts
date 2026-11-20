import "server-only";
// Dépôt de données : toutes les requêtes SQL de l'application.
// Chaque fonction reçoit une transaction ouverte au nom de l'utilisateur (voir asUser) :
// sur Supabase, les politiques RLS limitent chaque requête aux lignes de l'utilisateur.
import type { Queryable } from "./db";
import type {
  ActivityEntry,
  Attachment,
  Cycle,
  PubLink,
  PublicationDetail,
  PublicationSummary,
  Prefs,
  SavedView,
  Session,
  Tag,
  TagDimension,
  TagColor,
} from "@/lib/domain";
import { signedUrls } from "./storage";

type Tx = Queryable;

async function one<T>(tx: Tx, sql: string, params?: unknown[]): Promise<T | null> {
  return (await tx.query<T>(sql, params))[0] ?? null;
}

export class NotFound extends Error {
  code = "NOT_FOUND";
}

// --- Lecture ------------------------------------------------------------------

export const CYCLE_COLS = `id, kind, name, description, audience_tag_id, category, start_date, end_date, status, links, notes, position`;
export const SESSION_COLS = `id, cycle_id, kind, title, date, start_time, end_time, location, description, position`;

const PUB_SUMMARY_SQL = `
select p.id, p.cycle_id, p.session_id, p.title, left(p.body, 320) as body_excerpt, p.body,
  p.channel_tag_id, p.format_tag_id, p.audience_tag_id, p.nature_tag_id,
  p.production_status, p.diffusion_status, p.target_date, p.target_time, p.scheduled_at, p.published_at,
  p.position, (p.archived_at is not null) as archived, p.updated_at,
  (select count(*)::int from public.publication_attachments a where a.publication_id = p.id and a.status = 'ready') as attachment_count,
  (select count(*)::int from public.publication_links l where l.publication_id = p.id) as link_count,
  (select json_build_object('kind', a.kind, 'path', a.storage_path, 'thumb', a.thumb_path, 'name', a.name)
     from public.publication_attachments a where a.publication_id = p.id and a.status = 'ready'
     order by a.position, a.created_at limit 1) as cover_raw,
  (select json_build_object('url', l.url, 'title', l.title)
     from public.publication_links l where l.publication_id = p.id order by l.position, l.created_at limit 1) as first_link,
  coalesce((select json_agg(t.tag_id) from public.publication_tags t where t.publication_id = p.id), '[]'::json) as tag_ids
from public.publications p`;

interface RawSummary extends Omit<PublicationSummary, "cover"> {
  cover_raw: { kind: string; path: string; thumb: string | null; name: string } | null;
}

/** Chemin à signer pour l'aperçu d'une carte (miniature en priorité). */
function coverPath(c: RawSummary["cover_raw"]): string | null {
  if (!c) return null;
  if (c.thumb) return c.thumb;
  if (c.kind === "image" || c.kind === "gif" || c.kind === "video") return c.path;
  return null;
}

async function withCovers(rows: RawSummary[]): Promise<PublicationSummary[]> {
  const urls = await signedUrls(rows.map((r) => coverPath(r.cover_raw)).filter((p): p is string => Boolean(p)));
  return rows.map(({ cover_raw, ...r }) => {
    const p = coverPath(cover_raw);
    return {
      ...r,
      cover: cover_raw ? { kind: cover_raw.kind as never, name: cover_raw.name, isThumb: Boolean(cover_raw.thumb), url: p ? (urls[p] ?? null) : null } : null,
    };
  });
}

export async function listPublications(tx: Tx, where = "", params: unknown[] = []): Promise<PublicationSummary[]> {
  const rows = await tx.query<RawSummary>(`${PUB_SUMMARY_SQL} ${where} order by p.position, p.created_at`, params);
  return withCovers(rows);
}

export async function getPublicationSummary(tx: Tx, id: string): Promise<PublicationSummary> {
  const [r] = await listPublications(tx, "where p.id = $1", [id]);
  if (!r) throw new NotFound("Publication introuvable");
  return r;
}

export async function loadBoard(tx: Tx) {
  const [cycles, sessions, publications, tags, savedViews, prefsRow] = await Promise.all([
    tx.query<Cycle>(`select ${CYCLE_COLS} from public.cycles order by position, created_at`),
    tx.query<Session>(`select ${SESSION_COLS} from public.sessions order by cycle_id, position, date nulls last`),
    listPublications(tx),
    tx.query<Tag>(`select id, dimension, label, color, position from public.tags order by dimension, position, lower(label)`),
    tx.query<SavedView>(`select id, name, filters from public.saved_views order by position, created_at`),
    one<{ prefs: Prefs }>(tx, `select prefs from public.user_prefs`),
  ]);
  return { cycles, sessions, publications, tags, savedViews, prefs: prefsRow?.prefs ?? {} };
}

export async function getPublicationDetail(tx: Tx, id: string): Promise<PublicationDetail> {
  const summary = await getPublicationSummary(tx, id);
  const extra = await one<{ description: string; scheduled_platform: string; published_url: string; notes: string; created_at: string }>(
    tx,
    `select description, scheduled_platform, published_url, notes, created_at from public.publications where id = $1`,
    [id],
  );
  const attachments = await listAttachments(tx, id);
  const links = await tx.query<PubLink>(
    `select id, publication_id, url, title, kind, position from public.publication_links where publication_id = $1 order by position, created_at`,
    [id],
  );
  const activity = await tx.query<ActivityEntry>(
    `select id, action, from_value, to_value, meta, created_at from public.activity_log where publication_id = $1 order by created_at desc limit 50`,
    [id],
  );
  return { ...summary, ...extra!, attachments, links, activity };
}

export async function listAttachments(tx: Tx, publicationId: string): Promise<Attachment[]> {
  const rows = await tx.query<Omit<Attachment, "url" | "thumb_url">>(
    `select id, publication_id, kind, storage_path, thumb_path, name, mime, size_bytes, width, height, duration_s, status, position
     from public.publication_attachments where publication_id = $1 and status = 'ready' order by position, created_at`,
    [publicationId],
  );
  return signAttachments(rows);
}

export async function signAttachments(rows: Omit<Attachment, "url" | "thumb_url">[]): Promise<Attachment[]> {
  // Les HTML ne sont jamais servis directement : aperçu isolé via /api/preview.
  const urls = await signedUrls(rows.flatMap((r) => [r.kind === "html" ? "" : r.storage_path, r.thumb_path ?? ""]));
  return rows.map((r) => ({
    ...r,
    url: r.kind === "html" ? null : (urls[r.storage_path] ?? null),
    thumb_url: r.thumb_path ? (urls[r.thumb_path] ?? null) : null,
  }));
}

// --- Journal ------------------------------------------------------------------

export async function log(
  tx: Tx,
  entry: { entity_type: string; entity_id: string; publication_id?: string | null; action: string; from?: string | null; to?: string | null; meta?: object },
) {
  await tx.query(
    `insert into public.activity_log (entity_type, entity_id, publication_id, action, from_value, to_value, meta) values ($1,$2,$3,$4,$5,$6,$7)`,
    [entry.entity_type, entry.entity_id, entry.publication_id ?? null, entry.action, entry.from ?? null, entry.to ?? null, JSON.stringify(entry.meta ?? {})],
  );
}

// --- Tags ---------------------------------------------------------------------

export const DEFAULT_TAGS: { dimension: TagDimension; label: string; color: TagColor }[] = [
  { dimension: "canal", label: "LinkedIn", color: "blue" },
  { dimension: "canal", label: "Instagram", color: "coral" },
  { dimension: "canal", label: "Facebook", color: "violet" },
  { dimension: "canal", label: "Newsletter", color: "yellow" },
  { dimension: "canal", label: "Site web", color: "teal" },
  { dimension: "canal", label: "YouTube", color: "orange" },
  { dimension: "public", label: "Formation Continue", color: "teal" },
  { dimension: "public", label: "Haute École", color: "blue" },
  { dimension: "public", label: "Alumni", color: "violet" },
  { dimension: "nature", label: "Organique", color: "green" },
  { dimension: "nature", label: "Ads", color: "orange" },
  { dimension: "nature", label: "Institutionnel", color: "gray" },
  { dimension: "nature", label: "Événementiel", color: "coral" },
  { dimension: "format", label: "Visuel", color: "gray" },
  { dimension: "format", label: "Carrousel", color: "gray" },
  { dimension: "format", label: "Vidéo", color: "gray" },
  { dimension: "format", label: "Story", color: "gray" },
  { dimension: "format", label: "Article", color: "gray" },
  { dimension: "format", label: "Email", color: "gray" },
  { dimension: "format", label: "Page web", color: "gray" },
  { dimension: "format", label: "Document", color: "gray" },
  { dimension: "libre", label: "teasing", color: "violet" },
  { dimension: "libre", label: "lancement", color: "green" },
  { dimension: "libre", label: "J-7", color: "orange" },
  { dimension: "libre", label: "rappel", color: "yellow" },
  { dimension: "libre", label: "inscriptions", color: "teal" },
];

/** Première connexion : crée les tags par défaut (modifiables). */
export async function ensureDefaults(tx: Tx) {
  const row = await one<{ n: number }>(tx, `select count(*)::int as n from public.tags`);
  if (row && row.n > 0) return;
  let i = 0;
  for (const t of DEFAULT_TAGS) {
    await tx.query(`insert into public.tags (dimension, label, color, position) values ($1,$2,$3,$4) on conflict do nothing`, [
      t.dimension,
      t.label,
      t.color,
      i++,
    ]);
  }
}

// --- Positions ----------------------------------------------------------------

export async function nextPosition(tx: Tx, table: "cycles" | "sessions" | "publications", where = "", params: unknown[] = []) {
  const r = await one<{ p: number }>(tx, `select coalesce(max(position), 0) + 1 as p from public.${table} ${where}`, params);
  return r?.p ?? 1;
}

/** Réécrit les positions dans l'ordre donné (1..n). */
export async function applyOrder(tx: Tx, table: "cycles" | "sessions" | "publications" | "publication_attachments" | "publication_links" | "tags", ids: string[]) {
  if (!ids.length) return;
  await tx.query(
    `update public.${table} t set position = o.ord from unnest($1::uuid[]) with ordinality as o(id, ord) where t.id = o.id`,
    [ids],
  );
}
