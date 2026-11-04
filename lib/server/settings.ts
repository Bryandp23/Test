import "server-only";
import { q } from "./db";

export interface AppSettings {
  publicBaseUrl: string;
  defaultReminderMinutes: number | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  logoUrl: string;
  enableYahoo: boolean;
  /** Empreinte de la clé d'API du système d'inscription (Phase 3). La clé n'est jamais stockée en clair. */
  integrationKeyHash: string | null;
  statsRetentionDays: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  publicBaseUrl: "",
  defaultReminderMinutes: 1440,
  organizerName: "Formation Continue EPHEC",
  organizerEmail: "",
  organizerPhone: "",
  logoUrl: "",
  enableYahoo: false,
  integrationKeyHash: null,
  statsRetentionDays: 395,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await q<{ key: string; value: unknown }>(`select key, value from settings`);
  const s: AppSettings = { ...DEFAULT_SETTINGS };
  for (const r of rows) (s as unknown as Record<string, unknown>)[r.key] = r.value;
  return s;
}

export async function saveSettings(patch: Partial<AppSettings>) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULT_SETTINGS) || v === undefined) continue;
    await q(
      `insert into settings(key, value, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [k, JSON.stringify(v)]
    );
  }
}

/**
 * URL publique de base, ex. https://agenda.ephec.be
 * Priorité : variable PUBLIC_BASE_URL > réglage du back-office > origine de la requête.
 */
export async function getBaseUrl(requestOrigin?: string): Promise<string> {
  const env = process.env.PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const s = await getSettings();
  if (s.publicBaseUrl) return s.publicBaseUrl.replace(/\/+$/, "");
  return (requestOrigin ?? "http://localhost:3000").replace(/\/+$/, "");
}
