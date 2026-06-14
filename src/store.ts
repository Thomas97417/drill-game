import { create } from 'zustand';
import {
  DYNAMITE_PRICE,
  FUEL_PRICE,
  ORE_IDS,
  REPAIR_PRICE,
  TELEPORTER_PRICE,
  TILES,
  cargoLoad,
  cargoValue,
  type BuildingId,
  type OreId,
} from './game/constants';
import { getPlanet, type PlanetId } from './game/planets';
import { loadSave } from './game/save';

export type UiMode =
  | 'playing'
  | 'rescue'
  | 'inventory'
  | 'options'
  | 'cinematic'
  | 'story'
  | 'victory'
  | BuildingId;
export type KeyboardLayout = 'azerty' | 'qwerty';
export const isBuilding = (ui: UiMode): ui is BuildingId =>
  ui === 'sell' || ui === 'fuel' || ui === 'garage';
export type UpgradeKind = 'drill' | 'tank' | 'hull' | 'jetpack' | 'cargo' | 'thermal';

export interface Upgrades {
  drill: number;
  tank: number;
  hull: number;
  jetpack: number;
  cargo: number;
  thermal: number; // radiateur (lave) ou isolation thermique (froid) selon la planète
}

interface GameStore {
  planet: PlanetId;
  money: number;
  fuel: number;
  hull: number;
  cargo: Partial<Record<OreId, number>>;
  upgrades: Upgrades;
  teleporters: number;
  dynamites: number;
  depth: number;
  maxDepth: number;
  day: number;
  layout: KeyboardLayout;
  nearBuilding: BuildingId | null;
  ui: UiMode;
  rescueReason: 'fuel' | 'hull';
  // ordre à consommer par le moteur de jeu
  pendingAction: 'teleport' | 'newgame' | 'dynamite' | 'recall' | 'nextplanet' | null;

  addCargo: (ore: OreId) => void;
  sellAll: () => void;
  sellOre: (ore: OreId) => void;
  buyFuel: (liters: number) => void;
  repairHull: () => void;
  buyUpgrade: (kind: UpgradeKind) => void;
  buyTeleporter: () => void;
  useTeleporter: () => void;
  buyDynamite: () => void;
  dropDynamite: () => void;
  openShop: (building: BuildingId) => void;
  closeShop: () => void;
  toggleInventory: () => void;
  toggleOptions: () => void;
  setLayout: (layout: KeyboardLayout) => void;
  recallRocket: () => void;
  boardForNextPlanet: () => void;
  beginMission: () => void;
  continueMining: () => void;
  triggerRescue: (reason: 'fuel' | 'hull') => void;
  doRescue: () => void;
  newGame: () => void;
  clearPending: () => void;
}

// Caps dérivés des paliers de la planète active
export const maxFuelOf = (u: Upgrades) =>
  getPlanet(useGameStore.getState().planet).ladders.tank[u.tank].stat;
export const maxHullOf = (u: Upgrades) =>
  getPlanet(useGameStore.getState().planet).ladders.hull[u.hull].stat;
export const maxCargoOf = (u: Upgrades) =>
  getPlanet(useGameStore.getState().planet).ladders.cargo[u.cargo].stat;

const saved = loadSave();

const freshState = (planet: PlanetId = 'xk712') => {
  const L = getPlanet(planet).ladders;
  return {
    planet,
    money: 0,
    fuel: L.tank[0].stat,
    hull: L.hull[0].stat,
    cargo: {} as Partial<Record<OreId, number>>,
    upgrades: { drill: 0, tank: 0, hull: 0, jetpack: 0, cargo: 0, thermal: 0 },
    teleporters: 0,
    dynamites: 0,
    depth: 0,
    maxDepth: 0,
    day: 1,
    layout: 'azerty' as KeyboardLayout,
    nearBuilding: null as BuildingId | null,
    ui: 'playing' as UiMode,
    rescueReason: 'fuel' as const,
    pendingAction: null,
  };
};

export const useGameStore = create<GameStore>((set) => ({
  ...freshState(),
  ...(saved
    ? {
        planet: saved.planet ?? 'xk712',
        money: saved.money,
        fuel: saved.fuel,
        hull: saved.hull,
        // on écarte les minerais qui n'existent plus (ex. charbon)
        cargo: Object.fromEntries(
          Object.entries(saved.cargo).filter(([k]) => (ORE_IDS as string[]).includes(k)),
        ),
        // ?? 0 : sauvegardes antérieures à ces améliorations ;
        // thermal reprend l'ancien radiateur des sauvegardes v1
        upgrades: {
          drill: saved.upgrades.drill ?? 0,
          tank: saved.upgrades.tank ?? 0,
          hull: saved.upgrades.hull ?? 0,
          jetpack: saved.upgrades.jetpack ?? 0,
          cargo: saved.upgrades.cargo ?? 0,
          thermal: saved.upgrades.thermal ?? saved.upgrades.radiator ?? 0,
        },
        layout: saved.layout ?? ('azerty' as KeyboardLayout),
        teleporters: saved.teleporters,
        dynamites: saved.dynamites ?? 0,
        maxDepth: saved.maxDepth,
      }
    : {}),

  addCargo: (ore) =>
    set((s) => {
      // soute pleine : le minerai foré est perdu
      if (cargoLoad(s.cargo) + (TILES[ore].size ?? 1) > maxCargoOf(s.upgrades))
        return s;
      return { cargo: { ...s.cargo, [ore]: (s.cargo[ore] ?? 0) + 1 } };
    }),

  sellAll: () =>
    set((s) => ({ money: s.money + cargoValue(s.cargo), cargo: {} })),

  sellOre: (ore) =>
    set((s) => {
      const count = s.cargo[ore] ?? 0;
      if (count === 0) return s;
      const cargo = { ...s.cargo };
      delete cargo[ore];
      return { money: s.money + count * (TILES[ore].value ?? 0), cargo };
    }),

  buyFuel: (liters) =>
    set((s) => {
      const max = maxFuelOf(s.upgrades);
      const wanted = Math.min(liters, max - s.fuel);
      const affordable = Math.min(wanted, s.money / FUEL_PRICE);
      if (affordable <= 0) return s;
      return {
        fuel: s.fuel + affordable,
        money: s.money - Math.ceil(affordable * FUEL_PRICE),
      };
    }),

  repairHull: () =>
    set((s) => {
      const missing = maxHullOf(s.upgrades) - s.hull;
      const affordable = Math.min(missing, s.money / REPAIR_PRICE);
      if (affordable <= 0) return s;
      return {
        hull: s.hull + affordable,
        money: s.money - Math.ceil(affordable * REPAIR_PRICE),
      };
    }),

  buyUpgrade: (kind) =>
    set((s) => {
      const next = getPlanet(s.planet).ladders[kind][s.upgrades[kind] + 1];
      if (!next || s.money < next.price) return s;
      return {
        money: s.money - next.price,
        upgrades: { ...s.upgrades, [kind]: s.upgrades[kind] + 1 },
        // un réservoir neuf arrive plein, une coque neuve arrive intacte
        ...(kind === 'tank' ? { fuel: next.stat } : {}),
        ...(kind === 'hull' ? { hull: next.stat } : {}),
      };
    }),

  buyTeleporter: () =>
    set((s) =>
      s.money >= TELEPORTER_PRICE
        ? { money: s.money - TELEPORTER_PRICE, teleporters: s.teleporters + 1 }
        : s,
    ),

  useTeleporter: () =>
    set((s) =>
      s.teleporters > 0 && s.ui === 'playing' && s.depth > 0
        ? { teleporters: s.teleporters - 1, pendingAction: 'teleport' }
        : s,
    ),

  buyDynamite: () =>
    set((s) =>
      s.money >= DYNAMITE_PRICE
        ? { money: s.money - DYNAMITE_PRICE, dynamites: s.dynamites + 1 }
        : s,
    ),

  dropDynamite: () =>
    set((s) =>
      s.dynamites > 0 && s.ui === 'playing'
        ? { dynamites: s.dynamites - 1, pendingAction: 'dynamite' }
        : s,
    ),

  openShop: (building) => set({ ui: building }),
  closeShop: () => set((s) => (isBuilding(s.ui) ? { ui: 'playing' } : s)),

  toggleInventory: () =>
    set((s) =>
      s.ui === 'inventory'
        ? { ui: 'playing' }
        : s.ui === 'playing'
          ? { ui: 'inventory' }
          : s,
    ),

  toggleOptions: () =>
    set((s) =>
      s.ui === 'options' ? { ui: 'playing' } : s.ui === 'playing' ? { ui: 'options' } : s,
    ),

  setLayout: (layout) => set({ layout }),

  // objectif atteint : on rappelle la fusée de la Compagnie
  recallRocket: () =>
    set((s) =>
      s.money >= getPlanet(s.planet).missionGoal && s.ui === 'playing' && s.depth === 0
        ? { pendingAction: 'recall' }
        : s,
    ),

  // depuis l'écran de victoire : embarquer pour la planète suivante (remise à zéro)
  boardForNextPlanet: () =>
    set((s) => {
      const next = getPlanet(s.planet).next;
      return s.ui === 'victory' && next
        ? { ...freshState(next), pendingAction: 'nextplanet' }
        : s;
    }),

  beginMission: () => set((s) => (s.ui === 'story' ? { ui: 'playing' } : s)),

  continueMining: () =>
    set((s) =>
      s.ui === 'victory' ? { ui: 'playing', pendingAction: 'teleport' } : s,
    ),

  triggerRescue: (reason) => set({ ui: 'rescue', rescueReason: reason }),

  // Rapatriement : cargaison perdue, petit plein et réparation partielle
  doRescue: () =>
    set((s) => ({
      cargo: {},
      fuel: Math.max(s.fuel, maxFuelOf(s.upgrades) * 0.35),
      hull: Math.max(s.hull, maxHullOf(s.upgrades) * 0.5),
      ui: 'playing',
      pendingAction: 'teleport',
    })),

  newGame: () => set({ ...freshState(), pendingAction: 'newgame' }),

  clearPending: () => set({ pendingAction: null }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof useGameStore }).__store = useGameStore;
}
