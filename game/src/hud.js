// hud.js — all DOM overlay updates: wanted stars, heat/busted meters, health,
// cash line, objective banner, phone messages, speedo, and the menu/end screens.
// The canvas draws the world; this module only touches element text/styles when they change.
const el = (id) => document.getElementById(id);
const cache = {};
function setText(id, v) { if (cache[id] !== v) { cache[id] = v; el(id).textContent = v; } }
function setWidth(id, pct) { const v = pct.toFixed(1) + '%'; if (cache[id] !== v) { cache[id] = v; el(id).style.width = v; } }
function setShow(id, show) { const v = show ? '1' : '0'; if (cache[id] !== v) { cache[id] = v; el(id).style.display = show ? '' : 'none'; } }

export function bindScreens(G, { onStart, onRestart }) {
  el('startbtn').addEventListener('click', () => onStart(false));
  const cont = el('continuebtn');
  if (G.hasSaveFile) { cont.style.display = ''; cont.addEventListener('click', () => onStart(true)); }
  el('restartbtn').addEventListener('click', onRestart);
  el('resumebtn').addEventListener('click', () => G.togglePause());
}

export function showScreen(name, G, statsHtml) {
  setShow('startscreen', name === 'start');
  setShow('endscreen', name === 'end');
  setShow('pauseoverlay', name === 'pause');
  setShow('hud', name === null || name === 'pause');
  if (name === 'end' && statsHtml) el('endstats').innerHTML = statsHtml;
  if (name === 'end') setText('endtitle', G.endKind === 'busted' ? 'BUSTED' : 'WASTED');
  if (name === 'end') el('endtitle').style.color = G.endKind === 'busted' ? '#6db3ff' : '#ff5252';
}

export function updateHud(G) {
  const w = G.wanted, P = G.player;
  // Wanted stars + heat toward the next one.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < w.stars ? '★' : '☆';
  setText('stars', stars);
  el('stars').style.color = w.stars ? (Math.sin(G.time * 6) > 0 ? '#ffd740' : '#ff9800') : '#5a6270';
  setShow('heatwrap', w.stars < 5 && (w.heat > 1 || w.stars > 0));
  setWidth('heatfill', w.stars === 0 ? w.heat / 26 * 100 : w.heat);
  setShow('bustedwrap', w.stars > 0 && w.busted > 1);
  setWidth('bustedfill', w.busted);
  // Health.
  setWidth('healthfill', Math.max(0, P.hp));
  el('healthfill').style.background = P.hp > 50 ? '#69f0ae' : P.hp > 25 ? '#ffd740' : '#ff5252';
  // Money / score line.
  setText('cashline', `$${G.save.cash.toLocaleString('en-US')} · Respect ${G.save.respect} · Chaos ${G.chaosRun | 0}`);
  // Objective banner.
  const obj = G.objectiveText || '';
  setShow('objective', !!obj);
  if (obj) setText('objective', obj);
  // Carrying indicator rides inside the objective line already; package icon here.
  setShow('pkg', !!(G.mission && G.mission.carrying));
  // Speedo while driving.
  const driving = !!P.inCar;
  setShow('speedwrap', driving);
  if (driving) setText('speed', `${Math.round(Math.abs(P.inCar.speed) * 0.32)}`);
  // Phone message from Marisol.
  const ph = G.phone;
  setShow('phone', ph.t > 0);
  if (ph.t > 0) setText('phonetext', ph.text);
  // Context hint.
  setText('hint', G.hintText || '');
  setText('muteline', G.audio.muted ? 'M — sound off' : '');
}
