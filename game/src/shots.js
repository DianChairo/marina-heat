// shots.js — deterministic screenshot modes. With ?shot=<name>&seed=7
// the game builds the seeded city, poses one scene, steps the world a
// fixed number of ticks (no wall-clock input), renders, and sets
// window.__shotReady = true so an external driver can capture the
// canvas. Scenes: cover | drive | chase | mission.

import { WATER_X } from './city.js';
import { makeCar } from './vehicles.js';

export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const seed = Number.parseInt(q.get('seed') || '7', 10) || 7;
  return { shot, seed };
}

// Pose the world for the requested scene. Called once, before the
// fixed-step warm-up in main.js.
export function stageScene(world, shot) {
  const p = world.player;
  const city = world.city;

  if (shot === 'cover') {
    // Hero tableau on the promenade: hero car angled toward camera,
    // player beside it, Marisol and the marina behind.
    const car = makeCar(WATER_X - 190, 700, -0.5, '#e74c3c', 'civilian');
    car.driver = null;
    world.parked.push(car);
    p.x = WATER_X - 150;
    p.y = 660;
    p.angle = -2.2;
    world.aimAngle = -2.2;
    world.cameraSnap();
    return;
  }

  if (shot === 'drive') {
    // Player driving east along the horizontal street at y=1024.
    const car = makeCar(900, 1024 + 19, 0, '#3498db', 'civilian');
    car.driver = 'player';
    car.speed = 215;
    world.traffic.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    world.cameraSnap();
    return;
  }

  if (shot === 'chase') {
    // Three-star chase: player car fleeing west, cruisers behind.
    const car = makeCar(1500, 1280 + 19, 0, '#f1c40f', 'civilian');
    car.driver = 'player';
    car.speed = 260;
    world.traffic.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    world.police.heat = 3;
    const c1 = makeCar(1330, 1252, 0.15, '#ffffff', 'police');
    c1.driver = 'police';
    c1.speed = 240;
    const c2 = makeCar(1300, 1310, -0.1, '#ffffff', 'police');
    c2.driver = 'police';
    c2.speed = 225;
    world.police.cruisers.push(c1, c2);
    world.cameraSnap();
    return;
  }

  if (shot === 'mission') {
    // At Marisol's corner with a Bay Run about to start: player on
    // foot next to her, briefing banner up.
    p.x = city.marisol.x - 34;
    p.y = city.marisol.y + 8;
    p.angle = 0.4;
    world.aimAngle = 0.4;
    world.missions.showBanner('BAY RUN — hit every checkpoint before the clock dies!');
    world.missions.bannerTime = 999;
    world.cameraSnap();
    return;
  }

  // Unknown scene name: fall back to the cover tableau.
  stageScene(world, 'cover');
}
