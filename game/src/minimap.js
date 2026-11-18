// minimap.js — the corner map: roads, blocks, water, and blips for the player,
// police, traffic, and the current mission target. North is always up.
import { WORLD_W, WORLD_H, GRID_W, vRoads, hRoads, WATER_X } from './city.js';
import { MARKER } from './missions.js';

export function drawMinimap(G) {
  const cv = document.getElementById('minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sx = W / WORLD_W, sy = H / WORLD_H;
  ctx.fillStyle = '#274b63'; ctx.fillRect(0, 0, W, H);            // water base
  ctx.fillStyle = '#c9c2b4'; ctx.fillRect(0, 0, GRID_W * sx, H);  // city blocks
  ctx.fillStyle = '#f4d58d'; ctx.fillRect(GRID_W * sx, 0, (WATER_X - GRID_W) * sx, H); // sand
  ctx.strokeStyle = '#3b3f46'; ctx.lineWidth = 3;
  for (const x of vRoads) { ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, H); ctx.stroke(); }
  for (const y of hRoads) { ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(GRID_W * sx, y * sy); ctx.stroke(); }
  // Traffic dots.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const c of G.cars) {
    if (c.kind !== 'traffic') continue;
    ctx.fillRect(c.x * sx - 1, c.y * sy - 1, 2, 2);
  }
  // Police blips blink red/blue.
  const phase = Math.floor(G.time * 3) % 2;
  for (const c of G.cars) {
    if (c.kind !== 'police') continue;
    ctx.fillStyle = phase ? '#ff3b30' : '#4da3ff';
    ctx.beginPath(); ctx.arc(c.x * sx, c.y * sy, 3, 0, 7); ctx.fill();
  }
  for (const p of G.peds) {
    if (!p.cop || p.dead) continue;
    ctx.fillStyle = '#4da3ff'; ctx.fillRect(p.x * sx - 1.5, p.y * sy - 1.5, 3, 3);
  }
  // Mission target or the idle M board.
  const m = G.mission;
  if (m && m.target) {
    ctx.fillStyle = '#ffd740'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(m.target.x * sx, m.target.y * sy, 4, 0, 7); ctx.fill(); ctx.stroke();
  } else if (m && !m.active) {
    ctx.fillStyle = '#ff4081';
    ctx.beginPath(); ctx.arc(MARKER.x * sx, MARKER.y * sy, 3.4, 0, 7); ctx.fill();
  }
  // Player arrow (white when on foot, in the car when driving).
  const P = G.player, pos = P.inCar || P;
  const ang = P.inCar ? P.inCar.angle : P.angle;
  ctx.save();
  ctx.translate(pos.x * sx, pos.y * sy); ctx.rotate(ang);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('N ↑', W - 4, 11);
}
