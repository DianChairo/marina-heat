// Minimap: roads, blocks, water, player arrow, police blips, traffic dots, mission marker.
import { WORLD_W, WORLD_H, BEACH_X, roadXs, roadYs, ROAD } from './city.js';
import { MARKER } from './missions.js';

export function drawMinimap(ctx, x, y, size, G) {
  const s = size / WORLD_W, sy = size / WORLD_H;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, size, size * (WORLD_H / WORLD_W), 8); ctx.clip();
  ctx.fillStyle = '#9a8d76'; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#3ec6d8'; ctx.fillRect(x + BEACH_X * s, y, size - BEACH_X * s, size);
  ctx.strokeStyle = '#55555f'; ctx.lineWidth = Math.max(2, ROAD * s);
  ctx.beginPath();
  for (const rx of roadXs) { ctx.moveTo(x + rx * s, y); ctx.lineTo(x + rx * s, y + size * (WORLD_H / WORLD_W)); }
  for (const ry of roadYs) { ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + size, y + ry * sy); }
  ctx.stroke();
  const px = (wx) => x + wx * s, py = (wy) => y + wy * sy;
  // traffic dots
  ctx.fillStyle = '#dddddd';
  for (const c of G.cars) if (c.kind === 'traffic') ctx.fillRect(px(c.x) - 1.5, py(c.y) - 1.5, 3, 3);
  // mission marker + target
  ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(px(MARKER.x), py(MARKER.y), 4, 0, 7); ctx.fill();
  if (G.missionTarget) { ctx.fillStyle = '#2eff8a'; ctx.beginPath(); ctx.arc(px(G.missionTarget.x), py(G.missionTarget.y), 4.5, 0, 7); ctx.fill(); }
  // police blips (flashing)
  if (Math.floor(performance.now() / 350) % 2 === 0) ctx.fillStyle = '#ff3b30'; else ctx.fillStyle = '#2d7dff';
  for (const c of G.cars) if (c.kind === 'police') { ctx.beginPath(); ctx.arc(px(c.x), py(c.y), 3.4, 0, 7); ctx.fill(); }
  // player arrow
  const p = G.playerPos;
  ctx.save(); ctx.translate(px(p.x), py(p.y)); ctx.rotate(p.ang + Math.PI / 2);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, size, size * (WORLD_H / WORLD_W), 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', x + size / 2, y - 4);
}
