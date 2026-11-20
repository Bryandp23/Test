// Vidéo de démonstration (parcours complet) avec curseur visible. Base avec données d'exemple requise.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
const { chromium, devices } = pw;
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.E2E_OUT ?? "e2e/artifacts";
const CURSOR = `(() => { const c = document.createElement('div'); c.id='demo-cursor';
  c.style.cssText='position:fixed;z-index:99999;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.85);border:2px solid #0d0f13;box-shadow:0 0 0 3px rgba(70,196,188,.45);pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px;transition:width .1s,height .1s';
  const add=()=>document.body&&!document.getElementById('demo-cursor')&&document.body.appendChild(c);
  document.addEventListener('mousemove',e=>{add();c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'},true);
  document.addEventListener('mousedown',()=>{c.style.width='13px';c.style.height='13px'},true);
  document.addEventListener('mouseup',()=>{c.style.width='18px';c.style.height='18px'},true);
  document.addEventListener('DOMContentLoaded',add); })();`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function moveTo(p, loc, dx = 0.5, dy = 0.5) {
  const b = await loc.boundingBox();
  await p.mouse.move(b.x + b.width * dx, b.y + b.height * dy, { steps: 18 });
  await wait(250);
}
async function click(p, loc) { await moveTo(p, loc); await loc.click(); await wait(500); }
async function type(loc, text) { await loc.pressSequentially(text, { delay: 45 }); }

async function login(p) {
  await p.goto(BASE + "/login");
  await wait(600);
  await type(p.locator('input[name="email"]'), "studio@ephec.local");
  await p.fill('input[name="password"]', "Studio-EPHEC-2026!");
  await click(p, p.locator('button:has-text("Se connecter")'));
  await p.waitForURL(/\/board/);
  await wait(1500);
}

async function dropImages(p, selector, count) {
  await p.evaluate(async ({ selector, count }) => {
    const pal = [["#0f3b3a", "#46c4bc"], ["#1d2433", "#6e9bf5"], ["#f2efe8", "#f07f6e"], ["#241d33", "#a68bf0"]];
    const dt = new DataTransfer();
    for (let i = 0; i < count; i++) {
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1080;
      const g = c.getContext("2d"); const [bg, ac] = pal[i % pal.length];
      g.fillStyle = bg; g.fillRect(0, 0, 1080, 1080); g.fillStyle = ac; g.beginPath(); g.arc(820, 260, 170, 0, 7); g.fill();
      g.fillStyle = i === 2 ? "#14161b" : "#f5f5f6"; g.font = "600 30px sans-serif"; g.fillText("WEBINAIRE DATA", 80, 140);
      g.font = "bold 86px sans-serif"; g.fillText(`Slide ${i + 1}/${count}`, 80, 600); g.font = "28px sans-serif"; g.fillText("EPHEC · Formation Continue", 80, 1000);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      dt.items.add(new File([blob], `slide-${i + 1}.png`, { type: "image/png" }));
    }
    const el = document.querySelector(selector);
    el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 900));
    el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { selector, count });
}

const b = await chromium.launch();
if (!process.env.MOBILE_ONLY) {
// --- Ordinateur
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT + "/video-desktop", size: { width: 1440, height: 900 } } });
await ctx.addInitScript(CURSOR);
const p = await ctx.newPage();
await login(p);

// Parcourir une publication existante
await moveTo(p, p.locator('[data-pub-id]:has-text("Campagne Ads")').first());
await wait(600);
await click(p, p.locator('[data-pub-id]:has-text("Annonce du cycle")'));
await p.waitForSelector("#publication-panel img");
await wait(1200);
for (let i = 0; i < 3; i++) await click(p, p.locator('button[aria-label="Fichier suivant"]'));
await wait(600);
await p.locator("#publication-panel .overflow-y-auto").first().evaluate((e) => e.scrollBy({ top: 700, behavior: "smooth" }));
await wait(1800);
await p.locator("#publication-panel .overflow-y-auto").first().evaluate((e) => e.scrollBy({ top: 900, behavior: "smooth" }));
await wait(1800);
await click(p, p.locator('button[aria-label="Fermer le panneau (Échap)"]'));

// Densité
await click(p, p.locator('button[title="Compact"]'));
await wait(1200);
await click(p, p.locator('button[title="Confortable"]'));

// Créer un cycle avec sessions
await click(p, p.locator('button:has-text("Créer")'));
await click(p, p.locator('[role=menuitem]:has-text("Cycle avec sessions")'));
await type(p.locator('#cycle-form input[placeholder="Humains.ia"]'), "Webinaires Data");
await p.locator('#cycle-form label:has-text("Public") select').selectOption({ label: "Formation Continue" });
const d = p.locator('#cycle-form input[type="date"]');
await d.nth(0).fill("2027-01-11"); await d.nth(1).fill("2027-03-15");
const sd = p.locator('#cycle-form input[aria-label="Date de la session"]');
await sd.nth(0).fill("2026-12-10"); await sd.nth(1).fill("2027-01-18");
await click(p, p.locator('#cycle-form button:has-text("Ajouter une session")'));
await sd.nth(2).fill("2027-02-08");
await wait(800);
await click(p, p.locator('button:has-text("Créer le cycle")'));
await p.waitForSelector('h2:has-text("Webinaires Data")');
await wait(1200);

// Déposer 4 visuels sur la Session 1
const sec = p.locator("section", { has: p.locator('h2:has-text("Webinaires Data")') });
const s1 = await sec.locator("[data-row]", { has: p.locator('[title="Session 1"]') }).getAttribute("data-row");
const s2 = await sec.locator("[data-row]", { has: p.locator('[title="Session 2"]') }).getAttribute("data-row");
await moveTo(p, p.locator(`[data-row="${s1}"]`), 0.4, 0.5);
await dropImages(p, `[data-row="${s1}"]`, 4);
await p.waitForSelector("#drop-form");
await wait(900);
await type(p.locator('#drop-form input[placeholder^="Carrousel"]'), "Carrousel LinkedIn — Session 1");
await p.locator("#drop-form select").selectOption({ label: "LinkedIn" });
await wait(500);
await click(p, p.locator('button:has-text("Créer la publication")'));
await p.waitForFunction(() => document.querySelectorAll('#publication-panel button[aria-label^="Afficher "]').length === 4, null, { timeout: 30000 });
await wait(1500);
const body = p.locator('#publication-panel textarea[aria-label="Texte de publication"]');
await body.scrollIntoViewIfNeeded();
await click(p, body);
await type(body, "Les données ne parlent pas d'elles-mêmes. Session 1 du cycle Webinaires Data : lire un tableau de bord sans se tromper.");
await wait(1200);
await click(p, p.locator('#publication-panel button:has-text("Prêt")'));
await click(p, p.locator('#publication-panel button:has-text("Confirmer la programmation")'));
await p.locator('#publication-panel label:has-text("Date programmée") input').fill("2027-01-11");
await p.locator('#publication-panel label:has-text("Heure (Bruxelles)") input').fill("08:30");
await type(p.locator('#publication-panel input[placeholder^="LinkedIn natif"]'), "LinkedIn natif");
await wait(600);
await click(p, p.locator("#publication-panel button:has-text(\"Confirmer : c'est programmé\")"));
await wait(1800);
await click(p, p.locator('button[aria-label="Fermer le panneau (Échap)"]'));
await wait(800);

// Glisser la carte vers la Session 2
const card = p.locator(`[data-row="${s1}"] [data-pub-id]`).first();
const cb = await card.boundingBox();
const tb = await p.locator(`[data-row="${s2}"] > div:last-child`).boundingBox();
await p.mouse.move(cb.x + cb.width / 2, cb.y + 60, { steps: 15 });
await p.mouse.down();
await p.mouse.move(cb.x + cb.width / 2 + 10, cb.y + 70, { steps: 5 });
await p.mouse.move(tb.x + 80, tb.y + tb.height / 2, { steps: 40 });
await wait(400);
await p.mouse.up();
await wait(2500);

// Filtres combinés
await click(p, p.locator('button:has-text("Filtres")'));
const pop = p.locator("[data-radix-popper-content-wrapper]");
await click(p, pop.locator('button:has-text("LinkedIn")'));
await click(p, pop.locator('button:has-text("Programmé")'));
await p.keyboard.press("Escape");
await wait(2200);
await click(p, p.locator('button:has-text("Tout effacer")'));
await click(p, p.locator("#global-search"));
await type(p.locator("#global-search"), "rappel");
await wait(2000);
await p.fill("#global-search", "");

// Mon espace, médiathèque
await click(p, p.locator('nav a:has-text("Mon espace")'));
await wait(2500);
await click(p, p.locator('nav a:has-text("Médiathèque")'));
await wait(2500);
await click(p, p.locator('nav a:has-text("Board visuel")'));
await wait(1200);
await p.close();
await ctx.close();
}

// --- Smartphone
const m = await b.newContext({ ...devices["iPhone 13"], recordVideo: { dir: OUT + "/video-mobile", size: { width: 390, height: 844 } } });
const mp = await m.newPage();
await login(mp);
await mp.evaluate(() => document.querySelector("#board-scroller").scrollBy({ top: 500, behavior: "smooth" }));
await wait(1500);
await mp.locator('[data-pub-id]:has-text("Présentation de la session 1")').tap();
await mp.waitForSelector("#publication-panel");
await wait(1500);
await mp.locator("#publication-panel .overflow-y-auto").first().evaluate((e) => e.scrollBy({ top: 600, behavior: "smooth" }));
await wait(2000);
await mp.tap('button[aria-label="Fermer le panneau (Échap)"]');
await wait(800);
await mp.tap('button[aria-label="Ouvrir la navigation"]');
await wait(1200);
await mp.tap('[role=dialog] nav a:has-text("Mon espace")');
await wait(2500);
await mp.close();
await m.close();
await b.close();
