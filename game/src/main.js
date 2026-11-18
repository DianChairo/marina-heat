// main.js — boot, the shared game state G, the loop, and every cross-system wire:
// crimes, crashes, car entry/exit, death/busted, pause, restart, and rendering.
// Each other module owns one job; this file only connects them.
import { makeRng, pick, clamp, dist } from './rng.js';
import { attachInput, keys, down, wasPressed, mouse, endFrame } from './input.js';
import { buildCity, drawCity } from './city.js';
import { AudioSys } from './audio.js';
import { loadSave, storeSave, hasSave } from './storage.js';
import { makePlayer, updatePlayer, hurtPlayer, drawPlayer } from './player.js';
import { spawnParkedCars, makeCar, updateDrivenCar, collideCars, drawCar, carSpeed } from './vehicles.js';
import { makeTrafficCar, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, drawPed, scarePeds, makePed } from './pedestrians.js';
import { makeWanted, reportCrime, updatePolice } from './police.js';
import { tryShoot, updateFx, drawFx, spawnSparks, spawnSkid, spawnPopup } from './combat.js';
import { makeMissionState, startMission, updateMission, missionObjective, drawMissionWorld, MARKER } from './missions.js';
import { bindScreens, showScreen, updateHud } from './hud.js';
import { drawMinimap } from './minimap.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const baseSeed = parseInt(params.get('seed') || '7', 10) || 7;

const G = {
  mode: 'menu', time: 0, shake: 0, fireCd: 0, chaosRun: 0, peakStars: 0,
  cam: { x: 716, y: 748 }, view: { w: innerWidth, h: innerHeight },
  fx: [], phone: { text: '', t: 0 }, golden: false, policeActive: false,
  endKind: '', nearMarker: false, objectiveText: '', hintText: '',
  audio: new AudioSys(), mouse, hasSaveFile: hasSave(),
};
G.pick = pick;
G.playerPos = () => G.player.inCar || G.player;
G.persist = () => storeSave(G.save);
G.showPhone = (text, dur) => { G.phone.text = text; G.phone.t = dur; G.audio.phone(); };
G.spawnSparks = (x, y, n) => spawnSparks(G, x, y, n);
G.spawnSkid = (car) => spawnSkid(G, car);
G.spawnPopup = (x, y, text, color) => spawnPopup(G, x, y, text, color);
G.reportCrime = (pts, x, y) => reportCrime(G, pts, x, y);
G.addChaos = (n, label) => {
  G.chaosRun += n;
  if (n >= 20) spawnPopup(G, G.playerPos().x, G.playerPos().y - 30, `+${n | 0} CHAOS`, '#ffb74d');
};
G.onStarUp = () => { G.peakStars = Math.max(G.peakStars, G.wanted.stars); };
G.onCrash = (impact, x, y) => {
  G.audio.crash(impact > 150);
  scarePeds(G, x, y, 200);
  if (impact > 95) { G.reportCrime(13, x, y); G.addChaos(Math.min(30, impact * 0.08), 'crash'); }
};
G.onCarWrecked = (car) => {
  G.addChaos(100, 'wreck');
  spawnPopup(G, car.x, car.y - 26, '+100 WRECK', '#ff8a65');
  G.spawnSparks(car.x, car.y, 16);
  G.shake = Math.min(16, G.shake + 7);
  G.audio.crash(true);
  if (car.kind === 'police') G.reportCrime(45, car.x, car.y);
  else G.reportCrime(26, car.x, car.y);
};
G.onPedHit = (ped, car) => {
  scarePeds(G, ped.x, ped.y, 240);
  if (car === G.player.inCar) {
    G.reportCrime(70, ped.x, ped.y);
    G.addChaos(50, 'pedestrian');
    G.audio.crash(false);
    G.shake = Math.min(14, G.shake + 6);
  }
};
G.onPlayerDeath = () => endRun('wasted');
G.onBusted = () => endRun('busted');
G.togglePause = () => {
  if (G.mode === 'playing') { G.mode = 'paused'; showScreen('pause', G); }
  else if (G.mode === 'paused') { G.mode = 'playing'; showScreen(null, G); }
};

function buildWorld(seed) {
  G.rng = makeRng(seed * 131 + 7);
  buildCity(seed);
  G.player = makePlayer(700, 800);
  G.cars = spawnParkedCars(G.rng, pick);
  for (let i = 0; i < 11; i++) G.cars.push(makeTrafficCar(G.rng, pick, G.player));
  G.peds = spawnPeds(G, 16);
  G.wanted = makeWanted();
  G.mission = makeMissionState();
  G.fx = []; G.chaosRun = 0; G.peakStars = 0; G.fireCd = 0; G.shake = 0;
  G.phone = { text: '', t: 0 };
  G.cam.x = G.player.x; G.cam.y = G.player.y;
}

G.enterCar = (car, silent) => {
  const P = G.player;
  if (silent) { P.inCar = car; car.occupied = true; return; }
  if (car.driver && car.kind === 'traffic') {
    // The driver is yanked out and runs for it.
    const flee = makePed(G.rng, pick, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
    flee.panicT = 3.4; flee.fleeX = P.x; flee.fleeY = P.y;
    G.peds.push(flee);
    car.driver = false;
    G.reportCrime(48, car.x, car.y);
    G.showPhone('Driver ran off screaming. The car is yours now.', 3);
  } else if (car.kind === 'police') {
    G.reportCrime(70, car.x, car.y);
  } else if (car.kind === 'parked' || car.kind === 'traffic') {
    G.reportCrime(42, car.x, car.y);
  }
  P.inCar = car; car.occupied = true;
  if (!silent) { G.audio.door(); scarePeds(G, car.x, car.y, 90); }
};
function exitCar() {
  const P = G.player, car = P.inCar;
  if (!car) return;
  const px = -Math.sin(car.angle), py = Math.cos(car.angle);
  P.x = car.x + px * 30; P.y = car.y + py * 30;
  P.inCar = null; car.occupied = false;
  G.audio.door();
}
function nearestEnterableCar() {
  let best = null, bd = 56;
  for (const c of G.cars) { const d = dist(G.player.x, G.player.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
  return best;
}

function endRun(kind) {
  if (G.mode !== 'playing') return;
  G.mode = 'end'; G.endKind = kind;
  G.save.bestChaos = Math.max(G.save.bestChaos, G.chaosRun | 0);
  G.save.runs++;
  G.persist();
  G.audio.sting(false);
  const stats = `Cash <b>$${G.save.cash.toLocaleString('en-US')}</b> · Respect <b>${G.save.respect}</b><br>` +
    `Chaos this run <b>${G.chaosRun | 0}</b> · Peak wanted <b>${'★'.repeat(G.peakStars) || '—'}</b><br>` +
    `Missions completed <b>${G.save.missionsDone}</b> · Best chaos <b>${G.save.bestChaos}</b>`;
  showScreen('end', G, stats);
}

function startGame() {
  G.audio.init();
  G.save = loadSave();
  buildWorld(baseSeed + G.save.runs);
  G.mode = 'playing';
  showScreen(null, G);
  G.showPhone('Marisol Vega: Welcome to Coral Marina. The pink M is my board — take a job, earn, and do not get caught. WASD drive, E steals cars, click shoots.', 9);
}

function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  G.view.w = innerWidth; G.view.h = innerHeight;
}
addEventListener('resize', resize);
resize();
attachInput(canvas);

function readInput() {
  return {
    up: down('w', 'arrowup'), down: down('s', 'arrowdown'),
    left: down('a', 'arrowleft'), right: down('d', 'arrowright'),
    shift: down('shift'),
  };
}

function update(dt) {
  G.time += dt;
  G.phone.t = Math.max(0, G.phone.t - dt);
  G.shake = Math.max(0, G.shake - 40 * dt);
  const inp = readInput();
  G.input = inp;
  const P = G.player;
  if (G.mode === 'menu') {
    // Living backdrop behind the title: traffic and peds keep moving.
    updateTraffic(G, dt); updatePeds(G, dt); updateFx(G, dt);
    G.cam.x = 716 + Math.sin(G.time * 0.07) * 130;
    G.cam.y = 748 + Math.cos(G.time * 0.05) * 90;
    endFrame();
    return;
  }
  if (G.mode !== 'playing') { endFrame(); return; }
  G.nearMarker = !G.mission.active && dist(P.x, P.y, MARKER.x, MARKER.y) < 54;
  // Interactions.
  if (wasPressed('e')) {
    if (P.inCar) exitCar();
    else if (G.nearMarker) startMission(G);
    else { const c = nearestEnterableCar(); if (c) G.enterCar(c); }
  }
  if (wasPressed('p', 'escape')) { G.togglePause(); endFrame(); return; }
  if (wasPressed('m')) G.audio.toggleMute();
  // Movement / driving.
  if (P.inCar) {
    updateDrivenCar(G, P.inCar, inp, dt);
    P.x = P.inCar.x; P.y = P.inCar.y;
    if (P.inCar.wrecked && carSpeed(P.inCar) < 8) G.hintText = 'This car is wrecked — press E and find another';
  } else {
    updatePlayer(G, P, dt);
    G.fireCd -= dt;
    if (mouse.down && G.fireCd <= 0) { tryShoot(G); G.fireCd = 0.15; }
  }
  // Cars hitting the on-foot player.
  if (!P.inCar) {
    for (const c of G.cars) {
      const cs = carSpeed(c);
      if (cs > 42 && dist(P.x, P.y, c.x, c.y) < c.r + P.r - 2) {
        hurtPlayer(G, P, c.kind === 'police' ? 13 : 17, c.x, c.y);
        if (c.kind === 'police') G.wanted.busted = Math.min(100, G.wanted.busted + 9);
      }
    }
  }
  updateTraffic(G, dt);
  updatePeds(G, dt);
  // Car-vs-car collisions (all pairs; the city fleet is small).
  for (let i = 0; i < G.cars.length; i++) for (let j = i + 1; j < G.cars.length; j++) collideCars(G, G.cars[i], G.cars[j]);
  updatePolice(G, dt);
  updateMission(G, dt);
  updateFx(G, dt);
  // Camera follows the avatar with a little lookahead and impact shake.
  const pos = G.playerPos();
  const look = P.inCar ? 0.32 : 0.12;
  G.cam.x += (pos.x + (pos.vx || 0) * look - G.cam.x) * Math.min(1, 7 * dt);
  G.cam.y += (pos.y + (pos.vy || 0) * look - G.cam.y) * Math.min(1, 7 * dt);
  // HUD text state (recomputed from scratch every frame).
  G.objectiveText = missionObjective(G);
  if (P.inCar) G.hintText = (P.inCar.wrecked && carSpeed(P.inCar) < 8) ? 'This car is wrecked — press E and find another' : 'E — exit · WASD drive';
  else if (G.nearMarker) G.hintText = 'E — take a job from Marisol';
  else if (nearestEnterableCar()) G.hintText = 'E — steal car';
  else G.hintText = '';
  G.peakStars = Math.max(G.peakStars, G.wanted.stars);
  const spd = P.inCar ? Math.abs(P.inCar.speed) / 335 : 0;
  G.audio.update(dt, !!P.inCar, spd, G.policeActive);
  updateHud(G);
  endFrame();
}

function render() {
  const { w, h } = G.view;
  ctx.fillStyle = '#20242a'; ctx.fillRect(0, 0, w, h);
  const shx = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const shy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(w / 2 - G.cam.x + shx, h / 2 - G.cam.y + shy);
  drawCity(ctx, G.cam, G.time, w, h);
  drawMissionWorld(ctx, G, G.time);
  drawFx(ctx, G);
  for (const c of G.cars) drawCar(ctx, c, G.time);
  for (const p of G.peds) drawPed(ctx, p, G.time);
  if (!G.player.inCar && G.mode !== 'menu') drawPlayer(ctx, G.player, G.time);
  ctx.restore();
  if (G.golden) {
    const gr = ctx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, 'rgba(255,150,60,0.13)'); gr.addColorStop(1, 'rgba(120,40,120,0.10)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  }
  // Soft vignette.
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (G.mode === 'playing' || G.mode === 'paused') drawMinimap(G);
}

// Boot.
G.save = loadSave();
buildWorld(baseSeed);
bindScreens(G, { onStart: () => startGame(), onRestart: () => startGame() });
if (shotName) {
  G.mode = 'playing';
  showScreen(null, G);
  const ticks = setupShot(G, shotName) || 40;
  for (let i = 0; i < ticks; i++) update(1 / 30);
  updateHud(G);
  render();
  window.__shotReady = true;
} else {
  showScreen('start', G);
}
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (G.mode === 'paused') {
    if (wasPressed('p', 'escape')) { G.togglePause(); endFrame(); }
  } else update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
