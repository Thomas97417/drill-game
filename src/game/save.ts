import type { OreId } from './constants';

export interface SaveData {
  seed: number;
  dug: number[];
  money: number;
  fuel: number;
  hull: number;
  cargo: Partial<Record<OreId, number>>;
  upgrades: { drill: number; tank: number; hull: number; jetpack: number; cargo: number };
  teleporters: number;
  dynamites: number;
  maxDepth: number;
  time: number; // horloge de jeu (cycle jour/nuit, compteur de jours)
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
