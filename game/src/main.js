// main.js — Marina Heat: game loop, camera, state machine and the
// wiring of every module (city, player, vehicles, traffic, pedestrians,
// police, combat, missions, HUD, minimap, audio, save).
//
// States: title -> playing <-> paused -> wasted / busted -> title.
// A ?shot= scene (see shots.js) renders one frozen frame instead.

import { makeRng, clamp, dist } from './rng.js';
import { City, WORLD, isWater } from './city.js';
import { Input } from './input.js';
import { loadSave, storeSave } from './storage.js';
import { SoundBank } from './audio.js';
import { Player } from './player.js';
import { spawnParkedCars } from './vehicles.js';
import { spawnTraffic } from './traffic.js';
import { spawnPeds } from './pedestrians.js';
import { WantedSystem, PoliceManager } from './police.js';
import { Combat, updateParticles, drawParticles } from './combat.js';
import { MissionManager } from './missions.js';
import { drawHUD, drawTitle, drawPause, drawEndScreen } from './hud.js';
import { drawMinimap } from './minimap.js';
import { parseShot, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VW = canvas.width;
const VH = canvas.height;

const shot = parseShot();
const seed = shot ? shot.seed : 20261118;

const world = {
  state: 'title',
  time: 0,
  frozen: false,
  seed,
  rng: makeRng(seed),
  city: null,
  player: null,
  cars: [],
  traffic: [],
  peds: [],
  police: [],
  particles: [],
  floaters: [],
  events: [],
  wanted: new WantedSystem(),
  policeMgr: new PoliceManager(),
  missions: new MissionManager(),
  combat: new Combat(),
  audio: new SoundBank(),
  save: loadSave(),
  cash: 250,
  chaos: 0,
  prompt: null,
  cam: { x: 0, y: 0 },
  shake: 0,
  muted: false,
  screenToWorld: null,
};

world.cash = world.save.cash;
world.city = new City(seed);
world.player = new Player(420, 470);
world.cars = spawnParkedCars(world.city, world.rng, 46);
world.traffic = spawnTraffic(world.rng, world.player, 15);
for (const tc of world.traffic) world.cars.push(tc.car);
world.peds = spawnPeds(world.rng, world.city, world.player, 30);

world.screenToWorld = (sx, sy) => ({
  x: world.cam.x + sx,
  y: world.cam.y + sy,
});

world.addChaos = (points, x, y) => {
  world.chaos += points;
  world.floaters.push({ x, y, text: `+${points}`, t: 0.9, color: '#ffd94d' });
};

const input = new Input(canvas);

function resetRun(freshSave) {
  if (freshSave) {
    world.save = { cash: 250, missionsDone: [], totalChaos: 0, timesWasted: 0, timesBusted: 0, fresh: true };
  }
  world.cash = world.save.cash;
  world.chaos = 0;
  world.wanted = new WantedSystem();
  world.policeMgr = new PoliceManager();
  world.missions = new MissionManager();
  world.combat = new Combat();
  world.police = [];
  world.particles = [];
  world.floaters = [];
  world.events = [];
  world.player = new Player(420, 470);
  world.cars = spawnParkedCars(world.city, world.rng, 46);
  world.traffic = spawnTraffic(world.rng, world.player, 15);
  for (const tc of world.traffic) world.cars.push(tc.car);
  world.peds = spawnPeds(world.rng, world.city, world.player, 30);
  world.state = 'playing';
  world.audio.ensure();
}

function persist() {
  world.save.cash = world.cash;
  world.save.totalChaos = Math.max(world.save.totalChaos, Math.floor(world.chaos));
  storeSave(world.save);
}

function nearestCar(x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of world.cars) {
    if (car.dead) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const player = world.player;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  car.driver = 'player';
  if (car.kind === 'traffic' || car.kind === 'parked') {
    const wasParked = car.kind === 'parked';
    car.kind = 'player';
    if (wasParked) {
      // Grand theft auto: witnesses mean heat.
      world.wanted.addHeat(26, world);
      world.addChaos(15, car.x, car.y);
    }
  }
  world.audio.door();
}

function exitCar() {
  const player = world.player;
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  car.driver = null;
  car.throttle = 0;
  car.steer = 0;
  car.handbrake = false;
  if (car.kind === 'player') car.kind = 'parked';
  // Step out beside the car, pushed clear of buildings.
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * -30, y: car.y + Math.sin(car.angle + Math.PI / 2) * -30 };
  const fixed = world.city.collideCircle(side.x, side.y, 14);
  player.x = fixed.x;
  player.y = fixed.y;
  player.vx = 0;
  player.vy = 0;
  world.audio.door();
  world.audio.setEngine(false);
}

function drivePlayerCar(dt) {
  const car = world.player.inCar;
  if (!car) return;
  const up = input.down('KeyW', 'ArrowUp');
  const down = input.down('KeyS', 'ArrowDown');
  const left = input.down('KeyA', 'ArrowLeft');
  const right = input.down('KeyD', 'ArrowRight');
  car.steer = (left ? -1 : 0) + (right ? 1 : 0);
  car.throttle = (up ? 1 : 0) + (down ? -1 : 0);
  car.brake = down && car.forwardSpeed() > 40;
  if (down && car.forwardSpeed() > 40) car.throttle = 0;
  car.handbrake = input.down('Space');
  const before = car.speed();
  car.physics(dt);
  const impact = car.collideCity(world.city);
  if (impact > 150) {
    world.audio.crash(Math.min(1, impact / 420));
    world.shake = Math.min(9, impact / 46);
    world.wanted.addHeat(4, world);
    world.addChaos(8, car.x, car.y);
  }
  // Car vs car / car vs ped collisions.
  handleCarCollisions(car, before);
  world.player.x = car.x;
  world.player.y = car.y;
  world.audio.setEngine(true, clamp(car.speed() / car.spec.topSpeed, 0, 1));
}

function handleCarCollisions(car, speedBefore) {
  for (const other of world.cars) {
    if (other === car) continue;
    const rr = (car.spec.w + other.spec.w) * 0.36;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < rr && d > 0.01) {
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      const push = (rr - d) / 2;
      other.x += nx * push;
      other.y += ny * push;
      car.x -= nx * push;
      car.y -= ny * push;
      const rel = Math.abs((car.vx - other.vx) * nx + (car.vy - other.vy) * ny);
      if (rel > 60) {
        other.damage(rel * 0.12);
        car.damage(rel * 0.07);
        world.audio.crash(Math.min(1, rel / 380));
        world.shake = Math.min(8, rel / 55);
        if (speedBefore > 120) {
          world.addChaos(18, other.x, other.y);
          world.wanted.addHeat(9, world);
          if (other.kind === 'police') world.wanted.addHeat(16, world);
        }
      }
      other.vx += nx * rel * 0.5;
      other.vy += ny * rel * 0.5;
    }
  }
  if (car.speed() > 95) {
    for (const ped of world.peds) {
      if (ped.dead) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 26) {
        ped.hurt();
        car.damage(3);
        world.audio.crash(0.5);
        world.addChaos(60, ped.x, ped.y);
        world.wanted.addHeat(38, world);
        world.events.push({ type: 'pedDown', x: ped.x, y: ped.y });
      }
    }
  }
}

// ---- Part 2: event reactions, the update step, rendering, boot. ----

function processEvents() {
  for (const ev of world.events) {
    if (ev.type === 'gunshot') {
      for (const ped of world.peds) ped.scare(ev.x, ev.y, 4);
    } else if (ev.type === 'pedDown') {
      for (const ped of world.peds) ped.scare(ev.x, ev.y, 5);
    } else if (ev.type === 'explosion') {
      world.shake = 11;
      world.audio.crash(1);
      for (const ped of world.peds) ped.scare(ev.x, ev.y, 6);
      for (let i = 0; i < 16; i++) {
        world.particles.push({
          x: ev.x, y: ev.y,
          vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
          life: 0.7, maxLife: 0.7, size: 7,
          color: '255,130,40', kind: 'fire',
        });
      }
    } else if (ev.type === 'honk') {
      if (dist(ev.x, ev.y, world.player.pos.x, world.player.pos.y) < 300) {
        world.audio.tone(340, 0.14, 'square', 0.05);
      }
    }
  }
  world.events.length = 0;
}

function update(dt) {
  world.time += dt;
  const player = world.player;

  // Global keys.
  if (input.wasPressed('KeyM')) {
    world.muted = !world.muted;
    world.audio.setMuted(world.muted);
  }

  if (world.state === 'title') {
    if (input.wasPressed('Enter')) resetRun(false);
    else if (input.wasPressed('KeyN')) resetRun(true);
    updateCamera(dt);
    return;
  }
  if (world.state === 'wasted' || world.state === 'busted') {
    if (input.wasPressed('Enter')) {
      world.state = 'title';
    }
    return;
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    world.state = world.state === 'paused' ? 'playing' : 'paused';
    if (world.state === 'paused') {
      world.audio.setEngine(false);
      world.audio.setSiren(false);
    }
    return;
  }
  if (world.state === 'paused') return;
  if (world.frozen) return;

  // Mission accept.
  if (input.wasPressed('KeyF') && world.missions.pendingOffer && !world.missions.active) {
    const def = world.missions.pendingOffer;
    world.missions.pendingOffer = null;
    world.missions.messageQueue.length = 0;
    world.missions.begin(world, def);
  }

  // Enter / exit cars.
  world.prompt = null;
  if (player.inCar) {
    if (input.wasPressed('KeyE')) exitCar();
  } else {
    const car = nearestCar(player.x, player.y, 46);
    if (car) {
      world.prompt = car.kind === 'mission' ? 'E — take the package car' : 'E — steal car';
      if (input.wasPressed('KeyE')) enterCar(car);
    }
  }

  // Player + driving.
  const aimWorld = world.screenToWorld(input.mouse.x, input.mouse.y);
  if (player.inCar) drivePlayerCar(dt);
  else player.update(dt, input, world.city, aimWorld);

  // World systems.
  for (const tc of world.traffic) tc.update(dt, world);
  for (const ped of world.peds) ped.update(dt, world);
  world.combat.update(dt, world, input);
  world.wanted.update(dt, world);
  world.policeMgr.update(dt, world);
  world.missions.update(dt, world);
  processEvents();
  updateParticles(world, dt);

  // Keep the sidewalk population topped up near the player.
  if (world.peds.filter((p) => !p.dead).length < 16 && Math.random() < dt * 0.7) {
    const fresh = spawnPeds(world.rng, world.city, player.pos, 3, 420, 760);
    world.peds.push(...fresh);
  }
  world.peds = world.peds.filter((p) => dist(p.x, p.y, player.pos.x, player.pos.y) < 1500);

  // Floaters.
  for (const f of world.floaters) {
    f.t -= dt;
    f.y -= dt * 34;
  }
  world.floaters = world.floaters.filter((f) => f.t > 0);

  // Slow health regen when calm and un-wanted.
  if (world.wanted.stars === 0 && !player.inCar) player.heal(dt * 1.6);

  // Siren follows the nearest cruiser.
  world.audio.setSiren(world.police.length > 0 && world.wanted.stars > 0, dt);

  // End states.
  if (player.dead || player.health <= 0) {
    world.state = 'wasted';
    world.save.timesWasted++;
    world.cash = Math.max(50, Math.floor(world.cash * 0.85));
    persist();
    world.audio.setEngine(false);
    world.audio.setSiren(false);
    world.audio.fail();
  } else if (world.wanted.busted >= 1) {
    world.state = 'busted';
    world.save.timesBusted++;
    world.cash = Math.max(50, Math.floor(world.cash * 0.8));
    persist();
    world.audio.setEngine(false);
    world.audio.setSiren(false);
    world.audio.fail();
  }

  world.shake *= Math.pow(0.001, dt);
  updateCamera(dt);
}

function updateCamera(dt) {
  const p = world.player.pos;
  const look = world.player.inCar ? clamp(world.player.inCar.speed() / 900, 0, 0.3) : 0;
  const tx = clamp(p.x + (world.player.inCar ? world.player.inCar.vx * look : 0) - VW / 2, 0, Math.max(0, WORLD - VW));
  const ty = clamp(p.y + (world.player.inCar ? world.player.inCar.vy * look : 0) - VH / 2, 0, Math.max(0, WORLD - VH));
  const k = world.frozen ? 1 : Math.min(1, dt * 6 + 0.2);
  world.cam.x += (tx - world.cam.x) * k;
  world.cam.y += (ty - world.cam.y) * k;
  if (world.frozen) {
    world.cam.x = tx;
    world.cam.y = ty;
  }
}

function render() {
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(0, 0, VW, VH);
  const shX = world.shake > 0.2 ? (Math.random() - 0.5) * world.shake : 0;
  const shY = world.shake > 0.2 ? (Math.random() - 0.5) * world.shake : 0;
  ctx.save();
  ctx.translate(-Math.round(world.cam.x + shX), -Math.round(world.cam.y + shY));

  world.city.draw(ctx, world.cam, VW, VH, world.time);
  world.missions.drawMarkers(ctx, world);

  // Cars sorted so the player's ride draws last among vehicles.
  const sorted = [...world.cars].sort((a, b) => (a === world.player.inCar ? 1 : 0) - (b === world.player.inCar ? 1 : 0));
  for (const car of sorted) car.draw(ctx, world.particles);
  for (const ped of world.peds) ped.draw(ctx);
  drawParticles(ctx, world);
  world.player.draw(ctx);
  world.combat.draw(ctx);
  world.combat.drawMuzzle(ctx, world.player);

  // Chaos floaters.
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.fillStyle = f.color;
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();

  // Screen-space overlays.
  if (world.state === 'title') {
    drawTitle(ctx, world, VW, VH);
  } else {
    drawHUD(ctx, world, VW, VH);
    drawMinimap(ctx, world, VW, VH);
    if (world.state === 'paused') drawPause(ctx, VW, VH);
    if (world.state === 'wasted') drawEndScreen(ctx, 'wasted', world, VW, VH);
    if (world.state === 'busted') drawEndScreen(ctx, 'busted', world, VW, VH);
  }
  if (world.muted) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('MUTED (M)', 16, 24);
  }
}

let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  if (!world.frozen) update(dt);
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// Boot: shot mode poses a frozen scene; otherwise the title screen runs
// over a live (but idle) view of the city.
if (shot) {
  world.save = { cash: 640, missionsDone: [], totalChaos: 0, timesWasted: 0, timesBusted: 0, fresh: false };
  world.cash = 640;
  applyShot(world, shot.name);
  updateCamera(1);
  render();
  // Render twice so fonts/gradients settle before the capture.
  requestAnimationFrame(() => {
    render();
    window.__shotReady = true;
  });
} else {
  updateCamera(1);
  requestAnimationFrame(frame);
}

export { world };
