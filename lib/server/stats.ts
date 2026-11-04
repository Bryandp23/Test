import "server-only";
import { q } from "./db";
import { getSettings } from "./settings";

// Statistiques agrégées par jour, sans IP, sans cookie de suivi, sans identifiant de personne (RGPD : minimisation).

export const BOT_UA =
  /bot|crawl|spider|slurp|preview|scanner|headless|phantom|python-requests|curl|wget|httpclient|java\/|go-http|okhttp|facebookexternalhit|whatsapp|skypeuripreview|microsoft office|outlook-ios-linkpreview|proofpoint|mimecast|barracuda|safelinks|linkchecker|google-read-aloud|googleimageproxy|ymailbot/i;

export function isBot(ua: string | null) {
  return !ua || BOT_UA.test(ua);
}

const KINDS = new Set(["view", "click", "confirmed"]);
const PROVIDERS = new Set(["", "google", "outlook_personal", "outlook_work", "outlook_desktop", "apple", "ics", "yahoo", "subscribe", "api_google", "api_microsoft", "copy"]);
const DEVICES = new Set(["mobile", "tablet", "desktop", ""]);

export async function record(eventId: string, kind: string, provider = "", device = "") {
  if (!KINDS.has(kind) || !PROVIDERS.has(provider) || !DEVICES.has(device)) return;
  await q(
    `insert into stats_daily (event_id, day, kind, provider, device, count) values ($1, (now() at time zone 'Europe/Brussels')::date, $2, $3, $4, 1)
     on conflict (event_id, day, kind, provider, device) do update set count = stats_daily.count + 1`,
    [eventId, kind, provider, device]
  );
}

export async function purgeOldStats() {
  const s = await getSettings();
  await q(`delete from stats_daily where day < (now() - make_interval(days => $1))::date`, [s.statsRetentionDays]);
}

export interface StatsRow {
  event_id: string;
  title: string;
  slug: string;
  is_demo: boolean;
  views: number;
  clicks: number;
  confirmed: number;
}

export async function statsByEvent(from: string, to: string): Promise<StatsRow[]> {
  return q<StatsRow>(
    `select e.id as event_id, e.title, e.slug, e.is_demo,
       coalesce(sum(d.count) filter (where d.kind='view'),0)::int as views,
       coalesce(sum(d.count) filter (where d.kind='click'),0)::int as clicks,
       coalesce(sum(d.count) filter (where d.kind='confirmed'),0)::int as confirmed
     from events e left join stats_daily d on d.event_id=e.id and d.day between $1::date and $2::date
     where e.status <> 'draft'
     group by e.id order by views desc, e.title`,
    [from, to]
  );
}

export async function statsBreakdown(from: string, to: string, eventId?: string) {
  const params: unknown[] = [from, to];
  let filter = "";
  if (eventId) {
    params.push(eventId);
    filter = "and event_id = $3";
  }
  const providers = await q<{ provider: string; clicks: number; confirmed: number }>(
    `select provider,
       coalesce(sum(count) filter (where kind='click'),0)::int as clicks,
       coalesce(sum(count) filter (where kind='confirmed'),0)::int as confirmed
     from stats_daily where day between $1::date and $2::date and kind in ('click','confirmed') ${filter}
     group by provider order by clicks desc`,
    params
  );
  const devices = await q<{ device: string; views: number }>(
    `select device, sum(count)::int as views from stats_daily where day between $1::date and $2::date and kind='view' ${filter} group by device order by views desc`,
    params
  );
  return { providers, devices };
}

export async function statsCsv(from: string, to: string): Promise<string> {
  const rows = await q<{ day: string; title: string; slug: string; kind: string; provider: string; device: string; count: number }>(
    `select to_char(d.day,'YYYY-MM-DD') as day, e.title, e.slug, d.kind, d.provider, d.device, d.count
     from stats_daily d join events e on e.id=d.event_id where d.day between $1::date and $2::date order by d.day, e.title, d.kind`,
    [from, to]
  );
  const KIND_FR: Record<string, string> = { view: "ouverture_page", click: "clic_calendrier (non confirmé)", confirmed: "ajout_confirmé_par_api" };
  const esc = (v: string | number) => {
    const s = String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // neutralise l'injection de formules dans les tableurs
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ["jour", "evenement", "identifiant", "mesure", "calendrier", "appareil", "nombre"];
  const lines = [header.join(";"), ...rows.map((r) => [r.day, r.title, r.slug, KIND_FR[r.kind] ?? r.kind, r.provider, r.device, r.count].map(esc).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
