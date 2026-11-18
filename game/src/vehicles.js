// vehicles.js — stealable cars with drift driving, damage and wrecks.
// E near a car (or its driver seat) steals it; the driver is pulled out.
// Damage makes a car smoke, then burn, then wreck — a wrecked car stalls.
import { collideBuildings, WORLD } from './city.js';

const CAR_COLORS = ['#dc2626', '#2563eb', '#f59e0b', '#16a34a', '#7c3aed', '#ec4899', '#f8fafc', '#111827', '#0891b2'];

export function createCar(x, y, angle, color, police = false) {
  return {
    x, y, angle, speed: 0, color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    hp: 100, police, wrecked: false, driver: police ? 'cop' : null,
    w: 46, h: 22, steer: 0, smoke: 0,
  };
}

export function nearestCar(G, x, y, maxDist) {
  let best = null; let bd = maxDist;
  for (const c of G.cars) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.onFoot = false;
  p.car = car;
  car.driver = 'player';
  p.x = car.x; p.y = car.y;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = null;
  car.speed *= 0.3;
  p.onFoot = true;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
}

export function damageCar(G, car, amount) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (car.hp <= 50) car.smoke = 1;
  if (car.hp <= 25) car.smoke = 2;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
    G.audio.crash();
    G.particles.push({ x: car.x, y: car.y, r: 30, life: 0.8, max: 0.8, color: '#f97316' });
    if (car.driver === 'player') {
      exitCar(G);
      damagePlayer(G, 15);
    }
  }
}

function damagePlayer(G, amount) {
  // local copy to avoid a circular import with player.js
  const p = G.player;
  if (G.mode !== 'play') return;
  p.hp -= amount;
  p.hurtFlash = 0.35;
  if (p.hp <= 0) { p.hp = 0; G.mode = 'wasted'; G.audio.setEngine(false, 0); G.audio.setSiren(false); }
}

export function updateCar(G, car, dt) {
  if (car.wrecked) return;
  const inp = G.input;
  const isPlayer = car.driver === 'player';
  let throttle = 0; let steer = 0;
  if (isPlayer) {
    if (inp.down('w', 'arrowup')) throttle = 1;
    if (inp.down('s', 'arrowdown')) throttle = -0.6;
    if (inp.down('a', 'arrowleft')) steer = -1;
    if (inp.down('d', 'arrowright')) steer = 1;
    if (inp.down(' ')) throttle *= 0.2; // handbrake
  }
  const maxSpeed = car.police ? 430 : 400;
  car.speed += throttle * 320 * dt;
  car.speed -= car.speed * 0.9 * dt; // drag
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -140) car.speed = -140;
  const grip = Math.abs(car.speed) > 240 && steer !== 0 ? 0.55 : 1; // drift at speed
  car.angle += steer * (car.speed / 160) * grip * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collideBuildings(G.city, nx, ny, 22);
  if (hit) {
    if (Math.abs(car.speed) > 120) {
      damageCar(G, car, Math.abs(car.speed) * 0.06);
      G.audio.crash();
      G.particles.push({ x: nx, y: ny, r: 16, life: 0.5, max: 0.5, color: '#fbbf24' });
    }
    car.speed *= -0.25;
  } else {
    car.x = Math.max(20, Math.min(WORLD - 20, nx));
    car.y = Math.max(20, Math.min(WORLD - 20, ny));
  }
  if (isPlayer) {
    G.player.x = car.x; G.player.y = car.y; G.player.angle = car.angle;
    G.audio.setEngine(true, Math.abs(car.speed) / maxSpeed);
  }
  if (car.smoke > 0 && Math.random() < 0.3) {
    G.particles.push({
      x: car.x + (Math.random() - 0.5) * 20, y: car.y + (Math.random() - 0.5) * 20,
      r: 6 + Math.random() * 8, life: 0.9, max: 0.9,
      color: car.smoke === 2 ? '#f97316' : '#9ca3af',
    });
  }
}

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#00000055';
  ctx.fillRect(-24, -12, 48, 26);
  ctx.fillStyle = car.wrecked ? '#3f3f46' : car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = car.wrecked ? '#27272a' : '#0ea5e9';
  ctx.fillRect(-6, -9, 14, 18); // windshield + roof glass
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(18, -9, 3, 4); ctx.fillRect(18, 5, 3, 4); // headlights
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-23, -9, 3, 4); ctx.fillRect(-23, 5, 3, 4); // tail lights
  if (car.police) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-4, -11, 12, 22);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(-2, -11, 8, 22);
  }
  ctx.restore();
  if (car.wrecked) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WRECK', car.x, car.y - 20);
    ctx.restore();
  }
}
