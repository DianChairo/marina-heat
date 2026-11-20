// vehicles.js — the car entity: arcade physics, damage, and drawing.
// Cars are used for parked cars, traffic, police cruisers and the
// player's ride; a `kind` tag decides the paint job and lights.

import { clamp } from './rng.js';
import { hitsBuilding, isWater } from './city.js';

export const CAR_COLORS = [
  '#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#9b59b6', '#1abc9c',
  '#e67e22', '#fd79a8', '#00cec9', '#dfe6e9', '#636e72', '#ff7675',
];

let nextId = 1;

export function makeCar(x, y, angle, color, kind = 'civilian') {
  return {
    id: nextId++,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color,
    kind, // 'civilian' | 'police' | 'player'
    health: 100,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    len: 46,
    wid: 22,
    steer: 0,
    sirenPhase: Math.random() * 10,
  };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

// Arcade step: throttle -1..1, steer -1..1. Returns true if the car
// slammed into something solid this step.
export function stepCar(car, throttle, steer, dt, city) {
  const accel = throttle >= 0 ? 260 : 200;
  const maxSpeed = throttle >= 0 ? 340 : 130;
  car.steer = steer;
  const forward = Math.sign(throttle);
  if (throttle !== 0) {
    car.speed += accel * forward * dt;
  } else {
    // Engine braking / rolling resistance.
    car.speed -= car.speed * 1.6 * dt;
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  car.speed = clamp(car.speed, -maxSpeed, maxSpeed);
  // Steering authority scales with speed.
  const turnRate = 2.1 * clamp(car.speed / 120, -1, 1);
  car.angle += steer * turnRate * dt * (car.speed < 0 ? -1 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;

  let crashed = false;
  if (hitsBuilding(city, nx, ny, 16) || isWater(nx, ny)) {
    crashed = Math.abs(car.speed) > 60;
    car.health -= Math.abs(car.speed) * 0.06;
    car.speed = -car.speed * 0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = clamp(car.x, 20, 3180);
  car.y = clamp(car.y, 20, 3180);
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.health = Math.max(0, car.health);
  return crashed;
}

export function drawCar(ctx, car, cam) {
  const sx = car.x - cam.x;
  const sy = car.y - cam.y;
  if (sx < -70 || sy < -70 || sx > cam.w + 70 || sy > cam.h + 70) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);

  // Body.
  ctx.fillStyle = car.kind === 'police' ? '#f4f6f7' : car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 6);
  ctx.fill();

  if (car.kind === 'police') {
    ctx.fillStyle = '#1b2a4a';
    ctx.fillRect(-car.len / 2, -car.wid / 2, 12, car.wid);
    ctx.fillRect(car.len / 2 - 12, -car.wid / 2, 12, car.wid);
    // Light bar, alternating red/blue.
    const phase = Math.floor(performance.now() / 180 + car.sirenPhase) % 2;
    ctx.fillStyle = phase === 0 ? '#ff2d2d' : '#3867ff';
    ctx.fillRect(-7, -car.wid / 2 + 2, 14, 5);
    ctx.fillStyle = phase === 0 ? '#3867ff' : '#ff2d2d';
    ctx.fillRect(-7, car.wid / 2 - 7, 14, 5);
  }

  // Cabin / windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -6, -car.wid / 2 + 4, 18, car.wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,200,240,0.5)';
  ctx.fillRect(8, -car.wid / 2 + 5, 4, car.wid - 10);

  // Wheels.
  ctx.fillStyle = '#14161a';
  const wy = car.wid / 2 - 2;
  ctx.fillRect(-car.len / 2 + 5, -wy - 2, 9, 4);
  ctx.fillRect(-car.len / 2 + 5, wy - 2, 9, 4);
  ctx.fillRect(car.len / 2 - 14, -wy - 2, 9, 4);
  ctx.fillRect(car.len / 2 - 14, wy - 2, 9, 4);

  // Damage smoke tint.
  if (car.health < 35) {
    ctx.fillStyle = 'rgba(40,40,40,0.35)';
    roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 6);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
