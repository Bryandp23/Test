import type { CalendarSession, PublicEvent } from "@/lib/types";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "not_found" | "conflict" | "rate_limit" | "server" | "network" | "config",
    public status?: number
  ) {
    super(message);
  }
}

export interface RemoteEventRef {
  id: string;
  link: string | null;
}

export interface CalendarProvider {
  id: "google" | "microsoft";
  label: string;
  configured(): boolean;
  authorizeUrl(p: { state: string; codeChallenge: string; redirectUri: string; loginHint?: string }): string;
  exchangeCode(code: string, verifier: string, redirectUri: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<OAuthTokens>;
  accountEmail(accessToken: string): Promise<string | null>;
  /** Crée l'événement s'il n'existe pas, sinon le met à jour. Idempotent. */
  ensureEvent(accessToken: string, ev: PublicEvent, s: CalendarSession, ctx: { pageUrl: string; existingId: string | null; connectionId: string }): Promise<RemoteEventRef>;
  /** Met à jour un événement existant. ProviderError(not_found) si l'utilisateur l'a supprimé. */
  updateEvent(accessToken: string, remoteId: string, ev: PublicEvent, s: CalendarSession, ctx: { pageUrl: string }): Promise<RemoteEventRef>;
  /** Vérifie que l'événement est réellement présent dans le calendrier. */
  verifyEvent(accessToken: string, remoteId: string): Promise<boolean>;
  revoke(token: string): Promise<boolean>;
}

export async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; body: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } catch (e) {
    throw new ProviderError(`Service de calendrier injoignable (${(e as Error).name})`, "network");
  } finally {
    clearTimeout(t);
  }
}

export function classify(status: number, body: any, what: string): ProviderError {
  const msg = typeof body === "object" && body ? body.error?.message ?? body.error_description ?? body.error ?? "" : String(body ?? "");
  if (status === 401 || status === 403) return new ProviderError(`${what} : accès refusé (${msg})`, "auth", status);
  if (status === 404 || status === 410) return new ProviderError(`${what} : introuvable`, "not_found", status);
  if (status === 409) return new ProviderError(`${what} : existe déjà`, "conflict", status);
  if (status === 429) return new ProviderError(`${what} : trop de requêtes, réessayez plus tard`, "rate_limit", status);
  return new ProviderError(`${what} : erreur ${status} ${msg}`.trim(), "server", status);
}
