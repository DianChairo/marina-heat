// pedestrians.js — sidewalk wanderers. They stroll between waypoints near the roads,
// and flee in panic from gunfire, crashes, and speeding cars. Getting run over is a crime.
import { clamp, dist, randRange } from './rng.js';
import { collideWorld, GRID_W, GRID_H } from './city.js';

const SHIRTS = ['#f6e58d', '#7ed6df', '#e77f67', '#f8a5c2', '#82ccdd', '#b8e994', '#f5cd79', '#c8d6e5'];
let nextId = 1;
export function makePed(rng, pickFn, x, y) {
  return {
    id: nextId++, x, y, vx: 0, vy: 0, r: 9, angle: rng() * 6.28,
    tx: x, ty: y, speed: 34 + rng() * 26, shirt: pickFn(rng, SHIRTS),
    panicT: 0, fleeX: 0, fleeY: 0, dead: false, deadT: 0, cop: false, walkT: rng() * 9, waitT: 0,
  };
}
export function spawnPeds(G, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    // Sidewalk bands sit just inside the blocks beside each road.
    const gx = 30 + G.rng() * (GRID_W - 60), gy = 30 + G.rng() * (GRID_H - 60);
    peds.push(makePed(G.rng, G.pick, gx, gy));
  }
  return peds;
}
function newTarget(G, p) {
  const a = G.rng() * Math.PI * 2, d = 90 + G.rng() * 260;
  p.tx = clamp(p.x + Math.cos(a) * d, 24, GRID_W - 10);
  p.ty = clamp(p.y + Math.sin(a) * d, 24, GRID_H - 24);
}
export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) { p.panicT = 2.6; p.fleeX = x; p.fleeY = y; }
  }
}
export function updatePeds(G, dt) {
  for (const p of G.peds) {
    if (p.dead) { p.deadT += dt; continue; }
    let gx, gy, spd;
    if (p.panicT > 0) {
      p.panicT -= dt;
      const a = Math.atan2(p.y - p.fleeY, p.x - p.fleeX);
      gx = p.x + Math.cos(a) * 90; gy = p.y + Math.sin(a) * 90; spd = 148;
    } else if (p.waitT > 0 && !p.cop) {
      p.waitT -= dt; gx = p.x; gy = p.y; spd = 0;
    } else {
      if (dist(p.x, p.y, p.tx, p.ty) < 14 && !p.cop) {
        if (G.rng() < 0.3) p.waitT = 1 + G.rng() * 2.4;
        newTarget(G, p);
      }
      gx = p.tx; gy = p.ty; spd = p.speed;
    }
    const dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy) || 1;
    if (spd > 0) {
      p.vx = (dx / d) * spd; p.vy = (dy / d) * spd;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.angle = Math.atan2(p.vy, p.vx);
      p.walkT += dt * (p.panicT > 0 ? 14 : 8);
    }
    const probe = { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
    collideWorld(probe, p.r);
    p.x = probe.x; p.y = probe.y;
    // Cars vs peds: a moving car that touches a ped runs them down.
    for (const car of G.cars) {
      const cs = Math.hypot(car.vx, car.vy);
      if (cs > 26 && dist(p.x, p.y, car.x, car.y) < car.r + p.r - 2) {
        p.dead = true; p.deadT = 0;
        G.onPedHit(p, car);
        break;
      }
      // Near miss at speed while driving = chaos points, once per ped per pass.
      if (car === G.player.inCar && cs > 200 && !p.dead) {
        const dd = dist(p.x, p.y, car.x, car.y);
        if (dd < 46 && dd >= car.r + p.r && !p.nearMissed) { p.nearMissed = true; G.addChaos(25, 'near miss'); }
        if (dd > 90) p.nearMissed = false;
      }
    }
  }
  // Keep the sidewalks populated.
  const alive = G.peds.filter((p) => !p.dead).length;
  if (alive < 15 && Math.random() < dt) {
    const gx = 40 + G.rng() * (GRID_W - 80), gy = 40 + G.rng() * (GRID_H - 80);
    if (dist(gx, gy, G.player.x, G.player.y) > 260) G.peds.push(makePed(G.rng, G.pick, gx, gy));
  }
}
export function drawPed(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.dead) {
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(120,20,20,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = p.shirt; ctx.fillRect(-9, -3, 15, 6);
    ctx.fillStyle = '#ffd9b0'; ctx.beginPath(); ctx.arc(9, 0, 4, 0, 7); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(1, 3, 8, 5.5, 0, 0, 7); ctx.fill();
  ctx.rotate(p.angle);
  const bob = Math.sin(p.walkT) * 1.6;
  ctx.fillStyle = '#34495e'; ctx.fillRect(-5, -6 + bob, 6, 3.6); ctx.fillRect(-5, 2.4 - bob, 6, 3.6);
  ctx.fillStyle = p.cop ? '#274b8f' : p.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd9b0'; ctx.beginPath(); ctx.arc(2, 0, 3.8, 0, 7); ctx.fill();
  if (p.cop) { ctx.fillStyle = '#16294d'; ctx.fillRect(0, -4, 5, 8); }
  if (p.panicT > 0) {
    ctx.rotate(-p.angle);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', 0, -13);
  }
  ctx.restore();
}
export { randRange };
