// Deterministic screenshot scenes: ?shot=<name>&seed=<n> arranges a frozen-in-action
// state, main runs fixed sim ticks, then window.__shotReady = true.
import { makeCar, CAR_COLORS } from './vehicles.js';
import { spawnPolice } from './police.js';
import { makePed } from './pedestrians.js';
import { MARKER, MISSIONS } from './missions.js';

export function setupShot(G, name, seed) {
  const rng = G.rng;
  const P = G.player;
  G.state = 'playing';
  G.golden = true;
  if (name === '1-cover.jpg' || name === 'cover') {
    P.x = 470; P.y = 470; P.car = null; P.ang = 0.6;
    // busy street: traffic near intersection
    for (let i = 0; i < 5; i++) {
      const c = makeCar(330 + i * 55, 296 + (i % 2) * 34, Math.PI / 2, CAR_COLORS[i % CAR_COLORS.length], 'traffic');
      c.ai = { dir: 1, vertical: false, targetSpeed: 130, turnCooldown: 2, stuck: 0 }; c.driver = { ai: true }; c.speed = 90;
      G.cars.push(c);
    }
    for (let i = 0; i < 7; i++) G.peds.push(makePed(400 + rng.range(-130, 160), 380 + rng.range(-90, 130), rng));
    G.mission.offered = true;
    G.objectiveOverride = { text: 'Meet Marisol at the M marker', target: { x: MARKER.x, y: MARKER.y }, dist: Math.round(Math.hypot(P.x - MARKER.x, P.y - MARKER.y)), time: null };
    G.pushPhone('Marisol Vega', 'You made it to Coral Marina. Come see me at the M marker downtown — first job pays cash.', 999);
  } else if (name === '2-drive.jpg' || name === 'drive') {
    const car = makeCar(596, 570, Math.PI / 2 + 0.12, '#e74c3c', 'player');
    car.speed = 285; car.vx = 270; car.vy = 20; car.driver = { player: true };
    G.cars.push(car); P.car = car; P.x = car.x; P.y = car.y;
    for (let i = 0; i < 4; i++) {
      const c = makeCar(500 + i * 130, 630 - (i % 2) * 60, i % 2 ? -Math.PI / 2 : Math.PI / 2, CAR_COLORS[(i + 3) % CAR_COLORS.length], 'traffic');
      c.ai = { dir: 1, vertical: false, targetSpeed: 120, turnCooldown: 2, stuck: 0 }; c.driver = { ai: true }; c.speed = 80;
      G.cars.push(c);
    }
    for (let i = 0; i < 4; i++) G.peds.push(makePed(520 + rng.range(0, 220), 500 + rng.range(0, 60), rng));
  } else if (name === '3-chase.jpg' || name === 'chase') {
    const car = makeCar(880, 850, Math.PI / 2, '#f1c40f', 'player');
    car.speed = 250; car.vx = 240; car.vy = 10; car.driver = { player: true }; car.hp = 62;
    G.cars.push(car); P.car = car; P.x = car.x; P.y = car.y;
    const spots = [[870, 968], [838, 1042], [872, 1116]]; // on the vertical road behind the player
    for (const [sx, sy] of spots) { const pc = spawnPolice(rng, { x: sx, y: sy }); pc.x = sx; pc.y = sy; pc.ang = 0; pc.speed = 230; G.cars.push(pc); }
    G.wanted.stars = 4; G.wanted.heat = 0.55; G.wanted.busted = 0.45;
    for (let i = 0; i < 3; i++) G.peds.push(makePed(820 + rng.range(0, 160), 780 + rng.range(0, 60), rng));
  } else if (name === '4-mission.jpg' || name === 'mission') {
    const car = makeCar(1200, 596, Math.PI / 2, '#2ecc71', 'player');
    car.speed = 180; car.vx = 175; car.vy = 5; car.driver = { player: true };
    G.cars.push(car); P.car = car; P.x = car.x; P.y = car.y; P.carrying = true;
    const M = G.mission;
    M.active = { def: MISSIONS[1], id: 'delivery' }; M.stage = 1; M.t = 64;
    M.target = { x: 260, y: G.world.h - 300, kind: 'dropoff' };
    G.wanted.stars = 2; G.wanted.heat = 0.3;
    const pc = spawnPolice(rng, { x: 1050, y: 564 }); pc.x = 1050; pc.y = 564; pc.ang = Math.PI / 2; G.cars.push(pc);
    const pc2 = spawnPolice(rng, { x: 1420, y: 564 }); pc2.x = 1420; pc2.y = 564; pc2.ang = -Math.PI / 2; G.cars.push(pc2);
    for (let i = 0; i < 3; i++) {
      const c = makeCar(1000 + i * 170, 564, -Math.PI / 2, CAR_COLORS[(i + 5) % CAR_COLORS.length], 'traffic');
      c.ai = { dir: -1, vertical: false, targetSpeed: 120, turnCooldown: 2, stuck: 0 }; c.driver = { ai: true }; c.speed = 70;
      G.cars.push(c);
    }
    G.pushPhone('Marisol Vega', 'Got it. Now the drop — southwest warehouse. Cops will smell it.', 999);
  }
}
