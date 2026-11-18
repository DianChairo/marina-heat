// Coral Marina: city grid data, rendering, collision.
// Layout: COLS x ROWS blocks, each block BLOCK px, roads ROAD px wide between them.
// East edge (x > BEACH_X) is sand then water.
import { makeRng } from './rng.js';

export const BLOCK = 210, ROAD = 64, SW = 10; // block size, road width, sidewalk width
export const COLS = 11, ROWS = 8;
export const WORLD_W = COLS * (BLOCK + ROAD) + ROAD;
export const WORLD_H = ROWS * (BLOCK + ROAD) + ROAD;
export const BEACH_X = WORLD_W - 150;

export const roadXs = []; // center lines of vertical roads
export const roadYs = [];
for (let i = 0; i <= COLS; i++) roadXs.push(ROAD / 2 + i * (BLOCK + ROAD));
for (let i = 0; i <= ROWS; i++) roadYs.push(ROAD / 2 + i * (BLOCK + ROAD));

const PALETTE = ['#e8b4a0', '#a8c8d8', '#f0d9a0', '#c9b8d8', '#9fd0b0', '#e8a0a8', '#b0c4e8', '#f5e6c8', '#d8c8a8', '#a0d8d0'];
export const buildings = []; // {x,y,w,h,color,roof,windows:[[x,y,lit]...]}
export const props = []; // {x,y,kind}
export const parkSpots = []; // {x,y,ang}

export function buildCity(seed) {
  buildings.length = 0; props.length = 0; parkSpots.length = 0;
  const rng = makeRng(seed * 7919 + 13);
  for (let cx = 0; cx < COLS; cx++) for (let cy = 0; cy < ROWS; cy++) {
    const bx = ROAD + cx * (BLOCK + ROAD), by = ROAD + cy * (BLOCK + ROAD);
    const n = rng.int(1, 2);
    for (let k = 0; k < n; k++) {
      const w = n === 1 ? BLOCK - 24 : (BLOCK - 30) / 2, h = BLOCK - 30 - rng.range(0, 40);
      const x = bx + 12 + (n === 2 ? k * ((BLOCK - 24) / 2 + 2) : 0), y = by + 14 + rng.range(0, 16);
      const wins = [];
      for (let wy = y + 10; wy < y + h - 8; wy += 16) for (let wx = x + 8; wx < x + w - 6; wx += 15)
        wins.push([wx, wy, rng.chance(0.45)]);
      buildings.push({ x, y, w, h, color: rng.pick(PALETTE), roof: rng.pick(['#8a6f5c', '#6b7a8a', '#7a5c6e', '#5c7a6a']), windows: wins });
    }
    // props around block edges
    const per = rng.int(3, 6);
    for (let k = 0; k < per; k++) {
      const side = rng.int(0, 3), t = rng.range(0.1, 0.9);
      let px, py;
      if (side === 0) { px = bx + t * BLOCK; py = by - 5; } else if (side === 1) { px = bx + t * BLOCK; py = by + BLOCK + 5; }
      else if (side === 2) { px = bx - 5; py = by + t * BLOCK; } else { px = bx + BLOCK + 5; py = by + t * BLOCK; }
      props.push({ x: px, y: py, kind: rng.pick(['palm', 'lamp', 'hydrant', 'palm']) });
    }
    // parked car spots along block edges
    if (rng.chance(0.8)) parkSpots.push({ x: bx + BLOCK / 2, y: by - 16, ang: 0 });
    if (rng.chance(0.6)) parkSpots.push({ x: bx - 16, y: by + BLOCK / 2, ang: Math.PI / 2 });
  }
}

export function isRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
  const mx = x % (BLOCK + ROAD), my = y % (BLOCK + ROAD);
  return mx < ROAD || my < ROAD;
}
export function isWater(x, y) { return x > BEACH_X + 130; }
export function isSand(x, y) { return x > BEACH_X && x <= BEACH_X + 130; }
export function nearestRoadCenter(x, y) {
  let bx = roadXs[0], by = roadYs[0], bd = 1e18;
  for (const rx of roadXs) { const d = Math.abs(rx - x); if (d < bd) { bd = d; bx = rx; } }
  bd = 1e18;
  for (const ry of roadYs) { const d = Math.abs(ry - y); if (d < bd) { bd = d; by = ry; } }
  return { x: bx, y: by };
}
// Circle vs buildings: returns push-out or null.
export function collideBuildings(x, y, r) {
  for (const b of buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w)), ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.01) return { x: x, y: b.y - r - 1, hit: true };
      const d = Math.sqrt(d2);
      return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, hit: true };
    }
  }
  return null;
}
export function pointInBuilding(x, y, pad = 0) {
  for (const b of buildings) if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  return null;
}

export function drawCity(ctx, cam, vw, vh, golden) {
  const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + vw + 60, y1 = cam.y + vh + 60;
  // ground: sidewalk base
  ctx.fillStyle = golden ? '#cbb59a' : '#b8ab94';
  ctx.fillRect(cam.x, cam.y, vw, vh);
  // sand + water
  ctx.fillStyle = '#ecd9a0'; ctx.fillRect(BEACH_X, 0, 130, WORLD_H);
  const wg = ctx.createLinearGradient(BEACH_X + 130, 0, WORLD_W + 200, 0);
  wg.addColorStop(0, '#3ec6d8'); wg.addColorStop(1, '#1668a8');
  ctx.fillStyle = wg; ctx.fillRect(BEACH_X + 130, 0, WORLD_W - BEACH_X, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  for (let y = 30; y < WORLD_H; y += 90) { ctx.beginPath(); ctx.moveTo(BEACH_X + 140 + Math.sin(y * 0.05) * 8, y); ctx.lineTo(BEACH_X + 175 + Math.sin(y * 0.05) * 8, y); ctx.stroke(); }
  // roads
  ctx.fillStyle = golden ? '#4c4c55' : '#43434c';
  for (const rx of roadXs) ctx.fillRect(rx - ROAD / 2, 0, ROAD, WORLD_H);
  for (const ry of roadYs) ctx.fillRect(0, ry - ROAD / 2, WORLD_W, ROAD);
  // lane markings
  ctx.strokeStyle = 'rgba(245,220,120,.75)'; ctx.lineWidth = 2; ctx.setLineDash([16, 14]);
  ctx.beginPath();
  for (const rx of roadXs) { ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); }
  for (const ry of roadYs) { ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); }
  ctx.stroke(); ctx.setLineDash([]);
  // crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (const rx of roadXs) for (const ry of roadYs) {
    if (rx < x0 || rx > x1 || ry < y0 || ry > y1) continue;
    for (let k = -2; k <= 2; k++) { ctx.fillRect(rx - ROAD / 2 + 3, ry + k * 11 - 3, 9, 6); ctx.fillRect(rx + ROAD / 2 - 12, ry + k * 11 - 3, 9, 6); }
  }
  // buildings
  for (const b of buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    for (const [wx, wy, lit] of b.windows) {
      ctx.fillStyle = lit ? (golden ? '#ffd76a' : '#ffe9a0') : 'rgba(40,50,70,.55)';
      ctx.fillRect(wx, wy, 8, 10);
    }
  }
  // props
  for (const p of props) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    if (p.kind === 'palm') {
      ctx.strokeStyle = '#7a5c38'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2, p.y - 12); ctx.stroke();
      ctx.strokeStyle = '#3f9e4d'; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(p.x + 2, p.y - 12); ctx.lineTo(p.x + 2 + Math.cos(a) * 11, p.y - 12 + Math.sin(a) * 6 - 3); ctx.stroke(); }
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#333'; ctx.fillRect(p.x - 1, p.y - 14, 3, 14);
      ctx.fillStyle = golden ? '#ffdf7a' : '#fff2b0'; ctx.beginPath(); ctx.arc(p.x, p.y - 15, 3.5, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#d23b2e'; ctx.fillRect(p.x - 3, p.y - 6, 6, 8);
      ctx.fillStyle = '#f0f0f0'; ctx.fillRect(p.x - 3, p.y - 8, 6, 3);
    }
  }
}
