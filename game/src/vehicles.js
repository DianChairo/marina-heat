// Cars: traffic that cruises the road grid, parked cars, and the driving
// model the player uses. Traffic follows road centre lines and wraps at
// the city edge; the player's car uses simple arcade physics.
import { WORLD, ROAD_STEP, CAR_MAX_SPEED, CAR_ACCEL, COLORS, clamp, angleLerp } from './config.js';
import { isBlocked, nearestRoadPoint } from './city.js';
import { makeRng } from './random.js';

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color,
    kind: kind || 'traffic',
    len: kind === 'truck' ? 62 : 46,
    wid: 22,
    health: 100,
    stuck: 0,
    route: null,
    driver: null,
  };
}

export function spawnTraffic(city, seed, count) {
  const rng = makeRng(seed + 101);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    const lane = rng.int(0, 7) * ROAD_STEP + (rng.chance(0.5) ? 14 : -14);
    const along = rng.range(100, WORLD - 100);
    const x = vertical ? lane : along;
    const y = vertical ? along : lane;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(x, y, angle, rng.pick(COLORS.car), rng.chance(0.12) ? 'truck' : 'traffic');
    car.speed = rng.range(90, 170);
    car.route = { vertical, dir: angle };
    cars.push(car);
  }
  // Parked cars along the roads.
  for (let i = 0; i < 14; i++) {
    const vertical = rng.chance(0.5);
    const lane = rng.int(0, 7) * ROAD_STEP + (rng.chance(0.5) ? 52 : -52);
    const along = rng.range(200, WORLD - 200);
    const x = vertical ? lane : along;
    const y = vertical ? along : lane;
    const angle = vertical ? Math.PI / 2 : 0;
    const car = makeCar(x, y, angle, rng.pick(COLORS.car), 'parked');
    cars.push(car);
  }
  return cars;
}

function moveWithCollision(city, car, dx, dy) {
  const nx = car.x + dx;
  const ny = car.y + dy;
  if (!isBlocked(city, nx, car.y, 14)) car.x = nx;
  if (!isBlocked(city, car.x, ny, 14)) car.y = ny;
}

export function updateTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.kind === 'parked') continue;
    if (car === world.player.car) continue;
    // Cruise along its road; wrap around the city edge.
    const sp = car.speed * dt;
    car.x += Math.cos(car.angle) * sp;
    car.y += Math.sin(car.angle) * sp;
    if (car.x < -60) car.x = WORLD + 60;
    if (car.x > WORLD + 60) car.x = -60;
    if (car.y < -60) car.y = WORLD + 60;
    if (car.y > WORLD + 60) car.y = -60;
    // Gentle separation from the car ahead.
    for (const other of world.cars) {
      if (other === car || other.kind === 'parked') continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 46 && d > 0.01) {
        car.speed = Math.max(40, car.speed - 120 * dt);
      }
    }
    car.speed = Math.min(car.speed, 190);
  }
}

export function drivePlayerCar(world, dt) {
  const input = world.input;
  const car = world.player.car;
  if (!car) return;
  const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 0.55 : 0);
  const steer = (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.speed += fwd * CAR_ACCEL * dt;
  car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -180, CAR_MAX_SPEED);
  if (Math.abs(car.speed) > 8) {
    car.angle += steer * 2.1 * dt * dir * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const blocked = isBlocked(world.city, nx, ny, 15);
  if (!blocked) {
    car.x = nx;
    car.y = ny;
  } else {
    if (Math.abs(car.speed) > 240) {
      world.player.health = Math.max(0, world.player.health - 4);
      world.combat.lastHit = world.time;
    }
    car.speed *= -0.25;
  }
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.angle = car.angle;
  // Bumping pedestrians and traffic costs heat.
  for (const ped of world.peds) {
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
      ped.flee = 3;
      ped.hp = 0;
      world.player.wanted = Math.min(5, world.player.wanted + 1);
    }
  }
}

export function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function carAtPoint(world, x, y) {
  for (const car of world.cars) {
    const dx = x - car.x;
    const dy = y - car.y;
    const lx = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
    const ly = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
    if (Math.abs(lx) < car.len / 2 + 4 && Math.abs(ly) < car.wid / 2 + 4) return car;
  }
  return null;
}
