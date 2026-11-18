// hud.js — the on-screen HUD: health bar, cash, wanted stars, mission
// timer, phone messages, and the title / pause / WASTED / BUSTED screens.
// The HUD is DOM; the world is canvas. Screens are shown/hidden by id.
import { MISSION_DEFS } from './missions.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  return {
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    money: $('money'),
    score: $('score'),
    stars: $('stars'),
    bustedFill: $('busted-fill'),
    bustedWrap: $('busted-wrap'),
    missionBox: $('mission-box'),
    missionName: $('mission-name'),
    missionInfo: $('mission-info'),
    messages: $('messages'),
    screens: {
      title: $('screen-title'),
      pause: $('screen-pause'),
      wasted: $('screen-wasted'),
      busted: $('screen-busted'),
    },
    titleSave: $('title-save'),
  };
}

function starString(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
  return s;
}

export function updateHud(G, hud) {
  const p = G.player;
  hud.healthFill.style.width = `${Math.max(0, p.hp)}%`;
  hud.healthFill.style.background = p.hp > 50 ? '#37d67a' : p.hp > 25 ? '#e8a33a' : '#d84a4a';
  hud.healthText.textContent = `${Math.ceil(p.hp)} HP`;
  hud.money.textContent = `$${p.money.toLocaleString('en-US')}`;
  hud.score.textContent = `SCORE ${p.score.toLocaleString('en-US')}`;
  hud.stars.textContent = starString(G.wanted);
  hud.stars.style.color = G.wanted > 0 ? '#ffd94a' : '#888';
  if (G.busted > 1) {
    hud.bustedWrap.style.display = 'block';
    hud.bustedFill.style.width = `${G.busted}%`;
  } else {
    hud.bustedWrap.style.display = 'none';
  }
  const m = G.mission;
  if (m.active) {
    const def = MISSION_DEFS[m.id];
    hud.missionBox.style.display = 'block';
    hud.missionName.textContent = def.name;
    let info = `${Math.ceil(m.timer)}s`;
    if (m.id === 0) info += `  •  checkpoint ${m.stage + 1}/${m.checkpoints.length}`;
    if (m.id === 2) info += `  •  ${m.score}/${m.target} pts`;
    if (m.id === 1) info += '  •  deliver by car, keep it healthy';
    hud.missionInfo.textContent = info;
  } else {
    hud.missionBox.style.display = 'none';
  }
  // Phone messages: newest first, fade the oldest.
  const html = G.messages
    .map((msg, i) => `<div class="msg" style="opacity:${1 - i * 0.18}"><b>${escapeHtml(msg.from)}:</b> ${escapeHtml(msg.text)}</div>`)
    .join('');
  if (hud.messages._last !== html) {
    hud.messages.innerHTML = html;
    hud.messages._last = html;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function showScreen(hud, name) {
  for (const [key, el] of Object.entries(hud.screens)) {
    if (el) el.style.display = key === name ? 'flex' : 'none';
  }
}

export function updateTitleSave(hud, save) {
  if (!hud.titleSave) return;
  if (save) {
    hud.titleSave.textContent = `Continue: $${save.money} • ${save.missionsDone.length} job${save.missionsDone.length === 1 ? '' : 's'} done • saved ${new Date(save.savedAt).toLocaleTimeString()}`;
    hud.titleSave.style.display = 'block';
  } else {
    hud.titleSave.style.display = 'none';
  }
}
