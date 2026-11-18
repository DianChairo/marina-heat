// Car physics + drawing. Cars are rectangles (w=22,h=40) with arcade drift physics.
import { clamp, angDiff } from './rng.js';
import { collideBuildings, pointInBuilding, WORLD_W, WORLD_H } from './city.js';

export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#1abc9c', '#fd79a8', '#636e72'];
let nextId = 1;
export function makeCar(x, y, ang, color, kind = 'civilian') {
  return {
    id: nextId++, x, y, ang, vx: 0, vy: 0, speed: 0, steer: 0,
    w: 22, h: 40, color, kind, hp: 100, driver: null, parked: false,
    smoke: 0, wrecked: false, honkT: 0, flashT: 0, ai: null, lastHitT: 0,
  };
}
export function carCorners(c) {
  const ca = Math.cos(c.ang), sa = Math.sin(c.ang), hw = c.w / 2, hh = c.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([lx, ly]) => [c.x + lx * ca - ly * sa, c.y + lx * sa + ly * ca]);
}
export function carsOverlap(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy < 42 * 42;
}
// Arcade drive step. throttle -1..1, steer -1..1. Returns impact speed if it hit a building.
export function stepCar(c, dt, throttle, steer, handbrake) {
  if (c.wrecked) { c.speed *= Math.pow(0.2, dt); c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= Math.pow(0.1, dt); c.vy *= Math.pow(0.1, dt); return 0; }
  const maxF = 330, maxR = -130;
  const accel = throttle > 0 ? 260 : 340;
  c.speed += throttle * accel * dt;
  if (throttle === 0) c.speed -= c.speed * 0.7 * dt;
  if (handbrake) c.speed -= c.speed * 2.2 * dt;
  c.speed = clamp(c.speed, maxR, maxF);
  const steerAmt = steer * 0.55 * clamp(Math.abs(c.speed) / 90, 0, 1) * (c.speed < 0 ? -1 : 1);
  c.ang += steerAmt * dt * (handbrake ? 1.5 : 1);
  const fx = Math.sin(c.ang), fy = -Math.cos(c.ang);
  const grip = handbrake ? 2.2 : 7;
  c.vx += (fx * c.speed - c.vx) * Math.min(1, grip * dt);
  c.vy += (fy * c.speed - c.vy) * Math.min(1, grip * dt);
  const ox = c.x, oy = c.y;
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.x = clamp(c.x, 16, WORLD_W - 16); c.y = clamp(c.y, 16, WORLD_H - 16);
  // building collision: test corners
  for (const [px, py] of carCorners(c)) {
    if (pointInBuilding(px, py, 1)) {
      const impact = Math.abs(c.speed);
      c.x = ox; c.y = oy;
      c.speed = -c.speed * 0.25; c.vx *= -0.2; c.vy *= -0.2;
      return impact;
    }
  }
  return 0;
}
export function damageCar(c, amt) {
  c.hp -= amt; c.lastHitT = performance.now();
  if (c.hp <= 0 && !c.wrecked) { c.wrecked = true; c.hp = 0; }
}
export function drawCar(ctx, c, t) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h);
  const body = c.wrecked ? '#3a3a3a' : c.color;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 6); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-c.w / 2 + 2, -c.h / 2 + 6, c.w - 4, 8); // hood shade
  // windshield + cabin
  ctx.fillStyle = '#bfe8f5'; ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 12, c.w - 6, 9);
  ctx.fillStyle = c.kind === 'police' ? '#222' : shade(body, -30); ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 21, c.w - 6, 12);
  ctx.fillStyle = '#9fd4e8'; ctx.fillRect(-c.w / 2 + 3, c.h / 2 - 11, c.w - 6, 6);
  // wheels
  ctx.fillStyle = '#141414';
  for (const [wx, wy] of [[-c.w / 2 - 1, -c.h / 2 + 7], [c.w / 2 - 2, -c.h / 2 + 7], [-c.w / 2 - 1, c.h / 2 - 13], [c.w / 2 - 2, c.h / 2 - 13]]) ctx.fillRect(wx, wy, 4, 8);
  if (c.kind === 'police') {
    ctx.fillStyle = '#fff'; ctx.fillRect(-c.w / 2 + 2, -4, c.w - 4, 10);
    ctx.fillStyle = '#14457e'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('POLICE', 0, 4);
    const on = Math.floor(t * 3) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#444'; ctx.fillRect(-7, -2, 6, 4);
    ctx.fillStyle = on ? '#444' : '#2d7dff'; ctx.fillRect(1, -2, 6, 4);
  }
  if (c.hp < 60 && !c.wrecked) { // damage dents
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-c.w / 2 + 2, -c.h / 2 + 2, 6, 5); ctx.fillRect(c.w / 2 - 8, c.h / 2 - 8, 6, 5);
  }
  ctx.restore();
  // smoke / fire particles drawn in world space by main via c.smoke
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
export function speedKmh(c) { return Math.round(Math.abs(c.speed) * 0.55); }
