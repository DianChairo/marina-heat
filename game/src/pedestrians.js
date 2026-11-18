// pedestrians.js — sidewalk walkers who flee gunfire and chaos.
// Peds stroll between random sidewalk points; a shot, a crash or a car
// bearing down on them sends them running away from the danger.
import { randomSidewalkPoint } from './city.js';

const SHIRTS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];

export function spawnPedestrians(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomSidewalkPoint(G.city, G.rng);
    const t = randomSidewalkPoint(G.city, G.rng);
    G.peds.push({
      x: p.x, y: p.y, tx: t.x, ty: t.y,
      speed: G.rng.range(35, 70), shirt: G.rng.pick(SHIRTS),
      flee: 0, fx: 0, fy: 0, alive: true, bob: G.rng.range(0, 6),
    });
  }
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.flee = 2.5;
      const a = Math.atan2(p.y - y, p.x - x);
      p.fx = Math.cos(a); p.fy = Math.sin(a);
    }
  }
}

export function updatePedestrians(G, dt) {
  for (const p of G.peds) {
    if (!p.alive) continue;
    p.bob += dt * 8;
    let dx; let dy; let sp;
    if (p.flee > 0) {
      p.flee -= dt;
      dx = p.fx; dy = p.fy; sp = 190;
    } else {
      dx = p.tx - p.x; dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        const t = randomSidewalkPoint(G.city, G.rng);
        p.tx = t.x; p.ty = t.y;
        continue;
      }
      dx /= d; dy /= d; sp = p.speed;
    }
    p.x += dx * sp * dt;
    p.y += dy * sp * dt;
    // A speeding car kills a ped it runs over — that is a crime, obviously.
    for (const car of G.cars) {
      if (car.wrecked || Math.abs(car.speed) < 60) continue;
      if (Math.hypot(p.x - car.x, p.y - car.y) < 24) {
        p.alive = false;
        G.score += 10;
        G.audio.crash();
        if (car.driver === 'player') addWanted(G, 1);
        break;
      }
    }
  }
}

function addWanted(G, n) {
  G.wanted = Math.min(5, G.wanted + n);
  G.heat = 100;
}

export function drawPedestrians(ctx, G) {
  for (const p of G.peds) {
    if (!p.alive) continue;
    const bob = Math.sin(p.bob) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y + bob * 0.3);
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath(); ctx.arc(0, -8, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(0, -9.5, 4.5, Math.PI, 0); ctx.fill();
    ctx.restore();
  }
}
