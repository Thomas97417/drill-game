import { BUILDINGS, TILE, TILES, WORLD_W, type TileKind } from './constants';
import { hash2D } from './rng';
import type { Engine } from './engine';

export function render(e: Engine) {
  const ctx = e.ctx;
  const W = e.viewW;
  const H = e.viewH;
  const camPxX = e.camX * TILE;
  const camPxY = e.camY * TILE;

  drawBackground(ctx, W, H, e.camY, camPxY);
  drawDecor(ctx, camPxX, camPxY, W);
  drawTiles(e, ctx, W, H, camPxX, camPxY);
  drawBuildings(ctx, camPxX, camPxY);
  drawDepthMarkers(ctx, e.camY, H, camPxX, camPxY);
  drawDigOverlay(e, ctx, camPxX, camPxY);
  drawDynamites(e, ctx, camPxX, camPxY);
  drawPlayer(e, ctx, camPxX, camPxY);
  drawParticles(e, ctx, camPxX, camPxY);
}

// ── Dynamites : bâton rouge, mèche qui crépite, clignote avant l'explosion ──

function drawDynamites(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  for (const d of e.dynamites) {
    const px = d.x * TILE - camPxX;
    const py = d.y * TILE - camPxY;
    const blink = d.fuse < 1 && Math.sin(e.time * 35) > 0;
    ctx.fillStyle = blink ? '#ffffff' : '#d63031';
    ctx.fillRect(px - 4, py - 8, 8, 16);
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - 8);
    ctx.quadraticCurveTo(px + 5, py - 14, px + 2, py - 16);
    ctx.stroke();
    // étincelle
    ctx.fillStyle = Math.sin(e.time * 50) > 0 ? '#ffe28a' : '#ff9f43';
    ctx.fillRect(px, py - 18, 4, 4);
  }
}

// ── Fond : ciel au-dessus de y=0, terre sombre en dessous ───────────────────

// Teinte du sous-sol selon la profondeur : brun-noir, puis vert sombre,
// bleu nuit, violet et enfin rouge — toujours assez sombre
const DEPTH_TINTS: { d: number; c: [number, number, number] }[] = [
  { d: 0, c: [48, 32, 18] },
  { d: 80, c: [26, 34, 18] },
  { d: 160, c: [18, 62, 32] },
  { d: 300, c: [18, 38, 86] },
  { d: 460, c: [56, 24, 90] },
  { d: 640, c: [96, 20, 24] },
];

function depthTint(depth: number): [number, number, number] {
  const d = Math.max(0, depth);
  let prev = DEPTH_TINTS[0];
  for (const stop of DEPTH_TINTS) {
    if (d <= stop.d) {
      const t = stop.d === prev.d ? 0 : (d - prev.d) / (stop.d - prev.d);
      return prev.c.map((v, i) => v + (stop.c[i] - v) * t) as [number, number, number];
    }
    prev = stop;
  }
  return prev.c;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camY: number,
  camPxY: number,
) {
  // dégradé entre la teinte de profondeur du haut et du bas de l'écran
  const top = depthTint(camY);
  const bot = depthTint(camY + H / TILE);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(top));
  g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // ciel (zone au-dessus de la ligne de surface)
  const surfaceScreenY = 0 * TILE - camPxY;
  if (surfaceScreenY > 0) {
    const sky = ctx.createLinearGradient(0, surfaceScreenY - H, 0, surfaceScreenY);
    sky.addColorStop(0, '#3f8edc');
    sky.addColorStop(1, '#bfe3ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Math.min(H, surfaceScreenY));
  }
}

// soleil + nuages, en coordonnées monde
function drawDecor(ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number, W: number) {
  const sx = (x: number) => x * TILE - camPxX;
  const sy = (y: number) => y * TILE - camPxY;
  if (sy(0) < 0) return; // surface hors écran

  // soleil
  ctx.fillStyle = '#ffe28a';
  ctx.beginPath();
  ctx.arc(sx(26.5), sy(-6.5), TILE * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // nuages
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy, s] of [
    [5, -6.2, 1],
    [13, -7.4, 0.8],
    [21, -5.6, 1.2],
  ] as const) {
    const px = sx(cx);
    const py = sy(cy);
    ctx.beginPath();
    ctx.ellipse(px, py, TILE * s, TILE * 0.34 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(px + TILE * 0.6 * s, py - TILE * 0.18 * s, TILE * 0.6 * s, TILE * 0.3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void W;
}

// ── Tuiles ───────────────────────────────────────────────────────────────────

function drawTiles(
  e: Engine,
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camPxX: number,
  camPxY: number,
) {
  const x0 = Math.max(0, Math.floor(camPxX / TILE));
  const x1 = Math.min(WORLD_W - 1, Math.ceil((camPxX + W) / TILE));
  const y0 = Math.max(0, Math.floor(camPxY / TILE));
  const y1 = Math.ceil((camPxY + H) / TILE);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const kind = e.world.getTile(x, y);
      if (kind === 'empty') continue;
      drawTile(ctx, kind, x, y, x * TILE - camPxX, y * TILE - camPxY, e.world.getTile(x, y - 1) === 'empty');
    }
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  x: number,
  y: number,
  px: number,
  py: number,
  openAbove: boolean,
) {
  const d = TILES[kind];

  // rocher : bloc arrondi posé sur fond sombre, visuellement « non forable »
  if (kind === 'boulder') {
    ctx.fillStyle = '#241910';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = d.base;
    ctx.beginPath();
    ctx.ellipse(px + TILE / 2, py + TILE / 2 + 2, TILE * 0.46, TILE * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(px + TILE * 0.38, py + TILE * 0.36, TILE * 0.16, TILE * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.speckle;
    for (let i = 0; i < 4; i++) {
      const gx = px + 10 + hash2D(x * 7 + i, y * 13, 61) * (TILE - 24);
      const gy = py + 12 + hash2D(x * 11, y * 17 + i, 67) * (TILE - 26);
      ctx.fillRect(gx, gy, 4, 4);
    }
    return;
  }

  ctx.fillStyle = d.base;
  ctx.fillRect(px, py, TILE, TILE);

  // grains procéduraux
  ctx.fillStyle = d.speckle;
  for (let i = 0; i < 6; i++) {
    const gx = hash2D(x * 7 + i, y * 13 + i, 5) * (TILE - 6);
    const gy = hash2D(x * 11 + i, y * 17 + i, 9) * (TILE - 6);
    const gs = 3 + hash2D(x + i, y - i, 13) * 3;
    ctx.fillRect(px + gx, py + gy, gs, gs);
  }

  // liseré clair sur les bords exposés
  if (openAbove && y > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(px, py, TILE, 4);
  }

  // herbe de surface (pas sur les fondations des bâtiments)
  if (y === 0 && kind !== 'foundation') {
    ctx.fillStyle = '#3f9b3f';
    ctx.fillRect(px, py, TILE, 8);
    ctx.fillStyle = '#55b855';
    for (let i = 0; i < 5; i++) {
      const gx = hash2D(x * 3 + i, 0, 21) * (TILE - 4);
      ctx.fillRect(px + gx, py - 3, 3, 5);
    }
  }

  // minerai incrusté
  if (d.gem) {
    for (let i = 0; i < 4; i++) {
      const gx = px + 7 + hash2D(x * 5 + i, y * 5, 31) * (TILE - 16);
      const gy = py + 7 + hash2D(x * 9, y * 9 + i, 37) * (TILE - 16);
      const r = 3.5 + hash2D(x + i, y + i, 41) * 3.5;
      drawGem(ctx, gx, gy, r, d.gem);
    }
  }
}

function drawGem(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(cx - 1.5, cy - r * 0.55, 2, 2);
}

// ── Bâtiments de surface ─────────────────────────────────────────────────────

function drawBuildings(ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  const sx = (x: number) => x * TILE - camPxX;
  const sy = (y: number) => y * TILE - camPxY;
  if (sy(0) < -TILE * 4) return;
  const groundY = sy(0);

  for (const { id, range } of BUILDINGS) {
    const x = sx(range[0]);
    const w = (range[1] - range[0] + 1) * TILE;

    if (id === 'sell') {
      // ── Comptoir de vente ──
      const h = TILE * 2.2;
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(x, groundY - h, w, h);
      // porte + fenêtre
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(x + w * 0.62, groundY - TILE * 1.3, TILE * 0.8, TILE * 1.3);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(x + w * 0.14, groundY - TILE * 1.5, TILE * 0.9, TILE * 0.7);
      // toit
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(x - 10, groundY - h);
      ctx.lineTo(x + w / 2, groundY - h - TILE * 0.9);
      ctx.lineTo(x + w + 10, groundY - h);
      ctx.closePath();
      ctx.fill();
      drawSign(ctx, x + w / 2, groundY - h + 22, 'VENTE', '#ffd54f');
    } else if (id === 'fuel') {
      // ── Pompe à essence ──
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(x - 6, groundY - TILE * 2.4, w + 12, 14);
      ctx.fillStyle = '#b0b6c2';
      ctx.fillRect(x + 6, groundY - TILE * 2.4 + 14, 6, TILE * 2.4 - 14);
      ctx.fillRect(x + w - 12, groundY - TILE * 2.4 + 14, 6, TILE * 2.4 - 14);
      ctx.fillStyle = '#d63031';
      ctx.fillRect(x + w / 2 - 16, groundY - TILE * 1.4, 32, TILE * 1.4);
      ctx.fillStyle = '#dfe6ee';
      ctx.fillRect(x + w / 2 - 10, groundY - TILE * 1.25, 20, 16);
      drawSign(ctx, x + w / 2, groundY - TILE * 2.4 - 10, 'ESSENCE', '#ff7675');
    } else {
      // ── Atelier (améliorations + réparations) ──
      const h = TILE * 2.4;
      ctx.fillStyle = '#78838f';
      ctx.fillRect(x, groundY - h, w, h);
      // toit plat
      ctx.fillStyle = '#525c66';
      ctx.fillRect(x - 8, groundY - h - 10, w + 16, 12);
      // porte de garage à lamelles
      const dw = w * 0.52;
      const dx = x + w * 0.08;
      ctx.fillStyle = '#3c444d';
      ctx.fillRect(dx, groundY - TILE * 1.6, dw, TILE * 1.6);
      ctx.strokeStyle = '#28303a';
      ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(dx, groundY - (TILE * 1.6 * i) / 5);
        ctx.lineTo(dx + dw, groundY - (TILE * 1.6 * i) / 5);
        ctx.stroke();
      }
      // fenêtre d'atelier
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(x + w * 0.7, groundY - TILE * 1.45, TILE * 0.9, TILE * 0.65);
      drawSign(ctx, x + w / 2, groundY - h + 16, 'ATELIER', '#7fd0ff');
    }
  }
}

function drawSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  textY: number,
  text: string,
  color: string,
) {
  const w = text.length * 11 + 20;
  ctx.fillStyle = '#1d1f27';
  ctx.fillRect(cx - w / 2, textY - 16, w, 22);
  ctx.fillStyle = color;
  ctx.font = 'bold 14px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, textY);
  ctx.textAlign = 'left';
}

// ── Marqueurs de profondeur ──────────────────────────────────────────────────

function drawDepthMarkers(
  ctx: CanvasRenderingContext2D,
  camY: number,
  H: number,
  camPxX: number,
  camPxY: number,
) {
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '12px ui-monospace, monospace';
  const first = Math.max(25, Math.ceil(camY / 25) * 25);
  for (let y = first; y * TILE - camPxY < H + TILE; y += 25) {
    const py = y * TILE - camPxY;
    ctx.fillRect(1 * TILE - camPxX + 4, py, 26, 2);
    ctx.fillText(`-${y} m`, 1 * TILE - camPxX + 34, py + 5);
  }
}

// ── Forage en cours : fissures + barre de progression ────────────────────────

function drawDigOverlay(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  const d = e.digging;
  if (!d) return;
  const px = d.x * TILE - camPxX;
  const py = d.y * TILE - camPxY;
  const t = Math.min(1, d.progress / d.total);

  // fissures
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  const n = Math.floor(t * 7);
  for (let i = 0; i < n; i++) {
    const a = hash2D(d.x * 3 + i, d.y * 7, 51) * Math.PI * 2;
    const len = (0.3 + hash2D(d.x, d.y + i, 57) * 0.45) * TILE * 0.5;
    ctx.beginPath();
    ctx.moveTo(px + TILE / 2, py + TILE / 2);
    ctx.lineTo(px + TILE / 2 + Math.cos(a) * len, py + TILE / 2 + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(0,0,0,${t * 0.35})`;
  ctx.fillRect(px, py, TILE, TILE);

  // barre de progression au-dessus de la foreuse
  const p = e.player;
  const bx = (p.x + p.w / 2) * TILE - camPxX - TILE * 0.45;
  const by = p.y * TILE - camPxY - 12;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx, by, TILE * 0.9, 6);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(bx + 1, by + 1, (TILE * 0.9 - 2) * t, 4);
}

// ── Foreuse ──────────────────────────────────────────────────────────────────

function drawPlayer(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  const p = e.player;
  const w = p.w * TILE;
  const h = p.h * TILE;
  let px = p.x * TILE - camPxX;
  let py = p.y * TILE - camPxY;

  // vibration pendant le forage
  if (e.digging) {
    px += Math.sin(e.time * 70) * 1.4;
    py += Math.cos(e.time * 90) * 1.1;
  }

  const dir: 'left' | 'right' | 'down' = e.digging ? e.digging.dir : p.facing > 0 ? 'right' : 'left';

  ctx.save();
  ctx.translate(px + w / 2, py + h / 2);

  // flamme du jetpack
  if (p.flying) {
    const f = 0.6 + Math.sin(e.time * 40) * 0.25;
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, h / 2);
    ctx.lineTo(0, h / 2 + h * 0.6 * f);
    ctx.lineTo(w * 0.22, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe28a';
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, h / 2);
    ctx.lineTo(0, h / 2 + h * 0.32 * f);
    ctx.lineTo(w * 0.1, h / 2);
    ctx.closePath();
    ctx.fill();
  }

  // chenilles
  ctx.fillStyle = '#33363f';
  roundRect(ctx, -w / 2, h * 0.22, w, h * 0.28, 5);
  ctx.fillStyle = '#5a5e6b';
  for (const wx of [-w * 0.3, 0, w * 0.3]) {
    ctx.beginPath();
    ctx.arc(wx, h * 0.36, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // carrosserie
  ctx.fillStyle = '#c0492f';
  roundRect(ctx, -w / 2, -h * 0.3, w, h * 0.55, 6);
  ctx.fillStyle = '#e2603f';
  roundRect(ctx, -w / 2, -h * 0.3, w, h * 0.18, 6);

  // cockpit
  ctx.fillStyle = '#a6dcff';
  ctx.beginPath();
  ctx.arc(dir === 'left' ? -w * 0.12 : w * 0.12, -h * 0.28, w * 0.24, Math.PI, 0);
  ctx.fill();

  // trépan
  ctx.fillStyle = '#cfd4dd';
  ctx.beginPath();
  if (dir === 'down') {
    ctx.moveTo(-w * 0.22, h * 0.34);
    ctx.lineTo(w * 0.22, h * 0.34);
    ctx.lineTo(0, h * 0.34 + w * 0.42);
  } else {
    const s = dir === 'right' ? 1 : -1;
    ctx.moveTo(s * w * 0.42, -h * 0.18);
    ctx.lineTo(s * w * 0.42, h * 0.18);
    ctx.lineTo(s * (w * 0.42 + w * 0.4), 0);
  }
  ctx.closePath();
  ctx.fill();
  // stries du trépan
  ctx.strokeStyle = '#8d93a1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (dir === 'down') {
    ctx.moveTo(-w * 0.1, h * 0.42);
    ctx.lineTo(w * 0.1, h * 0.46);
  } else {
    const s = dir === 'right' ? 1 : -1;
    ctx.moveTo(s * w * 0.48, -h * 0.08);
    ctx.lineTo(s * w * 0.56, h * 0.04);
  }
  ctx.stroke();

  ctx.restore();
}

// ── Particules ───────────────────────────────────────────────────────────────

function drawParticles(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  for (const pt of e.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x * TILE - camPxX - 2, pt.y * TILE - camPxY - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function rgb(c: [number, number, number]): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}
