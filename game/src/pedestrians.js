// Pedestrians: they stroll the sidewalks, cross at corners, and flee when
// shots are fired nearby. Knocked-down peds stay down and fade out.
import { WORLD, ROAD_STEP, COLORS, dist } from './config.js';
import { makeRng } from './random.js';

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52),
    color: rng.pick(COLORS.ped),
    hp: 1,
    flee: 0,
    walkPhase: rng.range(0, Math.PI * 2),
    target: null,
  };
}

export function spawnPeds(city, seed, count) {
  const rng = makeRng(seed + 202);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const gx = rng.int(0, 7);
    const gy = rng.int(0, 6);
    const x = gx * ROAD_STEP + rng.range(60, ROAD_STEP - 60);
    const y = gy * ROAD_STEP + rng.range(60, ROAD_STEP - 60);
    peds.push(makePed(x, y, rng));
  }
  return peds;
}

export function updatePeds(world, dt) {
  const rng = world.rng;
  for (const ped of world.peds) {
    if (ped.hp <= 0) continue;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - world.player.y, ped.x - world.player.x);
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
      ped.angle = away;
      continue;
    }
    ped.walkPhase += dt * 6;
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
      const gx = Math.round(ped.x / ROAD_STEP);
      const gy = Math.round(ped.y / ROAD_STEP);
      const nx = Math.max(0, Math.min(7, gx + rng.int(-1, 1)));
      const ny = Math.max(0, Math.min(6, gy + rng.int(-1, 1)));
      ped.target = { x: nx * ROAD_STEP + rng.range(50, 350), y: ny * ROAD_STEP + rng.range(50, 350) };
    }
    const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle = a;
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
    ped.x = Math.max(20, Math.min(WORLD - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD - 20, ped.y));
  }
  // Prune the fallen after a while so the crowd refills.
  world.peds = world.peds.filter((ped) => ped.hp > 0 || ped.flee > -6);
  if (world.peds.filter((p) => p.hp > 0).length < 24) {
    const p = makePed(world.player.x + 500, world.player.y + 300, rng);
    p.x = Math.max(60, Math.min(WORLD - 60, p.x));
    p.y = Math.max(60, Math.min(WORLD - 60, p.y));
    world.peds.push(p);
  }
}

export function scarePeds(world, x, y, radius) {
  for (const ped of world.peds) {
    if (ped.hp > 0 && dist(ped.x, ped.y, x, y) < radius) ped.flee = 2.5;
  }
}
