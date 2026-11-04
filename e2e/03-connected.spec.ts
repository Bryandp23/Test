// Mode B (agenda connecté) testé contre le SIMULATEUR local des API Google (e2e/mock-google.mjs).
import { test, expect } from "@playwright/test";
import { eventUrl, login, mockState, MOCK } from "./helpers";

test.describe.configure({ mode: "serial" });
let cycle = "";
let cycleEdit = "";

test.beforeAll(async ({ browser }) => {
  const p = await browser.newPage();
  await login(p);
  const r = await eventUrl(p, /Cycle IA/);
  cycle = r.url;
  cycleEdit = r.editHref;
  await p.close();
});

test("Refus d'autorisation : message clair, ajout simple toujours disponible", async ({ page }) => {
  await page.goto(cycle);
  await page.getByRole("link", { name: "Connecter Google Agenda" }).click();
  await page.locator("#deny").click();
  await expect(page.getByText("Vous n'avez pas autorisé l'accès à votre agenda.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Google Agenda/ }).or(page.getByRole("button", { name: /^Google Agenda/ }))).toBeVisible();
  expect((await mockState()).events).toHaveLength(0);
});

test("Connexion puis ajout confirmé par l'API, sans doublon aux clics répétés", async ({ page, context }) => {
  await page.goto(cycle);
  await page.getByLabel("Choisir mes séances").check();
  await page.getByRole("button", { name: "Tout décocher" }).click();
  await page.getByRole("checkbox", { name: /14 janv\./ }).check();
  await page.getByRole("checkbox", { name: /21 janv\./ }).check();
  await page.getByRole("link", { name: "Connecter Google Agenda" }).click();
  await expect(page).toHaveURL(new RegExp(`^${MOCK}/auth`));
  await page.locator("#allow").click();
  await expect(page.getByText("2 séances ajoutées à votre Google Agenda")).toBeVisible();
  await expect(page.getByText(/Ajout confirmé par votre agenda/)).toBeVisible();
  let st = await mockState();
  expect(st.events).toHaveLength(2);
  expect(st.events[0].summary).toMatch(/^EPHEC \| Cycle IA & Humain — Séance 1\/9/);
  expect(st.events[0].start.dateTime).toBe("2027-01-14T18:30:00");

  // Cookie de navigateur : httpOnly, aucune donnée personnelle.
  const cookie = (await context.cookies()).find((c) => c.name === "ec_browser")!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.value).not.toContain("@");

  // Toutes les séances, avec double clic rapide : 9 au total, jamais 11.
  await page.reload();
  const btn = page.getByRole("button", { name: /Ajouter directement les 9 séances à Google Agenda/ });
  await btn.dblclick();
  await expect(page.getByText(/9 séances ajoutées à votre Google Agenda|déjà présente/).first()).toBeVisible();
  st = await mockState();
  expect(st.events).toHaveLength(9);
  await page.getByRole("button", { name: /Déjà dans votre Google Agenda/ }).click();
  await expect(page.getByText("Ces 9 séances sont déjà dans votre Google Agenda.")).toBeVisible();
  expect((await mockState()).events).toHaveLength(9);
});

test("Modification par l'EPHEC : propagée aux agendas connectés ; événement supprimé par le participant respecté", async ({ page }) => {
  const st = await mockState();
  const deletedId = st.events.find((e) => e.start.dateTime.startsWith("2027-01-28"))!.id;
  await fetch(`${MOCK}/__delete/${deletedId}`);
  await login(page);
  await page.goto(cycleEdit);
  await page.getByRole("button", { name: /Étape 2/ }).click();
  // Toutes les séances passent à 18:00
  for (let i = 0; i < 9; i++) await page.locator(`#s-${i}`).fill("18:00");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText(/Calendriers connectés : 8 mis à jour automatiquement, 1 déjà supprimé\(s\) par le participant/)).toBeVisible();
  const after = await mockState();
  expect(after.events).toHaveLength(8);
  expect(after.events.every((e) => e.start.dateTime.endsWith("T18:00:00"))).toBe(true);
});

test("Annulation : l'agenda connecté affiche « ANNULÉ » et l'heure est libérée", async ({ page }) => {
  await login(page);
  await page.goto(cycleEdit);
  await page.getByRole("button", { name: "Annuler l'événement" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer l'annulation" }).click();
  await expect(page.getByRole("dialog").getByText(/Calendriers connectés : 8 mis à jour/)).toBeVisible();
  const st = await mockState();
  expect(st.events.every((e) => e.summary.startsWith("ANNULÉ — EPHEC |"))).toBe(true);
  expect(st.events.every((e) => e.transparency === "transparent")).toBe(true);
  // Rétablir pour la suite
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
  await page.getByRole("button", { name: "Rétablir l'événement" }).click();
  await expect(page.getByText("Publié").first()).toBeVisible();
});

test("Gestion des calendriers connectés : ajout automatique avec consentement explicite, puis déconnexion", async ({ page }) => {
  // Nouveau navigateur : on reconnecte l'agenda (les séances existent déjà chez Google → aucun doublon).
  await page.goto(cycle);
  await page.getByRole("link", { name: "Connecter Google Agenda" }).click();
  await page.locator("#allow").click();
  await expect(page.getByText(/9 séances ajoutées à votre Google Agenda/)).toBeVisible();
  expect((await mockState()).events).toHaveLength(9);
  await page.goto("/mes-calendriers");
  await expect(page.getByText(/participant\.test@example\.com/).first()).toBeVisible();
  const activate = page.getByRole("button", { name: "Activer l'ajout automatique" });
  await expect(activate).toBeDisabled();
  await page.getByLabel(/J'accepte que l'EPHEC ajoute automatiquement/).check();
  await activate.click();
  await expect(page.getByText("Ajout automatique activé.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Déconnecter ce calendrier" }).click();
  await expect(page.getByText(/est déconnecté et l'autorisation a été retirée chez Google/)).toBeVisible();
  expect((await mockState()).revoked).toBe(1);
  await page.goto(cycle);
  await expect(page.getByRole("link", { name: "Connecter Google Agenda" })).toBeVisible();
});
