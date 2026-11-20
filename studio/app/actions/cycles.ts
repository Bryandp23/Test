"use server";
import { z } from "zod";
import { run, UserError, zDate, zId, zTime, zUrl } from "@/lib/server/action";
import { applyOrder, CYCLE_COLS, log, nextPosition, SESSION_COLS, NotFound } from "@/lib/server/repo";
import type { Cycle, Session } from "@/lib/domain";
import { removeFiles } from "@/lib/server/storage";

const zSessionInput = z.object({
  title: z.string().trim().min(1, "Titre de session requis").max(120),
  kind: z.enum(["session", "info", "autre"]).default("session"),
  date: zDate.default(null),
  start_time: zTime.default(null),
  end_time: zTime.default(null),
  location: z.string().max(200).default(""),
});

const zCycleInput = z.object({
  kind: z.enum(["cycle", "projet"]).default("cycle"),
  name: z.string().trim().min(1, "Le nom est requis").max(120),
  description: z.string().max(5000).default(""),
  audience_tag_id: zId.nullable().default(null),
  category: z.string().max(80).default(""),
  start_date: zDate.default(null),
  end_date: zDate.default(null),
  status: z.enum(["a_venir", "en_cours", "termine", "archive"]).default("a_venir"),
  links: z.array(z.object({ url: zUrl, title: z.string().max(200).default("") })).max(30).default([]),
  notes: z.string().max(20000).default(""),
});

function checkDates(start: string | null, end: string | null) {
  if (start && end && end < start) throw new UserError("La date de fin précède la date de début.");
}

/** Tri chronologique : sessions datées d'abord (date, heure), puis non datées dans l'ordre de saisie. */
function chrono<T extends { date: string | null; start_time: string | null }>(list: T[]): T[] {
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      if (a.s.date && b.s.date) return a.s.date.localeCompare(b.s.date) || (a.s.start_time ?? "").localeCompare(b.s.start_time ?? "") || a.i - b.i;
      if (a.s.date) return -1;
      if (b.s.date) return 1;
      return a.i - b.i;
    })
    .map((x) => x.s);
}

export async function createCycle(input: unknown) {
  return run(async (tx) => {
    const raw = z.object({ sessions: z.array(zSessionInput).max(100).default([]) }).passthrough().parse(input);
    const c = zCycleInput.parse(input);
    checkDates(c.start_date, c.end_date);
    // Nouveau cycle en tête du board.
    const pos = (await tx.query<{ p: number }>(`select coalesce(min(position), 1) - 1 as p from public.cycles`))[0].p;
    const [cycle] = await tx.query<Cycle>(
      `insert into public.cycles (kind, name, description, audience_tag_id, category, start_date, end_date, status, links, notes, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) returning ${CYCLE_COLS}`,
      [c.kind, c.name, c.description, c.audience_tag_id, c.category, c.start_date, c.end_date, c.status, JSON.stringify(c.links), c.notes, pos],
    );
    const sessions: Session[] = [];
    if (c.kind === "cycle") {
      let i = 1;
      for (const s of chrono(raw.sessions)) {
        const [row] = await tx.query<Session>(
          `insert into public.sessions (cycle_id, kind, title, date, start_time, end_time, location, position)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${SESSION_COLS}`,
          [cycle.id, s.kind, s.title, s.date, s.start_time, s.end_time, s.location, i++],
        );
        sessions.push(row);
      }
    }
    await log(tx, { entity_type: "cycle", entity_id: cycle.id, action: "created", to: cycle.name });
    return { cycle, sessions };
  });
}

export async function updateCycle(id: string, patch: unknown) {
  return run(async (tx) => {
    zId.parse(id);
    const p = zCycleInput.partial().parse(patch);
    const cur = (await tx.query<Cycle>(`select ${CYCLE_COLS} from public.cycles where id = $1`, [id]))[0];
    if (!cur) throw new NotFound("Cycle introuvable");
    const next = { ...cur, ...p };
    checkDates(next.start_date, next.end_date);
    const [row] = await tx.query<Cycle>(
      `update public.cycles set kind=$2, name=$3, description=$4, audience_tag_id=$5, category=$6, start_date=$7, end_date=$8,
         status=$9, links=$10::jsonb, notes=$11, updated_at=now() where id=$1 returning ${CYCLE_COLS}`,
      [id, next.kind, next.name, next.description, next.audience_tag_id, next.category, next.start_date, next.end_date, next.status, JSON.stringify(next.links), next.notes],
    );
    if (p.status && p.status !== cur.status) await log(tx, { entity_type: "cycle", entity_id: id, action: "status", from: cur.status, to: p.status });
    return row;
  });
}

export async function reorderCycles(ids: string[]) {
  return run(async (tx) => {
    await applyOrder(tx, "cycles", z.array(zId).max(5000).parse(ids));
    return true;
  });
}

/** Duplique la structure (cycle + sessions). Les publications ne sont pas copiées. */
export async function duplicateCycle(id: string) {
  return run(async (tx) => {
    zId.parse(id);
    const src = (await tx.query<Cycle>(`select ${CYCLE_COLS} from public.cycles where id = $1`, [id]))[0];
    if (!src) throw new NotFound("Cycle introuvable");
    const [cycle] = await tx.query<Cycle>(
      `insert into public.cycles (kind, name, description, audience_tag_id, category, start_date, end_date, status, links, notes, position)
       select kind, left(name || ' (copie)', 120), description, audience_tag_id, category, start_date, end_date, 'a_venir', links, notes, position + 0.5
       from public.cycles where id = $1 returning ${CYCLE_COLS}`,
      [id],
    );
    const sessions = await tx.query<Session>(
      `insert into public.sessions (cycle_id, kind, title, date, start_time, end_time, location, description, position)
       select $2, kind, title, date, start_time, end_time, location, description, position from public.sessions where cycle_id = $1
       returning ${SESSION_COLS}`,
      [id, cycle.id],
    );
    const all = await tx.query<{ id: string }>(`select id from public.cycles order by position, created_at`);
    await applyOrder(tx, "cycles", all.map((r) => r.id));
    const fresh = (await tx.query<Cycle>(`select ${CYCLE_COLS} from public.cycles where id = $1`, [cycle.id]))[0];
    await log(tx, { entity_type: "cycle", entity_id: cycle.id, action: "duplicated", meta: { from: id } });
    return { cycle: fresh, sessions: sessions.sort((a, b) => a.position - b.position), order: all.map((r) => r.id) };
  });
}

export async function deleteCycle(id: string) {
  const res = await run(async (tx) => {
    zId.parse(id);
    const files = await tx.query<{ storage_path: string; thumb_path: string | null }>(
      `select a.storage_path, a.thumb_path from public.publication_attachments a join public.publications p on p.id = a.publication_id where p.cycle_id = $1`,
      [id],
    );
    const del = await tx.query(`delete from public.cycles where id = $1 returning id`, [id]);
    if (!del.length) throw new NotFound("Cycle introuvable");
    return files.flatMap((f) => [f.storage_path, f.thumb_path ?? ""]);
  });
  if (res.ok) await removeFiles(res.data).catch(() => undefined);
  return res.ok ? { ok: true as const, data: true } : res;
}
