// city.js — Coral Marina: grid city data, collision, and all world rendering.
import { makeRng, clamp } from './rng.js';
export const WORLD = 3200, CELL = 400, ROAD = 110, BEACH_Y = 2880, WATER_Y = 3030;
const PALETTES = [
  ['#e8b4a0', '#c97e63'], ['#a8d8d8', '#6fa8a8'], ['#f2d492', '#d9a94e'], ['#d9a7c7', '#a96f97'],
  ['#b5c99a', '#7d9b5e'], ['#f4f1de', '#cfc9a8'], ['#e07a5f', '#b0502f'], ['#81b29a', '#557a67'],
  ['#f2cc8f', '#c99b45'], ['#9db4db', '#64799e'],
];
export function createCity(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const buildings = [], props = [];
  for (let bx = 0; bx < 8; bx++) for (let by = 0; by < 8; by++) {
    const x0 = bx * CELL + ROAD, y0 = by * CELL + ROAD, w = CELL - ROAD, h = CELL - ROAD;
    if (y0 > BEACH_Y - 60) continue; // beach blocks stay open sand
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const bw = w / n - 14, bh = rng.range(h * 0.45, h * 0.85);
      const pal = PALETTES[rng.int(0, PALETTES.length - 1)];
      buildings.push({
        x: x0 + 7 + i * (w / n), y: y0 + rng.range(4, h - bh - 4), w: bw, h: bh,
        wall: pal[0], roof: pal[1], floors: Math.max(2, (bh / 26) | 0), seed: rng.int(1, 99999),
        shop: rng.chance(0.35),
      });
    }
    for (let i = 0; i < 4; i++) props.push({ kind: rng.pick(['palm', 'lamp', 'hydrant', 'palm']), x: x0 - 16, y: y0 + rng.range(0, h) });
    for (let i = 0; i < 3; i++) props.push({ kind: rng.pick(['palm', 'lamp']), x: x0 + w + 14, y: y0 + rng.range(0, h) });
  }
  for (let x = 60; x < WORLD; x += 130) props.push({ kind: 'palm', x, y: BEACH_Y + rng.range(10, 110) });
  return { buildings, props, W: WORLD, H: WORLD };
}
export const onRoadX = (x) => (x % CELL) < ROAD;
export const onRoadY = (y) => (y % CELL) < ROAD;
export const isRoad = (x, y) => onRoadX(x) || onRoadY(y) || y > BEACH_Y;
export const isWater = (x, y) => y > WATER_Y;
export function collideCircle(city, x, y, r) {
  // push a circle out of every building rect it overlaps; returns corrected [x,y,hit]
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; y = ny + (dy / d) * r; }
      else { // centre inside: push out the nearest face
        const l = x - b.x, rr = b.x + b.w - x, t = y - b.y, bb = b.y + b.h - y, m = Math.min(l, rr, t, bb);
        if (m === l) x = b.x - r; else if (m === rr) x = b.x + b.w + r; else if (m === t) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  return [clamp(x, r, WORLD - r), clamp(y, r, WORLD - r), hit];
}
function drawBuilding(ctx, b, t) {
  ctx.fillStyle = b.roof; ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  ctx.fillStyle = b.wall; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
  const rng = makeRng(b.seed);
  const cols = Math.max(2, (b.w / 22) | 0);
  for (let r = 0; r < b.floors; r++) for (let c = 0; c < cols; c++) {
    const lit = rng() < 0.42;
    ctx.fillStyle = lit ? 'rgba(255,214,120,0.95)' : 'rgba(40,60,80,0.55)';
    ctx.fillRect(b.x + 6 + c * 22, b.y + 7 + r * 24, 12, 14);
  }
  if (b.shop) { ctx.fillStyle = '#e63946'; ctx.fillRect(b.x, b.y + b.h - 16, b.w, 10); ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y + b.h - 16, b.w, 2); }
}
function drawProp(ctx, p, t) {
  if (p.kind === 'palm') {
    ctx.strokeStyle = '#8a6b45'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 12); ctx.stroke();
    ctx.strokeStyle = '#3f9e4d'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + t * 0.0004; ctx.beginPath(); ctx.moveTo(p.x + 3, p.y - 12); ctx.lineTo(p.x + 3 + Math.cos(a) * 11, p.y - 12 + Math.sin(a) * 6 - 3); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 9, 4, 0, 0, 7); ctx.fill();
  } else if (p.kind === 'lamp') {
    ctx.fillStyle = '#444'; ctx.fillRect(p.x - 1.5, p.y - 10, 3, 12);
    ctx.fillStyle = '#ffe9a3'; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,233,163,0.18)'; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 10, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#d23b3b'; ctx.fillRect(p.x - 3, p.y - 6, 6, 8); ctx.fillStyle = '#ffb3b3'; ctx.fillRect(p.x - 3, p.y - 6, 6, 2);
  }
}
export function drawCity(ctx, city, cam, vw, vh, t) {
  const x0 = cam.x - vw / 2 - 60, y0 = cam.y - vh / 2 - 60, x1 = cam.x + vw / 2 + 60, y1 = cam.y + vh / 2 + 60;
  // ground: blocks grass/plaza
  ctx.fillStyle = '#79a86b'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // beach + water
  ctx.fillStyle = '#f2dc9b'; ctx.fillRect(0, BEACH_Y, WORLD, WORLD - BEACH_Y);
  const grad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD);
  grad.addColorStop(0, '#3ec6d8'); grad.addColorStop(1, '#1668a8');
  ctx.fillStyle = grad; ctx.fillRect(0, WATER_Y, WORLD, WORLD - WATER_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const wy = WATER_Y + 14 + i * 14, off = Math.sin(t * 0.001 + i) * 22; ctx.beginPath(); ctx.moveTo(Math.max(0, x0) + off, wy); ctx.lineTo(Math.min(WORLD, x1) + off, wy); ctx.stroke(); }
  // sidewalks
  ctx.fillStyle = '#cfc8bb';
  for (let i = 0; i <= 8; i++) { ctx.fillRect(i * CELL - 8, 0, ROAD + 16, WORLD); ctx.fillRect(0, i * CELL - 8, WORLD, ROAD + 16); }
  // roads
  ctx.fillStyle = '#3d4148';
  for (let i = 0; i <= 8; i++) { if (i * CELL < WORLD) { ctx.fillRect(i * CELL, 0, ROAD, WORLD); ctx.fillRect(0, i * CELL, WORLD, ROAD); } }
  // lane markings
  ctx.strokeStyle = 'rgba(255,205,60,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([18, 16]);
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL + ROAD / 2, 0); ctx.lineTo(i * CELL + ROAD / 2, WORLD); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL + ROAD / 2); ctx.lineTo(WORLD, i * CELL + ROAD / 2); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2;
  for (let bx = 0; bx < 8; bx++) for (let by = 0; by < 8; by++) { // crosswalks at intersections
    const ix = bx * CELL, iy = by * CELL;
    if (ix > x1 || iy > y1 || ix + ROAD < x0 || iy + ROAD < y0) continue;
    for (let s = 0; s < 5; s++) { ctx.beginPath(); ctx.moveTo(ix + 8 + s * 20, iy + ROAD + 3); ctx.lineTo(ix + 8 + s * 20, iy + ROAD + 13); ctx.stroke(); }
  }
  for (const b of city.buildings) if (b.x + b.w > x0 && b.x < x1 && b.y + b.h > y0 && b.y < y1) drawBuilding(ctx, b, t);
  for (const p of city.props) if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) drawProp(ctx, p, t);
}
