import "server-only";
import crypto from "node:crypto";
import type { CalendarSession, PublicEvent } from "@/lib/types";
import { buildDescription, buildLocation, buildSummary } from "@/lib/content";
import { classify, fetchJson, ProviderError, type CalendarProvider, type OAuthTokens } from "./types";

// Microsoft Graph — https://learn.microsoft.com/graph/api/resources/event
// Locataire « common » : comptes personnels (Outlook.com, Hotmail) ET professionnels/scolaires (Microsoft 365).
const SCOPES = ["openid", "email", "offline_access", "User.Read", "Calendars.ReadWrite"];
const tenant = () => process.env.MICROSOFT_TENANT ?? "common";
const GRAPH = "https://graph.microsoft.com/v1.0";
const PROP_ID = "String {6f1d0c43-3b7a-4f6e-9a55-5e0c2a7e4b11} Name EphecSessionId";

// Fuseaux Windows attendus par Graph (les noms IANA ne sont pas toujours acceptés).
const WINDOWS_TZ: Record<string, string> = {
  "Europe/Brussels": "Romance Standard Time",
  "Europe/Paris": "Romance Standard Time",
  "Europe/Amsterdam": "W. Europe Standard Time",
  "Europe/Luxembourg": "W. Europe Standard Time",
  "Europe/London": "GMT Standard Time",
  UTC: "UTC",
};

function dt(ev: PublicEvent, date: string, time: string, utcIso: string) {
  const win = WINDOWS_TZ[ev.timezone];
  if (win) return { dateTime: `${date}T${time}:00`, timeZone: win };
  return { dateTime: utcIso.replace("Z", ""), timeZone: "UTC" };
}

function body(ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  const cancelled = ev.status === "cancelled" || s.status === "cancelled";
  return {
    subject: buildSummary(ev, s),
    body: { contentType: "text", content: buildDescription(ev, s, { pageUrl }) },
    start: dt(ev, s.date, s.startTime, s.startUtc),
    end: dt(ev, s.date, s.endTime, s.endUtc),
    location: { displayName: buildLocation(ev, s) },
    showAs: cancelled ? "free" : "busy",
    isReminderOn: !!ev.reminderMinutes && !cancelled,
    reminderMinutesBeforeStart: ev.reminderMinutes ?? 0,
    singleValueExtendedProperties: [{ id: PROP_ID, value: s.id }],
  };
}

/** transactionId : Graph refuse de créer deux fois un événement portant le même identifiant de transaction. */
function transactionId(connectionId: string, sessionId: string) {
  const h = crypto.createHash("sha256").update(`${connectionId}:${sessionId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export const microsoft: CalendarProvider = {
  id: "microsoft",
  label: "Outlook / Microsoft 365",
  configured: () => !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
  authorizeUrl({ state, codeChallenge, redirectUri, loginHint }) {
    const p = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: SCOPES.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    if (loginHint) p.set("login_hint", loginHint);
    return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${p}`;
  },
  async exchangeCode(code, verifier, redirectUri): Promise<OAuthTokens> {
    const r = await fetchJson(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
        scope: SCOPES.join(" "),
      }),
    });
    if (r.status !== 200) throw classify(r.status, r.body, "Échange du code Microsoft");
    return { accessToken: r.body.access_token, refreshToken: r.body.refresh_token, expiresIn: r.body.expires_in, scope: r.body.scope };
  },
  async refresh(refreshToken) {
    const r = await fetchJson(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: SCOPES.join(" "),
      }),
    });
    if (r.status !== 200) throw new ProviderError("Accès Microsoft expiré ou retiré", "auth", r.status);
    // Microsoft renvoie un nouveau refresh token à chaque rafraîchissement.
    return { accessToken: r.body.access_token, refreshToken: r.body.refresh_token, expiresIn: r.body.expires_in, scope: r.body.scope };
  },
  async accountEmail(accessToken) {
    const r = await fetchJson(`${GRAPH}/me?$select=mail,userPrincipalName`, { headers: { authorization: `Bearer ${accessToken}` } });
    return r.status === 200 ? r.body.mail ?? r.body.userPrincipalName ?? null : null;
  },
  async ensureEvent(accessToken, ev, s, { pageUrl, existingId, connectionId }) {
    const auth = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
    if (existingId) {
      try {
        return await this.updateEvent(accessToken, existingId, ev, s, { pageUrl });
      } catch (e) {
        if (!(e instanceof ProviderError && e.kind === "not_found")) throw e;
      }
    } else {
      // Recherche d'un événement déjà créé pour cette séance (ex. autre navigateur, même compte).
      const filter = `singleValueExtendedProperties/Any(ep: ep/id eq '${PROP_ID}' and ep/value eq '${s.id}')`;
      const found = await fetchJson(`${GRAPH}/me/events?$filter=${encodeURIComponent(filter)}&$select=id,webLink`, { headers: auth });
      if (found.status === 200 && Array.isArray(found.body.value) && found.body.value.length > 0)
        return this.updateEvent(accessToken, found.body.value[0].id, ev, s, { pageUrl });
    }
    const r = await fetchJson(`${GRAPH}/me/events`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ ...body(ev, s, pageUrl), transactionId: transactionId(connectionId, s.id) }),
    });
    if (r.status === 201 || r.status === 200) return { id: r.body.id, link: r.body.webLink ?? null };
    throw classify(r.status, r.body, "Création Microsoft");
  },
  async updateEvent(accessToken, remoteId, ev, s, { pageUrl }) {
    const r = await fetchJson(`${GRAPH}/me/events/${encodeURIComponent(remoteId)}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body(ev, s, pageUrl)),
    });
    if (r.status === 200) return { id: r.body.id, link: r.body.webLink ?? null };
    throw classify(r.status, r.body, "Mise à jour Microsoft");
  },
  async verifyEvent(accessToken, remoteId) {
    const r = await fetchJson(`${GRAPH}/me/events/${encodeURIComponent(remoteId)}?$select=id,isCancelled`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (r.status === 200) return !r.body.isCancelled;
    if (r.status === 404) return false;
    throw classify(r.status, r.body, "Vérification Microsoft");
  },
  async revoke() {
    // Graph n'offre pas de révocation de jeton par l'application pour un utilisateur : on efface les jetons
    // côté serveur et on indique au participant où retirer l'autorisation (account.microsoft.com / myapps.microsoft.com).
    return false;
  },
};
