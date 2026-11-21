// Procedural Coral Marina: road grid, building blocks, palms, beach,
// water and the causeway to the docks. Everything derives from the seed.
import { WORLD, ROAD_STEP, ROAD_HALF, WATER_TOP, CAUSEWAY_X, CAUSEWAY_HALF, COLORS, rectHit } from './config.js';
import { makeRng } from './random.js';

export function generateCity(seed) {
  const rng = makeRng(seed);
  const roads = [];
  for (let p = 0; p <= WORLD; p += ROAD_STEP) {
    roads.push({ vertical: false, at: p });
    roads.push({ vertical: true, at: p });
  }
  const buildings = [];
  const palms = [];
  const lots = [];
  for (let gx = 0; gx < 8; gx++) {
    for (let gy = 0; gy < 7; gy++) {
      // Blocks sit between roads; the bottom row is beach / marina.
      const bx = gx * ROAD_STEP + ROAD_HALF + 14;
      const by = gy * ROAD_STEP + ROAD_HALF + 14;
      const bw = ROAD_STEP - ROAD_HALF * 2 - 28;
      const bh = ROAD_STEP - ROAD_HALF * 2 - 28;
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const w = rng.range(70, 130);
        const h = rng.range(60, 110);
        const x = bx + rng.range(0, Math.max(1, bw - w));
        const y = by + rng.range(0, Math.max(1, bh - h));
        const color = rng.pick(COLORS.building);
        buildings.push({ x, y, w, h, color, roof: rng.pick(COLORS.roof), floors: rng.int(1, 4) });
      }
      lots.push({ x: bx, y: by, w: bw, h: bh });
      // Palms along the block edges.
      const pn = rng.int(2, 5);
      for (let i = 0; i < pn; i++) {
        palms.push({ x: bx + rng.range(0, bw), y: by + rng.range(0, bh), s: rng.range(0.8, 1.4) });
      }
    }
  }
  // Beach palms along the water line and the causeway.
  for (let x = 120; x < WORLD; x += rng.range(90, 170)) {
    palms.push({ x, y: WATER_TOP - rng.range(20, 70), s: rng.range(1.0, 1.6) });
  }
  const docks = [];
  for (let i = 0; i < 5; i++) {
    docks.push({ x: CAUSEWAY_X - 260 + i * 130, y: WATER_TOP + 20, w: 26, h: 190 });
  }
  const boats = [];
  for (let i = 0; i < 9; i++) {
    boats.push({
      x: rng.range(200, WORLD - 200),
      y: rng.range(WATER_TOP + 60, WORLD - 90),
      angle: rng.range(-0.4, 0.4),
      len: rng.range(46, 90),
      color: rng.pick(['#e8e8e8', '#d4b84a', '#4a8ad4', '#d44a4a']),
    });
  }
  return { roads, buildings, palms, lots, docks, boats, seed };
}

export function isWater(city, x, y) {
  if (y < WATER_TOP) return false;
  // The causeway stays dry down to the docks.
  if (Math.abs(x - CAUSEWAY_X) < CAUSEWAY_HALF) return false;
  for (const d of city.docks) if (rectHit(x, y, d)) return false;
  return true;
}

export function isBlocked(city, x, y, radius) {
  if (x < radius || y < radius || x > WORLD - radius || y > WORLD - radius) return true;
  if (isWater(city, x, y)) return true;
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  // Snap to the closest road centre line.
  const rx = Math.round(x / ROAD_STEP) * ROAD_STEP;
  const ry = Math.round(y / ROAD_STEP) * ROAD_STEP;
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y, vertical: true };
  return { x, y: ry, vertical: false };
}

export function roadPointAt(city, gx, gy) {
  return { x: gx * ROAD_STEP, y: gy * ROAD_STEP };
}
