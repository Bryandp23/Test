import { expect, type Page } from "@playwright/test";

export const MOCK = process.env.E2E_MOCK!;

export async function login(page: Page, who: "admin" | "editor" = "admin") {
  await page.goto("/admin/login");
  await page.getByLabel("Adresse email").fill(who === "admin" ? "admin@ephec.local" : "editeur@ephec.local");
  await page.getByLabel("Mot de passe").fill(who === "admin" ? "Demo-EPHEC-2026!" : "Demo-Editeur-2026!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/admin$/);
}

/** URL publique d'un événement, lue sur l'écran de partage du back-office (comme le ferait un collaborateur). */
export async function eventUrl(page: Page, title: string | RegExp): Promise<{ url: string; editHref: string }> {
  await page.goto("/admin");
  for (const tab of ["À venir", "Annulés", "Passés", "Brouillons"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    const link = page.getByRole("link", { name: title }).first();
    if (await link.count()) {
      const editHref = (await link.getAttribute("href"))!;
      await page.goto(`${editHref}/partager`);
      const url = await page.getByRole("textbox", { name: "Lien de la page d'ajout" }).inputValue();
      return { url: new URL(url).pathname, editHref };
    }
  }
  throw new Error(`Événement introuvable : ${title}`);
}

export async function mockState() {
  return (await fetch(`${MOCK}/__state`)).json() as Promise<{ events: { id: string; summary: string; start: { dateTime: string }; transparency: string }[]; revoked: number }>;
}

export async function expectNoFalseSuccess(page: Page) {
  await expect(page.getByText(/Événement ajouté|séances ajoutées/)).toHaveCount(0);
}
