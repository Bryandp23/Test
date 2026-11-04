import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eventUrl, login } from "./helpers";

let webinar = "";
test.beforeAll(async ({ browser }) => {
  const p = await browser.newPage();
  await login(p);
  webinar = (await eventUrl(p, /Webinaire gratuit/)).url;
  await p.close();
});

async function axe(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

test("Page participant : aucune violation WCAG 2.2 AA détectée automatiquement (bureau et mobile)", async ({ page, browser }) => {
  await page.goto(webinar);
  await page.getByRole("button", { name: /Outlook/ }).click();
  expect(await axe(page)).toEqual([]);
  const m = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(webinar);
  expect(await axe(mp)).toEqual([]);
  await m.close();
});

test("Back-office : tableau de bord, assistant et partage sans violation détectée", async ({ page }) => {
  await login(page);
  expect(await axe(page)).toEqual([]);
  await page.goto("/admin/evenements/nouveau?modele=cycle");
  expect(await axe(page)).toEqual([]);
  const { editHref } = await eventUrl(page, /Webinaire gratuit/);
  await page.goto(`${editHref}/partager`);
  expect(await axe(page)).toEqual([]);
});

test("Navigation au clavier : lien d'évitement, tuiles, sous-choix Outlook", async ({ page }) => {
  await page.goto(webinar);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller directement au choix du calendrier" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  // Tabulations jusqu'à la tuile Outlook
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (await page.getByRole("button", { name: /^Outlook/ }).evaluate((el) => el === document.activeElement)) break;
  }
  const outlook = page.getByRole("button", { name: /^Outlook/ });
  await expect(outlook).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(outlook).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Compte personnel/ })).toBeFocused();
});

test("Statistiques : ouverture et clic comptés, robots ignorés, clic ≠ ajout confirmé, export CSV", async ({ page, request, context }) => {
  await context.route("https://calendar.google.com/**", (r) => r.fulfill({ status: 200, body: "ok" }));
  await login(page);
  await page.goto("/admin/statistiques");
  const views0 = Number(await page.locator("dt:has-text('Ouvertures') + dd").textContent());

  // Un robot de prévisualisation (agent connu) n'est pas compté.
  await request.post("/api/track", { data: { slug: webinar.split("/").pop(), kind: "view", device: "desktop" }, headers: { "user-agent": "Mozilla/5.0 (compatible; Microsoft Office SafeLinks)" } });
  // Un vrai navigateur : ouverture + clic.
  const p = await context.newPage();
  await p.goto(webinar);
  await p.waitForTimeout(500);
  const [popup] = await Promise.all([context.waitForEvent("page"), p.getByRole("link", { name: /^Google Agenda/ }).click()]);
  await popup.close();
  await p.waitForTimeout(500);

  await page.reload();
  const views1 = Number(await page.locator("dt:has-text('Ouvertures') + dd").textContent());
  expect(views1 - views0).toBe(1);
  await expect(page.getByText(/Un clic ne prouve pas l'enregistrement/)).toBeVisible();
  const csv = await page.request.get("/api/admin/stats");
  const text = await csv.text();
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(text).toContain("clic_calendrier (non confirmé)");
  expect(text).toContain("ajout_confirmé_par_api");
  expect(text).not.toMatch(/@|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/); // ni email ni adresse IP
});
