// minimap.js — corner minimap: roads, water, the player arrow, nearby
// cars, police (flashing), pedestrians and the mission checkpoint.

import { WORLD, CELL, ROAD, WATER_X, WATER_Y } from './city.js';

const SIZE = 176;
const PAD = 14;

export function drawMinimap(ctx, world, vw, vh) {
  const x0 = PAD;
  const y0 = vh - SIZE - 64;
  const scale = SIZE / WORLD;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, SIZE, SIZE, 10);
  ctx.clip();
  // Land + water.
  ctx.fillStyle = '#cdb98a';
  ctx.fillRect(x0, y0, SIZE, SIZE);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0 + WATER_X * scale, y0, SIZE - WATER_X * scale, SIZE);
  ctx.fillRect(x0 + 2080 * scale, y0 + WATER_Y * scale, SIZE - 2080 * scale, SIZE - WATER_Y * scale);
  // Roads.
  ctx.fillStyle = '#4c4c52';
  for (let g = 0; g <= WORLD / CELL; g++) {
    const p = g * CELL * scale;
    ctx.fillRect(x0 + p - (ROAD * scale) / 2, y0, ROAD * scale, SIZE);
    ctx.fillRect(x0, y0 + p - (ROAD * scale) / 2, SIZE, ROAD * scale);
  }
  const toMap = (x, y) => [x0 + x * scale, y0 + y * scale];

  // Mission checkpoint.
  const s = world.missions.active;
  if (s && s.checkpoint) {
    const [mx, my] = toMap(s.checkpoint.x, s.checkpoint.y);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(mx, my, 4.5 + Math.sin(world.time * 5) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pedestrians.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const [mx, my] = toMap(ped.x, ped.y);
    ctx.fillRect(mx - 1, my - 1, 2, 2);
  }
  // Cars.
  for (const car of world.cars) {
    if (car.kind === 'police') continue;
    const [mx, my] = toMap(car.x, car.y);
    ctx.fillStyle = car.package ? '#ffe14d' : '#e8e8e8';
    ctx.fillRect(mx - 2, my - 2, 4, 4);
  }
  // Police flash.
  const flash = Math.floor(world.time * 3) % 2 === 0;
  for (const cop of world.police) {
    const [mx, my] = toMap(cop.car.x, cop.car.y);
    ctx.fillStyle = flash ? '#ff4040' : '#4080ff';
    ctx.beginPath();
    ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = world.player.pos;
  const [px, py] = toMap(p.x, p.y);
  const ang = world.player.inCar ? world.player.inCar.angle : world.player.angle;
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = '#ff6b4a';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Border + label.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x0, y0, SIZE, SIZE, 10);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('CORAL MARINA', x0 + 8, y0 + 14);
  ctx.restore();
}
