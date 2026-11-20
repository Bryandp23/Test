// Dates et heures. Fuseau de référence : Europe/Brussels (heure d'été comprise).
// - Les dates « calendrier » (date cible, date de session) sont stockées en `date` + `time` locales :
//   ce que l'utilisateur voit est exactement ce qui est enregistré, sans conversion.
// - Les instants (programmation confirmée, publication réelle) sont stockés en `timestamptz` (UTC)
//   et convertis vers/depuis Europe/Brussels à l'affichage et à la saisie.

export const TZ = "Europe/Brussels";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(d)) o[p.type] = p.value;
  return o;
}

/** Date du jour à Bruxelles (YYYY-MM-DD). */
export function todayBrussels(now = new Date()): string {
  const p = zonedParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Décalage (minutes) de Bruxelles par rapport à UTC à l'instant donné. */
function offsetMinutes(at: Date): number {
  const p = zonedParts(at);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Heure locale de Bruxelles → instant UTC (ISO). Gère les deux bascules d'heure. */
export function brusselsToUtcIso(date: string, time = "00:00"): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - offsetMinutes(new Date(guess)) * 60000;
  // Second passage : l'offset peut différer de part et d'autre d'une bascule.
  ts = guess - offsetMinutes(new Date(ts)) * 60000;
  return new Date(ts).toISOString();
}

/** Instant UTC → date et heure locales de Bruxelles. */
export function utcToBrussels(iso: string): { date: string; time: string } {
  const p = zonedParts(new Date(iso));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  return Math.round((Date.UTC(pa[0], pa[1] - 1, pa[2]) - Date.UTC(pb[0], pb[1] - 1, pb[2])) / 86400000);
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 14 janv. — l'année n'est affichée que si elle diffère de l'année en cours. */
export function fmtShort(date: string | null | undefined, today = todayBrussels()): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const yr = String(y) !== today.slice(0, 4) ? ` ${y}` : "";
  return `${d} ${MONTHS_SHORT[m - 1]}${yr}`;
}

/** lundi 14 janvier 2027 */
export function fmtLong(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return `${DAYS[weekday(date)]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** 03/12 */
export function fmtDM(date: string | null | undefined): string {
  if (!date) return "";
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function fmtPeriod(start: string | null, end: string | null, today = todayBrussels()): string {
  if (!start && !end) return "Sans dates";
  if (start && !end) return `Dès le ${fmtShort(start, today)}`;
  if (!start && end) return `Jusqu'au ${fmtShort(end, today)}`;
  return `${fmtShort(start, today)} → ${fmtShort(end, today)}`;
}

export function fmtInstant(iso: string | null | undefined): string {
  if (!iso) return "";
  const { date, time } = utcToBrussels(iso);
  return `${fmtShort(date)} à ${time.replace(":", "h")}`;
}

export function fmtRelative(iso: string, now = Date.now()): string {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const { date } = utcToBrussels(iso);
  return fmtShort(date);
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}
export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
