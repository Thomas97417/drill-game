import {
  BUILDINGS,
  BURN_FLY,
  BURN_MOVE,
  DAY_CYCLE,
  DYNAMITE_DMG,
  DYNAMITE_FUSE,
  DYNAMITE_RADIUS,
  FALL_DMG_FACTOR,
  FLOATER_LIFE,
  FLY_ACCEL,
  GRAVITY,
  HULL_DMG_FACTOR,
  MAX_FALL,
  MAX_FLY,
  ROCKET_X,
  MOVE_SPEED,
  SAFE_FALL_SPEED,
  SKY_LIMIT,
  SPAWN_X,
  TILE,
  TILES,
  WORLD_W,
  cargoLoad,
  digBurn,
  digTime,
  type BuildingId,
  type OreId,
} from './constants';
import { getPlanet } from './planets';
import { Input } from './input';
import { World } from './world';
import { initTileAtlas } from './tileart';
import { clearSave, loadSave, saveNow } from './save';
import { maxCargoOf, useGameStore } from '../store';
import { render, setActiveTheme } from './render';

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
  size?: number; // px à l'écran (4 par défaut)
  g?: number; // multiplicateur de gravité (0.6 par défaut, négatif = monte)
}

export interface Flash {
  x: number;
  y: number;
  age: number;
}

// fusée de la Compagnie : dépose au début de partie, rappel à l'objectif
export interface Rocket {
  x: number;
  yBottom: number; // bas de la fusée, en tuiles (0 = posée au sol)
  vy: number;
  state: 'landing' | 'landed' | 'leaving';
  purpose: 'intro' | 'recall';
  timer: number;
  doorOpen: number; // 0 = porte-rampe fermée, 1 = abaissée au sol
  roverFrom?: { x: number; y: number }; // centre du rover au début d'un embarquement
  roverDone?: boolean; // débarquement terminé (anti double-effet)
}

// texte flottant (nom du minerai récolté…) qui monte et s'estompe
export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
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
  flashes: Flash[] = [];
  floaters: Floater[] = [];
  rocket: Rocket | null = null;
  playerHidden = false; // à bord de la fusée
  hurtTimer = 0; // animation de dégâts en cours (s restantes)
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
  private smokeTimer = 0;
  private snowTimer = 0;
  private wasPaused = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    initTileAtlas();
    const saved = loadSave();
    const planet = saved?.planet ?? 'xk712';
    setActiveTheme(getPlanet(planet).theme);
    this.world = new World(saved?.seed ?? newSeed(), getPlanet(planet), saved?.dug);
    this.player = makePlayer(saved?.player);
    this.time = saved?.time ?? 0;
    this.snapCamera();
    if (!saved) this.startIntro();
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
    const cfg = getPlanet(store.planet);

    if (store.pendingAction) {
      if (store.pendingAction === 'teleport') this.teleportToSurface();
      else if (store.pendingAction === 'dynamite') this.spawnDynamite();
      else if (store.pendingAction === 'recall') this.startRecall();
      else this.resetWorld();
      store.clearPending();
    }

    this.updateParticles(dt);
    this.emitAmbient(dt);
    this.updateRocket(dt);

    if (store.ui !== 'playing') {
      if (store.ui === 'cinematic' && this.rocket && this.input.consume('interact')) {
        this.finishRocket(); // passe la cinématique
      }
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
          total: digTime(
            this.world.getTile(target.x, target.y),
            target.y,
            cfg.ladders.drill[store.upgrades.drill].stat,
          ),
        };
      }
      const d = this.digging;
      d.progress += dt;
      // forer dans le danger thermique (lave / poche de froid) endommage la
      // coque, atténué par le radiateur / l'isolation thermique
      if (this.world.getTile(d.x, d.y) === cfg.hazard.kind) {
        const reduce = 1 - cfg.ladders.thermal[store.upgrades.thermal].stat;
        hull = Math.max(0, hull - cfg.hazard.dps * reduce * HULL_DMG_FACTOR[store.upgrades.hull] * dt);
        // flash continu pendant les dégâts, sans spammer de texte
        this.hurtTimer = Math.max(this.hurtTimer, 0.2);
      }
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
        if (def?.value) {
          const s = useGameStore.getState();
          if (cargoLoad(s.cargo) + (def.size ?? 1) > maxCargoOf(s.upgrades)) {
            // soute pleine : le minerai s'éparpille, perdu
            this.emitBurst(d.x + 0.5, d.y + 0.5, def.gem ?? def.speckle, 10);
            this.floaters.push({ x: d.x + 0.5, y: d.y + 0.2, text: 'Soute pleine !', color: '#ffb74f', age: 0 });
          } else {
            store.addCargo(kind as OreId);
            this.floaters.push({ x: d.x + 0.5, y: d.y + 0.2, text: def.name, color: def.gem ?? '#ffffff', age: 0 });
          }
        }
        this.digging = null;
      }
    } else {
      this.digging = null;
      // le moteur booste aussi la vitesse de déplacement
      p.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * MOVE_SPEED * cfg.ladders.jetpack[store.upgrades.jetpack].stat;
      if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1;
    }

    // ── Verticale : jetpack + gravité ────────────────────────────────────────
    p.flying = up;
    const flyMult = cfg.ladders.jetpack[store.upgrades.jetpack].stat;
    p.vy += GRAVITY * dt;
    if (up) p.vy -= FLY_ACCEL * flyMult * dt;
    p.vy = Math.max(-MAX_FLY * flyMult, Math.min(MAX_FALL, p.vy));

    const impact = this.moveAndCollide(dt);
    if (impact > SAFE_FALL_SPEED) {
      const dmg = (impact - SAFE_FALL_SPEED) * FALL_DMG_FACTOR * HULL_DMG_FACTOR[store.upgrades.hull];
      hull = Math.max(0, hull - dmg);
      this.emitBurst(p.x + p.w / 2, p.y + p.h, '#c9b9a0', 10);
      this.hurt(dmg);
    }

    // plafond du ciel
    if (p.y < SKY_LIMIT) {
      p.y = SKY_LIMIT;
      p.vy = Math.max(0, p.vy);
    }

    // fumée d'échappement quand le moteur travaille
    if (Math.abs(p.vx) > 0.1 || p.flying || this.digging) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.16;
        const exs = p.facing > 0 ? p.x + p.w * 0.3 : p.x + p.w * 0.7;
        this.particles.push({
          x: exs,
          y: p.y - 0.1,
          vx: (Math.random() - 0.5) * 0.6 - p.vx * 0.15,
          vy: -0.8 - Math.random() * 0.6,
          life: 0.7,
          maxLife: 0.7,
          color: 'rgba(120,120,130,0.6)',
          size: 5 + Math.random() * 3,
          g: -0.05,
        });
      }
    }

    // ── Dynamites : chute, mèche, explosion ──────────────────────────────────
    const blastDmg = this.updateDynamites(dt);
    if (blastDmg > 0) {
      const dmg = blastDmg * HULL_DMG_FACTOR[store.upgrades.hull];
      hull = Math.max(0, hull - dmg);
      this.hurt(dmg);
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

    const day = Math.floor(this.time / DAY_CYCLE) + 1;
    useGameStore.setState({ fuel, hull, depth, maxDepth, nearBuilding, day });

    if (nearBuilding && this.input.consume('interact')) store.openShop(nearBuilding);
    // action rapide unifiée [F] selon le bâtiment
    if (nearBuilding && this.input.consume('quick')) {
      if (nearBuilding === 'sell') store.sellAll();
      else if (nearBuilding === 'fuel') store.buyFuel(Infinity);
      else store.repairHull();
    }

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
    const vw = this.viewW / TILE;
    const vh = this.viewH / TILE;
    if (this.rocket) {
      const x =
        vw >= WORLD_W
          ? (WORLD_W - vw) / 2
          : Math.max(0, Math.min(WORLD_W - vw, this.rocket.x - vw / 2));
      const y = Math.max(SKY_LIMIT - 1, Math.min(this.rocket.yBottom, 0) + 2.5 - vh / 2);
      return { x, y };
    }
    const p = this.player;
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
    this.playerHidden = false;
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

  // Réinitialise pour la planète courante du store (nouvelle partie OU départ
  // vers la planète suivante) : nouveau monde, thème, et cinématique d'arrivée.
  private resetWorld() {
    clearSave();
    const planet = useGameStore.getState().planet;
    setActiveTheme(getPlanet(planet).theme);
    this.world = new World(newSeed(), getPlanet(planet));
    this.player = makePlayer();
    this.time = 0;
    this.digging = null;
    this.particles = [];
    this.dynamites = [];
    this.flashes = [];
    this.floaters = [];
    this.rocket = null;
    this.snapCamera();
    this.startIntro();
  }

  // ── Fusée de la Compagnie ──────────────────────────────────────────────────

  private startIntro() {
    this.playerHidden = true;
    this.rocket = { x: ROCKET_X, yBottom: -20, vy: 0, state: 'landing', purpose: 'intro', timer: 0, doorOpen: 0 };
    useGameStore.setState({ ui: 'cinematic' });
  }

  private startRecall() {
    this.rocket = { x: ROCKET_X, yBottom: -20, vy: 0, state: 'landing', purpose: 'recall', timer: 0, doorOpen: 0 };
    useGameStore.setState({ ui: 'cinematic' });
  }

  // fin (ou saut) de cinématique : applique directement l'état final
  private finishRocket() {
    const r = this.rocket;
    if (!r) return;
    this.rocket = null;
    if (r.purpose === 'intro') {
      // saut de cinématique : on dépose le rover directement au point de spawn
      this.playerHidden = false;
      this.player.x = SPAWN_X + (1 - this.player.w) / 2;
      this.player.y = -this.player.h;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.grounded = true;
      useGameStore.setState({ ui: 'story' });
    } else {
      this.playerHidden = true;
      useGameStore.setState({ ui: 'victory' });
    }
  }

  private updateRocket(dt: number) {
    const r = this.rocket;
    if (!r) return;
    if (r.state === 'landing') {
      // descente freinée à l'approche du sol
      const speed = Math.min(8, 1.4 - r.yBottom * 0.45);
      r.yBottom += speed * dt;
      this.emitRocketExhaust(r, dt);
      if (r.yBottom >= 0) {
        r.yBottom = 0;
        r.state = 'landed';
        r.timer = 0;
        this.emitBurst(r.x, 0, '#c9b9a0', 16);
        if (r.purpose === 'recall') {
          // on mémorise d'où le rover part pour rejoindre la rampe
          r.roverFrom = {
            x: this.player.x + this.player.w / 2,
            y: this.player.y + this.player.h / 2,
          };
        }
      }
    } else if (r.state === 'landed') {
      r.timer += dt;
      // séquence : ouverture de la porte-rampe → trajet du rover → fermeture
      const DOOR_T = 0.5; // durée d'ouverture/fermeture de la rampe
      const RIDE_T = 1.0; // durée du trajet du rover sur la rampe
      const HOLD = DOOR_T + RIDE_T;
      const ease = (t: number) => 1 - (1 - t) * (1 - t);
      r.doorOpen =
        r.timer < HOLD
          ? Math.min(1, r.timer / DOOR_T)
          : Math.max(0, 1 - (r.timer - HOLD) / DOOR_T);

      const door = this.rocketDoor(r);
      if (r.purpose === 'intro') {
        // le rover descend la rampe jusqu'au point de spawn
        if (r.timer > DOOR_T) {
          this.playerHidden = false;
          const t = ease(Math.min(1, (r.timer - DOOR_T) / RIDE_T));
          const spawn = { x: SPAWN_X + 0.5, y: -this.player.h / 2 };
          this.slideRover(door, spawn, t);
          this.player.grounded = t >= 1;
          if (t >= 1 && !r.roverDone) {
            r.roverDone = true;
            this.emitBurst(spawn.x, 0, '#c9b9a0', 10);
          }
        }
      } else if (r.roverFrom && r.timer > DOOR_T && !this.playerHidden) {
        // le rover remonte la rampe puis embarque
        const t = ease(Math.min(1, (r.timer - DOOR_T) / RIDE_T));
        this.slideRover(r.roverFrom, door, t);
        if (t >= 1) {
          this.playerHidden = true;
          this.emitBurst(door.x, door.y, '#7fe7f0', 12);
        }
      }

      if (r.timer > HOLD + DOOR_T) {
        r.state = 'leaving';
        r.vy = 1.2;
      }
    } else {
      r.vy += 10 * dt;
      r.yBottom -= r.vy * dt;
      this.emitRocketExhaust(r, dt);
      if (r.yBottom < -24) this.finishRocket();
    }
  }

  // centre (en tuiles) de l'ouverture de la porte-rampe, côté droit de la fusée
  private rocketDoor(r: Rocket) {
    return { x: r.x + 0.4, y: r.yBottom - 1.05 };
  }

  // place le rover sur la rampe en interpolant entre deux centres (tuiles)
  private slideRover(from: { x: number; y: number }, to: { x: number; y: number }, t: number) {
    const p = this.player;
    p.x = from.x + (to.x - from.x) * t - p.w / 2;
    p.y = from.y + (to.y - from.y) * t - p.h / 2;
    p.vx = 0;
    p.vy = 0;
    p.flying = false;
    if (Math.abs(to.x - from.x) > 0.05) p.facing = to.x > from.x ? 1 : -1;
  }

  private emitRocketExhaust(r: Rocket, dt: number) {
    if (Math.random() > dt * 40) return;
    this.particles.push({
      x: r.x + (Math.random() - 0.5) * 0.7,
      y: r.yBottom + 0.1,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 1 + Math.random() * 2,
      life: 0.8,
      maxLife: 0.8,
      color: Math.random() < 0.4 ? 'rgba(255,160,60,0.8)' : 'rgba(160,160,170,0.7)',
      size: 5 + Math.random() * 4,
      g: -0.04,
    });
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
    this.flashes.push({ x: d.x, y: d.y, age: 0 });
    this.digging = null; // le terrain a pu changer sous la foreuse
    const p = this.player;
    const dist = Math.hypot(p.x + p.w / 2 - d.x, p.y + p.h / 2 - d.y);
    const reach = DYNAMITE_RADIUS + 1;
    return dist >= reach ? 0 : DYNAMITE_DMG * (1 - dist / reach);
  }

  saveGame() {
    const s = useGameStore.getState();
    // pas de sauvegarde avant le début effectif de la mission : le démontage
    // StrictMode (ou un rechargement pendant la cinématique d'arrivée)
    // écrirait sinon une partie « déjà commencée » et sauterait l'intro
    if (s.ui === 'cinematic' || s.ui === 'story') return;
    saveNow({
      seed: this.world.seed,
      dug: [...this.world.dug],
      planet: s.planet,
      money: s.money,
      fuel: s.fuel,
      hull: s.hull,
      cargo: s.cargo,
      upgrades: s.upgrades,
      teleporters: s.teleporters,
      dynamites: s.dynamites,
      maxDepth: s.maxDepth,
      time: this.time,
      layout: s.layout,
      player: { x: this.player.x, y: this.player.y },
    });
  }

  // ── Particules ─────────────────────────────────────────────────────────────

  // Blizzard de la planète gelée : flocons soufflés en diagonale par le vent
  private emitAmbient(dt: number) {
    if (getPlanet(useGameStore.getState().planet).theme.particles !== 'snow') return;
    if (this.camY > 6) return; // pas de neige en profondeur
    this.snowTimer -= dt;
    if (this.snowTimer > 0) return;
    this.snowTimer = 0.025;
    const wTiles = this.viewW / TILE;
    const hTiles = this.viewH / TILE;
    const gust = 2.4 + Math.sin(this.time * 0.6) * 1.6; // rafales de vent
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        // émis au-dessus et sur le bord droit (le vent pousse vers la gauche)
        x: this.camX + Math.random() * (wTiles + 4) - 2,
        y: this.camY - 0.5 + Math.random() * hTiles * 0.5,
        vx: -(gust + Math.random() * 2),
        vy: 1.4 + Math.random() * 1.8,
        life: 3.5,
        maxLife: 3.5,
        color: `rgba(255,255,255,${0.5 + Math.random() * 0.4})`,
        size: 2 + Math.random() * 3,
        g: 0.03,
      });
    }
  }

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
        size: 3 + Math.random() * 3,
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
        size: 3 + Math.random() * 4,
      });
    }
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += GRAVITY * (pt.g ?? 0.6) * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < 0.45);
    for (const fl of this.floaters) fl.age += dt;
    this.floaters = this.floaters.filter((fl) => fl.age < FLOATER_LIFE);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
  }

  // animation de dégâts : flash + secousse + PV perdus en texte flottant
  private hurt(dmg: number) {
    this.hurtTimer = 0.5;
    if (dmg >= 1) {
      const p = this.player;
      this.floaters.push({
        x: p.x + p.w / 2,
        y: p.y - 0.3,
        text: `−${Math.round(dmg)} PV`,
        color: '#ff5a4f',
        age: 0,
      });
    }
  }
}

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
