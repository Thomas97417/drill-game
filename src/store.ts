import { create } from 'zustand';
import {
  CARGO_TIERS,
  MISSION_GOAL,
  DRILL_TIERS,
  DYNAMITE_PRICE,
  FUEL_PRICE,
  HULL_TIERS,
  JETPACK_TIERS,
  ORE_IDS,
  RADIATOR_TIERS,
  REPAIR_PRICE,
  TANK_TIERS,
  TELEPORTER_PRICE,
  TILES,
  cargoLoad,
  cargoValue,
  type BuildingId,
  type OreId,
} from './game/constants';
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
export type UpgradeKind = 'drill' | 'tank' | 'hull' | 'jetpack' | 'cargo' | 'radiator';

export interface Upgrades {
  drill: number;
  tank: number;
  hull: number;
  jetpack: number;
  cargo: number;
  radiator: number;
}

interface GameStore {
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
  pendingAction: 'teleport' | 'newgame' | 'dynamite' | 'recall' | null;

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
  beginMission: () => void;
  continueMining: () => void;
  triggerRescue: (reason: 'fuel' | 'hull') => void;
  doRescue: () => void;
  newGame: () => void;
  clearPending: () => void;
}

export const maxFuelOf = (u: Upgrades) => TANK_TIERS[u.tank].stat;
export const maxHullOf = (u: Upgrades) => HULL_TIERS[u.hull].stat;
export const maxCargoOf = (u: Upgrades) => CARGO_TIERS[u.cargo].stat;

const TIERS = {
  drill: DRILL_TIERS,
  tank: TANK_TIERS,
  hull: HULL_TIERS,
  jetpack: JETPACK_TIERS,
  cargo: CARGO_TIERS,
  radiator: RADIATOR_TIERS,
} as const;

const saved = loadSave();

const freshState = () => ({
  money: 0,
  fuel: TANK_TIERS[0].stat,
  hull: HULL_TIERS[0].stat,
  cargo: {} as Partial<Record<OreId, number>>,
  upgrades: { drill: 0, tank: 0, hull: 0, jetpack: 0, cargo: 0, radiator: 0 },
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
});

export const useGameStore = create<GameStore>((set) => ({
  ...freshState(),
  ...(saved
    ? {
        money: saved.money,
        fuel: saved.fuel,
        hull: saved.hull,
        // on écarte les minerais qui n'existent plus (ex. charbon)
        cargo: Object.fromEntries(
          Object.entries(saved.cargo).filter(([k]) => (ORE_IDS as string[]).includes(k)),
        ),
        // ?? 0 : sauvegardes antérieures à ces améliorations
        upgrades: {
          ...saved.upgrades,
          jetpack: saved.upgrades.jetpack ?? 0,
          cargo: saved.upgrades.cargo ?? 0,
          radiator: saved.upgrades.radiator ?? 0,
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
      const next = TIERS[kind][s.upgrades[kind] + 1];
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
      s.money >= MISSION_GOAL && s.ui === 'playing' && s.depth === 0
        ? { pendingAction: 'recall' }
        : s,
    ),

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
