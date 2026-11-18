// Traffic AI: cars follow lanes, turn at intersections, brake for obstacles, honk.
import { makeCar, stepCar, CAR_COLORS } from './vehicles.js';
import { roadXs, roadYs, WORLD_W, WORLD_H } from './city.js';
import { clamp, angDiff } from './rng.js';
import { sfx } from './audio.js';

export function spawnTrafficCar(rng, nearX, nearY) {
  // pick a road lane away from player view but in world
  const vertical = rng.chance(0.5);
  const rx = rng.pick(roadXs), ry = rng.pick(roadYs);
  let x, y, ang, dir;
  if (vertical) { dir = rng.chance(0.5) ? 1 : -1; x = rx + (dir > 0 ? 16 : -16); y = rng.range(60, WORLD_H - 60); ang = dir > 0 ? Math.PI : 0; }
  else { dir = rng.chance(0.5) ? 1 : -1; y = ry + (dir > 0 ? -16 : 16); x = rng.range(60, WORLD_W - 60); ang = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  if (Math.hypot(x - nearX, y - nearY) < 220) return null;
  const c = makeCar(x, y, ang, rng.pick(CAR_COLORS), 'traffic');
  c.ai = { dir, vertical, targetSpeed: rng.range(110, 170), turnCooldown: 0, stuck: 0 };
  c.driver = { ai: true };
  return c;
}
// Lane center for a car travelling in its direction.
function laneTarget(c) {
  const a = c.ai;
  if (a.vertical) {
    let best = roadXs[0], bd = 1e9;
    for (const rx of roadXs) { const d = Math.abs(rx + (a.dir > 0 ? 16 : -16) - c.x); if (d < bd) { bd = d; best = rx + (a.dir > 0 ? 16 : -16); } }
    return { axis: 'y', lane: best, dir: a.dir };
  }
  let best = roadYs[0], bd = 1e9;
  for (const ry of roadYs) { const d = Math.abs(ry + (a.dir > 0 ? -16 : 16) - c.y); if (d < bd) { bd = d; best = ry + (a.dir > 0 ? -16 : 16); } }
  return { axis: 'x', lane: best, dir: a.dir };
}
export function updateTrafficCar(c, dt, allCars, playerPos, rng, onCrime) {
  const a = c.ai;
  if (!a || c.wrecked) return;
  a.turnCooldown -= dt;
  const lt = laneTarget(c);
  // desired heading along lane
  let wantAng = lt.axis === 'y' ? (a.dir > 0 ? Math.PI : 0) : (a.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  // near an intersection, maybe turn
  const nearIx = roadXs.some((rx) => Math.abs(rx - c.x) < 30) && roadYs.some((ry) => Math.abs(ry - c.y) < 30);
  if (nearIx && a.turnCooldown <= 0 && rng.chance(0.3)) {
    a.vertical = !a.vertical;
    a.dir = rng.chance(0.5) ? 1 : -1;
    a.turnCooldown = 2.5;
    wantAng = a.vertical ? (a.dir > 0 ? Math.PI : 0) : (a.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  // obstacle ahead?
  const fx = Math.sin(c.ang), fy = -Math.cos(c.ang);
  let blocked = false;
  for (const o of allCars) {
    if (o === c) continue;
    const dx = o.x - c.x, dy = o.y - c.y, ahead = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx);
    if (ahead > 0 && ahead < 62 && side < 20) { blocked = true; break; }
  }
  if (!blocked && playerPos) {
    const dx = playerPos.x - c.x, dy = playerPos.y - c.y, ahead = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx);
    if (ahead > 0 && ahead < 55 && side < 18) blocked = true;
  }
  if (blocked && c.honkT <= 0 && Math.abs(c.speed) > 20) { sfx('honk'); c.honkT = 3; }
  c.honkT -= dt;
  const target = blocked ? 0 : a.targetSpeed;
  const throttle = c.speed < target - 6 ? 0.7 : c.speed > target + 6 ? -0.5 : 0;
  // steering: align to lane + heading
  let steer = clamp(angDiff(wantAng, c.ang) * 1.6, -1, 1);
  if (lt.axis === 'y') steer += clamp((lt.lane - c.x) * 0.01, -0.4, 0.4) * (a.dir > 0 ? 1 : -1);
  else steer += clamp((lt.lane - c.y) * 0.01, -0.4, 0.4) * (a.dir > 0 ? -1 : 1);
  const impact = stepCar(c, dt, throttle, clamp(steer, -1, 1), false);
  if (impact > 90) { c.hp -= impact * 0.12; if (onCrime && c.driver) onCrime('crash', c.x, c.y, 0.4); }
  // keep speed sign consistent with facing for stepCar (it uses signed speed along heading)
  if (throttle >= 0 && c.speed < 0) c.speed = 0;
}
export function maintainTraffic(cars, rng, playerPos, count) {
  let n = cars.filter((c) => c.kind === 'traffic' && !c.wrecked).length;
  for (let i = 0; n < count && i < 8; i++) { const c = spawnTrafficCar(rng, playerPos.x, playerPos.y); if (c) { cars.push(c); n++; } }
  // despawn far wrecked/far traffic
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.kind === 'traffic' && Math.hypot(c.x - playerPos.x, c.y - playerPos.y) > 1600) cars.splice(i, 1);
  }
}
