import { create } from 'zustand';
import {
  DRILL_TIERS,
  FUEL_PRICE,
  HULL_TIERS,
  REPAIR_PRICE,
  TANK_TIERS,
  TELEPORTER_PRICE,
  cargoValue,
  type OreId,
} from './game/constants';
import { loadSave } from './game/save';

export type UiMode = 'playing' | 'shop' | 'rescue';
export type UpgradeKind = 'drill' | 'tank' | 'hull';

export interface Upgrades {
  drill: number;
  tank: number;
  hull: number;
}

interface GameStore {
  money: number;
  fuel: number;
  hull: number;
  cargo: Partial<Record<OreId, number>>;
  upgrades: Upgrades;
  teleporters: number;
  depth: number;
  maxDepth: number;
  canShop: boolean;
  ui: UiMode;
  rescueReason: 'fuel' | 'hull';
  // ordre à consommer par le moteur de jeu
  pendingAction: 'teleport' | 'newgame' | null;

  addCargo: (ore: OreId) => void;
  sellAll: () => void;
  buyFuel: (liters: number) => void;
  repairHull: () => void;
  buyUpgrade: (kind: UpgradeKind) => void;
  buyTeleporter: () => void;
  useTeleporter: () => void;
  openShop: () => void;
  closeShop: () => void;
  triggerRescue: (reason: 'fuel' | 'hull') => void;
  doRescue: () => void;
  newGame: () => void;
  clearPending: () => void;
}

export const maxFuelOf = (u: Upgrades) => TANK_TIERS[u.tank].stat;
export const maxHullOf = (u: Upgrades) => HULL_TIERS[u.hull].stat;

const TIERS = { drill: DRILL_TIERS, tank: TANK_TIERS, hull: HULL_TIERS } as const;

const saved = loadSave();

const freshState = () => ({
  money: 0,
  fuel: TANK_TIERS[0].stat,
  hull: HULL_TIERS[0].stat,
  cargo: {} as Partial<Record<OreId, number>>,
  upgrades: { drill: 0, tank: 0, hull: 0 },
  teleporters: 0,
  depth: 0,
  maxDepth: 0,
  canShop: false,
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
        cargo: saved.cargo,
        upgrades: saved.upgrades,
        teleporters: saved.teleporters,
        maxDepth: saved.maxDepth,
      }
    : {}),

  addCargo: (ore) =>
    set((s) => ({ cargo: { ...s.cargo, [ore]: (s.cargo[ore] ?? 0) + 1 } })),

  sellAll: () =>
    set((s) => ({ money: s.money + cargoValue(s.cargo), cargo: {} })),

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

  openShop: () => set({ ui: 'shop' }),
  closeShop: () => set((s) => (s.ui === 'shop' ? { ui: 'playing' } : s)),

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
