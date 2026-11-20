// Captures d'écran de l'application avec les données d'exemple (base vierge requise).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
const { chromium, devices } = pw;
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.E2E_OUT ?? "e2e/artifacts";
const b = await chromium.launch();
async function login(p) {
  await p.goto(BASE + "/login");
  await p.fill('input[name="email"]', "studio@ephec.local");
  await p.fill('input[name="password"]', "Studio-EPHEC-2026!");
  await p.click('button:has-text("Se connecter")');
  await p.waitForURL(/\/board/);
}
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await login(p);
if (await p.isVisible('button:has-text("Charger un exemple")')) {
  await p.click('button:has-text("Charger un exemple")');
  await p.waitForSelector('h2:has-text("Humains.ia")', { timeout: 30000 });
}
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/1-board-confortable.png` });
await p.click('button[title="Compact"]');
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/2-board-compact.png` });
await p.click('button[title="Confortable"]');
await p.click('[data-pub-id]:has-text("Annonce du cycle")');
await p.waitForSelector('#publication-panel img');
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/3-panel.png` });
await p.keyboard.press("Escape");
await p.goto(BASE + "/espace");
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/4-mon-espace.png` });
await p.goto(BASE + "/mediatheque");
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/5-mediatheque.png` });
await p.goto(BASE + "/parametres");
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/6-parametres.png` });
const m = await b.newContext({ ...devices["iPhone 13"] });
const mp = await m.newPage();
await login(mp);
await mp.waitForTimeout(800);
await mp.screenshot({ path: `${OUT}/7-mobile-board.png` });
await mp.locator('[data-pub-id]:has-text("Annonce du cycle")').tap();
await mp.waitForSelector('#publication-panel img');
await mp.waitForTimeout(600);
await mp.screenshot({ path: `${OUT}/8-mobile-panel.png` });
await b.close();
