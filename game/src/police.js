// Wanted stars and the police chase. Heat rises with crimes and decays
// when the player stays out of trouble; police cars spawn on the roads,
// chase, ram, and bust the player when they pin him down slow.
import { WORLD, ROAD_STEP, clamp, angleLerp, dist } from './config.js';
import { makeCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';
import { makeRng } from './random.js';

export function makePolice(x, y, angle) {
  const car = makeCar(x, y, angle, '#1a2a4a', 'police');
  car.siren = 0;
  car.bustTimer = 0;
  return car;
}

export function raiseWanted(world, amount) {
  world.player.wanted = clamp(world.player.wanted + amount, 0, 5);
  world.wantedTimer = 0;
}

export function updatePolice(world, dt) {
  const p = world.player;
  // Spawn pressure: up to wanted * 2 units, at most 8.
  const want = Math.min(8, Math.floor(p.wanted) * 2);
  while (world.police.length < want) {
    const spot = spawnSpot(world);
    world.police.push(makePolice(spot.x, spot.y, spot.angle));
  }
  while (world.police.length > want) world.police.pop();
  for (const cop of world.police) {
    cop.siren += dt;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const target = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = angleLerp(cop.angle, target, clamp(2.4 * dt, 0, 1));
    const speed = p.wanted > 0 ? 330 + p.wanted * 26 : 200;
    cop.speed = speed;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Ram damage on contact.
    if (d < 44) {
      if (p.onFoot) {
        p.health = Math.max(0, p.health - 22 * dt);
      } else if (Math.abs(p.car.speed) < 60) {
        cop.bustTimer += dt;
      } else {
        p.health = Math.max(0, p.health - 6 * dt);
        p.car.speed *= 1 - 0.6 * dt;
      }
      if (cop.bustTimer > 2.2) {
        bustPlayer(world);
        return;
      }
    } else {
      cop.bustTimer = Math.max(0, cop.bustTimer - dt);
    }
  }
  // Heat decays after 12 quiet seconds with no police nearby.
  if (p.wanted > 0) {
    world.wantedTimer += dt;
    const near = world.police.some((c) => dist(c.x, c.y, p.x, p.y) < 500);
    if (world.wantedTimer > 12 && !near) {
      p.wanted = Math.max(0, p.wanted - 1);
      world.wantedTimer = 0;
    }
  }
  if (p.health <= 0) {
    world.state = 'gameover';
  }
}

function spawnSpot(world) {
  const rng = world.rng;
  const p = world.player;
  // Spawn on a road ring around the player, off-screen if possible.
  for (let tries = 0; tries < 12; tries++) {
    const gx = Math.round((p.x + rng.range(-900, 900)) / ROAD_STEP);
    const gy = Math.round((p.y + rng.range(-900, 900)) / ROAD_STEP);
    const x = clamp(gx * ROAD_STEP, 60, WORLD - 60);
    const y = clamp(gy * ROAD_STEP, 60, WORLD - 60);
    if (dist(x, y, p.x, p.y) > 420) return { x, y, angle: Math.atan2(p.y - y, p.x - x) };
  }
  return { x: clamp(p.x + 600, 60, WORLD - 60), y: p.y, angle: Math.PI };
}

export function bustPlayer(world) {
  const p = world.player;
  const fine = Math.min(p.money, 150);
  p.money -= fine;
  p.wanted = 0;
  world.police.length = 0;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  p.onFoot = true;
  p.health = 100;
  // Booked at the precinct on 5th and Marina Blvd, then released.
  p.x = 1200;
  p.y = 1200;
  world.state = 'busted';
  world.bustedAt = world.time;
  world.lastFine = fine;
}
