// main.js — Marina Heat: top-down 2D open-world crime game.
// Coral Marina, a seeded 3200x3200 grid city on a beach. On foot and by
// stolen car, with traffic, fleeing pedestrians, a 1-5 star wanted system,
// police chases, car damage and three jobs for fixer Marisol Vega.
import { makeRng } from './rng.js';
import { generateCity, isRoad, collideBuildings, WORLD, ROAD_W } from './city.js';
import { createInput } from './input.js';
import { loadSave, saveGame } from './storage.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer, drawPlayer, damagePlayer } from './player.js';
import { createCar, nearestCar, enterCar, exitCar, updateCar, drawCar, damageCar } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians, drawPedestrians } from './pedestrians.js';
import { updateWanted, updatePolice } from './police.js';
import { fireShot, updateTracers, drawTracers } from './combat.js';
import { startMission, updateMission, drawMissionMarkers, MISSION_DEFS } from './missions.js';
import { drawHud, drawTitle, drawPause, drawWasted, drawBusted } from './hud.js';
import { drawMinimap } from './minimap.js';
import { shotParams, applyShot, armShotReady } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = shotParams();
const save = loadSave();
const seed = params.shot ? params.seed : (save?.seed ?? 1337);

const G = {
  seed,
  rng: makeRng(seed),
  city: generateCity(seed),
  player: createPlayer(320 + 4 * 320 + 40, 320 + 4 * 320 + 90),
  cars: [], peds: [], tracers: [], particles: [],
  wanted: 0, heat: 0, busted: 0,
  score: save?.score ?? 0,
  missionsDone: save?.missionsDone ?? [],
  bestRampage: save?.bestRampage ?? 0,
  mission: null,
  messages: [],
  time: 0,
  mode: 'title',
  save: !!save,
  camera: { x: 0, y: 0 },
  view: { w: canvas.width, h: canvas.height },
  input: null,
  audio: createAudio(),
};
G.player.money = save?.money ?? 0;
G.input = createInput(canvas);

// Populate the world: parked + traffic cars near the roads, pedestrians.
spawnTraffic(G, 14);
for (let i = 0; i < 6; i++) {
  const p = G.city.roadsV[i % G.city.roadsV.length];
  const car = createCar(p + 40, 400 + i * 420, 0);
  G.cars.push(car);
}
spawnPedestrians(G, 26);

if (params.shot) {
  applyShot(G, params.shot);
  armShotReady(G);
}

function updateCamera(dt) {
  const p = G.player;
  const tx = Math.max(0, Math.min(WORLD - G.view.w, p.x - G.view.w / 2));
  const ty = Math.max(0, Math.min(WORLD - G.view.h, p.y - G.view.h / 2));
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 6);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 6);
}

function drawWorld() {
  const { x: cx, y: cy } = G.camera;
  const W = G.view.w; const H = G.view.h;
  // ground: grass-green city, sand on the west edge, water beyond it
  ctx.fillStyle = '#3f6212';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-cx, -cy);
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(G.city.water.x0, 0, G.city.water.x1 - G.city.water.x0, WORLD);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(G.city.beach.x0, 0, G.city.beach.x1 - G.city.beach.x0, WORLD);
  // city ground
  ctx.fillStyle = '#365314';
  ctx.fillRect(G.city.beach.x1, 0, WORLD - G.city.beach.x1, WORLD);
  // parks + plaza
  ctx.fillStyle = '#15803d';
  for (const pk of G.city.parks) ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(G.city.plaza.x, G.city.plaza.y, G.city.plaza.w, G.city.plaza.h);
  // marina + pier
  ctx.fillStyle = '#155e75';
  ctx.fillRect(G.city.marina.x, G.city.marina.y, G.city.marina.w, G.city.marina.h);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(G.city.pier.x, G.city.pier.y, G.city.pier.w, G.city.pier.h);
  // roads
  ctx.fillStyle = '#374151';
  for (const rx of G.city.roadsV) ctx.fillRect(rx - ROAD_W / 2, 320, ROAD_W, WORLD - 320);
  for (const ry of G.city.roadsH) ctx.fillRect(320, ry - ROAD_W / 2, WORLD - 320, ROAD_W);
  // road centre dashes
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const rx of G.city.roadsV) { ctx.moveTo(rx, 320); ctx.lineTo(rx, WORLD); }
  for (const ry of G.city.roadsH) { ctx.moveTo(320, ry); ctx.lineTo(WORLD, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // buildings with roofs and a tall-building shadow
  for (const b of G.city.buildings) {
    ctx.fillStyle = '#00000044';
    ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.tall) {
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    }
  }
  drawMissionMarkers(ctx, G);
  drawPedestrians(ctx, G);
  for (const car of G.cars) drawCar(ctx, car);
  drawPlayer(ctx, G);
  drawTracers(ctx, G);
  ctx.restore();
}

function update(dt) {
  G.time += dt;
  for (const m of G.messages) m.t -= dt;
  G.messages = G.messages.filter((m) => m.t > 0);
  const inp = G.input;
  // Global keys.
  if (inp.wasPressed('m')) G.audio.toggleMute();
  if (inp.wasPressed('p', 'escape')) {
    if (G.mode === 'play') G.mode = 'pause';
    else if (G.mode === 'pause') G.mode = 'play';
  }
  if (G.mode === 'title') {
    if (inp.wasPressed('enter') || inp.mouse.clicked) {
      G.audio.unlock();
      G.mode = 'play';
      G.messages.push({ from: 'Marisol Vega', text: '"Welcome to Coral Marina. Press 1, 2 or 3 when you want work."', t: 7 });
      G.audio.phone();
    }
    return;
  }
  if (G.mode === 'pause') return;
  if (G.mode === 'wasted' || G.mode === 'busted') {
    if (inp.wasPressed('enter') || inp.mouse.clicked) {
      if (G.mode === 'busted') G.player.money = Math.max(0, G.player.money - 200);
      G.player.hp = G.player.maxHp;
      G.player.x = 320 + 4 * 320 + 40; G.player.y = 320 + 4 * 320 + 90;
      if (G.player.car) { G.player.car.driver = null; G.player.car = null; }
      G.player.onFoot = true;
      G.wanted = 0; G.heat = 0; G.busted = 0;
      G.cars = G.cars.filter((c) => !c.police);
      G.mode = 'play';
    }
    return;
  }
  // In-play keys.
  if (inp.wasPressed('1', '2', '3')) {
    const id = Number(inp.wasPressed('1') ? 1 : inp.wasPressed('2') ? 2 : 3) - 1;
    if (!G.mission) startMission(G, id);
  }
  if (inp.wasPressed('r') && G.mission) {
    const id = G.mission.id;
    G.mission = null;
    startMission(G, id);
  }
  if (inp.wasPressed('e')) {
    const p = G.player;
    if (p.onFoot) {
      const car = nearestCar(G, p.x, p.y, 70);
      if (car) {
        enterCar(G, car);
        if (car.driver === 'traffic') { /* jacked from traffic */ }
        G.audio.pickup();
      }
    } else {
      exitCar(G);
    }
  }
  if (inp.mouse.clicked && G.player.onFoot) fireShot(G);
  else if (inp.mouse.down && G.player.onFoot && G.time - (G.lastShot || 0) > 0.22) {
    G.lastShot = G.time;
    fireShot(G);
  }
  updatePlayer(G, dt);
  if (G.player.car) updateCar(G, G.player.car, dt);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  for (const car of G.cars) if (car.driver === 'cop' || car.driver === 'traffic') { /* driven above */ }
  updateMission(G, dt);
  updateTracers(G, dt);
  updateCamera(dt);
  G.view.w = canvas.width; G.view.h = canvas.height;
  if (Math.floor(G.time * 2) !== Math.floor((G.time - dt) * 2)) saveGame(G);
}

function render() {
  const W = canvas.width; const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (G.mode === 'title') {
    drawWorld();
    drawTitle(ctx, G, W, H);
    return;
  }
  drawWorld();
  drawMinimap(ctx, G);
  drawHud(ctx, G, W, H);
  if (G.mode === 'pause') drawPause(ctx, W, H);
  else if (G.mode === 'wasted') drawWasted(ctx, W, H);
  else if (G.mode === 'busted') drawBusted(ctx, W, H);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
  } catch (err) {
    console.error(err);
  }
  render();
  G.input.endFrame();
  requestAnimationFrame(frame);
}

// Click-to-start also works on the title screen via the mouse handler.
canvas.addEventListener('click', () => G.audio.unlock());
window.__game = G;
requestAnimationFrame(frame);
