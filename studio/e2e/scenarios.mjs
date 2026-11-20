// Scénarios de recette A → H, exécutés dans Chromium contre un serveur en marche.
// Usage : BASE_URL=http://localhost:3100 node e2e/scenarios.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
// Playwright : dépendance du projet si installée, sinon installation globale de la machine.
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(execSync("npm root -g").toString().trim() + "/playwright");
}
const { chromium, devices } = pw;
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const EMAIL = process.env.STUDIO_LOCAL_EMAIL ?? "studio@ephec.local";
const PASSWORD = process.env.STUDIO_LOCAL_PASSWORD ?? "Studio-EPHEC-2026!";
const OUT = process.env.E2E_OUT ?? "e2e/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function ok(name, cond, detail = "") {
  results.push({ name, pass: Boolean(cond), detail });
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

async function login(page) {
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button:has-text("Se connecter")');
  await page.waitForURL(/\/board/);
}

/** Dépose des images générées (canvas) sur un élément, comme un glisser-déposer depuis le bureau. */
async function dropImages(page, selector, count, prefix) {
  await page.evaluate(
    async ({ selector, count, prefix }) => {
      const colors = ["#46c4bc", "#6e9bf5", "#f07f6e", "#a68bf0", "#e3c454", "#63c17f"];
      const dt = new DataTransfer();
      for (let i = 0; i < count; i++) {
        const c = document.createElement("canvas");
        c.width = 1200;
        c.height = 1200;
        const g = c.getContext("2d");
        g.fillStyle = "#14161b";
        g.fillRect(0, 0, 1200, 1200);
        g.fillStyle = colors[i % colors.length];
        g.fillRect(120, 120, 960, 520);
        g.fillStyle = "#f5f5f6";
        g.font = "bold 120px sans-serif";
        g.fillText(`${prefix} ${i + 1}/${count}`, 120, 900);
        const blob = await new Promise((r) => c.toBlob(r, "image/png"));
        dt.items.add(new File([blob], `${prefix.toLowerCase()}-${i + 1}.png`, { type: "image/png" }));
      }
      const el = document.querySelector(selector);
      el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
      el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { selector, count, prefix },
  );
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await login(page);

  // --- A. Création d'un cycle avec sessions
  await page.click('button:has-text("Créer")');
  await page.click('[role=menuitem]:has-text("Cycle avec sessions")');
  await page.fill('#cycle-form input[placeholder="Humains.ia"]', "Humains.ia");
  const dates = await page.$$('#cycle-form input[type="date"]');
  await dates[0].fill("2027-01-10");
  await dates[1].fill("2027-03-30");
  await page.click('#cycle-form button:has-text("Ajouter une session")');
  await page.click('#cycle-form button:has-text("Ajouter une session")');
  const titles = page.locator('#cycle-form input[aria-label="Titre de la session"]');
  const sdates = page.locator('#cycle-form input[aria-label="Date de la session"]');
  await sdates.nth(0).fill("2026-12-03");
  await sdates.nth(1).fill("2027-01-14");
  await sdates.nth(2).fill("2027-01-28");
  await titles.nth(3).fill("Session 3");
  await page.click('button:has-text("Créer le cycle")');
  await page.waitForSelector('h2:has-text("Humains.ia")');
  const rowLabels = await page.locator('[data-row] .truncate[title]').allTextContents();
  ok("A · cycle visible immédiatement dans le board", await page.isVisible('h2:has-text("Humains.ia")'));
  ok("A · sessions en sous-lignes, ordre chronologique", rowLabels.join(" | ").includes("Contenus généraux du cycle | Séance d'information | Session 1 | Session 2 | Session 3"), rowLabels.join(" | "));
  await page.screenshot({ path: `${OUT}/A-board.png` });

  // --- B. Importation : 5 images déposées sur la sous-ligne Session 1
  const s1 = await page.locator('[data-row]', { has: page.locator('[title="Session 1"]') }).getAttribute("data-row");
  await dropImages(page, `[data-row="${s1}"]`, 5, "Slide");
  await page.waitForSelector('text=Créer à partir de 5 fichiers');
  ok("B · le dépôt propose une publication liée à la bonne session", await page.isVisible('text=Humains.ia › Session 1'));
  await page.fill('#drop-form input[placeholder^="Carrousel"]', "Carrousel LinkedIn — Session 1");
  await page.selectOption('#drop-form select', { label: "LinkedIn" });
  await page.click('button:has-text("Créer la publication")');
  await page.waitForSelector("#publication-panel");
  await page.waitForFunction(() => document.querySelectorAll('#publication-panel button[aria-label^="Afficher "]').length === 5, null, { timeout: 30000 });
  ok("B · 5 fichiers dans une seule publication", true);
  const cardBadge = await page.locator(`[data-row="${s1}"] [data-pub-id]`).first().innerText();
  ok("B · carte avec aperçu et indicateur +4", cardBadge.includes("+4"), cardBadge.replace(/\n/g, " / "));
  // Réordonner : le 5e fichier passe en premier (clavier, alternative accessible)
  const thumbs = page.locator('#publication-panel button[aria-label^="Afficher "]');
  const lastName = await thumbs.nth(4).getAttribute("aria-label");
  await thumbs.nth(4).click();
  for (let i = 0; i < 4; i++) await page.click('#publication-panel button[aria-label="Déplacer ce fichier vers la gauche"]');
  await page.waitForTimeout(800);
  ok("B · ordre des fichiers modifiable", (await thumbs.nth(0).getAttribute("aria-label")) === lastName, `${lastName}`);
  const body = page.locator('#publication-panel textarea[aria-label="Texte de publication"]');
  await body.fill("Session 1 — L'IA au travail.\n\nInscriptions ouvertes : lien en commentaire. #FormationContinue");
  await page.locator("#panel-title").click();
  await page.waitForSelector("text=Enregistré");
  ok("B · texte LinkedIn enregistré", true);
  await page.screenshot({ path: `${OUT}/B-panel.png` });

  // --- C. Programmation manuelle
  const target = page.locator('#publication-panel input[type="date"]').first();
  await page.locator('#publication-panel h3:has-text("Planification")').scrollIntoViewIfNeeded();
  await page.locator('#publication-panel label:has-text("Date cible de diffusion") input').fill("2027-01-07");
  await page.waitForTimeout(800);
  let stageText = await page.locator(`[data-row="${s1}"] [data-pub-id]`).first().innerText();
  ok("C · date cible seule : pas « Programmé »", !stageText.includes("Programmé"), stageText.replace(/\n/g, " / "));
  await page.click('#publication-panel button:has-text("Prêt")');
  await page.click('#publication-panel button:has-text("Confirmer la programmation")');
  await page.locator('#publication-panel label:has-text("Heure (Bruxelles)") input').fill("09:30");
  await page.fill('#publication-panel input[placeholder^="LinkedIn natif"]', "LinkedIn natif");
  await page.click("#publication-panel button:has-text(\"Confirmer : c'est programmé\")");
  await page.waitForSelector('#publication-panel :text("le 7 janv. 2027 à 09h30")');
  stageText = await page.locator(`[data-row="${s1}"] [data-pub-id]`).first().innerText();
  ok("C · statut Programmé après confirmation explicite", stageText.includes("Programmé"), stageText.replace(/\n/g, " / "));
  void target;

  // Une deuxième publication dans Session 1 (pour D) et une publication Instagram « Formation Continue » (pour G)
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#publication-panel", { state: "detached" });
  await page.hover(`[data-row="${s1}"]`);
  await page.click(`[data-row="${s1}"] button:has-text("Ajouter")`);
  await page.fill(`[data-row="${s1}"] textarea[aria-label="Titre de la nouvelle publication"]`, "Story Instagram rappel");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#publication-panel");
  await page.locator('#publication-panel label:has-text("Canal") select').selectOption({ label: "Instagram" });
  await page.waitForSelector("text=Enregistré");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#publication-panel", { state: "detached" });

  // --- D. Déplacement Session 1 → Session 2 (glisser-déposer à la souris)
  const s2 = await page.locator('[data-row]', { has: page.locator('[title="Session 2"]') }).getAttribute("data-row");
  const card = page.locator(`[data-row="${s1}"] [data-pub-id]`, { hasText: "Story Instagram rappel" });
  const cb = await card.boundingBox();
  const target2 = await page.locator(`[data-row="${s2}"] > div:last-child`).boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + 40);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + 10, cb.y + 50, { steps: 4 });
  await page.mouse.move(target2.x + 60, target2.y + target2.height / 2, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForSelector("text=Déplacé vers Humains.ia › Session 2");
  ok("D · publication déplacée vers Session 2", await page.locator(`[data-row="${s2}"] [data-pub-id]`, { hasText: "Story Instagram rappel" }).count() === 1);
  await page.screenshot({ path: `${OUT}/D-moved.png` });

  // --- F. Persistance : nouveau navigateur (autre appareil), reconnexion
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage();
  await login(p2);
  await p2.waitForSelector('h2:has-text("Humains.ia")');
  const inS2 = await p2.locator(`[data-row="${s2}"] [data-pub-id]`, { hasText: "Story Instagram rappel" }).count();
  ok("F · cycle, sessions et déplacement retrouvés", inS2 === 1);
  await p2.click(`[data-row="${s1}"] [data-pub-id]`);
  await p2.waitForFunction(() => document.querySelectorAll('#publication-panel button[aria-label^="Afficher "]').length === 5, null, { timeout: 15000 });
  const imgOk = await p2.evaluate(async () => {
    const img = document.querySelector("#publication-panel img");
    if (!img) return false;
    await img.decode().catch(() => {});
    return img.naturalWidth > 0;
  });
  ok("F · fichiers réellement hébergés et affichés", imgOk);
  const txt = await p2.locator('#publication-panel textarea[aria-label="Texte de publication"]').inputValue();
  ok("F · texte retrouvé", txt.includes("L'IA au travail"));
  ok("F · statut Programmé retrouvé", await p2.isVisible('#publication-panel :text("le 7 janv. 2027 à 09h30")'));
  await ctx2.close();

  // --- G. Recherche : Instagram + Formation Continue + Programmé
  // On programme la story pour avoir un résultat attendu, et on définit le public du cycle.
  await page.click('h2:has-text("Humains.ia") >> xpath=ancestor::section//button[starts-with(@aria-label,"Actions pour Humains.ia")]');
  await page.click('[role=menuitem]:has-text("Modifier le cycle")');
  await page.locator('#cycle-form label:has-text("Public") select').selectOption({ label: "Formation Continue" });
  await page.click('button:has-text("Enregistrer")');
  await page.waitForSelector("#cycle-form", { state: "detached" });
  await page.click(`[data-pub-id]:has-text("Story Instagram rappel")`);
  await page.click('#publication-panel button:has-text("Confirmer la programmation")');
  await page.locator('#publication-panel label:has-text("Date programmée") input').fill("2027-01-20");
  await page.click("#publication-panel button:has-text(\"Confirmer : c'est programmé\")");
  await page.waitForSelector('#publication-panel :text("le 20 janv. 2027")');
  await page.keyboard.press("Escape");
  await page.click('button:has-text("Filtres")');
  const pop = page.locator("[data-radix-popper-content-wrapper]");
  await pop.locator('button:has-text("Instagram")').click();
  await pop.locator('button:has-text("Formation Continue")').click();
  await pop.locator('button:has-text("Programmé")').click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const found = await page.locator("[data-pub-id]").allTextContents();
  ok("G · recherche combinée exacte", found.length === 1 && found[0].includes("Story Instagram rappel"), `${found.length} résultat(s)`);
  await page.screenshot({ path: `${OUT}/G-filters.png` });
  await page.click('button:has-text("Tout effacer")');

  // --- H. Responsive : smartphone
  const m = await browser.newContext({ ...devices["iPhone 13"] });
  const mp = await m.newPage();
  await login(mp);
  await mp.waitForSelector('h2:has-text("Humains.ia")');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("H · pas de défilement horizontal de la page", !overflow);
  await mp.locator(`[data-row="${s1}"] [data-pub-id]`).first().tap();
  await mp.waitForSelector("#publication-panel");
  const box = await mp.locator("#publication-panel").boundingBox();
  ok("H · panneau plein écran", box && box.width >= 380, `${box?.width}px`);
  ok("H · texte consultable", (await mp.locator('#publication-panel textarea[aria-label="Texte de publication"]').inputValue()).length > 10);
  await mp.screenshot({ path: `${OUT}/H-mobile-panel.png` });
  await mp.click('button[aria-label="Fermer le panneau (Échap)"]');
  await mp.screenshot({ path: `${OUT}/H-mobile-board.png` });
  await m.close();

  ok("Aucune erreur JavaScript", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  console.error(e);
  for (const c of browser.contexts()) for (const pg of c.pages()) await pg.screenshot({ path: `${OUT}/failure-${Date.now()}.png` }).catch(() => {});
  results.push({ name: "Exécution complète", pass: false, detail: String(e).slice(0, 200) });
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
process.exit(failed.length ? 1 : 0);
