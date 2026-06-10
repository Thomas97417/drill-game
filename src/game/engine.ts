import {
  BUILDINGS,
  BURN_FLY,
  BURN_MOVE,
  DYNAMITE_DMG,
  DYNAMITE_FUSE,
  DYNAMITE_RADIUS,
  FALL_DMG_FACTOR,
  FLY_ACCEL,
  GRAVITY,
  HULL_DMG_FACTOR,
  JETPACK_TIERS,
  MAX_FALL,
  MAX_FLY,
  MOVE_SPEED,
  SAFE_FALL_SPEED,
  SKY_LIMIT,
  SPAWN_X,
  TILE,
  TILES,
  WORLD_W,
  digBurn,
  digTime,
  type BuildingId,
  type OreId,
} from './constants';
import { Input } from './input';
import { World } from './world';
import { clearSave, loadSave, saveNow } from './save';
import { useGameStore } from '../store';
import { render } from './render';

const STEP = 1 / 60;
const EPS = 0.001;
const AUTOSAVE_EVERY = 5; // secondes

export interface Player {
  x: number; // tuiles (coin haut-gauche)
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  grounded: boolean;
  flying: boolean;
}

export interface DigState {
  x: number;
  y: number;
  progress: number;
  total: number;
  dir: 'left' | 'right' | 'down';
}

export interface Dynamite {
  x: number;
  y: number;
  vy: number;
  fuse: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

function makePlayer(pos?: { x: number; y: number }): Player {
  const w = 0.74;
  const h = 0.74;
  return {
    x: pos?.x ?? SPAWN_X + (1 - w) / 2,
    y: pos?.y ?? -h - EPS,
    vx: 0,
    vy: 0,
    w,
    h,
    facing: 1,
    grounded: false,
    flying: false,
  };
}

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  world: World;
  player: Player;
  input = new Input();
  digging: DigState | null = null;
  particles: Particle[] = [];
  dynamites: Dynamite[] = [];
  camX = 0;
  camY = 0;
  viewW = 800; // px CSS
  viewH = 600;
  time = 0;

  private raf = 0;
  private last = 0;
  private acc = 0;
  private saveTimer = 0;
  private digPartTimer = 0;
  private wasPaused = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    const saved = loadSave();
    this.world = new World(saved?.seed ?? newSeed(), saved?.dug);
    this.player = makePlayer(saved?.player);
    this.snapCamera();
  }

  start() {
    this.input.attach();
    window.addEventListener('beforeunload', this.onUnload);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    window.removeEventListener('beforeunload', this.onUnload);
    this.saveGame();
  }

  resize(w: number, h: number, dpr: number) {
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // taille CSS explicite, sinon le canvas s'affiche à sa taille interne
    // (w×dpr pixels) sur les écrans HiDPI
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private onUnload = () => this.saveGame();

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    this.acc += Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= STEP) {
      this.update(STEP);
      this.acc -= STEP;
    }
    render(this);
  };

  // ── Mise à jour ────────────────────────────────────────────────────────────

  private update(dt: number) {
    this.time += dt;
    const store = useGameStore.getState();

    if (store.pendingAction) {
      if (store.pendingAction === 'teleport') this.teleportToSurface();
      else if (store.pendingAction === 'dynamite') this.spawnDynamite();
      else this.resetWorld();
      store.clearPending();
    }

    this.updateParticles(dt);

    if (store.ui !== 'playing') {
      this.wasPaused = true;
      this.input.endFrame();
      this.updateCamera(dt);
      return;
    }
    if (this.wasPaused) {
      // ignore les touches qui ont servi à fermer le menu (E, I…),
      // sinon elles rouvriraient le panneau dans la même frame
      this.wasPaused = false;
      this.input.endFrame();
    }

    const p = this.player;
    let fuel = store.fuel;
    let hull = store.hull;

    if (this.input.consume('teleport')) store.useTeleporter();
    if (this.input.consume('dynamite')) store.dropDynamite();
    if (this.input.consume('inventory')) store.toggleInventory();

    const left = this.input.held('left');
    const right = this.input.held('right');
    const down = this.input.held('down');
    const up = this.input.held('up') && fuel > 0;

    // ── Forage : au sol, contre un bloc adjacent ─────────────────────────────
    const cx = Math.floor(p.x + p.w / 2);
    const cyMid = Math.floor(p.y + p.h / 2);
    let target: { x: number; y: number; dir: DigState['dir'] } | null = null;
    if (p.grounded && fuel > 0 && !up) {
      if (down) {
        const ty = Math.floor(p.y + p.h + 0.05);
        if (this.diggable(cx, ty)) target = { x: cx, y: ty, dir: 'down' };
      } else if (left) {
        const tx = Math.floor(p.x - 0.08);
        if (tx !== cx && this.diggable(tx, cyMid)) target = { x: tx, y: cyMid, dir: 'left' };
      } else if (right) {
        const tx = Math.floor(p.x + p.w + 0.08);
        if (tx !== cx && this.diggable(tx, cyMid)) target = { x: tx, y: cyMid, dir: 'right' };
      }
    }

    if (target) {
      if (!this.digging || this.digging.x !== target.x || this.digging.y !== target.y) {
        this.digging = {
          ...target,
          progress: 0,
          total: digTime(this.world.getTile(target.x, target.y), target.y, store.upgrades.drill),
        };
      }
      const d = this.digging;
      d.progress += dt;
      // forage vers le bas : la foreuse s'aligne sur la colonne attaquée.
      // Pas d'alignement vertical en forage latéral : remonter la foreuse la
      // décollerait du sol et annulerait le forage à chaque frame.
      if (d.dir === 'down') p.x += (d.x + (1 - p.w) / 2 - p.x) * Math.min(1, dt * 10);
      else p.facing = d.dir === 'left' ? -1 : 1;
      p.vx = 0;
      this.emitDigParticles(d, dt);
      if (d.progress >= d.total) {
        const kind = this.world.getTile(d.x, d.y);
        const def = this.world.dig(d.x, d.y);
        if (def?.value) store.addCargo(kind as OreId);
        this.digging = null;
      }
    } else {
      this.digging = null;
      p.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * MOVE_SPEED;
      if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1;
    }

    // ── Verticale : jetpack + gravité ────────────────────────────────────────
    p.flying = up;
    const flyMult = JETPACK_TIERS[store.upgrades.jetpack].stat;
    p.vy += GRAVITY * dt;
    if (up) p.vy -= FLY_ACCEL * flyMult * dt;
    p.vy = Math.max(-MAX_FLY * flyMult, Math.min(MAX_FALL, p.vy));

    const impact = this.moveAndCollide(dt);
    if (impact > SAFE_FALL_SPEED) {
      const dmg = (impact - SAFE_FALL_SPEED) * FALL_DMG_FACTOR * HULL_DMG_FACTOR[store.upgrades.hull];
      hull = Math.max(0, hull - dmg);
      this.emitBurst(p.x + p.w / 2, p.y + p.h, '#c9b9a0', 10);
    }

    // plafond du ciel
    if (p.y < SKY_LIMIT) {
      p.y = SKY_LIMIT;
      p.vy = Math.max(0, p.vy);
    }

    // ── Dynamites : chute, mèche, explosion ──────────────────────────────────
    const blastDmg = this.updateDynamites(dt);
    if (blastDmg > 0) {
      hull = Math.max(0, hull - blastDmg * HULL_DMG_FACTOR[store.upgrades.hull]);
    }

    // ── Essence ──────────────────────────────────────────────────────────────
    let burn = 0;
    if (this.digging) {
      burn += digBurn(this.world.getTile(this.digging.x, this.digging.y), this.digging.y);
    }
    if (p.flying) burn += BURN_FLY;
    if (Math.abs(p.vx) > 0.1) burn += BURN_MOVE;
    fuel = Math.max(0, fuel - burn * dt);

    // ── État dérivé ──────────────────────────────────────────────────────────
    const depth = Math.max(0, Math.floor(p.y + p.h / 2) + 1);
    const maxDepth = Math.max(store.maxDepth, depth);
    const ccx = Math.floor(p.x + p.w / 2);
    let nearBuilding: BuildingId | null = null;
    if (p.grounded && depth === 0) {
      const b = BUILDINGS.find(({ range }) => ccx >= range[0] && ccx <= range[1]);
      nearBuilding = b?.id ?? null;
    }

    useGameStore.setState({ fuel, hull, depth, maxDepth, nearBuilding });

    if (nearBuilding && this.input.consume('interact')) store.openShop(nearBuilding);

    if (hull <= 0) store.triggerRescue('hull');
    else if (fuel <= 0 && p.grounded) store.triggerRescue('fuel');

    this.updateCamera(dt);

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_EVERY) {
      this.saveTimer = 0;
      this.saveGame();
    }

    this.input.endFrame();
  }

  private diggable(x: number, y: number): boolean {
    return TILES[this.world.getTile(x, y)].diggable;
  }

  // Déplacement avec collisions par axe ; renvoie la vitesse d'impact au sol
  private moveAndCollide(dt: number): number {
    const p = this.player;
    let impact = 0;

    p.x += p.vx * dt;
    if (p.vx > 0) {
      const tx = Math.floor(p.x + p.w);
      if (this.solidSpan(tx, p.y, p.h)) {
        p.x = tx - p.w - EPS;
        p.vx = 0;
      }
    } else if (p.vx < 0) {
      const tx = Math.floor(p.x);
      if (this.solidSpan(tx, p.y, p.h)) {
        p.x = tx + 1 + EPS;
        p.vx = 0;
      }
    }

    p.y += p.vy * dt;
    if (p.vy > 0) {
      const ty = Math.floor(p.y + p.h);
      if (this.solidRow(ty, p.x, p.w)) {
        if (!p.grounded) impact = p.vy;
        p.y = ty - p.h - EPS;
        p.vy = 0;
        p.grounded = true;
      } else {
        p.grounded = false;
      }
    } else if (p.vy < 0) {
      const ty = Math.floor(p.y);
      if (this.solidRow(ty, p.x, p.w)) {
        // correction de coin : si la colonne au-dessus du centre est libre,
        // on se glisse vers elle au lieu de rester bloqué sous le plafond
        const cx = Math.floor(p.x + p.w / 2);
        const alignX = cx + (1 - p.w) / 2;
        if (!this.world.isSolid(cx, ty) && Math.abs(alignX - p.x) <= 0.5) {
          p.x += Math.sign(alignX - p.x) * Math.min(Math.abs(alignX - p.x), 10 * dt);
        }
        p.y = ty + 1 + EPS;
        p.vy = 0;
      }
      p.grounded = false;
    }
    return impact;
  }

  private solidSpan(tx: number, y: number, h: number): boolean {
    const y0 = Math.floor(y + EPS);
    const y1 = Math.floor(y + h - EPS);
    for (let ty = y0; ty <= y1; ty++) if (this.world.isSolid(tx, ty)) return true;
    return false;
  }

  private solidRow(ty: number, x: number, w: number): boolean {
    const x0 = Math.floor(x + EPS);
    const x1 = Math.floor(x + w - EPS);
    for (let tx = x0; tx <= x1; tx++) if (this.world.isSolid(tx, ty)) return true;
    return false;
  }

  // ── Caméra ─────────────────────────────────────────────────────────────────

  private camTarget(): { x: number; y: number } {
    const p = this.player;
    const vw = this.viewW / TILE;
    const vh = this.viewH / TILE;
    let x: number;
    if (vw >= WORLD_W) x = (WORLD_W - vw) / 2;
    else x = Math.max(0, Math.min(WORLD_W - vw, p.x + p.w / 2 - vw / 2));
    const y = Math.max(SKY_LIMIT - 1, p.y + p.h / 2 - vh / 2);
    return { x, y };
  }

  private updateCamera(dt: number) {
    const t = this.camTarget();
    const k = Math.min(1, dt * 6);
    this.camX += (t.x - this.camX) * k;
    this.camY += (t.y - this.camY) * k;
  }

  private snapCamera() {
    const t = this.camTarget();
    this.camX = t.x;
    this.camY = t.y;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private teleportToSurface() {
    const p = this.player;
    this.emitBurst(p.x + p.w / 2, p.y + p.h / 2, '#7fe7f0', 16);
    // colonne d'arrivée la plus proche du spawn dont le sol n'a pas été creusé
    let sx = SPAWN_X;
    for (let d = 0; d < WORLD_W; d++) {
      const cand = SPAWN_X + (d % 2 === 0 ? d / 2 : -(d + 1) / 2);
      if (cand >= 1 && cand < WORLD_W - 1 && this.world.isSolid(cand, 0)) {
        sx = cand;
        break;
      }
    }
    p.x = sx + (1 - p.w) / 2;
    p.y = -p.h - EPS;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    this.digging = null;
    this.snapCamera();
    this.emitBurst(p.x + p.w / 2, p.y + p.h / 2, '#7fe7f0', 16);
  }

  private resetWorld() {
    clearSave();
    this.world = new World(newSeed());
    this.player = makePlayer();
    this.digging = null;
    this.particles = [];
    this.dynamites = [];
    this.snapCamera();
  }

  // ── Dynamite ───────────────────────────────────────────────────────────────

  private spawnDynamite() {
    const p = this.player;
    this.dynamites.push({
      x: p.x + p.w / 2,
      y: p.y + p.h * 0.6,
      vy: 1,
      fuse: DYNAMITE_FUSE,
    });
  }

  // Renvoie les dégâts d'explosion subis par la foreuse
  private updateDynamites(dt: number): number {
    let dmg = 0;
    for (const d of this.dynamites) {
      // chute jusqu'au premier bloc solide
      d.vy = Math.min(MAX_FALL, d.vy + GRAVITY * dt);
      let ny = d.y + d.vy * dt;
      if (this.world.isSolid(Math.floor(d.x), Math.floor(ny + 0.18))) {
        ny = Math.floor(ny + 0.18) - 0.18 - EPS;
        d.vy = 0;
      }
      d.y = ny;
      d.fuse -= dt;
      if (d.fuse <= 0) dmg += this.explode(d);
    }
    this.dynamites = this.dynamites.filter((d) => d.fuse > 0);
    return dmg;
  }

  private explode(d: Dynamite): number {
    const destroyed = this.world.blast(d.x, d.y, DYNAMITE_RADIUS);
    for (const t of destroyed) {
      const def = TILES[t.kind];
      this.emitBurst(t.x + 0.5, t.y + 0.5, def.gem ?? def.speckle, 3);
    }
    this.emitBurst(d.x, d.y, '#ff9f43', 24);
    this.emitBurst(d.x, d.y, '#8d93a1', 14);
    this.digging = null; // le terrain a pu changer sous la foreuse
    const p = this.player;
    const dist = Math.hypot(p.x + p.w / 2 - d.x, p.y + p.h / 2 - d.y);
    const reach = DYNAMITE_RADIUS + 1;
    return dist >= reach ? 0 : DYNAMITE_DMG * (1 - dist / reach);
  }

  saveGame() {
    const s = useGameStore.getState();
    saveNow({
      seed: this.world.seed,
      dug: [...this.world.dug],
      money: s.money,
      fuel: s.fuel,
      hull: s.hull,
      cargo: s.cargo,
      upgrades: s.upgrades,
      teleporters: s.teleporters,
      dynamites: s.dynamites,
      maxDepth: s.maxDepth,
      player: { x: this.player.x, y: this.player.y },
    });
  }

  // ── Particules ─────────────────────────────────────────────────────────────

  private emitDigParticles(d: DigState, dt: number) {
    this.digPartTimer -= dt;
    if (this.digPartTimer > 0) return;
    this.digPartTimer = 0.05;
    const def = TILES[this.world.getTile(d.x, d.y)];
    const color = def.gem ?? def.speckle;
    const fx = d.dir === 'left' ? d.x + 1 : d.dir === 'right' ? d.x : d.x + 0.5;
    const fy = d.dir === 'down' ? d.y : d.y + 0.5;
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: fx + (Math.random() - 0.5) * 0.4,
        y: fy + (Math.random() - 0.5) * 0.2,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4,
        life: 0.5,
        maxLife: 0.5,
        color,
      });
    }
  }

  private emitBurst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        life: 0.6,
        maxLife: 0.6,
        color,
      });
    }
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += GRAVITY * 0.6 * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }
}

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
