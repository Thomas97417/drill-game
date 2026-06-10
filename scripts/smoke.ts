/* eslint-disable @typescript-eslint/no-explicit-any */
// Smoke test : joue la boucle complète en Chromium headless —
// creuser, remonter, vendre, faire le plein, acheter des améliorations,
// se téléporter, recharger la page (sauvegarde).
import { chromium, type Page } from 'playwright-core';

const EXE =
  process.env.CHROMIUM_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const URL = process.env.GAME_URL ?? 'http://localhost:5174';

const failures: string[] = [];
const check = (cond: boolean, label: string) => {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) failures.push(label);
};

const browser = await chromium.launch({ executablePath: EXE, headless: true });
// deviceScaleFactor 2 ≈ écran Retina : vérifie que le canvas garde sa taille CSS
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

const errors: string[] = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

interface Snap {
  x: number;
  y: number;
  depth: number;
  money: number;
  fuel: number;
  hull: number;
  teleporters: number;
  ui: string;
  coal: number;
}
const snap = (): Promise<Snap> =>
  page.evaluate(() => {
    const w = window as any;
    const s = w.__store.getState();
    const p = w.__engine.player;
    return {
      x: p.x,
      y: p.y,
      depth: s.depth,
      money: s.money,
      fuel: s.fuel,
      hull: s.hull,
      teleporters: s.teleporters,
      ui: s.ui,
      coal: s.cargo.coal ?? 0,
    };
  });

// maintient une touche jusqu'à ce qu'une condition soit vraie
async function holdUntil(p: Page, key: string, cond: (s: Snap) => boolean, timeoutMs = 15000) {
  await p.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond(await snap())) break;
    await p.waitForTimeout(100);
  }
  await p.keyboard.up(key);
}

// ── Partie fraîche ────────────────────────────────────────────────────────
await page.goto(URL);
await page.waitForSelector('canvas.game-canvas');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('canvas.game-canvas');
await page.waitForTimeout(500);

let s = await snap();
check(s.fuel > 98 && s.money === 0 && s.depth === 0, 'partie fraîche (~100 L, 0 $, 0 m)');
await page.screenshot({ path: '/tmp/drill-1-surface.png' });

// à l'arrêt, aucune consommation d'essence
const fuelIdle = s.fuel;
await page.waitForTimeout(1500);
s = await snap();
check(s.fuel === fuelIdle, `pas de consommation à l'arrêt (${s.fuel.toFixed(1)} L)`);

// le canvas garde sa taille CSS malgré le devicePixelRatio de 2
const cssSize = await page.evaluate(() => {
  const c = document.querySelector('canvas.game-canvas') as HTMLCanvasElement;
  const r = c.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
check(cssSize.w === 1280 && cssSize.h === 800, 'canvas à la taille de la fenêtre en HiDPI');

// ── Creuser vers le bas puis sur le côté ──────────────────────────────────
const shaftX = s.x;
await holdUntil(page, 'ArrowDown', (st) => st.depth >= 4);
s = await snap();
check(s.depth >= 4, `forage vertical (profondeur ${s.depth} m)`);
check(s.fuel < 100, `essence consommée (${s.fuel.toFixed(1)} L)`);

await page.keyboard.down('ArrowRight');
await page.waitForTimeout(2500);
await page.keyboard.up('ArrowRight');
const sideX = (await snap()).x;
check(sideX > s.x + 0.8, `forage latéral (avancée de ${(sideX - s.x).toFixed(2)} tuile)`);
await page.screenshot({ path: '/tmp/drill-2-digging.png' });

// minerais pour tester la vente (l'apparition naturelle est aléatoire)
await page.evaluate(() => {
  const add = (window as any).__store.getState().addCargo;
  for (let i = 0; i < 60; i++) add('coal');
});

// ── Remonter au jetpack : Haut+Gauche pour glisser sous le plafond
//    jusqu'au puits vertical (x = shaftX) puis s'élever ────────────────────
await page.keyboard.down('ArrowUp');
await page.keyboard.down('ArrowLeft');
const t0 = Date.now();
while (Date.now() - t0 < 15000) {
  const st = await snap();
  if (st.y <= -0.5) break;
  if (st.x <= shaftX + 0.2) await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(80);
}
// dériver à gauche au-dessus du sol ferme (sinon on retombe dans le puits)
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowLeft');
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(1500); // retombée + atterrissage
s = await snap();
check(s.depth === 0, `retour à la surface (profondeur ${s.depth} m)`);

// ── Marcher jusqu'au magasin (x ≈ 5) ──────────────────────────────────────
const dir = s.x > 5 ? 'ArrowLeft' : 'ArrowRight';
await holdUntil(page, dir, (st) => Math.abs(st.x - 5) < 0.6, 8000);
await page.waitForTimeout(300);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
check((await page.locator('.modal.shop').count()) > 0, 'magasin ouvert avec [E]');
await page.screenshot({ path: '/tmp/drill-3-shop.png' });

// ── Vendre ────────────────────────────────────────────────────────────────
await page.click('button:has-text("Tout vendre")');
s = await snap();
check(s.money >= 540 && s.coal === 0, `vente de la cargaison (${s.money} $)`);

// ── Essence : plein ───────────────────────────────────────────────────────
await page.click('.tab:has-text("Essence")');
await page.click('button:has-text("Plein")');
s = await snap();
check(s.fuel >= 99.5, `plein d'essence (${s.fuel.toFixed(1)} L)`);

// ── Amélioration : foreuse Acier (150 $) ──────────────────────────────────
await page.click('.tab:has-text("Améliorations")');
const moneyBefore = s.money;
await page.click('.upgrade-row:has-text("Foreuse") button');
s = await snap();
check(s.money === moneyBefore - 150, 'achat amélioration foreuse (−150 $)');

// ── Téléporteur (300 $) ───────────────────────────────────────────────────
await page.click('.tab:has-text("Téléporteur")');
await page.click('button:has-text("Acheter un téléporteur")');
s = await snap();
check(s.teleporters === 1, 'achat téléporteur');
await page.screenshot({ path: '/tmp/drill-4-shop-upgrades.png' });

await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check((await snap()).ui === 'playing', 'fermeture du magasin');

// ── Recreuser puis se téléporter ──────────────────────────────────────────
await holdUntil(page, 'ArrowDown', (st) => st.depth >= 3);
await page.keyboard.press('KeyT');
await page.waitForTimeout(400);
s = await snap();
check(s.depth === 0 && s.teleporters === 0, 'téléportation vers la surface');

// ── Persistance : recharger la page ───────────────────────────────────────
const moneySaved = s.money;
await page.waitForTimeout(1000);
await page.reload();
await page.waitForSelector('canvas.game-canvas');
await page.waitForTimeout(800);
s = await snap();
check(s.money === moneySaved, `sauvegarde restaurée (${s.money} $ après rechargement)`);
await page.screenshot({ path: '/tmp/drill-5-reloaded.png' });

check(errors.length === 0, `aucune erreur console${errors.length ? ` : ${errors.join(' | ')}` : ''}`);

await browser.close();
console.log(failures.length === 0 ? '\n🎉 Tous les tests passent' : `\n${failures.length} échec(s)`);
process.exit(failures.length === 0 ? 0 : 1);
