import { useEffect, useRef } from 'react';
import { TANK_TIERS } from '../game/constants';
import { DRILL_STYLES, HULL_STYLES, JET_STYLES } from '../game/render';
import type { UpgradeKind } from '../store';

// Aperçu du palier d'amélioration, dessiné avec les styles de la machine
export function UpgradeIcon({ kind, tier, size = 40 }: { kind: UpgradeKind; tier: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const S = size * 2; // rendu en 2× pour rester net en HiDPI
    ctx.clearRect(0, 0, S, S);
    if (kind === 'drill') paintDrill(ctx, S, tier);
    else if (kind === 'hull') paintHull(ctx, S, tier);
    else if (kind === 'tank') paintTank(ctx, S, tier);
    else if (kind === 'cargo') paintCargo(ctx, S, tier);
    else paintJet(ctx, S, tier);
  }, [kind, tier, size]);

  return (
    <canvas
      ref={ref}
      width={size * 2}
      height={size * 2}
      className="upgrade-icon"
      style={{ width: size, height: size }}
    />
  );
}

function paintDrill(ctx: CanvasRenderingContext2D, S: number, tier: number) {
  const st = DRILL_STYLES[tier];
  const cy = S / 2;
  const len = S * (0.62 + tier * 0.06);
  const rad = S * (0.2 + tier * 0.015);
  if (st.glow) {
    const g = ctx.createRadialGradient(S * 0.45, cy, 2, S * 0.45, cy, S * 0.55);
    g.addColorStop(0, st.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const grad = ctx.createLinearGradient(0, cy - rad, 0, cy + rad);
  grad.addColorStop(0, st.light);
  grad.addColorStop(0.5, st.mid);
  grad.addColorStop(1, st.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(S * 0.08, cy - rad);
  ctx.lineTo(S * 0.08, cy + rad);
  ctx.lineTo(S * 0.08 + len, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = st.dark;
  ctx.lineWidth = 3;
  for (let i = 1; i <= st.spires; i++) {
    const sx = S * 0.08 + (len * i) / (st.spires + 1);
    const sr = rad * (1 - (sx - S * 0.08) / len);
    ctx.beginPath();
    ctx.moveTo(sx, cy - sr);
    ctx.lineTo(sx + 4, cy + sr);
    ctx.stroke();
  }
  ctx.fillStyle = st.tip;
  ctx.beginPath();
  ctx.moveTo(S * 0.08 + len * 0.78, cy - rad * 0.24);
  ctx.lineTo(S * 0.08 + len * 0.78, cy + rad * 0.24);
  ctx.lineTo(S * 0.08 + len, cy);
  ctx.closePath();
  ctx.fill();
}

function paintHull(ctx: CanvasRenderingContext2D, S: number, tier: number) {
  const hs = HULL_STYLES[tier];
  const x = S * 0.08;
  const y = S * 0.28;
  const w = S * 0.84;
  const h = S * 0.44;
  ctx.fillStyle = hs.dark;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = hs.mid;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h * 0.72, 8);
  ctx.fill();
  ctx.fillStyle = hs.light;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h * 0.3, 8);
  ctx.fill();
  // rivets
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  const n = 4 + tier * 2;
  for (let i = 0; i < n; i++) ctx.fillRect(x + 8 + ((w - 20) * i) / (n - 1), y + h * 0.78, 4, 4);
  // plaque boulonnée (palier 2+)
  if (tier >= 2) {
    ctx.fillStyle = hs.light;
    ctx.beginPath();
    ctx.roundRect(x + w * 0.3, y + h * 0.2, w * 0.4, h * 0.5, 4);
    ctx.fill();
    ctx.fillStyle = hs.dark;
    for (const [bx, by] of [
      [0.34, 0.28],
      [0.62, 0.28],
      [0.34, 0.56],
      [0.62, 0.56],
    ] as const) {
      ctx.fillRect(x + w * bx, y + h * by, 3, 3);
    }
  }
  // liseré (doré palier 3, énergétique palier 4)
  if (hs.trim) {
    ctx.strokeStyle = hs.trim;
    ctx.lineWidth = 3;
    if (tier >= 4) {
      ctx.shadowColor = hs.trim;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function paintTank(ctx: CanvasRenderingContext2D, S: number, tier: number) {
  const cap = TANK_TIERS[tier].stat / TANK_TIERS[TANK_TIERS.length - 1].stat;
  const x = S * 0.22;
  const y = S * 0.1;
  const w = S * 0.56;
  const h = S * 0.8;
  // bidon
  ctx.fillStyle = '#3a3e49';
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 10);
  ctx.fill();
  ctx.fillStyle = '#5d6573';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 7);
  ctx.fill();
  // bouchon
  ctx.fillStyle = '#23262e';
  ctx.fillRect(x + w * 0.3, y - 8, w * 0.4, 10);
  // jauge : remplissage proportionnel à la capacité du palier
  const gx = x + 6;
  const gw = w - 12;
  const gh = h - 16;
  ctx.fillStyle = '#1d2027';
  ctx.fillRect(gx, y + 8, gw, gh);
  const fh = gh * (0.25 + 0.75 * cap);
  const grad = ctx.createLinearGradient(0, y + 8 + gh - fh, 0, y + 8 + gh);
  grad.addColorStop(0, '#ffd166');
  grad.addColorStop(1, '#f5a623');
  ctx.fillStyle = grad;
  ctx.fillRect(gx, y + 8 + gh - fh, gw, fh);
}

function paintCargo(ctx: CanvasRenderingContext2D, S: number, tier: number) {
  const hs = HULL_STYLES[tier];
  const grow = 1 + tier * 0.06;
  const w = S * 0.7 * grow;
  const h = S * 0.52 * grow;
  const x = S / 2 - w / 2;
  const y = S * 0.62 - h / 2;
  // caisse aux couleurs du palier de coque équivalent
  ctx.fillStyle = hs.dark;
  ctx.beginPath();
  ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 7);
  ctx.fill();
  ctx.fillStyle = hs.mid;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  // couvercle
  ctx.fillStyle = hs.light;
  ctx.beginPath();
  ctx.roundRect(x - 5, y - 6, w + 10, 10, 4);
  ctx.fill();
  // sangles verticales
  ctx.fillStyle = hs.dark;
  ctx.fillRect(x + w * 0.28, y, 4, h);
  ctx.fillRect(x + w * 0.68, y, 4, h);
  // compartiments : de plus en plus nombreux selon le palier
  const slots = 3 + tier;
  ctx.fillStyle = hs.light;
  for (let i = 0; i < slots; i++) {
    ctx.fillRect(x + 6 + ((w - 16) * i) / Math.max(1, slots - 1), y + h - 10, 5, 5);
  }
  // minerais qui dépassent du couvercle
  const gems = ['#f6c945', '#ef3b58', '#8deef7'];
  for (let i = 0; i <= Math.min(2, tier); i++) {
    ctx.fillStyle = gems[i];
    ctx.beginPath();
    ctx.moveTo(x + w * (0.25 + i * 0.25), y - 13);
    ctx.lineTo(x + w * (0.25 + i * 0.25) + 6, y - 6);
    ctx.lineTo(x + w * (0.25 + i * 0.25) - 6, y - 6);
    ctx.closePath();
    ctx.fill();
  }
  // liseré des hauts paliers
  if (hs.trim) {
    ctx.strokeStyle = hs.trim;
    ctx.lineWidth = 3;
    if (tier >= 4) {
      ctx.shadowColor = hs.trim;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 5);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function paintJet(ctx: CanvasRenderingContext2D, S: number, tier: number) {
  const js = JET_STYLES[tier];
  const ps = js.scale;
  const w = S * 0.4 * ps;
  const h = S * 0.62 * ps;
  const x = S / 2 - w / 2;
  const y = S * 0.06;
  const nozzleY = y + h;
  const offs = js.nozzles === 2 ? [-w * 0.28, w * 0.28] : [0];
  // flamme statique sous les tuyères
  for (const off of offs) {
    ctx.fillStyle = js.flame[0];
    ctx.beginPath();
    ctx.moveTo(S / 2 + off - 6, nozzleY + 6);
    ctx.lineTo(S / 2 + off + 6, nozzleY + 6);
    ctx.lineTo(S / 2 + off, Math.min(S - 2, nozzleY + 22));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = js.flame[1];
    ctx.beginPath();
    ctx.moveTo(S / 2 + off - 3, nozzleY + 6);
    ctx.lineTo(S / 2 + off + 3, nozzleY + 6);
    ctx.lineTo(S / 2 + off, Math.min(S - 4, nozzleY + 14));
    ctx.closePath();
    ctx.fill();
  }
  // corps
  ctx.fillStyle = js.dark;
  ctx.beginPath();
  ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 8);
  ctx.fill();
  ctx.fillStyle = js.body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = js.lite;
  ctx.beginPath();
  ctx.roundRect(x, y, w * 0.36, h, 6);
  ctx.fill();
  // turbine (palier 1+)
  if (tier >= 1) {
    ctx.fillStyle = js.dark;
    ctx.beginPath();
    ctx.arc(S / 2, y + h * 0.3, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = js.lite;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, y + h * 0.3, w * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // tuyères
  ctx.fillStyle = js.dark;
  for (const off of offs) {
    const nw = js.nozzles === 2 ? w * 0.22 : w * 0.32;
    ctx.beginPath();
    ctx.moveTo(S / 2 + off - nw * 0.7, nozzleY);
    ctx.lineTo(S / 2 + off + nw * 0.7, nozzleY);
    ctx.lineTo(S / 2 + off + nw, nozzleY + 7);
    ctx.lineTo(S / 2 + off - nw, nozzleY + 7);
    ctx.closePath();
    ctx.fill();
  }
  // ailerons vectoriels (palier 3+)
  if (tier >= 3) {
    ctx.fillStyle = js.lite;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(S / 2 + (side * w) / 2, nozzleY - 6);
      ctx.lineTo(S / 2 + (side * w) / 2 + side * 9, nozzleY + 7);
      ctx.lineTo(S / 2 + (side * w) / 2, nozzleY + 4);
      ctx.closePath();
      ctx.fill();
    }
  }
  // liseré
  if (js.trim) {
    ctx.strokeStyle = js.trim;
    ctx.lineWidth = 3;
    if (tier >= 4) {
      ctx.shadowColor = js.trim;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
