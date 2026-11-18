// traffic.js — lane-following traffic AI. Cars drive along the street
// grid in right-hand lanes, slow for the car ahead, stop or swerve for
// obstacles and pedestrians, and pick a new heading at intersections.

import { Car, CAR_SPECS } from './vehicles.js';
import { CELL, ROAD, onRoad } from './city.js';
import { clamp, dist } from './rng.js';

const LANE = 26; // offset from street centreline for right-hand traffic

export class TrafficCar {
  constructor(car, rng) {
    this.car = car;
    this.rng = rng;
    this.dir = { x: 1, y: 0 };
    this.speed = 0;
    this.cruise = rng.float(120, 185);
    this.turnCooldown = 0;
    this.honkT = 0;
    this.swerve = 0;
    this.syncToRoad();
  }

  syncToRoad() {
    // Snap the car onto the nearest lane in its current direction.
    const c = this.car;
    if (this.dir.x !== 0) {
      const centre = Math.round(c.y / CELL) * CELL;
      c.y = centre + LANE * this.dir.x; // right-hand side
      c.angle = this.dir.x > 0 ? 0 : Math.PI;
    } else {
      const centre = Math.round(c.x / CELL) * CELL;
      c.x = centre - LANE * this.dir.y;
      c.angle = this.dir.y > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    c.vx = 0;
    c.vy = 0;
  }

  atIntersection() {
    const c = this.car;
    const mx = ((c.x % CELL) + CELL) % CELL;
    const my = ((c.y % CELL) + CELL) % CELL;
    const nearX = Math.min(mx, CELL - mx) < ROAD / 2;
    const nearY = Math.min(my, CELL - my) < ROAD / 2;
    return nearX && nearY;
  }

  update(dt, world) {
    const c = this.car;
    if (c.dead || c.driver === 'player') return;
    this.turnCooldown -= dt;
    this.honkT -= dt;

    // Decide turns at intersections.
    if (this.atIntersection() && this.turnCooldown <= 0) {
      this.turnCooldown = 1.2;
      const r = this.rng.next();
      if (r < 0.3) {
        // Turn left or right.
        const old = this.dir;
        const s = r < 0.15 ? 1 : -1;
        this.dir = { x: old.y * s, y: -old.x * s };
        this.syncToRoad();
      }
    }

    // Look ahead for obstacles: other cars, the player, pedestrians.
    const lookAhead = 74;
    const ax = c.x + this.dir.x * lookAhead;
    const ay = c.y + this.dir.y * lookAhead;
    let blocked = false;
    let panic = false;
    for (const other of world.cars) {
      if (other === c || other.dead) continue;
      if (dist(ax, ay, other.x, other.y) < 34) { blocked = true; break; }
    }
    if (!blocked && !world.player.inCar && dist(ax, ay, world.player.x, world.player.y) < 30) {
      blocked = true;
      panic = true;
    }
    if (!blocked) {
      for (const ped of world.peds) {
        if (!ped.dead && dist(ax, ay, ped.x, ped.y) < 26) { blocked = true; panic = true; break; }
      }
    }

    // Swerve around a blocking pedestrian instead of stopping forever.
    if (panic && this.rng.chance(0.5)) this.swerve = this.rng.sign() * 14;
    else this.swerve *= Math.pow(0.05, dt);

    const targetSpeed = blocked ? 0 : this.cruise;
    this.speed += clamp(targetSpeed - this.speed, -420 * dt, 150 * dt);
    if (blocked && this.honkT <= 0) {
      this.honkT = this.rng.float(1.4, 3.2);
      world.events.push({ type: 'honk', x: c.x, y: c.y });
    }

    // Drive: position follows the lane, with a lateral swerve offset.
    const nx = c.x + this.dir.x * this.speed * dt;
    const ny = c.y + this.dir.y * this.speed * dt;
    c.x = nx;
    c.y = ny;
    if (this.dir.x !== 0) {
      const centre = Math.round(c.y / CELL) * CELL;
      const laneY = centre + LANE * this.dir.x + this.swerve;
      c.y += (laneY - c.y) * Math.min(1, dt * 3);
      c.angle = this.dir.x > 0 ? 0 : Math.PI;
    } else {
      const centre = Math.round(c.x / CELL) * CELL;
      const laneX = centre - LANE * this.dir.y + this.swerve;
      c.x += (laneX - c.x) * Math.min(1, dt * 3);
      c.angle = this.dir.y > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    c.vx = this.dir.x * this.speed;
    c.vy = this.dir.y * this.speed;

    // Despawn far cars, respawn near the player to keep streets alive.
    const d = dist(c.x, c.y, world.player.pos.x, world.player.pos.y);
    if (d > 1500) {
      const spot = randomRoadSpotNear(world.rng, world.player.pos, 700, 1100);
      if (spot) {
        c.x = spot.x;
        c.y = spot.y;
        this.dir = spot.dir;
        this.syncToRoad();
      }
    }
    // Keep traffic out of the water.
    if (!onRoad(c.x, c.y) && c.x > 2600) {
      this.dir = { x: -1, y: 0 };
      this.syncToRoad();
    }
  }
}

export function randomRoadSpotNear(rng, centre, minD, maxD) {
  for (let i = 0; i < 24; i++) {
    const gx = Math.round((centre.x + rng.float(-maxD, maxD)) / CELL);
    const gy = Math.round((centre.y + rng.float(-maxD, maxD)) / CELL);
    if (gx < 0 || gy < 0 || gx > 8 || gy > 8) continue;
    const horizontal = rng.chance(0.5);
    const along = rng.float(-170, 170);
    const x = horizontal ? gx * CELL + along : gx * CELL;
    const y = horizontal ? gy * CELL : gy * CELL + along;
    if (x < 60 || y < 60 || x > 2650 || y > 3050) continue;
    if (dist(x, y, centre.x, centre.y) < minD) continue;
    const dir = horizontal
      ? { x: rng.chance(0.5) ? 1 : -1, y: 0 }
      : { x: 0, y: rng.chance(0.5) ? 1 : -1 };
    return { x, y, dir };
  }
  return null;
}

export function spawnTraffic(rng, playerPos, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const spot = randomRoadSpotNear(rng, playerPos, 260, 1250);
    if (!spot) continue;
    const spec = rng.pick(CAR_SPECS);
    const car = new Car(spec, spot.x, spot.y, 0, 'traffic');
    car.driver = 'ai';
    const tc = new TrafficCar(car, rng);
    tc.dir = spot.dir;
    tc.syncToRoad();
    out.push(tc);
  }
  return out;
}
