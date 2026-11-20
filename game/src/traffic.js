// traffic.js — civilian traffic that follows the street grid.
// Each traffic car picks a direction at every intersection, keeps to
// the right-hand lane, slows for the car ahead and for the player.

import { BLOCK, ROAD_W, WATER_X, WATER_Y } from './city.js';
import { makeCar, stepCar, CAR_COLORS } from './vehicles.js';
import { Rng, clamp, dist } from './rng.js';

const LANE = 19; // lane offset from the street centreline

export function spawnTraffic(city, seed, count) {
  const rng = new Rng(seed * 31 + 7);
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 400) {
    // Random point on a random street.
    const vertical = rng.chance(0.5);
    const line = rng.int(0, 11) * BLOCK;
    const along = rng.range(80, 2700);
    const dir = rng.chance(0.5) ? 1 : -1;
    let x;
    let y;
    let angle;
    if (vertical) {
      x = line + (dir > 0 ? -LANE : LANE);
      y = along;
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = along;
      y = line + (dir > 0 ? LANE : -LANE);
      angle = dir > 0 ? 0 : Math.PI;
    }
    if (x > WATER_X - 60 || y > WATER_Y - 60) continue;
    const car = makeCar(x, y, angle, rng.pick(CAR_COLORS), 'civilian');
    car.driver = 'traffic';
    car.cruise = rng.range(90, 150);
    car.speed = car.cruise * 0.6;
    cars.push(car);
  }
  return cars;
}

// Snap helpers: which street axis is the car travelling on?
function nearestLine(v) {
  return Math.round(v / BLOCK) * BLOCK;
}

export function updateTraffic(world, dt) {
  const { city, player } = world;
  for (const car of world.traffic) {
    const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
    // Keep the car glued to its lane centre.
    let steer = 0;
    let throttle = 1;
    if (vertical) {
      const lineX = nearestLine(car.x + (Math.sin(car.angle) > 0 ? LANE : -LANE));
      const targetX = lineX + (Math.sin(car.angle) > 0 ? -LANE : LANE);
      steer = clamp((targetX - car.x) * 0.02, -0.5, 0.5);
    } else {
      const lineY = nearestLine(car.y + (Math.cos(car.angle) > 0 ? -LANE : LANE));
      const targetY = lineY + (Math.cos(car.angle) > 0 ? LANE : -LANE);
      steer = clamp((targetY - car.y) * 0.02, -0.5, 0.5);
    }

    // Slow down for anything ahead (cars, the player on foot or driving).
    const aheadX = car.x + Math.cos(car.angle) * 60;
    const aheadY = car.y + Math.sin(car.angle) * 60;
    let blocked = false;
    for (const other of world.allCars()) {
      if (other === car) continue;
      if (dist(aheadX, aheadY, other.x, other.y) < 42) blocked = true;
    }
    if (!player.inCar && dist(aheadX, aheadY, player.x, player.y) < 40) blocked = true;
    if (blocked) throttle = car.speed > 20 ? -0.4 : 0;

    // At an intersection, sometimes turn onto the crossing street.
    const nearX = Math.abs(car.x - nearestLine(car.x)) < 14;
    const nearY = Math.abs(car.y - nearestLine(car.y)) < 14;
    if (nearX && nearY && !car.turnCooldown) {
      car.turnCooldown = 1.2;
      const roll = world.rng.chance(0.34);
      if (roll) {
        const turn = world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        car.angle += turn;
        // Nudge into the new lane.
        car.x = nearestLine(car.x) + Math.cos(car.angle + Math.PI / 2) * 0; // keep pos
        car.speed = Math.min(car.speed, 70);
      }
    }
    car.turnCooldown = Math.max(0, (car.turnCooldown || 0) - dt);

    // Despawn if it somehow ends up in the water quarter; respawn is
    // handled by clamping in stepCar, so just keep driving.
    const targetSpeed = blocked ? 0 : car.cruise;
    throttle = car.speed < targetSpeed ? 0.7 : 0;
    if (blocked && car.speed > 5) throttle = -0.5;
    stepCar(car, throttle, steer, dt, city);

    // Gentle separation so traffic does not stack inside itself.
    for (const other of world.traffic) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 0 && d < 34) {
        car.x += ((car.x - other.x) / d) * (34 - d) * 0.3;
        car.y += ((car.y - other.y) / d) * (34 - d) * 0.3;
      }
    }
    void ROAD_W;
  }
}
