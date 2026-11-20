// player.js — the protagonist: on-foot movement with collision, car
// entry/exit and theft, health and the busted/wasted flow.

import { moveVector, down, justPressed } from './input.js';
import { hitsBuilding, isWater } from './city.js';
import { stepCar } from './vehicles.js';
import { clamp, dist } from './rng.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: 9,
    health: 100,
    inCar: null,
    walkPhase: 0,
    dead: false,
    bustTimer: 0,
  };
}

const FOOT_SPEED = 150;
const SPRINT_SPEED = 235;

export function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.allCars()) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function updatePlayer(world, dt) {
  const p = world.player;
  const audio = world.audio;

  if (p.inCar) {
    const car = p.inCar;
    let throttle = 0;
    let steer = 0;
    if (down('KeyW') || down('ArrowUp')) throttle = 1;
    if (down('KeyS') || down('ArrowDown')) throttle = -1;
    if (down('KeyA') || down('ArrowLeft')) steer = -1;
    if (down('KeyD') || down('ArrowRight')) steer = 1;
    const crashed = stepCar(car, throttle, steer, dt, world.city);
    if (crashed) {
      audio.crash(0.4);
      world.police.reportCrime('collision', car.x, car.y, 0.4);
      p.health -= 2;
    }
    // Running over a pedestrian is very much a crime.
    for (const ped of world.pedestrians) {
      if (ped.state !== 'down' && Math.abs(car.speed) > 60 && dist(car.x, car.y, ped.x, ped.y) < 22) {
        ped.state = 'down';
        ped.downTime = 0;
        world.police.reportCrime('assault', ped.x, ped.y, 1.2);
        audio.crash(0.25);
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    audio.engine(true, Math.abs(car.speed) / 340);
    if (justPressed('KeyE')) {
      // Step out to the left of the car.
      const side = car.angle - Math.PI / 2;
      p.x = car.x + Math.cos(side) * 26;
      p.y = car.y + Math.sin(side) * 26;
      car.driver = null;
      if (world.traffic.includes(car)) car.driver = 'traffic';
      p.inCar = null;
      audio.engine(false, 0);
      audio.blip(420, 0.06, 'square', 0.1);
    }
    return;
  }

  audio.engine(false, 0);
  const mv = moveVector();
  const sprint = down('ShiftLeft') || down('ShiftRight');
  const speed = sprint ? SPRINT_SPEED : FOOT_SPEED;
  if (mv.x !== 0 || mv.y !== 0) {
    p.angle = Math.atan2(mv.y, mv.x);
    p.walkPhase += dt * (sprint ? 13 : 10);
    const nx = p.x + mv.x * speed * dt;
    const ny = p.y + mv.y * speed * dt;
    if (!hitsBuilding(world.city, nx, p.y, p.radius) && !isWater(nx, p.y)) p.x = nx;
    if (!hitsBuilding(world.city, p.x, ny, p.radius) && !isWater(p.x, ny)) p.y = ny;
    p.x = clamp(p.x, 12, 3188);
    p.y = clamp(p.y, 12, 3188);
  }

  if (justPressed('KeyE')) {
    const car = nearestCar(world, p.x, p.y, 44);
    if (car) {
      const wasParked = car.driver === null;
      const wasTraffic = car.driver === 'traffic';
      car.driver = 'player';
      p.inCar = car;
      p.x = car.x;
      p.y = car.y;
      audio.blip(520, 0.06, 'square', 0.12);
      if (wasParked || wasTraffic) {
        // Stealing a car in view of the law raises heat.
        world.police.reportCrime('theft', car.x, car.y, 1);
      }
    }
  }
}

export function drawPlayer(ctx, world, cam) {
  const p = world.player;
  if (p.inCar) return; // the car itself is drawn by the vehicle pass
  const sx = p.x - cam.x;
  const sy = p.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(p.walkPhase) * 1.8;
  // Legs (jeans).
  ctx.strokeStyle = '#24406e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.angle + 2.5) * 7, Math.sin(p.angle + 2.5) * 7 + Math.abs(bob) * 0.3);
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.angle - 2.5) * 7, Math.sin(p.angle - 2.5) * 7 + Math.abs(bob) * 0.3);
  ctx.stroke();
  // Torso: loud marina shirt.
  ctx.fillStyle = '#ff5e78';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Head + shades line toward aim.
  ctx.fillStyle = '#c68863';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 4.4, 0, Math.PI * 2);
  ctx.fill();
  // Gun arm toward the mouse aim.
  const aim = world.aimAngle;
  ctx.strokeStyle = '#c68863';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(aim) * 11, Math.sin(aim) * 11);
  ctx.stroke();
  ctx.fillStyle = '#22242a';
  ctx.fillRect(Math.cos(aim) * 11 - 2, Math.sin(aim) * 11 - 2, 5, 4);
  ctx.restore();
}
