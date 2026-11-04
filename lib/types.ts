// Types partagés client / serveur.

export type EventType = "formation" | "webinaire" | "conference" | "seance_info" | "autre";
export type EventFormat = "onsite" | "online" | "hybrid";
export type EventStatus = "draft" | "published" | "cancelled" | "archived";
export type SessionSelection = "all" | "choose";
export type ProviderId = "google" | "outlook_personal" | "outlook_work" | "apple" | "ics" | "yahoo";
export type ApiProvider = "google" | "microsoft";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  formation: "Formation",
  webinaire: "Webinaire",
  conference: "Conférence",
  seance_info: "Séance d'information",
  autre: "Autre",
};

export const FORMAT_LABELS: Record<EventFormat, string> = {
  onsite: "En présentiel",
  online: "En ligne",
  hybrid: "Hybride (sur place ou en ligne)",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  cancelled: "Annulé",
  archived: "Archivé",
};

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Aucun rappel" },
  { value: 15, label: "15 minutes avant" },
  { value: 30, label: "30 minutes avant" },
  { value: 60, label: "1 heure avant" },
  { value: 120, label: "2 heures avant" },
  { value: 1440, label: "1 jour avant" },
  { value: 2880, label: "2 jours avant" },
];

/** Données saisies pour une séance. Dates et heures en heure locale du fuseau de l'événement. */
export interface SessionInput {
  id?: string;
  title?: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  locationName?: string | null;
  address?: string | null;
  room?: string | null;
  onlineUrl?: string | null;
  status?: "active" | "cancelled";
}

export interface EventInput {
  title: string;
  type: EventType;
  description: string;
  infoUrl: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  imageUrl: string;
  format: EventFormat;
  locationName: string;
  address: string;
  room: string;
  onlineUrl: string;
  onlinePlatform: string;
  timezone: string;
  reminderMinutes: number | null;
  sessionSelection: SessionSelection;
  sessions: SessionInput[];
}

export interface CalendarSession {
  id: string;
  index: number; // 1-based, ordre chronologique
  total: number;
  title: string | null;
  date: string;
  startTime: string;
  endTime: string;
  startUtc: string; // ISO
  endUtc: string; // ISO
  locationName: string | null;
  address: string | null;
  room: string | null;
  onlineUrl: string | null;
  status: "active" | "cancelled";
  sequence: number;
  updatedAt: string;
}

/** Vue publique d'un événement : jamais de données personnelles. */
export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  type: EventType;
  description: string;
  infoUrl: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  organizerPhone: string | null;
  imageUrl: string | null;
  format: EventFormat;
  locationName: string | null;
  address: string | null;
  room: string | null;
  onlineUrl: string | null;
  onlinePlatform: string | null;
  timezone: string;
  reminderMinutes: number | null;
  sessionSelection: SessionSelection;
  status: EventStatus;
  sequence: number;
  isDemo: boolean;
  cancelReason: string | null;
  updatedAt: string;
  sessions: CalendarSession[];
}
