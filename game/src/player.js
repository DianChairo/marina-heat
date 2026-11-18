// On-foot player: movement, aiming, health, car entry.
import { clamp } from './rng.js';
import { collideBuildings, isWater, WORLD_W, WORLD_H } from './city.js';
import { keys } from './input.js';

export function makePlayer(x, y) {
  return { x, y, vx: 0, vy: 0, ang: 0, r: 9, hp: 100, car: null, lastHurtT: -9999, walkT: 0, dead: false, carrying: false };
}
export function updatePlayer(p, dt, aimX, aimY) {
  if (p.car || p.dead) return;
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const len = Math.hypot(mx, my) || 1;
  const spd = sprint ? 235 : 150;
  p.vx = (mx / len) * spd * (mx || my ? 1 : 0);
  p.vy = (my / len) * spd * (mx || my ? 1 : 0);
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (mx || my) p.walkT += dt * (sprint ? 13 : 9);
  p.x = clamp(p.x, 10, WORLD_W - 10); p.y = clamp(p.y, 10, WORLD_H - 10);
  if (isWater(p.x, p.y)) { p.x -= p.vx * dt * 2; p.y -= p.vy * dt * 2; }
  const hit = collideBuildings(p.x, p.y, p.r);
  if (hit) { p.x = hit.x; p.y = hit.y; }
  p.ang = Math.atan2(aimY - p.y, aimX - p.x);
  // slow regen when not recently hurt
  if (performance.now() - p.lastHurtT > 5000 && p.hp > 0) p.hp = Math.min(100, p.hp + 4 * dt);
}
export function hurtPlayer(p, amt) {
  if (p.dead) return;
  p.hp -= amt; p.lastHurtT = performance.now();
  if (p.hp <= 0) { p.hp = 0; p.dead = true; }
}
export function drawPlayer(ctx, p, t) {
  const bob = Math.sin(p.walkT) * 1.6;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, 7); ctx.fill();
  ctx.rotate(p.ang + Math.PI / 2);
  // legs
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-6, 2 + bob, 5, 8); ctx.fillRect(1, 2 - bob, 5, 8);
  // torso (teal shirt)
  ctx.fillStyle = '#ff7f50'; ctx.beginPath(); ctx.roundRect(-8, -6, 16, 13, 5); ctx.fill();
  // arms + gun toward aim
  ctx.fillStyle = '#e8b08a';
  ctx.fillRect(4, -13, 4, 10); ctx.fillRect(-8, -13, 4, 7);
  ctx.fillStyle = '#222'; ctx.fillRect(5, -19, 3, 8); // pistol
  // head
  ctx.fillStyle = '#e8b08a'; ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(0, -4, 5.5, Math.PI, 0); ctx.fill(); // cap
  ctx.restore();
  if (p.carrying) { // package on back
    ctx.fillStyle = '#c9a227'; ctx.fillRect(p.x - 6, p.y - 16, 12, 9);
    ctx.strokeStyle = '#7a5f10'; ctx.strokeRect(p.x - 6, p.y - 16, 12, 9);
  }
}
