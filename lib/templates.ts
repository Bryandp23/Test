import type { EventInput } from "./types";
import { emptyEventInput } from "./validation";

export interface Template {
  id: string;
  label: string;
  description: string;
  build: () => EventInput;
}

const nextWeekday = (weekday: number, weeksAhead = 2) => {
  const d = new Date();
  d.setDate(d.getDate() + weeksAhead * 7);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const plusDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const TEMPLATES: Template[] = [
  {
    id: "webinaire-teams",
    label: "Webinaire Teams",
    description: "En ligne, 1 heure, lien Teams, rappel 1 h avant.",
    build: () => ({
      ...emptyEventInput(),
      type: "webinaire",
      format: "online",
      onlinePlatform: "Microsoft Teams",
      reminderMinutes: 60,
      sessions: [{ date: nextWeekday(4), startTime: "12:00", endTime: "13:00" }],
    }),
  },
  {
    id: "conference",
    label: "Conférence en présentiel",
    description: "Sur un campus EPHEC, en soirée, rappel la veille.",
    build: () => ({
      ...emptyEventInput(),
      type: "conference",
      format: "onsite",
      reminderMinutes: 1440,
      sessions: [{ date: nextWeekday(2), startTime: "18:30", endTime: "20:30" }],
    }),
  },
  {
    id: "seance-info",
    label: "Séance d'information",
    description: "Hybride (sur place et en ligne), 1 h 30.",
    build: () => ({
      ...emptyEventInput(),
      type: "seance_info",
      format: "hybrid",
      onlinePlatform: "Microsoft Teams",
      reminderMinutes: 1440,
      sessions: [{ date: nextWeekday(3), startTime: "18:00", endTime: "19:30" }],
    }),
  },
  {
    id: "cycle",
    label: "Cycle de plusieurs séances",
    description: "Formation hebdomadaire : 6 séances préremplies, à ajuster.",
    build: () => {
      const first = nextWeekday(2, 3);
      return {
        ...emptyEventInput(),
        type: "formation",
        format: "onsite",
        reminderMinutes: 1440,
        sessionSelection: "all",
        sessions: Array.from({ length: 6 }, (_, i) => ({ date: plusDays(first, i * 7), startTime: "18:00", endTime: "21:00" })),
      };
    },
  },
];

export function addWeek(date: string) {
  return date ? plusDays(date, 7) : "";
}

export function detectPlatform(url: string): string | null {
  if (/teams\.(microsoft|live)\.com/i.test(url)) return "Microsoft Teams";
  if (/zoom\.us/i.test(url)) return "Zoom";
  if (/meet\.google\.com/i.test(url)) return "Google Meet";
  if (/webex\.com/i.test(url)) return "Webex";
  return null;
}
