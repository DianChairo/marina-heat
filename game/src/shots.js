// shots.js — deterministic screenshot scenes for the entry's images.
// ?shot=cover|drive|chase|mission&seed=n seeds the RNG, then scripts the
// world into a fixed state: same seed, same picture. main.js sets
// window.__shotReady once the scene has rendered a few frames.
import { startMission } from './missions.js';
import { addHeat, spawnPoliceCar } from './police.js';
import { createCar } from './vehicles.js';
import { initTraffic, spawnTrafficCar } from './traffic.js';
import { initPeds } from './pedestrians.js';

export const SHOT_NAMES = ['cover', 'drive', 'chase', 'mission'];

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!SHOT_NAMES.includes(shot)) return null;
  const seedRaw = params.get('seed');
  const seed = seedRaw === null ? 7 : Number(seedRaw) || 7;
  return { shot, seed };
}

// Place the player on foot in the downtown core with traffic and crowds.
function sceneCover(G) {
  G.player.x = 1620;
  G.player.y = 1580;
  G.player.onFoot = true;
  G.player.car = null;
  G.player.angle = -0.6;
  G.camera.x = G.player.x - G.camera.w / 2;
  G.camera.y = G.player.y - G.camera.h / 2;
}

// Player behind the wheel on a main road, mid-drive.
function sceneDrive(G) {
  const car = createCar(1000, 1000, 0, '#d84a4a', 'player');
  car.speed = 240;
  car.driver = 'player';
  G.cars.push(car);
  G.player.onFoot = false;
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = 0;
  // A few cars ahead on the same road.
  for (let i = 0; i < 3; i++) {
    const c = createCar(1180 + i * 160, 1000 + (i % 2) * 8, 0, ['#4a7ad8', '#e8c33a', '#4ad88a'][i], 'traffic');
    c.speed = 130;
    G.cars.push(c);
  }
}

// Wanted level 3, police cars closing in on the player's car.
function sceneChase(G) {
  sceneDrive(G);
  addHeat(G, 55);
  const p = G.player;
  const spots = [
    { x: p.x - 260, y: p.y - 60, a: 0.2 },
    { x: p.x - 300, y: p.y + 90, a: -0.15 },
    { x: p.x + 180, y: p.y - 190, a: Math.PI * 0.75 },
    { x: p.x - 120, y: p.y + 220, a: -Math.PI * 0.6 },
  ];
  for (const s of spots) {
    const cop = createCar(s.x, s.y, s.a, '#1a2a4a', 'police');
    cop.speed = 300;
    G.cars.push(cop);
  }
  void spawnPoliceCar;
}

// Mission 1 (Bay Run) in progress: checkpoint rings visible ahead.
function sceneMission(G) {
  sceneDrive(G);
  G.player.car.x = 640;
  G.player.car.y = 640;
  G.player.car.angle = Math.PI / 2;
  G.player.x = 640;
  G.player.y = 640;
  startMission(G, 0);
  // Put the first checkpoint just ahead so the ring reads in-frame.
  G.mission.checkpoints[0] = { x: 640, y: 960, r: 46, hit: false };
}

export function applyShot(G, name) {
  G.shot = name;
  // A busy street in every shot: refill traffic and pedestrians near the player.
  initTraffic(G, 6);
  initPeds(G, 10);
  if (name === 'cover') sceneCover(G);
  else if (name === 'drive') sceneDrive(G);
  else if (name === 'chase') sceneChase(G);
  else if (name === 'mission') sceneMission(G);
  G.state = 'playing';
}
