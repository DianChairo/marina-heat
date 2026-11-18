// combat.js — hitscan gunfire and the particle layer (tracers, sparks, smoke,
// skid marks, floating cash/chaos popups). Shooting is loud: it scares peds and,
// when witnessed, it is a crime.
import { dist } from './rng.js';
import { buildings } from './city.js';
import { damageCar } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

export function spawnSparks(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 40 + Math.random() * 130;
    G.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.32, max: 0.32, size: 2 });
  }
}
export function spawnPopup(G, x, y, text, color) {
  G.fx.push({ type: 'popup', x, y, vx: 0, vy: -44, life: 1.15, max: 1.15, text, color: color || '#ffe082', size: 13 });
}
export function spawnSkid(G, car) {
  const bx = car.x - Math.cos(car.angle) * 12, by = car.y - Math.sin(car.angle) * 12;
  const px = -Math.sin(car.angle), py = Math.cos(car.angle);
  G.fx.push({ type: 'skid', x: bx + px * 8, y: by + py * 8, vx: 0, vy: 0, life: 2.6, max: 2.6, size: 3.4 });
  G.fx.push({ type: 'skid', x: bx - px * 8, y: by - py * 8, vx: 0, vy: 0, life: 2.6, max: 2.6, size: 3.4 });
  if (Math.random() < 0.3) G.fx.push({ type: 'smoke', x: car.x, y: car.y, vx: 0, vy: -18, life: 0.7, max: 0.7, size: 6 });
}

function rayHit(G, ox, oy, angle) {
  const range = 540, step = 9;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = null, bestD = range;
  for (const car of G.cars) {
    // Project the car center onto the ray; close enough + in front = candidate.
    const rx = car.x - ox, ry = car.y - oy;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(-rx * dy + ry * dx);
    if (perp < car.r + 3) { best = { kind: 'car', car, d: along }; bestD = along; }
  }
  for (const p of G.peds) {
    if (p.dead) continue;
    const rx = p.x - ox, ry = p.y - oy;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(-rx * dy + ry * dx);
    if (perp < p.r + 3) { best = { kind: 'ped', ped: p, d: along }; bestD = along; }
  }
  // Buildings stop the ray.
  for (let d = 20; d < bestD; d += step) {
    const x = ox + dx * d, y = oy + dy * d;
    for (const b of buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
        return { kind: 'wall', d, x, y };
      }
    }
  }
  if (best) { best.x = ox + dx * bestD; best.y = oy + dy * bestD; }
  return best;
}

export function tryShoot(G) {
  const P = G.player;
  if (P.inCar || P.dead) return;
  P.muzzleT = 0.055;
  G.audio.shoot();
  G.shake = Math.min(8, G.shake + 1.6);
  const ox = P.x + Math.cos(P.angle) * 18, oy = P.y + Math.sin(P.angle) * 18;
  const hit = rayHit(G, ox, oy, P.angle);
  const endD = hit ? hit.d : 540;
  G.fx.push({ type: 'tracer', x: ox, y: oy, x2: ox + Math.cos(P.angle) * endD, y2: oy + Math.sin(P.angle) * endD, life: 0.06, max: 0.06, size: 2 });
  scarePeds(G, P.x, P.y, 270);
  G.reportCrime(26, P.x, P.y); // shots fired in public
  if (!hit) return;
  if (hit.kind === 'car') {
    damageCar(G, hit.car, 15, hit.x, hit.y);
    G.reportCrime(10, hit.x, hit.y);
    if (hit.car.kind === 'police') G.reportCrime(30, hit.x, hit.y);
    G.addChaos(8, 'shots');
  } else if (hit.kind === 'ped') {
    hit.ped.dead = true; hit.ped.deadT = 0;
    spawnSparks(G, hit.x, hit.y, 6);
    G.reportCrime(65, hit.x, hit.y);
    G.addChaos(30, 'mayhem');
    scarePeds(G, hit.x, hit.y, 300);
  } else {
    spawnSparks(G, hit.x, hit.y, 3);
  }
}

export function updateFx(G, dt) {
  for (const f of G.fx) {
    f.life -= dt;
    if (f.type !== 'tracer' && f.type !== 'skid') { f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.type === 'spark') { f.vx *= 0.9; f.vy *= 0.9; }
    if (f.type === 'smoke') { f.size += 14 * dt; }
  }
  G.fx = G.fx.filter((f) => f.life > 0);
  if (G.fx.length > 700) G.fx.splice(0, G.fx.length - 700);
}
export function drawFx(ctx, G) {
  for (const f of G.fx) {
    const a = Math.max(0, f.life / f.max);
    if (f.type === 'tracer') {
      ctx.strokeStyle = `rgba(255,230,150,${a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
    } else if (f.type === 'skid') {
      ctx.fillStyle = `rgba(20,20,20,${a * 0.4})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, 7); ctx.fill();
    } else if (f.type === 'smoke') {
      ctx.fillStyle = `rgba(90,90,90,${a * 0.35})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, 7); ctx.fill();
    } else if (f.type === 'spark') {
      ctx.fillStyle = `rgba(255,190,80,${a})`;
      ctx.fillRect(f.x - 1.4, f.y - 1.4, 2.8, 2.8);
    } else if (f.type === 'popup') {
      ctx.font = `bold ${f.size}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
  }
}
export { dist };
