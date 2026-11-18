// combat.js — mouse-aim hitscan shooting.
// Click fires toward the cursor: a tracer, a bang, damage to the first
// ped or car in the line of fire. Shooting in public raises the heat.
import { scarePeds } from './pedestrians.js';
import { damageCar } from './vehicles.js';
import { addWanted } from './police.js';

export function fireShot(G) {
  const p = G.player;
  if (G.mode !== 'play' || !p.onFoot) return;
  const wx = G.camera.x + G.input.mouse.x;
  const wy = G.camera.y + G.input.mouse.y;
  const a = Math.atan2(wy - p.y, wx - p.x);
  p.angle = a;
  G.audio.shot();
  const range = 520;
  const ex = p.x + Math.cos(a) * range;
  const ey = p.y + Math.sin(a) * range;
  G.tracers.push({ x1: p.x, y1: p.y, x2: ex, y2: ey, life: 0.09, max: 0.09 });
  scarePeds(G, p.x, p.y, 420);
  addWanted(G, 0); // firing alone is suspicious — heat below
  G.heat = Math.min(100, G.heat + 12);
  if (G.wanted === 0 && G.heat > 40) G.wanted = 1;

  // Hit the first ped inside a narrow cone along the shot.
  let bestD = range; let hitPed = null;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    const dx = ped.x - p.x; const dy = ped.y - p.y;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    const side = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (along > 0 && along < bestD && side < 18) { bestD = along; hitPed = ped; }
  }
  if (hitPed) {
    hitPed.alive = false;
    G.score += 25;
    G.particles.push({ x: hitPed.x, y: hitPed.y, r: 12, life: 0.4, max: 0.4, color: '#ef4444' });
    addWanted(G, 1);
    return;
  }
  // Otherwise the first car in the cone takes the bullet.
  let bestCar = null; bestD = range;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const dx = car.x - p.x; const dy = car.y - p.y;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    const side = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (along > 0 && along < bestD && side < 26) { bestD = along; bestCar = car; }
  }
  if (bestCar) {
    damageCar(G, bestCar, 22);
    G.score += 15;
    G.particles.push({ x: bestCar.x, y: bestCar.y, r: 10, life: 0.3, max: 0.3, color: '#fbbf24' });
    addWanted(G, 1);
  }
}

export function updateTracers(G, dt) {
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter((t) => t.life > 0);
  for (const pt of G.particles) pt.life -= dt;
  G.particles = G.particles.filter((pt) => pt.life > 0);
}

export function drawTracers(ctx, G) {
  for (const t of G.tracers) {
    ctx.save();
    ctx.globalAlpha = t.life / t.max;
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    ctx.restore();
  }
  for (const pt of G.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * (pt.life / pt.max), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
