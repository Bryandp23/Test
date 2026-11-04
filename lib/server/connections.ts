import "server-only";
import { q, q1 } from "./db";
import { decrypt, emailHmac, encrypt, sha256 } from "./crypto";
import { google } from "./providers/google";
import { microsoft } from "./providers/microsoft";
import { ProviderError, type CalendarProvider } from "./providers/types";
import { getPublicEventById } from "./events";
import { getBaseUrl } from "./settings";
import { record } from "./stats";
import type { ApiProvider, PublicEvent } from "@/lib/types";

const registry: Record<ApiProvider, CalendarProvider> = { google, microsoft };

export function getProvider(id: string): CalendarProvider | null {
  return id === "google" || id === "microsoft" ? registry[id] : null;
}

/** Réservé aux tests automatisés : remplace un fournisseur par une implémentation simulée. */
export function __setProviderForTests(id: ApiProvider, p: CalendarProvider) {
  registry[id] = p;
}

export function configuredProviders(): ApiProvider[] {
  return (Object.keys(registry) as ApiProvider[]).filter((k) => registry[k].configured());
}

export interface ConnectionRow {
  id: string;
  browser_key_hash: string;
  provider: ApiProvider;
  account_email: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: Date | null;
  auto_add: boolean;
  auto_add_consented_at: Date | null;
  created_at: Date;
  revoked_at: Date | null;
}

export async function saveConnection(p: {
  browserKey: string;
  provider: ApiProvider;
  email: string | null;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}): Promise<ConnectionRow> {
  const bk = sha256(p.browserKey);
  const existing = await q1<ConnectionRow>(
    `select * from calendar_connections where browser_key_hash=$1 and provider=$2 and coalesce(account_email,'')=coalesce($3,'') and revoked_at is null`,
    [bk, p.provider, p.email]
  );
  const expires = p.expiresIn ? new Date(Date.now() + (p.expiresIn - 60) * 1000).toISOString() : null;
  if (existing) {
    return (await q1<ConnectionRow>(
      `update calendar_connections set access_token_enc=$2, refresh_token_enc=coalesce($3, refresh_token_enc), token_expires_at=$4, scope=$5, last_used_at=now()
       where id=$1 returning *`,
      [existing.id, encrypt(p.accessToken), p.refreshToken ? encrypt(p.refreshToken) : null, expires, p.scope ?? null]
    ))!;
  }
  return (await q1<ConnectionRow>(
    `insert into calendar_connections (browser_key_hash, provider, account_email, account_email_hmac, access_token_enc, refresh_token_enc, token_expires_at, scope)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [bk, p.provider, p.email, p.email ? emailHmac(p.email) : null, encrypt(p.accessToken), p.refreshToken ? encrypt(p.refreshToken) : null, expires, p.scope ?? null]
  ))!;
}

export async function connectionsForBrowser(browserKey: string | null): Promise<ConnectionRow[]> {
  if (!browserKey) return [];
  return q<ConnectionRow>(`select * from calendar_connections where browser_key_hash=$1 and revoked_at is null order by created_at`, [sha256(browserKey)]);
}

export async function connectionForBrowser(browserKey: string | null, id: string) {
  return (await connectionsForBrowser(browserKey)).find((c) => c.id === id) ?? null;
}

/** Jeton d'accès valide (rafraîchi si nécessaire). Marque la connexion révoquée si l'utilisateur a retiré l'accès. */
async function accessToken(c: ConnectionRow): Promise<string> {
  const p = getProvider(c.provider)!;
  if (c.token_expires_at && new Date(c.token_expires_at).getTime() > Date.now() + 30_000) return decrypt(c.access_token_enc);
  if (!c.refresh_token_enc) return decrypt(c.access_token_enc);
  try {
    const t = await p.refresh(decrypt(c.refresh_token_enc));
    const expires = t.expiresIn ? new Date(Date.now() + (t.expiresIn - 60) * 1000).toISOString() : null;
    await q(
      `update calendar_connections set access_token_enc=$2, refresh_token_enc=coalesce($3, refresh_token_enc), token_expires_at=$4, last_used_at=now() where id=$1`,
      [c.id, encrypt(t.accessToken), t.refreshToken ? encrypt(t.refreshToken) : null, expires]
    );
    return t.accessToken;
  } catch (e) {
    if (e instanceof ProviderError && e.kind === "auth") {
      await q(`update calendar_connections set revoked_at=now() where id=$1`, [c.id]);
    }
    throw e;
  }
}

export type AddOutcome = "added" | "already" | "updated" | "error";
export interface AddResult {
  sessionId: string;
  outcome: AddOutcome;
  link: string | null;
  error?: string;
}

/**
 * Ajout confirmé via l'API officielle (Mode B).
 * Idempotent à trois niveaux : ligne unique (connexion, séance) en base, identifiant déterministe chez Google,
 * transactionId + propriété étendue chez Microsoft.
 */
export async function addSessions(c: ConnectionRow, ev: PublicEvent, sessionIds: string[], pageUrl: string): Promise<AddResult[]> {
  const p = getProvider(c.provider);
  if (!p) throw new Error("Fournisseur inconnu");
  const token = await accessToken(c);
  const results: AddResult[] = [];
  for (const sid of sessionIds) {
    const s = ev.sessions.find((x) => x.id === sid && x.status === "active");
    if (!s) continue;
    const existing = await q1<{ id: string; provider_event_id: string | null; state: string; provider_link: string | null }>(
      `insert into synced_events (connection_id, session_id) values ($1,$2)
       on conflict (connection_id, session_id) do update set connection_id = excluded.connection_id
       returning id, provider_event_id, state, provider_link`,
      [c.id, sid]
    );
    try {
      if (existing!.state === "active" && existing!.provider_event_id && (await p.verifyEvent(token, existing!.provider_event_id))) {
        // Déjà présent : on vérifie réellement auprès du fournisseur avant de l'affirmer.
        results.push({ sessionId: sid, outcome: "already", link: existing!.provider_link });
        continue;
      }
      const ref = await p.ensureEvent(token, ev, s, { pageUrl, existingId: existing!.provider_event_id, connectionId: c.id });
      await q(
        `update synced_events set provider_event_id=$2, provider_link=$3, synced_sequence=$4, state='active', last_error=null, last_synced_at=now() where id=$1`,
        [existing!.id, ref.id, ref.link, s.sequence]
      );
      results.push({ sessionId: sid, outcome: "added", link: ref.link });
      await record(ev.id, "confirmed", c.provider === "google" ? "api_google" : "api_microsoft");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await q(`update synced_events set state='error', last_error=$2 where id=$1`, [existing!.id, msg.slice(0, 500)]);
      results.push({ sessionId: sid, outcome: "error", link: null, error: msg });
      if (e instanceof ProviderError && e.kind === "auth") break;
    }
  }
  await q(`update calendar_connections set last_used_at=now() where id=$1`, [c.id]);
  return results;
}

/** État vérifié des séances d'un événement dans les calendriers connectés de ce navigateur. */
export async function syncedStateForBrowser(browserKey: string | null, eventId: string) {
  if (!browserKey) return [];
  return q<{ connection_id: string; session_id: string; state: string; provider_link: string | null; last_error: string | null }>(
    `select se.connection_id, se.session_id, se.state, se.provider_link, se.last_error from synced_events se
     join calendar_connections c on c.id=se.connection_id join sessions s on s.id=se.session_id
     where c.browser_key_hash=$1 and c.revoked_at is null and s.event_id=$2`,
    [sha256(browserKey), eventId]
  );
}

export interface SyncReport {
  connected: number;
  updated: number;
  failed: number;
  removedByUser: number;
  errors: string[];
}

/** Propage une modification d'événement vers les calendriers connectés (API officielles). */
export async function propagateChanges(eventId: string, sessionIds: string[], requestOrigin?: string): Promise<SyncReport> {
  const report: SyncReport = { connected: 0, updated: 0, failed: 0, removedByUser: 0, errors: [] };
  if (sessionIds.length === 0) return report;
  const ev = await getPublicEventById(eventId);
  if (!ev) return report;
  const pageUrl = `${await getBaseUrl(requestOrigin)}/e/${ev.slug}`;
  const rows = await q<{ id: string; session_id: string; provider_event_id: string; connection_id: string }>(
    `select se.id, se.session_id, se.provider_event_id, se.connection_id from synced_events se
     where se.session_id = any($1::uuid[]) and se.state in ('active','error') and se.provider_event_id is not null`,
    [sessionIds]
  );
  report.connected = rows.length;
  const conns = new Map<string, ConnectionRow | null>();
  for (const r of rows) {
    if (!conns.has(r.connection_id))
      conns.set(r.connection_id, await q1<ConnectionRow>(`select * from calendar_connections where id=$1 and revoked_at is null`, [r.connection_id]));
    const c = conns.get(r.connection_id);
    const s = ev.sessions.find((x) => x.id === r.session_id);
    if (!s) continue;
    if (!c) {
      report.failed++;
      await q(`update synced_events set state='error', last_error=$2 where id=$1`, [r.id, "Le participant a déconnecté son calendrier."]);
      continue;
    }
    try {
      const token = await accessToken(c);
      await getProvider(c.provider)!.updateEvent(token, r.provider_event_id, ev, s, { pageUrl });
      await q(`update synced_events set state='active', synced_sequence=$2, last_error=null, last_synced_at=now() where id=$1`, [r.id, s.sequence]);
      report.updated++;
    } catch (e) {
      if (e instanceof ProviderError && e.kind === "not_found") {
        await q(`update synced_events set state='removed_by_user', last_error=null where id=$1`, [r.id]);
        report.removedByUser++;
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        await q(`update synced_events set state='error', last_error=$2 where id=$1`, [r.id, msg.slice(0, 500)]);
        report.failed++;
        if (report.errors.length < 5) report.errors.push(msg);
      }
    }
  }
  return report;
}

export async function disconnect(c: ConnectionRow) {
  const p = getProvider(c.provider);
  let revoked = false;
  try {
    const token = c.refresh_token_enc ? decrypt(c.refresh_token_enc) : decrypt(c.access_token_enc);
    revoked = p ? await p.revoke(token) : false;
  } catch {
    revoked = false;
  }
  // Suppression définitive des jetons et de l'adresse (RGPD) ; les événements déjà créés restent dans le calendrier.
  await q(`delete from calendar_connections where id=$1`, [c.id]);
  return { revokedAtProvider: revoked };
}

export async function setAutoAdd(c: ConnectionRow, enabled: boolean) {
  await q(`update calendar_connections set auto_add=$2, auto_add_consented_at = case when $2 then now() else null end where id=$1`, [c.id, enabled]);
}

/** Phase 3 : ajout automatique lors d'une inscription transmise par le système d'inscription EPHEC. */
export async function autoAddForRegistration(email: string, ev: PublicEvent, pageUrl: string) {
  const conns = await q<ConnectionRow>(`select * from calendar_connections where account_email_hmac=$1 and auto_add and revoked_at is null`, [emailHmac(email)]);
  const out: { provider: string; results: AddResult[] }[] = [];
  for (const c of conns) {
    try {
      out.push({ provider: c.provider, results: await addSessions(c, ev, ev.sessions.filter((s) => s.status === "active").map((s) => s.id), pageUrl) });
    } catch (e) {
      out.push({ provider: c.provider, results: [{ sessionId: "", outcome: "error", link: null, error: (e as Error).message }] });
    }
  }
  return out;
}

/** Suivi côté back-office : combien de calendriers connectés pour cet événement, et lesquels posent problème. */
export async function syncSummaryForEvent(eventId: string) {
  return (await q1<{ active: number; errors: number; removed: number }>(
    `select count(*) filter (where se.state='active')::int as active,
            count(*) filter (where se.state='error')::int as errors,
            count(*) filter (where se.state='removed_by_user')::int as removed
     from synced_events se join sessions s on s.id=se.session_id where s.event_id=$1`,
    [eventId]
  ))!;
}
