// city.js — Coral Marina: a seeded 3200x3200 grid city on a beach.
// West edge is sand + water; the rest is a road grid with building blocks,
// a central plaza, a marina pier on the south shore and a park district.
import { makeRng } from './rng.js';

export const WORLD = 3200;
export const ROAD_GAP = 320;
export const ROAD_W = 46;

export function generateCity(seed) {
  const rng = makeRng(seed);
  const beach = { x0: 0, x1: 240 };          // sand strip on the west edge
  const water = { x0: -600, x1: 0 };        // open water west of the sand
  const roadsV = [];
  const roadsH = [];
  for (let x = 320; x < WORLD; x += ROAD_GAP) roadsV.push(x);
  for (let y = 320; y < WORLD; y += ROAD_GAP) roadsH.push(y);

  const buildings = [];
  const palette = ['#8d6e63', '#a1887f', '#90a4ae', '#b0bec5', '#ffcc80', '#ce93d8',
    '#81c784', '#64b5f6', '#e57373', '#fff176', '#4db6ac', '#ba68c8'];
  const roofs = ['#5d4037', '#37474f', '#4e342e', '#263238', '#6d4c41'];
  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 9; by++) {
      const x0 = 320 + bx * ROAD_GAP + ROAD_W / 2 + 14;
      const y0 = 320 + by * ROAD_GAP + ROAD_W / 2 + 14;
      const w = ROAD_GAP - ROAD_W - 28;
      const h = ROAD_GAP - ROAD_W - 28;
      if (bx === 4 && by === 4) continue; // central plaza
      if (bx === 0 && by >= 7) continue;  // marina district, open
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const bw = rng.range(w * 0.32, w * 0.62);
        const bh = rng.range(h * 0.32, h * 0.62);
        const px = x0 + rng.range(0, Math.max(1, w - bw));
        const py = y0 + rng.range(0, Math.max(1, h - bh));
        buildings.push({
          x: px, y: py, w: bw, h: bh,
          color: rng.pick(palette),
          roof: rng.pick(roofs),
          tall: rng.chance(0.3),
        });
      }
    }
  }

  const parks = [
    { x: 320 + 2 * ROAD_GAP + 30, y: 320 + 6 * ROAD_GAP + 30, w: 220, h: 220 },
    { x: 320 + 6 * ROAD_GAP + 30, y: 320 + 2 * ROAD_GAP + 30, w: 220, h: 220 },
  ];
  const plaza = { x: 320 + 4 * ROAD_GAP + 30, y: 320 + 4 * ROAD_GAP + 30, w: 220, h: 220 };
  const pier = { x: 300, y: WORLD - 420, w: 260, h: 60 };
  const marina = { x: 260, y: WORLD - 340, w: 420, h: 200 };

  return { seed, beach, water, roadsV, roadsH, buildings, parks, plaza, pier, marina };
}

export function isRoad(city, x, y) {
  if (x < 320 || y < 320) return false;
  for (const rx of city.roadsV) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoad(city, x, y) {
  let best = null; let bd = Infinity;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(city.roadsV), y: rng.range(340, WORLD - 40), vertical: true };
  }
  return { x: rng.range(340, WORLD - 40), y: rng.pick(city.roadsH), vertical: false };
}

export function randomSidewalkPoint(city, rng) {
  const bx = rng.int(0, 8); const by = rng.int(0, 8);
  const x0 = 320 + bx * ROAD_GAP + ROAD_W / 2 + 6;
  const y0 = 320 + by * ROAD_GAP + ROAD_W / 2 + 6;
  return { x: x0 + rng.range(0, ROAD_GAP - ROAD_W - 12), y: y0 + rng.range(0, ROAD_GAP - ROAD_W - 12) };
}
