// main.js — Marina Heat entrypoint: builds the world, runs the loop,
// renders the city and wires the screens, the HUD and the save game.
import { buildCity, drawCity } from './city.js';
import { makeRng } from './rng.js';
import { createInput, endFrame, isDown, wasPressed } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './storage.js';
import { createPlayer, damagePlayer, drawPlayer, pushMessage, updatePlayer } from './player.js';
import { drawCar, separateCars, spawnSmoke, updateParticles, updatePlayerCar } from './vehicles.js';
import { drawTraffic, initTraffic, updateTraffic } from './traffic.js';
import { drawPeds, initPeds, scarePeds, updatePeds, updatePickups } from './pedestrians.js';
import { addHeat, clearPolice, drawPolice, updatePolice } from './police.js';
import { drawCombat, updateCombat } from './combat.js';
import { createMissionState, nextMissionId, openingMessages, drawMissionMarkers, startMission, updateMissions } from './missions.js';
import { createHud, showScreen, updateHud, updateTitleSave } from './hud.js';
import { drawMinimap } from './minimap.js';
import { applyShot, parseShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('minimap');
const miniCtx = miniCanvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const shotInfo = parseShot();
const seed = shotInfo ? shotInfo.seed : 7;
const rng = makeRng(seed);
const city = buildCity(seed);
const save = loadSave();

const G = {
  seed,
  rng,
  city,
  input: createInput(canvas),
  audio: createAudio(),
  state: 'title',
  time: 0,
  camera: { x: 0, y: 0, w: canvas.width, h: canvas.height },
  player: null,
  cars: [],
  peds: [],
  cops: [],
  tracers: [],
  particles: [],
  pickups: [],
  wanted: 0,
  heat: 0,
  busted: 0,
  mission: createMissionState(),
  messages: [],
  stats: { kills: 0, carsStolen: 0 },
  save: save || null,
  shot: shotInfo ? shotInfo.shot : null,
  shotSettled: false,
  shotFrames: 0,
  saveTimer: 0,
};
G.player = createPlayer(city, save);
G.addHeat = (n) => addHeat(G, n);
if (save) {
  G.mission.done = save.missionsDone || [];
  G.player.money = save.money || 0;
  G.player.score = save.score || 0;
}

const hud = createHud();
updateTitleSave(hud, save);
showScreen(hud, 'title');

initTraffic(G, 10);
initPeds(G, 22);

function startGame(fresh) {
  G.audio.init();
  if (fresh) {
    G.player = createPlayer(city, null);
    G.player.money = 0;
    G.player.score = 0;
    G.cars = G.cars.filter((c) => c.kind === 'traffic');
    G.cops = [];
    G.heat = 0;
    G.wanted = 0;
    G.busted = 0;
    G.mission = createMissionState();
    G.messages = [];
    G.stats = { kills: 0, carsStolen: 0 };
    initTraffic(G, 4);
  }
  G.state = 'playing';
  showScreen(hud, null);
  openingMessages(G);
}

function bind(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}
bind('btn-start', () => startGame(true));
bind('btn-continue', () => {
  G.audio.init();
  G.state = 'playing';
  showScreen(hud, null);
  openingMessages(G);
});
bind('btn-resume', () => {
  G.state = 'playing';
  showScreen(hud, null);
});
bind('btn-restart', () => startGame(true));
bind('btn-restart-busted', () => {
  clearPolice(G);
  G.player.hp = 100;
  G.player.money = Math.max(0, G.player.money - 150);
  G.player.x = city.spawn.x;
  G.player.y = city.spawn.y;
  G.player.onFoot = true;
  G.player.car = null;
  G.state = 'playing';
  showScreen(hud, null);
  pushMessage(G, 'System', 'You paid $150 bail. Marisol is not impressed.');
});
bind('btn-mute', () => {
  G.audio.init();
  G.audio.setMuted(!G.audio.muted);
  document.getElementById('btn-mute').textContent = G.audio.muted ? '🔇 Muted' : '🔊 Sound';
});

// Shot mode: script the scene, settle the simulation, then freeze it so
// the captured frame is deterministic.
if (G.shot) {
  G.audio.muted = true;
  applyShot(G, G.shot);
  showScreen(hud, null);
  for (let i = 0; i < 30; i++) updateWorld(1 / 60);
  G.shotSettled = true;
  window.__shotReady = false;
}

function updateWorld(dt) {
  G.time += dt;
  const p = G.player;
  if (G.state !== 'playing') return;
  if (wasPressed(G.input, 'KeyM')) {
    G.audio.setMuted(!G.audio.muted);
    document.getElementById('btn-mute').textContent = G.audio.muted ? '🔇 Muted' : '🔊 Sound';
  }
  if (wasPressed(G.input, 'KeyP', 'Escape')) {
    G.state = 'paused';
    showScreen(hud, 'pause');
    return;
  }
  if (wasPressed(G.input, 'Digit1')) startMission(G, 0);
  if (wasPressed(G.input, 'Digit2')) startMission(G, 1);
  if (wasPressed(G.input, 'Digit3')) startMission(G, 2);
  updatePlayer(G, dt);
  updatePlayerCar(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePickups(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  updateParticles(G, dt);
  separateCars(G);
  // Car smoke puffs.
  for (const car of G.cars) {
    if (car.smoke > 0.3 && G.rng.chance(0.12)) spawnSmoke(G, car.x, car.y, car.hp < 28);
  }
  // Camera follows the player.
  G.camera.x = Math.max(0, Math.min(city.size - G.camera.w, p.x - G.camera.w / 2));
  G.camera.y = Math.max(0, Math.min(city.size - G.camera.h, p.y - G.camera.h / 2));
  G.camera.w = canvas.width;
  G.camera.h = canvas.height;
  // Autosave.
  G.saveTimer += dt;
  if (G.saveTimer > 5) {
    G.saveTimer = 0;
    saveGame({
      money: p.money, score: p.score, missionsDone: G.mission.done,
      bestRampage: 0, x: p.x, y: p.y,
    });
  }
  if (G.state === 'wasted') showScreen(hud, 'wasted');
  if (G.state === 'busted') showScreen(hud, 'busted');
}

function render() {
  const cam = G.camera;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, city, cam);
  drawMissionMarkers(ctx, G);
  drawPeds(ctx, G);
  drawTraffic(ctx, G);
  drawPolice(ctx, G);
  if (G.player.car) drawCar(ctx, G.player.car);
  drawPlayer(ctx, G);
  drawCombat(ctx, G);
  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = 1 - pt.t / pt.life;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Fixer label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MARISOL VEGA — FIXER', city.fixer.x, city.fixer.y - 22);
  ctx.restore();
  // Compass strip: objective distance.
  if (G.mission.active) {
    const target = G.mission.id === 0 ? G.mission.checkpoints[G.mission.stage] : G.mission.checkpoints[0];
    if (target) {
      const d = Math.round(Math.hypot(target.x - G.player.x, target.y - G.player.y));
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`◈ ${d}m`, 16, canvas.height - 16);
    }
  }
  drawMinimap(miniCtx, G, 180);
  updateHud(G, hud);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.shot) {
    // Frozen scene: render only, then flag ready.
    render();
    G.shotFrames++;
    if (G.shotFrames >= 5) window.__shotReady = true;
  } else {
    if (G.state === 'title') {
      // Slow cinematic pan behind the title screen.
      G.camera.x = (Math.sin(G.time * 0.05) * 0.5 + 0.5) * (city.size - canvas.width);
      G.camera.y = 1400;
      G.camera.w = canvas.width;
      G.camera.h = canvas.height;
      G.time += dt;
      render();
    } else if (G.state === 'paused') {
      render();
    } else {
      updateWorld(dt);
      render();
    }
  }
  endFrame(G.input);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__game = G;
document.getElementById('loading').style.display = 'none';
