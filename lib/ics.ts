// Générateur iCalendar conforme RFC 5545 (et RFC 5546 pour METHOD).
import type { CalendarSession, PublicEvent } from "./types";
import { buildDescription, buildLocation, buildSummary } from "./content";
import { toIcsLocal, toIcsUtc } from "./time";

export const UID_DOMAIN = "ephec-calendar";
export const PRODID = "-//EPHEC//EPHEC Calendar 1.0//FR";

export function sessionUid(sessionId: string) {
  return `${sessionId}@${UID_DOMAIN}`;
}

/** Échappement des valeurs TEXT (RFC 5545 §3.3.11). */
export function escapeText(v: string): string {
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Pliage des lignes à 75 octets sans couper un caractère UTF-8 (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74; // la ligne de continuation commence par un espace
    }
    current += ch;
    bytes += b;
  }
  out.push(current);
  return out.join("\r\n ");
}

// Définition du fuseau Europe/Brussels (règles UE en vigueur depuis 1996).
const VTIMEZONE_BRUSSELS = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Brussels",
  "X-LIC-LOCATION:Europe/Brussels",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Durée RFC 5545 : -P1D, -PT1H, -PT15M. */
export function alarmDuration(minutes: number): string {
  if (minutes % 1440 === 0) return `-P${minutes / 1440}D`;
  if (minutes % 60 === 0) return `-PT${minutes / 60}H`;
  return `-PT${minutes}M`;
}

export interface IcsOptions {
  pageUrl: string;
  /** PUBLISH pour l'import et les abonnements, CANCEL pour un fichier d'annulation. */
  method?: "PUBLISH" | "CANCEL";
  /** Nom du calendrier (abonnement uniquement). */
  calendarName?: string;
  /** Inclure les séances annulées (STATUS:CANCELLED) — utile pour les abonnements et annulations. */
  includeCancelled?: boolean;
  now?: Date;
}

function dtLines(ev: PublicEvent, s: CalendarSession): string[] {
  if (ev.timezone === "Europe/Brussels") {
    return [
      `DTSTART;TZID=Europe/Brussels:${toIcsLocal(s.date, s.startTime)}`,
      `DTEND;TZID=Europe/Brussels:${toIcsLocal(s.date, s.endTime)}`,
    ];
  }
  // Autres fuseaux : instants UTC, toujours exacts.
  return [`DTSTART:${toIcsUtc(new Date(s.startUtc))}`, `DTEND:${toIcsUtc(new Date(s.endUtc))}`];
}

export function buildIcs(ev: PublicEvent, sessions: CalendarSession[], opts: IcsOptions): string {
  const method = opts.method ?? "PUBLISH";
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`, "CALSCALE:GREGORIAN", `METHOD:${method}`];
  if (opts.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeText(opts.calendarName)}`);
    lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H");
    lines.push(`X-WR-TIMEZONE:${ev.timezone}`);
  }
  if (ev.timezone === "Europe/Brussels") lines.push(...VTIMEZONE_BRUSSELS);

  const list = sessions.filter((s) => opts.includeCancelled || method === "CANCEL" || (s.status === "active" && ev.status !== "cancelled"));
  for (const s of list) {
    const cancelled = method === "CANCEL" || s.status === "cancelled" || ev.status === "cancelled";
    const stamp = toIcsUtc(new Date(s.updatedAt));
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${sessionUid(s.id)}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`LAST-MODIFIED:${stamp}`);
    lines.push(`SEQUENCE:${s.sequence}`);
    lines.push(...dtLines(ev, s));
    lines.push(`SUMMARY:${escapeText(buildSummary(ev, s))}`);
    const location = buildLocation(ev, s);
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    lines.push(`DESCRIPTION:${escapeText(buildDescription(ev, s, { pageUrl: opts.pageUrl }))}`);
    lines.push(`URL:${ev.infoUrl || opts.pageUrl}`);
    lines.push(`STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`);
    lines.push("TRANSP:OPAQUE");
    lines.push("CLASS:PUBLIC");
    if (!cancelled && ev.reminderMinutes && ev.reminderMinutes > 0) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(buildSummary(ev, s))}`, `TRIGGER:${alarmDuration(ev.reminderMinutes)}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function icsFilename(ev: PublicEvent): string {
  const base = ev.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `ephec-${base || ev.slug}.ics`;
}
