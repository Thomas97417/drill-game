import type { OreId } from './constants';
import type { PlanetId } from './planets';

export interface SaveData {
  seed: number;
  dug: number[];
  planet?: PlanetId; // planète courante (défaut 'xk712' pour les sauvegardes v1)
  money: number;
  fuel: number;
  hull: number;
  cargo: Partial<Record<OreId, number>>;
  upgrades: {
    drill: number;
    tank: number;
    hull: number;
    jetpack: number;
    cargo: number;
    thermal?: number; // isolation thermique / radiateur (planète active)
    radiator?: number; // sauvegardes v1 (migré vers thermal au chargement)
  };
  teleporters: number;
  dynamites: number;
  maxDepth: number;
  time: number; // horloge de jeu (cycle jour/nuit, compteur de jours)
  layout?: 'azerty' | 'qwerty';
  player: { x: number; y: number };
}

const KEY = 'drill-game-save-v1';

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

export function saveNow(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // stockage plein ou indisponible : on ignore
  }
}

export function clearSave() {
  localStorage.removeItem(KEY);
}
