// Conversions fuseau horaire sans dépendance : on s'appuie sur la base IANA embarquée dans Intl.
// Les séances sont stockées en heure locale (date + heure + fuseau) : c'est la seule représentation
// qui reste juste quand les règles d'heure d'été changent. La conversion UTC est faite au dernier moment.

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    dtf(tz);
    return true;
  } catch {
    return false;
  }
}

/** Décalage (ms) du fuseau par rapport à UTC à l'instant donné. */
export function tzOffsetMs(tz: string, epochMs: number): number {
  const parts = dtf(tz).formatToParts(new Date(epochMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

export const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDate(date: string): boolean {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export type LocalTimeResult =
  | { ok: true; utc: Date; ambiguous: boolean }
  | { ok: false; reason: "invalid" | "nonexistent" };

/**
 * Convertit une heure locale (« mur ») d'un fuseau en instant UTC.
 * - « nonexistent » : heure sautée lors du passage à l'heure d'été (ex. 02:30 le dernier dimanche de mars).
 * - « ambiguous » : heure répétée lors du passage à l'heure d'hiver ; on retient la première occurrence.
 */
export function localToUtc(date: string, time: string, tz: string): LocalTimeResult {
  if (!isValidDate(date) || !isValidTime(time)) return { ok: false, reason: "invalid" };
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const candidates = new Set<number>();
  for (const probe of [wall - 36e5 * 14, wall, wall + 36e5 * 14]) {
    const off = tzOffsetMs(tz, probe);
    candidates.add(wall - off);
  }
  const valid = [...candidates].filter((c) => c + tzOffsetMs(tz, c) === wall).sort((a, b) => a - b);
  if (valid.length === 0) return { ok: false, reason: "nonexistent" };
  return { ok: true, utc: new Date(valid[0]), ambiguous: valid.length > 1 };
}

export function localToUtcOrThrow(date: string, time: string, tz: string): Date {
  const r = localToUtc(date, time, tz);
  if (!r.ok) throw new Error(`Heure locale ${r.reason} : ${date} ${time} (${tz})`);
  return r.utc;
}

/** Composantes locales d'un instant dans un fuseau. */
export function utcToLocalParts(d: Date, tz: string) {
  const parts = dtf(tz).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    seconds: get("second"),
  };
}

/** 20261119T110000Z */
export function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** 20261119T120000 (heure locale, sans Z) */
export function toIcsLocal(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

const frDate = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions) {
  const key = tz + JSON.stringify(opts);
  let f = frDate.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("fr-BE", { timeZone: tz, ...opts });
    frDate.set(key, f);
  }
  return f;
}

/** « jeudi 19 novembre 2026 » à partir d'une date locale. */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return fmt("UTC", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return fmt("UTC", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** « 12 h 00 » — format belge lisible. */
export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)} h ${m}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** Date locale « aujourd'hui » dans le fuseau donné. */
export function todayIn(tz: string, now = new Date()): string {
  return utcToLocalParts(now, tz).date;
}
