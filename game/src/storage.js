// storage.js — localStorage save game: cash, reputation, completed
// missions and the mute setting survive between visits.

const KEY = 'marina-heat-save-v1';

export const DEFAULT_SAVE = {
  cash: 250,
  rep: 0,
  missionsDone: 0,
  bestBayRun: null,
  muted: false,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...parsed };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage may be unavailable (private mode); the game simply
    // continues without persistence.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
