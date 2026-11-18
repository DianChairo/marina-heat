// shots.js — deterministic screenshot scenes: ?shot=<name>&seed=<n> builds a frozen-in-action state.
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { MARKER } from './missions.js';
export function isShotMode() { return new URLSearchParams(location.search).has('shot'); }
export function shotName() { return new URLSearchParams(location.search).get('shot') || ''; }
export function shotSeed() { const n = parseInt(new URLSearchParams(location.search).get('seed') || '7', 10); return Number.isFinite(n) ? n : 7; }
function addTraffic(S, x, y, a, color, dir) { const c = makeCar(x, y, a, color, 'traffic'); c.driver = 'npc'; c.dir = dir; c.vx = Math.cos(a) * 130; c.vy = Math.sin(a) * 130; S.cars.push(c); return c; }
function addCop(S, x, y, tx, ty) { const c = makeCar(x, y, Math.atan2(ty - y, tx - x), '#f4f6f8', 'cop'); c.driver = 'cop'; c.hp = 130; c.vx = Math.cos(c.a) * 210; c.vy = Math.sin(c.a) * 210; S.cars.push(c); return c; }
function crowd(S, cx, cy, n) { for (let i = 0; i < n; i++) { const p = makePed(cx + ((i * 53) % 170) - 85, cy + ((i * 37) % 120) - 60, S.rng); p.a = (i * 1.3) % 6.28; S.peds.push(p); } }
export function setupShot(S, name) {
  const p = S.player;
  S.mode = 'play';
  if (name === '1-cover.jpg') {
    S.golden = true;
    p.x = 600; p.y = 700; p.a = -0.5;
    addTraffic(S, 380, 879, 0, '#e63946', 0); addTraffic(S, 950, 879, 0, '#457b9d', 0);
    addTraffic(S, 1050, 831, Math.PI, '#f4a261', 2); addTraffic(S, 250, 831, Math.PI, '#2a9d8f', 2);
    addTraffic(S, 879, 300, Math.PI / 2, '#e9c46a', 1); addTraffic(S, 431, 1080, -Math.PI / 2, '#9b5de5', 3);
    crowd(S, 560, 790, 7); crowd(S, 760, 560, 4);
    S.objective = 'Go to the M marker downtown to work for Marisol.';
    S.phoneMsg('Marisol Vega', 'Welcome to Coral Marina. I have work for someone who can drive. Come see me downtown.');
    S.cash = 240; S.score = 15;
  } else if (name === '2-drive.jpg') {
    p.x = 900; p.y = 879;
    const car = makeCar(p.x, p.y, 0, '#e63946', 'player'); car.driver = 'player'; car.vx = 330; car.speed = 330;
    S.cars.push(car); p.car = car;
    addTraffic(S, 1350, 831, Math.PI, '#457b9d', 2); addTraffic(S, 560, 879, 0, '#f4a261', 0);
    addTraffic(S, 1279, 560, Math.PI / 2, '#2a9d8f', 1); addTraffic(S, 1231, 1180, -Math.PI / 2, '#9b5de5', 3);
    crowd(S, 1020, 960, 4);
    S.objective = 'Free roam — Marisol is waiting at the M marker.';
    S.cash = 690; S.score = 45;
  } else if (name === '3-chase.jpg') {
    p.x = 1400; p.y = 1679;
    const car = makeCar(p.x, p.y, 0, '#118ab2', 'player'); car.driver = 'player'; car.vx = 300; car.speed = 300; car.hp = 62;
    S.cars.push(car); p.car = car;
    addCop(S, 1040, 1679, p.x, p.y); addCop(S, 1100, 1631, p.x, p.y); addCop(S, 1180, 1560, p.x, p.y);
    addTraffic(S, 1980, 1631, Math.PI, '#e9c46a', 2);
    crowd(S, 1560, 1560, 3);
    S.wanted = 4; S.heat = 62; S.busted = 38; S.seenByCop = true;
    S.objective = 'Lose the heat — break line of sight to cool your stars.';
    S.phoneMsg('Marisol Vega', 'Four stars?! Ditch them in the alleys by the bay, NOW.');
    S.cash = 1250; S.score = 120;
  } else if (name === '4-mission.jpg') {
    p.x = 900; p.y = 1279;
    const car = makeCar(p.x, p.y, 0, '#06d6a0', 'player'); car.driver = 'player'; car.vx = 210; car.speed = 210;
    S.cars.push(car); p.car = car;
    const m = S.missions;
    m.active = { id: 'delivery', name: 'Special Delivery', pay: 600, respect: 40 };
    m.hasPackage = true; m.target = { x: 2855, y: 455 }; m.timer = 96;
    S.wanted = 2; S.heat = 30;
    addCop(S, 660, 1330, p.x, p.y);
    addTraffic(S, 1420, 1231, Math.PI, '#ef476f', 2);
    crowd(S, 980, 1180, 4);
    S.objective = 'Special Delivery — drop it at the garage · 1980m · 96s';
    S.phoneMsg('Marisol Vega', 'That is the package. North-east garage, and do not stop for anyone.');
    S.cash = 840; S.score = 85;
  }
  S.cam.x = p.x; S.cam.y = p.y;
}
export { MARKER };
