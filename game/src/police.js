// police.js — the 1-5 star wanted system: heat builds with crimes,
// decays when the player lays low, and police cars chase and ram.
// When a cop car stays close while the player is slow, the BUSTED meter fills.
import { randomRoadPoint } from './city.js';
import { createCar, damageCar, drawCar, stepCar } from './vehicles.js';
import { damagePlayer, pushMessage } from './player.js';

export function starsFromHeat(heat) {
  if (heat <= 0) return 0;
  if (heat < 20) return 1;
  if (heat < 40) return 2;
  if (heat < 60) return 3;
  if (heat < 85) return 4;
  return 5;
}

export function addHeat(G, n) {
  const before = G.wanted;
  G.heat = Math.min(100, G.heat + n);
  G.wanted = starsFromHeat(G.heat);
  if (G.wanted > before && G.wanted > 0) {
    pushMessage(G, 'Dispatch', `Wanted level ${G.wanted}. Units responding.`);
    G.audio.phone();
  }
}

export function spawnPoliceCar(G) {
  const p = randomRoadPoint(G.rng, G.city);
  const car = createCar(p.x, p.y, p.angle, '#1a2a4a', 'police');
  car.speed = 200;
  G.cars.push(car);
  return car;
}

function policeCount(G) {
  let n = 0;
  for (const car of G.cars) if (car.kind === 'police' && !car.wrecked) n++;
  return n;
}

export function updatePolice(G, dt) {
  // Heat decays when no crime happened recently.
  G.heat = Math.max(0, G.heat - dt * (G.wanted > 0 ? 1.1 : 2.5));
  const newStars = starsFromHeat(G.heat);
  if (newStars !== G.wanted) G.wanted = newStars;
  const want = G.wanted === 0 ? 0 : Math.min(5, G.wanted + 1);
  if (policeCount(G) < want && G.rng.chance(0.03)) spawnPoliceCar(G);
  const p = G.player;
  const playerSpeed = p.onFoot ? p.speed : Math.abs(p.car ? p.car.speed : 0);
  for (const car of G.cars) {
    if (car.kind !== 'police' || car.wrecked) continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 1600) {
      // Teleport far cops back onto a road near the player.
      const np = randomRoadPoint(G.rng, G.city);
      car.x = np.x;
      car.y = np.y;
      car.speed = 200;
      continue;
    }
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const control = {
      throttle: d > 60 ? 1 : 0.4,
      brake: d < 40 ? 0.6 : 0,
      steer: Math.max(-1, Math.min(1, diff * 2.2)),
    };
    stepCar(G, car, dt, control);
    // Ram: contact with the player hurts and slows.
    if (d < 36) {
      if (p.onFoot) {
        damagePlayer(G, 16 * dt);
      } else if (p.car) {
        damageCar(G, p.car, 12 * dt);
        car.speed *= 0.92;
        if (G.rng.chance(0.05)) G.audio.crash();
      }
      // BUSTED fills when a cop is on top of a slow player.
      if (playerSpeed < 60) {
        G.busted = Math.min(100, G.busted + dt * 26);
      }
    }
  }
  // Busted meter drains when the player escapes the cops.
  const nearestCop = nearestPoliceDist(G);
  if (nearestCop > 260 || playerSpeed > 120) {
    G.busted = Math.max(0, G.busted - dt * 14);
  }
  if (G.busted >= 100) {
    G.state = 'busted';
    G.audio.busted();
    pushMessage(G, 'Dispatch', 'Suspect in custody.');
  }
  // Siren wails while wanted.
  G.audio.siren(G.wanted > 0 && G.state === 'playing', G.time);
  // Foot cops: spawn when wanted and the player is on foot and slow.
  if (G.wanted >= 2 && p.onFoot && G.cops.length < G.wanted && G.rng.chance(0.01)) {
    G.cops.push({ x: p.x + G.rng.range(-300, 300), y: p.y + G.rng.range(-300, 300), angle: 0, speed: 150 });
  }
  for (const cop of G.cops) {
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (d > 900) {
      cop.x = p.x + G.rng.range(-260, 260);
      cop.y = p.y + G.rng.range(-260, 260);
    } else if (d > 24) {
      cop.angle = Math.atan2(dy, dx);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (d < 30) damagePlayer(G, 8 * dt);
    }
  }
}

function nearestPoliceDist(G) {
  let best = Infinity;
  for (const car of G.cars) {
    if (car.kind !== 'police' || car.wrecked) continue;
    best = Math.min(best, Math.hypot(car.x - G.player.x, car.y - G.player.y));
  }
  for (const cop of G.cops) best = Math.min(best, Math.hypot(cop.x - G.player.x, cop.y - G.player.y));
  return best;
}

export function clearPolice(G) {
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  G.cops = [];
  G.heat = 0;
  G.wanted = 0;
  G.busted = 0;
}

export function drawPolice(ctx, G) {
  for (const car of G.cars) {
    if (car.kind !== 'police') continue;
    drawCar(ctx, car);
    // Flashing light bar.
    const on = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#2a6aff';
    ctx.beginPath();
    ctx.arc(car.x - Math.sin(car.angle) * 0, car.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of G.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1a2a4a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89a';
    ctx.beginPath();
    ctx.arc(3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
