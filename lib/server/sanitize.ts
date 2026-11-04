import "server-only";
import type { EventInput, SessionInput } from "@/lib/types";
import { HttpError } from "./auth";

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const opt = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.slice(0, max) : null);
const TYPES = ["formation", "webinaire", "conference", "seance_info", "autre"];
const FORMATS = ["onsite", "online", "hybrid"];

/** Normalise une saisie reçue par l'API (types, longueurs, valeurs autorisées). La validation métier vient ensuite. */
export function sanitizeInput(raw: unknown): EventInput {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "Données manquantes.");
  const r = raw as Record<string, unknown>;
  const sessions = Array.isArray(r.sessions) ? r.sessions.slice(0, 120) : [];
  return {
    title: str(r.title, 200),
    type: (TYPES.includes(r.type as string) ? r.type : "formation") as EventInput["type"],
    description: str(r.description, 4000),
    infoUrl: str(r.infoUrl, 1000),
    organizerName: str(r.organizerName, 200),
    organizerEmail: str(r.organizerEmail, 200),
    organizerPhone: str(r.organizerPhone, 50),
    imageUrl: str(r.imageUrl, 1000),
    format: (FORMATS.includes(r.format as string) ? r.format : "onsite") as EventInput["format"],
    locationName: str(r.locationName, 200),
    address: str(r.address, 400),
    room: str(r.room, 100),
    onlineUrl: str(r.onlineUrl, 1500),
    onlinePlatform: str(r.onlinePlatform, 60),
    timezone: str(r.timezone, 60) || "Europe/Brussels",
    reminderMinutes: typeof r.reminderMinutes === "number" && r.reminderMinutes >= 0 && r.reminderMinutes <= 40320 ? Math.round(r.reminderMinutes) : null,
    sessionSelection: r.sessionSelection === "choose" ? "choose" : "all",
    sessions: sessions.map((x): SessionInput => {
      const s = (x ?? {}) as Record<string, unknown>;
      return {
        id: typeof s.id === "string" && /^[0-9a-f-]{36}$/i.test(s.id) ? s.id : undefined,
        title: opt(s.title, 200),
        date: str(s.date, 10),
        startTime: str(s.startTime, 5),
        endTime: str(s.endTime, 5),
        locationName: opt(s.locationName, 200),
        address: opt(s.address, 400),
        room: opt(s.room, 100),
        onlineUrl: opt(s.onlineUrl, 1500),
        status: s.status === "cancelled" ? "cancelled" : "active",
      };
    }),
  };
}
