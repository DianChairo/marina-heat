// player.js — the on-foot character: movement, aiming, health, drawing.
// When the player is driving, main.js skips this update and the car is the avatar.
import { clamp, dist } from './rng.js';
import { collideWorld } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, r: 11, angle: 0, hp: 100, maxHp: 100,
    hurtT: 0, walkT: 0, dead: false, inCar: null, stepT: 0, muzzleT: 0,
  };
}

export function updatePlayer(G, p, dt) {
  const inp = G.input;
  let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  const sprint = inp.shift ? 1.55 : 1;
  const speed = 148 * sprint;
  p.vx = (mx / len) * speed * (mx || my ? 1 : 0);
  p.vy = (my / len) * speed * (mx || my ? 1 : 0);
  if (mx || my) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.walkT += dt * (inp.shift ? 13 : 9);
    p.stepT -= dt;
    if (p.stepT <= 0) { p.stepT = inp.shift ? 0.24 : 0.34; G.audio.step(); }
  }
  const probe = { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
  collideWorld(probe, p.r);
  p.x = probe.x; p.y = probe.y;
  // Aim at the mouse (screen -> world through the camera).
  const wx = G.cam.x + (G.mouse.x - G.view.w / 2), wy = G.cam.y + (G.mouse.y - G.view.h / 2);
  p.angle = Math.atan2(wy - p.y, wx - p.x);
  p.hurtT -= dt;
  if (p.hurtT <= 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 3.2 * dt); // slow regen when safe
  p.muzzleT = Math.max(0, p.muzzleT - dt);
}

export function hurtPlayer(G, p, dmg, fromX, fromY) {
  if (p.dead || G.mode !== 'playing') return;
  p.hp -= dmg; p.hurtT = 4;
  G.shake = Math.min(12, G.shake + dmg * 0.25);
  if (fromX !== undefined) {
    const a = Math.atan2(p.y - fromY, p.x - fromX);
    p.x += Math.cos(a) * 10; p.y += Math.sin(a) * 10;
  }
  G.spawnSparks(p.x, p.y, 4);
  if (p.hp <= 0) { p.hp = 0; p.dead = true; G.onPlayerDeath(); }
}

export function drawPlayer(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1, 3, 10, 7, 0, 0, 7); ctx.fill();
  const bob = Math.sin(p.walkT) * 1.2;
  ctx.rotate(p.angle);
  // Legs (simple scissor when walking).
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-6, -7 + bob, 7, 4); ctx.fillRect(-6, 3 - bob, 7, 4);
  // Torso: coral shirt, unmistakable against the grey roads.
  ctx.fillStyle = '#ff7847';
  ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd9b0';
  ctx.beginPath(); ctx.arc(2.5, 0, 4.6, 0, 7); ctx.fill(); // head
  ctx.fillStyle = '#263238';
  ctx.beginPath(); ctx.arc(3.4, 0, 4.2, Math.PI * 0.6, Math.PI * 1.4); ctx.fill(); // hair cap
  // Gun arm toward the aim direction.
  ctx.strokeStyle = '#ffd9b0'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(4, 3); ctx.lineTo(13, 2); ctx.stroke();
  ctx.fillStyle = '#22262b'; ctx.fillRect(12, 0.4, 9, 3.2);
  if (p.muzzleT > 0) {
    ctx.fillStyle = 'rgba(255,210,90,0.95)';
    ctx.beginPath(); ctx.arc(25, 2, 4.5 + Math.random() * 2, 0, 7); ctx.fill();
  }
  ctx.restore();
}
export { dist };
