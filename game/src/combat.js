// Hitscan shooting: tracers, muzzle flash, damage to cars and peds.
import { damageCar } from './vehicles.js';
import { sfx } from './audio.js';

export function makeCombat() { return { tracers: [], particles: [], fireT: 0, muzzle: 0 }; }
export function spawnParticles(C, x, y, n, color, spd = 120) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = Math.random() * spd;
    C.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, color, r: 2 + Math.random() * 2.5 });
  }
}
// Fire from (x,y) toward angle ang. Returns what was hit: {kind:'car'|'ped'|'none', obj}
export function shoot(C, x, y, ang, cars, peds, onCrime) {
  sfx('shot');
  C.muzzle = 0.06;
  const range = 460;
  let best = range, hitObj = null, hitKind = 'none';
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (const c of cars) {
    const rx = c.x - x, ry = c.y - y, t = rx * dx + ry * dy;
    if (t < 0 || t > best) continue;
    const px = x + dx * t, py = y + dy * t;
    if (Math.hypot(c.x - px, c.y - py) < 26) { best = t; hitObj = c; hitKind = 'car'; }
  }
  for (const p of peds) {
    if (p.dead) continue;
    const rx = p.x - x, ry = p.y - y, t = rx * dx + ry * dy;
    if (t < 0 || t > best) continue;
    const px = x + dx * t, py = y + dy * t;
    if (Math.hypot(p.x - px, p.y - py) < 11) { best = t; hitObj = p; hitKind = 'ped'; }
  }
  const ex = x + dx * best, ey = y + dy * best;
  C.tracers.push({ x1: x + dx * 18, y1: y + dy * 18, x2: ex, y2: ey, life: 0.07 });
  if (hitKind === 'car') { damageCar(hitObj, 16); spawnParticles(C, ex, ey, 6, '#ffd76a', 160); if (hitObj.wrecked) onCrime('wreck', ex, ey); }
  if (hitKind === 'ped') { hitObj.hp -= 34; spawnParticles(C, ex, ey, 7, '#c0392b', 110); if (hitObj.hp <= 0) { hitObj.dead = true; onCrime('pedHit', ex, ey); } }
  onCrime('shot', x, y);
  return { kind: hitKind, obj: hitObj };
}
export function updateCombat(C, dt) {
  C.fireT -= dt; C.muzzle -= dt;
  for (let i = C.tracers.length - 1; i >= 0; i--) { C.tracers[i].life -= dt; if (C.tracers[i].life <= 0) C.tracers.splice(i, 1); }
  for (let i = C.particles.length - 1; i >= 0; i--) {
    const p = C.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
    if (p.life <= 0) C.particles.splice(i, 1);
  }
}
export function drawCombat(ctx, C) {
  for (const t of C.tracers) {
    ctx.strokeStyle = 'rgba(255,230,130,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const p of C.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
  }
  ctx.globalAlpha = 1;
}
