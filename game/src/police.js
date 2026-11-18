// police.js — wanted stars, heat, busted meter, police spawn + chase/ram AI.
import { makeCar, updateCar } from './vehicles.js';
import { clamp, dist, angDiff } from './rng.js';
import { WORLD } from './city.js';
export function addCrime(S, amount, x, y) {
  // witnessed check is done by caller for location crimes; shots/theft pass seen=true via amount scaling
  S.heat = clamp(S.heat + amount, 0, 100);
  S.lastCrimeT = 0;
  S.stats.crimes++;
  while (S.heat >= 100 && S.wanted < 5) { S.wanted++; S.heat -= 100; if (S.wanted === 1) S.phoneMsg('LPD Scanner', 'Units responding — suspect spotted in Coral Marina.'); }
  if (S.wanted === 0 && S.heat > 12) S.wanted = 1;
}
export function witnessNear(S, x, y, radius = 330) {
  if (dist(S.player.x, S.player.y, x, y) > radius + 200) { /* crime at location */ }
  for (const p of S.peds) if (!p.dead && dist(p.x, p.y, x, y) < radius) return true;
  for (const c of S.cars) if (c.kind === 'cop' && dist(c.x, c.y, x, y) < radius + 120) return true;
  return S.wanted > 0;
}
export function updateWanted(S, dt) {
  S.lastCrimeT += dt;
  const p = S.player;
  let seen = false;
  for (const c of S.cars) if (c.kind === 'cop' && dist(c.x, c.y, p.x, p.y) < 430) seen = true;
  S.seenByCop = seen;
  if (seen) { S.unseenT = 0; } else S.unseenT += dt;
  // heat decays when calm and unseen; stars decay after a long clean stretch
  if (!seen && S.lastCrimeT > 4) S.heat = Math.max(0, S.heat - dt * 6);
  if (!seen && S.unseenT > 11 && S.wanted > 0) {
    S.wanted--; S.unseenT = 4; S.heat = Math.min(S.heat, 30);
    if (S.wanted === 0) { S.cops.length = 0; S.phoneMsg('Marisol Vega', 'Heat died down. Smooth work, keep it that way.'); }
  }
  // busted meter: boxed in while cops are in contact
  const speed = p.car ? Math.hypot(p.car.vx, p.car.vy) : Math.hypot(p.vx, p.vy);
  let contact = 0;
  for (const c of S.cars) if (c.kind === 'cop' && dist(c.x, c.y, p.x, p.y) < 64) contact++;
  if (S.wanted > 0 && contact > 0 && speed < 42) {
    S.busted = clamp(S.busted + dt * 26 * contact, 0, 100);
    if (S.busted >= 100 && S.mode === 'play') { S.mode = 'busted'; S.audio.sting(false); S.saveBest(); }
  } else S.busted = Math.max(0, S.busted - dt * 30);
  // spawn police at map edges near the player, scaled by stars
  const want = S.wanted === 0 ? 0 : 1 + S.wanted;
  const cops = S.cars.filter((c) => c.kind === 'cop');
  S.spawnT -= dt;
  if (cops.length < want && S.spawnT <= 0) {
    S.spawnT = 1.6;
    const a = S.rng.range(0, Math.PI * 2), d = 560;
    const x = clamp(p.x + Math.cos(a) * d, 40, WORLD - 40), y = clamp(p.y + Math.sin(a) * d, 40, 2900);
    const c = makeCar(x, y, Math.atan2(p.y - y, p.x - x), '#f4f6f8', 'cop');
    c.driver = 'cop'; c.hp = 130; c.cruise = 330;
    S.cars.push(c);
  }
  // despawn distant cops when wanted is gone handled above; far cops teleport-approach
  for (const c of cops) if (dist(c.x, c.y, p.x, p.y) > 1500 && S.wanted > 0) { c.x = clamp(p.x + (c.x > p.x ? 620 : -620), 40, WORLD - 40); c.y = clamp(p.y + (c.y > p.y ? 620 : -620), 40, 2900); }
  S.audio.siren(S.wanted > 0 && cops.length > 0 && S.mode === 'play');
}
export function updateCops(S, dt) {
  const p = S.player;
  for (const c of S.cars) {
    if (c.kind !== 'cop') continue;
    // target: player position, lead slightly by velocity
    const tvx = p.car ? p.car.vx : p.vx, tvy = p.car ? p.car.vy : p.vy;
    const tx = p.x + tvx * 0.35, ty = p.y + tvy * 0.35;
    const want = Math.atan2(ty - c.y, tx - c.x);
    const diff = angDiff(c.a, want);
    const d = dist(c.x, c.y, p.x, p.y);
    const ctrl = { up: true, down: false, left: diff < -0.07, right: diff > 0.07, hand: Math.abs(diff) > 1.9 };
    if (d < 46) { ctrl.up = false; ctrl.down = true; } // nose in, then ram again
    if (Math.abs(diff) > 2.4 && d > 120) { ctrl.up = false; ctrl.down = true; } // reverse to re-aim
    updateCar(S, c, ctrl, dt);
    // on-foot pursuit pressure: a cop car that stops near an on-foot player deals contact damage slowly
    if (!p.car && d < 40 && Math.hypot(c.vx, c.vy) > 50) { p.hp -= 30 * dt; p.hurtT = 1; }
  }
}
