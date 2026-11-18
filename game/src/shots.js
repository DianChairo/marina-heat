// shots.js — deterministic screenshot scenes for ?shot=<name>&seed=<n>.
// The game builds each scene itself from the URL: a seeded world, a
// scripted state (in a car, police chase, a mission running), then sets
// window.__shotReady once the scene has rendered a few frames so the
// screenshot driver can photograph it unedited.
import { startMission } from './missions.js';
import { enterCar, nearestCar } from './vehicles.js';
import { addWanted } from './police.js';

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: Number(q.get('seed') || 1337),
  };
}

export function applyShot(G, name) {
  const p = G.player;
  if (name === 'cover') {
    // On foot downtown: traffic and peds all around, plaza in view.
    p.x = 320 + 4 * 320 + 40; p.y = 320 + 4 * 320 + 90;
  } else if (name === 'drive') {
    // Behind the wheel on a long straight, traffic ahead.
    const car = nearestCar(G, 320 + 2 * 320, 320 + 5 * 320, 400) || G.cars[0];
    if (car) enterCar(G, car);
    p.x = 320 + 2 * 320; p.y = 320 + 5 * 320;
    if (p.car) { p.car.speed = 260; p.car.angle = Math.PI / 2; }
  } else if (name === 'chase') {
    // Three-star chase: two cop cars closing in on a speeding player car.
    const car = nearestCar(G, 320 + 3 * 320, 320 + 3 * 320, 500) || G.cars[0];
    if (car) enterCar(G, car);
    if (p.car) { p.car.speed = 330; p.car.angle = 0; }
    addWanted(G, 3);
    G.heat = 100;
    const cops = G.cars.filter((c) => c.police && !c.wrecked);
    for (let i = 0; i < Math.min(2, cops.length); i++) {
      const cop = cops[i];
      cop.x = p.x - 220 - i * 110; cop.y = p.y; cop.speed = 380;
    }
  } else if (name === 'mission') {
    // Mission 1 in progress: checkpoint ring visible ahead, timer running.
    startMission(G, 0);
    if (G.mission && G.mission.target) {
      p.x = G.mission.target.x - 260;
      p.y = G.mission.target.y + 120;
      p.angle = Math.atan2(G.mission.target.y - p.y, G.mission.target.x - p.x);
    }
  }
  G.mode = 'play';
}

export function armShotReady(G) {
  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames >= 45) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
