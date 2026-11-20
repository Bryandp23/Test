"use server";
import { z } from "zod";
import { run, zDate, zId, zTime } from "@/lib/server/action";
import { applyOrder, log, nextPosition, NotFound, SESSION_COLS } from "@/lib/server/repo";
import type { Session } from "@/lib/domain";
import { addDays, diffDays } from "@/lib/time";

const zSession = z.object({
  title: z.string().trim().min(1, "Le titre est requis").max(120),
  kind: z.enum(["session", "info", "autre"]).default("session"),
  date: zDate.default(null),
  start_time: zTime.default(null),
  end_time: zTime.default(null),
  location: z.string().max(200).default(""),
  description: z.string().max(5000).default(""),
});

export async function createSession(cycleId: string, input: unknown) {
  return run(async (tx) => {
    zId.parse(cycleId);
    const s = zSession.parse(input);
    const cyc = await tx.query<{ kind: string }>(`select kind from public.cycles where id = $1`, [cycleId]);
    if (!cyc.length) throw new NotFound("Cycle introuvable");
    // Position chronologique : juste avant la première session datée plus tardive.
    let pos = await nextPosition(tx, "sessions", "where cycle_id = $1", [cycleId]);
    if (s.date) {
      const later = await tx.query<{ position: number }>(
        `select position from public.sessions where cycle_id = $1 and date > $2 order by position limit 1`,
        [cycleId, s.date],
      );
      if (later.length) {
        const prev = await tx.query<{ position: number }>(
          `select coalesce(max(position), $2 - 1) as position from public.sessions where cycle_id = $1 and position < $2`,
          [cycleId, later[0].position],
        );
        pos = (prev[0].position + later[0].position) / 2;
      }
    }
    if (cyc[0].kind === "projet") await tx.query(`update public.cycles set kind = 'cycle' where id = $1`, [cycleId]);
    const [row] = await tx.query<Session>(
      `insert into public.sessions (cycle_id, kind, title, date, start_time, end_time, location, description, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${SESSION_COLS}`,
      [cycleId, s.kind, s.title, s.date, s.start_time, s.end_time, s.location, s.description, pos],
    );
    return row;
  });
}

export interface DateImpact {
  id: string;
  title: string;
  target_date: string;
  diffusion_status: string;
}

/** Met à jour une session. Si sa date change, renvoie les publications datées concernées (aucune n'est modifiée ici). */
export async function updateSession(id: string, patch: unknown) {
  return run(async (tx) => {
    zId.parse(id);
    const p = zSession.partial().parse(patch);
    const cur = (await tx.query<Session>(`select ${SESSION_COLS} from public.sessions where id = $1`, [id]))[0];
    if (!cur) throw new NotFound("Session introuvable");
    const n = { ...cur, ...p };
    const [row] = await tx.query<Session>(
      `update public.sessions set title=$2, kind=$3, date=$4, start_time=$5, end_time=$6, location=$7, description=$8, updated_at=now()
       where id=$1 returning ${SESSION_COLS}`,
      [id, n.title, n.kind, n.date, n.start_time, n.end_time, n.location, n.description],
    );
    let impact: DateImpact[] = [];
    let delta = 0;
    if (cur.date && n.date && cur.date !== n.date) {
      delta = diffDays(n.date, cur.date);
      impact = await tx.query<DateImpact>(
        `select id, title, target_date, diffusion_status from public.publications
         where session_id = $1 and target_date is not null and archived_at is null and diffusion_status in ('a_programmer','programme')
         order by target_date`,
        [id],
      );
      await log(tx, { entity_type: "session", entity_id: id, action: "date", from: cur.date, to: n.date });
    }
    return { session: row, impact, delta };
  });
}

/** Décale les dates cibles des publications choisies. La programmation réelle (scheduled_at) n'est jamais modifiée. */
export async function shiftTargetDates(ids: string[], days: number) {
  return run(async (tx) => {
    const list = z.array(zId).max(500).parse(ids);
    const d = z.number().int().min(-3650).max(3650).parse(days);
    const rows = await tx.query<{ id: string; target_date: string }>(
      `select id, target_date from public.publications where id = any($1::uuid[]) and target_date is not null`,
      [list],
    );
    const out: { id: string; target_date: string }[] = [];
    for (const r of rows) {
      const next = addDays(r.target_date, d);
      await tx.query(`update public.publications set target_date = $2, updated_at = now() where id = $1`, [r.id, next]);
      await log(tx, { entity_type: "publication", entity_id: r.id, publication_id: r.id, action: "target_date", from: r.target_date, to: next, meta: { reason: "session_shift" } });
      out.push({ id: r.id, target_date: next });
    }
    return out;
  });
}

export async function reorderSessions(cycleId: string, ids: string[]) {
  return run(async (tx) => {
    zId.parse(cycleId);
    const list = z.array(zId).max(1000).parse(ids);
    const own = await tx.query<{ id: string }>(`select id from public.sessions where cycle_id = $1`, [cycleId]);
    const set = new Set(own.map((r) => r.id));
    await applyOrder(tx, "sessions", list.filter((i) => set.has(i)));
    return true;
  });
}

export async function sortSessionsChrono(cycleId: string) {
  return run(async (tx) => {
    zId.parse(cycleId);
    const rows = await tx.query<{ id: string }>(
      `select id from public.sessions where cycle_id = $1 order by date nulls last, start_time nulls first, position`,
      [cycleId],
    );
    await applyOrder(tx, "sessions", rows.map((r) => r.id));
    return rows.map((r) => r.id);
  });
}

/** Supprime la session : ses publications restent dans le cycle (contenus généraux). */
export async function deleteSession(id: string) {
  return run(async (tx) => {
    zId.parse(id);
    const moved = await tx.query<{ id: string }>(`select id from public.publications where session_id = $1`, [id]);
    const del = await tx.query(`delete from public.sessions where id = $1 returning id`, [id]);
    if (!del.length) throw new NotFound("Session introuvable");
    return moved.map((r) => r.id);
  });
}
