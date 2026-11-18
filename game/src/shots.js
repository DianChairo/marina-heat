// shots.js — deterministic screenshot scenes. With ?shot=<name>&seed=<n>, main.js
// builds the world from the seed, calls setupShot to stage a frozen-in-action moment,
// runs a fixed number of ticks, then flags window.__shotReady for the driver.
import { makeCar } from './vehicles.js';
import { makeTrafficCar } from './traffic.js';
import { startMission } from './missions.js';

function stageTraffic(G, specs) {
  // Reposition existing traffic cars onto scripted spots so streets look alive.
  let i = 0;
  for (const c of G.cars) {
    if (c.kind !== 'traffic' || i >= specs.length) continue;
    const s = specs[i++];
    c.x = s.x; c.y = s.y; c.angle = s.a; c.aiSpeed = s.v || 90;
    c.aiAxis = Math.abs(Math.sin(s.a)) > 0.5 ? 'v' : 'h';
    c.aiDir = c.aiAxis === 'v' ? Math.sign(Math.sin(s.a)) || 1 : Math.sign(Math.cos(s.a)) || 1;
    c.aiLine = c.aiAxis === 'v' ? Math.round((c.x - (c.aiDir * 17) - 48) / 320) * 320 + 48 : Math.round((c.y - (c.aiDir * 17) - 48) / 320) * 320 + 48;
  }
}
function stagePeds(G, spots) {
  let i = 0;
  for (const p of G.peds) {
    if (i >= spots.length) break;
    p.x = spots[i][0]; p.y = spots[i][1]; p.tx = p.x + 30; p.ty = p.y + 10; i++;
  }
}
function policeCar(G, x, y, a, v) {
  const c = makeCar(x, y, a, '#f5f6fa', 'police');
  c.hp = 130; c.aiSpeed = v; c.footSpawned = true;
  G.cars.push(c);
  return c;
}

export function setupShot(G, name) {
  const P = G.player;
  if (name === '1-cover.jpg') {
    G.golden = true;
    P.x = 706; P.y = 786; P.angle = -0.7;
    G.cam.x = P.x; G.cam.y = P.y;
    stageTraffic(G, [
      { x: 705, y: 520, a: Math.PI / 2, v: 95 }, { x: 671, y: 980, a: -Math.PI / 2, v: 85 },
      { x: 480, y: 385, a: 0, v: 100 }, { x: 900, y: 351, a: Math.PI, v: 80 },
    ]);
    stagePeds(G, [[742, 770], [668, 830], [760, 690], [640, 720], [820, 800]]);
    G.showPhone('Welcome to Coral Marina, kid. I am Marisol Vega — I fix problems. The M on your map is my board. Come earn. — M', 999);
  } else if (name === '2-drive.jpg') {
    const car = makeCar(800, 385, 0, '#e74c3c', 'traffic');
    car.driver = false; G.cars.push(car);
    G.enterCar(car, true);
    car.vx = 322; car.vy = 0; car.speed = 322;
    G.cam.x = car.x; G.cam.y = car.y;
    stageTraffic(G, [
      { x: 1420, y: 351, a: Math.PI, v: 90 },
      { x: 1025, y: 200, a: Math.PI / 2, v: 95 }, { x: 991, y: 600, a: -Math.PI / 2, v: 85 },
    ]);
    stagePeds(G, [[930, 430], [1100, 300]]);
    return 16; // caught mid-intersection, still at speed
  } else if (name === '3-chase.jpg') {
    const car = makeCar(1008, 1025, 0, '#3498db', 'traffic');
    car.driver = false; G.cars.push(car);
    G.enterCar(car, true);
    car.vx = 250; car.vy = 0; car.speed = 250; car.hp = 58;
    G.wanted.stars = 4; G.wanted.heat = 45; G.wanted.busted = 55; G.peakStars = 4;
    policeCar(G, 845, 950, 0.5, 208);
    policeCar(G, 815, 1105, -0.4, 200);
    policeCar(G, 905, 1160, -0.95, 188);
    G.cam.x = car.x; G.cam.y = car.y;
    G.showPhone('Four stars?! Whatever you did, UNdo it — lose them before they box you in! — M', 999);
    return 24;
  } else if (name === '4-mission.jpg') {
    G.mission.nextIdx = 1; // Special Delivery
    startMission(G);
    const m = G.mission;
    m.phase = 'dropoff'; m.carrying = true; m.target = { x: 1968, y: 368 }; m.label = 'Deliver to the beach club'; m.timer = 74;
    const car = makeCar(1150, 1345, -0.35, '#f1c40f', 'traffic');
    car.driver = false; G.cars.push(car);
    G.enterCar(car, true);
    car.vx = 178; car.vy = -65; car.speed = 190;
    G.wanted.stars = 2; G.wanted.heat = 30; G.peakStars = 2;
    // Keep the delivery route clear of wandering peds so the staged run stays clean.
    for (const p of G.peds) {
      if (Math.hypot(p.x - car.x, p.y - car.y) < 300) { p.x = 240; p.y = 240 + (p.id % 6) * 60; p.tx = p.x + 40; p.ty = p.y; }
    }
    policeCar(G, 880, 1500, -0.5, 140);
    G.cam.x = car.x; G.cam.y = car.y;
    G.phone.t = 0; // keep the objective banner the star of this frame
    return 12;
  }
  return 40; // ticks of 1/30s for main.js to simulate before flagging ready
}
