// Détection non intrusive des capacités de l'appareil (côté navigateur, rien n'est transmis ni stocké).
export type OS = "ios" | "ipados" | "android" | "macos" | "windows" | "linux" | "chromeos" | "other";
export type DeviceClass = "mobile" | "tablet" | "desktop";

export interface DeviceInfo {
  os: OS;
  device: DeviceClass;
  /** Navigateur intégré à une application (Gmail, Outlook, Facebook, LinkedIn…) : téléchargements parfois bloqués. */
  inApp: boolean;
  inAppName: string | null;
}

export function detectDevice(ua: string, maxTouchPoints = 0, platform = ""): DeviceInfo {
  let os: OS = "other";
  if (/iPhone|iPod/.test(ua)) os = "ios";
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) os = "ipados";
  else if (/Android/.test(ua)) os = "android";
  else if (/CrOS/.test(ua)) os = "chromeos";
  else if (/Macintosh|Mac OS X/.test(ua) || /Mac/.test(platform)) os = "macos";
  else if (/Windows/.test(ua)) os = "windows";
  else if (/Linux/.test(ua)) os = "linux";

  let device: DeviceClass = "desktop";
  if (os === "ipados" || (os === "android" && !/Mobile/.test(ua))) device = "tablet";
  else if (os === "ios" || os === "android" || /Mobile/.test(ua)) device = "mobile";

  let inAppName: string | null = null;
  if (/GSA\//.test(ua)) inAppName = "Google";
  else if (/FBAN|FBAV|FB_IAB/.test(ua)) inAppName = "Facebook";
  else if (/Instagram/.test(ua)) inAppName = "Instagram";
  else if (/LinkedInApp/.test(ua)) inAppName = "LinkedIn";
  else if (/Outlook|OutlookMobile|ms-office/i.test(ua) && device !== "desktop") inAppName = "Outlook";
  else if (/Gmail/i.test(ua)) inAppName = "Gmail";
  else if (os === "android" && /; wv\)/.test(ua)) inAppName = "application";
  else if ((os === "ios" || os === "ipados") && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) inAppName = "application";
  return { os, device, inApp: inAppName !== null, inAppName };
}

export type SuggestedProvider = "google" | "outlook" | "apple" | null;

/**
 * Suggestion douce : on ne suppose JAMAIS le calendrier utilisé ; on met simplement en avant l'option
 * la plus fréquente pour la plateforme, toutes les autres restant visibles au même niveau.
 */
export function suggestProvider(d: DeviceInfo): SuggestedProvider {
  if (d.os === "android" || d.os === "chromeos") return "google";
  if (d.os === "windows") return "outlook";
  if (d.os === "ios" || d.os === "ipados" || d.os === "macos") return "apple";
  return null;
}
