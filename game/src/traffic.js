// traffic.js — lane-following traffic AI + parked car placement.
import { makeCar, updateCar, CAR_COLORS } from './vehicles.js';
import { CELL, ROAD, WORLD } from './city.js';
import { dist } from './rng.js';
// lanes: for travel dir, offset from road start. Road spans [k*CELL, k*CELL+ROAD].
const LANE = { E: ROAD * 0.72, W: ROAD * 0.28, S: ROAD * 0.72, N: ROAD * 0.28 };
function lanePos(c) {
  // returns target point ahead on current lane
  if (c.dir === 0) return [c.x + 90, Math.floor(c.y / CELL) * CELL + LANE.E]; // east
  if (c.dir === 2) return [c.x - 90, Math.floor(c.y / CELL) * CELL + LANE.W];
  if (c.dir === 1) return [Math.floor(c.x / CELL) * CELL + LANE.S, c.y + 90]; // south
  return [Math.floor(c.x / CELL) * CELL + LANE.N, c.y - 90]; // north
}
export function spawnParked(S) {
  // [x, y, vertical?] — every spot sits on a road lane edge, never inside a block
  const spots = [
    [428, 300, 1], [428, 1500, 1], [828, 1000, 1], [1228, 2100, 1], [1628, 620, 1],
    [2028, 1800, 1], [2428, 900, 1], [2828, 2350, 1],
    [700, 428, 0], [1800, 828, 0], [2600, 1228, 0], [1000, 2028, 0], [2200, 2428, 0], [520, 2828, 0],
  ];
  spots.forEach(([x, y, vert], i) => {
    const c = makeCar(x, y, vert ? Math.PI / 2 : 0, CAR_COLORS[i % CAR_COLORS.length], 'parked');
    S.cars.push(c);
  });
}
export function spawnTrafficCar(S, rng, nearPlayer) {
  const horiz = rng.chance(0.5);
  const k = rng.int(0, 7);
  let x, y, dir;
  if (nearPlayer) {
    // spawn on a road a few blocks from the player, out of direct sight
    const px = S.player.x, py = S.player.y;
    if (horiz) { y = Math.floor(py / CELL) * CELL + (rng.chance(0.5) ? LANE.E : LANE.W); x = px + (rng.chance(0.5) ? -620 : 620); dir = y % CELL > ROAD / 2 ? 0 : 2; if (x > px) dir = 2; if (x < px) dir = 0; }
    else { x = Math.floor(px / CELL) * CELL + (rng.chance(0.5) ? LANE.S : LANE.N); y = py + (rng.chance(0.5) ? -620 : 620); dir = y > py ? 3 : 1; }
  } else if (horiz) { dir = rng.chance(0.5) ? 0 : 2; y = k * CELL + (dir === 0 ? LANE.E : LANE.W); x = rng.range(80, WORLD - 80); }
  else { dir = rng.chance(0.5) ? 1 : 3; x = k * CELL + (dir === 1 ? LANE.S : LANE.N); y = rng.range(80, WORLD - 80); }
  const c = makeCar(x, y, dir === 0 ? 0 : dir === 1 ? Math.PI / 2 : dir === 2 ? Math.PI : -Math.PI / 2, CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)], 'traffic');
  c.dir = dir; c.driver = 'npc'; c.cruise = rng.range(120, 185);
  S.cars.push(c); return c;
}
export function updateTraffic(S, dt) {
  const rng = S.rng;
  let live = 0;
  for (const c of S.cars) {
    if (c.kind !== 'traffic') continue;
    live++;
    const dP = dist(c.x, c.y, S.player.x, S.player.y);
    if (dP > 1500) { c.dead = true; c.kind = 'wreck'; continue; } // recycle far cars
    const [tx, ty] = lanePos(c);
    const want = Math.atan2(ty - c.y, tx - c.x);
    let diff = want - c.a; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    // obstacle scan ahead
    let blocked = false;
    const fx = c.x + Math.cos(c.a) * 74, fy = c.y + Math.sin(c.a) * 74;
    for (const o of S.cars) { if (o !== c && dist(fx, fy, o.x, o.y) < 34) { blocked = true; break; } }
    if (!blocked) for (const pd of S.peds) { if (dist(fx, fy, pd.x, pd.y) < 26) { blocked = true; break; } }
    if (!blocked && S.player.car !== c && !S.player.car && dist(fx, fy, S.player.x, S.player.y) < 28) blocked = true;
    c.brake = blocked;
    if (blocked && c.honkT <= 0 && Math.hypot(c.vx, c.vy) < 20 && rng.chance(0.012)) { c.honkT = 1.2; if (dP < 380) S.audio.honk(); }
    c.honkT -= dt;
    // intersection turning: near a crossing, sometimes pick a new direction
    c.turnCd -= dt;
    const inX = (c.x % CELL) < ROAD, inY = (c.y % CELL) < ROAD;
    if (inX && inY && c.turnCd <= 0 && rng.chance(0.35)) {
      c.turnCd = 2.5;
      const opts = c.dir === 0 || c.dir === 2 ? [c.dir, 1, 3] : [c.dir, 0, 2];
      c.dir = opts[rng.int(0, opts.length - 1)];
      // snap to the lane of the new direction once past centre
    }
    const ctrl = { up: !blocked, down: blocked && Math.hypot(c.vx, c.vy) > 30, left: diff < -0.06, right: diff > 0.06, hand: false };
    // cap speed at cruise by easing off throttle
    if (Math.hypot(c.vx, c.vy) > c.cruise) ctrl.up = false;
    updateCar(S, c, ctrl, dt);
  }
  S.cars = S.cars.filter((c) => c.kind !== 'wreck');
  if (live < 9 && rng.chance(0.03)) spawnTrafficCar(S, rng, true);
}
