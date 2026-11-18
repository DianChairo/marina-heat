// combat.js — hitscan shooting: tracers, muzzle flash, damage to cars & peds, particles.
import { dist } from './rng.js';
import { damageCar } from './vehicles.js';
import { hurtPed, scarePeds } from './pedestrians.js';
import { addCrime, witnessNear } from './police.js';
export function tryShoot(S) {
  const p = S.player;
  if (p.car || S.shootCd > 0) return;
  S.shootCd = 0.16;
  S.audio.shot();
  const a = p.a, range = 460;
  const ox = p.x + Math.cos(a) * 16, oy = p.y + Math.sin(a) * 16;
  S.muzzle = 0.06;
  scarePeds(S, p.x, p.y, 300);
  // nearest target along the ray
  let bestT = range, hitCar = null, hitPed = null;
  const test = (x, y, r) => {
    const dx = x - ox, dy = y - oy;
    const t = dx * Math.cos(a) + dy * Math.sin(a);
    if (t < 0 || t > range) return;
    const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (perp < r && t < bestT) { bestT = t; return true; }
    return false;
  };
  for (const c of S.cars) { if (test(c.x, c.y, 24)) { hitCar = c; hitPed = null; } }
  for (const pd of S.peds) { if (!pd.dead && test(pd.x, pd.y, 11)) { hitPed = pd; hitCar = null; } }
  const ex = ox + Math.cos(a) * bestT, ey = oy + Math.sin(a) * bestT;
  S.parts.push({ x: ox, y: oy, vx: Math.cos(a) * 0, vy: Math.sin(a) * 0, life: 0.07, max: 0.07, size: 2.5, color: '255,230,150', kind: 'tracer', x2: ex, y2: ey });
  for (let i = 0; i < 3; i++) S.parts.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, life: 0.25, max: 0.25, size: 3, color: '255,190,80', kind: 'spark' });
  if (hitCar) {
    damageCar(S, hitCar, 16, false);
    if (witnessNear(S, hitCar.x, hitCar.y)) addCrime(S, hitCar.kind === 'cop' ? 55 : 30, hitCar.x, hitCar.y);
    if (hitCar.kind === 'cop') S.heat = Math.min(100, S.heat + 20);
  } else if (hitPed) {
    hurtPed(S, hitPed, 20, p.x, p.y);
    if (witnessNear(S, hitPed.x, hitPed.y)) addCrime(S, 48, hitPed.x, hitPed.y);
  } else if (witnessNear(S, p.x, p.y, 260)) {
    addCrime(S, 16, p.x, p.y); // shots fired in public
  }
  S.stats.shots++;
}
export function updateParticles(S, dt) {
  for (const pt of S.parts) { pt.life -= dt; pt.x += (pt.vx || 0) * dt; pt.y += (pt.vy || 0) * dt; if (pt.kind === 'smoke') { pt.size += dt * 7; pt.vy -= 12 * dt; } }
  S.parts = S.parts.filter((pt) => pt.life > 0);
  S.muzzle = Math.max(0, S.muzzle - dt);
  S.shootCd = Math.max(0, S.shootCd - dt);
}
export function drawParticles(ctx, S) {
  for (const pt of S.parts) {
    const al = Math.max(0, pt.life / pt.max);
    if (pt.kind === 'tracer') {
      ctx.strokeStyle = `rgba(255,230,150,${al})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x2, pt.y2); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(${pt.color},${al * (pt.kind === 'smoke' ? 0.4 : 0.95)})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, 7); ctx.fill();
    }
  }
  const p = S.player;
  if (S.muzzle > 0 && !p.car) {
    const mx = p.x + Math.cos(p.a) * 20, my = p.y + Math.sin(p.a) * 20;
    ctx.fillStyle = 'rgba(255,200,60,0.9)'; ctx.beginPath(); ctx.arc(mx, my, 7, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,220,0.95)'; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill();
  }
}
export { dist };
