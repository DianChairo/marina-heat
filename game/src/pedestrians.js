// pedestrians.js — Coral Marina citizens strolling the sidewalks.
// They wander block to block, panic and flee when violence erupts
// nearby, and drop when shot or run over (which the police notice).

import { BLOCK, ROAD_W, WATER_X, WATER_Y, hitsBuilding } from './city.js';
import { Rng, clamp, dist } from './rng.js';

const SHIRTS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#5f27cd', '#c8d6e5', '#ff9ff3'];
const PANTS = ['#2f3542', '#57606f', '#3b3b98', '#82589F', '#1e3799', '#6a5a44'];

export function spawnPedestrians(seed, count) {
  const rng = new Rng(seed * 131 + 29);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = rng.range(80, WATER_X - 80);
    const y = rng.range(80, WATER_Y - 80);
    peds.push({
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52),
      shirt: rng.pick(SHIRTS),
      pants: rng.pick(PANTS),
      skin: rng.pick(['#f2c79b', '#c68863', '#8d5524', '#ffdbac']),
      state: 'walk', // 'walk' | 'flee' | 'down'
      targetX: x,
      targetY: y,
      retarget: rng.range(0, 3),
      panic: 0,
      downTime: 0,
      phase: rng.range(0, Math.PI * 2),
    });
  }
  return peds;
}

// A sidewalk-ish waypoint: near a street but not on the asphalt.
function pickWaypoint(world, ped) {
  const rng = world.rng;
  for (let tries = 0; tries < 8; tries++) {
    const gx = Math.floor(rng.range(0, WORLD_BLOCKS));
    const gy = Math.floor(rng.range(0, WORLD_BLOCKS));
    const edge = ROAD_W / 2 + 16;
    const x = gx * BLOCK + (rng.chance(0.5) ? edge : BLOCK - edge) + rng.range(-6, 6);
    const y = gy * BLOCK + rng.range(20, BLOCK - 20);
    const px = rng.chance(0.5) ? x : y;
    const py = rng.chance(0.5) ? y : x;
    if (px < WATER_X - 30 && py < WATER_Y - 30 && !hitsBuilding(world.city, px, py, 8)) {
      ped.targetX = px;
      ped.targetY = py;
      return;
    }
  }
  ped.targetX = ped.x + rng.range(-120, 120);
  ped.targetY = ped.y + rng.range(-120, 120);
}

const WORLD_BLOCKS = 11;

export function updatePedestrians(world, dt) {
  const { player } = world;
  for (const ped of world.pedestrians) {
    if (ped.state === 'down') {
      ped.downTime += dt;
      continue;
    }
    ped.phase += dt * 8;

    // Panic: gunfire or a speeding car nearby.
    const threatNear =
      world.combat.lastShotAt > 0 &&
      world.time - world.combat.lastShotAt < 1.2 &&
      dist(ped.x, ped.y, player.x, player.y) < 260;
    if (threatNear) ped.panic = 2.5;
    ped.panic = Math.max(0, ped.panic - dt);

    let tx;
    let ty;
    let speed = ped.speed;
    if (ped.panic > 0) {
      // Flee directly away from the player.
      const a = Math.atan2(ped.y - player.y, ped.x - player.x);
      tx = ped.x + Math.cos(a) * 100;
      ty = ped.y + Math.sin(a) * 100;
      speed = 120;
    } else {
      ped.retarget -= dt;
      if (ped.retarget <= 0 || dist(ped.x, ped.y, ped.targetX, ped.targetY) < 12) {
        pickWaypoint(world, ped);
        ped.retarget = world.rng.range(4, 9);
      }
      tx = ped.targetX;
      ty = ped.targetY;
    }

    const a = Math.atan2(ty - ped.y, tx - ped.x);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * speed * dt;
    const ny = ped.y + Math.sin(a) * speed * dt;
    if (!hitsBuilding(world.city, nx, ny, 7)) {
      ped.x = clamp(nx, 12, WATER_X - 8);
      ped.y = clamp(ny, 12, WATER_Y - 8);
    } else {
      ped.retarget = 0;
    }
  }
  // Remove the long-down so the streets refill over time.
  world.pedestrians = world.pedestrians.filter((p) => p.state !== 'down' || p.downTime < 25);
}

export function drawPedestrian(ctx, ped, cam) {
  const sx = ped.x - cam.x;
  const sy = ped.y - cam.y;
  if (sx < -20 || sy < -20 || sx > cam.w + 20 || sy > cam.h + 20) return;
  ctx.save();
  ctx.translate(sx, sy);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.pants;
    ctx.fillRect(-9, -3, 18, 6);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-4, -4, 9, 8);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(8, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.phase) * 1.6;
  // Legs.
  ctx.strokeStyle = ped.pants;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(Math.cos(ped.angle + 2.6) * 5, Math.sin(ped.angle + 2.6) * 5 + bob * 0.2 + 3);
  ctx.moveTo(0, 2);
  ctx.lineTo(Math.cos(ped.angle - 2.6) * 5, Math.sin(ped.angle - 2.6) * 5 - bob * 0.2 + 3);
  ctx.stroke();
  // Body.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 2, Math.sin(ped.angle) * 2, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  void clamp;
}
