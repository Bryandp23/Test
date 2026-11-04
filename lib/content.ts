// Construction du contenu textuel intégré aux calendriers (titre, lieu, description).
// Une seule source de vérité utilisée par les fichiers ICS, les liens et les API.
import type { CalendarSession, PublicEvent } from "./types";
import { EVENT_TYPE_LABELS } from "./types";

export function sessionLocation(ev: PublicEvent, s: CalendarSession) {
  return {
    locationName: s.locationName ?? ev.locationName,
    address: s.address ?? ev.address,
    room: s.room ?? ev.room,
    onlineUrl: s.onlineUrl ?? ev.onlineUrl,
  };
}

export function isMulti(ev: PublicEvent) {
  return ev.sessions.length > 1;
}

export function buildSummary(ev: PublicEvent, s: CalendarSession): string {
  let t = `EPHEC | ${ev.title.trim()}`;
  if (s.total > 1) {
    t += ` — Séance ${s.index}/${s.total}`;
    if (s.title) t += ` : ${s.title.trim()}`;
  }
  if (s.status === "cancelled" || ev.status === "cancelled") t = `ANNULÉ — ${t}`;
  return t;
}

/** Champ LOCATION : adresse physique si présentiel/hybride, sinon le lien de connexion. */
export function buildLocation(ev: PublicEvent, s: CalendarSession): string {
  const loc = sessionLocation(ev, s);
  if (ev.format === "online") {
    return loc.onlineUrl ? loc.onlineUrl : `En ligne${ev.onlinePlatform ? ` (${ev.onlinePlatform})` : ""}`;
  }
  const parts = [loc.locationName, loc.room ? `Local ${loc.room}` : null, loc.address].filter(Boolean);
  return parts.join(", ");
}

export interface DescriptionOptions {
  pageUrl: string;
  maxLength?: number;
}

export function buildDescription(ev: PublicEvent, s: CalendarSession, opts: DescriptionOptions): string {
  const loc = sessionLocation(ev, s);
  const lines: string[] = [];
  const kind = EVENT_TYPE_LABELS[ev.type];
  if (ev.status === "cancelled" || s.status === "cancelled") {
    lines.push("Cette séance a été annulée par l'EPHEC.");
    if (ev.cancelReason) lines.push(ev.cancelReason);
    lines.push("");
  }
  lines.push(s.total > 1 ? `${kind} EPHEC — séance ${s.index} sur ${s.total}` : `${kind} EPHEC`);
  if (s.title && s.total > 1) lines.push(s.title);
  if (ev.description.trim()) {
    lines.push("", ev.description.trim());
  }
  if (loc.onlineUrl && ev.format !== "onsite") {
    lines.push("", `Rejoindre en ligne${ev.onlinePlatform ? ` (${ev.onlinePlatform})` : ""} :`, loc.onlineUrl);
  }
  if (ev.format !== "online" && (loc.locationName || loc.address)) {
    lines.push("", "Lieu :");
    if (loc.locationName) lines.push(loc.locationName);
    if (loc.room) lines.push(`Local : ${loc.room}`);
    if (loc.address) lines.push(loc.address);
  }
  if (ev.infoUrl) lines.push("", "Page de la formation :", ev.infoUrl);
  const contact = [ev.organizerName, ev.organizerEmail, ev.organizerPhone].filter(Boolean);
  if (contact.length) lines.push("", `Contact : ${contact.join(" — ")}`);
  lines.push("", "Informations à jour :", opts.pageUrl);
  let text = lines.join("\n");
  if (opts.maxLength && text.length > opts.maxLength) {
    // On raccourcit la description libre, jamais les liens utiles.
    const overflow = text.length - opts.maxLength + 1;
    const desc = ev.description.trim();
    if (desc.length > overflow + 20) {
      const shortened = desc.slice(0, desc.length - overflow - 1).trimEnd() + "…";
      text = text.replace(desc, shortened);
    }
  }
  return text;
}
