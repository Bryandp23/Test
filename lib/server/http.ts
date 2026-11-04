import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { ValidationFailed } from "./events";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Enveloppe les gestionnaires d'API : erreurs lisibles, jamais de détails techniques exposés. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof ValidationFailed) return json({ error: "Certaines informations sont à corriger.", issues: e.issues }, 422);
      console.error("[api]", e);
      return json({ error: "Une erreur inattendue s'est produite. Réessayez dans un instant." }, 500);
    }
  };
}

/** Origine publique de la requête (derrière un proxy inverse). */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Requête invalide.");
  }
}
