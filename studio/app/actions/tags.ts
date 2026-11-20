"use server";
import { z } from "zod";
import { run, zId } from "@/lib/server/action";
import { NotFound } from "@/lib/server/repo";
import type { Tag } from "@/lib/domain";

const zColor = z.enum(["blue", "coral", "orange", "violet", "green", "yellow", "teal", "gray"]);
const zDim = z.enum(["canal", "public", "nature", "format", "libre"]);

export async function createTag(input: unknown) {
  return run(async (tx) => {
    const t = z.object({ dimension: zDim, label: z.string().trim().min(1, "Libellé requis").max(60), color: zColor.default("blue") }).parse(input);
    const [row] = await tx.query<Tag>(
      `insert into public.tags (dimension, label, color, position)
       values ($1,$2,$3,(select coalesce(max(position),0)+1 from public.tags where dimension = $1))
       returning id, dimension, label, color, position`,
      [t.dimension, t.label, t.color],
    );
    return row;
  });
}

export async function updateTag(id: string, patch: unknown) {
  return run(async (tx) => {
    zId.parse(id);
    const p = z.object({ label: z.string().trim().min(1, "Libellé requis").max(60), color: zColor }).partial().parse(patch);
    const [row] = await tx.query<Tag>(
      `update public.tags set label = coalesce($2, label), color = coalesce($3, color) where id = $1 returning id, dimension, label, color, position`,
      [id, p.label ?? null, p.color ?? null],
    );
    if (!row) throw new NotFound("Tag introuvable");
    return row;
  });
}

/** Les publications et cycles qui utilisaient le tag le perdent simplement (ON DELETE SET NULL / CASCADE). */
export async function deleteTag(id: string) {
  return run(async (tx) => {
    zId.parse(id);
    const r = await tx.query(`delete from public.tags where id = $1 returning id`, [id]);
    if (!r.length) throw new NotFound("Tag introuvable");
    return true;
  });
}
