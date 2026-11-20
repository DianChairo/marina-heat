// main.js — Marina Heat entry point: builds the world, runs the loop,
// owns the camera and the top-level state machine
// (title → playing ⇄ paused, busted / wasted), and exports `world`
// for tooling and screenshot drivers.

import { generateCity, drawCity, WORLD } from './city.js';
import { Rng, clamp } from './rng.js';
import { attachInput, input, justPressed, endFrame } from './input.js';
import { loadSave, storeSave } from './storage.js';
import { AudioEngine } from './audio.js';
import { makeCar, drawCar, CAR_COLORS } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians, drawPedestrian } from './pedestrians.js';
import { makePlayer, updatePlayer, drawPlayer } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { drawHUD, drawCoverTitle } from './hud.js';
import { parseShotParams, stageScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const shotParams = parseShotParams();
const SEED = shotParams ? shotParams.seed : 7;

const START = { x: 2560, y: 660 };

export const world = {
  seed: SEED,
  rng: new Rng(SEED * 977 + 41),
  city: null,
  time: 0,
  state: shotParams ? 'shot' : 'title',
  shotMode: shotParams ? shotParams.shot : null,
  cam: { x: 0, y: 0, w: canvas.width, h: canvas.height },
  player: null,
  parked: [],
  traffic: [],
  pedestrians: [],
  police: null,
  combat: null,
  missions: null,
  audio: null,
  save: null,
  aimAngle: 0,

  allCars() {
    return [...this.parked, ...this.traffic, ...this.police.cruisers];
  },

  persist() {
    storeSave(this.save);
  },

  cameraSnap() {
    this.cam.x = clamp(this.player.x - this.cam.w / 2, 0, WORLD - this.cam.w);
    this.cam.y = clamp(this.player.y - this.cam.h / 2, 0, WORLD - this.cam.h);
  },

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.blip(180, 0.3, 'sawtooth', 0.2);
  },

  respawn(fine) {
    const p = this.player;
    if (p.inCar) {
      p.inCar.driver = null;
      p.inCar = null;
    }
    p.x = START.x;
    p.y = START.y;
    p.health = 100;
    p.dead = false;
    this.police.heat = 0;
    this.police.cruisers = [];
    this.police.officers = [];
    this.police.bust = 0;
    if (fine) this.save.cash = Math.max(0, this.save.cash - 150);
    this.persist();
    this.state = 'playing';
    this.cameraSnap();
  },
};

function buildWorld() {
  world.city = generateCity(SEED);
  world.save = loadSave();
  world.audio = new AudioEngine(world.save);
  if (shotParams) {
    // Screenshot mode never touches real audio hardware.
    world.audio.ensure = () => false;
  }
  world.player = makePlayer(START.x, START.y);

  const carRng = new Rng(SEED * 555 + 3);
  world.parked = world.city.parkedSpots.map((s) =>
    makeCar(s.x, s.y, s.angle, carRng.pick(CAR_COLORS), 'civilian'));
  world.traffic = spawnTraffic(world.city, SEED, 14);
  world.pedestrians = spawnPedestrians(SEED, 26);
  world.police = new Police(world);
  world.combat = new Combat(world);
  world.missions = new Missions(world);
  world.cameraSnap();
}

function updateCamera(dt) {
  const cam = world.cam;
  const tx = clamp(world.player.x - cam.w / 2, 0, WORLD - cam.w);
  const ty = clamp(world.player.y - cam.h / 2, 0, WORLD - cam.h);
  const k = Math.min(1, dt * 7);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

function updateAim() {
  const p = world.player;
  const wx = world.cam.x + input.mouseX;
  const wy = world.cam.y + input.mouseY;
  world.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  if (!p.inCar) p.angle = world.aimAngle;
}

function step(dt) {
  world.time += dt;
  updateAim();
  updatePlayer(world, dt);
  updateTraffic(world, dt);
  updatePedestrians(world, dt);
  world.police.update(dt);
  world.combat.update(dt);
  world.missions.update(dt);
  updateCamera(dt);

  // Slow health regen while calm.
  if (world.police.stars === 0 && world.player.health > 0 && world.player.health < 100) {
    world.player.health = Math.min(100, world.player.health + dt * 1.5);
  }
  if (world.player.health <= 0 && world.state === 'playing') {
    world.state = 'wasted';
    world.audio.engine(false, 0);
    world.audio.siren(false, 0);
  }
}

function render() {
  const cam = world.cam;
  drawCity(ctx, world.city, cam);
  world.missions.drawWorld(ctx, cam);
  for (const ped of world.pedestrians) drawPedestrian(ctx, ped, cam);
  for (const car of world.parked) drawCar(ctx, car, cam);
  for (const car of world.traffic) drawCar(ctx, car, cam);
  for (const car of world.police.cruisers) drawCar(ctx, car, cam);
  world.police.drawOfficers(ctx, cam);
  drawPlayer(ctx, world, cam);
  world.combat.draw(ctx, cam);
  if (world.shotMode === 'cover') {
    drawCoverTitle(ctx, cam.w, cam.h);
  } else if (world.state !== 'shot') {
    drawHUD(ctx, world);
  } else {
    drawHUD(ctx, { ...world, state: 'playing' });
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastNow) / 1000 || 0.016);
  lastNow = now;

  if (world.state === 'title') {
    if (justPressed('Enter')) {
      world.audio.ensure();
      world.audio.blip(660, 0.08, 'triangle', 0.15);
      world.state = 'playing';
    }
  } else if (world.state === 'playing') {
    if (justPressed('KeyP')) {
      world.state = 'paused';
    } else if (justPressed('KeyM')) {
      world.audio.setMuted(!world.audio.muted);
      world.save.muted = world.audio.muted;
      world.persist();
    } else {
      step(dt);
    }
  } else if (world.state === 'paused') {
    if (justPressed('KeyP')) world.state = 'playing';
  } else if (world.state === 'busted') {
    if (justPressed('Enter')) world.respawn(true);
  } else if (world.state === 'wasted') {
    if (justPressed('Enter')) world.respawn(false);
  }

  render();
  endFrame();
  requestAnimationFrame(frame);
}

let lastNow = performance.now();

buildWorld();
attachInput(canvas);

if (shotParams) {
  // Deterministic warm-up: fixed steps, no input, then one render and
  // the readiness flag for the screenshot driver.
  stageScene(world, shotParams.shot);
  const FIXED = 1 / 30;
  for (let i = 0; i < 45; i++) {
    world.time += FIXED;
    updateTraffic(world, FIXED);
    updatePedestrians(world, FIXED);
    if (world.player.inCar) {
      world.player.x = world.player.inCar.x;
      world.player.y = world.player.inCar.y;
    }
    if (shotParams.shot === 'chase') world.police.update(FIXED);
  }
  world.cameraSnap();
  render();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
