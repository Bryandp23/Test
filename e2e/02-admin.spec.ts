import { test, expect } from "@playwright/test";
import ICAL from "ical.js";
import { eventUrl, login } from "./helpers";

test.describe.configure({ mode: "serial" });

const TITLE = "Atelier e2e — Gestion de projet";
let publicPath = "";
let editHref = "";

test("Un collaborateur (rôle éditeur) crée un cycle sans écrire de code, avec erreurs guidées", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, "editor");
  await page.getByRole("link", { name: "Créer un événement" }).click();
  await page.getByRole("link", { name: /Cycle de plusieurs séances/ }).click();

  // Étape 1 : oubli du nom → message bienveillant, focus sur le champ.
  await page.getByRole("button", { name: "Continuer →" }).click();
  await expect(page.getByText("Donnez un nom à l'événement.", { exact: false })).toBeVisible();
  await page.getByLabel("Nom de l'événement").fill(TITLE);
  await page.getByLabel(/Courte description/).fill("Quatre soirées pour structurer vos projets.");
  await page.getByRole("button", { name: "Continuer →" }).click();

  // Étape 2 : 6 séances proposées par le modèle ; on crée une erreur (fin avant début) puis on la corrige.
  await expect(page.getByRole("heading", { name: /Séances \(6\)/ })).toBeVisible();
  await page.locator("#e-1").fill("17:00");
  await page.getByLabel("Adresse complète").fill("Avenue Konrad Adenauer 3, 1200 Woluwe-Saint-Lambert");
  await page.getByRole("button", { name: "Continuer →" }).click();
  await expect(page.getByText(/l'heure de fin \(17:00\) est avant ou égale/)).toBeVisible();
  await page.locator("#e-1").fill("21:00");
  // Séance en double → bloquée
  const d0 = await page.locator("#d-0").inputValue();
  await page.locator("#d-1").fill(d0);
  await page.getByRole("button", { name: "Continuer →" }).click();
  await expect(page.getByText(/en double avec la séance 1/)).toBeVisible();
  await page.locator("#d-1").fill(new Date(new Date(d0).getTime() + 7 * 86400000).toISOString().slice(0, 10));
  // Ajout d'une séance : reprend l'horaire, une semaine plus tard.
  await page.getByRole("button", { name: "Ajouter une séance" }).click();
  await expect(page.getByRole("heading", { name: /Séances \(7\)/ })).toBeVisible();
  await page.locator("#s-6").fill("09:00");
  await page.locator("#e-6").fill("12:30");
  await page.getByLabel("Oui, il peut choisir").check();
  await page.getByRole("button", { name: "Continuer →" }).click();

  // Étape 3 : aperçu fidèle puis publication.
  await expect(page.getByText(/Tout est prêt/)).toBeVisible();
  await expect(page.getByText(`EPHEC | ${TITLE} — Séance 1/7`)).toBeVisible();
  await page.getByRole("button", { name: "Publier l'événement" }).click();
  await expect(page.getByText("Événement publié.")).toBeVisible();

  // Partage : lien, bouton HTML, aperçu.
  await page.getByRole("button", { name: "Copier le lien" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/e\/[a-z0-9]{8}$/);
  publicPath = new URL(link).pathname;
  await page.getByRole("button", { name: "Copier le bouton HTML" }).click();
  const html = await page.evaluate(() => navigator.clipboard.readText());
  expect(html).toContain('role="presentation"');
  expect(html).toContain(link);
  await page.getByRole("button", { name: "Prévisualiser le bouton" }).click();
  const frame = page.frameLocator('iframe[title="Aperçu du bouton dans un email"]');
  await expect(frame.getByRole("link", { name: /Ajouter à mon calendrier/ })).toHaveAttribute("href", link);
  editHref = new URL(page.url()).pathname.replace(/\/partager$/, "");

  await page.goto(publicPath);
  await expect(page.getByText("7 séances").first()).toBeVisible();
});

test("Modification d'une séance après publication : page à jour, SEQUENCE incrémentée, texte d'information", async ({ page, request }) => {
  await login(page);
  const before = await (await request.get(`${publicPath}/ics`)).text();
  expect(before).toContain("SEQUENCE:0");
  await page.goto(editHref);
  await page.getByRole("button", { name: /Étape 2/ }).click();
  await page.locator("#s-0").fill("19:00");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Modifications enregistrées. La page d'ajout est déjà à jour.")).toBeVisible();
  await expect(page.getByText(/déplacée : désormais le .*19 h 00/).first()).toBeVisible();
  await expect(page.getByText(/ne reçoivent pas ces changements automatiquement/)).toBeVisible();

  const after = await (await request.get(`${publicPath}/ics`)).text();
  const comp = new ICAL.Component(ICAL.parse(after));
  ICAL.TimezoneService.register(comp.getFirstSubcomponent("vtimezone")!);
  const first = new ICAL.Event(comp.getAllSubcomponents("vevent")[0]);
  expect(first.sequence).toBe(1);
  expect(first.startDate.hour).toBe(19);
  const second = new ICAL.Event(comp.getAllSubcomponents("vevent")[1]);
  expect(second.sequence).toBe(0);
  await page.goto(publicPath);
  await page.getByText("Voir le détail des 7 séances").click();
  await expect(page.getByText(/19 h 00 – 21 h 00/).first()).toBeVisible();
});

test("Dupliquer : copie en brouillon, invisible du public", async ({ page }) => {
  await login(page);
  await page.goto(editHref);
  await page.getByRole("button", { name: "Dupliquer" }).click();
  await expect(page.getByText("Copie créée en brouillon.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} (copie)`);
  const { url } = await eventUrl(page, `${TITLE} (copie)`);
  const anon = await page.context().browser()!.newPage();
  await anon.goto(url);
  await expect(anon.getByRole("heading", { name: "Cet événement n'est pas disponible" })).toBeVisible();
  await anon.close();
});

test("Annulation : page participant, fichier d'annulation et texte d'email", async ({ page, request }) => {
  await login(page);
  await page.goto(editHref);
  await page.getByRole("button", { name: "Annuler l'événement" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Message pour les participants/).fill("Report au printemps.");
  await dialog.getByRole("button", { name: "Confirmer l'annulation" }).click();
  await expect(dialog.getByText(/Objet : Annulation/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await page.goto(publicPath);
  await expect(page.getByText("Cet événement est annulé.")).toBeVisible();
  await expect(page.getByText("Report au printemps.")).toBeVisible();
  const ics = await (await request.get(`${publicPath}/ics`)).text();
  expect(ics).toContain("METHOD:CANCEL");
  expect(ics).toContain("STATUS:CANCELLED");
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(7);
});

test("Un éditeur n'accède pas aux réglages ni à la gestion des utilisateurs", async ({ page }) => {
  await login(page, "editor");
  await expect(page.getByRole("link", { name: "Réglages" })).toHaveCount(0);
  await page.goto("/admin/reglages");
  await expect(page.getByText("Cette page est réservée aux administrateurs.")).toBeVisible();
  const r = await page.request.put("/api/admin/settings", { data: { enableYahoo: true }, headers: { origin: process.env.E2E_BASE! } });
  expect(r.status()).toBe(403);
});

test("Routes d'administration protégées sans session", async ({ request }) => {
  expect((await request.get("/api/admin/stats")).status()).toBe(401);
  const r = await request.post("/api/admin/events", { data: { input: {} }, headers: { origin: process.env.E2E_BASE! } });
  expect(r.status()).toBe(401);
  const csrf = await request.post("/api/admin/events", { data: { input: {} }, headers: { origin: "https://malveillant.example" } });
  expect(csrf.status()).toBe(403);
});
