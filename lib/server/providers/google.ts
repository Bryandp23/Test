import "server-only";
import crypto from "node:crypto";
import type { CalendarSession, PublicEvent } from "@/lib/types";
import { buildDescription, buildLocation, buildSummary } from "@/lib/content";
import { classify, fetchJson, ProviderError, type CalendarProvider, type OAuthTokens } from "./types";

// Google Calendar API v3 — https://developers.google.com/calendar/api/v3/reference/events
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];
// Points d'accès surchargeables UNIQUEMENT pour les tests automatisés (simulateur d'API local).
const E = {
  auth: () => process.env.GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth",
  token: () => process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
  userinfo: () => process.env.GOOGLE_USERINFO_URL ?? "https://openidconnect.googleapis.com/v1/userinfo",
  revoke: () => process.env.GOOGLE_REVOKE_URL ?? "https://oauth2.googleapis.com/revoke",
  events: () => process.env.GOOGLE_EVENTS_URL ?? "https://www.googleapis.com/calendar/v3/calendars/primary/events",
};

/** Identifiant d'événement déterministe (alphabet base32hex imposé par Google) : garantit l'absence de doublon. */
export function googleEventId(sessionId: string): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuv";
  const h = crypto.createHash("sha256").update(`ephec:${sessionId}`).digest();
  let out = "ephec";
  for (let i = 0; i < 26; i++) out += alphabet[h[i] % 32];
  return out;
}

function body(ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  const cancelled = ev.status === "cancelled" || s.status === "cancelled";
  return {
    summary: buildSummary(ev, s),
    location: buildLocation(ev, s),
    description: buildDescription(ev, s, { pageUrl }),
    start: { dateTime: `${s.date}T${s.startTime}:00`, timeZone: ev.timezone },
    end: { dateTime: `${s.date}T${s.endTime}:00`, timeZone: ev.timezone },
    status: "confirmed",
    transparency: cancelled ? "transparent" : "opaque",
    reminders:
      ev.reminderMinutes && !cancelled
        ? { useDefault: false, overrides: [{ method: "popup", minutes: Math.min(ev.reminderMinutes, 40320) }] }
        : { useDefault: false, overrides: [] },
    source: { title: "EPHEC", url: pageUrl },
    extendedProperties: { private: { ephecSessionId: s.id } },
  };
}

export const google: CalendarProvider = {
  id: "google",
  label: "Google Agenda",
  configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  authorizeUrl({ state, codeChallenge, redirectUri, loginHint }) {
    const p = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    if (loginHint) p.set("login_hint", loginHint);
    return `${E.auth()}?${p}`;
  },
  async exchangeCode(code, verifier, redirectUri): Promise<OAuthTokens> {
    const r = await fetchJson(E.token(), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (r.status !== 200) throw classify(r.status, r.body, "Échange du code Google");
    if (!String(r.body.scope ?? "").includes("calendar.events"))
      throw new ProviderError("L'accès au calendrier n'a pas été accordé (case non cochée).", "auth", 403);
    return { accessToken: r.body.access_token, refreshToken: r.body.refresh_token, expiresIn: r.body.expires_in, scope: r.body.scope };
  },
  async refresh(refreshToken) {
    const r = await fetchJson(E.token(), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    if (r.status !== 200) throw new ProviderError("Accès Google expiré ou retiré", "auth", r.status);
    return { accessToken: r.body.access_token, expiresIn: r.body.expires_in, scope: r.body.scope };
  },
  async accountEmail(accessToken) {
    const r = await fetchJson(E.userinfo(), { headers: { authorization: `Bearer ${accessToken}` } });
    return r.status === 200 ? r.body.email ?? null : null;
  },
  async ensureEvent(accessToken, ev, s, { pageUrl }) {
    const id = googleEventId(s.id);
    const auth = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
    const r = await fetchJson(E.events(), { method: "POST", headers: auth, body: JSON.stringify({ id, ...body(ev, s, pageUrl) }) });
    if (r.status === 200) return { id: r.body.id, link: r.body.htmlLink ?? null };
    if (r.status === 409) {
      // Déjà créé (double clic, autre appareil) ou supprimé par l'utilisateur puis ré-ajouté : on remet à jour.
      return this.updateEvent(accessToken, id, ev, s, { pageUrl });
    }
    throw classify(r.status, r.body, "Création Google");
  },
  async updateEvent(accessToken, remoteId, ev, s, { pageUrl }) {
    const r = await fetchJson(`${E.events()}/${encodeURIComponent(remoteId)}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body(ev, s, pageUrl)),
    });
    if (r.status === 200) return { id: r.body.id, link: r.body.htmlLink ?? null };
    throw classify(r.status, r.body, "Mise à jour Google");
  },
  async verifyEvent(accessToken, remoteId) {
    const r = await fetchJson(`${E.events()}/${encodeURIComponent(remoteId)}?fields=id,status`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (r.status === 200) return r.body.status !== "cancelled";
    if (r.status === 404 || r.status === 410) return false;
    throw classify(r.status, r.body, "Vérification Google");
  },
  async revoke(token) {
    const r = await fetchJson(`${E.revoke()}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    return r.status === 200;
  },
};
