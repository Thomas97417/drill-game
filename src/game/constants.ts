// ── Monde ────────────────────────────────────────────────────────────────────
export const TILE = 52; // pixels par tuile
export const WORLD_W = 32; // largeur du monde en tuiles
export const SPAWN_X = 28;
export const SKY_LIMIT = -9; // altitude max de vol (en tuiles)
export const DAY_CYCLE = 240; // durée d'un cycle jour+nuit complet (secondes)

export type OreId =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "einsteinium"
  | "emerald"
  | "ruby"
  | "diamond"
  | "amazonite";

export type TileKind =
  | "empty"
  | "dirt"
  | "rock"
  | "hardrock"
  | "bedrock"
  | "foundation"
  | "boulder"
  | "lava"
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
  empty: {
    name: "Vide",
    hardness: 0,
    solid: false,
    diggable: false,
    base: "",
    speckle: "",
  },
  dirt: {
    name: "Terre",
    hardness: 1,
    solid: true,
    diggable: true,
    base: "#8a5a2b",
    speckle: "#6e4520",
  },
  rock: {
    name: "Roche",
    hardness: 2.4,
    solid: true,
    diggable: true,
    base: "#75757e",
    speckle: "#5a5a63",
  },
  hardrock: {
    name: "Roche dure",
    hardness: 4.6,
    solid: true,
    diggable: true,
    base: "#54545e",
    speckle: "#3e3e47",
  },
  bedrock: {
    name: "Roche-mère",
    hardness: 0,
    solid: true,
    diggable: false,
    base: "#26262c",
    speckle: "#17171b",
  },
  foundation: {
    name: "Fondations",
    hardness: 0,
    solid: true,
    diggable: false,
    base: "#9aa1a8",
    speckle: "#7d848c",
  },
  boulder: {
    name: "Rocher",
    hardness: 0,
    solid: true,
    diggable: false,
    base: "#6b6258",
    speckle: "#4f463d",
  },
  lava: {
    name: "Lave",
    hardness: 2,
    solid: true,
    diggable: true,
    base: "#3a1408",
    speckle: "#7a2410",
    gem: "#ff7b2d",
  },
  iron: {
    name: "Ironium",
    hardness: 1.2,
    solid: true,
    diggable: true,
    value: 30,
    base: "#7c5126",
    speckle: "#624018",
    gem: "#9aa4b2",
  },
  bronze: {
    name: "Bronzium",
    hardness: 1.6,
    solid: true,
    diggable: true,
    value: 60,
    base: "#7c5126",
    speckle: "#624018",
    gem: "#cd8a3c",
  },
  silver: {
    name: "Silverium",
    hardness: 2,
    solid: true,
    diggable: true,
    value: 100,
    base: "#6e6e77",
    speckle: "#55555e",
    gem: "#dde2ec",
  },
  gold: {
    name: "Goldium",
    hardness: 2.6,
    solid: true,
    diggable: true,
    value: 250,
    base: "#6e6e77",
    speckle: "#55555e",
    gem: "#f6c945",
  },
  platinum: {
    name: "Platinium",
    hardness: 3.4,
    solid: true,
    diggable: true,
    value: 750,
    base: "#54545e",
    speckle: "#3e3e47",
    gem: "#8fd0ec",
  },
  einsteinium: {
    name: "Einsteinium",
    hardness: 4.2,
    solid: true,
    diggable: true,
    value: 2000,
    base: "#54545e",
    speckle: "#3e3e47",
    gem: "#b86bff",
  },
  emerald: {
    name: "Émeraude",
    hardness: 5,
    solid: true,
    diggable: true,
    value: 5000,
    base: "#54545e",
    speckle: "#3e3e47",
    gem: "#31d178",
  },
  ruby: {
    name: "Rubis",
    hardness: 6,
    solid: true,
    diggable: true,
    value: 20000,
    base: "#46464f",
    speckle: "#33333b",
    gem: "#ef3b58",
  },
  diamond: {
    name: "Diamant",
    hardness: 7.5,
    solid: true,
    diggable: true,
    value: 100000,
    base: "#46464f",
    speckle: "#33333b",
    gem: "#8deef7",
  },
  amazonite: {
    name: "Amazonite",
    hardness: 9,
    solid: true,
    diggable: true,
    value: 500000,
    base: "#3c3c45",
    speckle: "#2b2b33",
    gem: "#3fd9c2",
  },
};

export const ORE_IDS: OreId[] = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "einsteinium",
  "emerald",
  "ruby",
  "diamond",
  "amazonite",
];

// Probabilité d'apparition par tuile, modélisée en gaussienne de la profondeur :
// p(d) = p × exp(−(d − mu)² / 2σ²). `plateau` garde p constant au-delà du pic
// (pour le minerai le plus profond, sans limite basse).
export interface OreBand {
  ore: OreId;
  mu: number; // profondeur du pic d'abondance
  sigma: number; // étalement du filon
  p: number; // probabilité au pic
  plateau?: boolean;
}
export const ORE_BANDS: OreBand[] = [
  { ore: "amazonite", mu: 1400, sigma: 160, p: 0.004, plateau: true },
  { ore: "diamond", mu: 1050, sigma: 140, p: 0.006 },
  { ore: "ruby", mu: 850, sigma: 120, p: 0.009 },
  { ore: "emerald", mu: 700, sigma: 110, p: 0.012 },
  { ore: "einsteinium", mu: 550, sigma: 100, p: 0.016 },
  { ore: "platinum", mu: 420, sigma: 85, p: 0.022 },
  { ore: "gold", mu: 300, sigma: 75, p: 0.03 },
  { ore: "silver", mu: 200, sigma: 60, p: 0.04 },
  { ore: "bronze", mu: 110, sigma: 45, p: 0.05 },
  { ore: "iron", mu: 40, sigma: 28, p: 0.07 },
];

// Enveloppe gaussienne d'une bande à la profondeur d.
// La queue côté surface est tronquée à 2σ : pas de gemme « égarée » trop haut,
// mais la queue profonde reste intacte (y trouver un minerai attardé est sans
// danger pour l'équilibre).
export function oreEnvelope(band: OreBand, d: number): number {
  if (d < band.mu - 2 * band.sigma) return 0;
  if (band.plateau && d >= band.mu) return 1;
  const z = (d - band.mu) / band.sigma;
  return Math.exp(-0.5 * z * z);
}

// Poches de vide naturelles (grottes) : probabilité par tuile
export const CAVE_MIN_DEPTH = 2;
export const caveChance = (depth: number) =>
  Math.min(0.1, 0.03 + depth * 0.0004);

// Rochers : infranchissables à la foreuse, seule la dynamite en vient à bout.
// Ils n'apparaissent qu'à partir de la couche de l'argent.
export const BOULDER_MIN_DEPTH = 60;
export const boulderChance = (depth: number) =>
  Math.min(0.05, 0.012 + (depth - BOULDER_MIN_DEPTH) * 0.0002);

// Lave : forer dedans brûle la coque ; de plus en plus fréquente en profondeur
export const LAVA_MIN_DEPTH = 350;
export const lavaChance = (depth: number) =>
  Math.min(0.07, 0.008 + (depth - LAVA_MIN_DEPTH) * 0.00012);
export const LAVA_DPS = 90; // dégâts de coque par seconde de forage dans la lave

// ── Dynamite ─────────────────────────────────────────────────────────────────
export const DYNAMITE_PRICE = 750; // les Explosives de Motherload
export const DYNAMITE_FUSE = 3; // secondes pour s'éloigner avant l'explosion
export const DYNAMITE_RADIUS = 2.2; // rayon de destruction (tuiles)
export const DYNAMITE_DMG = 80; // dégâts au centre, décroissants avec la distance

// ── Améliorations ────────────────────────────────────────────────────────────
export interface Tier {
  name: string;
  price: number;
  stat: number;
}

// Grille de prix Motherload : 750, 2 000, 5 000, 20 000, 100 000, 500 000 $

// stat = multiplicateur de vitesse de forage
export const DRILL_TIERS: Tier[] = [
  { name: "Standard", price: 0, stat: 1 },
  { name: "Silvide", price: 750, stat: 1.3 },
  { name: "Goldium", price: 2000, stat: 1.8 },
  { name: "Émeraude", price: 5000, stat: 2.4 },
  { name: "Rubis", price: 20000, stat: 3.2 },
  { name: "Diamant", price: 100000, stat: 4.2 },
  { name: "Amazonite", price: 500000, stat: 5.5 },
];

// stat = capacité du réservoir en litres
export const TANK_TIERS: Tier[] = [
  { name: "100 L", price: 0, stat: 100 },
  { name: "150 L", price: 750, stat: 150 },
  { name: "250 L", price: 2000, stat: 250 },
  { name: "400 L", price: 5000, stat: 400 },
  { name: "600 L", price: 20000, stat: 600 },
  { name: "1000 L", price: 100000, stat: 1000 },
  { name: "1500 L", price: 500000, stat: 1500 },
];

// stat = multiplicateur de vitesse (déplacement et vol) — l'Engine de Motherload
export const JETPACK_TIERS: Tier[] = [
  { name: "Stock", price: 0, stat: 1 },
  { name: "V4 1600cc", price: 750, stat: 1.1 },
  { name: "V4 2.0L Turbo", price: 2000, stat: 1.22 },
  { name: "V6 3.8L", price: 5000, stat: 1.35 },
  { name: "V8 5.0L", price: 20000, stat: 1.5 },
  { name: "V12 6.0L", price: 100000, stat: 1.65 },
  { name: "V16 Jag", price: 500000, stat: 1.8 },
];

// stat = capacité de la soute (nombre de minerais transportables)
export const CARGO_TIERS: Tier[] = [
  { name: "Micro", price: 0, stat: 10 },
  { name: "Moyenne", price: 750, stat: 15 },
  { name: "Énorme", price: 2000, stat: 25 },
  { name: "Gigantesque", price: 5000, stat: 40 },
  { name: "Titanesque", price: 20000, stat: 70 },
  { name: "Léviathan", price: 100000, stat: 110 },
  { name: "Compression de matière", price: 500000, stat: 160 },
];

// stat = points de coque
export const HULL_TIERS: Tier[] = [
  { name: "Tôle", price: 0, stat: 100 },
  { name: "Ironium", price: 750, stat: 170 },
  { name: "Bronzium", price: 2000, stat: 300 },
  { name: "Acier", price: 5000, stat: 500 },
  { name: "Silverium", price: 20000, stat: 800 },
  { name: "Einsteinium", price: 100000, stat: 1200 },
  { name: "Blindage énergétique", price: 500000, stat: 1800 },
];
// réduction des dégâts de chute par palier de coque
export const HULL_DMG_FACTOR = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

// stat = fraction des dégâts de lave absorbée (le Radiator de Motherload)
export const RADIATOR_TIERS: Tier[] = [
  { name: "Ventilateur", price: 0, stat: 0 },
  { name: "Double ventilateur", price: 2000, stat: 0.1 },
  { name: "Turbine simple", price: 5000, stat: 0.25 },
  { name: "Double turbine", price: 20000, stat: 0.4 },
  { name: "Refroidisseur Puron", price: 100000, stat: 0.6 },
  { name: "Tri-turbine fréon", price: 500000, stat: 0.8 },
];

export const FLOATER_LIFE = 1.1; // durée de vie des textes flottants (s)

export const FUEL_PRICE = 1; // $ / litre
export const REPAIR_PRICE = 1.5; // $ / point de coque
export const TELEPORTER_PRICE = 2000; // le Matter Transmitter de Motherload


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
export const BURN_DIG = 0.7; // par point de dureté, à la surface (voir digBurn)
export const BURN_FLY = 1.2;

export const DIG_BASE_TIME = 0.6; // s par point de dureté, foreuse standard
export const DIG_DEPTH_FACTOR = 0.003; // durcissement du sol avec la profondeur
// La durée de forage augmente déjà avec la profondeur : le débit d'essence,
// lui, ne prend qu'un léger malus pour éviter un coût par bloc au carré.
export const DIG_BURN_DEPTH_FACTOR = 0.0008;

// ── Bâtiments de surface (plages de tuiles en x) ─────────────────────────────
export type BuildingId = "sell" | "fuel" | "garage";
export const BUILDINGS: { id: BuildingId; range: [number, number] }[] = [
  { id: "sell", range: [2, 5] }, // vente des minerais
  { id: "fuel", range: [8, 11] }, // pompe à essence
  { id: "garage", range: [20, 24] }, // améliorations + réparations
];

export function digDepthFactor(depth: number): number {
  return 1 + Math.max(0, depth) * DIG_DEPTH_FACTOR;
}

export function digTime(
  kind: TileKind,
  depth: number,
  drillTier: number,
): number {
  return (
    (TILES[kind].hardness * DIG_BASE_TIME * digDepthFactor(depth)) /
    DRILL_TIERS[drillTier].stat
  );
}

// Consommation pendant le forage : croît avec la dureté du bloc, et légèrement
// avec la profondeur
export function digBurn(kind: TileKind, depth: number): number {
  return (
    BURN_DIG *
    TILES[kind].hardness *
    (1 + Math.max(0, depth) * DIG_BURN_DEPTH_FACTOR)
  );
}

export function cargoValue(cargo: Partial<Record<OreId, number>>): number {
  return ORE_IDS.reduce(
    (sum, id) => sum + (cargo[id] ?? 0) * (TILES[id].value ?? 0),
    0,
  );
}

export function cargoCount(cargo: Partial<Record<OreId, number>>): number {
  return ORE_IDS.reduce((n, id) => n + (cargo[id] ?? 0), 0);
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}
