// ── Planètes ─────────────────────────────────────────────────────────────────
// Chaque planète regroupe ses minerais, bandes de profondeur, dangers, paliers
// d'améliorations, palette visuelle et textes d'histoire. Le reste du jeu
// (world, store, engine, renderer) lit la config de la planète active plutôt
// que des constantes globales — ce qui permet d'enchaîner les planètes.
//
// XK-712 (planète 1) référence les littéraux historiques de constants.ts : elle
// reste donc identique au pixel/comportement près.
import {
  CARGO_TIERS,
  CAVE_MIN_DEPTH,
  BOULDER_MIN_DEPTH,
  DRILL_TIERS,
  HULL_TIERS,
  JETPACK_TIERS,
  LAVA_DPS,
  LAVA_MIN_DEPTH,
  MISSION_GOAL,
  ORE_BANDS,
  RADIATOR_TIERS,
  TANK_TIERS,
  boulderChance,
  caveChance,
  lavaChance,
  type OreBand,
  type OreId,
  type Tier,
  type TileKind,
} from "./constants";

export type PlanetId = "xk712" | "frost";
export type RGB = [number, number, number];

export interface PlanetTheme {
  sky: {
    nightTop: RGB;
    dayTop: RGB;
    nightMid: RGB;
    dayMid: RGB;
    nightBot: RGB;
    dayBot: RGB;
    sunsetTop: RGB;
    sunsetMid: RGB;
    sunsetBot: RGB;
  };
  hillsNear: { night: RGB; day: RGB };
  hillsFar: { night: RGB; day: RGB };
  cloudNight: RGB;
  cloudDay: RGB;
  depthTints: { d: number; c: RGB }[];
  surface: "grass" | "snow";
  particles: "none" | "snow";
}

export interface UpgradeLadders {
  drill: Tier[];
  tank: Tier[];
  hull: Tier[];
  jetpack: Tier[];
  cargo: Tier[];
  thermal: Tier[]; // ex-radiateur : protection contre le danger thermique
}

export interface PlanetConfig {
  id: PlanetId;
  name: string;
  missionGoal: number;
  next: PlanetId | null;
  oreIds: OreId[];
  oreBands: OreBand[];
  cave: { minDepth: number; chance: (d: number) => number };
  boulder: { minDepth: number; chance: (d: number) => number; tile: TileKind };
  hazard: {
    kind: TileKind;
    minDepth: number;
    chance: (d: number) => number;
    dps: number;
  };
  terrain: {
    soil: TileKind;
    softRock: TileKind;
    hardRock: TileKind;
    bedrock: TileKind;
    foundation: TileKind;
  };
  ladders: UpgradeLadders;
  // libellé du slot « thermal » dans l'atelier/inventaire (radiateur vs isolation)
  thermalLabel: { title: string; statLabel: (s: number) => string };
  theme: PlanetTheme;
  story: { title: string; paragraphs: string[]; beginLabel: string };
  victory: { title: string; paragraphs: string[]; boardLabel?: string };
}

const XK712_THEME: PlanetTheme = {
  sky: {
    nightTop: [6, 9, 26],
    dayTop: [47, 126, 207],
    nightMid: [13, 19, 46],
    dayMid: [116, 180, 232],
    nightBot: [28, 35, 68],
    dayBot: [207, 232, 250],
    sunsetTop: [86, 60, 110],
    sunsetMid: [205, 110, 90],
    sunsetBot: [255, 150, 90],
  },
  hillsNear: { night: [16, 24, 34], day: [111, 158, 106] },
  hillsFar: { night: [11, 18, 26], day: [78, 127, 82] },
  cloudNight: [150, 160, 185],
  cloudDay: [255, 255, 255],
  depthTints: [
    { d: 0, c: [48, 32, 18] },
    { d: 80, c: [26, 34, 18] },
    { d: 160, c: [18, 62, 32] },
    { d: 300, c: [18, 38, 86] },
    { d: 460, c: [56, 24, 90] },
    { d: 640, c: [96, 20, 24] },
  ],
  surface: "grass",
  particles: "none",
};

const FROST_THEME: PlanetTheme = {
  sky: {
    nightTop: [8, 14, 32],
    dayTop: [120, 150, 200],
    nightMid: [16, 26, 54],
    dayMid: [170, 200, 235],
    nightBot: [30, 42, 72],
    dayBot: [225, 240, 250],
    sunsetTop: [150, 140, 190],
    sunsetMid: [205, 170, 200],
    sunsetBot: [235, 205, 210],
  },
  hillsNear: { night: [40, 55, 75], day: [180, 200, 215] },
  hillsFar: { night: [30, 42, 60], day: [150, 175, 195] },
  cloudNight: [170, 180, 200],
  cloudDay: [255, 255, 255],
  depthTints: [
    { d: 0, c: [60, 82, 104] },
    { d: 80, c: [40, 66, 98] },
    { d: 160, c: [28, 58, 102] },
    { d: 300, c: [22, 46, 104] },
    { d: 460, c: [26, 40, 90] },
    { d: 640, c: [36, 30, 72] },
  ],
  surface: "snow",
  particles: "snow",
};

// Paliers de la planète gelée : 8 niveaux, plus puissants et plus chers.
const FROST_DRILL: Tier[] = [
  { name: "Foret standard", price: 0, stat: 1 },
  { name: "Foret cryo", price: 750, stat: 1.4 },
  { name: "Trépan polaire", price: 2000, stat: 1.9 },
  { name: "Lame de givre", price: 8000, stat: 2.6 },
  { name: "Foret diamant", price: 30000, stat: 3.4 },
  { name: "Perceuse sonique", price: 120000, stat: 4.5 },
  { name: "Foret plasma", price: 500000, stat: 5.8 },
  { name: "Désintégrateur", price: 2000000, stat: 7 },
];

const FROST_TANK: Tier[] = [
  { name: "120 L", price: 0, stat: 120 },
  { name: "180 L", price: 750, stat: 180 },
  { name: "300 L", price: 2000, stat: 300 },
  { name: "500 L", price: 8000, stat: 500 },
  { name: "800 L", price: 30000, stat: 800 },
  { name: "1300 L", price: 120000, stat: 1300 },
  { name: "2000 L", price: 500000, stat: 2000 },
  { name: "2800 L", price: 2000000, stat: 2800 },
];

const FROST_HULL: Tier[] = [
  { name: "Tôle isolée", price: 0, stat: 120 },
  { name: "Cobaltium", price: 750, stat: 200 },
  { name: "Acier polaire", price: 2000, stat: 360 },
  { name: "Composite", price: 8000, stat: 600 },
  { name: "Blindage cryo", price: 30000, stat: 1000 },
  { name: "Titane", price: 120000, stat: 1600 },
  { name: "Coque énergétique", price: 500000, stat: 2400 },
  { name: "Coque quantique", price: 2000000, stat: 3200 },
];

const FROST_JETPACK: Tier[] = [
  { name: "Stock", price: 0, stat: 1 },
  { name: "Bi-turbine", price: 750, stat: 1.12 },
  { name: "Turbo givre", price: 2000, stat: 1.25 },
  { name: "Réacteur V8", price: 8000, stat: 1.4 },
  { name: "Plasma V12", price: 30000, stat: 1.55 },
  { name: "Propulseur ionique", price: 120000, stat: 1.7 },
  { name: "Réacteur à fusion", price: 500000, stat: 1.85 },
  { name: "Antigravité", price: 2000000, stat: 2 },
];

const FROST_CARGO: Tier[] = [
  { name: "Micro", price: 0, stat: 12 },
  { name: "Compacte", price: 750, stat: 18 },
  { name: "Large", price: 2000, stat: 30 },
  { name: "Énorme", price: 8000, stat: 50 },
  { name: "Titanesque", price: 30000, stat: 90 },
  { name: "Léviathan", price: 120000, stat: 150 },
  { name: "Abyssale", price: 500000, stat: 240 },
  { name: "Compression de matière", price: 2000000, stat: 360 },
];

// stat = fraction des dégâts de froid absorbée (isolation thermique)
const FROST_THERMAL: Tier[] = [
  { name: "Combinaison", price: 0, stat: 0 },
  { name: "Isolant simple", price: 2000, stat: 0.12 },
  { name: "Double paroi", price: 8000, stat: 0.28 },
  { name: "Chauffage actif", price: 30000, stat: 0.45 },
  { name: "Réacteur thermique", price: 120000, stat: 0.6 },
  { name: "Bouclier infrarouge", price: 500000, stat: 0.75 },
  { name: "Noyau à fusion", price: 2000000, stat: 0.85 },
  { name: "Cocon stellaire", price: 8000000, stat: 0.92 },
];

const FROST_BANDS: OreBand[] = [
  { ore: "aurorium", mu: 1200, sigma: 160, p: 0.0045, plateau: true },
  { ore: "cryocrystal", mu: 760, sigma: 130, p: 0.009 },
  { ore: "borealite", mu: 480, sigma: 100, p: 0.018 },
  { ore: "cryolite", mu: 260, sigma: 75, p: 0.035 },
  { ore: "cobaltium", mu: 130, sigma: 50, p: 0.05 },
  { ore: "glacium", mu: 40, sigma: 28, p: 0.07 },
];

export const PLANETS: Record<PlanetId, PlanetConfig> = {
  xk712: {
    id: "xk712",
    name: "XK-712",
    missionGoal: MISSION_GOAL,
    next: "frost",
    oreIds: [
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
    ],
    oreBands: ORE_BANDS,
    cave: { minDepth: CAVE_MIN_DEPTH, chance: caveChance },
    boulder: { minDepth: BOULDER_MIN_DEPTH, chance: boulderChance, tile: "boulder" },
    hazard: { kind: "lava", minDepth: LAVA_MIN_DEPTH, chance: lavaChance, dps: LAVA_DPS },
    terrain: {
      soil: "dirt",
      softRock: "rock",
      hardRock: "hardrock",
      bedrock: "bedrock",
      foundation: "foundation",
    },
    ladders: {
      drill: DRILL_TIERS,
      tank: TANK_TIERS,
      hull: HULL_TIERS,
      jetpack: JETPACK_TIERS,
      cargo: CARGO_TIERS,
      thermal: RADIATOR_TIERS,
    },
    thermalLabel: {
      title: "Radiateur (protection lave)",
      statLabel: (s) => `−${Math.round(s * 100)} %`,
    },
    theme: XK712_THEME,
    story: {
      title: "🛰 XK-712 — Contrat n° 88-417",
      paragraphs: [
        "An 2087. La Compagnie Minière Trans-Stellaire vous a vendu un rêve : une foreuse d'occasion, un aller simple pour la planète naine XK-712, et une promesse — les filons les plus riches du secteur.",
        "Le contrat, lui, est moins poétique. La Compagnie réclame {goal} pour solder votre dette : la foreuse, le voyage, l'oxygène, et les « frais de dossier ». Tant que la somme n'est pas réunie, aucune fusée ne viendra vous chercher.",
        "Creusez. Vendez. Méfiez-vous de la lave, des chutes et de la panne sèche. Et quand votre compte affichera la somme, rappelez la fusée.",
      ],
      beginLabel: "⛏ Commencer à creuser [Entrée]",
    },
    victory: {
      title: "🚀 Dette remboursée !",
      paragraphs: [
        "La fusée s'arrache du sol de XK-712, et pour la première fois depuis longtemps, ce n'est pas le compteur de carburant que vous regardez — c'est le ciel.",
        "La Compagnie « vous félicite pour votre professionnalisme » et a déjà un nouveau contrat : la planète gelée KX-09. Plus profond, plus froid, plus cher.",
      ],
      boardLabel: "🚀 Embarquer pour KX-09",
    },
  },

  frost: {
    id: "frost",
    name: "KX-09 « Sialis »",
    missionGoal: 50_000_000,
    next: null,
    oreIds: ["glacium", "cobaltium", "cryolite", "borealite", "cryocrystal", "aurorium"],
    oreBands: FROST_BANDS,
    cave: { minDepth: 2, chance: (d) => Math.min(0.1, 0.03 + d * 0.0004) },
    boulder: {
      minDepth: 50,
      chance: (d) => Math.min(0.055, 0.014 + (d - 50) * 0.00022),
      tile: "iceboulder",
    },
    hazard: {
      kind: "cold",
      minDepth: 280,
      chance: (d) => Math.min(0.08, 0.01 + (d - 280) * 0.00013),
      dps: 75,
    },
    terrain: {
      soil: "snow",
      softRock: "ice",
      hardRock: "hardice",
      bedrock: "bedrock",
      foundation: "foundation",
    },
    ladders: {
      drill: FROST_DRILL,
      tank: FROST_TANK,
      hull: FROST_HULL,
      jetpack: FROST_JETPACK,
      cargo: FROST_CARGO,
      thermal: FROST_THERMAL,
    },
    thermalLabel: {
      title: "Isolation thermique (protection froid)",
      statLabel: (s) => `−${Math.round(s * 100)} %`,
    },
    theme: FROST_THEME,
    story: {
      title: "❄ KX-09 « Sialis » — Contrat n° 88-902",
      paragraphs: [
        "La fusée vous dépose sur KX-09, surnommée Sialis : un monde de glace battu par le vent, où le thermomètre n'a pas de fond. La Compagnie a déjà un nouveau contrat — évidemment.",
        "Cette fois la dette se chiffre à {goal}. Mais les filons de Sialis — cobaltium, cryolite, et l'insaisissable aurorium — valent des fortunes.",
        "Forez. Vendez. Ce n'est plus la lave qui vous guette mais les poches de froid qui gèlent la coque — équipez une isolation thermique. Et quand le compte sera plein, rappelez la fusée.",
      ],
      beginLabel: "❄ Commencer le forage [Entrée]",
    },
    victory: {
      title: "🚀 Sialis conquise !",
      paragraphs: [
        "La fusée s'arrache de la banquise de KX-09. Deux mondes, deux dettes soldées. La Compagnie n'a plus rien à vous vendre — pour l'instant.",
        "Vous regardez les étoiles défiler. Quelque part, il y a forcément un autre contrat. Mais ce soir, vous êtes libre.",
      ],
    },
  },
};

export const getPlanet = (id: PlanetId): PlanetConfig => PLANETS[id];
