// HTML de bouton pour emails (ActiveCampaign, Outlook, Gmail, Apple Mail…).
// Structure en tableau + styles en ligne : seule approche fiable dans les clients email.
// Outlook pour Windows ignore border-radius : le bouton y reste rectangulaire mais parfaitement lisible.

export const BRAND = "#27958F";
/** Turquoise EPHEC assombri : contraste 5,1:1 avec le blanc (WCAG AA), contre 3,6:1 pour #27958F. */
export const BRAND_ACCESSIBLE = "#1D7A75";

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ButtonOptions {
  url: string;
  label?: string;
  /** Afficher un lien texte de secours sous le bouton. */
  fallback?: boolean;
  align?: "left" | "center";
}

export function emailButtonHtml({ url, label = "Ajouter à mon calendrier", fallback = true, align = "left" }: ButtonOptions): string {
  const u = escHtml(url);
  const l = escHtml(label);
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const lines = [
    `<!-- Bouton EPHEC Calendar : ${l} -->`,
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="${align}" style="border-collapse:separate;margin:16px 0;">`,
    `  <tr>`,
    `    <td align="center" bgcolor="${BRAND_ACCESSIBLE}" style="background-color:${BRAND_ACCESSIBLE};border-radius:4px 18px 4px 18px;mso-padding-alt:14px 28px;">`,
    `      <a href="${u}" target="_blank" style="display:inline-block;padding:14px 28px;${font}font-size:17px;font-weight:bold;line-height:22px;color:#ffffff;text-decoration:none;border-radius:4px 18px 4px 18px;">&#128197;&nbsp;${l}</a>`,
    `    </td>`,
    `  </tr>`,
    `</table>`,
  ];
  if (fallback) {
    lines.push(
      `<p style="clear:both;margin:0 0 16px 0;${font}font-size:13px;line-height:19px;color:#4b5563;">Le bouton ne fonctionne pas&nbsp;? Ouvrez ce lien&nbsp;: <a href="${u}" target="_blank" style="color:${BRAND_ACCESSIBLE};text-decoration:underline;word-break:break-all;">${u}</a></p>`
    );
  }
  return lines.join("\n");
}

/** Texte prêt à coller dans un email de modification envoyé par les canaux EPHEC habituels. */
export function changeEmailText(p: { title: string; changes: string[]; url: string }): string {
  return [
    `Objet : Modification — ${p.title}`,
    "",
    "Bonjour,",
    "",
    `Des informations ont changé pour « ${p.title} » :`,
    ...p.changes.map((c) => `• ${c}`),
    "",
    "Si vous avez ajouté cet événement à votre calendrier au moyen d'un lien ou d'un fichier, pensez à le mettre à jour.",
    "Les informations à jour et le bouton pour l'ajouter de nouveau sont disponibles ici :",
    p.url,
    "",
    "Si vous aviez connecté votre agenda Google ou Outlook sur cette page, la modification y a été appliquée automatiquement.",
    "",
    "Bien à vous,",
    "Le service Formation Continue de l'EPHEC",
  ].join("\n");
}

export function cancelEmailText(p: { title: string; reason: string | null; url: string }): string {
  return [
    `Objet : Annulation — ${p.title}`,
    "",
    "Bonjour,",
    "",
    `Nous sommes au regret de vous informer que « ${p.title} » est annulé.`,
    ...(p.reason ? ["", p.reason] : []),
    "",
    "Si vous l'aviez ajouté à votre calendrier au moyen d'un lien ou d'un fichier, nous vous invitons à le supprimer.",
    "Si vous aviez connecté votre agenda Google ou Outlook sur notre page, l'événement y est déjà marqué comme annulé.",
    "",
    `Plus d'informations : ${p.url}`,
    "",
    "Bien à vous,",
    "Le service Formation Continue de l'EPHEC",
  ].join("\n");
}
