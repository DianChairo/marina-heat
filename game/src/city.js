// city.js — Coral Marina: a 3200x3200 procedurally generated coastal
// city. A street grid with city blocks, palm trees, and water with a
// marina along the east and south edges. Everything is derived from the
// seed via Rng, so seed 7 always builds the same city.

import { Rng } from './rng.js';

export const WORLD = 3200;
export const BLOCK = 256; // distance between street centrelines
export const ROAD_W = 76; // full road width
export const WATER_X = 2880; // water east of this line
export const WATER_Y = 2880; // water south of this line

const BUILDING_COLORS = [
  '#e8b4a0', '#f2d5a7', '#a8c8ec', '#f7e8c9', '#d98e7e', '#9fd8c9',
  '#f4a9c0', '#cbb8ea', '#ffe3a3', '#b5e0a8', '#f9c784', '#a3d2f0',
];
const ROOF_COLORS = ['#8a4b3a', '#5d6d7e', '#7a5c48', '#49657a', '#6e4a5e', '#546e4a'];

export function isWater(x, y) {
  return x > WATER_X || y > WATER_Y;
}

export function isOnRoad(x, y) {
  if (isWater(x, y)) return false;
  const mx = ((x % BLOCK) + BLOCK) % BLOCK;
  const my = ((y % BLOCK) + BLOCK) % BLOCK;
  const half = ROAD_W / 2;
  return mx < half || mx > BLOCK - half || my < half || my > BLOCK - half;
}

// Distance from a point to the nearest road centreline axis, used to
// keep buildings and palms off the asphalt.
function axisDist(v) {
  const m = ((v % BLOCK) + BLOCK) % BLOCK;
  return Math.min(m, BLOCK - m);
}

export function generateCity(seed) {
  const rng = new Rng(seed * 7919 + 13);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const parkedSpots = [];
  const docks = [];
  const boats = [];

  // City blocks sit between streets: block (bx,by) spans
  // [bx*BLOCK + ROAD_W/2, (bx+1)*BLOCK - ROAD_W/2] on each axis.
  const inset = ROAD_W / 2 + 8;
  for (let bx = 0; bx < WORLD / BLOCK; bx++) {
    for (let by = 0; by < WORLD / BLOCK; by++) {
      const x0 = bx * BLOCK + inset;
      const y0 = by * BLOCK + inset;
      const size = BLOCK - inset * 2;
      if (isWater(x0 + size / 2, y0 + size / 2)) continue;
      const style = rng.int(0, 2);
      if (style === 0) {
        // One big building per block.
        buildings.push({
          x: x0 + 6, y: y0 + 6, w: size - 12, h: size - 12,
          color: rng.pick(BUILDING_COLORS), roof: rng.pick(ROOF_COLORS),
          floors: rng.int(2, 9),
        });
      } else if (style === 1) {
        // Four smaller buildings.
        const half = size / 2;
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            buildings.push({
              x: x0 + i * half + 5, y: y0 + j * half + 5,
              w: half - 10, h: half - 10,
              color: rng.pick(BUILDING_COLORS), roof: rng.pick(ROOF_COLORS),
              floors: rng.int(1, 5),
            });
          }
        }
      } else {
        // Plaza block: one low building plus palms.
        buildings.push({
          x: x0 + size * 0.25, y: y0 + size * 0.25, w: size * 0.5, h: size * 0.5,
          color: rng.pick(BUILDING_COLORS), roof: rng.pick(ROOF_COLORS),
          floors: 1,
        });
        for (let k = 0; k < 5; k++) {
          palms.push({
            x: x0 + rng.range(8, size - 8),
            y: y0 + rng.range(8, size - 8),
            s: rng.range(0.8, 1.3),
          });
        }
      }
    }
  }

  // Palm rows along the beach promenade and scattered on sidewalks.
  for (let y = 200; y < WATER_Y - 60; y += 90) {
    palms.push({ x: WATER_X - 46 + rng.range(-6, 6), y, s: rng.range(0.9, 1.4) });
  }
  for (let x = 200; x < WATER_X - 60; x += 90) {
    palms.push({ x, y: WATER_Y - 46 + rng.range(-6, 6), s: rng.range(0.9, 1.4) });
  }
  for (let i = 0; i < 130; i++) {
    const x = rng.range(60, WATER_X - 40);
    const y = rng.range(60, WATER_Y - 40);
    if (axisDist(x) > ROAD_W / 2 + 14 && axisDist(y) > ROAD_W / 2 + 14) {
      palms.push({ x, y, s: rng.range(0.75, 1.25) });
    }
  }

  // Street lamps at intersections.
  for (let gx = 0; gx <= WORLD / BLOCK; gx++) {
    for (let gy = 0; gy <= WORLD / BLOCK; gy++) {
      const x = gx * BLOCK;
      const y = gy * BLOCK;
      if (!isWater(x, y)) lamps.push({ x: x + ROAD_W / 2 + 6, y: y + ROAD_W / 2 + 6 });
    }
  }

  // Parked-car spots hug the kerbs of horizontal streets.
  for (let gy = 0; gy < WORLD / BLOCK; gy++) {
    for (let gx = 0; gx < WORLD / BLOCK; gx++) {
      if (!rng.chance(0.55)) continue;
      const x = gx * BLOCK + rng.range(70, 180);
      const y = gy * BLOCK + (rng.chance(0.5) ? ROAD_W / 2 - 13 : -ROAD_W / 2 + 13);
      if (y < 20 || isWater(x, y)) continue;
      parkedSpots.push({ x, y, angle: 0 });
    }
  }

  // Marina: wooden docks reaching into the eastern water, with boats.
  for (let i = 0; i < 5; i++) {
    const y = 420 + i * 470 + rng.range(-40, 40);
    const len = rng.range(150, 240);
    docks.push({ x: WATER_X, y, len, w: 26 });
    const n = rng.int(2, 4);
    for (let b = 0; b < n; b++) {
      boats.push({
        x: WATER_X + 40 + (len - 60) * (b / Math.max(1, n - 1)) + rng.range(-8, 8),
        y: y + (b % 2 === 0 ? -30 : 30),
        angle: rng.range(-0.15, 0.15),
        color: rng.pick(['#ffffff', '#ffd9d0', '#cfe8ff', '#fff3b0', '#ffc7e3']),
        len: rng.range(34, 52),
      });
    }
  }
  // A couple of docks on the southern shore too.
  for (let i = 0; i < 3; i++) {
    const x = 700 + i * 800 + rng.range(-40, 40);
    const len = rng.range(140, 210);
    docks.push({ x, y: WATER_Y, len, w: 26, vertical: true });
    boats.push({
      x: x - 30, y: WATER_Y + 60 + rng.range(0, len - 80),
      angle: Math.PI / 2 + rng.range(-0.12, 0.12),
      color: rng.pick(['#ffffff', '#ffe9a8', '#d6f5ff']),
      len: rng.range(34, 48),
    });
  }

  // Marisol Vega's corner: on the beach promenade by the marina,
  // east of the last building line so she is always reachable.
  const marisol = { x: WATER_X - 56, y: 640 };

  return {
    seed,
    buildings,
    palms,
    lamps,
    parkedSpots,
    docks,
    boats,
    marisol,
  };
}

// Solid-rectangle collision for buildings. Returns true if the circle
// at (x,y,r) overlaps any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
      return b;
    }
  }
  return null;
}

// Clamp a position into the walkable land area (not deep water, not
// outside the world).
export function clampToLand(x, y, r) {
  return {
    x: Math.max(r, Math.min(WORLD - r, x)),
    y: Math.max(r, Math.min(WORLD - r, y)),
  };
}

export function drawCity(ctx, city, cam) {
  const vx = cam.x;
  const vy = cam.y;
  const vw = cam.w;
  const vh = cam.h;

  // Water base everywhere; land is drawn over it.
  ctx.fillStyle = '#1d6f9f';
  ctx.fillRect(0, 0, vw, vh);
  // Water sparkle bands (cheap, deterministic by world position).
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const bandStep = 90;
  const startBand = Math.floor(vy / bandStep) * bandStep;
  for (let wy = startBand; wy < vy + vh + bandStep; wy += bandStep) {
    ctx.fillRect(0, wy - vy + ((wy / bandStep) % 2) * 30, vw, 3);
  }

  // Landmass.
  ctx.fillStyle = '#79b657';
  const landW = Math.min(vw, WATER_X - vx);
  const landH = Math.min(vh, WATER_Y - vy);
  if (landW > 0 && landH > 0) ctx.fillRect(0, 0, landW, landH);

  // Sandy beach strip along both shores.
  ctx.fillStyle = '#ecd28f';
  if (WATER_X - vx > 0 && WATER_X - vx < vw) {
    ctx.fillRect(WATER_X - vx - 26, 0, 26, Math.min(vh, WATER_Y - vy + 26));
  }
  if (WATER_Y - vy > 0 && WATER_Y - vy < vh) {
    ctx.fillRect(0, WATER_Y - vy - 26, Math.min(vw, WATER_X - vx + 26), 26);
  }

  drawRoads(ctx, vx, vy, vw, vh);
  drawBlocks(ctx, city, vx, vy, vw, vh);
  drawMarina(ctx, city, vx, vy);
}

function drawRoads(ctx, vx, vy, vw, vh) {
  ctx.fillStyle = '#3c4148';
  // Vertical streets.
  for (let gx = 0; gx <= WORLD / BLOCK; gx++) {
    const sx = gx * BLOCK - vx;
    if (sx + ROAD_W / 2 < 0 || sx - ROAD_W / 2 > vw) continue;
    const top = Math.max(0, -vy);
    const bottom = Math.min(vh, WATER_Y - vy);
    if (bottom > top) ctx.fillRect(sx - ROAD_W / 2, top, ROAD_W, bottom - top);
  }
  // Horizontal streets.
  for (let gy = 0; gy <= WORLD / BLOCK; gy++) {
    const sy = gy * BLOCK - vy;
    if (sy + ROAD_W / 2 < 0 || sy - ROAD_W / 2 > vh) continue;
    const left = Math.max(0, -vx);
    const right = Math.min(vw, WATER_X - vx);
    if (right > left) ctx.fillRect(left, sy - ROAD_W / 2, right - left, ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8d44d';
  const dash = 26;
  const gap = 20;
  for (let gx = 0; gx <= WORLD / BLOCK; gx++) {
    const sx = gx * BLOCK - vx;
    if (sx < -4 || sx > vw + 4) continue;
    for (let wy = 0; wy < WATER_Y; wy += dash + gap) {
      const sy = wy - vy;
      if (sy > -dash && sy < vh) ctx.fillRect(sx - 2, sy, 4, dash);
    }
  }
  for (let gy = 0; gy <= WORLD / BLOCK; gy++) {
    const sy = gy * BLOCK - vy;
    if (sy < -4 || sy > vh + 4) continue;
    for (let wx = 0; wx < WATER_X; wx += dash + gap) {
      const sx = wx - vx;
      if (sx > -dash && sx < vw) ctx.fillRect(sx, sy - 2, dash, 4);
    }
  }
}

function drawBlocks(ctx, city, vx, vy, vw, vh) {
  for (const b of city.buildings) {
    const sx = b.x - vx;
    const sy = b.y - vy;
    if (sx + b.w < 0 || sy + b.h < 0 || sx > vw || sy > vh) continue;
    // Sidewalk apron.
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(sx - 5, sy - 5, b.w + 10, b.h + 10);
    // Drop shadow then body.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(sx + 6, sy + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(sx, sy, b.w, b.h);
    // Roof inset.
    ctx.fillStyle = b.roof;
    const inset = 8 + b.floors;
    ctx.fillRect(sx + inset, sy + inset, Math.max(4, b.w - inset * 2), Math.max(4, b.h - inset * 2));
    // Window dots on tall buildings.
    if (b.floors >= 3) {
      ctx.fillStyle = 'rgba(255,255,220,0.5)';
      const step = 22;
      for (let wx = sx + 12; wx < sx + b.w - 10; wx += step) {
        for (let wy = sy + 12; wy < sy + b.h - 10; wy += step) {
          ctx.fillRect(wx, wy, 5, 5);
        }
      }
    }
  }
  // Palms: trunk + fronds.
  for (const p of city.palms) {
    const sx = p.x - vx;
    const sy = p.y - vy;
    if (sx < -30 || sy < -30 || sx > vw + 30 || sy > vh + 30) continue;
    ctx.strokeStyle = '#8a6b42';
    ctx.lineWidth = 3 * p.s;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 3 * p.s, sy - 10 * p.s);
    ctx.stroke();
    ctx.strokeStyle = '#2e8b3a';
    ctx.lineWidth = 2.4 * p.s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.x * 0.01;
      ctx.beginPath();
      ctx.moveTo(sx + 3 * p.s, sy - 10 * p.s);
      ctx.quadraticCurveTo(
        sx + 3 * p.s + Math.cos(a) * 9 * p.s,
        sy - 10 * p.s + Math.sin(a) * 5 * p.s - 3,
        sx + 3 * p.s + Math.cos(a) * 15 * p.s,
        sy - 10 * p.s + Math.sin(a) * 8 * p.s + 3,
      );
      ctx.stroke();
    }
  }
}

function drawMarina(ctx, city, vx, vy) {
  for (const d of city.docks) {
    ctx.fillStyle = '#9a7448';
    if (d.vertical) {
      ctx.fillRect(d.x - vx - d.w / 2, d.y - vy, d.w, d.len);
    } else {
      ctx.fillRect(d.x - vx, d.y - vy - d.w / 2, d.len, d.w);
    }
  }
  for (const b of city.boats) {
    const sx = b.x - vx;
    const sy = b.y - vy;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(b.len / 2, 0);
    ctx.lineTo(b.len / 4, -9);
    ctx.lineTo(-b.len / 2, -8);
    ctx.lineTo(-b.len / 2, 8);
    ctx.lineTo(b.len / 4, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a4a2b';
    ctx.fillRect(-4, -2, 10, 4);
    ctx.restore();
  }
}
