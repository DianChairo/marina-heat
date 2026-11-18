// player.js — the on-foot player: WASD movement, sprint, mouse aim,
// health, money and getting in and out of cars with E.
import { clampToCity, resolveBuildings } from './city.js';
import { isDown, moveVector, wasPressed } from './input.js';

export function createPlayer(city, save) {
  return {
    x: save ? save.x : city.spawn.x,
    y: save ? save.y : city.spawn.y,
    angle: -Math.PI / 2,
    hp: 100,
    maxHp: 100,
    money: save ? save.money : 0,
    score: save ? save.score : 0,
    onFoot: true,
    car: null,
    speed: 0,
    sprinting: false,
    shootCooldown: 0,
    hurtFlash: 0,
  };
}

// Aim angle from the player to the mouse cursor (screen -> world).
export function aimAngle(G) {
  const p = G.player;
  const wx = G.camera.x + G.input.mouse.x;
  const wy = G.camera.y + G.input.mouse.y;
  return Math.atan2(wy - p.y, wx - p.x);
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (!p.onFoot) return;
  p.angle = aimAngle(G);
  const mv = moveVector(input);
  p.sprinting = isDown(input, 'ShiftLeft', 'ShiftRight') && (mv.x !== 0 || mv.y !== 0);
  const speed = p.sprinting ? 260 : 165;
  p.speed = (mv.x !== 0 || mv.y !== 0) ? speed : 0;
  p.x += mv.x * speed * dt;
  p.y += mv.y * speed * dt;
  const fixed = resolveBuildings(G.city, p.x, p.y, 14);
  p.x = fixed.x;
  p.y = fixed.y;
  const clamped = clampToCity(G.city, p.x, p.y, 20);
  p.x = clamped.x;
  p.y = clamped.y;
  // E near a car: steal it. E while driving is handled in vehicles.js.
  if (wasPressed(input, 'KeyE')) {
    let best = null;
    let bestD = 70;
    for (const car of G.cars) {
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      p.onFoot = false;
      p.car = best;
      best.kind = 'player';
      best.driver = 'player';
      G.stats.carsStolen++;
      G.audio.blip(520, 0.12, 'square', 0.09);
      pushMessage(G, 'You', 'Nice ride. It is yours now.');
      // Consume the press so the driving update in the same frame does
      // not read it as "bail out of the car".
      input.pressed.delete('KeyE');
    }
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.hp <= 0) return;
  p.hp -= amount;
  p.hurtFlash = 0.25;
  if (p.hp <= 0) {
    p.hp = 0;
    G.state = 'wasted';
    G.audio.busted();
  }
}

export function healPlayer(G, amount) {
  const p = G.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

export function pushMessage(G, from, text) {
  G.messages.unshift({ from, text, t: G.time });
  if (G.messages.length > 5) G.messages.pop();
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (!p.onFoot || p.hp <= 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: jacket + head + gun arm.
  ctx.fillStyle = '#e84a3a';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89a';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(10, -3, 14, 5);
  ctx.fillStyle = '#444';
  ctx.fillRect(20, -1.5, 8, 3);
  ctx.restore();
  if (p.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(255,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}
