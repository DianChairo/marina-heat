// localStorage persistence: cash, respect, best stats.
const KEY = 'marina-heat-save-v1';
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.cash === 'number') return s; } catch {}
  return null;
}
export function storeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}
export function defaultSave() {
  return { cash: 250, respect: 0, bestChaos: 0, missionsDone: 0, bestTime: 0, totalWrecks: 0 };
}
