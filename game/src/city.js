// city.js — Coral Marina: a seeded 3200x3200 grid city on the coast.
// West edge is ocean + sand beach; inland is a road grid with building
// blocks, a few parks, a marina pier and a downtown core near the centre.
import { makeRng } from './rng.js';

export const CITY_SIZE = 3200;
export const WATER_EDGE = 170;
export const SAND_EDGE = 235;
export const ROAD_WIDTH = 64;
export const ROAD_STEP = 320;

const ROOF_COLORS = ['#b0563a', '#7a6a8f', '#4f7d6b', '#8f7a4f', '#5d6f8f', '#96604f', '#6b8f5d', '#8f5d6b'];
const WALL_COLORS = ['#c9b8a3', '#b8a89a', '#a8b0b8', '#c2a98f', '#9aa78f'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const roadsV = [];
  const roadsH = [];
  for (let p = ROAD_STEP; p < CITY_SIZE; p += ROAD_STEP) {
    roadsV.push(p);
    roadsH.push(p);
  }
  const buildings = [];
  const parks = [];
  const trees = [];
  // Blocks between neighbouring roads (and the beach strip / east edge).
  const bounds = [SAND_EDGE + 30, ...roadsV, CITY_SIZE - 20];
  for (let bi = 0; bi < bounds.length - 1; bi++) {
    for (let bj = 0; bj < bounds.length - 1; bj++) {
      const x0 = bounds[bi] + ROAD_WIDTH / 2 + 14;
      const x1 = bounds[bi + 1] - ROAD_WIDTH / 2 - 14;
      const y0 = bounds[bj] + ROAD_WIDTH / 2 + 14;
      const y1 = bounds[bj + 1] - ROAD_WIDTH / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const downtown = Math.hypot(cx - 1600, cy - 1600) < 620;
      if (rng.chance(0.14)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(4, 9);
        for (let t = 0; t < n; t++) {
          trees.push({ x: rng.range(x0 + 12, x1 - 12), y: rng.range(y0 + 12, y1 - 12), r: rng.range(7, 13) });
        }
        continue;
      }
      const count = downtown ? rng.int(2, 4) : rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const w = rng.range(70, Math.min(150, (x1 - x0) / count));
        const h = rng.range(70, Math.min(150, y1 - y0));
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x, y, w, h,
          roof: rng.pick(ROOF_COLORS),
          wall: rng.pick(WALL_COLORS),
          tall: downtown && rng.chance(0.5),
        });
      }
    }
  }
  // Marina pier jutting into the water at mid-height.
  const pier = { x: 30, y: 1500, w: 150, h: 26 };
  const docks = [];
  for (let i = 0; i < 5; i++) docks.push({ x: 60 + i * 22, y: 1560 + (i % 2) * 40 });
  return {
    size: CITY_SIZE, seed, roadsV, roadsH, buildings, parks, trees, pier, docks,
    spawn: { x: 480, y: 480 },
    fixer: { x: 1600, y: 1560, name: 'Marisol Vega' },
  };
}

export function isWaterAt(city, x, y) {
  return x < WATER_EDGE || x > city.size || y < 0 || y > city.size;
}

export function isSandAt(city, x, y) {
  return x >= WATER_EDGE && x < SAND_EDGE && y >= 0 && y <= city.size;
}

export function isRoadAt(city, x, y) {
  const half = ROAD_WIDTH / 2;
  for (const rx of city.roadsV) if (Math.abs(x - rx) < half) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) < half) return true;
  return false;
}

// Push a circle out of any building it overlaps; returns corrected position.
export function resolveBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        x = b.x - r;
      }
    }
  }
  return { x, y };
}

export function clampToCity(city, x, y, margin = 24) {
  return {
    x: Math.max(WATER_EDGE + margin, Math.min(city.size - margin, x)),
    y: Math.max(margin, Math.min(city.size - margin, y)),
  };
}

// A random point on a road lane, with the lane's travel direction (radians).
export function randomRoadPoint(rng, city) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(city.roadsV);
    const y = rng.range(ROAD_STEP, city.size - ROAD_STEP);
    const dir = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    return { x: rx + rng.range(-14, 14), y, angle: dir };
  }
  const ry = rng.pick(city.roadsH);
  const x = rng.range(ROAD_STEP, city.size - ROAD_STEP);
  const dir = rng.chance(0.5) ? 0 : Math.PI;
  return { x, y: ry + rng.range(-14, 14), angle: dir };
}

// A random sidewalk point (just off a road) for pedestrians.
export function randomSidewalkPoint(rng, city) {
  const p = randomRoadPoint(rng, city);
  const off = ROAD_WIDTH / 2 + 16;
  const nx = Math.cos(p.angle + Math.PI / 2) * off;
  const ny = Math.sin(p.angle + Math.PI / 2) * off;
  return { x: p.x + nx, y: p.y + ny };
}

export function drawCity(ctx, city, cam) {
  const { x: vx, y: vy, w: vw, h: vh } = cam;
  // Ground: grass inland, sand strip, ocean.
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(vx, vy, vw, vh);
  ctx.fillStyle = '#2f6fb2';
  ctx.fillRect(vx, vy, Math.max(0, WATER_EDGE - vx), vh);
  ctx.fillStyle = '#d9c184';
  ctx.fillRect(Math.max(vx, WATER_EDGE), vy, Math.max(0, Math.min(SAND_EDGE, vx + vw) - Math.max(vx, WATER_EDGE)), vh);
  // Parks.
  ctx.fillStyle = '#4a7a3d';
  for (const p of city.parks) ctx.fillRect(p.x, p.y, p.w, p.h);
  // Roads.
  ctx.fillStyle = '#3a3a40';
  for (const rx of city.roadsV) ctx.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, city.size);
  for (const ry of city.roadsH) ctx.fillRect(0, ry - ROAD_WIDTH / 2, city.size, ROAD_WIDTH);
  // Centre dashes.
  ctx.fillStyle = '#d8c95a';
  for (const rx of city.roadsV) {
    for (let y = 0; y < city.size; y += 48) ctx.fillRect(rx - 2, y, 4, 24);
  }
  for (const ry of city.roadsH) {
    for (let x = 0; x < city.size; x += 48) ctx.fillRect(x, ry - 2, 24, 4);
  }
  // Sidewalks: pale strips along each road.
  ctx.fillStyle = 'rgba(200,200,190,0.55)';
  for (const rx of city.roadsV) {
    ctx.fillRect(rx - ROAD_WIDTH / 2 - 10, 0, 8, city.size);
    ctx.fillRect(rx + ROAD_WIDTH / 2 + 2, 0, 8, city.size);
  }
  for (const ry of city.roadsH) {
    ctx.fillRect(0, ry - ROAD_WIDTH / 2 - 10, city.size, 8);
    ctx.fillRect(0, ry + ROAD_WIDTH / 2 + 2, city.size, 8);
  }
  // Buildings with roof + wall edge + tall shadow.
  for (const b of city.buildings) {
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    }
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 6);
  }
  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8a3f';
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Marina pier + moored boats.
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  ctx.fillStyle = '#e8e8e8';
  for (const d of city.docks) {
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, 14, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fixer's spot: pink awning marker at the marina office.
  ctx.fillStyle = '#e84a8a';
  ctx.beginPath();
  ctx.arc(city.fixer.x, city.fixer.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M', city.fixer.x, city.fixer.y + 4);
}
