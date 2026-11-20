// minimap.js — the corner minimap: water, streets, the marina, and
// live dots for the player, police, traffic and the objective.

import { WORLD, BLOCK, WATER_X, WATER_Y } from './city.js';

const SIZE = 184;
const MARGIN = 16;

export function drawMinimap(ctx, world) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const x0 = w - SIZE - MARGIN;
  const y0 = h - SIZE - MARGIN;
  const scale = SIZE / WORLD;

  ctx.save();
  ctx.fillStyle = 'rgba(10,16,30,0.78)';
  ctx.fillRect(x0 - 4, y0 - 4, SIZE + 8, SIZE + 8);

  // Land + water.
  ctx.fillStyle = '#4d7a3f';
  ctx.fillRect(x0, y0, SIZE, SIZE);
  ctx.fillStyle = '#1d6f9f';
  ctx.fillRect(x0 + WATER_X * scale, y0, SIZE - WATER_X * scale, SIZE);
  ctx.fillRect(x0, y0 + WATER_Y * scale, SIZE, SIZE - WATER_Y * scale);

  // Streets.
  ctx.strokeStyle = 'rgba(230,230,230,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 0; g <= WORLD / BLOCK; g++) {
    ctx.moveTo(x0 + g * BLOCK * scale, y0);
    ctx.lineTo(x0 + g * BLOCK * scale, y0 + SIZE);
    ctx.moveTo(x0, y0 + g * BLOCK * scale);
    ctx.lineTo(x0 + SIZE, y0 + g * BLOCK * scale);
  }
  ctx.stroke();

  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * scale, y0 + wy * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const car of world.traffic) dot(car.x, car.y, 'rgba(255,255,255,0.55)', 1.6);
  for (const car of world.police.cruisers) dot(car.x, car.y, '#ff4040', 2.6);

  const obj = world.missions.objective();
  if (obj) {
    const pulse = 3.4 + Math.sin(world.time * 5) * 1.1;
    dot(obj.x, obj.y, obj.color, pulse);
  }

  // Player arrow.
  const p = world.player;
  const px = x0 + p.x * scale;
  const py = y0 + p.y * scale;
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('CORAL MARINA', x0 + SIZE, y0 - 8);
}
