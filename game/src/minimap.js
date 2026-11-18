// minimap.js — the corner map: city blocks, roads, the beach, and dots
// for the player (green), police (red), traffic (white) and the current
// objective (yellow). Drawn on its own small canvas.
export function drawMinimap(ctx, G, size) {
  const city = G.city;
  const scale = size / city.size;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(10,20,16,0.78)';
  ctx.fillRect(0, 0, size, size);
  // Ocean + sand.
  ctx.fillStyle = '#2f6fb2';
  ctx.fillRect(0, 0, 170 * scale, size);
  ctx.fillStyle = '#d9c184';
  ctx.fillRect(170 * scale, 0, 65 * scale, size);
  // Roads.
  ctx.fillStyle = '#888';
  for (const rx of city.roadsV) ctx.fillRect(rx * scale - 1, 0, 2, size);
  for (const ry of city.roadsH) ctx.fillRect(0, ry * scale - 1, size, 2);
  // Buildings.
  ctx.fillStyle = '#bbb';
  for (const b of city.buildings) ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  // Fixer.
  ctx.fillStyle = '#e84a8a';
  ctx.beginPath();
  ctx.arc(city.fixer.x * scale, city.fixer.y * scale, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Objective.
  const m = G.mission;
  if (m.active) {
    const target = m.id === 0 ? m.checkpoints[m.stage] : m.checkpoints[0];
    if (target) {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(target.x * scale, target.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Traffic dots.
  ctx.fillStyle = '#fff';
  for (const car of G.cars) {
    if (car.kind === 'traffic') ctx.fillRect(car.x * scale - 1, car.y * scale - 1, 2, 2);
  }
  // Police dots.
  ctx.fillStyle = '#ff2a2a';
  for (const car of G.cars) {
    if (car.kind === 'police') ctx.fillRect(car.x * scale - 1.5, car.y * scale - 1.5, 3, 3);
  }
  // Player: green dot with a white ring, centred.
  const p = G.player;
  ctx.fillStyle = '#37d67a';
  ctx.beginPath();
  ctx.arc(p.x * scale, p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x * scale, p.y * scale, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(G.camera.x * scale, G.camera.y * scale, G.camera.w * scale, G.camera.h * scale);
}
