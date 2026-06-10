import {
  BUILDINGS,
  CAVE_MIN_DEPTH,
  ORE_BANDS,
  TILES,
  WORLD_W,
  caveChance,
  type TileDef,
  type TileKind,
} from './constants';
import { mulberry32 } from './rng';

const BAND_FADE = 25; // tuiles de fondu en bord de bande de minerai

export class World {
  readonly seed: number;
  private rows = new Map<number, TileKind[]>();
  readonly dug = new Set<number>(); // clé = y * WORLD_W + x

  constructor(seed: number, dug?: number[]) {
    this.seed = seed;
    if (dug) for (const k of dug) this.dug.add(k);
  }

  getTile(x: number, y: number): TileKind {
    if (y < 0) return 'empty';
    if (x <= 0 || x >= WORLD_W - 1) return 'bedrock';
    if (this.dug.has(y * WORLD_W + x)) return 'empty';
    return this.row(y)[x];
  }

  isSolid(x: number, y: number): boolean {
    return TILES[this.getTile(x, y)].solid;
  }

  // Creuse la tuile et renvoie sa définition (null si non forable)
  dig(x: number, y: number): TileDef | null {
    const kind = this.getTile(x, y);
    if (!TILES[kind].diggable) return null;
    this.dug.add(y * WORLD_W + x);
    return TILES[kind];
  }

  private row(y: number): TileKind[] {
    let r = this.rows.get(y);
    if (!r) {
      r = this.generateRow(y);
      this.rows.set(y, r);
    }
    return r;
  }

  private generateRow(y: number): TileKind[] {
    const rng = mulberry32((this.seed ^ Math.imul(y + 1, 2654435761)) >>> 0);
    const row: TileKind[] = new Array(WORLD_W);
    for (let x = 0; x < WORLD_W; x++) {
      if (x <= 0 || x >= WORLD_W - 1) {
        row[x] = 'bedrock';
        continue;
      }
      if (y === 0) {
        // fondations indestructibles sous les bâtiments de surface
        const underBuilding = BUILDINGS.some(({ range }) => x >= range[0] && x <= range[1]);
        row[x] = underBuilding ? 'foundation' : 'dirt';
        continue;
      }
      // grottes : poches de vide naturelles
      if (y >= CAVE_MIN_DEPTH && rng() < caveChance(y)) {
        row[x] = 'empty';
        continue;
      }
      const hardChance = y > 120 ? Math.min(0.5, (y - 120) * 0.003) : 0;
      const rockChance = Math.min(0.8, 0.08 + y * 0.004);
      const r1 = rng();
      let kind: TileKind =
        r1 < hardChance ? 'hardrock' : r1 < hardChance + rockChance ? 'rock' : 'dirt';
      // Minerai par-dessus la roche de base
      const r2 = rng();
      let acc = 0;
      for (const band of ORE_BANDS) {
        const ramp = Math.min(1, (y - band.min) / BAND_FADE, (band.max - y) / BAND_FADE);
        if (ramp <= 0) continue;
        acc += band.p * ramp;
        if (r2 < acc) {
          kind = band.ore;
          break;
        }
      }
      row[x] = kind;
    }
    return row;
  }
}
