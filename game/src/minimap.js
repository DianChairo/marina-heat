// minimap.js — corner map: roads, blocks, water, blips, mission marker. North is up.
import { CELL, ROAD, WORLD, WATER_Y, BEACH_Y } from './city.js';
import { missionMarker } from './missions.js';
export function drawMinimap(ctx, S, x, y, size) {
  const s = size / WORLD;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 10); ctx.clip();
  ctx.fillStyle = '#79a86b'; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#f2dc9b'; ctx.fillRect(x, y + BEACH_Y * s, size, (WORLD - BEACH_Y) * s);
  ctx.fillStyle = '#1668a8'; ctx.fillRect(x, y + WATER_Y * s, size, (WORLD - WATER_Y) * s);
  ctx.fillStyle = '#3d4148';
  for (let i = 0; i < 8; i++) { ctx.fillRect(x + i * CELL * s, y, ROAD * s, size); ctx.fillRect(x, y + i * CELL * s, size, ROAD * s); }
  ctx.fillStyle = 'rgba(20,26,34,0.55)';
  for (const b of S.city.buildings) ctx.fillRect(x + b.x * s, y + b.y * s, Math.max(1.5, b.w * s), Math.max(1.5, b.h * s));
  for (const c of S.cars) {
    if (c.dead) continue;
    ctx.fillStyle = c.kind === 'cop' ? (Math.sin(S.t * 9) > 0 ? '#ff4040' : '#3d7bff') : c.kind === 'player' ? '#ffffff' : 'rgba(255,255,255,0.45)';
    ctx.fillRect(x + c.x * s - 1.6, y + c.y * s - 1.6, 3.2, 3.2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const p of S.peds) if (!p.dead) ctx.fillRect(x + p.x * s - 1, y + p.y * s - 1, 2, 2);
  const mk = missionMarker(S);
  if (mk) {
    ctx.fillStyle = mk.color; ctx.beginPath(); ctx.arc(x + mk.x * s, y + mk.y * s, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#12233d'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('M', x + mk.x * s, y + mk.y * s + 2.5);
  }
  // player arrow
  const px = x + S.player.x * s, py = y + S.player.y * s, a = S.player.car ? S.player.car.a : S.player.a;
  ctx.translate(px, py); ctx.rotate(a);
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(10,14,20,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, size, size, 10); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('N ↑', x + 6, y + 15);
}
