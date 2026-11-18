// Pedestrians: wander sidewalks, flee danger, panic. Hitting one is a crime.
import { clamp } from './rng.js';
import { collideBuildings, isRoad, WORLD_W, WORLD_H } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#e91e63', '#00bcd4', '#ff9800', '#9c27b0', '#ffffff'];
export function makePed(x, y, rng) {
  return { x, y, vx: 0, vy: 0, ang: rng.range(0, 6.28), state: 'walk', timer: rng.range(1, 4), panic: 0, hp: 30, dead: false, shirt: rng.pick(SHIRTS), walkT: rng.range(0, 6), speed: rng.range(40, 70) };
}
export function spawnPed(rng, nearX, nearY) {
  for (let tries = 0; tries < 12; tries++) {
    const x = clamp(nearX + rng.range(-700, 700), 30, WORLD_W - 30);
    const y = clamp(nearY + rng.range(-500, 500), 30, WORLD_H - 30);
    if (!isRoad(x, y) && !collideBuildings(x, y, 4) && Math.hypot(x - nearX, y - nearY) > 130) return makePed(x, y, rng);
  }
  return null;
}
export function updatePed(p, dt, danger, rng) {
  if (p.dead) return;
  p.timer -= dt;
  let spd = p.speed, tx = null, ty = null;
  if (danger && Math.hypot(danger.x - p.x, danger.y - p.y) < danger.r) { p.state = 'flee'; p.panic = 2.5; }
  if (p.panic > 0) { p.panic -= dt; p.state = 'flee'; } else if (p.state === 'flee') p.state = 'walk';
  if (p.state === 'flee' && danger) {
    const a = Math.atan2(p.y - danger.y, p.x - danger.x) + rng.range(-0.3, 0.3);
    tx = p.x + Math.cos(a) * 100; ty = p.y + Math.sin(a) * 100; spd = 165;
  } else {
    if (p.timer <= 0) { p.timer = rng.range(1.5, 4); p.ang = rng.range(0, Math.PI * 2); }
    tx = p.x + Math.cos(p.ang) * 60; ty = p.y + Math.sin(p.ang) * 60;
  }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
  p.vx = (dx / d) * spd; p.vy = (dy / d) * spd;
  p.x += p.vx * dt; p.y += p.vy * dt; p.walkT += dt * spd * 0.09;
  p.x = clamp(p.x, 12, WORLD_W - 12); p.y = clamp(p.y, 12, WORLD_H - 12);
  const hit = collideBuildings(p.x, p.y, 7);
  if (hit) { p.x = hit.x; p.y = hit.y; p.ang += 2.2; p.timer = 0.5; }
  if (isRoad(p.x, p.y) && p.state === 'walk') { p.ang += 1.8 * dt; } // drift off roads
}
export function drawPed(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 4, 7, 3, 0, 0, 7); ctx.fill();
  if (p.dead) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#7a2020'; ctx.fillRect(-8, -4, 16, 8); ctx.restore(); return; }
  const bob = Math.sin(p.walkT) * 1.4;
  const a = Math.atan2(p.vy, p.vx);
  ctx.rotate(a + Math.PI / 2);
  ctx.fillStyle = '#34495e'; ctx.fillRect(-5, 2 + bob, 4, 7); ctx.fillRect(1, 2 - bob, 4, 7);
  ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.roundRect(-6.5, -5, 13, 11, 4); ctx.fill();
  ctx.fillStyle = '#e8b08a'; ctx.beginPath(); ctx.arc(0, -1, 4.5, 0, 7); ctx.fill();
  if (p.panic > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -12); }
  ctx.restore();
}
