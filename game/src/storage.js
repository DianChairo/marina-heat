// storage.js — localStorage save: cash, respect/score, best stats.
const KEY = 'marina-heat-save-v1';
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s.cash === 'number') return s; } catch { /* fresh */ }
  return null;
}
export function writeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* noop */ } }
