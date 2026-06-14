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
  dynamites: number;
  day: number;
  ui: string;
  iron: number;
  bronze: number;
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
      dynamites: s.dynamites,
      day: s.day,
      ui: s.ui,
      iron: s.cargo.iron ?? 0,
      bronze: s.cargo.bronze ?? 0,
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

// Boutons « maintenir pour valider » du shop : il faut garder le clic / la
// touche le temps que la barre se remplisse (≈ 700 ms) avant le déclenchement.
const HOLD_MS = 1000;
async function holdPress(key: string, ms = HOLD_MS) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(150);
}
// focalise le bouton (le fait défiler dans la vue) puis maintient Entrée :
// plus fiable que des coordonnées souris quand le panneau défile
async function holdClick(selector: string, ms = HOLD_MS) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await loc.focus();
  await holdPress('Enter', ms);
}

// ── Partie fraîche ────────────────────────────────────────────────────────
await page.goto(URL);
await page.waitForSelector('canvas.game-canvas');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('canvas.game-canvas');
await page.waitForTimeout(500);

// ── Cinématique d'arrivée + briefing de mission ───────────────────────────
check((await snap()).ui === 'cinematic', 'fusée de dépose au lancement');
await page.keyboard.press('KeyE'); // passe la cinématique
await page.waitForTimeout(400);
check((await page.locator('.modal.story').count()) > 0, 'briefing de mission affiché');
await page.keyboard.press('Enter'); // bouton « Commencer » focalisé
await page.waitForTimeout(300);
check((await snap()).ui === 'playing', 'mission commencée');

let s = await snap();
check(s.fuel > 98 && s.money === 0 && s.depth === 0, 'partie fraîche (~100 L, 0 $, 0 m)');
check(s.day === 1, `la partie commence au jour 1 (jour ${s.day})`);
// le compteur passe au jour 2 après un cycle complet (240 s)
await page.evaluate(() => { (window as any).__engine.time = 245; });
await page.waitForTimeout(250);
check((await snap()).day === 2, 'jour 2 après un cycle complet');
await page.evaluate(() => { (window as any).__engine.time = 30; });
await page.screenshot({ path: '/tmp/drill-1-surface.png' });

// à l'arrêt, aucune consommation d'essence
const fuelIdle = s.fuel;
await page.waitForTimeout(1500);
s = await snap();
check(s.fuel === fuelIdle, `pas de consommation à l'arrêt (${s.fuel.toFixed(1)} L)`);

// alerte carburant critique quand la jauge passe en rouge (< 25 %)
await page.evaluate(() => (window as any).__store.setState({ fuel: 20 }));
await page.waitForTimeout(200);
check((await page.locator('.fuel-alert').count()) > 0, 'alerte carburant critique affichée');
await page.evaluate(() => (window as any).__store.setState({ fuel: 100 }));
await page.waitForTimeout(200);
check((await page.locator('.fuel-alert').count()) === 0, 'alerte masquée une fois le plein fait');

// soute limitée : capacité de base 12, alerte quand elle est pleine
await page.evaluate(() => {
  const st = (window as any).__store.getState();
  for (let i = 0; i < 20; i++) st.addCargo('iron');
});
await page.waitForTimeout(200);
s = await snap();
check(s.iron === 10, `capacité de soute plafonnée (${s.iron}/10)`);
check((await page.locator('.cargo-alert').count()) > 0, 'alerte soute pleine affichée');
await page.evaluate(() => (window as any).__store.setState({ cargo: {} }));
await page.waitForTimeout(200);
check((await page.locator('.cargo-alert').count()) === 0, 'alerte soute masquée une fois vidée');

// les minerais précieux occupent plus de stockage (Goldium = 3)
await page.evaluate(() => {
  const st = (window as any).__store.getState();
  for (let i = 0; i < 8; i++) st.addCargo('gold');
});
const goldCount = await page.evaluate(
  () => (window as any).__store.getState().cargo.gold ?? 0,
);
check(goldCount === 3, `taille de stockage par valeur (${goldCount} Goldium = 9 stockage)`);
await page.evaluate(() => (window as any).__store.setState({ cargo: {} }));

// le canvas garde sa taille CSS malgré le devicePixelRatio de 2
const cssSize = await page.evaluate(() => {
  const c = document.querySelector('canvas.game-canvas') as HTMLCanvasElement;
  const r = c.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
check(cssSize.w === 1280 && cssSize.h === 800, 'canvas à la taille de la fenêtre en HiDPI');

// ── Creuser vers le bas puis sur le côté ──────────────────────────────────
const shaftX = s.x;
// un minerai planté sous la foreuse doit faire flotter son nom à la récolte
await page.evaluate(() => {
  const e = (window as any).__engine;
  const col = Math.floor(e.player.x + e.player.w / 2);
  e.world.getTile(col, 0);
  e.world.rows.get(0)[col] = 'iron';
});
await page.keyboard.down('ArrowDown');
let sawFloater = false;
for (let i = 0; i < 30 && !sawFloater; i++) {
  await page.waitForTimeout(100);
  sawFloater = await page.evaluate(() =>
    (window as any).__engine.floaters.some((f: any) => f.text === 'Ironium'),
  );
}
await page.keyboard.up('ArrowDown');
check(sawFloater, 'nom du minerai flottant à la récolte');
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

// minerais pour tester la vente (injection directe, au-delà de la capacité)
await page.evaluate(() => {
  (window as any).__store.setState({ cargo: { iron: 200, bronze: 30 } });
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

// marche jusqu'à une position x donnée à la surface
async function walkTo(x: number) {
  const cur = (await snap()).x;
  const key = cur > x ? 'ArrowLeft' : 'ArrowRight';
  await holdUntil(page, key, (st) => Math.abs(st.x - x) < 0.6, 12000);
  await page.waitForTimeout(250);
}

// ── Comptoir de vente (x ≈ 3,5) ───────────────────────────────────────────
await walkTo(3.5);
// l'action rapide [F] est proposée en bas de l'écran
check(
  (await page.locator('.btn-quick:has-text("Tout vendre")').count()) > 0,
  'action rapide [F] affichée en bas de l\'écran',
);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
check(
  (await page.locator('.modal.shop:has-text("Hôtel des ventes")').count()) > 0,
  'comptoir de vente ouvert avec [E]',
);
await page.screenshot({ path: '/tmp/drill-3-shop.png' });
// navigation clavier : focus initial sur un bouton, flèches pour se déplacer
const focusIdx = () =>
  page.evaluate(() => {
    const modal = document.querySelector('.modal');
    const btns = Array.from(modal?.querySelectorAll('button') ?? []);
    return btns.indexOf(document.activeElement as HTMLButtonElement);
  });
const firstIdx = await focusIdx();
check(firstIdx >= 0, `focus clavier initial dans le menu (bouton n°${firstIdx})`);
await page.keyboard.press('ArrowDown');
const movedIdx = await focusIdx();
check(movedIdx >= 0 && movedIdx !== firstIdx, 'flèches : focus déplacé au bouton suivant');
// ZQSD/WASD naviguent aussi (KeyS = bas)
await page.keyboard.press('KeyS');
const movedIdx2 = await focusIdx();
check(movedIdx2 >= 0 && movedIdx2 !== movedIdx, 'ZQSD : focus déplacé avec S');
// retour au point de départ pour la suite du test
await page.keyboard.press('KeyW');
await page.keyboard.press('KeyW');
// vente individuelle : uniquement le bronzium (maintien du clic)
await holdClick('.sell-table tr:has-text("Bronzium") button');
s = await snap();
check(s.money === 1800 && s.bronze === 0 && s.iron === 200, 'vente individuelle du bronzium (+1 800 $)');
// action rapide F : vend tout le reste (maintien de la touche)
await holdPress('KeyF');
s = await snap();
check(s.money >= 7500 && s.iron === 0, `tout vendu avec [F] (${s.money} $)`);

// E doit fermer le menu sans le rouvrir aussitôt
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
check((await snap()).ui === 'playing', 'fermeture du menu avec [E] (sans réouverture)');

// ── Options via l'engrenage ───────────────────────────────────────────────
await page.click('.gear-btn');
await page.waitForTimeout(300);
check(
  (await page.locator('.modal.options:has-text("Nouvelle partie")').count()) > 0,
  "dialog options ouverte via l'engrenage",
);
// choix de disposition clavier (AZERTY par défaut)
check(
  (await page.locator('.layout-btns .btn-primary:has-text("AZERTY")').count()) > 0,
  'AZERTY sélectionné par défaut',
);
await page.click('.layout-btns button:has-text("QWERTY")');
await page.waitForTimeout(200);
check(
  (await page.locator('.hud-bottom-left:has-text("WASD")').count()) > 0,
  'aides affichées en WASD après bascule QWERTY',
);
await page.click('.layout-btns button:has-text("AZERTY")');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check((await snap()).ui === 'playing', 'dialog options fermée avec [Échap]');

// ── Inventaire avec [I] ───────────────────────────────────────────────────
await page.keyboard.press('KeyI');
await page.waitForTimeout(300);
check(
  (await page.locator('.modal.inventory:has-text("Téléporteurs")').count()) > 0,
  'inventaire ouvert avec [I]',
);
await page.screenshot({ path: '/tmp/drill-6-inventory.png' });
await page.keyboard.press('KeyI');
await page.waitForTimeout(400);
check((await snap()).ui === 'playing', 'inventaire fermé avec [I]');

// les fondations sous les bâtiments sont indestructibles
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(1500);
await page.keyboard.up('ArrowDown');
s = await snap();
check(s.depth === 0, 'impossible de creuser sous un bâtiment');

// ── Station essence (x ≈ 9,5) ─────────────────────────────────────────────
await walkTo(9.5);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
check(
  (await page.locator('.modal.shop:has-text("Station essence")').count()) > 0,
  'station essence ouverte avec [E]',
);
// on vide le réservoir pour que les achats partiels soient visibles
await page.evaluate(() => (window as any).__store.setState({ fuel: 40 }));
// Entrée (maintenue) valide le bouton focalisé (+10 L, premier bouton du panneau)
const fuelBefore = (await snap()).fuel;
await holdPress('Enter');
s = await snap();
check(s.fuel > fuelBefore, `achat validé avec [Entrée] (+${(s.fuel - fuelBefore).toFixed(0)} L)`);
// Espace valide aussi
await page.evaluate(() => (window as any).__store.setState({ fuel: 80 }));
// reprend le focus (perdu quand le bouton s'est grisé) : Fermer, puis +10 L
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
const fuelBefore2 = (await snap()).fuel;
await holdPress('Space');
s = await snap();
check(s.fuel > fuelBefore2, `achat validé avec [Espace] (+${(s.fuel - fuelBefore2).toFixed(0)} L)`);
await holdPress('KeyF');
s = await snap();
check(s.fuel >= 99.5, `plein d'essence avec [F] (${s.fuel.toFixed(1)} L)`);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ── Atelier (x ≈ 22) : réparation, améliorations, téléporteur ─────────────
// rebouche les tunnels creusés : le puits de départ (x ≈ 16) est désormais
// sur le chemin de l'atelier, on y tomberait en marchant
await page.evaluate(() => (window as any).__engine.world.dug.clear());
await walkTo(22);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
check(
  (await page.locator('.modal.shop:has-text("Atelier")').count()) > 0,
  'atelier ouvert avec [E]',
);
if (s.hull < 100) {
  await page.click('[data-kind="repair"] .buy-btn'); // réparation = clic instantané
  s = await snap();
  check(s.hull >= 99.5, `réparation de la coque (${s.hull.toFixed(0)} PV)`);
}
const moneyBefore = (await snap()).money;
await holdClick('[data-kind="drill"] .buy-btn');
s = await snap();
check(s.money === moneyBefore - 750, 'achat amélioration foreuse (−750 $)');
await holdClick('[data-kind="jetpack"] .buy-btn');
s = await snap();
check(s.money === moneyBefore - 750 - 750, 'achat amélioration moteur (−750 $)');
// un réservoir/une coque achetés arrivent pleins, sans repasser par la pompe
await holdClick('[data-kind="hull"] .buy-btn');
s = await snap();
check(s.hull === 170, `coque neuve livrée intacte (${s.hull.toFixed(0)} / 170 PV)`);
await holdClick('[data-kind="tank"] .buy-btn');
s = await snap();
check(s.fuel === 150, `réservoir neuf livré plein (${s.fuel.toFixed(0)} / 150 L)`);
const moneyBeforeCargo = (await snap()).money;
await holdClick('[data-kind="cargo"] .buy-btn');
s = await snap();
check(s.money === moneyBeforeCargo - 750, 'achat amélioration soute (−750 $)');
await page.click('[data-kind="teleporter"] .buy-btn'); // consommable = clic instantané
s = await snap();
check(s.teleporters === 1, 'achat téléporteur');
await page.click('[data-kind="dynamite"] .buy-btn'); // consommable = clic instantané
s = await snap();
check(s.dynamites === 1, 'achat dynamite');
await page.screenshot({ path: '/tmp/drill-4-shop-upgrades.png' });

await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check((await snap()).ui === 'playing', 'fermeture du magasin');

// ── Le jetpack Turbine dépasse la vitesse de vol de base (7,5 t/s) ────────
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(900);
const vyFly: number = await page.evaluate(() => (window as any).__engine.player.vy);
await page.keyboard.up('ArrowUp');
check(vyFly < -7.8, `vol plus rapide après amélioration (${(-vyFly).toFixed(1)} t/s)`);
await page.waitForTimeout(2000); // retombée

// ── Dynamite : largage [X], fuite au jetpack, explosion ───────────────────
await walkTo(26.5);
await holdUntil(page, 'ArrowDown', (st) => st.depth >= 5);
await page.keyboard.press('KeyX');
await page.waitForTimeout(200);
const dyn: { x: number; y: number } | null = await page.evaluate(() => {
  const d = (window as any).__engine.dynamites[0];
  return d ? { x: d.x, y: d.y } : null;
});
check(dyn !== null && (await snap()).dynamites === 0, 'dynamite larguée avec [X]');
// on reste en vol au-dessus pendant toute la mèche, puis on redescend
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(3400); // mèche de 3 s
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(2000); // retombée
const around: string[] = await page.evaluate(
  ([dx, dy]) => {
    const w = (window as any).__engine.world;
    const tx = Math.floor(dx);
    const ty = Math.floor(dy);
    return [w.getTile(tx, ty), w.getTile(tx, ty + 1), w.getTile(tx + 1, ty), w.getTile(tx - 1, ty)];
  },
  [dyn!.x, dyn!.y],
);
check(
  around.every((t) => t === 'empty'),
  `explosion : blocs détruits autour (${around.join(', ')})`,
);
s = await snap();
check(s.ui === 'playing' && s.depth > 0, 'la foreuse a survécu en s\'éloignant');

// ── Téléportation ─────────────────────────────────────────────────────────
await page.keyboard.press('KeyT');
await page.waitForTimeout(400);
s = await snap();
check(s.depth === 0 && s.teleporters === 0, 'téléportation vers la surface');

// ── Dégâts de chute : animation + PV perdus en texte flottant ─────────────
await page.evaluate(() => {
  const e = (window as any).__engine;
  e.player.y = -7;
  e.player.vy = 0;
});
let sawHurt = false;
for (let i = 0; i < 30 && !sawHurt; i++) {
  await page.waitForTimeout(100);
  sawHurt = await page.evaluate(() => {
    const e = (window as any).__engine;
    return e.hurtTimer > 0 && e.floaters.some((f: any) => f.text.includes('PV'));
  });
}
check(sawHurt, 'animation de dégâts + PV perdus affichés à la chute');
await page.waitForTimeout(800);

// ── Lave : forer dedans endommage la coque ────────────────────────────────
const hullBefore = (await snap()).hull;
await page.evaluate(() => {
  const e = (window as any).__engine;
  const col = Math.floor(e.player.x + e.player.w / 2);
  e.world.getTile(col, 0); // force la génération de la ligne
  e.world.rows.get(0)[col] = 'lava';
});
await holdUntil(page, 'ArrowDown', (st) => st.depth >= 1, 8000);
s = await snap();
check(
  s.hull < hullBefore,
  `la lave brûle la coque (${hullBefore.toFixed(0)} → ${s.hull.toFixed(0)} PV)`,
);

// ── Persistance : recharger la page ───────────────────────────────────────
const moneySaved = s.money;
await page.waitForTimeout(1000);
await page.reload();
await page.waitForSelector('canvas.game-canvas');
await page.waitForTimeout(800);
s = await snap();
check(s.money === moneySaved, `sauvegarde restaurée (${s.money} $ après rechargement)`);
await page.screenshot({ path: '/tmp/drill-5-reloaded.png' });

// ── Objectif : 10 M$ → rappel de la fusée → victoire ──────────────────────
// la coque est restée à 0 après le test de lave : on accepte le rapatriement
if ((await page.locator('.modal.rescue').count()) > 0) {
  await page.click('.modal.rescue button');
  await page.waitForTimeout(500);
}
await page.evaluate(() => (window as any).__store.setState({ money: 10_000_000 }));
await page.waitForTimeout(300);
check((await page.locator('.recall-btn').count()) > 0, 'bouton « rappeler la fusée » à 10 M$');
// force : l'animation de pulsation rend le bouton « instable » pour Playwright
await page.click('.recall-btn', { force: true });
await page.waitForTimeout(500);
await page.keyboard.press('KeyE'); // passe la cinématique de départ
await page.waitForTimeout(500);
check((await page.locator('.modal.victory').count()) > 0, 'écran de victoire affiché (XK-712)');
check(
  (await page.locator('.victory button:has-text("Embarquer")').count()) > 0,
  'bouton « embarquer pour la planète suivante » affiché',
);

// ── Transition vers la planète gelée (remise à zéro) ──────────────────────
const planetState = () =>
  page.evaluate(() => {
    const s = (window as any).__store.getState();
    return {
      ui: s.ui,
      planet: s.planet,
      money: s.money,
      drill: s.upgrades.drill,
      hull: s.hull,
      cobaltium: s.cargo.cobaltium ?? 0,
    };
  });

await page.locator('.victory button:has-text("Embarquer")').click();
await page.waitForTimeout(400);
let fs = await planetState();
check(
  fs.planet === 'frost' && fs.money === 0 && fs.drill === 0,
  `remise à zéro sur la planète gelée (planète=${fs.planet}, ${fs.money} $, foreuse niv.${fs.drill})`,
);
await page.keyboard.press('KeyE'); // saute la cinématique d'arrivée
await page.waitForTimeout(500);
check(
  (await page.locator('.modal.story:has-text("Sialis")').count()) > 0,
  'briefing de la planète gelée affiché',
);
await page.keyboard.press('Enter'); // commencer le forage
await page.waitForTimeout(500);
fs = await planetState();
check(fs.ui === 'playing' && fs.planet === 'frost', 'forage commencé sur la planète gelée');

// minerai de glace + poche de froid sous la foreuse
await page.evaluate(() => {
  const e = (window as any).__engine;
  const col = Math.floor(e.player.x + e.player.w / 2);
  for (let y = 1; y <= 4; y++) {
    e.world.getTile(col, y);
    e.world.rows.get(y)[col] = 'cobaltium';
  }
  e.world.getTile(col, 2);
  e.world.rows.get(2)[col] = 'cold';
});
const hullBeforeCold = (await planetState()).hull;
await holdUntil(page, 'ArrowDown', (st) => st.depth >= 3, 9000);
fs = await planetState();
check(fs.cobaltium > 0, `minerai de glace récolté (cobaltium ×${fs.cobaltium})`);
check(fs.hull < hullBeforeCold, `la poche de froid gèle la coque (${hullBeforeCold.toFixed(0)} → ${fs.hull.toFixed(0)} PV)`);

// dynamite : détruit un rocher de glace mais épargne la poche de froid
const blast = await page.evaluate(() => {
  const w = (window as any).__engine.world;
  const col = 10;
  const y = 30;
  w.getTile(col, y);
  w.rows.get(y)[col] = 'iceboulder';
  w.getTile(col + 1, y);
  w.rows.get(y)[col + 1] = 'cold';
  w.blast(col + 0.5, y + 0.5, 2.2);
  return { boulderGone: w.getTile(col, y) === 'empty', coldKept: w.getTile(col + 1, y) === 'cold' };
});
check(
  blast.boulderGone && blast.coldKept,
  'dynamite détruit le rocher de glace mais épargne la poche de froid',
);

// retour en surface via téléporteur, puis objectif (50 M$) → victoire finale
await page.evaluate(() => (window as any).__store.setState({ teleporters: 1 }));
await page.keyboard.press('KeyT');
await page.waitForTimeout(600); // téléportation vers la surface
await page.evaluate(() => (window as any).__store.setState({ money: 50_000_000 }));
await page.evaluate(() => (window as any).__store.getState().recallRocket());
await page.waitForTimeout(300);
await page.keyboard.press('KeyE'); // saute la cinématique de départ
await page.waitForTimeout(500);
check((await page.locator('.modal.victory').count()) > 0, 'victoire sur la planète gelée');
check(
  (await page.locator('.victory button:has-text("Embarquer")').count()) === 0,
  'dernière planète : pas de bouton « embarquer »',
);

check(errors.length === 0, `aucune erreur console${errors.length ? ` : ${errors.join(' | ')}` : ''}`);

await browser.close();
console.log(failures.length === 0 ? '\n🎉 Tous les tests passent' : `\n${failures.length} échec(s)`);
process.exit(failures.length === 0 ? 0 : 1);
