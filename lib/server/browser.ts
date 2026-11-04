import "server-only";
import { randomToken, sign, unsign } from "./crypto";

/**
 * Cookie fonctionnel posé UNIQUEMENT lorsqu'un participant connecte volontairement un calendrier (Mode B).
 * Il relie ce navigateur à sa connexion, sans compte ni donnée d'identité. Supprimé à la déconnexion.
 */
export const BROWSER_COOKIE = "ec_browser";
export const BROWSER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function readBrowserKey(v: string | undefined | null): string | null {
  return unsign(v);
}

export function newBrowserKey(): { key: string; cookie: string } {
  const key = randomToken(24);
  return { key, cookie: sign(key) };
}

export const cookieSecure = () => process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES;
