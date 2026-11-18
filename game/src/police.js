// Wanted system + police chase AI. Stars 1-5, heat fills toward next star,
// stars decay out of sight, BUSTED meter fills in sustained police contact.
import { makeCar, stepCar, damageCar } from './vehicles.js';
import { clamp, angDiff } from './rng.js';
import { roadXs, roadYs, WORLD_W, WORLD_H } from './city.js';

export function makeWanted() {
  return { stars: 0, heat: 0, seenT: 0, hiddenT: 0, busted: 0, crimes: 0 };
}
const CRIME_HEAT = { shot: 0.34, theft: 1.05, crash: 0.3, pedHit: 1.15, carHit: 0.22, wreck: 0.5, policeHit: 0.8 };
export function reportCrime(W, kind, witnessed) {
  W.crimes++;
  if (!witnessed && W.stars === 0) return;
  W.heat += (CRIME_HEAT[kind] || 0.3) * (witnessed ? 1 : 0.25);
  while (W.heat >= 1 && W.stars < 5) { W.stars++; W.heat -= 1; }
  if (W.stars === 5) W.heat = Math.min(W.heat, 0.99);
  if (W.stars === 0 && W.heat > 0.55) { W.stars = 1; W.heat = 0.2; }
}
export function updateWanted(W, dt, seenByPolice) {
  if (seenByPolice) { W.seenT += dt; W.hiddenT = 0; }
  else if (W.stars > 0) {
    W.hiddenT += dt;
    if (W.hiddenT > 7) { // decay: drain heat, then drop stars
      W.heat -= dt * 0.12;
      if (W.heat <= 0) { W.stars--; W.heat = W.stars > 0 ? 0.85 : 0; W.hiddenT = 3; }
    }
  }
}
export function spawnPolice(rng, playerPos) {
  // spawn at a road edge position ~650px away
  const vertical = rng.chance(0.5);
  let x, y, ang;
  if (vertical) { const rx = rng.pick(roadXs); x = rx + 16; y = clamp(playerPos.y + (rng.chance(0.5) ? -650 : 650), 50, WORLD_H - 50); ang = y < playerPos.y ? Math.PI : 0; }
  else { const ry = rng.pick(roadYs); y = ry - 16; x = clamp(playerPos.x + (rng.chance(0.5) ? -650 : 650), 50, WORLD_W - 50); ang = x < playerPos.x ? Math.PI / 2 : -Math.PI / 2; }
  const c = makeCar(x, y, ang, '#eef2f5', 'police');
  c.hp = 160; c.driver = { ai: true }; c.ai = { cop: true };
  return c;
}
export function desiredCops(stars) { return [0, 2, 3, 4, 6, 8][stars] || 0; }
// Chase AI: steer at player's predicted position, ram. Returns contact info.
export function updatePoliceCar(c, dt, target, allCars) {
  if (c.wrecked) { stepCar(c, dt, 0, 0, false); return { contact: false, impact: 0 }; }
  const lead = 0.35;
  const tx = target.x + (target.vx || 0) * lead, ty = target.y + (target.vy || 0) * lead;
  const want = Math.atan2(tx - c.x, -(ty - c.y)); // heading convention: ang 0 = up (-y)
  const diff = angDiff(want, c.ang);
  const steer = clamp(diff * 2.2, -1, 1);
  const dist = Math.hypot(tx - c.x, ty - c.y);
  let throttle = 1;
  if (Math.abs(diff) > 2.4 && dist < 90) throttle = -0.8; // reverse out when facing away close up
  if (dist < 26) throttle = 0.4;
  // avoid piling into other cops a little
  for (const o of allCars) {
    if (o === c || o.kind !== 'police') continue;
    const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < 34) { c.x -= (dx / d) * 14 * dt; c.y -= (dy / d) * 14 * dt; }
  }
  const before = Math.abs(c.speed);
  const impact = stepCar(c, dt, throttle, steer, Math.abs(c.speed) > 200 && Math.abs(diff) > 0.5);
  if (impact > 60) damageCar(c, impact * 0.05);
  const contact = dist < 46;
  return { contact, impact: Math.max(0, before - Math.abs(c.speed)) };
}
