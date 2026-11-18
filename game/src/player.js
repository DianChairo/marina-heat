// player.js — on-foot movement, aim, car entry/exit, drawing, health regen.
import { clamp, dist } from './rng.js';
import { collideCircle, isWater } from './city.js';
export function makePlayer(x, y) {
  return { x, y, vx: 0, vy: 0, a: 0, r: 10, hp: 100, maxHp: 100, car: null, hurtT: 0, walkT: 0, dead: false, skin: '#f2c185', shirt: '#ff5964', pants: '#2b3a55' };
}
export function updatePlayer(S, dt) {
  const p = S.player, inp = S.input;
  p.hurtT -= dt;
  if (!p.car) {
    const mx = inp.moveX(), my = inp.moveY();
    const sprint = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const sp = (sprint ? 268 : 172) * (isWater(p.x, p.y) ? 0.45 : 1);
    const len = Math.hypot(mx, my) || 1;
    const tx = (mx / len) * (mx || my ? sp : 0), ty = (my / len) * (mx || my ? sp : 0);
    p.vx += (tx - p.vx) * Math.min(1, dt * 12); p.vy += (ty - p.vy) * Math.min(1, dt * 12);
    p.x += p.vx * dt; p.y += p.vy * dt;
    const [nx, ny] = collideCircle(S.city, p.x, p.y, p.r); p.x = nx; p.y = ny;
    if (mx || my) p.walkT += dt * (sprint ? 13 : 9);
    // aim at mouse (screen -> world)
    p.a = Math.atan2(S.cam.y + inp.mouse.y - S.vh / 2 - p.y, S.cam.x + inp.mouse.x - S.vw / 2 - p.x);
    // car collisions while on foot: getting run over hurts
    for (const c of S.cars) {
      if (Math.hypot(c.vx, c.vy) > 60 && dist(p.x, p.y, c.x, c.y) < c.r + 6) {
        p.hp -= 26 * dt * 3; p.hurtT = 1.2; S.shake = Math.min(10, S.shake + 3);
        const d = Math.max(1, dist(p.x, p.y, c.x, c.y)); p.x += ((p.x - c.x) / d) * 26; p.y += ((p.y - c.y) / d) * 26;
      }
    }
  } else {
    p.x = p.car.x; p.y = p.car.y; p.a = p.car.a;
  }
  if (p.hurtT <= 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 2.6 * dt); // slow regen
  p.hp = clamp(p.hp, 0, p.maxHp);
  if (p.hp <= 0 && !p.dead) { p.dead = true; S.mode = 'dead'; S.audio.sting(false); S.saveBest(); }
}
export function nearestCar(S, maxD) {
  let best = null, bd = maxD;
  for (const c of S.cars) { if (c.dead) continue; const d = dist(S.player.x, S.player.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
  return best;
}
export function tryEnterExit(S) {
  const p = S.player;
  if (p.car) {
    const c = p.car; p.car = null; c.driver = null; if (c.kind === 'player') c.kind = 'parked';
    p.x = c.x + Math.cos(c.a - Math.PI / 2) * 30; p.y = c.y + Math.sin(c.a - Math.PI / 2) * 30;
    const [nx, ny] = collideCircle(S.city, p.x, p.y, p.r); p.x = nx; p.y = ny;
    S.audio.engine(0, false);
    return;
  }
  const c = nearestCar(S, 46);
  if (!c) return;
  const wasOccupied = c.kind === 'traffic' || c.kind === 'cop';
  if (c.kind === 'traffic') { // driver flees screaming
    const ped = S.spawnPed(c.x + 24, c.y + 10, true); if (ped) { ped.state = 'flee'; ped.fleeX = c.x - 200; ped.fleeY = c.y; ped.panic = 3; }
  }
  c.kind = 'player'; c.driver = 'player'; p.car = c; p.x = c.x; p.y = c.y;
  S.audio.tone(220, 0.08, 'square', 0.12);
  S.onCarStolen && S.onCarStolen(c, wasOccupied);
}
export function drawPlayer(ctx, p, t) {
  if (p.car) return;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 9, 5, 0, 0, 7); ctx.fill();
  const bob = Math.sin(p.walkT * 2) * 1.6;
  ctx.rotate(p.a);
  ctx.fillStyle = p.pants; ctx.fillRect(-3 + bob * 0.4, -7, 5, 6); ctx.fillRect(-3 - bob * 0.4, 1, 5, 6);
  ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(1.5, 0, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#20242c'; ctx.fillRect(6, -1.6, 11, 3.2); // gun
  ctx.fillStyle = p.skin; ctx.fillRect(4, 4.5, 6, 3);
  ctx.restore();
}
