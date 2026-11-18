// traffic.js — lane-following civilian cars that cruise the road grid,
// slow near the player, and respawn far away so the streets stay alive.
import { randomRoadPoint } from './city.js';
import { createCar, drawCar, randomCarColor, spawnSmoke, stepCar } from './vehicles.js';

const MAX_TRAFFIC = 14;

export function spawnTrafficCar(G) {
  const p = randomRoadPoint(G.rng, G.city);
  const car = createCar(p.x, p.y, p.angle, randomCarColor(G.rng), 'traffic');
  car.lane = p.angle;
  car.speed = G.rng.range(90, 150);
  G.cars.push(car);
  return car;
}

export function initTraffic(G, count) {
  for (let i = 0; i < count; i++) spawnTrafficCar(G);
}

export function updateTraffic(G, dt) {
  const p = G.player;
  let traffic = 0;
  for (const car of G.cars) if (car.kind === 'traffic') traffic++;
  if (traffic < MAX_TRAFFIC && G.rng.chance(0.02)) spawnTrafficCar(G);
  for (const car of G.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    const distP = Math.hypot(car.x - p.x, car.y - p.y);
    if (distP > 1400) {
      // Recycle far-away cars onto a road near the player.
      const np = randomRoadPoint(G.rng, G.city);
      car.x = np.x;
      car.y = np.y;
      car.angle = np.angle;
      car.speed = G.rng.range(90, 150);
      continue;
    }
    // At intersections (near a crossing road) sometimes turn.
    const nearV = G.city.roadsV.some((rx) => Math.abs(car.x - rx) < 34);
    const nearH = G.city.roadsH.some((ry) => Math.abs(car.y - ry) < 34);
    if (nearV && nearH && G.rng.chance(0.006)) {
      car.angle += G.rng.pick([-Math.PI / 2, Math.PI / 2]);
    }
    // Slow down if another car is right ahead.
    let slow = false;
    for (const other of G.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 20) {
        slow = true;
        break;
      }
    }
    const target = slow ? 0 : G.rng.range(110, 150);
    const control = {
      throttle: car.speed < target ? 0.55 : 0,
      brake: car.speed > target + 20 ? 0.8 : 0,
      steer: 0,
    };
    // Gentle steering back onto the current heading.
    let diff = car.lane - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    control.steer = Math.max(-1, Math.min(1, diff * 2));
    stepCar(G, car, dt, control);
    if (car.smoke > 0.2 && G.rng.chance(0.08)) spawnSmoke(G, car.x, car.y, false);
  }
}

export function drawTraffic(ctx, G) {
  for (const car of G.cars) {
    if (car.kind === 'traffic') drawCar(ctx, car);
  }
}
