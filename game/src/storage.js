// storage.js — persistent profile in localStorage: cash, respect, lifetime bests.
const KEY = 'marina-heat-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { cash: s.cash | 0, respect: s.respect | 0, bestChaos: s.bestChaos | 0, missionsDone: s.missionsDone | 0, runs: s.runs | 0 };
    }
  } catch { /* corrupted or unavailable storage: start fresh */ }
  return { cash: 0, respect: 0, bestChaos: 0, missionsDone: 0, runs: 0 };
}
export function storeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode etc. */ }
}
export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
