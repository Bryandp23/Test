import "server-only";
import { z } from "zod";
import { asUser, type Queryable } from "./db";
import { AuthError, requireUser, type User } from "./auth";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export class UserError extends Error {
  code = "INVALID";
}

/** Enveloppe commune des actions serveur : authentification, transaction RLS, erreurs lisibles. */
export async function run<T>(fn: (tx: Queryable, user: User) => Promise<T>): Promise<Result<T>> {
  try {
    const user = await requireUser();
    const data = await asUser(user.id, (tx) => fn(tx, user));
    return { ok: true, data };
  } catch (e) {
    return toError(e);
  }
}

export function toError(e: unknown): { ok: false; error: string; code?: string } {
  if (e instanceof AuthError) return { ok: false, error: e.message, code: e.code };
  if (e instanceof UserError) return { ok: false, error: e.message, code: e.code };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" · "), code: "INVALID" };
  const err = e as { code?: string; message?: string; constraint?: string };
  if (err?.code === "NOT_FOUND") return { ok: false, error: err.message ?? "Introuvable", code: "NOT_FOUND" };
  if (err?.code === "23505") return { ok: false, error: "Cet élément existe déjà.", code: "DUPLICATE" };
  if (err?.code === "23503") return { ok: false, error: "Élément lié introuvable (il a peut-être été supprimé).", code: "FK" };
  if (err?.code === "23514") return { ok: false, error: "Valeur refusée par les règles de cohérence.", code: "CHECK" };
  console.error("[studio] action", e);
  return { ok: false, error: "Une erreur inattendue est survenue. Vos données n'ont pas été modifiées.", code: "SERVER" };
}

// Schémas réutilisables
export const zId = z.string().uuid({ message: "Identifiant invalide" });
export const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date invalide" })
  .nullable();
export const zTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Heure invalide" })
  .nullable();
export const zUrl = z
  .string()
  .trim()
  .url({ message: "URL invalide" })
  .refine((u) => /^https?:\/\//i.test(u), { message: "L'URL doit commencer par http:// ou https://" });
