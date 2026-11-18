// minimap.js — the corner minimap: the whole city scaled down, with the
// player (green), police (blue), mission objective (gold) and the camera
// viewport rectangle. Drawn top-left over the HUD.
import { WORLD } from './city.js';

export function drawMinimap(ctx, G) {
  const S = 180; // minimap is 180x180
  const scale = S / WORLD;
  const x0 = 16; const y0 = 16;
  ctx.save();
  ctx.fillStyle = '#0f172acc';
  ctx.fillRect(x0 - 4, y0 - 4, S + 8, S + 8);
  // water + sand
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(x0, y0, 240 * scale + 2, S);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x0 + 240 * scale, y0, 8, S);
  // ground
  ctx.fillStyle = '#334155';
  ctx.fillRect(x0 + 240 * scale + 8, y0, S - 240 * scale - 8, S);
  // roads
  ctx.fillStyle = '#64748b';
  for (const rx of G.city.roadsV) ctx.fillRect(x0 + rx * scale - 1, y0, 2, S);
  for (const ry of G.city.roadsH) ctx.fillRect(x0, y0 + ry * scale - 1, S, 2);
  // buildings
  ctx.fillStyle = '#94a3b8';
  for (const b of G.city.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // mission objective
  if (G.mission) {
    const t = G.mission.id === 0 ? G.mission.target
      : G.mission.id === 1 ? (G.mission.stage === 0 ? G.mission.target : G.mission.target2) : null;
    if (t) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(x0 + t.x * scale, y0 + t.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // police
  ctx.fillStyle = '#3b82f6';
  for (const c of G.cars) {
    if (!c.police || c.wrecked) continue;
    ctx.beginPath(); ctx.arc(x0 + c.x * scale, y0 + c.y * scale, 3, 0, Math.PI * 2); ctx.fill();
  }
  // player
  ctx.fillStyle = '#22c55e';
  ctx.beginPath(); ctx.arc(x0 + G.player.x * scale, y0 + G.player.y * scale, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x0 + G.player.x * scale, y0 + G.player.y * scale, 7, 0, Math.PI * 2); ctx.stroke();
  // viewport rectangle
  ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1;
  ctx.strokeRect(x0 + G.camera.x * scale, y0 + G.camera.y * scale,
    G.view.w * scale, G.view.h * scale);
  ctx.restore();
}
