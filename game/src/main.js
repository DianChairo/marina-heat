// Marina Heat — boot, game loop, state machine. Coral Marina open-world crime game.
import { makeRng, clamp } from './rng.js';
import { buildCity, drawCity, WORLD_W, WORLD_H, isRoad } from './city.js';
import { initInput, keys, mouse, justPressed, endFrameInput } from './input.js';
import { initAudio, updateAudio, toggleMute, sfx } from './audio.js';
import { loadSave, storeSave, defaultSave } from './storage.js';
import { makePlayer, updatePlayer, hurtPlayer, drawPlayer } from './player.js';
import { makeCar, stepCar, drawCar, damageCar, carsOverlap, CAR_COLORS, speedKmh } from './vehicles.js';
import { updateTrafficCar, maintainTraffic } from './traffic.js';
import { makePed, spawnPed, updatePed, drawPed } from './pedestrians.js';
import { makeWanted, reportCrime, updateWanted, spawnPolice, desiredCops, updatePoliceCar } from './police.js';
import { makeCombat, shoot, updateCombat, drawCombat, spawnParticles } from './combat.js';
import { makeMissionState, pushPhone, startIntro, nearMarker, offerMission, beginMission, missionObjective, updateMission, addChaos, drawMarker, drawMissionTarget, MARKER } from './missions.js';
import { drawHUD } from './hud.js';
import { setupShot } from './shots.js';
import { parkSpots } from './city.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let vw = 0, vh = 0;
function resize() { vw = canvas.width = innerWidth; vh = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const rng = makeRng(seed * 1000 + 42);

const save = loadSave() || defaultSave();
const hadSave = !!loadSave();
buildCity(seed);
const player = makePlayer(MARKER.x + 90, MARKER.y + 80);
const G = {
  state: shotName ? 'playing' : 'menu', golden: true, time: 0, runTime: 0,
  player, cars: [], peds: [], wanted: makeWanted(), combat: makeCombat(),
  mission: makeMissionState(), save, rng, cam: { x: player.x, y: player.y },
  shake: 0, prompt: null, objectiveOverride: null, missionTarget: null,
  pushPhone: (f, t, d) => pushPhone(G.mission, f, t, d),
  world: { w: WORLD_W, h: WORLD_H }, speedKmh: 0, started: false,
};
G.playerPos = { x: player.x, y: player.y, ang: 0 };
// parked cars
for (const s of parkSpots) {
  if (rng.chance(0.55)) { const c = makeCar(s.x, s.y, s.ang + (rng.chance(0.5) ? 0 : Math.PI), rng.pick(CAR_COLORS), 'parked'); c.parked = true; G.cars.push(c); }
}
for (let i = 0; i < 16; i++) { const p = spawnPed(rng, player.x, player.y); if (p) G.peds.push(p); }

function playerPos() { return player.car ? { x: player.car.x, y: player.car.y, vx: player.car.vx, vy: player.car.vy } : { x: player.x, y: player.y, vx: player.vx, vy: player.vy }; }
function witnessed(x, y, r = 300) {
  for (const p of G.peds) if (!p.dead && Math.hypot(p.x - x, p.y - y) < r) return true;
  for (const c of G.cars) if (c.kind === 'police' && Math.hypot(c.x - x, c.y - y) < 520) return true;
  return false;
}
function crime(kind, x, y, heatScale = 1) {
  const w = witnessed(x, y);
  const before = G.wanted.stars;
  reportCrime(G.wanted, kind, w);
  if (G.mission.active && G.mission.active.id === 'delivery' && G.mission.stage === 1 && G.wanted.stars === before) {
    // carrying adds heat slowly handled in update
  }
  if (kind === 'wreck') addChaos(G.mission, 120);
  if (kind === 'pedHit') addChaos(G.mission, 90);
  if (kind === 'crash' || kind === 'carHit') addChaos(G.mission, 25);
}
let audioStarted = false;
function startRun() {
  G.state = 'playing'; G.started = true;
  if (!audioStarted) { initAudio(); audioStarted = true; }
  if (!G.introDone) { startIntro(G.mission); G.introDone = true; }
}
function endRun(kind) {
  G.state = kind; // 'wasted' | 'busted'
  save.missionsDone = Math.max(save.missionsDone, G.mission.done);
  storeSave(save);
  sfx('sting');
}
function restart() {
  player.hp = 100; player.dead = false; player.car = null; player.carrying = false;
  player.x = MARKER.x + 90; player.y = MARKER.y + 80;
  G.wanted = makeWanted(); G.mission.active = null; G.mission.offered = false;
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  for (const c of G.cars) if (c.playerDriven) { c.playerDriven = false; c.kind = 'parked'; }
  G.runTime = 0; G.state = 'playing';
}

function nearestCar(x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
  return best;
}
function enterCar(c) {
  sfx('door');
  if (c.driver && c.kind === 'traffic') {
    // driver yanked out, flees
    const p = makePed(c.x + 18, c.y + 10, rng); p.panic = 3; p.state = 'flee'; G.peds.push(p);
    crime('theft', c.x, c.y);
  } else if (c.kind === 'parked') {
    if (witnessed(c.x, c.y, 200)) crime('theft', c.x, c.y);
  }
  c.driver = { player: true }; c.playerDriven = true; c.parked = false;
  player.car = c;
}
function exitCar() {
  const c = player.car; if (!c) return;
  sfx('door');
  player.x = c.x + Math.cos(c.ang) * -20 - Math.sin(c.ang) * 0; player.y = c.y + Math.sin(c.ang) * -20;
  player.x = c.x - Math.cos(c.ang + Math.PI / 2) * 22; player.y = c.y - Math.sin(c.ang + Math.PI / 2) * 22;
  c.driver = null; c.playerDriven = false; if (Math.abs(c.speed) < 5) { c.kind = 'parked'; c.parked = true; }
  player.car = null;
}

function update(dt) {
  G.time += dt;
  if (G.state !== 'playing') return;
  G.runTime += dt;
  const pp = playerPos();
  // --- player / driving
  let danger = null;
  if (player.car) {
    const c = player.car;
    const th = (keys.KeyW || keys.ArrowUp) ? 1 : (keys.KeyS || keys.ArrowDown) ? -1 : 0;
    const st = (keys.KeyA || keys.ArrowLeft) ? -1 : (keys.KeyD || keys.ArrowRight) ? 1 : 0;
    const hb = !!keys.Space;
    const impact = stepCar(c, dt, th, st, hb);
    player.x = c.x; player.y = c.y;
    if (performance.now() - player.lastHurtT > 4000) player.hp = Math.min(100, player.hp + 3 * dt);
    if (impact > 120) {
      damageCar(c, impact * 0.14); hurtPlayer(player, impact * 0.05); G.shake = Math.min(14, impact * 0.05);
      sfx('crash', { force: impact / 300 }); crime('crash', c.x, c.y); spawnParticles(G.combat, c.x, c.y, 8, '#cccccc', 130);
      if (c.hp <= 0) addChaos(G.mission, 60);
    }
    danger = { x: c.x, y: c.y, r: Math.abs(c.speed) > 130 ? 130 : 60 };
    G.speedKmh = speedKmh(c);
  } else {
    const aimX = G.cam.x + mouse.x - vw / 2 + player.x - (player.x - G.cam.x), aimWorldX = player.x + (mouse.x - vw / 2), aimWorldY = player.y + (mouse.y - vh / 2);
    updatePlayer(player, dt, aimWorldX, aimWorldY);
    danger = { x: player.x, y: player.y, r: 40 };
    G.speedKmh = 0;
    // shooting
    if (mouse.down && G.combat.fireT <= 0) {
      G.combat.fireT = 0.16;
      shoot(G.combat, player.x, player.y, player.ang, G.cars, G.peds, (k, x, y) => crime(k, x, y));
      for (const p of G.peds) if (!p.dead && Math.hypot(p.x - player.x, p.y - player.y) < 190) p.panic = 2.5;
    }
  }
  // --- car interactions
  G.prompt = null;
  if (!player.car) {
    const c = nearestCar(player.x, player.y, 54);
    if (c && !c.wrecked) { G.prompt = c.driver ? 'E — steal car' : 'E — get in car'; if (justPressed('KeyE')) enterCar(c); }
    else if (nearMarker(player)) {
      if (!G.mission.active && !G.mission.offered) offerMission(G.mission);
      if (G.mission.offered && !G.mission.active) { G.prompt = 'E — start: ' + G.mission.phone.length; G.prompt = 'E — start mission'; if (justPressed('KeyE')) { beginMission(G.mission, rng, G.world); sfx('sting'); } }
    }
  } else if (justPressed('KeyE')) exitCar();
  // --- traffic
  maintainTraffic(G.cars, rng, pp, 11);
  for (const c of G.cars) {
    if (c.kind === 'traffic' && !c.playerDriven) updateTrafficCar(c, dt, G.cars, player.car ? null : { x: player.x, y: player.y }, rng, () => {}); // traffic's own fender-benders are not the player's crimes
  }
  // --- car-car collisions
  for (let i = 0; i < G.cars.length; i++) for (let j = i + 1; j < G.cars.length; j++) {
    const a = G.cars[i], b = G.cars[j];
    if (!carsOverlap(a, b)) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const push = (44 - d) / 2;
    a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push;
    const rel = Math.hypot(a.vx - b.vx, a.vy - b.vy);
    if (rel > 70) {
      damageCar(a, rel * 0.09); damageCar(b, rel * 0.09);
      const tvx = a.vx; a.vx = b.vx * 0.6; b.vx = tvx * 0.6; const tvy = a.vy; a.vy = b.vy * 0.6; b.vy = tvy * 0.6;
      if (a.playerDriven || b.playerDriven) {
        G.shake = Math.min(12, rel * 0.05); sfx('crash', { force: rel / 260 });
        crime(b.kind === 'police' ? 'policeHit' : 'carHit', pp.x, pp.y);
        hurtPlayer(player, rel * 0.02);
        spawnParticles(G.combat, (a.x + b.x) / 2, (a.y + b.y) / 2, 7, '#ffd76a', 140);
        if (b.wrecked || a.wrecked) addChaos(G.mission, 40);
      }
    }
  }
  // --- car-ped collisions
  for (const c of G.cars) {
    if (Math.abs(c.speed) < 45 && Math.hypot(c.vx, c.vy) < 45) continue;
    for (const p of G.peds) {
      if (p.dead) continue;
      if (Math.hypot(p.x - c.x, p.y - c.y) < 21) {
        p.dead = true; spawnParticles(G.combat, p.x, p.y, 9, '#c0392b', 120);
        if (c.playerDriven) { crime('pedHit', p.x, p.y); G.shake = 6; sfx('crash', { force: 0.4 }); hurtPlayer(player, 2); }
      }
    }
  }
  // near misses for rampage
  if (player.car && Math.abs(player.car.speed) > 210) {
    for (const c of G.cars) {
      if (c.kind !== 'traffic') continue;
      const d = Math.hypot(c.x - player.car.x, c.y - player.car.y);
      if (d > 34 && d < 58 && (!c.nearMissT || G.time - c.nearMissT > 3)) { c.nearMissT = G.time; addChaos(G.mission, 35); if (G.mission.active && G.mission.active.id === 'rampage') pushPhone(G.mission, 'Marisol Vega', 'Near miss! Keep the chaos coming.', 2.5); }
    }
  }
  // --- peds
  if (G.peds.length < 15 && rng.chance(0.05)) { const p = spawnPed(rng, pp.x, pp.y); if (p) G.peds.push(p); }
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const p = G.peds[i];
    updatePed(p, dt, danger, rng);
    if (Math.hypot(p.x - pp.x, p.y - pp.y) > 1500) G.peds.splice(i, 1);
  }
  // --- police
  const W = G.wanted;
  const want = desiredCops(W.stars);
  const cops = G.cars.filter((c) => c.kind === 'police');
  if (cops.length < want && rng.chance(0.06)) G.cars.push(spawnPolice(rng, pp));
  let seen = false, contactAny = false;
  for (const c of cops) {
    const r = updatePoliceCar(c, dt, pp, G.cars);
    const d = Math.hypot(c.x - pp.x, c.y - pp.y);
    if (d < 430) seen = true;
    if (r.contact) contactAny = true;
    if (r.impact > 90 && player.car) { hurtPlayer(player, 3); G.shake = Math.min(10, r.impact * 0.04); }
    // cop rams player car: damage it
    if (player.car && d < 40 && Math.abs(c.speed) > 60 && rng.chance(0.1)) damageCar(player.car, 2);
    if (!player.car && d < 30) { hurtPlayer(player, 9 * dt * 10 * 0.1); contactAny = true; }
  }
  updateWanted(W, dt, seen);
  // busted meter
  const boxed = contactAny && (!player.car || Math.abs(player.car.speed) < 30);
  if (W.stars > 0 && boxed) W.busted = Math.min(1, W.busted + dt / 2.4);
  else W.busted = Math.max(0, W.busted - dt / 1.6);
  if (W.busted >= 1) { endRun('busted'); return; }
  // delivery carrying heat
  if (G.mission.active && G.mission.active.id === 'delivery' && G.mission.stage === 1) { W.heat = Math.min(0.95, W.heat + dt * 0.01); if (W.stars < 2 && W.heat > 0.9) { W.stars = Math.max(W.stars, 1); } }
  // --- missions
  const res = updateMission(G.mission, dt, pp, G.world);
  if (res === 'done') {
    const def = G.mission.phone.length ? null : null;
    const pay = [400, 550, 650][(G.mission.idx - 1 + 3) % 3], resp = [10, 14, 18][(G.mission.idx - 1 + 3) % 3];
    save.cash += pay; save.respect += resp; save.missionsDone = G.mission.done;
    sfx('cash'); storeSave(save);
  } else if (res === 'pickup') { player.carrying = true; crime('theft', pp.x, pp.y); }
  if (G.mission.active && G.mission.active.id === 'delivery' && G.mission.stage === 0) player.carrying = false;
  if (!G.mission.active) player.carrying = false;
  G.missionTarget = G.mission.active ? G.mission.target : null;
  // --- combat fx + car smoke/fire
  updateCombat(G.combat, dt);
  for (const c of G.cars) {
    if (c.wrecked && rng.chance(0.1)) spawnParticles(G.combat, c.x + rng.range(-8, 8), c.y - 10, 1, '#ff7b2d', 40);
    else if (c.hp < 45 && c.hp > 0 && rng.chance(0.16)) spawnParticles(G.combat, c.x, c.y - 14, 1, '#888888', 30);
  }
  // camera
  const tx = pp.x, ty = pp.y;
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
  G.shake *= Math.pow(0.02, dt);
  if (player.dead) { endRun('wasted'); return; }
  // audio
  updateAudio(dt, player.car ? player.car.speed / 330 : 0, cops.length > 0 && W.stars > 0, !!player.car);
}

function render() {
  ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, vw, vh);
  if (G.state === 'menu') { drawMenu(); return; }
  const pp = playerPos();
  const shx = (Math.random() - 0.5) * G.shake, shy = (Math.random() - 0.5) * G.shake;
  ctx.save();
  ctx.translate(vw / 2 - G.cam.x + shx, vh / 2 - G.cam.y + shy);
  drawCity(ctx, { x: G.cam.x - vw / 2, y: G.cam.y - vh / 2 }, vw, vh, G.golden);
  if (!G.mission.active) drawMarker(ctx, G.time);
  if (G.mission.active) drawMissionTarget(ctx, G.mission.target, G.time, player.carrying);
  // race checkpoints
  if (G.mission.active && G.mission.active.id === 'race') for (const cp of G.mission.checkpoints) drawMissionTarget(ctx, cp, G.time, false);
  for (const p of G.peds) if (Math.abs(p.x - G.cam.x) < vw / 2 + 60 && Math.abs(p.y - G.cam.y) < vh / 2 + 60) drawPed(ctx, p);
  for (const c of G.cars) if (Math.abs(c.x - G.cam.x) < vw / 2 + 80 && Math.abs(c.y - G.cam.y) < vh / 2 + 80) drawCar(ctx, c, G.time);
  if (!player.car) drawPlayer(ctx, player, G.time);
  drawCombat(ctx, G.combat);
  if (G.combat.muzzle > 0 && !player.car) {
    ctx.fillStyle = 'rgba(255,210,80,.9)';
    const mx = player.x + Math.cos(player.ang) * 24, my = player.y + Math.sin(player.ang) * 24;
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, 7); ctx.fill();
  }
  ctx.restore();
  // HUD data
  G.playerPos = { x: pp.x, y: pp.y, ang: player.car ? player.car.ang : player.ang + Math.PI / 2 };
  G.objective = G.objectiveOverride || (G.mission.active ? missionObjective(G.mission, pp) : (G.mission.offered ? { text: 'Mission ready at the M marker — press E', target: { x: MARKER.x, y: MARKER.y }, dist: Math.round(Math.hypot(pp.x - MARKER.x, pp.y - MARKER.y)), time: null } : null));
  if (G.state === 'playing' || G.state === 'paused') drawHUD(ctx, vw, vh, G);
  if (G.state === 'paused') drawOverlay('PAUSED', 'Press P or Esc to resume', '#ffd23e');
  if (G.state === 'wasted') drawOverlay('WASTED', statsLine(), '#ff3b30');
  if (G.state === 'busted') drawOverlay('BUSTED', statsLine(), '#2d7dff');
}
function statsLine() {
  return `Cash $${save.cash} · Respect ${save.respect} · Missions ${G.mission.done} · Crimes ${G.wanted.crimes} · Survived ${Math.floor(G.runTime)}s — click to restart`;
}
function drawOverlay(title, sub, color) {
  ctx.fillStyle = 'rgba(5,5,12,.72)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = color; ctx.font = 'bold 84px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(title, vw / 2, vh / 2 - 20);
  ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif'; ctx.fillText(sub, vw / 2, vh / 2 + 28);
  ctx.textAlign = 'left';
}
let startBtn = null, contBtn = null;
function drawMenu() {
  const grd = ctx.createLinearGradient(0, 0, 0, vh);
  grd.addColorStop(0, '#2b1055'); grd.addColorStop(0.55, '#7597de'); grd.addColorStop(0.56, '#f7b267'); grd.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, vw, vh);
  // skyline silhouette
  ctx.fillStyle = 'rgba(10,10,25,.85)';
  let x = 0; const r2 = makeRng(99);
  while (x < vw) { const w = 40 + r2.next() * 70, h = 90 + r2.next() * 190; ctx.fillRect(x, vh * 0.56 - h, w, h); x += w + 4; }
  ctx.fillStyle = '#f7b267'; ctx.fillRect(0, vh * 0.56, vw, 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 76px sans-serif';
  ctx.fillText('MARINA HEAT', vw / 2, vh * 0.30);
  ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif';
  ctx.fillText('Coral Marina. One fixer, three jobs, and every cop in the city.', vw / 2, vh * 0.38);
  ctx.font = '15px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText('Marisol Vega has work for drivers who don\'t ask questions. Steal cars, run jobs,', vw / 2, vh * 0.44);
  ctx.fillText('outrun the heat — just don\'t get wasted, and don\'t get busted.', vw / 2, vh * 0.475);
  ctx.font = '14px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText('WASD / Arrows — move & drive · Mouse — aim · Click — shoot · E — steal / enter car · Shift — sprint · Space — handbrake · P — pause · M — mute', vw / 2, vh * 0.66);
  const bw = 210, bh = 52, bx = vw / 2 - bw / 2;
  startBtn = { x: bx, y: vh * 0.72, w: bw, h: bh };
  ctx.fillStyle = '#ff5a3c'; ctx.beginPath(); ctx.roundRect(startBtn.x, startBtn.y, bw, bh, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('START', vw / 2, startBtn.y + 34);
  if (hadSave) {
    contBtn = { x: bx, y: vh * 0.72 + 64, w: bw, h: bh };
    ctx.fillStyle = '#2d7dff'; ctx.beginPath(); ctx.roundRect(contBtn.x, contBtn.y, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(`CONTINUE — $${save.cash}`, vw / 2, contBtn.y + 34);
  } else contBtn = null;
  ctx.textAlign = 'left';
}

canvas.addEventListener('mousedown', () => {
  if (G.state === 'menu') {
    for (const b of [startBtn, contBtn]) if (b && mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h) { startRun(); return; }
  } else if (G.state === 'wasted' || G.state === 'busted') restart();
  else if (!audioStarted) { initAudio(); audioStarted = true; }
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleMute();
  if ((e.code === 'KeyP' || e.code === 'Escape') && G.started) {
    if (G.state === 'playing') G.state = 'paused';
    else if (G.state === 'paused') G.state = 'playing';
  }
  if (e.code === 'Enter' && G.state === 'menu') startRun();
});

initInput(canvas);
if (shotName) {
  setupShot(G, shotName, seed);
  G.cam.x = playerPos().x; G.cam.y = playerPos().y;
  const fixed = 1 / 30;
  for (let i = 0; i < 14; i++) update(fixed); // brief settle: scenes stay close to their arranged action
  G.cam.x = playerPos().x; G.cam.y = playerPos().y;
  render();
  window.__shotReady = true;
} else {
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.state !== 'paused') update(dt);
    render();
    endFrameInput();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
