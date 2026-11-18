// city.js — Coral Marina's layout: a road grid, city blocks with buildings, props,
// and the sand/water strip on the east edge. Also owns collision against buildings
// and all world rendering except entities.
import { makeRng, pick, randRange, clamp } from './rng.js';

export const PITCH = 320;          // distance between road centerlines
export const ROAD_W = 96;          // road width
export const COLS = 6, ROWS = 5;   // blocks across / down
export const GRID_W = COLS * PITCH + ROAD_W;   // 2016
export const GRID_H = ROWS * PITCH + ROAD_W;   // 1696
export const BEACH_W = 320;
export const WORLD_W = GRID_W + BEACH_W;       // 2336
export const WORLD_H = GRID_H;
export const WATER_X = GRID_W + 190;           // water starts here

export const vRoads = []; // center x of each vertical road
export const hRoads = []; // center y of each horizontal road
for (let i = 0; i <= COLS; i++) vRoads.push(ROAD_W / 2 + i * PITCH);
for (let j = 0; j <= ROWS; j++) hRoads.push(ROAD_W / 2 + j * PITCH);

export const buildings = []; // {x,y,w,h,color,roof,windows:[{x,y,lit}]}
export const props = [];     // {kind:'palm'|'lamp'|'hydrant', x, y, sway}
const PALETTE = ['#e2725b', '#e8a87c', '#85c7b8', '#f2d492', '#c97b84', '#7fb3d5', '#f0e6d2', '#d98880', '#a3c585', '#e6b0aa'];
const ROOFS = ['#8d6e63', '#6d4c41', '#795548', '#5d4037', '#4e342e'];

export function buildCity(seed) {
  buildings.length = 0; props.length = 0;
  const rng = makeRng(seed * 7919 + 13);
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
    const bx = ROAD_W + i * PITCH + 16, by = ROAD_W + j * PITCH + 16;
    const bw = PITCH - ROAD_W - 32, bh = bw;
    // One big tower or a pair of smaller buildings per block.
    const split = rng() < 0.45;
    const rects = split
      ? [{ x: bx, y: by, w: bw * 0.46, h: bh }, { x: bx + bw * 0.54, y: by, w: bw * 0.46, h: bh }]
      : [{ x: bx + bw * 0.08, y: by + bh * 0.08, w: bw * 0.84, h: bh * 0.84 }];
    for (const r of rects) {
      const b = { ...r, color: pick(rng, PALETTE), roof: pick(rng, ROOFS), windows: [] };
      const cols = Math.max(2, (r.w / 26) | 0), rows = Math.max(2, (r.h / 26) | 0);
      for (let wx = 0; wx < cols; wx++) for (let wy = 0; wy < rows; wy++)
        if (rng() < 0.62) b.windows.push({ x: 10 + wx * 24 + rng() * 4, y: 10 + wy * 24 + rng() * 4, lit: rng() < 0.4, warm: rng() < 0.7 });
      buildings.push(b);
    }
    // Props on block corners: palms near the beach side, lamps everywhere, a hydrant now and then.
    const corners = [[bx - 8, by - 8], [bx + bw + 8, by - 8], [bx - 8, by + bh + 8], [bx + bw + 8, by + bh + 8]];
    for (const [cx, cy] of corners) {
      const roll = rng();
      if (roll < 0.4) props.push({ kind: 'lamp', x: cx, y: cy, sway: rng() * 6 });
      else if (roll < 0.52) props.push({ kind: 'hydrant', x: cx, y: cy, sway: 0 });
    }
    if (i >= COLS - 2 && rng() < 0.8) props.push({ kind: 'palm', x: bx + rng() * bw, y: by - 12, sway: rng() * 6 });
  }
  // Beach palms along the sand.
  for (let y = 60; y < WORLD_H - 40; y += 130 + rng() * 90)
    props.push({ kind: 'palm', x: GRID_W + 40 + rng() * 90, y, sway: rng() * 6 });
  return { buildings, props };
}

export function onRoad(x, y) {
  if (x > GRID_W) return false;
  const mx = ((x % PITCH) + PITCH) % PITCH, my = ((y % PITCH) + PITCH) % PITCH;
  return mx < ROAD_W || my < ROAD_W;
}
export function onSidewalk(x, y) {
  if (x > GRID_W || y > GRID_H) return x >= GRID_W && x < WATER_X;
  const mx = ((x % PITCH) + PITCH) % PITCH, my = ((y % PITCH) + PITCH) % PITCH;
  const inBlockX = mx >= ROAD_W - 14 && mx < PITCH - ROAD_W + 14 + ROAD_W - PITCH + PITCH; // generous band
  return !onRoad(x, y) && (mx < ROAD_W + 16 || my < ROAD_W + 16 || mx > PITCH - 16 || my > PITCH - 16 || inBlockX);
}
export function inWater(x, y) { return x >= WATER_X; }

// Push a circle out of every building rect and the water line. Returns impact speed (0 = no hit).
export function collideWorld(e, r) {
  let impact = 0;
  for (const b of buildings) {
    const nx = clamp(e.x, b.x, b.x + b.w), ny = clamp(e.y, b.y, b.y + b.h);
    const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      const push = r - d;
      const ux = d2 > 0.01 ? dx / d : 1, uy = d2 > 0.01 ? dy / d : 0;
      const vn = (e.vx || 0) * ux + (e.vy || 0) * uy;
      if (vn < 0) { impact = Math.max(impact, -vn); if (e.vx !== undefined) { e.vx -= vn * ux; e.vy -= vn * uy; } }
      e.x += ux * push; e.y += uy * push;
    }
  }
  if (e.x > WATER_X - r) { if (e.vx > 0) { impact = Math.max(impact, e.vx); e.vx = 0; } e.x = WATER_X - r; }
  e.x = clamp(e.x, r, WORLD_W - r); e.y = clamp(e.y, r, WORLD_H - r);
  return impact;
}

function drawBuilding(ctx, b, t) {
  ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.roof; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x + 5, b.y + b.h - 14, b.w - 10, 9);
  for (const w of b.windows) {
    const flicker = w.lit && Math.sin(t * 0.7 + w.x * 1.7 + w.y) > 0.96;
    ctx.fillStyle = w.lit ? (flicker ? '#fff6c9' : (w.warm ? '#ffd97a' : '#bfe8ff')) : 'rgba(30,40,60,0.55)';
    ctx.fillRect(b.x + w.x, b.y + w.y, 11, 8);
  }
}
function drawProp(ctx, p, t) {
  if (p.kind === 'palm') {
    ctx.strokeStyle = '#8a6642'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 3, p.y - 12, p.x + 6, p.y - 20); ctx.stroke();
    ctx.strokeStyle = '#3f9e4d'; ctx.lineWidth = 3;
    const sw = Math.sin(t * 1.3 + p.sway) * 2;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + p.sway;
      ctx.beginPath(); ctx.moveTo(p.x + 6, p.y - 20);
      ctx.quadraticCurveTo(p.x + 6 + Math.cos(a) * 10 + sw, p.y - 26, p.x + 6 + Math.cos(a) * 17 + sw, p.y - 18 + Math.sin(a) * 5);
      ctx.stroke();
    }
  } else if (p.kind === 'lamp') {
    ctx.fillStyle = '#37474f'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,233,168,0.13)'; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#d84343'; ctx.fillRect(p.x - 3, p.y - 4, 6, 8);
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(p.x - 3, p.y - 4, 6, 2);
  }
}

export function drawCity(ctx, cam, t, vw, vh) {
  const x0 = cam.x - vw / 2 - 40, y0 = cam.y - vh / 2 - 40, x1 = cam.x + vw / 2 + 40, y1 = cam.y + vh / 2 + 40;
  // Base: block ground (sidewalk concrete), then roads, then beach + water.
  ctx.fillStyle = '#b8b0a4'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = '#f4d58d'; ctx.fillRect(GRID_W, 0, BEACH_W, WORLD_H); // sand
  const wg = ctx.createLinearGradient(WATER_X, 0, WORLD_W, 0);
  wg.addColorStop(0, '#3ec6d8'); wg.addColorStop(1, '#1a7fb8');
  ctx.fillStyle = wg; ctx.fillRect(WATER_X, 0, WORLD_W - WATER_X, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  for (let y = 30; y < WORLD_H; y += 64) {
    ctx.beginPath();
    for (let x = WATER_X + 6; x < WORLD_W; x += 18) ctx.lineTo(x, y + Math.sin(t * 1.4 + x * 0.05 + y) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#3b3f46';
  for (const cx of vRoads) ctx.fillRect(cx - ROAD_W / 2, 0, ROAD_W, GRID_H);
  for (const cy of hRoads) ctx.fillRect(0, cy - ROAD_W / 2, GRID_W, ROAD_W);
  // Lane markings: dashed centerlines, skipped inside intersections.
  ctx.strokeStyle = '#f7e08a'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  for (const cx of vRoads) { ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, GRID_H); ctx.stroke(); }
  for (const cy of hRoads) { ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(GRID_W, cy); ctx.stroke(); }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,240,0.5)';
  for (const cx of vRoads) for (const cy of hRoads) {
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(cx + k * 16 - 5, cy - ROAD_W / 2 - 8, 10, 6);
      ctx.fillRect(cx + k * 16 - 5, cy + ROAD_W / 2 + 2, 10, 6);
      ctx.fillRect(cx - ROAD_W / 2 - 8, cy + k * 16 - 5, 6, 10);
      ctx.fillRect(cx + ROAD_W / 2 + 2, cy + k * 16 - 5, 6, 10);
    }
  }
  for (const b of buildings) if (b.x + b.w > x0 && b.x < x1 && b.y + b.h > y0 && b.y < y1) drawBuilding(ctx, b, t);
  for (const p of props) if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) drawProp(ctx, p, t);
}
