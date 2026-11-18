// storage.js — localStorage persistence for Marina Heat.
// Saves money, score, missions completed and best rampage score so the
// Continue button on the title screen can pick up where you left off.
const KEY = 'marina-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || !s) return null;
    return {
      money: typeof s.money === 'number' ? s.money : 0,
      score: typeof s.score === 'number' ? s.score : 0,
      missionsDone: Array.isArray(s.missionsDone) ? s.missionsDone : [],
      bestRampage: typeof s.bestRampage === 'number' ? s.bestRampage : 0,
      seed: typeof s.seed === 'number' ? s.seed : 1337,
    };
  } catch {
    return null;
  }
}

export function saveGame(G) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: Math.round(G.player.money),
      score: Math.round(G.score),
      missionsDone: G.missionsDone,
      bestRampage: G.bestRampage,
      seed: G.seed,
    }));
  } catch {
    // storage full or unavailable — the game keeps running unsaved
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
