import { test, expect, devices } from "@playwright/test";
import fs from "node:fs";
import ICAL from "ical.js";
import { eventUrl, expectNoFalseSuccess, login } from "./helpers";

let webinar = "";
let cycle = "";
let sports = "";

test.beforeAll(async ({ browser }) => {
  const p = await browser.newPage();
  await login(p);
  webinar = (await eventUrl(p, /Webinaire gratuit/)).url;
  cycle = (await eventUrl(p, /Cycle IA/)).url;
  sports = (await eventUrl(p, /Sports Business/)).url;
  await p.close();
});

function parseIcs(text: string) {
  const comp = new ICAL.Component(ICAL.parse(text));
  const tz = comp.getFirstSubcomponent("vtimezone");
  if (tz) ICAL.TimezoneService.register(tz);
  return comp.getAllSubcomponents("vevent").map((v) => new ICAL.Event(v));
}

test("Google Agenda sur ordinateur : fiche préremplie, horaires exacts, message honnête", async ({ page, context }) => {
  await context.route("https://calendar.google.com/**", (r) => r.fulfill({ status: 200, body: "<title>Google Agenda (simulé)</title>" }));
  await page.goto(webinar);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Découvrir les applications de l'IA/);
  await expect(page.getByText("Jeudi 19 novembre 2026")).toBeVisible();
  await expect(page.getByText("12 h 00 – 13 h 00")).toBeVisible();
  await expect(page.getByText(/Démonstration/).first()).toBeVisible();

  const tile = page.getByRole("link", { name: /^Google Agenda/ });
  const href = new URL((await tile.getAttribute("href"))!);
  expect(href.hostname).toBe("calendar.google.com");
  expect(href.searchParams.get("dates")).toBe("20261119T110000Z/20261119T120000Z");
  expect(href.searchParams.get("text")).toBe("EPHEC | Webinaire gratuit — Découvrir les applications de l'IA");
  expect(href.searchParams.get("location")).toContain("teams.microsoft.com");

  const [popup] = await Promise.all([context.waitForEvent("page"), tile.click()]);
  expect(popup.url()).toContain("calendar.google.com/calendar/render");
  await expect(page.getByText("Votre calendrier est prêt, il ne reste plus qu'à enregistrer l'événement.")).toBeVisible();
  await expectNoFalseSuccess(page);
});

test("Outlook : choix compte personnel / professionnel avec les bons domaines", async ({ page }) => {
  await page.goto(webinar);
  await page.getByRole("button", { name: /Outlook/ }).click();
  const perso = page.getByRole("link", { name: /Compte personnel/ });
  const pro = page.getByRole("link", { name: /Compte professionnel/ });
  expect(new URL((await perso.getAttribute("href"))!).hostname).toBe("outlook.live.com");
  const proUrl = new URL((await pro.getAttribute("href"))!);
  expect(proUrl.hostname).toBe("outlook.office.com");
  expect(proUrl.searchParams.get("startdt")).toBe("2026-11-19T11:00:00Z");
  await expect(page.getByRole("link", { name: /Application Outlook sur ordinateur/ })).toBeVisible();
});

test("Export ICS : fichier conforme relu par un parseur indépendant", async ({ page }) => {
  await page.goto(webinar);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Autre calendrier/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^ephec-.*\.ics$/);
  const text = fs.readFileSync((await dl.path())!, "utf8");
  const [ev] = parseIcs(text);
  expect(ev.summary).toBe("EPHEC | Webinaire gratuit — Découvrir les applications de l'IA");
  expect(ev.startDate.toJSDate().toISOString()).toBe("2026-11-19T11:00:00.000Z");
  expect(ev.endDate.toJSDate().toISOString()).toBe("2026-11-19T12:00:00.000Z");
  expect(ev.description).toContain("LIEN-FICTIF");
  expect(text).toContain("BEGIN:VALARM");
  await expect(page.getByText("Votre fichier calendrier est prêt.")).toBeVisible();
  await expectNoFalseSuccess(page);
});

test("Cycle de 9 séances : toutes ou une sélection, entrées distinctes, heure d'été respectée", async ({ page, request }) => {
  await page.goto(cycle);
  await expect(page.getByText("9 séances").first()).toBeVisible();
  // Toutes les séances : un seul fichier, 9 événements distincts (jamais un bloc continu).
  const all = await request.get(`${cycle}/ics`);
  const evs = parseIcs(await all.text());
  expect(evs).toHaveLength(9);
  for (const e of evs) expect(e.endDate.toJSDate().getTime() - e.startDate.toJSDate().getTime()).toBe(2 * 3600_000);
  // 11 mars 2027 (heure d'hiver) puis 1er avril 2027 (heure d'été) : 18 h 30 locales dans les deux cas.
  expect(evs[7].startDate.toJSDate().toISOString()).toBe("2027-03-11T17:30:00.000Z");
  expect(evs[8].startDate.toJSDate().toISOString()).toBe("2027-04-01T16:30:00.000Z");
  expect(new Set(evs.map((e) => e.uid)).size).toBe(9);

  await page.getByLabel("Choisir mes séances").check();
  await page.getByRole("button", { name: "Tout décocher" }).click();
  await expect(page.getByText("Cochez au moins une séance pour continuer.")).toBeVisible();
  const boxes = page.getByRole("checkbox", { name: /janv\./ });
  await boxes.nth(0).check();
  await boxes.nth(2).check();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Autre calendrier/ }).click()]);
  const chosen = parseIcs(fs.readFileSync((await dl.path())!, "utf8"));
  expect(chosen.map((e) => e.startDate.toJSDate().toISOString())).toEqual(["2027-01-14T17:30:00.000Z", "2027-01-28T17:30:00.000Z"]);

  // Google : une fiche par séance, présentée pas à pas.
  await page.getByRole("button", { name: /Google Agenda/ }).click();
  await expect(page.getByRole("heading", { name: /Google Agenda : 2 séances à enregistrer/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ouvrir dans un nouvel onglet/ })).toHaveCount(2);
});

test("Formation à séances obligatoires : pas de choix proposé, lieu particulier d'une séance", async ({ page, request }) => {
  await page.goto(sports);
  await expect(page.getByText(/Les 6 séances seront ajoutées/)).toBeVisible();
  await expect(page.getByLabel("Choisir mes séances")).toHaveCount(0);
  const evs = parseIcs(await (await request.get(`${sports}/ics`)).text());
  expect(evs).toHaveLength(6);
  const lln = evs.find((e) => e.location.includes("Louvain-la-Neuve"));
  expect(lln?.startDate.toJSDate().toISOString()).toBe("2027-03-06T08:00:00.000Z");
});

test("iPhone : Apple suggéré sans masquer les autres, fichier ouvert sans téléchargement forcé", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-BE", timezoneId: "Europe/Brussels" });
  const page = await ctx.newPage();
  await page.goto(webinar);
  const tiles = page.getByRole("list", { name: "Calendriers disponibles" }).getByRole("listitem");
  await expect(tiles).toHaveCount(4);
  await expect(tiles.first()).toContainText("Apple Calendrier");
  await expect(tiles.first()).toContainText("Suggéré pour cet appareil");
  await expect(page.getByRole("link", { name: /Apple Calendrier/ })).not.toHaveAttribute("download", /.*/);
  for (const t of await tiles.all()) {
    const box = (await t.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(56); // grandes zones tactiles
  }
  await ctx.close();
});

test("Android dans l'application Gmail (webview) : avertissement et secours", async ({ browser }) => {
  const ctx = await browser.newContext({
    ...devices["Pixel 7"],
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.0.0 Mobile Safari/537.36",
  });
  const page = await ctx.newPage();
  await page.goto(webinar);
  await expect(page.getByText(/Vous consultez cette page dans l'application/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copier le lien de cette page" })).toBeVisible();
  const first = page.getByRole("list", { name: "Calendriers disponibles" }).getByRole("listitem").first();
  await expect(first).toContainText("Google Agenda");
  await ctx.close();
});

test("Participant dans un autre fuseau horaire : l'heure belge reste juste", async ({ browser }) => {
  const ctx = await browser.newContext({ timezoneId: "America/New_York", locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(webinar);
  await expect(page.getByText("12 h 00 – 13 h 00")).toBeVisible();
  const href = new URL((await page.getByRole("link", { name: /^Google Agenda/ }).getAttribute("href"))!);
  expect(href.searchParams.get("dates")).toBe("20261119T110000Z/20261119T120000Z");
  await ctx.close();
});

test("Lien passé par une redirection de suivi d'emailing (type ActiveCampaign)", async ({ page }) => {
  const target = `${process.env.E2E_BASE}${webinar}?utm_source=ActiveCampaign&utm_medium=email`;
  await page.goto(`${process.env.E2E_MOCK}/ac-redirect?u=${encodeURIComponent(target)}`);
  await expect(page).toHaveURL(new RegExp(`${webinar}\\?utm_source`));
  await expect(page.getByRole("heading", { name: "Ajouter à mon calendrier" })).toBeVisible();
});

test("Incitation douce : apparaît une seule fois, ne bloque rien, se ferme au clavier", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(sports);
  await page.getByText("Voir le détail des 6 séances").click();
  await page.mouse.wheel(0, 4000);
  const dialog = page.getByRole("dialog", { name: /Et si vous bloquiez déjà cette date/ });
  await expect(dialog).toBeVisible({ timeout: 12_000 });
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(7000);
  await expect(dialog).toBeHidden();
  await ctx.close();
});

test("Préférence mémorisée uniquement avec accord, et modifiable", async ({ page, context }) => {
  await context.route("https://outlook.office.com/**", (r) => r.fulfill({ status: 200, body: "ok" }));
  await page.goto(webinar);
  await page.getByLabel(/Retenir mon choix/).check();
  await page.getByRole("button", { name: /Outlook/ }).click();
  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: /Compte professionnel/ }).click()]);
  await popup.close();
  await page.reload();
  const first = page.getByRole("list", { name: "Calendriers disponibles" }).getByRole("listitem").first();
  await expect(first).toContainText("Outlook");
  await expect(first).toContainText("Votre choix habituel");
  await page.getByRole("button", { name: "oublier" }).click();
  await page.reload();
  await expect(page.getByText("Votre choix habituel")).toHaveCount(0);
});

test("Lien inconnu : message clair, pas d'erreur technique", async ({ page }) => {
  await page.goto("/e/inconnu99");
  await expect(page.getByRole("heading", { name: "Cet événement n'est pas disponible" })).toBeVisible();
});
