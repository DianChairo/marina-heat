// combat.js — mouse-aim hitscan shooting: a tracer, a bang, and the
// nearest thing on the line takes the hit. Shooting in public is a crime.
import { addHeat } from './police.js';
import { damageCar, spawnSparks } from './vehicles.js';
import { damagePlayer, pushMessage } from './player.js';
import { dropCash, scarePeds } from './pedestrians.js';

const RANGE = 520;

export function tryShoot(G) {
  const p = G.player;
  if (!p.onFoot || p.shootCooldown > 0 || G.state !== 'playing') return;
  p.shootCooldown = 0.22;
  G.audio.shot();
  const ox = p.x;
  const oy = p.y;
  const dx = Math.cos(p.angle);
  const dy = Math.sin(p.angle);
  // Find the closest hit along the ray: peds, cars, cops, buildings.
  let bestT = RANGE;
  let hit = null;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const t = rayCircle(ox, oy, dx, dy, ped.x, ped.y, 12);
    if (t !== null && t < bestT) {
      bestT = t;
      hit = { type: 'ped', target: ped };
    }
  }
  for (const car of G.cars) {
    const t = rayCircle(ox, oy, dx, dy, car.x, car.y, 20);
    if (t !== null && t < bestT) {
      bestT = t;
      hit = { type: 'car', target: car };
    }
  }
  for (const cop of G.cops) {
    const t = rayCircle(ox, oy, dx, dy, cop.x, cop.y, 12);
    if (t !== null && t < bestT) {
      bestT = t;
      hit = { type: 'cop', target: cop };
    }
  }
  // Buildings stop bullets.
  for (const b of G.city.buildings) {
    const t = rayRect(ox, oy, dx, dy, b);
    if (t !== null && t < bestT) {
      bestT = t;
      hit = null;
    }
  }
  const ex = ox + dx * bestT;
  const ey = oy + dy * bestT;
  G.tracers.push({ x1: ox, y1: oy, x2: ex, y2: ey, t: 0 });
  spawnSparks(G, ex, ey);
  scarePeds(G, ox, oy, 320);
  if (hit) {
    if (hit.type === 'ped') {
      hit.target.dead = true;
      G.stats.kills++;
      addHeat(G, 10);
      dropCash(G, hit.target.x, hit.target.y, G.rng.int(5, 30));
      if (G.mission.active && G.mission.id === 2) G.mission.score += 100;
    } else if (hit.type === 'car') {
      damageCar(G, hit.target, 34);
      addHeat(G, 6);
      if (hit.target.kind === 'police') addHeat(G, 8);
      if (G.mission.active && G.mission.id === 2) G.mission.score += 50;
    } else if (hit.type === 'cop') {
      hit.target.dead = true;
      G.cops = G.cops.filter((c) => c !== hit.target);
      G.stats.kills++;
      addHeat(G, 16);
      if (G.mission.active && G.mission.id === 2) G.mission.score += 150;
    }
  } else if (bestT < RANGE) {
    // Bullet hit a wall: no crime, just a spark.
  } else {
    // Firing into the air still draws attention.
    addHeat(G, 2);
  }
  if (G.wanted === 0) pushMessage(G, 'You', 'That was loud. Keep moving.');
}

function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const t = lx * dx + ly * dy;
  if (t < 0) return null;
  const d2 = lx * lx + ly * ly - t * t;
  if (d2 > r * r) return null;
  return t - Math.sqrt(r * r - d2);
}

function rayRect(ox, oy, dx, dy, b) {
  // Slab method; returns entry distance or null.
  let tmin = 0;
  let tmax = RANGE;
  for (const [o, d, lo, hi] of [[ox, dx, b.x, b.x + b.w], [oy, dy, b.y, b.y + b.h]]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export function updateCombat(G, dt) {
  for (const tr of G.tracers) tr.t += dt;
  G.tracers = G.tracers.filter((tr) => tr.t < 0.12);
  if (G.input.mouse.down) tryShoot(G);
}

export function drawCombat(ctx, G) {
  for (const tr of G.tracers) {
    const a = 1 - tr.t / 0.12;
    ctx.strokeStyle = `rgba(255,240,150,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tr.x1, tr.y1);
    ctx.lineTo(tr.x2, tr.y2);
    ctx.stroke();
  }
  // Crosshair at the mouse in world space.
  if (G.state === 'playing' && G.player.onFoot) {
    const wx = G.camera.x + G.input.mouse.x;
    const wy = G.camera.y + G.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wx, wy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx - 13, wy);
    ctx.lineTo(wx - 5, wy);
    ctx.moveTo(wx + 5, wy);
    ctx.lineTo(wx + 13, wy);
    ctx.moveTo(wx, wy - 13);
    ctx.lineTo(wx, wy - 5);
    ctx.moveTo(wx, wy + 5);
    ctx.lineTo(wx, wy + 13);
    ctx.stroke();
  }
}
