// shots.js — deterministic screenshot scenes. With ?shot=<name>&seed=<n>
// the game builds the world from that seed, poses a frozen scene, renders
// it once and sets window.__shotReady = true. Same seed -> same scene.

import { Car, CAR_SPECS, POLICE_SPEC } from './vehicles.js';
import { PoliceCar } from './police.js';
import { MISSION_DEFS } from './missions.js';

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name) return null;
  const seedParam = params.get('seed');
  const seed = seedParam === null ? 7 : Number(seedParam) || 7;
  return { name, seed };
}

export function applyShot(world, name) {
  const player = world.player;
  world.state = 'playing';
  if (name === 'cover') {
    // On foot at a busy intersection, traffic and peds around, HUD live.
    player.x = 428;
    player.y = 452;
    player.angle = -0.6;
    world.missions.phone(world, 'Marisol Vega', 'Welcome to Coral Marina. Press F when you want work.');
  } else if (name === 'drive') {
    // Behind the wheel of a coral coupe on a main street.
    const car = new Car(CAR_SPECS[0], 800, 374, 0, 'player');
    car.driver = 'player';
    car.vx = 210;
    world.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
  } else if (name === 'chase') {
    // Three stars, cruisers closing in on the player's car.
    const car = new Car(CAR_SPECS[4], 1200, 1174, 0, 'player');
    car.driver = 'player';
    car.vx = 180;
    car.damage(22);
    world.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    world.wanted.heat = 285;
    const spots = [
      { x: 1060, y: 1090, a: 0.5 }, { x: 1330, y: 1250, a: -2.6 }, { x: 1010, y: 1300, a: -0.4 },
    ];
    for (const s of spots) {
      const copCar = new Car(POLICE_SPEC, s.x, s.y, s.a, 'police');
      copCar.driver = 'ai';
      world.police.push(new PoliceCar(copCar));
      world.cars.push(copCar);
    }
    world.missions.phone(world, 'Marisol Vega', 'CPD is all over you — lose them!');
  } else if (name === 'mission') {
    // Bay Run active, first checkpoint ring visible ahead of the player.
    player.x = 400;
    player.y = 520;
    player.angle = -Math.PI / 2;
    world.missions.begin(world, MISSION_DEFS[0]);
    world.missions.messageQueue.length = 0;
    world.missions.phone(world, 'Marisol Vega', 'Bay Run: checkpoints are lit on your map. Move!');
  }
  // Freeze ambient motion so the render is stable.
  world.frozen = true;
}
