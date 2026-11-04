// Construit, côté navigateur, la vue publique d'un événement en cours de saisie : sert à la prévisualisation fidèle.
import type { CalendarSession, EventInput, PublicEvent } from "./types";
import { localToUtc } from "./time";
import { sortSessions } from "./validation";

export function inputToPublic(input: EventInput, meta: { id?: string; slug?: string; status?: PublicEvent["status"] } = {}): PublicEvent {
  const sessions = sortSessions(input.sessions.filter((s) => s.date && s.startTime && s.endTime));
  const active = sessions.filter((s) => s.status !== "cancelled");
  let i = 0;
  const cal: CalendarSession[] = sessions.map((s, k) => {
    const a = localToUtc(s.date, s.startTime, input.timezone);
    const b = localToUtc(s.date, s.endTime, input.timezone);
    const isActive = s.status !== "cancelled";
    if (isActive) i++;
    return {
      id: s.id ?? `preview-${k}`,
      index: isActive ? i : 0,
      total: active.length,
      title: s.title ?? null,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      startUtc: a.ok ? a.utc.toISOString() : new Date(0).toISOString(),
      endUtc: b.ok ? b.utc.toISOString() : new Date(0).toISOString(),
      locationName: s.locationName || null,
      address: s.address || null,
      room: s.room || null,
      onlineUrl: s.onlineUrl || null,
      status: s.status ?? "active",
      sequence: 0,
      updatedAt: new Date().toISOString(),
    };
  });
  const nn = (v: string) => (v.trim() ? v.trim() : null);
  return {
    id: meta.id ?? "preview",
    slug: meta.slug ?? "apercu",
    title: input.title || "Nom de l'événement",
    type: input.type,
    description: input.description,
    infoUrl: nn(input.infoUrl),
    organizerName: nn(input.organizerName),
    organizerEmail: nn(input.organizerEmail),
    organizerPhone: nn(input.organizerPhone),
    imageUrl: nn(input.imageUrl),
    format: input.format,
    locationName: nn(input.locationName),
    address: nn(input.address),
    room: nn(input.room),
    onlineUrl: input.format === "onsite" ? null : nn(input.onlineUrl),
    onlinePlatform: input.format === "onsite" ? null : nn(input.onlinePlatform),
    timezone: input.timezone,
    reminderMinutes: input.reminderMinutes,
    sessionSelection: input.sessionSelection,
    status: meta.status ?? "draft",
    sequence: 0,
    isDemo: false,
    cancelReason: null,
    updatedAt: new Date().toISOString(),
    sessions: cal,
  };
}
