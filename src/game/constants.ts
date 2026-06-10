// ── Monde ────────────────────────────────────────────────────────────────────
export const TILE = 44; // pixels par tuile
export const WORLD_W = 32; // largeur du monde en tuiles
export const SPAWN_X = 28;
export const SKY_LIMIT = -9; // altitude max de vol (en tuiles)

export type OreId =
  | 'coal'
  | 'iron'
  | 'silver'
  | 'gold'
  | 'ruby'
  | 'emerald'
  | 'diamond';

export type TileKind =
  | 'empty'
  | 'dirt'
  | 'rock'
  | 'hardrock'
  | 'bedrock'
  | 'foundation'
  | OreId;

export interface TileDef {
  name: string;
  hardness: number;
  solid: boolean;
  diggable: boolean;
  value?: number;
  base: string; // couleur de fond
  speckle: string; // couleur des grains
  gem?: string; // couleur du minerai incrusté
}

export const TILES: Record<TileKind, TileDef> = {
  empty: { name: 'Vide', hardness: 0, solid: false, diggable: false, base: '', speckle: '' },
  dirt: { name: 'Terre', hardness: 1, solid: true, diggable: true, base: '#8a5a2b', speckle: '#6e4520' },
  rock: { name: 'Roche', hardness: 2.4, solid: true, diggable: true, base: '#75757e', speckle: '#5a5a63' },
  hardrock: { name: 'Roche dure', hardness: 4.6, solid: true, diggable: true, base: '#54545e', speckle: '#3e3e47' },
  bedrock: { name: 'Roche-mère', hardness: 0, solid: true, diggable: false, base: '#26262c', speckle: '#17171b' },
  foundation: { name: 'Fondations', hardness: 0, solid: true, diggable: false, base: '#9aa1a8', speckle: '#7d848c' },
  coal: { name: 'Charbon', hardness: 1.4, solid: true, diggable: true, value: 9, base: '#7c5126', speckle: '#624018', gem: '#23232a' },
  iron: { name: 'Fer', hardness: 2.4, solid: true, diggable: true, value: 30, base: '#7c5126', speckle: '#624018', gem: '#d28b54' },
  silver: { name: 'Argent', hardness: 3, solid: true, diggable: true, value: 75, base: '#6e6e77', speckle: '#55555e', gem: '#dde2ec' },
  gold: { name: 'Or', hardness: 3.6, solid: true, diggable: true, value: 190, base: '#6e6e77', speckle: '#55555e', gem: '#f6c945' },
  ruby: { name: 'Rubis', hardness: 5, solid: true, diggable: true, value: 460, base: '#54545e', speckle: '#3e3e47', gem: '#ef3b58' },
  emerald: { name: 'Émeraude', hardness: 6, solid: true, diggable: true, value: 1050, base: '#54545e', speckle: '#3e3e47', gem: '#31d178' },
  diamond: { name: 'Diamant', hardness: 8, solid: true, diggable: true, value: 2700, base: '#46464f', speckle: '#33333b', gem: '#8deef7' },
};

export const ORE_IDS: OreId[] = ['coal', 'iron', 'silver', 'gold', 'ruby', 'emerald', 'diamond'];

// Bandes de profondeur : probabilité d'apparition par tuile, avec fondu aux bords
export interface OreBand { ore: OreId; min: number; max: number; p: number }
export const ORE_BANDS: OreBand[] = [
  { ore: 'diamond', min: 500, max: Infinity, p: 0.009 },
  { ore: 'emerald', min: 350, max: 900, p: 0.013 },
  { ore: 'ruby', min: 220, max: 600, p: 0.018 },
  { ore: 'gold', min: 120, max: 420, p: 0.026 },
  { ore: 'silver', min: 60, max: 260, p: 0.034 },
  { ore: 'iron', min: 14, max: 170, p: 0.05 },
  { ore: 'coal', min: 2, max: 85, p: 0.07 },
];

// Poches de vide naturelles (grottes) : probabilité par tuile
export const CAVE_MIN_DEPTH = 2;
export const caveChance = (depth: number) => Math.min(0.1, 0.03 + depth * 0.0004);

// ── Améliorations ────────────────────────────────────────────────────────────
export interface Tier { name: string; price: number; stat: number }

// stat = multiplicateur de vitesse de forage
export const DRILL_TIERS: Tier[] = [
  { name: 'Standard', price: 0, stat: 1 },
  { name: 'Acier', price: 150, stat: 1.7 },
  { name: 'Carbure', price: 700, stat: 2.6 },
  { name: 'Diamantée', price: 2800, stat: 3.8 },
  { name: 'Plasma', price: 10000, stat: 5.5 },
];

// stat = capacité du réservoir en litres
export const TANK_TIERS: Tier[] = [
  { name: '100 L', price: 0, stat: 100 },
  { name: '170 L', price: 120, stat: 170 },
  { name: '280 L', price: 550, stat: 280 },
  { name: '450 L', price: 2200, stat: 450 },
  { name: '750 L', price: 8000, stat: 750 },
];

// stat = multiplicateur de vitesse de vol (jetpack)
export const JETPACK_TIERS: Tier[] = [
  { name: 'Standard', price: 0, stat: 1 },
  { name: 'Turbine', price: 200, stat: 1.3 },
  { name: 'Biréacteur', price: 900, stat: 1.6 },
  { name: 'Vectoriel', price: 3600, stat: 2 },
  { name: 'Ionique', price: 13000, stat: 2.5 },
];

// stat = points de coque
export const HULL_TIERS: Tier[] = [
  { name: 'Tôle', price: 0, stat: 100 },
  { name: 'Acier', price: 180, stat: 170 },
  { name: 'Titane', price: 800, stat: 280 },
  { name: 'Composite', price: 3200, stat: 450 },
  { name: 'Nanoblindage', price: 12000, stat: 750 },
];
// réduction des dégâts de chute par palier de coque
export const HULL_DMG_FACTOR = [1, 0.85, 0.7, 0.55, 0.4];

export const FUEL_PRICE = 1; // $ / litre
export const REPAIR_PRICE = 1.5; // $ / point de coque
export const TELEPORTER_PRICE = 300;

// ── Physique ─────────────────────────────────────────────────────────────────
export const GRAVITY = 28; // tuiles/s²
export const MAX_FALL = 20; // tuiles/s
export const MOVE_SPEED = 5.2; // tuiles/s
export const FLY_ACCEL = 38; // tuiles/s²
export const MAX_FLY = 7.5; // tuiles/s
export const SAFE_FALL_SPEED = 13; // au-delà : dégâts
export const FALL_DMG_FACTOR = 6; // dégâts par tuile/s au-delà du seuil

// Consommation d'essence (L/s) — rien n'est consommé à l'arrêt
export const BURN_MOVE = 0.4;
export const BURN_DIG = 0.7;
export const BURN_FLY = 1.2;

export const DIG_BASE_TIME = 0.6; // s par point de dureté, foreuse standard
export const DIG_DEPTH_FACTOR = 0.003; // durcissement du sol avec la profondeur

// ── Bâtiments de surface (plages de tuiles en x) ─────────────────────────────
export type BuildingId = 'sell' | 'fuel' | 'garage';
export const BUILDINGS: { id: BuildingId; range: [number, number] }[] = [
  { id: 'sell', range: [2, 5] }, // vente des minerais
  { id: 'fuel', range: [8, 11] }, // pompe à essence
  { id: 'garage', range: [20, 24] }, // améliorations + réparations
];

export function digTime(kind: TileKind, depth: number, drillTier: number): number {
  return (
    (TILES[kind].hardness * DIG_BASE_TIME * (1 + Math.max(0, depth) * DIG_DEPTH_FACTOR)) /
    DRILL_TIERS[drillTier].stat
  );
}

export function cargoValue(cargo: Partial<Record<OreId, number>>): number {
  return ORE_IDS.reduce((sum, id) => sum + (cargo[id] ?? 0) * (TILES[id].value ?? 0), 0);
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}
