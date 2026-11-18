// pedestrians.js — sidewalk wanderers who flee gunfire, cars and chaos.
import { clamp, dist } from './rng.js';
import { collideCircle, CELL, ROAD, isWater } from './city.js';
const SHIRTS = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#f78c6b', '#c77dff', '#8ecae6', '#ffb703'];
export function makePed(x, y, rng) {
  return {
    x, y, vx: 0, vy: 0, a: rng.range(0, 6.28), r: 8, hp: 26, dead: false, down: false,
    state: 'wander', tx: x, ty: y, waitT: 0, panic: 0, walkT: rng.range(0, 9),
    shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)], skin: ['#f2c185', '#c68642', '#8d5524', '#ffdbac'][rng.int(0, 3)],
    fleeX: 0, fleeY: 0, screamT: 0,
  };
}
export function spawnPeds(S, rng, n) {
  for (let i = 0; i < n; i++) {
    // sidewalks: just beside a road, anywhere in the city
    const horiz = rng.chance(0.5);
    const k = rng.int(0, 7), along = rng.range(60, 3100);
    const x = horiz ? along : k * CELL + ROAD + 14, y = horiz ? k * CELL + ROAD + 14 : along;
    if (y > 2860) continue;
    S.peds.push(makePed(x, y, rng));
  }
}
export function scarePeds(S, x, y, radius) {
  for (const p of S.peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) { p.state = 'flee'; p.panic = Math.max(p.panic, 2.6); p.fleeX = x; p.fleeY = y; }
  }
}
export function updatePeds(S, dt) {
  const rng = S.rng;
  for (const p of S.peds) {
    if (p.dead) continue;
    if (p.down) { p.downT -= dt; if (p.downT <= 0) p.dead = true; continue; }
    p.panic = Math.max(0, p.panic - dt);
    let tx = 0, ty = 0, sp = 62;
    if (p.state === 'flee' || p.panic > 0) {
      const d = Math.max(1, dist(p.x, p.y, p.fleeX, p.fleeY));
      tx = ((p.x - p.fleeX) / d) * 218; ty = ((p.y - p.fleeY) / d) * 218; sp = 218;
      if (d > 260 && p.panic <= 0) p.state = 'wander';
      p.screamT -= dt;
    } else {
      p.waitT -= dt;
      if (p.waitT <= 0 || dist(p.x, p.y, p.tx, p.ty) < 12) {
        p.waitT = rng.range(1.5, 5);
        // stroll along a sidewalk: pick a target offset along the block edge
        p.tx = clamp(p.x + rng.range(-260, 260), 20, 3160); p.ty = clamp(p.y + rng.range(-260, 260), 20, 2840);
        if (rng.chance(0.3)) { p.waitT = rng.range(0.4, 1.6); p.tx = p.x; p.ty = p.y; } // pause & people-watch
      }
      const d = Math.max(1, dist(p.x, p.y, p.tx, p.ty));
      tx = ((p.tx - p.x) / d) * sp; ty = ((p.ty - p.y) / d) * sp;
      // danger sense: fast car or armed chaos nearby
      const pc = S.player.car;
      if (pc && Math.hypot(pc.vx, pc.vy) > 200 && dist(p.x, p.y, pc.x, pc.y) < 90) { p.state = 'flee'; p.panic = 1.6; p.fleeX = pc.x; p.fleeY = pc.y; }
    }
    p.vx += (tx - p.vx) * Math.min(1, dt * 7); p.vy += (ty - p.vy) * Math.min(1, dt * 7);
    p.x += p.vx * dt; p.y += p.vy * dt;
    const [nx, ny] = collideCircle(S.city, p.x, p.y, p.r); p.x = nx; p.y = ny;
    if (Math.hypot(p.vx, p.vy) > 8) { p.a = Math.atan2(p.vy, p.vx); p.walkT += dt * 10; }
    // run over?
    for (const c of S.cars) {
      const spd = Math.hypot(c.vx, c.vy);
      if (spd > 70 && dist(p.x, p.y, c.x, c.y) < c.r + 4) {
        hurtPed(S, p, spd * 0.16, c.x, c.y);
        if (c === S.player.car || c.kind === 'player') S.onPedHit && S.onPedHit(p, c);
        else S.onCrimeWitnessed && S.onCrimeWitnessed('pedhit', p.x, p.y);
        break;
      }
    }
  }
  // keep population topped up near the player
  const near = S.peds.filter((p) => !p.dead && dist(p.x, p.y, S.player.x, S.player.y) < 900).length;
  if (near < 10 && rng.chance(0.05)) {
    const a = rng.range(0, 6.28), d = rng.range(420, 640);
    const x = clamp(S.player.x + Math.cos(a) * d, 30, 3150), y = clamp(S.player.y + Math.sin(a) * d, 30, 2840);
    if (!isWater(x, y)) S.peds.push(makePed(x, y, rng));
  }
  if (S.peds.length > 46) S.peds = S.peds.filter((p) => p.dead || dist(p.x, p.y, S.player.x, S.player.y) < 1300);
}
export function hurtPed(S, p, dmg, sx, sy) {
  if (p.dead || p.down) return;
  p.hp -= dmg; p.panic = 3; p.state = 'flee'; p.fleeX = sx; p.fleeY = sy;
  for (let i = 0; i < 4; i++) S.parts.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, life: 0.4, max: 0.4, size: 3.5, color: '200,40,40', kind: 'spark' });
  if (p.hp <= 0) { p.down = true; p.downT = 6; p.hp = 0; }
}
export function drawPed(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, 3, 7, 4, 0, 0, 7); ctx.fill();
  if (p.down) { ctx.rotate(1.2); ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(7, 0, 4.5, 0, 7); ctx.fill(); ctx.restore(); return; }
  const bob = Math.sin(p.walkT * 2) * 1.3;
  ctx.rotate(p.a);
  ctx.fillStyle = '#33404f'; ctx.fillRect(-2 + bob * 0.4, -5.5, 4, 5); ctx.fillRect(-2 - bob * 0.4, 0.5, 4, 5);
  ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.arc(0, 0, 6.8, 0, 7); ctx.fill();
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(1, 0, 4.4, 0, 7); ctx.fill();
  if (p.panic > 0.5) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('!', 8, -8); }
  ctx.restore();
}
