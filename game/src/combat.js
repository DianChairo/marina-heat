// Combat: mouse-aimed shooting with a cooldown, tracer bullets, and hit
// resolution against police cars, traffic and pedestrians. Every shot is
// a crime — firing raises the wanted level.
import { BULLET_SPEED, BULLET_RANGE, dist } from './config.js';
import { carAtPoint } from './vehicles.js';
import { raiseWanted } from './police.js';
import { scarePeds } from './pedestrians.js';

export function makeCombat() {
  return { bullets: [], shotsFired: 0, cooldown: 0, lastHit: -99, muzzle: 0 };
}

export function updateCombat(world, dt) {
  const c = world.combat;
  const p = world.player;
  c.cooldown = Math.max(0, c.cooldown - dt);
  c.muzzle = Math.max(0, c.muzzle - dt);
  const input = world.input;
  if (world.state === 'playing' && p.onFoot && input.mouse.down && c.cooldown <= 0) {
    fireBullet(world);
    c.cooldown = 0.16;
  }
  for (const b of c.bullets) {
    b.x += Math.cos(b.angle) * BULLET_SPEED * dt;
    b.y += Math.sin(b.angle) * BULLET_SPEED * dt;
    b.traveled += BULLET_SPEED * dt;
    // Hit a police car.
    for (const cop of world.police) {
      if (Math.abs(b.x - cop.x) < 24 && Math.abs(b.y - cop.y) < 16 && !b.dead) {
        cop.health -= 34;
        b.dead = true;
        c.lastHit = world.time;
        if (cop.health <= 0) {
          world.police = world.police.filter((o) => o !== cop);
          p.money += 100;
          world.stats.copsDown = (world.stats.copsDown || 0) + 1;
        }
      }
    }
    // Hit a traffic car.
    const car = carAtPoint(world, b.x, b.y);
    if (car && !b.dead) {
      car.health -= 25;
      b.dead = true;
      if (car.health <= 0 && car.kind === 'traffic') {
        world.cars = world.cars.filter((o) => o !== car);
      }
    }
    // Hit a pedestrian.
    for (const ped of world.peds) {
      if (ped.hp > 0 && dist(b.x, b.y, ped.x, ped.y) < 14 && !b.dead) {
        ped.hp = 0;
        ped.flee = -1;
        b.dead = true;
        raiseWanted(world, 1);
      }
    }
  }
  c.bullets = c.bullets.filter((b) => !b.dead && b.traveled < BULLET_RANGE);
}

function fireBullet(world) {
  const c = world.combat;
  const p = world.player;
  const aim = p.aim !== undefined ? p.aim : p.angle;
  const ox = p.x + Math.cos(aim) * 22;
  const oy = p.y + Math.sin(aim) * 22;
  c.bullets.push({ x: ox, y: oy, angle: aim + (world.rng.next() - 0.5) * 0.05, traveled: 0, dead: false });
  c.shotsFired += 1;
  c.muzzle = 0.06;
  scarePeds(world, p.x, p.y, 320);
  if (p.wanted < 1) raiseWanted(world, 1);
  world.audio.shoot();
}
