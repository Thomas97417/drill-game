// Atlas de sprites de tuiles : chaque matériau est pré-peint en pixel-art
// détaillé (4 variantes) dans un canvas hors écran au démarrage, puis copié
// par drawImage à chaque frame — beaucoup plus riche ET moins cher que de
// redessiner les motifs en direct.
import { ORE_IDS, TILE, type TileKind } from './constants';
import { hash2D, mulberry32 } from './rng';

const VARIANTS = 4;
const KINDS: TileKind[] = [
  'dirt',
  'rock',
  'hardrock',
  'bedrock',
  'foundation',
  'boulder',
  'lava',
  ...ORE_IDS,
];
const P = 4; // taille du « gros pixel »
const G = Math.ceil(TILE / P); // cellules par côté

let atlas: HTMLCanvasElement | null = null;
const rowOf = new Map<TileKind, number>();

type Rng = () => number;

export function initTileAtlas() {
  if (atlas) return;
  atlas = document.createElement('canvas');
  atlas.width = VARIANTS * TILE;
  atlas.height = KINDS.length * TILE;
  const ctx = atlas.getContext('2d')!;
  KINDS.forEach((kind, row) => {
    rowOf.set(kind, row);
    for (let v = 0; v < VARIANTS; v++) {
      const rng = mulberry32((row * 131 + v * 7919 + 42) >>> 0);
      ctx.save();
      ctx.translate(v * TILE, row * TILE);
      ctx.beginPath();
      ctx.rect(0, 0, TILE, TILE);
      ctx.clip();
      paintTile(ctx, kind, rng);
      ctx.restore();
    }
  });
}

export function drawTileSprite(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  x: number,
  y: number,
  px: number,
  py: number,
) {
  const row = rowOf.get(kind);
  if (atlas === null || row === undefined) return;
  const v = Math.floor(hash2D(x, y, 777) * VARIANTS);
  ctx.drawImage(atlas, v * TILE, row * TILE, TILE, TILE, px, py, TILE, TILE);
}

// Icône de tuile pour l'UI (boutique, inventaire) — même sprite que le monde
export function drawTileIcon(ctx: CanvasRenderingContext2D, kind: TileKind, size: number) {
  initTileAtlas();
  const row = rowOf.get(kind);
  if (atlas === null || row === undefined) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, 0, row * TILE, TILE, TILE, 0, 0, size, size);
}

// ── Peinture des matériaux ───────────────────────────────────────────────────

function paintTile(ctx: CanvasRenderingContext2D, kind: TileKind, rng: Rng) {
  switch (kind) {
    case 'dirt':
      paintDirt(ctx, rng);
      break;
    case 'rock':
      paintRock(ctx, rng, ['#565660', '#6f6f79', '#7d7d88', '#8b8b96'], 4);
      break;
    case 'hardrock':
      paintRock(ctx, rng, ['#33333c', '#46464f', '#52525c', '#5e5e69'], 6);
      break;
    case 'bedrock':
      paintBedrock(ctx, rng);
      break;
    case 'foundation':
      paintFoundation(ctx, rng);
      break;
    case 'boulder':
      paintBoulder(ctx, rng);
      break;
    case 'lava':
      paintLava(ctx, rng);
      break;
    case 'iron':
      paintDirt(ctx, rng);
      paintIron(ctx, rng);
      break;
    case 'bronze':
      paintDirt(ctx, rng);
      paintNuggets(ctx, rng, '#cd8a3c', '#7e4f1e', '#f0c08a');
      break;
    case 'silver':
      paintRock(ctx, rng, ['#565660', '#6f6f79', '#7d7d88', '#8b8b96'], 3);
      paintNuggets(ctx, rng, '#c9d0db', '#838c9a', '#f2f6fb');
      break;
    case 'gold':
      paintRock(ctx, rng, ['#565660', '#6f6f79', '#7d7d88', '#8b8b96'], 3);
      paintNuggets(ctx, rng, '#f6c945', '#b8860b', '#fff3b0');
      break;
    case 'platinum':
      paintRock(ctx, rng, ['#33333c', '#46464f', '#52525c', '#5e5e69'], 4);
      paintNuggets(ctx, rng, '#dbe8ee', '#8fa3ad', '#ffffff');
      break;
    case 'einsteinium':
      paintRock(ctx, rng, ['#33333c', '#46464f', '#52525c', '#5e5e69'], 4);
      paintCrystals(ctx, rng, '#b86bff', '#6a3aa8', '#e4c8ff');
      break;
    case 'emerald':
      paintRock(ctx, rng, ['#33333c', '#46464f', '#52525c', '#5e5e69'], 4);
      paintCrystals(ctx, rng, '#31d178', '#157a44', '#a8f5cd');
      break;
    case 'ruby':
      paintRock(ctx, rng, ['#26262e', '#383841', '#44444e', '#50505b'], 4);
      paintCrystals(ctx, rng, '#ef3b58', '#a31432', '#ff9ab0');
      break;
    case 'diamond':
      paintRock(ctx, rng, ['#26262e', '#383841', '#44444e', '#50505b'], 4);
      paintCrystals(ctx, rng, '#8deef7', '#3aa8b8', '#e8fdff');
      break;
    case 'amazonite':
      paintRock(ctx, rng, ['#1f1f27', '#2e2e38', '#3a3a45', '#46464f'], 5);
      paintCrystals(ctx, rng, '#3fd9c2', '#1b7f70', '#bdfff2');
      break;
    default:
      break;
  }
}

// gros pixel sur la grille
function cell(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(cx * P, cy * P, P, P);
}

// remplit la tuile d'un bruit pondéré de tons
function noiseFill(ctx: CanvasRenderingContext2D, rng: Rng, tones: string[], weights: number[]) {
  for (let cy = 0; cy < G; cy++) {
    for (let cx = 0; cx < G; cx++) {
      const r = rng();
      let acc = 0;
      let tone = tones[tones.length - 1];
      for (let i = 0; i < tones.length; i++) {
        acc += weights[i];
        if (r < acc) {
          tone = tones[i];
          break;
        }
      }
      cell(ctx, cx, cy, tone);
    }
  }
}

// ── Terre : bruns chauds, cailloux, racines ──────────────────────────────────

function paintDirt(ctx: CanvasRenderingContext2D, rng: Rng) {
  noiseFill(ctx, rng, ['#5e3d1a', '#6e4a20', '#82592a', '#916834'], [0.18, 0.34, 0.32, 0.16]);
  // petits cailloux
  for (let i = 0; i < 3; i++) {
    const cx = 1 + Math.floor(rng() * (G - 3));
    const cy = 1 + Math.floor(rng() * (G - 3));
    cell(ctx, cx, cy, '#4a3014');
    cell(ctx, cx + 1, cy, '#9a7a4a');
    cell(ctx, cx, cy + 1, '#3d2810');
  }
  // racine sinueuse occasionnelle
  if (rng() < 0.5) {
    let cx = Math.floor(rng() * G);
    ctx.fillStyle = 'rgba(70,48,22,0.6)';
    for (let cy = 0; cy < G; cy += 1) {
      ctx.fillRect(Math.max(0, Math.min(G - 1, cx)) * P, cy * P, P, P);
      if (rng() < 0.4) cx += rng() < 0.5 ? -1 : 1;
    }
  }
}

// ── Roche : facettes et fissures ─────────────────────────────────────────────

function paintRock(ctx: CanvasRenderingContext2D, rng: Rng, tones: string[], cracks: number) {
  noiseFill(ctx, rng, tones, [0.2, 0.36, 0.3, 0.14]);
  // facettes claires (patchs anguleux)
  for (let i = 0; i < 2; i++) {
    const fx = Math.floor(rng() * (G - 4));
    const fy = Math.floor(rng() * (G - 4));
    const fw = 2 + Math.floor(rng() * 3);
    for (let dy = 0; dy < fw; dy++)
      for (let dx = 0; dx < fw - dy; dx++) cell(ctx, fx + dx, fy + dy, tones[3]);
  }
  // fissures sombres
  ctx.strokeStyle = 'rgba(10,10,14,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < cracks; i++) {
    const x0 = rng() * TILE;
    const y0 = rng() * TILE;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (rng() - 0.5) * TILE * 0.5, y0 + (rng() - 0.3) * TILE * 0.5);
    ctx.stroke();
  }
}

// ── Roche-mère : strates denses ──────────────────────────────────────────────

function paintBedrock(ctx: CanvasRenderingContext2D, rng: Rng) {
  noiseFill(ctx, rng, ['#15151a', '#1d1d24', '#25252d', '#2d2d36'], [0.3, 0.34, 0.24, 0.12]);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 3; i++) {
    const y = Math.floor(rng() * G);
    ctx.fillRect(0, y * P, TILE, 2);
  }
}

// ── Fondations : béton, joints, boulons ──────────────────────────────────────

function paintFoundation(ctx: CanvasRenderingContext2D, rng: Rng) {
  noiseFill(ctx, rng, ['#7d848c', '#8d949c', '#99a0a8', '#a6acb3'], [0.2, 0.36, 0.3, 0.14]);
  // joints
  ctx.fillStyle = 'rgba(40,45,52,0.6)';
  ctx.fillRect(0, Math.floor(G / 2) * P, TILE, 2);
  ctx.fillRect(Math.floor(G / 2) * P, 0, 2, Math.floor(G / 2) * P);
  ctx.fillRect(Math.floor(G / 4) * P, Math.floor(G / 2) * P, 2, TILE);
  // boulons
  for (const [bx, by] of [
    [1, 1],
    [G - 2, 1],
    [1, G - 2],
    [G - 2, G - 2],
  ]) {
    cell(ctx, bx, by, '#5b6168');
    ctx.fillStyle = '#c2c8ce';
    ctx.fillRect(bx * P + 1, by * P + 1, 2, 2);
  }
}

// ── Rocher : galet massif ombré sur fond sombre ──────────────────────────────

function paintBoulder(ctx: CanvasRenderingContext2D, rng: Rng) {
  // fond de cavité
  noiseFill(ctx, rng, ['#1d1209', '#241910', '#2b1e13'], [0.4, 0.4, 0.2]);
  const cx0 = G / 2;
  const cy0 = G / 2 + 0.5;
  const rx = G * 0.46;
  const ry = G * 0.42;
  for (let cy = 0; cy < G; cy++) {
    for (let cx = 0; cx < G; cx++) {
      const dx = (cx + 0.5 - cx0) / rx;
      const dy = (cy + 0.5 - cy0) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // éclairage haut-gauche → ombre bas-droite
      const lit = -dx * 0.5 - dy * 0.7 + rng() * 0.25;
      const tone = lit > 0.35 ? '#8a8174' : lit > 0 ? '#6b6258' : d > 0.6 ? '#453d33' : '#564e43';
      cell(ctx, cx, cy, tone);
    }
  }
  // fissures du galet
  ctx.strokeStyle = 'rgba(20,15,10,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(TILE * (0.3 + rng() * 0.3), TILE * (0.25 + rng() * 0.2));
    ctx.lineTo(TILE * (0.4 + rng() * 0.3), TILE * (0.5 + rng() * 0.3));
    ctx.stroke();
  }
}

// ── Lave : bain incandescent qui remplit la case ─────────────────────────────

function paintLava(ctx: CanvasRenderingContext2D, rng: Rng) {
  // magma orange vif sur toute la tuile
  noiseFill(ctx, rng, ['#c93312', '#e8481c', '#ff5a1f', '#ff7b2d'], [0.22, 0.34, 0.3, 0.14]);
  // coulées plus claires
  for (let i = 0; i < 3; i++) {
    let cx = Math.floor(rng() * G);
    let cy = 1 + Math.floor(rng() * (G - 2));
    for (let s = 0; s < 7; s++) {
      cell(ctx, Math.max(0, Math.min(G - 1, cx)), Math.max(0, Math.min(G - 1, cy)), '#ff9a3d');
      cx += rng() < 0.7 ? 1 : 0;
      cy += rng() < 0.35 ? (rng() < 0.5 ? -1 : 1) : 0;
      if (cx >= G) break;
    }
  }
  // bulles jaunes brillantes
  for (let i = 0; i < 5; i++) {
    const cx = 1 + Math.floor(rng() * (G - 2));
    const cy = 1 + Math.floor(rng() * (G - 2));
    cell(ctx, cx, cy, '#ffd166');
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(cx * P + 1, cy * P + 1, 2, 2);
  }
  // quelques plaques de croûte refroidie
  for (let i = 0; i < 3; i++) {
    const cx = Math.floor(rng() * (G - 1));
    const cy = Math.floor(rng() * (G - 1));
    cell(ctx, cx, cy, '#8a2410');
    if (rng() < 0.5) cell(ctx, cx + 1, cy, '#7a2410');
  }
  // fine croûte sombre en bordure : le bloc se lit comme une case danger
  ctx.fillStyle = 'rgba(70,18,6,0.8)';
  ctx.fillRect(0, 0, TILE, 3);
  ctx.fillRect(0, TILE - 3, TILE, 3);
  ctx.fillRect(0, 0, 3, TILE);
  ctx.fillRect(TILE - 3, 0, 3, TILE);
}

// ── Minerais ─────────────────────────────────────────────────────────────────

// éclat en croix, façon étincelle de dessin animé
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y - 1, r * 2, 2);
  ctx.fillRect(x - 1, y - r, 2, r * 2);
  ctx.fillRect(x - 2, y - 2, 4, 4);
}

// gros amas de minerai détouré (ombre + tons + glint)
function chunk(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  cx: number,
  cy: number,
  s: number,
  dark: string,
  mid: string,
  light: string,
) {
  // détourage sombre
  for (let dy = -1; dy <= s; dy++)
    for (let dx = -1; dx <= s; dx++) {
      if (dx >= 0 && dx < s && dy >= 0 && dy < s) continue;
      if (rng() < 0.55) cell(ctx, cx + dx, cy + dy, 'rgba(0,0,0,0.35)');
    }
  for (let dy = 0; dy < s; dy++)
    for (let dx = 0; dx < s; dx++) {
      const lit = -dx * 0.5 - dy * 0.7 + s * 0.5 + rng() * 0.4;
      cell(ctx, cx + dx, cy + dy, lit > s * 0.42 ? light : lit > 0 ? mid : dark);
    }
}

function paintIron(ctx: CanvasRenderingContext2D, rng: Rng) {
  // fer gris métal mat, bien distinct du bronzium orangé
  for (let i = 0; i < 3; i++) {
    const cx = 1 + Math.floor(rng() * (G - 5));
    const cy = 1 + Math.floor(rng() * (G - 5));
    chunk(ctx, rng, cx, cy, 3, '#454c56', '#7e8794', '#b7c0cc');
  }
}

function paintNuggets(ctx: CanvasRenderingContext2D, rng: Rng, mid: string, dark: string, light: string) {
  for (let i = 0; i < 3; i++) {
    const cx = 1 + Math.floor(rng() * (G - 5));
    const cy = 1 + Math.floor(rng() * (G - 5));
    chunk(ctx, rng, cx, cy, 3, dark, mid, light);
  }
}

function paintCrystals(ctx: CanvasRenderingContext2D, rng: Rng, mid: string, dark: string, light: string) {
  for (let i = 0; i < 2; i++) {
    const x = (3 + rng() * (G - 7)) * P;
    const y = (3.5 + rng() * (G - 7)) * P;
    const r = (2.2 + rng() * 1.2) * P;
    // halo lumineux derrière le cristal
    const halo = ctx.createRadialGradient(x, y, 2, x, y, r * 2.1);
    halo.addColorStop(0, mid + '66');
    halo.addColorStop(1, mid + '00');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    // ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + r * 0.85, r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // facette sombre (droite)
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.85, y);
    ctx.lineTo(x, y + r * 0.85);
    ctx.closePath();
    ctx.fill();
    // facette claire (gauche)
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x - r * 0.85, y);
    ctx.lineTo(x, y + r * 0.85);
    ctx.closePath();
    ctx.fill();
    // arête, spéculaire et étincelle
    ctx.fillStyle = light;
    ctx.fillRect(x - 1, y - r, 2, r * 1.8);
    ctx.fillRect(x - r * 0.5, y - r * 0.3, 3, 3);
    sparkle(ctx, x + r * 0.55, y - r * 0.55, 4, '#ffffff');
  }
}
