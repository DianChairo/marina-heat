// storage.js — localStorage save wrapper. All access is guarded so the
// game still runs where storage is unavailable (private mode, file://).

const KEY = 'marina-heat-save-v6';

const DEFAULTS = {
  cash: 250,
  missionsDone: [],
  totalChaos: 0,
  timesWasted: 0,
  timesBusted: 0,
};

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, fresh: true };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, fresh: false };
  } catch {
    return { ...DEFAULTS, fresh: true };
  }
}

export function storeSave(save) {
  try {
    const { fresh, ...rest } = save;
    window.localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Storage full or blocked: the game continues without persisting.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
