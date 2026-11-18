// player.js — the on-foot protagonist of Coral Marina.
// WASD moves, Shift sprints, mouse aims. The player carries health and
// money; getting into a car hands control to vehicles.js.
import { collideBuildings, WORLD } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: 100, maxHp: 100,
    money: 0, speed: 0, onFoot: true, car: null,
    sprint: false, moving: false, hurtFlash: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (!p.onFoot || G.mode !== 'play') return;
  const inp = G.input;
  let mx = 0; let my = 0;
  if (inp.down('w', 'arrowup')) my -= 1;
  if (inp.down('s', 'arrowdown')) my += 1;
  if (inp.down('a', 'arrowleft')) mx -= 1;
  if (inp.down('d', 'arrowright')) mx += 1;
  const len = Math.hypot(mx, my);
  p.sprint = inp.down('shift');
  p.moving = len > 0;
  if (len > 0) {
    const sp = (p.sprint ? 300 : 185) * dt;
    const nx = p.x + (mx / len) * sp;
    const ny = p.y + (my / len) * sp;
    if (!collideBuildings(G.city, nx, p.y, 12)) p.x = nx;
    if (!collideBuildings(G.city, p.x, ny, 12)) p.y = ny;
    p.x = Math.max(8, Math.min(WORLD - 8, p.x));
    p.y = Math.max(8, Math.min(WORLD - 8, p.y));
    p.speed = p.sprint ? 300 : 185;
  } else {
    p.speed = 0;
  }
  // Aim at the mouse: world position of the cursor.
  const wx = G.camera.x + inp.mouse.x;
  const wy = G.camera.y + inp.mouse.y;
  p.angle = Math.atan2(wy - p.y, wx - p.x);
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (G.mode !== 'play') return;
  p.hp -= amount;
  p.hurtFlash = 0.35;
  if (p.hp <= 0) {
    p.hp = 0;
    G.mode = 'wasted';
    G.audio.setEngine(false, 0);
    G.audio.setSiren(false);
    G.audio.busted();
  }
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // body: teal jacket, dark jeans; gun arm points at the aim angle
  ctx.fillStyle = '#0f766e';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#134e4a';
  ctx.fillRect(8, -4, 16, 8);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-8, -6, 8, 5);
  ctx.fillRect(-8, 1, 8, 5);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.arc(2, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (p.hurtFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, p.hurtFlash);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
