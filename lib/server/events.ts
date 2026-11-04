import "server-only";
import crypto from "node:crypto";
import { q, q1, tx, type Queryable } from "./db";
import { randomSlug } from "./crypto";
import type { CalendarSession, EventInput, EventStatus, PublicEvent, SessionInput } from "@/lib/types";
import { localToUtcOrThrow, formatLongDate, formatTime } from "@/lib/time";
import { sortSessions, validateEvent } from "@/lib/validation";
import { buildDescription, buildLocation, buildSummary } from "@/lib/content";

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  description: string;
  info_url: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  organizer_phone: string | null;
  image_url: string | null;
  format: string;
  location_name: string | null;
  address: string | null;
  room: string | null;
  online_url: string | null;
  online_platform: string | null;
  timezone: string;
  reminder_minutes: number | null;
  session_selection: string;
  status: EventStatus;
  status_before_archive: EventStatus | null;
  sequence: number;
  is_demo: boolean;
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  cancelled_at: Date | null;
  first_start_utc: Date | null;
  last_end_utc: Date | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface SessionRow {
  id: string;
  event_id: string;
  title: string | null;
  date: string;
  start_time: string;
  end_time: string;
  start_utc: Date;
  end_utc: Date;
  location_name: string | null;
  address: string | null;
  room: string | null;
  online_url: string | null;
  status: "active" | "cancelled";
  sequence: number;
  content_hash: string;
  updated_at: Date;
}

const iso = (d: Date | string) => new Date(d).toISOString();
const nn = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export function toPublicEvent(e: EventRow, sessions: SessionRow[]): PublicEvent {
  const sorted = [...sessions].sort((a, b) => +new Date(a.start_utc) - +new Date(b.start_utc));
  const activeCount = sorted.filter((s) => s.status === "active").length;
  let idx = 0;
  const cal: CalendarSession[] = sorted.map((s) => {
    if (s.status === "active") idx++;
    return {
      id: s.id,
      index: s.status === "active" ? idx : 0,
      total: activeCount,
      title: s.title,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      startUtc: iso(s.start_utc),
      endUtc: iso(s.end_utc),
      locationName: s.location_name,
      address: s.address,
      room: s.room,
      onlineUrl: s.online_url,
      status: s.status,
      sequence: s.sequence,
      updatedAt: iso(s.updated_at),
    };
  });
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    type: e.type as PublicEvent["type"],
    description: e.description,
    infoUrl: e.info_url,
    organizerName: e.organizer_name,
    organizerEmail: e.organizer_email,
    organizerPhone: e.organizer_phone,
    imageUrl: e.image_url,
    format: e.format as PublicEvent["format"],
    locationName: e.location_name,
    address: e.address,
    room: e.room,
    onlineUrl: e.online_url,
    onlinePlatform: e.online_platform,
    timezone: e.timezone,
    reminderMinutes: e.reminder_minutes,
    sessionSelection: e.session_selection as PublicEvent["sessionSelection"],
    status: e.status,
    sequence: e.sequence,
    isDemo: e.is_demo,
    cancelReason: e.cancel_reason,
    updatedAt: iso(e.updated_at),
    sessions: cal,
  };
}

export function toEventInput(e: EventRow, sessions: SessionRow[]): EventInput {
  return {
    title: e.title,
    type: e.type as EventInput["type"],
    description: e.description,
    infoUrl: e.info_url ?? "",
    organizerName: e.organizer_name ?? "",
    organizerEmail: e.organizer_email ?? "",
    organizerPhone: e.organizer_phone ?? "",
    imageUrl: e.image_url ?? "",
    format: e.format as EventInput["format"],
    locationName: e.location_name ?? "",
    address: e.address ?? "",
    room: e.room ?? "",
    onlineUrl: e.online_url ?? "",
    onlinePlatform: e.online_platform ?? "",
    timezone: e.timezone,
    reminderMinutes: e.reminder_minutes,
    sessionSelection: e.session_selection as EventInput["sessionSelection"],
    sessions: [...sessions]
      .sort((a, b) => +new Date(a.start_utc) - +new Date(b.start_utc))
      .map((s) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        locationName: s.location_name,
        address: s.address,
        room: s.room,
        onlineUrl: s.online_url,
        status: s.status,
      })),
  };
}

async function loadSessions(db: Queryable, eventId: string) {
  return db.query<SessionRow>(`select * from sessions where event_id = $1 order by start_utc`, [eventId]);
}

export async function getEventRowById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const e = await q1<EventRow>(`select * from events where id = $1`, [id]);
  if (!e) return null;
  return { row: e, sessions: await q<SessionRow>(`select * from sessions where event_id = $1 order by start_utc`, [id]) };
}

export async function getPublicEventBySlug(slug: string): Promise<PublicEvent | null> {
  if (!/^[a-z0-9-]{4,64}$/.test(slug)) return null;
  const e = await q1<EventRow>(`select * from events where slug = $1`, [slug]);
  if (!e) return null;
  const sessions = await q<SessionRow>(`select * from sessions where event_id = $1 order by start_utc`, [e.id]);
  return toPublicEvent(e, sessions);
}

export async function getPublicEventById(id: string): Promise<PublicEvent | null> {
  const r = await getEventRowById(id);
  return r ? toPublicEvent(r.row, r.sessions) : null;
}

/** Empreinte de tout ce qui finit dans le calendrier : sert à détecter une modification réelle. */
function contentHash(ev: PublicEvent, s: CalendarSession): string {
  const payload = JSON.stringify([
    buildSummary(ev, s),
    buildLocation(ev, s),
    buildDescription(ev, s, { pageUrl: "" }),
    s.startUtc,
    s.endUtc,
    s.status,
    ev.status === "cancelled", // brouillon → publié ne change pas le contenu du calendrier
    ev.reminderMinutes,
  ]);
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

async function uniqueSlug(db: Queryable) {
  for (let i = 0; i < 10; i++) {
    const s = randomSlug(8);
    const exists = await db.query(`select 1 from events where slug = $1`, [s]);
    if (exists.length === 0) return s;
  }
  throw new Error("Impossible de générer un identifiant unique");
}

function eventColumns(input: EventInput) {
  return [
    input.title.trim(),
    input.type,
    input.description.trim(),
    nn(input.infoUrl),
    nn(input.organizerName),
    nn(input.organizerEmail),
    nn(input.organizerPhone),
    nn(input.imageUrl),
    input.format,
    nn(input.locationName),
    nn(input.address),
    nn(input.room),
    input.format === "onsite" ? null : nn(input.onlineUrl),
    input.format === "onsite" ? null : nn(input.onlinePlatform),
    input.timezone || "Europe/Brussels",
    input.reminderMinutes,
    input.sessionSelection,
  ];
}

export class ValidationFailed extends Error {
  constructor(public issues: { field: string; message: string }[]) {
    super("Validation");
  }
}

export interface SaveResult {
  id: string;
  slug: string;
  changes: string[];
  changedSessionIds: string[];
}

/**
 * Crée ou met à jour un événement et ses séances de manière transactionnelle.
 * Recalcule les empreintes ; incrémente SEQUENCE uniquement lorsque le contenu publié change.
 */
export async function saveEvent(opts: {
  id?: string;
  input: EventInput;
  userId: string | null;
  isDemo?: boolean;
  publish?: boolean;
}): Promise<SaveResult> {
  return tx((db) => saveEventTx(db, opts));
}

export async function saveEventTx(
  db: Queryable,
  opts: { id?: string; input: EventInput; userId: string | null; isDemo?: boolean; publish?: boolean }
): Promise<SaveResult> {
  const { input } = opts;
  const v = validateEvent(input, opts.publish ? "publish" : "draft");
  if (v.errors.length) throw new ValidationFailed(v.errors);
  {
    let eventId = opts.id;
    let slug: string;
    let before: PublicEvent | null = null;
    let row: EventRow;
    const cols = eventColumns(input);
    if (eventId) {
      const existing = (await db.query<EventRow>(`select * from events where id = $1 for update`, [eventId]))[0];
      if (!existing) throw new Error("Événement introuvable");
      before = toPublicEvent(existing, await loadSessions(db, eventId));
      slug = existing.slug;
      row = (
        await db.query<EventRow>(
          `update events set title=$2, type=$3, description=$4, info_url=$5, organizer_name=$6, organizer_email=$7,
             organizer_phone=$8, image_url=$9, format=$10, location_name=$11, address=$12, room=$13, online_url=$14,
             online_platform=$15, timezone=$16, reminder_minutes=$17, session_selection=$18, updated_by=$19
           where id=$1 returning *`,
          [eventId, ...cols, opts.userId]
        )
      )[0];
    } else {
      slug = await uniqueSlug(db);
      row = (
        await db.query<EventRow>(
          `insert into events (slug, title, type, description, info_url, organizer_name, organizer_email, organizer_phone,
             image_url, format, location_name, address, room, online_url, online_platform, timezone, reminder_minutes,
             session_selection, created_by, updated_by, is_demo)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20) returning *`,
          [slug, ...cols, opts.userId, !!opts.isDemo]
        )
      )[0];
      eventId = row.id;
    }

    const wasPublished = !!row.published_at;
    const existingSessions = await loadSessions(db, eventId);
    const keep = new Set<string>();
    for (const s of sortSessions(input.sessions)) {
      const start = localToUtcOrThrow(s.date, s.startTime, input.timezone);
      const end = localToUtcOrThrow(s.date, s.endTime, input.timezone);
      const vals = [nn(s.title ?? null), s.date, s.startTime, s.endTime, start.toISOString(), end.toISOString(), nn(s.locationName), nn(s.address), nn(s.room), nn(s.onlineUrl), s.status ?? "active"];
      if (s.id && existingSessions.some((x) => x.id === s.id)) {
        keep.add(s.id);
        await db.query(
          `update sessions set title=$2, date=$3, start_time=$4, end_time=$5, start_utc=$6, end_utc=$7, location_name=$8,
             address=$9, room=$10, online_url=$11, status=$12 where id=$1`,
          [s.id, ...vals]
        );
      } else {
        const ins = await db.query<{ id: string }>(
          `insert into sessions (event_id, title, date, start_time, end_time, start_utc, end_utc, location_name, address, room, online_url, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
          [eventId, ...vals]
        );
        keep.add(ins[0].id);
      }
    }
    for (const old of existingSessions) {
      if (keep.has(old.id)) continue;
      // Une séance déjà publiée n'est jamais effacée : elle est annulée, pour pouvoir l'annuler aussi dans les calendriers.
      if (wasPublished) await db.query(`update sessions set status='cancelled' where id=$1`, [old.id]);
      else await db.query(`delete from sessions where id=$1`, [old.id]);
    }

    const changedSessionIds = await refreshHashes(db, eventId, wasPublished);
    const changes = before ? describeChanges(before, await loadPublic(db, eventId)) : [];
    if (opts.id) await db.query(`insert into event_changes (event_id, user_id, action, summary) values ($1,$2,'update',$3::jsonb)`, [eventId, opts.userId, JSON.stringify(changes)]);
    else await db.query(`insert into event_changes (event_id, user_id, action, summary) values ($1,$2,'create','[]'::jsonb)`, [eventId, opts.userId]);
    return { id: eventId, slug, changes, changedSessionIds };
  }
}

async function loadPublic(db: Queryable, eventId: string) {
  const e = (await db.query<EventRow>(`select * from events where id=$1`, [eventId]))[0];
  return toPublicEvent(e, await loadSessions(db, eventId));
}

/** Recalcule les empreintes ; renvoie les séances dont le contenu calendrier a changé. */
async function refreshHashes(db: Queryable, eventId: string, bumpSequence: boolean): Promise<string[]> {
  const ev = await loadPublic(db, eventId);
  const rows = await loadSessions(db, eventId);
  const changed: string[] = [];
  for (const s of ev.sessions) {
    const h = contentHash(ev, s);
    const row = rows.find((r) => r.id === s.id)!;
    if (row.content_hash !== h) {
      changed.push(s.id);
      await db.query(
        `update sessions set content_hash=$2, sequence = sequence + $3, updated_at = now() where id=$1`,
        [s.id, h, bumpSequence && row.content_hash ? 1 : 0]
      );
    }
  }
  const active = rows.filter((r) => r.status === "active");
  const first = active.length ? new Date(Math.min(...active.map((r) => +new Date(r.start_utc)))) : null;
  const last = active.length ? new Date(Math.max(...active.map((r) => +new Date(r.end_utc)))) : null;
  await db.query(
    `update events set first_start_utc=$2, last_end_utc=$3, sequence = sequence + $4,
       updated_at = case when $5 then now() else updated_at end where id=$1`,
    [eventId, first?.toISOString() ?? null, last?.toISOString() ?? null, bumpSequence && changed.length ? 1 : 0, changed.length > 0]
  );
  return changed;
}

function sessLabel(s: CalendarSession, total: number) {
  return total > 1 ? `Séance du ${formatLongDate(s.date)}` : `L'événement`;
}

/** Résumé lisible des changements, utilisé pour informer les participants par les canaux EPHEC. */
export function describeChanges(a: PublicEvent, b: PublicEvent): string[] {
  const out: string[] = [];
  if (a.title !== b.title) out.push(`Nouveau nom : « ${b.title} »`);
  if (a.format !== b.format) out.push(`Le format a changé.`);
  const place = (e: PublicEvent) => [e.locationName, e.room, e.address].filter(Boolean).join(", ");
  if (place(a) !== place(b) && b.format !== "online") out.push(`Nouveau lieu : ${place(b) || "à préciser"}`);
  if ((a.onlineUrl ?? "") !== (b.onlineUrl ?? "") && b.format !== "onsite") out.push(`Nouveau lien de connexion : ${b.onlineUrl ?? "à venir"}`);
  const total = b.sessions.filter((s) => s.status === "active").length;
  for (const s of b.sessions) {
    const old = a.sessions.find((x) => x.id === s.id);
    if (!old) {
      if (s.status === "active") out.push(`Nouvelle séance : ${formatLongDate(s.date)}, ${formatTime(s.startTime)} – ${formatTime(s.endTime)}`);
      continue;
    }
    if (old.status === "active" && s.status === "cancelled") {
      out.push(`Séance annulée : ${formatLongDate(old.date)}, ${formatTime(old.startTime)} – ${formatTime(old.endTime)}`);
      continue;
    }
    if (old.date !== s.date || old.startTime !== s.startTime || old.endTime !== s.endTime)
      out.push(
        `${sessLabel(old, total)} déplacée : désormais le ${formatLongDate(s.date)}, ${formatTime(s.startTime)} – ${formatTime(s.endTime)}`
      );
    const op = [old.locationName, old.room, old.address].join("|");
    const np = [s.locationName, s.room, s.address].join("|");
    if (op !== np && (s.locationName || s.address || s.room)) out.push(`${sessLabel(s, total)} : lieu modifié (${[s.locationName, s.room, s.address].filter(Boolean).join(", ")})`);
    if ((old.onlineUrl ?? "") !== (s.onlineUrl ?? "") && s.onlineUrl) out.push(`${sessLabel(s, total)} : nouveau lien de connexion`);
  }
  if (a.reminderMinutes !== b.reminderMinutes) out.push("Rappel modifié (calendriers connectés uniquement).");
  if (a.description !== b.description) out.push("Description mise à jour.");
  return out;
}

export async function setStatus(id: string, action: "publish" | "cancel" | "archive" | "unarchive" | "restore", userId: string, reason?: string) {
  return tx(async (db) => {
    const e = (await db.query<EventRow>(`select * from events where id=$1 for update`, [id]))[0];
    if (!e) throw new Error("Événement introuvable");
    switch (action) {
      case "publish": {
        if (e.status !== "draft") break;
        const sessions = await loadSessions(db, id);
        const v = validateEvent(toEventInput(e, sessions), "publish");
        if (v.errors.length) throw new ValidationFailed(v.errors);
        await db.query(`update events set status='published', published_at=coalesce(published_at, now()), updated_by=$2 where id=$1`, [id, userId]);
        break;
      }
      case "cancel":
        if (e.status !== "published") throw new Error("Seul un événement publié peut être annulé.");
        await db.query(`update events set status='cancelled', cancelled_at=now(), cancel_reason=$2, updated_by=$3 where id=$1`, [id, nn(reason ?? null), userId]);
        break;
      case "restore":
        if (e.status !== "cancelled") break;
        await db.query(`update events set status='published', cancelled_at=null, cancel_reason=null, updated_by=$2 where id=$1`, [id, userId]);
        break;
      case "archive":
        await db.query(`update events set status_before_archive=status, status='archived', updated_by=$2 where id=$1 and status <> 'archived'`, [id, userId]);
        break;
      case "unarchive":
        await db.query(`update events set status=coalesce(status_before_archive,'draft'), status_before_archive=null, updated_by=$2 where id=$1 and status='archived'`, [id, userId]);
        break;
    }
    const changed = action === "cancel" || action === "restore" ? await refreshHashes(db, id, true) : [];
    await db.query(`insert into event_changes (event_id, user_id, action, summary) values ($1,$2,$3,'[]'::jsonb)`, [id, userId, action]);
    return { changedSessionIds: changed };
  });
}

export async function duplicateEvent(id: string, userId: string) {
  const r = await getEventRowById(id);
  if (!r) throw new Error("Événement introuvable");
  const input = toEventInput(r.row, r.sessions.filter((s) => s.status === "active"));
  input.title = `${input.title} (copie)`;
  input.sessions = input.sessions.map((s) => ({ ...s, id: undefined, status: "active" }));
  return saveEvent({ input, userId });
}

export interface DashboardEvent {
  id: string;
  slug: string;
  title: string;
  type: string;
  format: string;
  status: EventStatus;
  isDemo: boolean;
  firstStart: string | null;
  lastEnd: string | null;
  sessionCount: number;
  updatedAt: string;
  timezone: string;
  nextDate: string | null;
  firstDate: string | null;
  views: number;
  clicks: number;
  syncIssues: number;
}

export async function listDashboardEvents(): Promise<DashboardEvent[]> {
  const rows = await q<EventRow & { session_count: number; first_date: string | null; next_date: string | null; views: number; clicks: number; sync_issues: number }>(`
    select e.*,
      (select count(*)::int from sessions s where s.event_id = e.id and s.status='active') as session_count,
      (select min(date) from sessions s where s.event_id = e.id and s.status='active') as first_date,
      (select min(date) from sessions s where s.event_id = e.id and s.status='active' and s.end_utc > now()) as next_date,
      coalesce((select sum(count)::int from stats_daily d where d.event_id=e.id and d.kind='view'),0) as views,
      coalesce((select sum(count)::int from stats_daily d where d.event_id=e.id and d.kind='click'),0) as clicks,
      (select count(*)::int from synced_events se join sessions s on s.id=se.session_id where s.event_id=e.id and se.state='error') as sync_issues
    from events e order by coalesce(e.first_start_utc, e.created_at) asc`);
  return rows.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    type: e.type,
    format: e.format,
    status: e.status,
    isDemo: e.is_demo,
    firstStart: e.first_start_utc ? iso(e.first_start_utc) : null,
    lastEnd: e.last_end_utc ? iso(e.last_end_utc) : null,
    sessionCount: e.session_count,
    updatedAt: iso(e.updated_at),
    timezone: e.timezone,
    nextDate: e.next_date,
    firstDate: e.first_date,
    views: e.views,
    clicks: e.clicks,
    syncIssues: e.sync_issues,
  }));
}

export async function getEventHistory(id: string) {
  return q<{ action: string; summary: string[]; created_at: Date; user_name: string | null }>(
    `select c.action, c.summary, c.created_at, u.name as user_name from event_changes c left join users u on u.id=c.user_id
     where c.event_id=$1 order by c.created_at desc limit 20`,
    [id]
  );
}

export type { SessionInput };
