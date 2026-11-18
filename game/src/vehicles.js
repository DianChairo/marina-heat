// vehicles.js — car factory, arcade physics with drift, damage states, drawing.
import { clamp, angDiff, dist } from './rng.js';
import { collideCircle, isWater } from './city.js';
export const CAR_COLORS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5', '#f1fa8c', '#dee2e6', '#118ab2', '#ef476f', '#06d6a0'];
let nextId = 1;
export function makeCar(x, y, a, color, kind = 'parked') {
  return {
    id: nextId++, x, y, a, vx: 0, vy: 0, speed: 0, steer: 0, w: 44, h: 22, r: 20,
    color, kind, hp: 100, smokeT: 0, honkT: 0, dead: false, driver: null,
    dir: 0, lane: 0, cruise: 150, turnCd: 0, brake: false, stuckT: 0,
  };
}
export function carSpeed(c) { return Math.hypot(c.vx, c.vy); }
export function updateCar(S, c, ctrl, dt) {
  if (c.dead) { c.vx *= 0.9; c.vy *= 0.9; c.x += c.vx * dt; c.y += c.vy * dt; return; }
  const fwdX = Math.cos(c.a), fwdY = Math.sin(c.a);
  let fwd = c.vx * fwdX + c.vy * fwdY; // signed forward speed
  const latX = -fwdY, latY = fwdX;
  let lat = c.vx * latX + c.vy * latY;
  const accel = ctrl.up ? 340 : 0, brake = ctrl.down ? (fwd > 12 ? -520 : -190) : 0;
  fwd += (accel + brake) * dt;
  fwd -= fwd * (ctrl.up || ctrl.down ? 0.25 : 0.9) * dt; // drag / coast
  if (!ctrl.up && !ctrl.down && Math.abs(fwd) < 4) fwd = 0;
  fwd = clamp(fwd, -150, 430);
  const steerIn = (ctrl.left ? -1 : 0) + (ctrl.right ? 1 : 0);
  c.steer = clamp(c.steer + (steerIn - c.steer) * Math.min(1, dt * 8), -1, 1);
  const drift = ctrl.hand ? 0.55 : 0.12; // lateral grip loss
  lat -= lat * (ctrl.hand ? 3.2 : 10) * dt * (drift > 0.2 ? 0.45 : 1);
  if (Math.abs(fwd) > 6) c.a += c.steer * clamp(fwd / 130, -1.6, 1.6) * 1.55 * dt * (fwd < 0 ? -1 : 1);
  const nfx = Math.cos(c.a), nfy = Math.sin(c.a);
  c.vx = nfx * fwd + (-nfy) * lat; c.vy = nfy * fwd + nfx * lat;
  c.speed = fwd;
  c.x += c.vx * dt; c.y += c.vy * dt;
  // building + water collision
  const before = Math.hypot(c.vx, c.vy);
  const [nx, ny, hit] = collideCircle(S.city, c.x, c.y, c.r);
  if (hit) {
    c.x = nx; c.y = ny;
    if (before > 90) damageCar(S, c, before * 0.06, true);
    c.vx *= -0.22; c.vy *= -0.22;
  }
  if (isWater(c.x, c.y)) { c.vx *= 0.9; c.vy *= 0.9; damageCar(S, c, 22 * dt, false); }
  // smoke / fire particles
  if (c.hp < 55) {
    c.smokeT -= dt;
    if (c.smokeT <= 0) { c.smokeT = c.hp < 25 ? 0.05 : 0.14; S.parts.push({ x: c.x + nfx * 16, y: c.y + nfy * 16, vx: 0, vy: -24, life: 0.8, max: 0.8, size: c.hp < 25 ? 9 : 6, color: c.hp < 25 ? '255,120,30' : '90,90,90', kind: 'smoke' }); }
  }
}
export function damageCar(S, c, amt, loud) {
  if (c.dead) return;
  c.hp -= amt;
  if (loud && amt > 3) { S.audio.crash(Math.min(1, amt / 16)); if (S.player.car === c) S.shake = Math.min(14, S.shake + amt * 0.5); }
  if (c.hp <= 0 && !c.dead) {
    c.dead = true; c.hp = 0;
    for (let i = 0; i < 16; i++) S.parts.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 190, vy: (Math.random() - 0.5) * 190, life: 0.7, max: 0.7, size: 7, color: '255,140,40', kind: 'spark' });
    if (S.player.car === c) { S.player.hp -= 18; }
    S.onCarWrecked && S.onCarWrecked(c);
  }
}
export function collideCars(S, dt) {
  const cars = S.cars;
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const A = cars[i], B = cars[j];
    const d = dist(A.x, A.y, B.x, B.y), min = A.r + B.r - 4;
    if (d > min || d === 0) continue;
    const nx = (B.x - A.x) / d, ny = (B.y - A.y) / d, push = (min - d) / 2;
    A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
    const rel = Math.abs((A.vx - B.vx) * nx + (A.vy - B.vy) * ny);
    const swap = 0.45;
    A.vx -= nx * rel * swap; A.vy -= ny * rel * swap; B.vx += nx * rel * swap; B.vy += ny * rel * swap;
    if (rel > 55) {
      damageCar(S, A, rel * 0.09, true); damageCar(S, B, rel * 0.09, true);
      for (let k = 0; k < 5; k++) S.parts.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, vx: (Math.random() - 0.5) * 150, vy: (Math.random() - 0.5) * 150, life: 0.4, max: 0.4, size: 4, color: '255,200,80', kind: 'spark' });
      const playerIn = S.player.car === A || S.player.car === B;
      if (playerIn) { S.shake = Math.min(16, S.shake + rel * 0.06); S.player.hp -= rel * 0.02; S.onPlayerCrash && S.onPlayerCrash(rel, A === S.player.car ? B : A); }
      else if (dist(A.x, A.y, S.player.x, S.player.y) < 340) S.onCrimeWitnessed && S.onCrimeWitnessed('crash', A.x, A.y);
    }
  }
}
export function drawCar(ctx, c, t) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(2, 4, 25, 13, 0, 0, 7); ctx.fill();
  const body = c.dead ? '#3a3a3a' : c.kind === 'cop' ? '#f4f6f8' : c.color;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(-22, -11, 44, 22, 6); ctx.fill();
  ctx.fillStyle = c.kind === 'cop' ? '#1d3557' : 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.roundRect(-23, -11, 10, 22, 4); ctx.fill(); ctx.beginPath(); ctx.roundRect(13, -11, 10, 22, 4); ctx.fill();
  ctx.fillStyle = '#bfe8f2'; ctx.beginPath(); ctx.roundRect(-8, -8.5, 11, 17, 3); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,40,0.85)'; ctx.beginPath(); ctx.roundRect(4, -8, 8, 16, 2); ctx.fill();
  ctx.fillStyle = '#ffe9a3'; ctx.fillRect(20, -8, 3, 5); ctx.fillRect(20, 3, 3, 5);
  ctx.fillStyle = '#ff5a5a'; ctx.fillRect(-23.5, -8, 2.5, 5); ctx.fillRect(-23.5, 3, 2.5, 5);
  ctx.fillStyle = '#16181d';
  for (const [wx, wy] of [[-14, -12], [14, -12], [-14, 9], [14, 9]]) { ctx.beginPath(); ctx.roundRect(wx - 4, wy, 9, 3.5, 1.5); ctx.fill(); }
  if (c.kind === 'cop') {
    ctx.fillStyle = '#12233d'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('POLICE', 0, 2.5);
    const flash = Math.sin(t * 0.02) > 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff'; ctx.beginPath(); ctx.arc(-3, 0, 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d'; ctx.beginPath(); ctx.arc(4, 0, 3.2, 0, 7); ctx.fill();
  }
  if (c.hp < 55 && !c.dead) { ctx.fillStyle = 'rgba(30,30,30,0.35)'; ctx.beginPath(); ctx.roundRect(8, -11, 14, 22, 5); ctx.fill(); }
  ctx.restore();
  if (c.honkT > 0.4) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HONK!', c.x, c.y - 22); }
}
