// traffic.js — civilian cars that cruise the road grid: they follow lanes,
// turn at intersections, brake for anything ahead, and honk when stuck.
// A stolen traffic car keeps its driver flag cleared; the driver becomes a fleeing ped (main.js).
import { clamp, dist, turnToward } from './rng.js';
import { vRoads, hRoads, PITCH, GRID_W, GRID_H } from './city.js';
import { makeCar, CAR_COLORS, integrateCar } from './vehicles.js';

const TARGET = 11;

export function laneAngle(car) {
  return car.aiAxis === 'v' ? (car.aiDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.aiDir > 0 ? 0 : Math.PI);
}
function lanePos(car) {
  // Right-hand traffic: offset to the right of the direction of travel.
  if (car.aiAxis === 'v') return { x: car.aiLine + car.aiDir * 17, y: car.y };
  return { x: car.x, y: car.aiLine + car.aiDir * 17 };
}
export function makeTrafficCar(rng, pickFn, awayFrom) {
  const vertical = rng() < 0.5;
  const car = makeCar(0, 0, 0, pickFn(rng, CAR_COLORS), 'traffic');
  car.aiAxis = vertical ? 'v' : 'h';
  car.aiDir = rng() < 0.5 ? 1 : -1;
  car.aiLine = vertical ? vRoads[(rng() * vRoads.length) | 0] : hRoads[(rng() * hRoads.length) | 0];
  const along = 120 + rng() * 1400;
  if (vertical) { car.x = car.aiLine + car.aiDir * 17; car.y = along; }
  else { car.x = along; car.y = car.aiLine + car.aiDir * 17; }
  if (awayFrom && dist(car.x, car.y, awayFrom.x, awayFrom.y) < 320) car.x += 500;
  car.angle = laneAngle(car);
  car.aiSpeed = 0;
  car.cruise = 105 + rng() * 55;
  return car;
}

function obstacleAhead(G, car) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const look = 62;
  const px = car.x + fx * look, py = car.y + fy * look;
  const near = (e, r) => e && Math.hypot(e.x - px, e.y - py) < r;
  if (near(G.player.inCar ? null : G.player, 26)) return true;
  if (G.player.inCar && near(G.player.inCar, 40) && G.player.inCar !== car) return true;
  for (const o of G.cars) {
    if (o === car) continue;
    if (Math.hypot(o.x - px, o.y - py) < 38) return true;
  }
  for (const pd of G.peds) if (!pd.dead && Math.hypot(pd.x - px, pd.y - py) < 24) return true;
  return false;
}

export function updateTraffic(G, dt) {
  // Top the population back up, spawning far from the player.
  let live = 0;
  for (const c of G.cars) if (c.kind === 'traffic' && c.driver) live++;
  if (live < TARGET && Math.random() < dt * 1.5) {
    const c = makeTrafficCar(G.rng, G.pick, G.playerPos());
    if (dist(c.x, c.y, G.player.x, G.player.y) > 300) G.cars.push(c);
  }
  for (const car of G.cars) {
    if (car.kind !== 'traffic' || !car.driver || car.occupied) continue;
    if (car.wrecked) { car.aiSpeed = Math.max(0, car.aiSpeed - 200 * dt); integrateCar(car, dt); continue; }
    // At an intersection, sometimes turn onto the crossing road.
    car.aiTurnCd -= dt;
    const nearV = vRoads.find((x) => Math.abs(x - car.x) < 14);
    const nearH = hRoads.find((y) => Math.abs(y - car.y) < 14);
    if (car.aiTurnCd <= 0 && ((car.aiAxis === 'v' && nearH !== undefined) || (car.aiAxis === 'h' && nearV !== undefined))) {
      if (G.rng() < 0.42) {
        if (car.aiAxis === 'v') { car.aiAxis = 'h'; car.aiLine = nearH; car.aiDir = G.rng() < 0.5 ? 1 : -1; }
        else { car.aiAxis = 'v'; car.aiLine = nearV; car.aiDir = G.rng() < 0.5 ? 1 : -1; }
        car.aiTurnCd = 1.2;
      } else car.aiTurnCd = 0.5;
    }
    const target = lanePos(car);
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    const goal = (Math.abs(turnDelta(car, want)) > 0.4) ? want : laneAngle(car);
    car.angle = turnToward(car.angle, goal, 2.4 * dt);
    const blocked = obstacleAhead(G, car);
    const desired = blocked ? 0 : car.cruise;
    car.aiSpeed += clamp(desired - car.aiSpeed, -320 * dt, 130 * dt);
    if (blocked && car.aiSpeed < 12) {
      car.honkT -= dt;
      if (car.honkT <= 0) { car.honkT = 1.4 + G.rng() * 2; if (dist(car.x, car.y, G.player.x, G.player.y) < 340) G.audio.honk(); }
    }
    integrateCar(car, dt);
    // Despawn if it somehow left the grid.
    if (car.x < -60 || car.y < -60 || car.x > GRID_W + 60 || car.y > GRID_H + 60) car.driver = false, car.dead = true;
  }
  G.cars = G.cars.filter((c) => !c.dead);
}
function turnDelta(car, want) {
  let d = (want - car.angle) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export { PITCH };
