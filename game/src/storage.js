// storage.js — localStorage persistence for Marina Heat.
// Saves money, missions completed, best rampage score and the last
// known position so Continue drops the player back into Coral Marina.
const KEY = 'marina-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(save) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: save.money | 0,
      score: save.score | 0,
      missionsDone: save.missionsDone || [],
      bestRampage: save.bestRampage | 0,
      x: Math.round(save.x || 480),
      y: Math.round(save.y || 480),
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable; a fresh run is fine.
  }
}
