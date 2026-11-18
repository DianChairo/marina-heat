// pedestrians.js — sidewalk walkers who stroll the city, panic and flee
// from gunfire and police chases, and sometimes drop cash when scared.
import { randomSidewalkPoint, resolveBuildings } from './city.js';

const SHIRT_COLORS = ['#e8a33a', '#3a8ad8', '#8a3ad8', '#3ad88a', '#e87a7a', '#d8d83a', '#7ad8d8', '#f0f0f0'];

export function spawnPed(G) {
  const p = randomSidewalkPoint(G.rng, G.city);
  const ped = {
    x: p.x, y: p.y,
    angle: G.rng.range(0, Math.PI * 2),
    speed: G.rng.range(28, 55),
    state: 'walk',
    color: G.rng.pick(SHIRT_COLORS),
    panic: 0,
    retarget: 0,
    dead: false,
  };
  G.peds.push(ped);
  return ped;
}

export function initPeds(G, count) {
  for (let i = 0; i < count; i++) spawnPed(G);
}

// Something loud happened at (x, y): nearby pedestrians panic.
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.panic = 1;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  let alive = 0;
  for (const ped of G.peds) if (!ped.dead) alive++;
  if (alive < 18 && G.rng.chance(0.03)) spawnPed(G);
  for (const ped of G.peds) {
    if (ped.dead) continue;
    ped.retarget -= dt;
    if (ped.state === 'flee') {
      ped.panic -= dt * 0.25;
      if (ped.panic <= 0) ped.state = 'walk';
      // Fleeing peds run from the player and from police.
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < 160) ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(ped.angle) * 130 * dt;
      ped.y += Math.sin(ped.angle) * 130 * dt;
    } else {
      if (ped.retarget <= 0) {
        ped.retarget = G.rng.range(2, 6);
        ped.angle = G.rng.range(0, Math.PI * 2);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    const fixed = resolveBuildings(G.city, ped.x, ped.y, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    ped.x = Math.max(240, Math.min(G.city.size - 20, ped.x));
    ped.y = Math.max(20, Math.min(G.city.size - 20, ped.y));
    // A speeding car hitting a pedestrian is a crime with consequences.
    for (const car of G.cars) {
      if (car.wrecked || Math.abs(car.speed) < 60) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 20) {
        ped.dead = true;
        G.stats.kills++;
        if (car.kind === 'player') {
          addHeat(G, 12);
          dropCash(G, ped.x, ped.y, G.rng.int(5, 25));
        }
        scarePeds(G, ped.x, ped.y, 220);
        break;
      }
    }
  }
  G.peds = G.peds.filter((ped) => !ped.dead || G.rng.chance(0.98));
}

export function dropCash(G, x, y, amount) {
  G.pickups.push({ x, y, amount, t: 0 });
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    pk.t += dt;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
      p.money += pk.amount;
      p.score += pk.amount;
      pk.t = 999;
      G.audio.cash();
    }
  }
  G.pickups = G.pickups.filter((pk) => pk.t < 25);
}

function addHeat(G, n) {
  // Defined in police.js; wired through G to avoid a circular import.
  if (typeof G.addHeat === 'function') G.addHeat(n);
}

export function drawPeds(ctx, G) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89a';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'flee') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -12);
    }
    ctx.restore();
  }
  // Cash pickups.
  for (const pk of G.pickups) {
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 7 + Math.sin(pk.t * 5) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + 3);
  }
}
