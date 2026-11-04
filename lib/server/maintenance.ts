import "server-only";
import { q } from "./db";
import { purgeOldStats } from "./stats";

let lastRun = 0;

/** Tâches de conservation RGPD, exécutées au plus une fois par heure (à brancher sur un cron en production). */
export async function runMaintenance() {
  if (Date.now() - lastRun < 3600_000) return;
  lastRun = Date.now();
  try {
    await purgeOldStats();
    // Connexions d'agenda inutilisées depuis 12 mois : jetons et adresses effacés.
    await q(`delete from calendar_connections where last_used_at < now() - interval '12 months'`);
    await q(`delete from admin_sessions where expires_at < now()`);
  } catch (e) {
    console.error("[maintenance]", e);
  }
}
