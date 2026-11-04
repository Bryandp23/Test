// Validation partagée entre l'interface d'administration (retour immédiat) et l'API (contrôle final).
import type { EventInput, SessionInput } from "./types";
import { durationMinutes, formatLongDate, isValidDate, isValidTime, isValidTimeZone, localToUtc } from "./time";

export interface ValidationIssue {
  field: string; // ex. "title", "sessions.2.endTime"
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isHttpUrl(v: string) {
  return URL_RE.test(v.trim());
}

export function sortSessions<T extends SessionInput>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

/**
 * @param mode "draft" : seules les erreurs bloquantes pour l'enregistrement ; "publish" : tout doit être complet.
 */
export function validateEvent(ev: EventInput, mode: "draft" | "publish", today?: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (field: string, message: string) => errors.push({ field, message });
  const warn = (field: string, message: string) => warnings.push({ field, message });
  const strict = mode === "publish";

  if (!ev.title.trim()) err("title", "Donnez un nom à l'événement. C'est ce que le participant verra en premier.");
  else if (ev.title.length > 140) err("title", "Le nom est un peu long (140 caractères maximum).");
  if (/^ephec\s*\|/i.test(ev.title.trim())) warn("title", "Inutile d'écrire « EPHEC | » : il est ajouté automatiquement dans le calendrier.");

  if (ev.description.length > 2000) err("description", "La description dépasse 2 000 caractères. Gardez l'essentiel : le détail peut rester sur ephec.be.");
  if (ev.infoUrl.trim() && !isHttpUrl(ev.infoUrl)) err("infoUrl", "Ce lien ne semble pas valide. Il doit commencer par https://");
  if (ev.imageUrl.trim() && !isHttpUrl(ev.imageUrl)) err("imageUrl", "Le lien de l'image doit commencer par https://");
  if (ev.organizerEmail.trim() && !EMAIL_RE.test(ev.organizerEmail.trim())) err("organizerEmail", "Cette adresse email semble incomplète (exemple : formation.continue@ephec.be).");
  if (!isValidTimeZone(ev.timezone)) err("timezone", "Fuseau horaire inconnu.");

  const needsPlace = ev.format === "onsite" || ev.format === "hybrid";
  const needsLink = ev.format === "online" || ev.format === "hybrid";
  if (ev.onlineUrl.trim() && !isHttpUrl(ev.onlineUrl)) err("onlineUrl", "Le lien de connexion doit commencer par https:// (copiez-le depuis Teams ou Zoom).");

  const sessions = ev.sessions;
  if (sessions.length === 0) err("sessions", "Ajoutez au moins une date.");
  if (sessions.length > 100) err("sessions", "100 séances maximum par événement.");

  const seen = new Map<string, number>();
  const activeSorted = sortSessions(sessions.filter((s) => s.status !== "cancelled"));
  sessions.forEach((s, i) => {
    const f = (k: string) => `sessions.${i}.${k}`;
    const label = sessions.length > 1 ? `Séance ${i + 1} : ` : "";
    if (s.status === "cancelled") return;
    if (!s.date) err(f("date"), `${label}indiquez la date.`);
    else if (!isValidDate(s.date)) err(f("date"), `${label}cette date n'existe pas.`);
    if (!s.startTime) err(f("startTime"), `${label}indiquez l'heure de début.`);
    else if (!isValidTime(s.startTime)) err(f("startTime"), `${label}heure de début invalide (format 09:30).`);
    if (!s.endTime) err(f("endTime"), `${label}indiquez l'heure de fin.`);
    else if (!isValidTime(s.endTime)) err(f("endTime"), `${label}heure de fin invalide (format 17:00).`);
    if (s.onlineUrl && s.onlineUrl.trim() && !isHttpUrl(s.onlineUrl)) err(f("onlineUrl"), `${label}le lien de connexion doit commencer par https://`);
    if (!isValidDate(s.date) || !isValidTime(s.startTime) || !isValidTime(s.endTime)) return;

    const d = durationMinutes(s.startTime, s.endTime);
    if (d <= 0) err(f("endTime"), `${label}l'heure de fin (${s.endTime}) est avant ou égale à l'heure de début (${s.startTime}).`);
    else if (d > 12 * 60) warn(f("endTime"), `${label}la séance dure plus de 12 heures. Est-ce bien voulu ?`);
    else if (d < 15) warn(f("endTime"), `${label}la séance dure moins de 15 minutes.`);

    for (const [k, t] of [["startTime", s.startTime], ["endTime", s.endTime]] as const) {
      const r = localToUtc(s.date, t, ev.timezone);
      if (!r.ok && r.reason === "nonexistent")
        err(f(k), `${label}${t} n'existe pas le ${formatLongDate(s.date)} : c'est la nuit du passage à l'heure d'été. Choisissez une autre heure.`);
      if (r.ok && r.ambiguous)
        warn(f(k), `${label}${t} existe deux fois le ${formatLongDate(s.date)} (passage à l'heure d'hiver). La première occurrence sera utilisée.`);
    }
    const key = `${s.date} ${s.startTime}`;
    if (seen.has(key)) err(f("date"), `${label}cette séance est en double avec la séance ${seen.get(key)! + 1} (même date et même heure).`);
    else seen.set(key, i);
    if (today && s.date < today && strict) warn(f("date"), `${label}cette date est déjà passée.`);
    const eventHasPlace = !!(ev.address.trim() || ev.locationName.trim());
    const anySessionPlace = sessions.some((x) => (x.address ?? "").trim() || (x.locationName ?? "").trim());
    if (strict && needsPlace && !eventHasPlace && anySessionPlace && !(s.address ?? "").trim() && !(s.locationName ?? "").trim())
      err(f("address"), `${label}indiquez le lieu de cette séance (ou une adresse commune à toutes les séances).`);
  });

  // Chevauchements entre séances (dates/horaires qui se recouvrent)
  for (let i = 1; i < activeSorted.length; i++) {
    const a = activeSorted[i - 1];
    const b = activeSorted[i];
    if (a.date === b.date && isValidTime(a.endTime) && isValidTime(b.startTime) && a.endTime > b.startTime && a.startTime !== b.startTime) {
      const idx = sessions.indexOf(b);
      warn(`sessions.${idx}.startTime`, `Cette séance chevauche la précédente le ${formatLongDate(b.date)}.`);
    }
  }

  if (strict) {
    if (needsPlace && !ev.address.trim() && !ev.locationName.trim() && !sessions.some((s) => s.address || s.locationName))
      err("address", "Indiquez l'adresse du lieu : elle apparaîtra dans le calendrier du participant.");
    if (needsLink && !ev.onlineUrl.trim() && !sessions.some((s) => s.onlineUrl))
      warn("onlineUrl", "Aucun lien de connexion : vous pourrez l'ajouter plus tard, la page se mettra à jour.");
    if (!ev.description.trim()) warn("description", "Une courte description aide le participant à se repérer dans son agenda.");
    if (!ev.infoUrl.trim()) warn("infoUrl", "Ajoutez le lien de la page ephec.be pour que le participant retrouve tous les détails.");
  }
  // Évite des doublons d'erreurs identiques (adresse manquante répétée par séance).
  const uniq = (arr: ValidationIssue[]) => arr.filter((x, i) => arr.findIndex((y) => y.field === x.field && y.message === x.message) === i);
  return { errors: uniq(errors), warnings: uniq(warnings) };
}

export function emptyEventInput(): EventInput {
  return {
    title: "",
    type: "formation",
    description: "",
    infoUrl: "",
    organizerName: "Formation Continue EPHEC",
    organizerEmail: "",
    organizerPhone: "",
    imageUrl: "",
    format: "onsite",
    locationName: "",
    address: "",
    room: "",
    onlineUrl: "",
    onlinePlatform: "",
    timezone: "Europe/Brussels",
    reminderMinutes: 1440,
    sessionSelection: "all",
    sessions: [{ date: "", startTime: "", endTime: "" }],
  };
}
