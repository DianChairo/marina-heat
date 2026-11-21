// World state and the per-tick update: input edges, player, driving,
// traffic, police, peds, combat, missions, day cycle and camera.
import { WORLD, clamp } from './config.js';
import { generateCity } from './city.js';
import { makeRng } from './random.js';
import { makePlayer, updatePlayer, exitCar } from './player.js';
import { spawnTraffic, updateTraffic, drivePlayerCar } from './vehicles.js';
import { updatePolice } from './police.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { makeCombat, updateCombat } from './combat.js';
import { makeMissions, updateMissions } from './missions.js';
import { makeAudio } from './audio.js';

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = generateCity(seed);
  const world = {
    seed,
    rng,
    city,
    state: 'title',
    time: 0,
    dayT: 0.08,
    wantedTimer: 0,
    bustedAt: -99,
    lastFine: 0,
    player: makePlayer(1600, 2000),
    cars: [],
    police: [],
    peds: [],
    combat: makeCombat(),
    missions: makeMissions(),
    audio: makeAudio(),
    stats: { copsDown: 0 },
    camera: { x: 1600, y: 2000 },
    view: { w: 1280, h: 800 },
    input: null,
    ctx: null,
  };
  world.cars = spawnTraffic(city, seed, 26);
  world.peds = spawnPeds(city, seed, 42);
  return world;
}

export function stepWorld(world, dt) {
  world.time += dt;
  world.dayT = (world.dayT + dt / 240) % 1;
  const input = world.input;
  if (!input) return;
  // Global edges.
  if (input.wasPressed('KeyP') && (world.state === 'playing' || world.state === 'paused')) {
    world.state = world.state === 'playing' ? 'paused' : 'playing';
  }
  if (world.state === 'title' && (input.wasPressed('Enter') || input.wasPressed('NumpadEnter'))) {
    world.state = 'playing';
    world.audio.ensure();
  }
  if (world.state === 'busted' && world.time - world.bustedAt > 1 && input.wasPressed('Enter')) {
    world.state = 'playing';
  }
  if (world.state === 'gameover' && input.wasPressed('Enter')) {
    const seed = world.seed;
    const fresh = createWorld(seed);
    const keep = { input: world.input, ctx: world.ctx, view: world.view };
    Object.assign(world, fresh, keep);
    world.state = 'playing';
  }
  if (world.state !== 'playing') return;
  // Exit car with E when driving (player.js handles entering).
  if (!world.player.onFoot && input.wasPressed('KeyE')) {
    exitCar(world);
  }
  if (world.player.onFoot) updatePlayer(world, dt);
  else drivePlayerCar(world, dt);
  updateTraffic(world, dt);
  updatePolice(world, dt);
  updatePeds(world, dt);
  updateCombat(world, dt);
  updateMissions(world, dt);
  // Camera follows the player, clamped to the city.
  const p = world.player;
  world.camera.x = clamp(p.x, world.view.w / 2 - 100, WORLD - world.view.w / 2 + 100);
  world.camera.y = clamp(p.y, world.view.h / 2 - 100, WORLD - world.view.h / 2 + 100);
  // Slow health regen out of combat.
  if (world.time - world.combat.lastHit > 8 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 2 * dt);
  }
}
