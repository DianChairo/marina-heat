// main.js — Marina Heat boot, state, game loop, state machine, crime wiring.
import { makeRng, clamp, dist } from './rng.js';
import { createInput } from './input.js';
import { AudioSys } from './audio.js';
import { createCity, drawCity, WORLD } from './city.js';
import { makePlayer, updatePlayer, drawPlayer, tryEnterExit, nearestCar } from './player.js';
import { updateCar, collideCars, drawCar, carSpeed } from './vehicles.js';
import { spawnParked, spawnTrafficCar, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, drawPed, scarePeds, makePed } from './pedestrians.js';
import { addCrime, witnessNear, updateWanted, updateCops } from './police.js';
import { tryShoot, updateParticles, drawParticles } from './combat.js';
import { createMissions, updateMissions, addChaos, checkNearMiss, MARKER } from './missions.js';
import { drawHUD, drawWorldMarkers, drawOffscreenArrow, drawEndScreen, drawPause } from './hud.js';
import { loadSave, writeSave } from './storage.js';
import { isShotMode, shotName, shotSeed, setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const shot = isShotMode();
const seed = shot ? shotSeed() : 7;

const S = {
  t: 0, mode: shot ? 'play' : 'title', vw: 1280, vh: 720,
  cam: { x: 640, y: 700 }, shake: 0, golden: false,
  rng: makeRng(seed), city: createCity(seed), input: createInput(canvas), audio: new AudioSys(),
  player: makePlayer(600, 760), cars: [], peds: [], parts: [], floaters: [],
  cash: 0, score: 0, wanted: 0, heat: 0, busted: 0, unseenT: 0, lastCrimeT: 99, seenByCop: false, spawnT: 0,
  shootCd: 0, muzzle: 0, objective: '', phone: null, missions: createMissions(),
  stats: { missionsDone: 0, wrecks: 0, shots: 0, crimes: 0, topSpeed: 0, steals: 0 },
  saveBest() {
    const prev = loadSave() || {};
    writeSave({
      cash: Math.max(prev.cash || 0, S.cash), score: Math.max(prev.score || 0, S.score),
      missionsDone: Math.max(prev.missionsDone || 0, S.stats.missionsDone),
      wrecks: Math.max(prev.wrecks || 0, S.stats.wrecks), topSpeed: Math.max(prev.topSpeed || 0, S.stats.topSpeed),
    });
  },
  phoneMsg(from, text) { S.phone = { from, text, at: S.t }; S.audio.phone(); },
  spawnPed(x, y) { const pd = makePed(x, y, S.rng); S.peds.push(pd); return pd; },
  // ---- crime & chaos wiring ----
  onCrimeWitnessed(kind, x, y) {
    if (!witnessNear(S, x, y)) return;
    if (kind === 'crash') addCrime(S, 20, x, y);
    if (kind === 'pedhit') addCrime(S, 42, x, y);
  },
  onCarStolen(c, wasOccupied) {
    S.stats.steals++;
    scarePeds(S, c.x, c.y, 200);
    if (witnessNear(S, c.x, c.y, 300)) addCrime(S, wasOccupied ? 46 : 30, c.x, c.y);
    S.floaters.push({ x: c.x, y: c.y - 30, text: wasOccupied ? 'JACKED!' : 'STOLEN', life: 1, color: '#ffd23f' });
  },
  onPedHit(p, c) {
    addCrime(S, 44, p.x, p.y);
    addChaos(S, 90, 'MAYHEM');
    scarePeds(S, p.x, p.y, 260);
  },
  onPlayerCrash(rel, other) {
    if (witnessNear(S, S.player.x, S.player.y, 300)) addCrime(S, rel > 120 ? 26 : 14, S.player.x, S.player.y);
    addChaos(S, rel > 120 ? 70 : 35, 'CRASH');
    scarePeds(S, S.player.x, S.player.y, 170);
  },
  onCarWrecked(c) {
    S.stats.wrecks++;
    if (dist(S.player.x, S.player.y, c.x, c.y) < 420) { addChaos(S, 120, 'WRECK'); S.score += 3; }
    scarePeds(S, c.x, c.y, 240);
  },
};
window.__S = S;

function buildWorld() {
  S.cars = []; S.peds = []; S.parts = []; S.floaters = [];
  spawnParked(S);
  for (let i = 0; i < 9; i++) spawnTrafficCar(S, S.rng, false);
  spawnPeds(S, S.rng, 26);
}
buildWorld();

function resetRun(keepWealth) {
  if (!keepWealth) { /* fresh start keeps saved wealth only via Continue */ }
  S.player = makePlayer(600, 760);
  S.wanted = 0; S.heat = 0; S.busted = 0; S.unseenT = 0;
  S.missions = createMissions();
  buildWorld();
  S.cam.x = S.player.x; S.cam.y = S.player.y;
  S.mode = 'play';
  S.phoneMsg('Marisol Vega', 'Marina Heat, baby. Name is Marisol Vega — I fix problems for people with money. First job is at the M marker downtown. Do not keep me waiting.');
  S.objective = 'Go to the M marker downtown to work for Marisol.';
}

function resize() {
  S.vw = canvas.width = innerWidth; S.vh = canvas.height = innerHeight;
}
addEventListener('resize', resize); resize();

const startBtn = document.getElementById('startBtn');
const contBtn = document.getElementById('continueBtn');
const titleEl = document.getElementById('title');
const save = loadSave();
if (save && !shot) { contBtn.style.display = 'inline-block'; document.getElementById('saveInfo').textContent = `Saved: $${save.cash} · respect ${save.score} · ${save.missionsDone} jobs done`; }
function begin(withSave) {
  S.audio.init();
  if (withSave && save) { S.cash = save.cash; S.score = save.score; S.stats.missionsDone = save.missionsDone || 0; }
  titleEl.style.display = 'none';
  resetRun(true);
}
startBtn.addEventListener('click', () => begin(false));
contBtn.addEventListener('click', () => begin(true));
canvas.addEventListener('mousedown', () => S.audio.init());

function driveControls() {
  const k = S.input.keys;
  return { up: !!(k.KeyW || k.ArrowUp), down: !!(k.KeyS || k.ArrowDown), left: !!(k.KeyA || k.ArrowLeft), right: !!(k.KeyD || k.ArrowRight), hand: !!k.Space };
}

function update(dt) {
  S.t += dt;
  const inp = S.input, p = S.player;
  if (inp.hit('KeyM')) S.audio.toggleMute();
  if (inp.hit('KeyP') || inp.hit('Escape')) { if (S.mode === 'play') S.mode = 'pause'; else if (S.mode === 'pause') S.mode = 'play'; }
  if (S.mode !== 'play') { inp.endFrame(); return; }
  // enter/exit vs mission marker: marker wins when on foot near it with no job running
  const nearMarker = !p.car && !S.missions.active && dist(p.x, p.y, MARKER.x, MARKER.y) < 60;
  if (inp.hit('KeyE') && !nearMarker) tryEnterExit(S);
  if (inp.mouse.down) tryShoot(S);
  updatePlayer(S, dt);
  if (p.car) {
    updateCar(S, p.car, driveControls(), dt);
    const spd = carSpeed(p.car);
    S.stats.topSpeed = Math.max(S.stats.topSpeed, spd * 0.79);
    S.audio.engine(clamp(spd / 430, 0, 1), true);
    checkNearMiss(S);
  } else S.audio.engine(0, false);
  updateTraffic(S, dt);
  updateCops(S, dt);
  collideCars(S, dt);
  updatePeds(S, dt);
  updateWanted(S, dt);
  updateMissions(S, dt);
  updateParticles(S, dt);
  for (const f of S.floaters) { f.life -= dt; f.y -= 26 * dt; }
  S.floaters = S.floaters.filter((f) => f.life > 0);
  // camera follow + shake
  const tx = p.car ? p.car.x : p.x, ty = p.car ? p.car.y : p.y;
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 5);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 5);
  S.shake = Math.max(0, S.shake - dt * 26);
  inp.endFrame();
}

function draw() {
  const vw = S.vw, vh = S.vh;
  ctx.fillStyle = '#1668a8'; ctx.fillRect(0, 0, vw, vh);
  const shx = (Math.random() - 0.5) * S.shake, shy = (Math.random() - 0.5) * S.shake;
  ctx.save();
  ctx.translate(vw / 2 - S.cam.x + shx, vh / 2 - S.cam.y + shy);
  drawCity(ctx, S.city, S.cam, vw, vh, performance.now());
  drawWorldMarkers(ctx, S);
  for (const c of S.cars) drawCar(ctx, c, performance.now());
  for (const pd of S.peds) drawPed(ctx, pd);
  drawPlayer(ctx, S.player, performance.now());
  drawParticles(ctx, S);
  ctx.restore();
  if (S.golden) { ctx.fillStyle = 'rgba(255,150,50,0.13)'; ctx.fillRect(0, 0, vw, vh); }
  if (S.mode !== 'title') {
    drawHUD(ctx, S);
    drawOffscreenArrow(ctx, S);
  }
  if (S.mode === 'pause') drawPause(ctx, S);
  if (S.mode === 'dead') drawEndScreen(ctx, S, 'dead');
  if (S.mode === 'busted') drawEndScreen(ctx, S, 'busted');
}

if (shot) {
  titleEl.style.display = 'none';
  setupShot(S, shotName());
  // run a fixed batch of sim ticks so the scene is alive, then freeze-frame it
  for (let i = 0; i < 45; i++) {
    // gentle scripted motion without full AI chaos: drift cars/peds by their velocities
    for (const c of S.cars) { c.x += (c.vx || 0) * (1 / 60); c.y += (c.vy || 0) * (1 / 60); }
    if (S.player.car) { S.player.x = S.player.car.x; S.player.y = S.player.car.y; }
    S.t += 1 / 60;
  }
  S.cam.x = S.player.x; S.cam.y = S.player.y;
  draw();
  window.__shotReady = true;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    if (S.mode === 'play' || S.mode === 'pause') update(dt);
    else if (S.mode === 'dead' || S.mode === 'busted') {
      if (S.input.hit('KeyR') || S.input.mouse.clicked) { S.input.endFrame(); titleEl.style.display = 'none'; resetRun(true); }
      S.input.endFrame();
    } else { S.t += dt; S.input.endFrame(); }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
