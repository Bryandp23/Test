import { describe, expect, it } from "vitest";
import ICAL from "ical.js";
import { localToUtc, formatLongDate } from "@/lib/time";
import { buildIcs, escapeText, foldLine } from "@/lib/ics";
import { googleLink, outlookPersonalLink, outlookWorkLink } from "@/lib/links";
import { validateEvent, emptyEventInput } from "@/lib/validation";
import type { CalendarSession, PublicEvent } from "@/lib/types";
import { emailButtonHtml } from "@/lib/email";

function session(p: Partial<CalendarSession> & { date: string; startTime: string; endTime: string }, i = 1, total = 1): CalendarSession {
  const s = localToUtc(p.date, p.startTime, "Europe/Brussels");
  const e = localToUtc(p.date, p.endTime, "Europe/Brussels");
  if (!s.ok || !e.ok) throw new Error("bad");
  return {
    id: p.id ?? `00000000-0000-4000-8000-00000000000${i}`,
    index: i,
    total,
    title: p.title ?? null,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    startUtc: s.utc.toISOString(),
    endUtc: e.utc.toISOString(),
    locationName: null,
    address: null,
    room: null,
    onlineUrl: null,
    status: p.status ?? "active",
    sequence: p.sequence ?? 0,
    updatedAt: "2026-11-01T10:00:00.000Z",
  };
}

function event(sessions: CalendarSession[], over: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: "ev",
    slug: "abcd2345",
    title: "Découvrir l'IA ; cas, pratiques & « accents »",
    type: "webinaire",
    description: "Ligne 1\nLigne 2 avec virgule, point-virgule ; et antislash \\ — émoji 📅",
    infoUrl: "https://www.ephec.be",
    organizerName: "Formation Continue EPHEC",
    organizerEmail: null,
    organizerPhone: null,
    imageUrl: null,
    format: "online",
    locationName: null,
    address: null,
    room: null,
    onlineUrl: "https://teams.microsoft.com/l/meetup-join/FICTIF",
    onlinePlatform: "Microsoft Teams",
    timezone: "Europe/Brussels",
    reminderMinutes: 60,
    sessionSelection: "all",
    status: "published",
    sequence: 0,
    isDemo: true,
    cancelReason: null,
    updatedAt: "2026-11-01T10:00:00.000Z",
    sessions,
    ...over,
  };
}

describe("fuseau Europe/Brussels et changements d'heure", () => {
  it("hiver : UTC+1", () => {
    const r = localToUtc("2026-11-19", "12:00", "Europe/Brussels");
    expect(r.ok && r.utc.toISOString()).toBe("2026-11-19T11:00:00.000Z");
  });
  it("été : UTC+2", () => {
    const r = localToUtc("2027-03-30", "18:00", "Europe/Brussels");
    expect(r.ok && r.utc.toISOString()).toBe("2027-03-30T16:00:00.000Z");
  });
  it("veille et lendemain du passage à l'heure d'été (28 mars 2027)", () => {
    const a = localToUtc("2027-03-27", "10:00", "Europe/Brussels");
    const b = localToUtc("2027-03-28", "10:00", "Europe/Brussels");
    expect(a.ok && a.utc.toISOString()).toBe("2027-03-27T09:00:00.000Z");
    expect(b.ok && b.utc.toISOString()).toBe("2027-03-28T08:00:00.000Z");
  });
  it("heure inexistante (02:30 le 28 mars 2027) détectée", () => {
    expect(localToUtc("2027-03-28", "02:30", "Europe/Brussels")).toEqual({ ok: false, reason: "nonexistent" });
  });
  it("heure ambiguë (02:30 le 31 octobre 2027) : première occurrence", () => {
    const r = localToUtc("2027-10-31", "02:30", "Europe/Brussels");
    expect(r.ok && r.ambiguous).toBe(true);
    expect(r.ok && r.utc.toISOString()).toBe("2027-10-31T00:30:00.000Z");
  });
  it("dates invalides refusées", () => {
    expect(localToUtc("2027-02-30", "10:00", "Europe/Brussels").ok).toBe(false);
    expect(localToUtc("2027-02-10", "24:00", "Europe/Brussels").ok).toBe(false);
  });
  it("format de date lisible en français", () => {
    expect(formatLongDate("2026-11-19")).toBe("jeudi 19 novembre 2026");
  });
});

describe("iCalendar RFC 5545", () => {
  it("échappe les caractères spéciaux", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
  it("plie les lignes à 75 octets sans couper l'UTF-8", () => {
    const line = "DESCRIPTION:" + "é".repeat(100);
    const folded = foldLine(line);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
  it("fichier valide, relu par un parseur indépendant, heures exactes été/hiver", () => {
    const sessions = [
      session({ date: "2027-03-23", startTime: "18:00", endTime: "21:00" }, 1, 2),
      session({ date: "2027-03-30", startTime: "18:00", endTime: "21:00", sequence: 3 }, 2, 2),
    ];
    const ev = event(sessions);
    const ics = buildIcs(ev, sessions, { pageUrl: "https://agenda.example/e/abcd2345" });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    const comp = new ICAL.Component(ICAL.parse(ics));
    const tz = comp.getFirstSubcomponent("vtimezone")!;
    ICAL.TimezoneService.register(tz);
    const vevents = comp.getAllSubcomponents("vevent");
    expect(vevents).toHaveLength(2);
    const e1 = new ICAL.Event(vevents[0]);
    const e2 = new ICAL.Event(vevents[1]);
    expect(e1.startDate.toJSDate().toISOString()).toBe("2027-03-23T17:00:00.000Z");
    expect(e2.startDate.toJSDate().toISOString()).toBe("2027-03-30T16:00:00.000Z");
    expect(e2.endDate.toJSDate().toISOString()).toBe("2027-03-30T19:00:00.000Z");
    expect(e1.uid).toBe("00000000-0000-4000-8000-000000000001@ephec-calendar");
    expect(e2.sequence).toBe(3);
    expect(e1.summary).toBe("EPHEC | Découvrir l'IA ; cas, pratiques & « accents » — Séance 1/2");
    expect(e1.description).toContain("point-virgule ; et antislash \\ — émoji 📅");
    expect(e1.description).toContain("Ligne 1\nLigne 2");
    expect(e1.location).toBe("https://teams.microsoft.com/l/meetup-join/FICTIF");
    const alarm = vevents[0].getFirstSubcomponent("valarm")!;
    expect(alarm.getFirstPropertyValue("trigger")!.toString()).toBe("-PT1H");
    expect(vevents[0].getFirstPropertyValue("dtstamp")).toBeTruthy();
  });
  it("annulation : METHOD:CANCEL et STATUS:CANCELLED", () => {
    const sessions = [session({ date: "2026-11-19", startTime: "12:00", endTime: "13:00", sequence: 2 })];
    const ics = buildIcs(event(sessions, { status: "cancelled" }), sessions, { pageUrl: "https://x/e/a", method: "CANCEL" });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toContain("BEGIN:VALARM");
  });
  it("les séances annulées sont exclues d'un import classique", () => {
    const sessions = [
      session({ date: "2027-01-14", startTime: "18:30", endTime: "20:30" }, 1, 2),
      session({ date: "2027-01-21", startTime: "18:30", endTime: "20:30", status: "cancelled" }, 2, 2),
    ];
    const ics = buildIcs(event(sessions), sessions, { pageUrl: "https://x/e/a" });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});

describe("liens fournisseurs", () => {
  const s = session({ date: "2026-11-19", startTime: "12:00", endTime: "13:00" });
  const ev = event([s]);
  it("Google : dates UTC exactes et champs encodés", () => {
    const u = new URL(googleLink(ev, s, "https://agenda.example/e/abcd2345"));
    expect(u.hostname).toBe("calendar.google.com");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261119T110000Z/20261119T120000Z");
    expect(u.searchParams.get("text")).toBe("EPHEC | Découvrir l'IA ; cas, pratiques & « accents »");
    expect(u.searchParams.get("ctz")).toBe("Europe/Brussels");
  });
  it("Outlook personnel et professionnel", () => {
    const a = new URL(outlookPersonalLink(ev, s, "https://x"));
    const b = new URL(outlookWorkLink(ev, s, "https://x"));
    expect(a.hostname).toBe("outlook.live.com");
    expect(b.hostname).toBe("outlook.office.com");
    expect(a.searchParams.get("startdt")).toBe("2026-11-19T11:00:00Z");
    expect(a.searchParams.get("enddt")).toBe("2026-11-19T12:00:00Z");
    expect(a.searchParams.get("rru")).toBe("addevent");
  });
  it("description longue tronquée sans perdre les liens", () => {
    const long = event([s], { description: "x".repeat(5000) });
    const u = new URL(googleLink(long, s, "https://agenda.example/e/abcd2345"));
    const d = u.searchParams.get("details")!;
    expect(d.length).toBeLessThanOrEqual(1200);
    expect(d).toContain("https://agenda.example/e/abcd2345");
    expect(d).toContain("https://teams.microsoft.com/l/meetup-join/FICTIF");
  });
});

describe("validation des formulaires", () => {
  const base = () => ({ ...emptyEventInput(), title: "Test", format: "online" as const });
  it("fin avant début", () => {
    const v = validateEvent({ ...base(), sessions: [{ date: "2027-01-10", startTime: "14:00", endTime: "13:00" }] }, "draft");
    expect(v.errors.map((e) => e.field)).toContain("sessions.0.endTime");
  });
  it("séance en double", () => {
    const s = { date: "2027-01-10", startTime: "14:00", endTime: "15:00" };
    const v = validateEvent({ ...base(), sessions: [s, { ...s }] }, "draft");
    expect(v.errors.some((e) => e.message.includes("double"))).toBe(true);
  });
  it("horaire manquant et date invalide", () => {
    const v = validateEvent({ ...base(), sessions: [{ date: "2027-02-31", startTime: "", endTime: "15:00" }] }, "draft");
    expect(v.errors.map((e) => e.field)).toEqual(expect.arrayContaining(["sessions.0.date", "sessions.0.startTime"]));
  });
  it("heure sautée par le passage à l'heure d'été", () => {
    const v = validateEvent({ ...base(), sessions: [{ date: "2027-03-28", startTime: "02:15", endTime: "04:00" }] }, "draft");
    expect(v.errors.some((e) => e.message.includes("heure d'été"))).toBe(true);
  });
  it("présentiel sans adresse : bloquant à la publication seulement", () => {
    const input = { ...base(), format: "onsite" as const, sessions: [{ date: "2027-01-10", startTime: "14:00", endTime: "15:00" }] };
    expect(validateEvent(input, "draft").errors).toHaveLength(0);
    expect(validateEvent(input, "publish").errors.map((e) => e.field)).toContain("address");
  });
});

describe("bouton email", () => {
  it("HTML compatible email : tableau, styles en ligne, texte de secours, URL échappée", () => {
    const html = emailButtonHtml({ url: "https://agenda.example/e/abc?x=1&y=2" });
    expect(html).toContain('role="presentation"');
    expect(html).toContain("https://agenda.example/e/abc?x=1&amp;y=2");
    expect(html).toContain("Ajouter à mon calendrier");
    expect(html).toContain("Le bouton ne fonctionne pas");
    expect(html).not.toMatch(/<style|class=/);
  });
});
