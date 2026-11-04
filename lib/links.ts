// Liens « fiche préremplie » des fournisseurs (Mode A, sans connexion).
import type { CalendarSession, PublicEvent } from "./types";
import { buildDescription, buildLocation, buildSummary } from "./content";
import { toIcsUtc } from "./time";

// Les URL trop longues sont tronquées par certains navigateurs et passerelles de suivi.
const MAX_DESC = 1200;

function common(ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  return {
    title: buildSummary(ev, s),
    location: buildLocation(ev, s),
    details: buildDescription(ev, s, { pageUrl, maxLength: MAX_DESC }),
    start: new Date(s.startUtc),
    end: new Date(s.endUtc),
  };
}

/** Google Agenda — format « TEMPLATE » (ordinateur et mobile). */
export function googleLink(ev: PublicEvent, s: CalendarSession, pageUrl: string): string {
  const c = common(ev, s, pageUrl);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: c.title,
    dates: `${toIcsUtc(c.start)}/${toIcsUtc(c.end)}`,
    details: c.details,
    location: c.location,
    ctz: ev.timezone,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function outlookLink(host: string, ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  const c = common(ev, s, pageUrl);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: c.title,
    startdt: iso(c.start),
    enddt: iso(c.end),
    body: c.details,
    location: c.location,
    allday: "false",
  });
  return `https://${host}/calendar/0/action/compose?${p.toString()}`;
}

/** Outlook.com, Hotmail, Live (comptes personnels). */
export function outlookPersonalLink(ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  return outlookLink("outlook.live.com", ev, s, pageUrl);
}

/** Microsoft 365 / Outlook professionnel ou scolaire. */
export function outlookWorkLink(ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  return outlookLink("outlook.office.com", ev, s, pageUrl);
}

/** Yahoo Agenda — format non documenté officiellement, désactivé par défaut. */
export function yahooLink(ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  const c = common(ev, s, pageUrl);
  const p = new URLSearchParams({
    v: "60",
    title: c.title,
    st: toIcsUtc(c.start),
    et: toIcsUtc(c.end),
    desc: c.details,
    in_loc: c.location,
  });
  return `https://calendar.yahoo.com/?${p.toString()}`;
}

export function providerLink(provider: "google" | "outlook_personal" | "outlook_work" | "yahoo", ev: PublicEvent, s: CalendarSession, pageUrl: string) {
  switch (provider) {
    case "google":
      return googleLink(ev, s, pageUrl);
    case "outlook_personal":
      return outlookPersonalLink(ev, s, pageUrl);
    case "outlook_work":
      return outlookWorkLink(ev, s, pageUrl);
    case "yahoo":
      return yahooLink(ev, s, pageUrl);
  }
}
