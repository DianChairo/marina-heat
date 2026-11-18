// city.js — Coral Marina: a seeded procedural city on a 3200x3200 world.
// A regular street grid (roads every 400px, 104px wide) leaves square
// blocks that are filled with buildings, sidewalks and palm trees. The
// south-east corner is the marina: water, a boardwalk and dock fingers.

import { makeRng, clamp } from './rng.js';

export const WORLD = 3200;
export const CELL = 400;      // distance between street centrelines
export const ROAD = 104;      // road width
export const WATER_X = 2720;  // water starts at this x (east edge)
export const WATER_Y = 2560;  // ...and below this y in the south

const BUILDING_COLORS = [
  '#e8b4a0', '#d98e73', '#f2d5a7', '#a8c8bc', '#8fb6c9', '#e6e0f0',
  '#f0c8c8', '#cfe0b8', '#ffd9a0', '#b8c4de', '#e8a2b4', '#9fd8c9',
];
const ROOF_COLORS = ['#8a5a4a', '#6e7f8a', '#96705a', '#5f7263', '#7a6a8a', '#a0522d'];

export function isWater(x, y) {
  return x > WATER_X || (x > 2080 && y > WATER_Y);
}

export function roadCoord(v) {
  // Position inside the repeating 400px cell: < ROAD/2 either side of a
  // street centreline counts as road.
  const m = ((v % CELL) + CELL) % CELL;
  return Math.min(m, CELL - m) < ROAD / 2;
}

export function onRoad(x, y) {
  return roadCoord(x) || roadCoord(y);
}

export function nearestRoadCenter(v) {
  return Math.round(v / CELL) * CELL;
}

export class City {
  constructor(seed) {
    const rng = makeRng(seed);
    this.seed = seed;
    this.buildings = [];
    this.palms = [];
    this.lamps = [];
    this.props = [];
    this.colliders = [];

    for (let bx = 0; bx < WORLD / CELL; bx++) {
      for (let by = 0; by < WORLD / CELL; by++) {
        const x0 = bx * CELL + ROAD / 2 + 14;
        const y0 = by * CELL + ROAD / 2 + 14;
        const size = CELL - ROAD - 28;
        // Skip blocks that fall in the marina water.
        if (isWater(x0 + size / 2, y0 + size / 2)) continue;
        const layout = rng.int(1, 3);
        if (layout === 1) {
          this.addBuilding(rng, x0 + 8, y0 + 8, size - 16, size - 16);
        } else if (layout === 2) {
          const half = size / 2 - 6;
          this.addBuilding(rng, x0, y0, half, half);
          this.addBuilding(rng, x0 + size - half, y0, half, half);
          this.addBuilding(rng, x0, y0 + size - half, half, half);
          this.addBuilding(rng, x0 + size - half, y0 + size - half, half, half);
        } else {
          const w = size * rng.float(0.55, 0.8);
          const h = size * rng.float(0.5, 0.75);
          this.addBuilding(rng, x0 + (size - w) / 2, y0 + (size - h) / 2, w, h);
          // A small plaza prop in the leftover corner.
          this.props.push({
            x: x0 + rng.float(20, size - 20), y: y0 + rng.float(20, size - 20),
            r: rng.float(6, 11), kind: rng.pick(['planter', 'bench', 'kiosk']),
          });
        }
        // Palms along the block edge.
        const palmCount = rng.int(2, 5);
        for (let i = 0; i < palmCount; i++) {
          const edge = rng.int(0, 3);
          let px = x0;
          let py = y0;
          if (edge === 0) { px = x0 + rng.float(0, size); py = y0 - 6; }
          if (edge === 1) { px = x0 + rng.float(0, size); py = y0 + size + 6; }
          if (edge === 2) { px = x0 - 6; py = y0 + rng.float(0, size); }
          if (edge === 3) { px = x0 + size + 6; py = y0 + rng.float(0, size); }
          if (!isWater(px, py)) this.palms.push({ x: px, y: py, s: rng.float(0.8, 1.3), sway: rng.float(0, 6.28) });
        }
      }
    }

    // Street lamps at intersections.
    for (let gx = 0; gx <= WORLD / CELL; gx++) {
      for (let gy = 0; gy <= WORLD / CELL; gy++) {
        const x = gx * CELL;
        const y = gy * CELL;
        if (!isWater(x, y)) this.lamps.push({ x: x + ROAD / 2 + 8, y: y + ROAD / 2 + 8 });
      }
    }

    // Marina docks: wooden fingers reaching into the water.
    this.docks = [];
    for (let i = 0; i < 5; i++) {
      this.docks.push({ x: WATER_X + 30, y: 420 + i * 420, w: 210, h: 26 });
    }
    // Beach palms near the water line.
    for (let i = 0; i < 26; i++) {
      const x = WATER_X - rng.float(20, 90);
      const y = rng.float(80, WATER_Y - 60);
      this.palms.push({ x, y, s: rng.float(0.9, 1.5), sway: rng.float(0, 6.28) });
    }
  }

  addBuilding(rng, x, y, w, h) {
    const b = {
      x, y, w, h,
      color: rng.pick(BUILDING_COLORS),
      roof: rng.pick(ROOF_COLORS),
      floors: rng.int(2, 9),
      seed: rng.int(1, 99999),
    };
    this.buildings.push(b);
    this.colliders.push(b);
    return b;
  }

  collideCircle(x, y, r) {
    // Push a circle out of every building rect; returns corrected position.
    let nx = x;
    let ny = y;
    for (const b of this.colliders) {
      const cx = clamp(nx, b.x, b.x + b.w);
      const cy = clamp(ny, b.y, b.y + b.h);
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          ny = cy + (dy / d) * r;
        } else {
          // Centre inside the rect: push out along the smallest axis.
          const left = nx - b.x;
          const right = b.x + b.w - nx;
          const top = ny - b.y;
          const bottom = b.y + b.h - ny;
          const m = Math.min(left, right, top, bottom);
          if (m === left) nx = b.x - r;
          else if (m === right) nx = b.x + b.w + r;
          else if (m === top) ny = b.y - r;
          else ny = b.y + b.h + r;
        }
      }
    }
    nx = clamp(nx, r, WORLD - r);
    ny = clamp(ny, r, WORLD - r);
    return { x: nx, y: ny };
  }

  rectHitsBuilding(x, y, w, h) {
    for (const b of this.colliders) {
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return b;
    }
    return null;
  }

  draw(ctx, cam, vw, vh, time) {
    const x0 = cam.x - 60;
    const y0 = cam.y - 60;
    const x1 = cam.x + vw + 60;
    const y1 = cam.y + vh + 60;

    // Ground: warm sand-grass base.
    ctx.fillStyle = '#cdb98a';
    ctx.fillRect(cam.x, cam.y, vw, vh);

    // Water (drawn over the base where the marina is).
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(Math.max(x0, WATER_X), Math.max(y0, 0), x1 - Math.max(x0, WATER_X), y1 - Math.max(y0, 0));
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(Math.max(x0, 2080), Math.max(y0, WATER_Y), x1 - Math.max(x0, 2080), y1 - Math.max(y0, WATER_Y));
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const wy = ((i * 173 + Math.floor(time * 30)) % 900) + Math.floor(y0 / 900) * 900;
      if (wy > y0 && wy < y1) {
        ctx.moveTo(WATER_X + 30 + (i % 4) * 90, wy);
        ctx.lineTo(WATER_X + 90 + (i % 4) * 90, wy);
      }
    }
    ctx.stroke();
    // Sand beach strip along the water line.
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(WATER_X - 26, Math.max(y0, 0), 26, y1 - Math.max(y0, 0));
    ctx.fillRect(2080, WATER_Y - 26, x1 - 2080, 26);

    // Docks.
    for (const d of this.docks) {
      if (d.x > x1 || d.x + d.w < x0 || d.y > y1 || d.y + d.h < y0) continue;
      ctx.fillStyle = '#8a6a48';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#a37f56';
      for (let px = d.x + 8; px < d.x + d.w; px += 26) ctx.fillRect(px, d.y + 3, 16, d.h - 6);
    }

    // Roads: vertical then horizontal bands, with sidewalks.
    ctx.fillStyle = '#9a958c';
    for (let gx = 0; gx <= WORLD / CELL; gx++) {
      const rx = gx * CELL - ROAD / 2 - 8;
      if (rx + ROAD + 16 < x0 || rx > x1) continue;
      ctx.fillRect(rx, Math.max(y0, 0), ROAD + 16, Math.min(y1, WORLD) - Math.max(y0, 0));
    }
    for (let gy = 0; gy <= WORLD / CELL; gy++) {
      const ry = gy * CELL - ROAD / 2 - 8;
      if (ry + ROAD + 16 < y0 || ry > y1) continue;
      ctx.fillRect(Math.max(x0, 0), ry, Math.min(x1, WORLD) - Math.max(x0, 0), ROAD + 16);
    }
    ctx.fillStyle = '#4c4c52';
    for (let gx = 0; gx <= WORLD / CELL; gx++) {
      const rx = gx * CELL - ROAD / 2;
      if (rx + ROAD < x0 || rx > x1) continue;
      if (gx * CELL > WATER_X + 40) continue;
      ctx.fillRect(rx, Math.max(y0, 0), ROAD, Math.min(y1, WORLD) - Math.max(y0, 0));
    }
    for (let gy = 0; gy <= WORLD / CELL; gy++) {
      const ry = gy * CELL - ROAD / 2;
      if (ry + ROAD < y0 || ry > y1) continue;
      ctx.fillRect(Math.max(x0, 0), ry, Math.min(x1, gy * CELL > WATER_Y ? WORLD : WORLD) - Math.max(x0, 0), ROAD);
    }
    // Centre dashes.
    ctx.fillStyle = '#e8d878';
    for (let gx = 0; gx <= WORLD / CELL; gx++) {
      const cx = gx * CELL;
      if (cx < x0 || cx > x1 || cx > WATER_X + 40) continue;
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
        if (!roadCoord(y)) ctx.fillRect(cx - 2, y, 4, 24);
      }
    }
    for (let gy = 0; gy <= WORLD / CELL; gy++) {
      const cy = gy * CELL;
      if (cy < y0 || cy > y1) continue;
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
        if (!roadCoord(x)) ctx.fillRect(x, cy - 2, 24, 4);
      }
    }

    // Block ground (plazas / pavement inside blocks).
    ctx.fillStyle = '#bfb49a';
    for (let bx = 0; bx < WORLD / CELL; bx++) {
      for (let by = 0; by < WORLD / CELL; by++) {
        const px = bx * CELL + ROAD / 2 + 8;
        const py = by * CELL + ROAD / 2 + 8;
        const size = CELL - ROAD - 16;
        if (px + size < x0 || px > x1 || py + size < y0 || py > y1) continue;
        if (isWater(px + size / 2, py + size / 2)) continue;
        ctx.fillRect(px, py, size, size);
      }
    }

    // Props.
    for (const p of this.props) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      if (p.kind === 'kiosk') {
        ctx.fillStyle = '#c9553e';
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        ctx.fillStyle = '#f2e3c8';
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, 4);
      } else if (p.kind === 'bench') {
        ctx.fillStyle = '#7a5c3e';
        ctx.fillRect(p.x - p.r, p.y - 3, p.r * 2, 6);
      } else {
        ctx.fillStyle = '#5f8263';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Buildings with simple window grids (deterministic per building).
    for (const b of this.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,244,200,0.75)';
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      let s = b.seed;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          s = (Math.imul(s, 1103515245) + 12345) | 0;
          if (((s >>> 16) & 3) === 0) continue;
          ctx.fillRect(b.x + 10 + cx * 24, b.y + 10 + cy * 24, 11, 13);
        }
      }
    }

    // Palms.
    for (const p of this.palms) {
      if (p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue;
      const sway = Math.sin(time * 1.4 + p.sway) * 2.2;
      ctx.strokeStyle = '#8a6a48';
      ctx.lineWidth = 4 * p.s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + sway, p.y - 12 * p.s, p.x + sway * 1.6, p.y - 20 * p.s);
      ctx.stroke();
      ctx.strokeStyle = '#3f9e58';
      ctx.lineWidth = 3;
      const tx = p.x + sway * 1.6;
      const ty = p.y - 20 * p.s;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + p.sway;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(
          tx + Math.cos(a) * 12 * p.s, ty + Math.sin(a) * 7 * p.s - 3,
          tx + Math.cos(a) * 19 * p.s, ty + Math.sin(a) * 10 * p.s + 4,
        );
        ctx.stroke();
      }
    }

    // Lamps.
    ctx.fillStyle = '#5a5a60';
    for (const l of this.lamps) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
      ctx.fillStyle = '#ffe9a0';
      ctx.fillRect(l.x - 1, l.y - 1, 2, 2);
      ctx.fillStyle = '#5a5a60';
    }

    // World border.
    ctx.strokeStyle = '#7a4a3a';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, WORLD - 10, WORLD - 10);
  }
}
