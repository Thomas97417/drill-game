import { BUILDINGS, DAY_CYCLE, FLOATER_LIFE, TILE, TILES, WORLD_W } from './constants';
import { getPlanet, type PlanetTheme } from './planets';
import { hash2D } from './rng';
import { drawTileSprite } from './tileart';
import { useGameStore } from '../store';
import type { Engine } from './engine';

// Thème de la planète active (palettes ciel/profondeur/collines/surface) :
// posé par l'engine à la construction et à chaque changement de planète, pour
// éviter une lecture du store à chaque frame.
let activeTheme: PlanetTheme = getPlanet('xk712').theme;
export function setActiveTheme(t: PlanetTheme) {
  activeTheme = t;
}

export function render(e: Engine) {
  const ctx = e.ctx;
  const W = e.viewW;
  const H = e.viewH;
  const camPxX = e.camX * TILE;
  const camPxY = e.camY * TILE;
  const day = dayState(e.time);

  drawBackground(ctx, W, H, e.camY);
  drawDecor(e, ctx, camPxX, camPxY, W, day);
  drawTiles(e, ctx, W, H, camPxX, camPxY);
  drawBuildings(ctx, camPxX, camPxY, day);
  drawRocket(e, ctx, camPxX, camPxY);
  drawDigOverlay(e, ctx, camPxX, camPxY);
  drawDynamites(e, ctx, camPxX, camPxY);
  drawPlayer(e, ctx, camPxX, camPxY);
  drawParticles(e, ctx, camPxX, camPxY);
  drawFlashes(e, ctx, camPxX, camPxY);
  drawLight(e, ctx, W, H, camPxX, camPxY, day);
  drawFloaters(e, ctx, camPxX, camPxY);
  drawDepthMarkers(ctx, e.camY, H, camPxX, camPxY);
}

// ── Textes flottants : nom du minerai récolté, qui monte et s'estompe ────────

function drawFloaters(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  if (e.floaters.length === 0) return;
  ctx.font = 'bold 14px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  for (const f of e.floaters) {
    const t = f.age / FLOATER_LIFE;
    const px = f.x * TILE - camPxX;
    const py = (f.y - t * 0.8) * TILE - camPxY;
    ctx.globalAlpha = 1 - t * t;
    ctx.strokeText(f.text, px, py);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, px, py);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ── Cycle jour/nuit ──────────────────────────────────────────────────────────

interface DayState {
  h: number; // hauteur du soleil [-1, 1] (négatif = nuit)
  dl: number; // lumière du jour [0, 1]
  sunset: number; // intensité aube/crépuscule [0, 1]
  u: number; // progression du jour [0, 1]
  v: number; // progression de la nuit [0, 1]
}

function dayState(time: number): DayState {
  const t = (time % DAY_CYCLE) / DAY_CYCLE;
  const h = Math.sin(t * Math.PI * 2);
  const dl = Math.max(0, Math.min(1, (h + 0.12) / 0.45));
  const sunset = Math.max(0, Math.min(1, 1 - Math.abs(h) / 0.28));
  return { h, dl, sunset, u: t / 0.5, v: (t - 0.5) / 0.5 };
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ── Fond : ciel au-dessus de y=0, terre teintée selon la profondeur ──────────

function depthTint(depth: number): [number, number, number] {
  const tints = activeTheme.depthTints;
  const d = Math.max(0, depth);
  let prev = tints[0];
  for (const stop of tints) {
    if (d <= stop.d) {
      const t = stop.d === prev.d ? 0 : (d - prev.d) / (stop.d - prev.d);
      return prev.c.map((v, i) => v + (stop.c[i] - v) * t) as [number, number, number];
    }
    prev = stop;
  }
  return prev.c;
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, camY: number) {
  const top = depthTint(camY);
  const bot = depthTint(camY + H / TILE);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(top));
  g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ── Décor de surface : ciel, soleil, nuages, collines en parallaxe ───────────

// position sur l'arc céleste (départ à gauche, zénith au centre, coucher à droite)
function skyArc(progress: number): { x: number; y: number } {
  return {
    x: 1.5 + progress * (WORLD_W - 3),
    y: -1.2 - Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * 7.5,
  };
}

function drawDecor(
  e: Engine,
  ctx: CanvasRenderingContext2D,
  camPxX: number,
  camPxY: number,
  W: number,
  day: DayState,
) {
  const surfaceY = 0 * TILE - camPxY;
  if (surfaceY <= 0) return; // surface hors écran
  const { dl, sunset } = day;

  // ciel interpolé jour ↔ nuit, teinté à l'aube/au crépuscule (palette planète)
  const sk = activeTheme.sky;
  const top = mix(mix(sk.nightTop, sk.dayTop, dl), sk.sunsetTop, sunset * 0.45);
  const mid = mix(mix(sk.nightMid, sk.dayMid, dl), sk.sunsetMid, sunset * 0.55);
  const bot = mix(mix(sk.nightBot, sk.dayBot, dl), sk.sunsetBot, sunset * 0.7);
  const sky = ctx.createLinearGradient(0, surfaceY - TILE * 14, 0, surfaceY);
  sky.addColorStop(0, rgb(top));
  sky.addColorStop(0.55, rgb(mid));
  sky.addColorStop(1, rgb(bot));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, Math.min(e.viewH, surfaceY));

  // étoiles (visibles quand la lumière baisse)
  if (dl < 0.6) {
    const starAlpha = (1 - dl / 0.6) * 0.9;
    for (let i = 0; i < 70; i++) {
      const sx = hash2D(i, 3, 211) * W;
      const sy = hash2D(i, 7, 223) * Math.min(surfaceY - 16, e.viewH);
      const tw = 0.5 + 0.5 * Math.sin(e.time * (1 + hash2D(i, 11, 227) * 2) + i);
      ctx.fillStyle = `rgba(235,240,255,${starAlpha * (0.35 + 0.65 * tw)})`;
      const s = hash2D(i, 13, 229) < 0.85 ? 2 : 3;
      ctx.fillRect(sx, sy, s, s);
    }
  }

  // aurores boréales (planète gelée) — surtout marquées quand la nuit tombe
  if (activeTheme.decor === 'frost') {
    drawAurora(ctx, e, W, surfaceY, Math.max(0, 1 - dl * 1.25));
  }

  // soleil sur son arc
  if (day.u >= -0.06 && day.u <= 1.06) {
    const pos = skyArc(day.u);
    const sunX = pos.x * TILE - camPxX;
    const sunY = pos.y * TILE - camPxY;
    const warm = sunset > 0.4; // gros soleil orangé près de l'horizon
    const halo = ctx.createRadialGradient(sunX, sunY, TILE * 0.3, sunX, sunY, TILE * 2.8);
    halo.addColorStop(0, warm ? 'rgba(255,170,90,0.9)' : 'rgba(255,236,170,0.9)');
    halo.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - TILE * 3, sunY - TILE * 3, TILE * 6, TILE * 6);
    ctx.fillStyle = warm ? '#ffb45e' : '#ffe28a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, TILE * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = warm ? '#ffd9a0' : '#fff3c4';
    ctx.beginPath();
    ctx.arc(sunX - TILE * 0.15, sunY - TILE * 0.15, TILE * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // lune sur le même arc, pendant la nuit
  if (day.v >= -0.06 && day.v <= 1.06) {
    const pos = skyArc(day.v);
    const mX = pos.x * TILE - camPxX;
    const mY = pos.y * TILE - camPxY;
    const glow = ctx.createRadialGradient(mX, mY, TILE * 0.2, mX, mY, TILE * 2);
    glow.addColorStop(0, 'rgba(210,220,255,0.45)');
    glow.addColorStop(1, 'rgba(210,220,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mX - TILE * 2.2, mY - TILE * 2.2, TILE * 4.4, TILE * 4.4);
    ctx.fillStyle = '#e8eaf2';
    ctx.beginPath();
    ctx.arc(mX, mY, TILE * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // cratères
    ctx.fillStyle = '#c3c8d8';
    for (const [dx, dy, r] of [
      [-0.18, -0.1, 0.13],
      [0.16, 0.12, 0.1],
      [0.05, -0.25, 0.07],
    ] as const) {
      ctx.beginPath();
      ctx.arc(mX + dx * TILE, mY + dy * TILE, r * TILE, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // relief lointain, assombri la nuit : collines tempérées ou pics glacés
  const hn = activeTheme.hillsNear;
  const hf = activeTheme.hillsFar;
  if (activeTheme.decor === 'frost') {
    drawIcePeaks(ctx, camPxX * 0.25, surfaceY, W, rgb(mix(hn.night, hn.day, dl)), 3, 0);
    drawIcePeaks(ctx, camPxX * 0.5, surfaceY, W, rgb(mix(hf.night, hf.day, dl)), 2, 40);
    drawBlizzard(ctx, e, W, surfaceY);
    return;
  }
  drawHills(ctx, camPxX * 0.25, surfaceY, W, rgb(mix(hn.night, hn.day, dl)), 2.6, 0);
  drawHills(ctx, camPxX * 0.5, surfaceY, W, rgb(mix(hf.night, hf.day, dl)), 1.7, 40);

  // nuages dérivants (ternis la nuit)
  const cl = mix(activeTheme.cloudNight, activeTheme.cloudDay, dl);
  ctx.fillStyle = `rgba(${Math.round(cl[0])},${Math.round(cl[1])},${Math.round(cl[2])},${0.35 + dl * 0.5})`;
  for (const [base, cy, s, speed] of [
    [4, -6.4, 1, 0.18],
    [13, -7.6, 0.8, 0.12],
    [22, -5.4, 1.25, 0.22],
  ] as const) {
    const span = (WORLD_W + 14) * TILE;
    const px = ((((base * TILE + e.time * speed * TILE) % span) + span) % span) - 7 * TILE - camPxX * 0.7;
    const py = cy * TILE - camPxY;
    ctx.beginPath();
    ctx.ellipse(px, py, TILE * s, TILE * 0.32 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(px + TILE * 0.62 * s, py - TILE * 0.2 * s, TILE * 0.62 * s, TILE * 0.28 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(px - TILE * 0.55 * s, py - TILE * 0.1 * s, TILE * 0.5 * s, TILE * 0.24 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Aurores boréales : rubans ondulants additifs (vert/cyan/violet) + stries verticales
function drawAurora(
  ctx: CanvasRenderingContext2D,
  e: Engine,
  W: number,
  surfaceY: number,
  intensity: number,
) {
  if (intensity <= 0.02) return;
  const topBase = Math.max(0, surfaceY - TILE * 13);
  const cols: [number, number, number][] = [
    [60, 235, 150],
    [70, 190, 255],
    [165, 110, 255],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 3; b++) {
    const [r, g0, bl] = cols[b];
    const baseY = topBase + b * TILE * 1.3 + Math.sin(e.time * 0.3 + b) * 8;
    const amp = 14 + b * 7;
    const speed = 0.45 + b * 0.13;
    const bandH = TILE * (2.8 + b * 0.6);
    const a = intensity * (0.3 - b * 0.05);
    const grad = ctx.createLinearGradient(0, baseY - amp, 0, baseY + bandH);
    grad.addColorStop(0, `rgba(${r},${g0},${bl},0)`);
    grad.addColorStop(0.35, `rgba(${r},${g0},${bl},${a})`);
    grad.addColorStop(1, `rgba(${r},${g0},${bl},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 14) {
      const y =
        baseY +
        Math.sin(x * 0.011 + e.time * speed + b) * amp +
        Math.sin(x * 0.004 - e.time * speed * 0.6) * amp * 0.5;
      ctx.lineTo(x, y);
    }
    for (let x = W; x >= 0; x -= 14) {
      ctx.lineTo(x, baseY + bandH + Math.sin(x * 0.009 + e.time * speed * 0.8 + b) * amp);
    }
    ctx.closePath();
    ctx.fill();
  }
  // fines stries verticales : effet « rideau »
  for (let i = 0; i < 20; i++) {
    const [r, g0, bl] = cols[i % 3];
    const x = (i / 20) * W + Math.sin(e.time * 0.2 + i) * 6;
    const h = TILE * (1.6 + hash2D(i, 1, 61) * 2.2);
    const yy = topBase + Math.sin(x * 0.011 + e.time * 0.5) * 14;
    const grad = ctx.createLinearGradient(0, yy, 0, yy + h);
    grad.addColorStop(0, `rgba(${r},${g0},${bl},${intensity * 0.2})`);
    grad.addColorStop(1, `rgba(${r},${g0},${bl},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, yy, 3, h);
  }
  ctx.restore();
}

// Pics glacés acérés à calotte neigeuse (remplacent les collines, en parallaxe)
function drawIcePeaks(
  ctx: CanvasRenderingContext2D,
  scrollPx: number,
  surfaceY: number,
  W: number,
  color: string,
  height: number,
  seed: number,
) {
  const step = TILE * 2.4;
  const peakAt = (px: number) => {
    const i = Math.floor((px + scrollPx) / step);
    const h = (0.45 + hash2D(i, seed, 91) * 0.55) * height * TILE;
    const base = px - (((scrollPx % step) + step) % step);
    return { base, peakX: base + step / 2, h };
  };
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-step, surfaceY);
  for (let px = -step; px <= W + step; px += step) {
    const { base, peakX, h } = peakAt(px);
    ctx.lineTo(base, surfaceY);
    ctx.lineTo(peakX, surfaceY - h);
  }
  ctx.lineTo(W + step, surfaceY);
  ctx.closePath();
  ctx.fill();
  // calottes neigeuses sur les sommets
  ctx.fillStyle = 'rgba(238,245,252,0.92)';
  for (let px = -step; px <= W + step; px += step) {
    const { peakX, h } = peakAt(px);
    const capW = h * 0.16;
    const capH = h * 0.22;
    ctx.beginPath();
    ctx.moveTo(peakX - capW, surfaceY - h + capH);
    ctx.lineTo(peakX, surfaceY - h);
    ctx.lineTo(peakX + capW, surfaceY - h + capH);
    ctx.closePath();
    ctx.fill();
  }
}

// Blizzard : stries de neige soufflées horizontalement par le vent
function drawBlizzard(
  ctx: CanvasRenderingContext2D,
  e: Engine,
  W: number,
  surfaceY: number,
) {
  const H = Math.min(surfaceY, e.viewH);
  const span = W + 260;
  for (let i = 0; i < 26; i++) {
    const speed = 220 + (i % 4) * 90;
    const x = span - ((((e.time * speed + i * 137) % span) + span) % span);
    const y = hash2D(i, 2, 41) * H;
    const len = 24 + hash2D(i, 3, 47) * 50;
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + hash2D(i, 4, 53) * 0.07})`;
    ctx.lineWidth = 1 + hash2D(i, 5, 59) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + len * 0.18);
    ctx.stroke();
  }
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  scrollPx: number,
  surfaceY: number,
  W: number,
  color: string,
  height: number,
  seed: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, surfaceY);
  const step = TILE * 3;
  for (let px = -step; px <= W + step; px += step) {
    const i = Math.floor((px + scrollPx) / step);
    const h = (0.5 + hash2D(i, seed, 91) * 0.5) * height * TILE;
    ctx.lineTo(px - ((scrollPx % step) + step) % step + step / 2, surfaceY - h);
    ctx.lineTo(px - ((scrollPx % step) + step) % step + step, surfaceY - h * 0.25);
  }
  ctx.lineTo(W + step, surfaceY);
  ctx.closePath();
  ctx.fill();
}

// ── Tuiles : sprites de l'atlas + relief dynamique ───────────────────────────

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
      const px = x * TILE - camPxX;
      const py = y * TILE - camPxY;

      if (kind === 'empty') {
        // texture discrète de paroi dans les cavités
        if (y >= 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          for (let i = 0; i < 2; i++) {
            const gx = hash2D(x * 3 + i, y * 5, 101) * (TILE - 10);
            const gy = hash2D(x * 7, y * 11 + i, 103) * (TILE - 10);
            ctx.fillRect(px + gx, py + gy, 8, 6);
          }
        }
        continue;
      }

      drawTileSprite(ctx, kind, x, y, px, py);

      // les gemmes de valeur scintillent pour attirer l'œil
      if ((TILES[kind].value ?? 0) >= 5000) {
        const phase = hash2D(x, y, 401) * Math.PI * 2;
        const tw = Math.max(0, Math.sin(e.time * 2.2 + phase));
        if (tw > 0.55) {
          const sx = px + 8 + hash2D(x, y, 409) * (TILE - 16);
          const sy = py + 8 + hash2D(x, y, 419) * (TILE - 16);
          const a = (tw - 0.55) / 0.45;
          ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
          ctx.fillRect(sx - 4, sy - 1, 8, 2);
          ctx.fillRect(sx - 1, sy - 4, 2, 8);
        }
      }

      // l'amazonite irradie d'une aura turquoise pulsante (mode additif)
      if (kind === 'amazonite') {
        const pulse = 0.5 + 0.5 * Math.sin(e.time * 3.2 + (x * 11 + y * 7) * 0.5);
        const g = ctx.createRadialGradient(
          px + TILE / 2, py + TILE / 2, 4,
          px + TILE / 2, py + TILE / 2, TILE * 1.1,
        );
        g.addColorStop(0, `rgba(52,241,197,${0.16 + 0.14 * pulse})`);
        g.addColorStop(1, 'rgba(52,241,197,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(px - TILE * 0.6, py - TILE * 0.6, TILE * 2.2, TILE * 2.2);
        ctx.globalCompositeOperation = 'source-over';
      }

      // l'aurorium irradie une aura aurore (vert-violet) pulsante (additif)
      if (kind === 'aurorium') {
        const pulse = 0.5 + 0.5 * Math.sin(e.time * 3.2 + (x * 11 + y * 7) * 0.5);
        const g = ctx.createRadialGradient(
          px + TILE / 2, py + TILE / 2, 4,
          px + TILE / 2, py + TILE / 2, TILE * 1.1,
        );
        g.addColorStop(0, `rgba(92,255,208,${0.16 + 0.14 * pulse})`);
        g.addColorStop(1, 'rgba(92,255,208,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(px - TILE * 0.6, py - TILE * 0.6, TILE * 2.2, TILE * 2.2);
        ctx.globalCompositeOperation = 'source-over';
      }

      // la lave palpite et irradie
      if (kind === 'lava') {
        const pulse = 0.5 + 0.5 * Math.sin(e.time * 2.6 + (x * 7 + y * 13) * 0.7);
        ctx.fillStyle = `rgba(255,220,120,${0.05 + 0.12 * pulse})`;
        ctx.fillRect(px, py, TILE, TILE);
        const g = ctx.createRadialGradient(
          px + TILE / 2, py + TILE / 2, TILE * 0.3,
          px + TILE / 2, py + TILE / 2, TILE * 1.1,
        );
        g.addColorStop(0, `rgba(255,120,45,${0.1 + 0.1 * pulse})`);
        g.addColorStop(1, 'rgba(255,120,45,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - TILE * 0.6, py - TILE * 0.6, TILE * 2.2, TILE * 2.2);
      }

      // la poche de froid scintille et diffuse une aura glaciale
      if (kind === 'cold') {
        const pulse = 0.5 + 0.5 * Math.sin(e.time * 2.6 + (x * 7 + y * 13) * 0.7);
        ctx.fillStyle = `rgba(210,240,255,${0.05 + 0.12 * pulse})`;
        ctx.fillRect(px, py, TILE, TILE);
        const g = ctx.createRadialGradient(
          px + TILE / 2, py + TILE / 2, TILE * 0.3,
          px + TILE / 2, py + TILE / 2, TILE * 1.1,
        );
        g.addColorStop(0, `rgba(120,200,255,${0.1 + 0.1 * pulse})`);
        g.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - TILE * 0.6, py - TILE * 0.6, TILE * 2.2, TILE * 2.2);
      }

      // relief selon les voisins (pas pour les rochers, déjà détourés)
      if (kind !== 'boulder' && kind !== 'iceboulder') {
        const openAbove = e.world.getTile(x, y - 1) === 'empty' && y > 0;
        const openBelow = e.world.getTile(x, y + 1) === 'empty';
        const openLeft = e.world.getTile(x - 1, y) === 'empty';
        const openRight = e.world.getTile(x + 1, y) === 'empty';
        if (openAbove) {
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(px, py, TILE, 3);
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(px, py + 3, TILE, 3);
        }
        if (openBelow) {
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(px, py + TILE - 4, TILE, 4);
        }
        if (openLeft) {
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(px, py, 3, TILE);
        }
        if (openRight) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(px + TILE - 3, py, 3, TILE);
        }
      }

      // décor de surface : herbe (XK-712) ou neige (planète gelée)
      if (y === 0 && kind === 'dirt') drawGrass(ctx, x, px, py);
      else if (y === 0 && kind === 'snow') drawSnowCap(ctx, x, px, py);
    }
  }
}

function drawSnowCap(ctx: CanvasRenderingContext2D, x: number, px: number, py: number) {
  const g = ctx.createLinearGradient(0, py, 0, py + 12);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#d2e2f0');
  ctx.fillStyle = g;
  ctx.fillRect(px, py, TILE, 11);
  // ourlet bleuté à la base de la couche de neige
  ctx.fillStyle = '#b6cde0';
  ctx.fillRect(px, py + 10, TILE, 3);
  // petites bosses de neige soufflée
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const bx = hash2D(x * 5 + i, 1, 23) * (TILE - 8);
    const bw = 5 + hash2D(x * 3, i, 29) * 6;
    ctx.beginPath();
    ctx.ellipse(px + bx + bw / 2, py + 1, bw / 2, 4, 0, Math.PI, 0);
    ctx.fill();
  }
  // éclat de glace occasionnel
  if (hash2D(x, 9, 31) < 0.16) {
    const fx = px + 6 + hash2D(x, 13, 37) * (TILE - 14);
    ctx.fillStyle = '#9fd4ee';
    ctx.fillRect(fx, py - 5, 2, 6);
    ctx.fillRect(fx - 2, py - 3, 6, 2);
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, x: number, px: number, py: number) {
  const g = ctx.createLinearGradient(0, py, 0, py + 12);
  g.addColorStop(0, '#54a847');
  g.addColorStop(1, '#3a7c33');
  ctx.fillStyle = g;
  ctx.fillRect(px, py, TILE, 12);
  ctx.fillStyle = '#2e6629';
  ctx.fillRect(px, py + 10, TILE, 3);
  // brins multi-tons
  for (let i = 0; i < 7; i++) {
    const gx = hash2D(x * 5 + i, 0, 23) * (TILE - 4);
    const h = 4 + hash2D(x * 3, i, 29) * 6;
    ctx.fillStyle = i % 2 ? '#6cc55c' : '#4a9b3e';
    ctx.fillRect(px + gx, py - h, 3, h + 2);
  }
  // petite fleur occasionnelle
  if (hash2D(x, 9, 31) < 0.18) {
    const fx = px + 6 + hash2D(x, 13, 37) * (TILE - 14);
    ctx.fillStyle = '#e84f6b';
    ctx.fillRect(fx, py - 9, 4, 4);
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(fx + 1, py - 8, 2, 2);
  }
}

// ── Bâtiments de surface ─────────────────────────────────────────────────────

// Couche de neige bosselée posée sur une arête horizontale (base à y, bosses
// au-dessus) — utilisée pour enneiger toits et auvents sur la planète gelée
function snowCap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = '#f4f9ff';
  ctx.beginPath();
  ctx.moveTo(x, y + 3);
  let bx = x;
  while (bx < x + w) {
    const nx = Math.min(bx + 13, x + w);
    const peak = 4 + hash2D(Math.round(bx), 7, 71) * 5;
    ctx.quadraticCurveTo((bx + nx) / 2, y - peak, nx, y);
    bx = nx;
  }
  ctx.lineTo(x + w, y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(180,205,228,0.6)';
  ctx.fillRect(x, y + 1, w, 2);
}

// Stalactites de glace sous une corniche
function icicles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = 'rgba(222,240,255,0.92)';
  const n = Math.max(2, Math.floor(w / 20));
  for (let i = 0; i < n; i++) {
    const ix = x + 8 + (w - 14) * (i / Math.max(1, n - 1)) + hash2D(i, 3, 73) * 3;
    const len = 5 + hash2D(i, 5, 79) * 9;
    ctx.beginPath();
    ctx.moveTo(ix - 3, y);
    ctx.lineTo(ix + 3, y);
    ctx.lineTo(ix, y + len);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBuildings(
  ctx: CanvasRenderingContext2D,
  camPxX: number,
  camPxY: number,
  day: DayState,
) {
  const sx = (x: number) => x * TILE - camPxX;
  const sy = (y: number) => y * TILE - camPxY;
  if (sy(0) < -TILE * 4) return;
  const groundY = sy(0);
  const snowy = activeTheme.surface === 'snow';

  // petits props
  drawLampPost(ctx, sx(7) - 8, groundY, day.dl);
  drawCrates(ctx, sx(19) - 4, groundY);

  for (const { id, range } of BUILDINGS) {
    const x = sx(range[0]);
    const w = (range[1] - range[0] + 1) * TILE;

    if (id === 'sell') {
      const h = TILE * 2.2;
      // murs en planches
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(x, groundY - h, w, h);
      ctx.fillStyle = 'rgba(62,44,38,0.5)';
      for (let py = groundY - h + 10; py < groundY; py += 12) ctx.fillRect(x, py, w, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x, groundY - h, w, 6);
      // porte
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(x + w * 0.62, groundY - TILE * 1.3, TILE * 0.8, TILE * 1.3);
      ctx.fillStyle = '#2f1f1b';
      ctx.fillRect(x + w * 0.62 + 4, groundY - TILE * 1.3 + 4, TILE * 0.8 - 8, TILE * 1.3 - 4);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(x + w * 0.62 + TILE * 0.6, groundY - TILE * 0.7, 5, 5);
      // fenêtre éclairée à croisillons
      ctx.fillStyle = '#3a2a25';
      ctx.fillRect(x + w * 0.12, groundY - TILE * 1.55, TILE * 1.0, TILE * 0.8);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(x + w * 0.12 + 4, groundY - TILE * 1.55 + 4, TILE * 1.0 - 8, TILE * 0.8 - 8);
      ctx.fillStyle = '#3a2a25';
      ctx.fillRect(x + w * 0.12 + TILE * 0.48, groundY - TILE * 1.55, 4, TILE * 0.8);
      ctx.fillRect(x + w * 0.12, groundY - TILE * 1.18, TILE * 1.0, 4);
      // toit en bardeaux + cheminée
      ctx.fillStyle = '#b03226';
      ctx.beginPath();
      ctx.moveTo(x - 12, groundY - h);
      ctx.lineTo(x + w / 2, groundY - h - TILE * 0.95);
      ctx.lineTo(x + w + 12, groundY - h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,18,12,0.5)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(x - 12 + (w / 2 + 12) * t, groundY - h - TILE * 0.95 * t);
        ctx.lineTo(x + w + 12 - (w / 2 + 12) * t, groundY - h - TILE * 0.95 * t);
        ctx.stroke();
      }
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(x + w * 0.72, groundY - h - TILE * 0.78, 12, TILE * 0.5);
      // neige sur le toit + stalactites sous la corniche (planète gelée)
      if (snowy) {
        ctx.strokeStyle = '#f4f9ff';
        ctx.lineWidth = 7;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 11, groundY - h - 3);
        ctx.lineTo(x + w / 2, groundY - h - TILE * 0.95 - 3);
        ctx.lineTo(x + w + 11, groundY - h - 3);
        ctx.stroke();
        icicles(ctx, x, groundY - h, w);
      }
      drawSign(ctx, x + w / 2, groundY - h + 24, 'VENTE', '#ffd54f');
    } else if (id === 'fuel') {
      // auvent rayé
      const roofY = groundY - TILE * 2.4;
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(x - 8, roofY, w + 16, 16);
      ctx.fillStyle = '#f5f5f0';
      for (let px = x - 8; px < x + w + 8; px += 24) ctx.fillRect(px, roofY, 12, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 8, roofY + 14, w + 16, 3);
      // poteaux
      ctx.fillStyle = '#9aa3af';
      ctx.fillRect(x + 8, roofY + 16, 7, groundY - roofY - 16);
      ctx.fillRect(x + w - 15, roofY + 16, 7, groundY - roofY - 16);
      ctx.fillStyle = '#c8cfd8';
      ctx.fillRect(x + 8, roofY + 16, 2, groundY - roofY - 16);
      ctx.fillRect(x + w - 15, roofY + 16, 2, groundY - roofY - 16);
      // pompe + écran + flexible
      const pumpX = x + w / 2 - 18;
      ctx.fillStyle = '#9e2622';
      ctx.fillRect(pumpX, groundY - TILE * 1.5, 36, TILE * 1.5);
      ctx.fillStyle = '#d63031';
      ctx.fillRect(pumpX + 3, groundY - TILE * 1.5 + 3, 30, TILE * 1.5 - 3);
      ctx.fillStyle = '#1d2530';
      ctx.fillRect(pumpX + 7, groundY - TILE * 1.35, 22, 16);
      ctx.fillStyle = '#7fe7a0';
      ctx.fillRect(pumpX + 9, groundY - TILE * 1.35 + 2, 18, 5);
      ctx.strokeStyle = '#2c2c34';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pumpX + 36, groundY - TILE * 1.1);
      ctx.quadraticCurveTo(pumpX + 56, groundY - TILE * 0.9, pumpX + 50, groundY - TILE * 0.45);
      ctx.stroke();
      ctx.fillStyle = '#2c2c34';
      ctx.fillRect(pumpX + 46, groundY - TILE * 0.5, 8, 10);
      // tache d'huile
      ctx.fillStyle = 'rgba(30,30,40,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.3, groundY - 3, 20, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // neige sur l'auvent + stalactites (planète gelée)
      if (snowy) {
        snowCap(ctx, x - 8, roofY, w + 16);
        icicles(ctx, x - 8, roofY + 17, w + 16);
      }
      drawSign(ctx, x + w / 2, roofY - 12, 'ESSENCE', '#ff7675');
    } else {
      // atelier en béton
      const h = TILE * 2.4;
      ctx.fillStyle = '#78838f';
      ctx.fillRect(x, groundY - h, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, groundY - h, w, 8);
      ctx.fillStyle = 'rgba(40,48,58,0.35)';
      ctx.fillRect(x, groundY - h + TILE, w, 2);
      // toit plat + rivets
      ctx.fillStyle = '#525c66';
      ctx.fillRect(x - 10, groundY - h - 12, w + 20, 14);
      ctx.fillStyle = '#8d99a6';
      for (let px = x - 4; px < x + w + 4; px += 18) ctx.fillRect(px, groundY - h - 8, 4, 4);
      // porte de garage à lamelles
      const dw = w * 0.52;
      const dx = x + w * 0.08;
      ctx.fillStyle = '#2c333c';
      ctx.fillRect(dx - 3, groundY - TILE * 1.65, dw + 6, TILE * 1.65);
      ctx.fillStyle = '#3c444d';
      ctx.fillRect(dx, groundY - TILE * 1.6, dw, TILE * 1.6);
      ctx.strokeStyle = '#28303a';
      ctx.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(dx, groundY - (TILE * 1.6 * i) / 6);
        ctx.lineTo(dx + dw, groundY - (TILE * 1.6 * i) / 6);
        ctx.stroke();
      }
      ctx.fillStyle = '#5a626c';
      ctx.fillRect(dx + dw / 2 - 10, groundY - 14, 20, 5);
      // fenêtre d'atelier
      ctx.fillStyle = '#2c333c';
      ctx.fillRect(x + w * 0.68, groundY - TILE * 1.5, TILE * 1.0, TILE * 0.7);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(x + w * 0.68 + 4, groundY - TILE * 1.5 + 4, TILE * 1.0 - 8, TILE * 0.7 - 8);
      ctx.fillStyle = '#2c333c';
      ctx.fillRect(x + w * 0.68 + TILE * 0.48, groundY - TILE * 1.5, 4, TILE * 0.7);
      // bouche d'aération
      ctx.fillStyle = '#454e58';
      ctx.fillRect(x + w * 0.7, groundY - h + 14, 26, 14);
      ctx.fillStyle = '#28303a';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + w * 0.7 + 3, groundY - h + 17 + i * 4, 20, 2);
      // neige sur le toit plat + stalactites (planète gelée)
      if (snowy) {
        snowCap(ctx, x - 10, groundY - h - 12, w + 20);
        icicles(ctx, x - 10, groundY - h + 2, w + 20);
      }
      drawSign(ctx, x + w / 2, groundY - h + 18, 'ATELIER', '#7fd0ff');
    }
  }
}

function drawLampPost(ctx: CanvasRenderingContext2D, x: number, groundY: number, dl: number) {
  // halo nocturne
  if (dl < 0.7) {
    const lx = x + 16;
    const ly = groundY - TILE * 1.9 + 8;
    const g = ctx.createRadialGradient(lx, ly, 3, lx, ly, TILE * 1.6);
    g.addColorStop(0, `rgba(255,233,168,${(1 - dl / 0.7) * 0.45})`);
    g.addColorStop(1, 'rgba(255,233,168,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - TILE * 1.8, ly - TILE * 1.8, TILE * 3.6, TILE * 3.6);
  }
  ctx.fillStyle = '#3c444d';
  ctx.fillRect(x, groundY - TILE * 1.9, 5, TILE * 1.9);
  ctx.fillRect(x - 2, groundY - 6, 9, 6);
  ctx.fillRect(x, groundY - TILE * 1.9, 16, 4);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x + 16, groundY - TILE * 1.9 + 8, 5, 0, Math.PI * 2);
  ctx.fill();
  // capuchon de neige sur la traverse (planète gelée)
  if (activeTheme.surface === 'snow') snowCap(ctx, x - 1, groundY - TILE * 1.9, 18);
}

function drawCrates(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  const snowy = activeTheme.surface === 'snow';
  for (const [dx, dy, s] of [
    [0, 0, 22],
    [24, 0, 18],
    [8, -22, 18],
  ] as const) {
    ctx.fillStyle = '#9c7440';
    ctx.fillRect(x + dx, groundY - s + dy, s, s);
    ctx.strokeStyle = '#6e4a20';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + dx + 1, groundY - s + dy + 1, s - 2, s - 2);
    ctx.beginPath();
    ctx.moveTo(x + dx, groundY - s + dy);
    ctx.lineTo(x + dx + s, groundY + dy);
    ctx.stroke();
    if (snowy) snowCap(ctx, x + dx, groundY - s + dy, s);
  }
}

function drawSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  textY: number,
  text: string,
  color: string,
) {
  const w = text.length * 11 + 24;
  ctx.fillStyle = '#0e1015';
  ctx.fillRect(cx - w / 2 - 2, textY - 18, w + 4, 26);
  ctx.fillStyle = '#1d1f27';
  ctx.fillRect(cx - w / 2, textY - 16, w, 22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2 + 3, textY - 13, w - 6, 16);
  ctx.fillStyle = color;
  ctx.font = 'bold 14px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, textY);
  ctx.textAlign = 'left';
}

// ── Marqueurs de profondeur : panneaux en bois ───────────────────────────────

function drawDepthMarkers(
  ctx: CanvasRenderingContext2D,
  camY: number,
  H: number,
  camPxX: number,
  camPxY: number,
) {
  const first = Math.max(25, Math.ceil(camY / 25) * 25);
  for (let y = first; y * TILE - camPxY < H + TILE; y += 25) {
    const py = y * TILE - camPxY;
    const px = 1 * TILE - camPxX + 6;
    ctx.fillStyle = '#5d4426';
    ctx.fillRect(px + 22, py, 5, 18);
    ctx.fillStyle = '#8a6a3c';
    ctx.fillRect(px, py - 2, 56, 16);
    ctx.fillStyle = '#5d4426';
    ctx.fillRect(px, py - 2, 56, 2);
    ctx.fillStyle = '#f4e8c8';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`-${y} m`, px + 8, py + 10);
  }
}

// ── Forage en cours : fissures + barre de progression ────────────────────────

function drawDigOverlay(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  const d = e.digging;
  if (!d) return;
  const px = d.x * TILE - camPxX;
  const py = d.y * TILE - camPxY;
  const t = Math.min(1, d.progress / d.total);

  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2.5;
  const n = Math.floor(t * 8);
  for (let i = 0; i < n; i++) {
    const a = hash2D(d.x * 3 + i, d.y * 7, 51) * Math.PI * 2;
    const len = (0.3 + hash2D(d.x, d.y + i, 57) * 0.5) * TILE * 0.5;
    ctx.beginPath();
    ctx.moveTo(px + TILE / 2, py + TILE / 2);
    const mx = px + TILE / 2 + Math.cos(a) * len * 0.6;
    const my = py + TILE / 2 + Math.sin(a) * len * 0.6;
    ctx.lineTo(mx + 3, my);
    ctx.lineTo(px + TILE / 2 + Math.cos(a) * len, py + TILE / 2 + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(0,0,0,${t * 0.4})`;
  ctx.fillRect(px, py, TILE, TILE);

  const p = e.player;
  const bx = (p.x + p.w / 2) * TILE - camPxX - TILE * 0.45;
  const by = p.y * TILE - camPxY - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(bx - 1, by - 1, TILE * 0.9 + 2, 8);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(bx, by, TILE * 0.9 * t, 6);
}

// ── Dynamites ────────────────────────────────────────────────────────────────

function drawDynamites(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  for (const d of e.dynamites) {
    const px = d.x * TILE - camPxX;
    const py = d.y * TILE - camPxY;
    const blink = d.fuse < 1 && Math.sin(e.time * 35) > 0;
    ctx.fillStyle = blink ? '#ffffff' : '#b71c1c';
    ctx.fillRect(px - 5, py - 9, 10, 18);
    ctx.fillStyle = blink ? '#ffe9e9' : '#d63031';
    ctx.fillRect(px - 5, py - 9, 4, 18);
    ctx.fillStyle = '#7a1010';
    ctx.fillRect(px - 5, py - 4, 10, 3);
    ctx.fillRect(px - 5, py + 3, 10, 3);
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - 9);
    ctx.quadraticCurveTo(px + 6, py - 16, px + 2, py - 18);
    ctx.stroke();
    ctx.fillStyle = Math.sin(e.time * 50) > 0 ? '#ffe28a' : '#ff9f43';
    ctx.fillRect(px + 1, py - 21, 5, 5);
    ctx.fillStyle = 'rgba(255,226,138,0.5)';
    ctx.fillRect(px - 1, py - 23, 9, 9);
  }
}

// ── Foreuse ──────────────────────────────────────────────────────────────────

// Habillage de la caisse par palier de coque : Tôle, Acier, Titane, Composite, Nanoblindage
// Tôle, Ironium, Bronzium, Acier, Silverium, Einsteinium, Blindage énergétique
export const HULL_STYLES = [
  { dark: '#8c2f20', mid: '#c0492f', light: '#e2603f', trim: null },
  { dark: '#3e4a5c', mid: '#5a6b82', light: '#84a0c0', trim: null },
  { dark: '#5e3c1c', mid: '#9c6a32', light: '#cd9a58', trim: null },
  { dark: '#5d6166', mid: '#8d9398', light: '#c9cfd5', trim: null },
  { dark: '#6e7e8e', mid: '#a8b8c8', light: '#e2ecf6', trim: null },
  { dark: '#2c1c46', mid: '#4a3270', light: '#7a5ab0', trim: '#c9a227' },
  { dark: '#161822', mid: '#2c3046', light: '#4a5070', trim: '#7fe7f0' },
  // 8e palier (planète gelée) : coque quantique cryo
  { dark: '#0e2230', mid: '#1f4a5e', light: '#3f86b0', trim: '#9beef8' },
] as const;

// Réacteur dorsal par palier — palettes alignées sur HULL_STYLES :
// Standard, Turbine, Biréacteur (2 tuyères), Vectoriel (ailerons + or), Ionique (flamme cyan)
// Moteurs : Stock, V4, V4 Turbo, V6, V8, V12, V16 Jag
export const JET_STYLES = [
  { body: '#3a3e49', lite: '#5d6573', dark: '#23262e', trim: null, nozzles: 1, scale: 1, flame: ['#ff7b2d', '#ffd166', '#fff6da'], glow: 'rgba(255,160,60,0.55)' },
  { body: '#5a6b82', lite: '#84a0c0', dark: '#2a3340', trim: null, nozzles: 1, scale: 1.07, flame: ['#ff7b2d', '#ffd166', '#fff6da'], glow: 'rgba(255,160,60,0.55)' },
  { body: '#9c6a32', lite: '#cd9a58', dark: '#4a3014', trim: null, nozzles: 1, scale: 1.14, flame: ['#ff7b2d', '#ffd166', '#fff6da'], glow: 'rgba(255,160,60,0.55)' },
  { body: '#8d9398', lite: '#c9cfd5', dark: '#5d6166', trim: null, nozzles: 2, scale: 1.2, flame: ['#ff7b2d', '#ffd166', '#fff6da'], glow: 'rgba(255,160,60,0.55)' },
  { body: '#a8b8c8', lite: '#e2ecf6', dark: '#5c6c7c', trim: null, nozzles: 2, scale: 1.27, flame: ['#ff9a3d', '#ffd166', '#fff6da'], glow: 'rgba(255,170,80,0.6)' },
  { body: '#4a3270', lite: '#7a5ab0', dark: '#241640', trim: '#c9a227', nozzles: 2, scale: 1.34, flame: ['#ff9a3d', '#ffd166', '#fff6da'], glow: 'rgba(255,170,80,0.6)' },
  { body: '#2c3046', lite: '#4a5070', dark: '#161822', trim: '#7fe7f0', nozzles: 2, scale: 1.4, flame: ['#3fc8de', '#9beef8', '#ffffff'], glow: 'rgba(127,231,240,0.6)' },
  // 8e palier (planète gelée) : propulseur antigravité
  { body: '#1a2c3a', lite: '#3f6b85', dark: '#0e1a22', trim: '#9beef8', nozzles: 2, scale: 1.46, flame: ['#9beef8', '#d6f7fb', '#ffffff'], glow: 'rgba(155,238,248,0.65)' },
] as const;

// Trépan par palier : Standard, Acier, Carbure, Diamantée, Plasma
// Trépans : Standard, Silvide, Goldium, Émeraude, Rubis, Diamant, Amazonite
export const DRILL_STYLES = [
  { light: '#eef1f6', mid: '#b7bdc9', dark: '#7d8493', tip: '#4d525f', spires: 3, len: 0.46, glow: null },
  { light: '#f4f8ff', mid: '#c7d2e4', dark: '#8896b0', tip: '#2f4d80', spires: 3, len: 0.5, glow: null },
  { light: '#fff3c0', mid: '#f6c945', dark: '#b8860b', tip: '#8a6508', spires: 4, len: 0.54, glow: null },
  { light: '#c8f5dc', mid: '#31d178', dark: '#157a44', tip: '#0e5630', spires: 4, len: 0.58, glow: 'rgba(49,209,120,0.4)' },
  { light: '#ffc4d0', mid: '#ef3b58', dark: '#a31432', tip: '#7a0e24', spires: 5, len: 0.62, glow: 'rgba(239,59,88,0.45)' },
  { light: '#e8fdff', mid: '#8deef7', dark: '#3aa8b8', tip: '#27828f', spires: 5, len: 0.66, glow: 'rgba(141,238,247,0.5)' },
  { light: '#d8fff7', mid: '#3fd9c2', dark: '#1b7f70', tip: '#125a4f', spires: 6, len: 0.7, glow: 'rgba(63,217,194,0.6)' },
  // 8e palier (planète gelée) : désintégrateur cryo
  { light: '#ecffff', mid: '#9beef8', dark: '#2f8f9c', tip: '#1b6470', spires: 6, len: 0.74, glow: 'rgba(155,238,248,0.7)' },
] as const;

// ── Fusée de la Compagnie ────────────────────────────────────────────────────

function drawRocket(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  const r = e.rocket;
  if (!r) return;
  const cx = r.x * TILE - camPxX;
  const bottom = r.yBottom * TILE - camPxY;
  const w = TILE * 1.4;
  const h = TILE * 3.2;
  const top = bottom - h;

  // flamme des moteurs (additive : aucune ombre, même de jour)
  if (r.state !== 'landed') {
    const f = 0.7 + Math.sin(e.time * 40) * 0.3;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, bottom + 14, 4, cx, bottom + 14, TILE * 1.7);
    g.addColorStop(0, 'rgba(255,170,70,0.55)');
    g.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - TILE * 1.9, bottom - TILE * 0.5, TILE * 3.8, TILE * 3);
    ctx.globalCompositeOperation = 'source-over';
    const flames: [number, string][] = [
      [1.15, '#ff7b2d'],
      [0.75, '#ffd166'],
      [0.4, '#fff6da'],
    ];
    for (const [scale, color] of flames) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.2 * scale, bottom + 2);
      ctx.lineTo(cx + w * 0.2 * scale, bottom + 2);
      ctx.lineTo(cx, bottom + 2 + TILE * 1.15 * scale * f);
      ctx.closePath();
      ctx.fill();
    }
  }

  // pieds d'atterrissage près du sol
  if (r.yBottom > -1.2) {
    ctx.strokeStyle = '#5d6573';
    ctx.lineWidth = 4;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + (side * w) / 2.4, bottom - h * 0.16);
      ctx.lineTo(cx + side * (w / 2 + 9), bottom);
      ctx.stroke();
    }
  }

  // tuyère
  ctx.fillStyle = '#3a3e49';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.24, bottom - h * 0.08);
  ctx.lineTo(cx + w * 0.24, bottom - h * 0.08);
  ctx.lineTo(cx + w * 0.32, bottom + 2);
  ctx.lineTo(cx - w * 0.32, bottom + 2);
  ctx.closePath();
  ctx.fill();

  // ailerons
  ctx.fillStyle = '#c0392b';
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + (side * w) / 2, bottom - h * 0.36);
    ctx.lineTo(cx + side * (w / 2 + 13), bottom - h * 0.04);
    ctx.lineTo(cx + (side * w) / 2, bottom - h * 0.04);
    ctx.closePath();
    ctx.fill();
  }

  // corps
  const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  grad.addColorStop(0, '#cfd6df');
  grad.addColorStop(0.45, '#f4f7fa');
  grad.addColorStop(1, '#9aa4b2');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, top + h * 0.16, w, h * 0.78, 9);
  ctx.fill();
  // bande de la Compagnie
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(cx - w / 2, top + h * 0.6, w, 8);
  // nez
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + 2, top + h * 0.2);
  ctx.quadraticCurveTo(cx, top - h * 0.05, cx + w / 2 - 2, top + h * 0.2);
  ctx.closePath();
  ctx.fill();
  // hublot
  ctx.fillStyle = '#2c333c';
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.38, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fd4f5';
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.38, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(cx - 2.5, top + h * 0.36, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // porte-rampe de débarquement (côté droit), s'abaisse quand la fusée est posée
  if (r.yBottom > -1.4 && r.doorOpen > 0.001) {
    const open = r.doorOpen;
    // ouverture sombre découpée dans la coque
    const doorY = top + h * 0.6;
    const doorH = h * 0.32;
    ctx.fillStyle = '#1b1e25';
    ctx.beginPath();
    ctx.roundRect(cx + w * 0.08, doorY, w * 0.44, doorH, 4);
    ctx.fill();
    // lueur intérieure chaude visible par l'écoutille ouverte
    ctx.fillStyle = `rgba(255,196,120,${0.16 * open})`;
    ctx.fillRect(cx + w * 0.1, doorY + 2, w * 0.4, doorH - 4);

    // rampe articulée au bas de la coque : pivote de la verticale au sol
    const hx = cx + w * 0.32;
    const hy = bottom - h * 0.08;
    const L = TILE * 1.55;
    const ang = -Math.PI / 2 + (Math.PI / 2 + 0.14) * open; // -90° fermé → ~8° au sol
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const tx = hx + dx * L;
    const tyv = hy + dy * L;
    const nx = -dy * 4.5; // demi-épaisseur, perpendiculaire à la rampe
    const ny = dx * 4.5;
    ctx.beginPath();
    ctx.moveTo(hx + nx, hy + ny);
    ctx.lineTo(tx + nx, tyv + ny);
    ctx.lineTo(tx - nx, tyv - ny);
    ctx.lineTo(hx - nx, hy - ny);
    ctx.closePath();
    ctx.fillStyle = '#aeb7c4';
    ctx.fill();
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.stroke();
    // crans antidérapants le long de la rampe
    ctx.strokeStyle = 'rgba(60,68,82,0.6)';
    ctx.lineWidth = 1.5;
    for (let s = 0.25; s < 1; s += 0.25) {
      ctx.beginPath();
      ctx.moveTo(hx + dx * L * s + nx, hy + dy * L * s + ny);
      ctx.lineTo(hx + dx * L * s - nx, hy + dy * L * s - ny);
      ctx.stroke();
    }
  }
}

function drawPlayer(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  if (e.playerHidden) return;
  const p = e.player;
  const w = p.w * TILE;
  const h = p.h * TILE;
  let px = p.x * TILE - camPxX;
  let py = p.y * TILE - camPxY;

  if (e.digging) {
    px += Math.sin(e.time * 70) * 1.6;
    py += Math.cos(e.time * 90) * 1.2;
  }
  // secousse de dégâts, plus violente que la vibration de forage
  if (e.hurtTimer > 0) {
    const k = e.hurtTimer / 0.5;
    px += Math.sin(e.time * 95) * 3.5 * k;
    py += Math.cos(e.time * 80) * 2.5 * k;
  }

  const dir: 'left' | 'right' | 'down' = e.digging ? e.digging.dir : p.facing > 0 ? 'right' : 'left';

  ctx.save();
  ctx.translate(px + w / 2, py + h / 2);

  // ombre portée au sol
  if (p.grounded) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.5, w * 0.46, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // réacteur dorsal à l'arrière, habillé selon son palier
  const up = useGameStore.getState().upgrades;
  const rear = p.facing > 0 ? -1 : 1;
  const js = JET_STYLES[up.jetpack];
  const ps = js.scale;
  const packX = rear * w * 0.63;
  const packW = w * 0.22 * ps;
  const packTop = -h * 0.24 * ps;
  const packH = h * 0.44 * ps;
  const nozzleY = packTop + packH;
  const nozzleOffs = js.nozzles === 2 ? [-packW * 0.28, packW * 0.28] : [0];
  // flammes sous la/les tuyère(s), inclinées vers l'arrière
  if (p.flying) {
    const f = 0.65 + Math.sin(e.time * 42) * 0.25;
    ctx.save();
    ctx.translate(packX, nozzleY + h * 0.08);
    ctx.rotate(rear * 0.24);
    // lueur additive : elle ne peut qu'éclaircir, donc aucun halo sombre
    // même sur le ciel clair de jour
    const glow = ctx.createRadialGradient(0, h * 0.25, 2, 0, h * 0.25, h * 0.9);
    glow.addColorStop(0, js.glow);
    glow.addColorStop(1, fadedOut(js.glow));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(-w * 0.8, -h * 0.1, w * 1.6, h * 1.5);
    ctx.globalCompositeOperation = 'source-over';
    const fs = js.nozzles === 2 ? 0.72 : 1;
    for (const off of nozzleOffs) {
      ctx.fillStyle = js.flame[0];
      flame(ctx, off - w * 0.14 * fs, 0, w * 0.28 * fs, h * 0.66 * f * ps);
      ctx.fillStyle = js.flame[1];
      flame(ctx, off - w * 0.085 * fs, 0, w * 0.17 * fs, h * 0.42 * f * ps);
      ctx.fillStyle = js.flame[2];
      flame(ctx, off - w * 0.04 * fs, 0, w * 0.08 * fs, h * 0.2 * f * ps);
    }
    ctx.restore();
  }
  // corps du réacteur
  ctx.fillStyle = js.dark;
  roundRect(ctx, packX - packW / 2 - 1, packTop - 1, packW + 2, packH + 2, 5);
  ctx.fillStyle = js.body;
  roundRect(ctx, packX - packW / 2, packTop, packW, packH, 4);
  ctx.fillStyle = js.lite;
  roundRect(ctx, packX - packW / 2, packTop, packW * 0.36, packH, 4);
  // sangle de fixation
  ctx.fillStyle = js.dark;
  ctx.fillRect(packX - packW / 2 - 2, -h * 0.06, packW + 4, 4);
  // palier 1+ : entrée d'air de turbine avec pales animées
  if (up.jetpack >= 1) {
    const tx = packX;
    const ty = packTop + packH * 0.28;
    ctx.fillStyle = js.dark;
    ctx.beginPath();
    ctx.arc(tx, ty, packW * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = js.lite;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, packW * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = e.time * (p.flying ? 16 : 2) + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(a) * packW * 0.26, ty + Math.sin(a) * packW * 0.26);
      ctx.stroke();
    }
  }
  // tuyère(s) — le biréacteur et au-delà en ont deux
  ctx.fillStyle = js.dark;
  for (const off of nozzleOffs) {
    const nw = js.nozzles === 2 ? packW * 0.26 : packW * 0.38;
    ctx.beginPath();
    ctx.moveTo(packX + off - nw * 0.7, nozzleY);
    ctx.lineTo(packX + off + nw * 0.7, nozzleY);
    ctx.lineTo(packX + off + nw, nozzleY + h * 0.1);
    ctx.lineTo(packX + off - nw, nozzleY + h * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  // palier 4+ : ailerons vectoriels
  if (up.jetpack >= 4) {
    ctx.fillStyle = js.lite;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(packX + (side * packW) / 2, nozzleY - h * 0.05);
      ctx.lineTo(packX + (side * packW) / 2 + side * w * 0.08, nozzleY + h * 0.1);
      ctx.lineTo(packX + (side * packW) / 2, nozzleY + h * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }
  // liseré : doré à l'avant-dernier palier, énergétique pulsant au dernier
  if (js.trim) {
    ctx.save();
    ctx.strokeStyle = js.trim;
    ctx.lineWidth = 2;
    if (up.jetpack >= 6) {
      ctx.shadowColor = js.trim;
      ctx.shadowBlur = 6 + Math.sin(e.time * 6) * 3;
    }
    ctx.beginPath();
    ctx.roundRect(packX - packW / 2 + 1, packTop + 1, packW - 2, packH - 2, 4);
    ctx.stroke();
    ctx.restore();
  }

  // chenilles avec maillons animés
  ctx.fillStyle = '#23262e';
  roundRect(ctx, -w / 2 - 1, h * 0.2, w + 2, h * 0.32, 7);
  ctx.fillStyle = '#3a3e49';
  roundRect(ctx, -w / 2 + 2, h * 0.24, w - 4, h * 0.24, 5);
  // maillons défilants
  ctx.fillStyle = '#161920';
  const phase = ((p.x * TILE) % 10) * (p.facing > 0 ? 1 : 1);
  for (let mx = -w / 2 + 2 - phase; mx < w / 2; mx += 10) {
    if (mx > -w / 2) ctx.fillRect(mx, h * 0.2, 3, 4);
    if (mx > -w / 2) ctx.fillRect(mx, h * 0.48, 3, 4);
  }
  // galets
  for (const wx of [-w * 0.28, 0, w * 0.28]) {
    ctx.fillStyle = '#4d525f';
    ctx.beginPath();
    ctx.arc(wx, h * 0.36, h * 0.105, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#787f8d';
    ctx.beginPath();
    ctx.arc(wx, h * 0.36, h * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }

  // caisse : couleurs et blindages selon le palier de coque
  const hs = HULL_STYLES[up.hull];
  ctx.fillStyle = hs.dark;
  roundRect(ctx, -w / 2, -h * 0.28, w, h * 0.52, 6);
  ctx.fillStyle = hs.mid;
  roundRect(ctx, -w / 2, -h * 0.28, w, h * 0.4, 6);
  ctx.fillStyle = hs.light;
  roundRect(ctx, -w / 2, -h * 0.28, w, h * 0.16, 6);
  // rivets : de plus en plus nombreux
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  const nRivets = 4 + up.hull * 2;
  for (let i = 0; i < nRivets; i++) {
    ctx.fillRect(-w * 0.4 + (i * w * 0.8) / (nRivets - 1), h * 0.08, 3, 3);
  }
  // grille latérale
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  const gs = dir === 'left' ? w * 0.16 : -w * 0.34;
  for (let i = 0; i < 3; i++) ctx.fillRect(gs, -h * 0.16 + i * 5, w * 0.18, 2);
  // palier 1+ : pare-chocs avant renforcé
  if (up.hull >= 1) {
    ctx.fillStyle = hs.light;
    const fx = p.facing > 0 ? w * 0.46 : -w * 0.52;
    roundRect(ctx, fx, -h * 0.12, w * 0.06, h * 0.34, 2);
  }
  // palier 2+ : plaque latérale boulonnée
  if (up.hull >= 2) {
    ctx.fillStyle = hs.light;
    roundRect(ctx, -w * 0.2, -h * 0.18, w * 0.4, h * 0.28, 3);
    ctx.fillStyle = hs.dark;
    for (const [bx, by] of [
      [-w * 0.16, -h * 0.14],
      [w * 0.12, -h * 0.14],
      [-w * 0.16, h * 0.04],
      [w * 0.12, h * 0.04],
    ] as const) {
      ctx.fillRect(bx, by, 3, 3);
    }
  }

  // échappement (recentré, le jetpack occupe l'arrière)
  const exs = rear * w * 0.2 - 3.5;
  ctx.fillStyle = '#3a3e49';
  ctx.fillRect(exs, -h * 0.5, 7, h * 0.26);
  ctx.fillStyle = '#23262e';
  ctx.fillRect(exs, -h * 0.52, 7, 4);

  // verrière avec reflet
  const cabX = dir === 'left' ? -w * 0.12 : w * 0.12;
  ctx.fillStyle = '#2c333c';
  ctx.beginPath();
  ctx.arc(cabX, -h * 0.26, w * 0.27, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#9fd4f5';
  ctx.beginPath();
  ctx.arc(cabX, -h * 0.26, w * 0.22, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(cabX - w * 0.07, -h * 0.31, w * 0.07, Math.PI * 0.9, Math.PI * 1.7);
  ctx.fill();
  // palier 4+ : visière blindée au-dessus de la verrière
  if (up.hull >= 4) {
    ctx.strokeStyle = hs.light;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cabX, -h * 0.26, w * 0.27, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  // dernier palier : liseré énergétique sur la caisse
  if (up.hull >= 6 && hs.trim) {
    ctx.save();
    ctx.strokeStyle = hs.trim;
    ctx.lineWidth = 2;
    ctx.shadowColor = hs.trim;
    ctx.shadowBlur = 7 + Math.sin(e.time * 6) * 3;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 1, -h * 0.28 + 1, w - 2, h * 0.52 - 2, 6);
    ctx.stroke();
    ctx.restore();
  } else if (hs.trim) {
    // avant-dernier palier : simple liseré doré
    ctx.strokeStyle = hs.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 1, -h * 0.28 + 1, w - 2, h * 0.52 - 2, 6);
    ctx.stroke();
  }

  // trépan animé selon le palier de foreuse
  const spin = e.time * (e.digging ? 26 : 5);
  drawDrillBit(ctx, dir, w, h, spin, up.drill, e.time);

  // flash rouge clignotant quand on encaisse des dégâts
  if (e.hurtTimer > 0) {
    const k = e.hurtTimer / 0.5;
    const blink = Math.sin(e.time * 42) > 0 ? 1 : 0.35;
    ctx.fillStyle = `rgba(255,60,45,${0.38 * Math.min(1, k) * blink})`;
    roundRect(ctx, -w * 0.62, -h * 0.5, w * 1.24, h * 1.05, 9);
  }

  ctx.restore();
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, len: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.quadraticCurveTo(x + w * 0.5, y + len * 0.6, x + w * 0.5, y + len);
  ctx.quadraticCurveTo(x + w * 0.5, y + len * 0.6, x, y);
  ctx.fill();
}

function drawDrillBit(
  ctx: CanvasRenderingContext2D,
  dir: 'left' | 'right' | 'down',
  w: number,
  h: number,
  spin: number,
  tier: number,
  time: number,
) {
  const st = DRILL_STYLES[tier];
  ctx.save();
  if (dir === 'down') {
    ctx.translate(0, h * 0.34);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(dir === 'right' ? w * 0.42 : -w * 0.42, 0);
    if (dir === 'left') ctx.scale(-1, 1);
  }
  const len = w * st.len;
  const rad = h * (0.2 + tier * 0.012);
  // lueur des trépans haut de gamme, en mode additif (jamais de halo sombre)
  if (st.glow) {
    const g = ctx.createRadialGradient(len * 0.5, 0, 2, len * 0.5, 0, len * 0.9);
    g.addColorStop(0, st.glow);
    g.addColorStop(1, fadedOut(st.glow));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(-len * 0.4, -len, len * 2, len * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  // cône
  const grad = ctx.createLinearGradient(0, -rad, 0, rad);
  grad.addColorStop(0, st.light);
  grad.addColorStop(0.5, st.mid);
  grad.addColorStop(1, st.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -rad);
  ctx.lineTo(0, rad);
  ctx.lineTo(len, 0);
  ctx.closePath();
  ctx.fill();
  // spires en rotation (plus nombreuses sur les bons trépans)
  ctx.strokeStyle = st.dark;
  ctx.lineWidth = 2;
  for (let i = 0; i < st.spires; i++) {
    const t = ((spin * 0.12 + i / st.spires) % 1 + 1) % 1;
    const sx = t * len * 0.85;
    const sr = rad * (1 - sx / len);
    ctx.beginPath();
    ctx.moveTo(sx, -sr);
    ctx.lineTo(sx + 4, sr);
    ctx.stroke();
  }
  // incrustations scintillantes (diamantée et plasma)
  if (tier >= 3) {
    ctx.fillStyle = tier === 4 ? '#f3e8ff' : '#ffffff';
    for (let i = 0; i < 3; i++) {
      const t = ((spin * 0.06 + i / 3) % 1 + 1) % 1;
      const sx = 4 + t * len * 0.7;
      const sr = rad * (1 - sx / len) * 0.5;
      const tw = 0.5 + 0.5 * Math.sin(time * 9 + i * 2.1);
      ctx.globalAlpha = 0.4 + tw * 0.6;
      ctx.fillRect(sx, -sr, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  // pointe
  ctx.fillStyle = st.tip;
  ctx.beginPath();
  ctx.moveTo(len * 0.78, -rad * 0.24);
  ctx.lineTo(len * 0.78, rad * 0.24);
  ctx.lineTo(len, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Particules & flashs d'explosion ──────────────────────────────────────────

function drawParticles(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  for (const pt of e.particles) {
    const t = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = t;
    ctx.fillStyle = pt.color;
    const s = pt.size ?? 4;
    ctx.fillRect(pt.x * TILE - camPxX - s / 2, pt.y * TILE - camPxY - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawFlashes(e: Engine, ctx: CanvasRenderingContext2D, camPxX: number, camPxY: number) {
  for (const f of e.flashes) {
    const t = f.age / 0.45;
    const px = f.x * TILE - camPxX;
    const py = f.y * TILE - camPxY;
    // flash central
    if (t < 0.3) {
      ctx.fillStyle = `rgba(255,240,200,${(1 - t / 0.3) * 0.8})`;
      ctx.beginPath();
      ctx.arc(px, py, TILE * 1.2 * (0.5 + t), 0, Math.PI * 2);
      ctx.fill();
    }
    // anneau de choc
    ctx.strokeStyle = `rgba(255,200,120,${(1 - t) * 0.6})`;
    ctx.lineWidth = 4 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(px, py, TILE * 3 * t + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── Halo de lumière : la foreuse éclaire autour d'elle en profondeur ─────────

function drawLight(
  e: Engine,
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camPxX: number,
  camPxY: number,
  day: DayState,
) {
  const depthAmount = Math.min(0.45, (Math.max(0, e.player.y) / 150) * 0.45);
  // la nuit assombrit aussi la surface (les phares prennent le relais)
  const surfaceFactor = Math.max(0, Math.min(1, 1 - e.player.y / 20));
  const nightAmount = (1 - day.dl) * 0.32 * surfaceFactor;
  const amount = Math.max(depthAmount, nightAmount);
  if (amount < 0.02) return;
  const cx = (e.player.x + e.player.w / 2) * TILE - camPxX;
  const cy = (e.player.y + e.player.h / 2) * TILE - camPxY;
  const g = ctx.createRadialGradient(cx, cy, TILE * 2.4, cx, cy, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, `rgba(0,0,0,${amount * 0.4})`);
  g.addColorStop(1, `rgba(0,0,0,${amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
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

// même couleur avec alpha 0 — fondre vers « rgba(0,0,0,0) » (noir transparent)
// créerait un halo sombre autour des lueurs sur fond clair
export function fadedOut(rgba: string): string {
  return rgba.replace(/[\d.]+\)$/, '0)');
}
