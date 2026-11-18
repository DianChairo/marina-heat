// police.js — the 1-5 star wanted system and the cops who enforce it.
// Heat rises with crime and decays when you lay low; at 1+ stars police
// cars spawn and chase/ram you. Get caught slow and the BUSTED meter fills.
import { createCar, drawCar } from './vehicles.js';
import { randomRoadPoint, collideBuildings } from './city.js';

export function addWanted(G, n) {
  G.wanted = Math.min(5, G.wanted + n);
  G.heat = Math.min(100, G.heat + 35 * n);
}

export function updateWanted(G, dt) {
  if (G.wanted > 0) {
    G.heat -= dt * 4.5; // laying low cools the heat
    if (G.heat <= 0) {
      G.heat = 0;
      G.wanted = Math.max(0, G.wanted - 1);
      if (G.wanted > 0) G.heat = 55;
    }
  }
  // Spawn cops to match the wanted level (max 1 + wanted).
  const wantCops = G.wanted === 0 ? 0 : 1 + G.wanted;
  const cops = G.cars.filter((c) => c.police && !c.wrecked);
  if (cops.length < wantCops) {
    const p = randomRoadPoint(G.city, G.rng);
    const dx = G.player.x - p.x; const dy = G.player.y - p.y;
    // spawn the cop a fair distance away, on a road
    const cop = createCar(p.x, p.y, Math.atan2(dy, dx), '#111827', true);
    cop.driver = 'cop';
    cop.cruise = 300;
    G.cars.push(cop);
    G.audio.setSiren(true);
  }
  if (G.wanted === 0 && cops.length === 0) G.audio.setSiren(false);
  // BUSTED: a cop sitting on top of a slow player fills the meter.
  const p = G.player;
  const pSpeed = p.onFoot ? (p.moving ? 200 : 0) : Math.abs(p.car ? p.car.speed : 0);
  let near = false;
  for (const cop of cops) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < 70 && pSpeed < 90) near = true;
  }
  if (near) {
    G.busted += dt * 0.55;
    if (G.busted >= 1) {
      G.mode = 'busted';
      G.audio.setEngine(false, 0);
      G.audio.setSiren(false);
      G.audio.busted();
    }
  } else {
    G.busted = Math.max(0, G.busted - dt * 0.4);
  }
}

export function updatePolice(G, dt) {
  for (const cop of G.cars) {
    if (cop.driver !== 'cop' || cop.wrecked) continue;
    const p = G.player;
    const dx = p.x - cop.x; const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3 * dt));
    const speed = dist > 320 ? 430 : 300;
    cop.speed += (speed - cop.speed) * 1.2 * dt;
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    // Cops drive around buildings, never through them.
    if (!collideBuildings(G.city, nx, cop.y, 20)) cop.x = nx;
    if (!collideBuildings(G.city, cop.x, ny, 20)) cop.y = ny;
    // Ram the player: damage on contact, harder at speed.
    if (dist < 42) {
      const ram = Math.abs(cop.speed);
      if (p.onFoot) {
        if (ram > 120) {
          p.x += (dx / dist) * 14; p.y += (dy / dist) * 14;
          damagePlayerDirect(G, 8);
        }
      } else if (p.car) {
        if (ram > 100) {
          p.car.speed *= 0.75;
          damageCarDirect(G, p.car, 4);
          G.audio.crash();
        }
      }
      // shove the cop off so it does not stick inside the player
      cop.x -= Math.cos(cop.angle) * 30 * dt * 10;
      cop.y -= Math.sin(cop.angle) * 30 * dt * 10;
    }
    // Cops despawn far away when the heat is gone.
    if (G.wanted === 0 && dist > 1600) cop.wrecked = true;
  }
  // prune wrecked cop cars so the list stays short
  G.cars = G.cars.filter((c) => !(c.police && c.wrecked && Math.hypot(c.x - G.player.x, c.y - G.player.y) > 900));
}

function damagePlayerDirect(G, amount) {
  const p = G.player;
  if (G.mode !== 'play') return;
  p.hp -= amount; p.hurtFlash = 0.3;
  if (p.hp <= 0) { p.hp = 0; G.mode = 'wasted'; G.audio.setEngine(false, 0); G.audio.setSiren(false); }
}

function damageCarDirect(G, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0 && !car.wrecked) {
    car.wrecked = true; car.speed = 0;
    G.audio.crash();
    if (car.driver === 'player') { G.player.onFoot = true; G.player.car = null; }
  }
}

export function drawPolice(ctx, G) {
  for (const car of G.cars) if (car.police) drawCar(ctx, car);
}
