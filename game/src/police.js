// police.js — the wanted system and police AI.
// Crimes add "heat"; heat crossing a threshold adds a star (max 5). Police cars spawn
// at the city edge and hunt the player. Staying unseen decays stars; getting cornered
// fills the BUSTED meter instead of a health-style death.
import { clamp, dist, turnToward } from './rng.js';
import { vRoads, hRoads, GRID_W, GRID_H } from './city.js';
import { makeCar, integrateCar } from './vehicles.js';
import { makePed } from './pedestrians.js';

export function makeWanted() {
  return { stars: 0, heat: 0, busted: 0, unseenT: 0, spawnT: 0 };
}

// Witnesses matter: a crime nobody sees still counts, just for less.
export function reportCrime(G, points, x, y) {
  const w = G.wanted;
  let witnessed = false;
  for (const p of G.peds) if (!p.dead && dist(p.x, p.y, x, y) < 300) { witnessed = true; break; }
  if (!witnessed) for (const c of G.cars) if (c.kind === 'police' && dist(c.x, c.y, x, y) < 460) { witnessed = true; break; }
  w.heat += points * (witnessed ? 1 : 0.45);
  w.unseenT = 0;
  const need = () => (w.stars === 0 ? 26 : 100);
  while (w.heat >= need() && w.stars < 5) { w.heat -= need(); w.stars++; G.onStarUp(w.stars); }
  if (w.stars >= 5) w.heat = Math.min(w.heat, 99);
}

function spawnPolice(G) {
  // Enter from a road at the grid edge, as far from the player as practical.
  const edges = [
    { x: vRoads[0] + 17, y: 60, a: Math.PI / 2, axis: 'v', line: vRoads[0], dir: 1 },
    { x: vRoads[vRoads.length - 1] - 17, y: GRID_H - 60, a: -Math.PI / 2, axis: 'v', line: vRoads[vRoads.length - 1], dir: -1 },
    { x: 60, y: hRoads[0] + 17, a: 0, axis: 'h', line: hRoads[0], dir: 1 },
    { x: GRID_W - 60, y: hRoads[hRoads.length - 1] - 17, a: Math.PI, axis: 'h', line: hRoads[hRoads.length - 1], dir: -1 },
  ];
  let best = edges[0], bd = -1;
  for (const e of edges) { const d = dist(e.x, e.y, G.player.x, G.player.y); if (d > bd) { bd = d; best = e; } }
  const car = makeCar(best.x, best.y, best.a, '#f5f6fa', 'police');
  car.aiAxis = best.axis; car.aiLine = best.line; car.aiDir = best.dir; car.hp = 130;
  G.cars.push(car);
  return car;
}

export function nearestPoliceDist(G) {
  let d = 1e9;
  for (const c of G.cars) if (c.kind === 'police') d = Math.min(d, dist(c.x, c.y, G.player.x, G.player.y));
  for (const p of G.peds) if (p.cop && !p.dead) d = Math.min(d, dist(p.x, p.y, G.player.x, G.player.y));
  return d;
}

export function updatePolice(G, dt) {
  const w = G.wanted, P = G.player;
  const target = P.inCar || P;
  w.spawnT -= dt;
  const cops = G.cars.filter((c) => c.kind === 'police');
  const desired = w.stars === 0 ? 0 : Math.min(6, w.stars + 1);
  if (cops.length < desired && w.spawnT <= 0) { spawnPolice(G); w.spawnT = 2.2; }
  // Sight + star decay.
  const nd = nearestPoliceDist(G);
  if (nd < 440) w.unseenT = 0; else w.unseenT += dt;
  if (w.stars > 0 && w.unseenT > 11) {
    w.stars--; w.heat = 0; w.unseenT = 6;
    if (w.stars === 0) {
      G.showPhone('You lost them. Lay low and keep it that way. — M', 4);
      G.cars = G.cars.filter((c) => c.kind !== 'police' || c.occupied); // patrol gives up and leaves
      for (const p of G.peds) if (p.cop) p.cop = false;
    }
  }
  // Chase steering: aim at where the target is heading, ram when close.
  for (const car of cops) {
    if (car.occupied || car.wrecked) { car.aiSpeed = Math.max(0, car.aiSpeed - 240 * dt); integrateCar(car, dt); continue; }
    const lead = P.inCar ? 0.35 : 0.1;
    let tx = target.x + (target.vx || 0) * lead, ty = target.y + (target.vy || 0) * lead;
    // Each unit takes a different approach lane (behind / flank) so a pursuit boxes
    // the player in instead of stacking every car on the same point; close in, they ram true.
    const dPre = dist(car.x, car.y, target.x, target.y);
    if (dPre > 58) {
      const slot = (car.id % 3 - 1) * 0.9 + Math.PI; // mostly behind the target, spread out
      const back = Math.atan2(target.y - car.y, target.x - car.x);
      const a = back + slot * 0.4;
      tx += Math.cos(a) * 30; ty += Math.sin(a) * 30;
    }
    const want = Math.atan2(ty - car.y, tx - car.x);
    car.angle = turnToward(car.angle, want, (2.1 + w.stars * 0.12) * dt);
    const d = dist(car.x, car.y, target.x, target.y);
    const top = (P.inCar ? 318 : 205) + w.stars * 9;
    const desired2 = d < 60 && !P.inCar ? 60 : top; // don't plow an on-foot player at full speed; crowd them
    car.aiSpeed += clamp(desired2 - car.aiSpeed, -380 * dt, 215 * dt);
    integrateCar(car, dt);
    // Foot pursuit: one officer gets out when his car is close to an on-foot player.
    if (!P.inCar && d < 110 && !car.footSpawned) {
      car.footSpawned = true;
      const cop = makePed(G.rng, G.pick, car.x + 16, car.y + 10);
      cop.cop = true; cop.speed = 137; cop.shirt = '#274b8f';
      G.peds.push(cop);
    }
    if (P.inCar && d < car.r + P.inCar.r + 6 && Math.abs(car.aiSpeed) > 120 && car.ramCd <= 0) {
      car.ramCd = 0.7;
    }
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
  }
  // Cop peds chase the player; contact is what fills BUSTED on foot.
  for (const p of G.peds) {
    if (!p.cop || p.dead) continue;
    if (w.stars === 0) { p.cop = false; continue; }
    p.tx = P.x; p.ty = P.y; p.panicT = 0;
    if (!P.inCar && dist(p.x, p.y, P.x, P.y) < 17) w.busted += 46 * dt;
  }
  // BUSTED pressure: cornered on foot, or boxed in while barely moving in a car.
  if (w.stars > 0) {
    const pSpeed = P.inCar ? Math.hypot(P.inCar.vx, P.inCar.vy) : Math.hypot(P.vx, P.vy);
    const crowded = nd < (P.inCar ? 78 : 52);
    if (crowded && pSpeed < (P.inCar ? 34 : 60)) w.busted += (P.inCar ? 21 : 15) * dt * (1 + clamp(1 - nd / 130, 0, 1));
    else w.busted -= 13 * dt;
  } else w.busted -= 30 * dt;
  w.busted = clamp(w.busted, 0, 100);
  if (w.busted >= 100) G.onBusted();
  G.policeActive = w.stars > 0 && nd < 620;
}
