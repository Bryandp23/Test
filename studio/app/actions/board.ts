"use server";
import { z } from "zod";
import { run, zId } from "@/lib/server/action";
import { ensureDefaults, loadBoard } from "@/lib/server/repo";
import { mode } from "@/lib/server/config";
import type { BoardData, Prefs } from "@/lib/domain";

export async function loadBoardAction() {
  return run(async (tx, user): Promise<BoardData> => {
    await ensureDefaults(tx);
    const data = await loadBoard(tx);
    return { ...data, user: { email: user.email }, mode: mode() as "supabase" | "local", loadedAt: Date.now() };
  });
}

const zPrefs = z.object({
  density: z.enum(["compact", "confortable"]).optional(),
  collapsed: z.array(z.string().uuid()).max(2000).optional(),
  sidebarCollapsed: z.boolean().optional(),
});

export async function savePrefs(patch: Prefs) {
  return run(async (tx) => {
    const p = zPrefs.parse(patch);
    await tx.query(
      `insert into public.user_prefs (prefs) values ($1::jsonb)
       on conflict (owner_id) do update set prefs = public.user_prefs.prefs || excluded.prefs, updated_at = now()`,
      [JSON.stringify(p)],
    );
    return true;
  });
}

const zFilters = z.object({
  q: z.string().max(200),
  cycleIds: z.array(zId),
  channelIds: z.array(zId),
  audienceIds: z.array(zId),
  natureIds: z.array(zId),
  tagIds: z.array(zId),
  production: z.array(z.enum(["idee", "a_creer", "en_cours", "pret"])),
  diffusion: z.array(z.enum(["a_programmer", "programme", "publie", "annule"])),
  from: z.string().nullable(),
  to: z.string().nullable(),
  showArchived: z.boolean(),
});

export async function createSavedView(name: string, filters: unknown) {
  return run(async (tx) => {
    const n = z.string().trim().min(1, "Nom requis").max(80).parse(name);
    const f = zFilters.parse(filters);
    const [row] = await tx.query<{ id: string }>(
      `insert into public.saved_views (name, filters, position)
       values ($1, $2::jsonb, (select coalesce(max(position),0)+1 from public.saved_views)) returning id`,
      [n, JSON.stringify(f)],
    );
    return { id: row.id, name: n, filters: f };
  });
}

export async function deleteSavedView(id: string) {
  return run(async (tx) => {
    await tx.query(`delete from public.saved_views where id = $1`, [zId.parse(id)]);
    return true;
  });
}
