// vehicles.js — car physics: arcade acceleration, steering and drift,
// plus damage states (smoke, fire, wreck) and car-car collisions.
import { clampToCity, resolveBuildings } from './city.js';
import { isDown, wasPressed } from './input.js';

const CAR_COLORS = ['#d84a4a', '#4a7ad8', '#e8c33a', '#4ad88a', '#c9c9c9', '#8a4ad8', '#e87a2a', '#3aa8a8'];

export function randomCarColor(rng) {
  return rng.pick(CAR_COLORS);
}

export function createCar(x, y, angle, color, kind) {
  return {
    kind: kind || 'traffic',
    x, y, angle,
    speed: 0,
    steer: 0,
    color,
    hp: 100,
    maxHp: 100,
    driver: kind === 'traffic' ? 'ai' : null,
    wrecked: false,
    smoke: 0,
    fire: 0,
    // Traffic AI lane state.
    lane: null,
    laneDir: 0,
    honk: 0,
  };
}

// Arcade car physics. `control` is {throttle, brake, steer} in -1..1.
export function stepCar(G, car, dt, control) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - 3 * dt);
    return;
  }
  const maxSpeed = car.kind === 'police' ? 430 : 380;
  const accel = 300;
  const reverseMax = 140;
  car.speed += control.throttle * accel * dt;
  if (control.brake > 0) car.speed -= control.brake * 520 * dt;
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -reverseMax) car.speed = -reverseMax;
  if (Math.abs(car.speed) < 4 && control.throttle === 0) car.speed = 0;
  // Steering weakens at very low speed, strengthens with drift.
  const grip = Math.min(1, Math.abs(car.speed) / 90);
  const drift = isDown(G.input, 'Space') ? 1.6 : 1;
  car.angle += control.steer * 2.4 * grip * drift * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveBuildings(G.city, nx, ny, 16);
  if ((fixed.x !== nx || fixed.y !== ny) && Math.abs(car.speed) > 60) {
    damageCar(G, car, Math.abs(car.speed) * 0.08);
    car.speed *= 0.35;
    G.audio.crash();
    spawnSparks(G, fixed.x, fixed.y);
  }
  car.x = fixed.x;
  car.y = fixed.y;
  const clamped = clampToCity(G.city, car.x, car.y, 22);
  if (clamped.x !== car.x || clamped.y !== car.y) {
    car.speed *= 0.5;
    car.x = clamped.x;
    car.y = clamped.y;
  }
  if (car.hp < 55) car.smoke = Math.min(1, car.smoke + dt * 0.4);
  if (car.hp < 28) car.fire = Math.min(1, car.fire + dt * 0.5);
}

export function damageCar(G, car, amount) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
    car.smoke = 1;
    car.fire = 1;
    spawnSparks(G, car.x, car.y);
    G.audio.crash();
    if (car.kind === 'player' && G.player.car === car) {
      // Player's ride blew up: dump them out on foot, hurt.
      G.player.onFoot = true;
      G.player.car = null;
      G.player.x = car.x + 30;
      G.player.y = car.y + 30;
      G.player.hp = Math.max(1, G.player.hp - 20);
    }
  }
}

// Player driving input: W/S throttle and brake, A/D steer, E to bail out.
export function playerCarControl(G) {
  const input = G.input;
  const throttle = isDown(input, 'KeyW', 'ArrowUp') ? 1 : isDown(input, 'KeyS', 'ArrowDown') ? -0.6 : 0;
  const brake = isDown(input, 'KeyS', 'ArrowDown') && (G.player.car?.speed ?? 0) > 30 ? 1 : 0;
  const steer = (isDown(input, 'KeyA', 'ArrowLeft') ? -1 : 0) + (isDown(input, 'KeyD', 'ArrowRight') ? 1 : 0);
  return { throttle, brake, steer };
}

export function updatePlayerCar(G, dt) {
  const p = G.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  if (wasPressed(G.input, 'KeyE')) {
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.car = null;
    car.kind = 'traffic';
    car.driver = 'ai';
    car.speed *= 0.4;
    return;
  }
  stepCar(G, car, dt, playerCarControl(G));
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.audio.engine(Math.min(1, Math.abs(car.speed) / 380));
}

export function spawnSparks(G, x, y) {
  for (let i = 0; i < 10; i++) {
    G.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.5) * 260,
      t: 0, life: 0.5, color: '#ffcc33', size: 3,
    });
  }
}

export function spawnSmoke(G, x, y, dark) {
  G.particles.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 20,
    vy: -30 - Math.random() * 30,
    t: 0, life: 0.9, color: dark ? '#333' : '#999', size: 6,
  });
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  G.particles = G.particles.filter((pt) => pt.t < pt.life);
}

// Simple circle-vs-circle separation between cars so traffic does not stack.
export function separateCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 34) {
        const push = (34 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        if (Math.abs(a.speed) > 120 || Math.abs(b.speed) > 120) {
          damageCar(G, a, 4);
          damageCar(G, b, 4);
        }
      }
    }
  }
}

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 20, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = car.wrecked ? '#2a2a2a' : car.color;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-20, -11, 40, 22, 6);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = car.wrecked ? '#1a1a1a' : 'rgba(180,220,240,0.9)';
  ctx.beginPath();
  ctx.roundRect(-6, -9, 14, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(-19, -12, 5, 5);
  ctx.fillRect(-19, 7, 5, 5);
  ctx.fillRect(14, -12, 5, 5);
  ctx.fillRect(14, 7, 5, 5);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(19, -8, 2, 4);
  ctx.fillRect(19, 4, 2, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-14, -11, 26, 4);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, -12);
  }
  if (car.kind === 'player') {
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-22, -13, 44, 26, 7);
    ctx.stroke();
  }
  ctx.restore();
  if (car.fire > 0.3) {
    ctx.fillStyle = `rgba(255,${Math.floor(120 + Math.random() * 80)},0,0.85)`;
    ctx.beginPath();
    ctx.arc(car.x, car.y, 8 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
