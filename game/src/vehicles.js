// vehicles.js — car factory, player-driven physics (with drift), car drawing,
// and car-vs-car collision. Traffic/police steering lives in their own modules;
// they move cars by setting angle/speed and calling integrateCar.
import { clamp, angDiff } from './rng.js';
import { collideWorld, vRoads, hRoads } from './city.js';

export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#ecf0f1', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8', '#95a5a6'];
let nextId = 1;
export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextId++, x, y, angle, vx: 0, vy: 0, speed: 0, steer: 0,
    w: 46, h: 23, r: 21, color, kind, hp: 100, wrecked: false,
    driver: kind !== 'parked', occupied: false, honkT: 0, smokeT: 0,
    aiDir: 1, aiAxis: 'v', aiLane: 0, aiSpeed: 0, aiTurnCd: 0, fleeing: false,
  };
}
export function carSpeed(car) { return Math.hypot(car.vx, car.vy); }

export function spawnParkedCars(rng, pickFn) {
  const cars = [];
  // Parked along road edges and in front of blocks, nose-in or parallel.
  for (let n = 0; n < 26; n++) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const cx = vRoads[Math.floor(rng() * vRoads.length)];
      const y = 80 + rng() * 1560;
      const side = rng() < 0.5 ? -1 : 1;
      cars.push(makeCar(cx + side * 33, y, side > 0 ? Math.PI / 2 : -Math.PI / 2, pickFn(rng, CAR_COLORS), 'parked'));
    } else {
      const cy = hRoads[Math.floor(rng() * hRoads.length)];
      const x = 80 + rng() * 1860;
      const side = rng() < 0.5 ? -1 : 1;
      cars.push(makeCar(x, cy + side * 33, side > 0 ? 0 : Math.PI, pickFn(rng, CAR_COLORS), 'parked'));
    }
  }
  return cars;
}

// Shared kinematic step for AI cars: move at aiSpeed along angle, collide with buildings.
export function integrateCar(car, dt) {
  car.vx = Math.cos(car.angle) * car.aiSpeed;
  car.vy = Math.sin(car.angle) * car.aiSpeed;
  car.x += car.vx * dt; car.y += car.vy * dt;
  const probe = { x: car.x, y: car.y, vx: car.vx, vy: car.vy };
  collideWorld(probe, car.r);
  car.x = probe.x; car.y = probe.y;
}

// Player-driven physics: throttle/brake/reverse, speed-sensitive steering, and a
// velocity model that keeps some lateral slide so fast turns drift.
export function updateDrivenCar(G, car, inp, dt) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let fSpeed = car.vx * fx + car.vy * fy;
  const maxF = car.wrecked ? 90 : 335, maxR = 110;
  const accel = car.wrecked ? 130 : 265;
  if (inp.up) fSpeed += accel * dt;
  if (inp.down) fSpeed += (fSpeed > 12 ? -430 : -170) * dt; // brake, then reverse
  fSpeed -= fSpeed * (inp.up ? 0.12 : 0.55) * dt;            // drag / coast-down
  fSpeed = clamp(fSpeed, -maxR, maxF);
  const steerInput = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  car.steer += clamp(steerInput - car.steer, -6 * dt, 6 * dt) * (steerInput !== 0 ? 1 : 2.2);
  const steerAuthority = clamp(Math.abs(fSpeed) / 60, 0, 1) * (1 - clamp(Math.abs(fSpeed) / 900, 0, 0.45));
  car.angle += car.steer * 1.9 * steerAuthority * Math.sign(fSpeed || 1) * dt;
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  let latX = car.vx - fx * (car.vx * fx + car.vy * fy), latY = car.vy - fy * (car.vx * fx + car.vy * fy);
  // Lateral grip: strong normally, weaker at high speed / hard steering => drift.
  const grip = Math.abs(car.steer) > 0.7 && Math.abs(fSpeed) > 190 ? 2.2 : 7.5;
  latX -= latX * Math.min(1, grip * dt); latY -= latY * Math.min(1, grip * dt);
  const drifting = Math.hypot(latX, latY) > 55 && Math.abs(fSpeed) > 120;
  car.vx = nfx * fSpeed + latX; car.vy = nfy * fSpeed + latY;
  car.x += car.vx * dt; car.y += car.vy * dt;
  car.speed = fSpeed;
  if (drifting) { G.addChaos(6 * dt * 10, 'drift'); G.spawnSkid(car); }
  const probe = { x: car.x, y: car.y, vx: car.vx, vy: car.vy };
  const impact = collideWorld(probe, car.r);
  if (impact > 60) {
    const dmg = (impact - 50) * 0.12;
    damageCar(G, car, dmg, probe.x, probe.y);
    G.onCrash(impact, probe.x, probe.y);
    G.shake = Math.min(14, G.shake + impact * 0.03);
  }
  car.x = probe.x; car.y = probe.y; car.vx = probe.vx; car.vy = probe.vy;
  return drifting;
}

export function damageCar(G, car, dmg, x, y) {
  if (car.wrecked) return;
  car.hp -= dmg;
  G.spawnSparks(x ?? car.x, y ?? car.y, Math.min(10, 2 + dmg));
  if (car.hp <= 0) {
    car.hp = 0; car.wrecked = true;
    G.onCarWrecked(car);
  }
}

// Circle collision between two cars: push apart, trade momentum, damage on hard hits.
export function collideCars(G, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy), min = a.r + b.r - 4;
  if (d === 0 || d >= min) return;
  const ux = dx / d, uy = dy / d, overlap = min - d;
  const aStatic = a.kind === 'parked' && !a.occupied, bStatic = b.kind === 'parked' && !b.occupied;
  if (!aStatic) { a.x -= ux * overlap * (bStatic ? 1 : 0.5); a.y -= uy * overlap * (bStatic ? 1 : 0.5); }
  if (!bStatic) { b.x += ux * overlap * (aStatic ? 1 : 0.5); b.y += uy * overlap * (aStatic ? 1 : 0.5); }
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const rel = rvx * ux + rvy * uy;
  if (rel < 0) {
    const imp = -rel * 0.72;
    if (!aStatic) { a.vx -= ux * imp; a.vy -= uy * imp; }
    if (!bStatic) { b.vx += ux * imp; b.vy += uy * imp; }
    if (-rel > 55) {
      const dmg = (-rel - 45) * 0.1;
      damageCar(G, a, dmg, a.x + ux * a.r, a.y + uy * a.r);
      damageCar(G, b, dmg, b.x - ux * b.r, b.y - uy * b.r);
      G.onCrash(-rel, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  }
}

export function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, car.w / 2, car.h / 2, 0, 0, 7); ctx.fill();
  const body = car.wrecked ? '#3a3a3a' : car.color;
  ctx.fillStyle = body;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6); ctx.fill();
  // Hood + trunk shading, cabin, glass.
  ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(car.w * 0.22, -car.h / 2 + 2, car.w * 0.24, car.h - 4);
  ctx.fillStyle = car.wrecked ? '#222' : '#20303e';
  roundRect(ctx, -car.w * 0.16, -car.h / 2 + 3, car.w * 0.36, car.h - 6, 4); ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,0.5)'; ctx.fillRect(car.w * 0.13, -car.h / 2 + 4, 4, car.h - 8);
  // Wheels.
  ctx.fillStyle = '#14181c';
  for (const [wx, wy] of [[-car.w * 0.32, -car.h / 2 - 1], [car.w * 0.32, -car.h / 2 - 1], [-car.w * 0.32, car.h / 2 - 3], [car.w * 0.32, car.h / 2 - 3]])
    ctx.fillRect(wx - 5, wy, 10, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f5f6fa'; ctx.fillRect(-car.w * 0.14, -car.h / 2, car.w * 0.3, car.h);
    ctx.fillStyle = '#1b2a4a'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 1, 3);
    const phase = Math.floor(t * 6) % 2;
    ctx.fillStyle = phase ? '#ff3b30' : '#2e6bff';
    ctx.beginPath(); ctx.arc(-2, -4, 3, 0, 7); ctx.fill();
    ctx.fillStyle = phase ? '#2e6bff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(-2, 4, 3, 0, 7); ctx.fill();
    ctx.fillStyle = phase ? 'rgba(255,59,48,0.25)' : 'rgba(46,107,255,0.25)';
    ctx.beginPath(); ctx.arc(-2, 0, 17, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 3, 2, 4); ctx.fillRect(car.w / 2 - 2, car.h / 2 - 7, 2, 4);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(-car.w / 2, -car.h / 2 + 3, 2, 4); ctx.fillRect(-car.w / 2, car.h / 2 - 7, 2, 4);
  }
  ctx.restore();
  // Damage smoke / fire drawn unrotated above the car.
  if (car.hp < 62 && !car.wrecked) {
    const n = car.hp < 30 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const ph = (t * 1.7 + car.id * 1.3 + i * 0.6) % 1;
      ctx.fillStyle = car.hp < 30 && i === 0 ? `rgba(255,${120 + ((ph * 80) | 0)},30,${0.75 - ph * 0.5})` : `rgba(70,70,70,${0.5 - ph * 0.35})`;
      ctx.beginPath(); ctx.arc(car.x + 12 + ph * 7, car.y - ph * 20, 3 + ph * 7, 0, 7); ctx.fill();
    }
  }
  if (car.wrecked) {
    const ph = (t * 2.1 + car.id) % 1;
    ctx.fillStyle = `rgba(255,110,20,${0.8 - ph * 0.5})`;
    ctx.beginPath(); ctx.arc(car.x, car.y - ph * 14, 4 + ph * 5, 0, 7); ctx.fill();
  }
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
