// Canvas rendering of Coral Marina: water, beach, roads, blocks, buildings
// with roof shadows, palms, docks and boats, cars, peds, police, the player,
// bullets, mission markers and the day-cycle light.
import { WORLD, ROAD_STEP, ROAD_HALF, WATER_TOP, CAUSEWAY_X, COLORS } from './config.js';
import { currentJob } from './missions.js';

export function renderWorld(world) {
  const ctx = world.ctx;
  const cam = world.camera;
  const view = world.view;
  ctx.save();
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.translate(-cam.x + view.w / 2, -cam.y + view.h / 2);
  drawGround(world, ctx, cam, view);
  drawRoads(world, ctx, cam, view);
  drawBuildings(world, ctx, cam, view);
  drawPalms(world, ctx, cam, view);
  drawDocks(world, ctx, cam, view);
  drawMissionMarker(world, ctx);
  drawPeds(world, ctx);
  drawCars(world, ctx);
  drawPolice(world, ctx);
  drawPlayer(world, ctx);
  drawBullets(world, ctx);
  ctx.restore();
  drawDayTint(world, ctx);
}

function inView(cam, view, x, y, m) {
  return (
    x > cam.x - view.w / 2 - m && x < cam.x + view.w / 2 + m &&
    y > cam.y - view.h / 2 - m && y < cam.y + view.h / 2 + m
  );
}

function drawGround(world, ctx, cam, view) {
  const x0 = Math.max(0, cam.x - view.w / 2 - 40);
  const y0 = Math.max(0, cam.y - view.h / 2 - 40);
  const x1 = Math.min(WORLD, cam.x + view.w / 2 + 40);
  const y1 = Math.min(WORLD, cam.y + view.h / 2 + 40);
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach strip and water.
  if (y1 > WATER_TOP - 70) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x0, WATER_TOP - 70, x1 - x0, 70);
  }
  if (y1 > WATER_TOP) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(x0, WATER_TOP, x1 - x0, y1 - WATER_TOP);
    ctx.fillStyle = COLORS.waterDeep;
    for (let i = 0; i < 5; i++) {
      const wy = WATER_TOP + 60 + i * 70;
      if (wy > y0 && wy < y1) {
        ctx.fillRect(x0, wy, x1 - x0, 10);
      }
    }
  }
  // City blocks get a subtle checker tint.
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let gx = 0; gx < 8; gx++) {
    for (let gy = 0; gy < 7; gy++) {
      if ((gx + gy) % 2 === 0) {
        ctx.fillRect(gx * ROAD_STEP + ROAD_HALF, gy * ROAD_STEP + ROAD_HALF, ROAD_STEP - ROAD_HALF * 2, ROAD_STEP - ROAD_HALF * 2);
      }
    }
  }
}

function drawRoads(world, ctx, cam, view) {
  ctx.fillStyle = COLORS.road;
  for (let p = 0; p <= WORLD; p += ROAD_STEP) {
    if (p > cam.y - view.h / 2 - 60 && p < cam.y + view.h / 2 + 60) {
      ctx.fillRect(Math.max(0, cam.x - view.w / 2 - 40), p - ROAD_HALF, view.w + 80, ROAD_HALF * 2);
    }
    if (p > cam.x - view.w / 2 - 60 && p < cam.x + view.w / 2 + 60) {
      ctx.fillRect(p - ROAD_HALF, Math.max(0, cam.y - view.h / 2 - 40), ROAD_HALF * 2, view.h + 80);
    }
  }
  // Causeway through the water.
  ctx.fillRect(CAUSEWAY_X - 60, WATER_TOP - 40, 120, WORLD - WATER_TOP + 40);
  // Centre dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (let p = 0; p <= WORLD; p += ROAD_STEP) {
    for (let d = 0; d < WORLD; d += 64) {
      if (p > cam.y - view.h / 2 - 40 && p < cam.y + view.h / 2 + 40) ctx.fillRect(d, p - 2, 26, 4);
      if (p > cam.x - view.w / 2 - 40 && p < cam.x + view.w / 2 + 40) ctx.fillRect(p - 2, d, 4, 26);
    }
  }
}

function drawBuildings(world, ctx, cam, view) {
  for (const b of world.city.buildings) {
    if (!inView(cam, view, b.x + b.w / 2, b.y + b.h / 2, 140)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 12);
      }
    }
  }
}

function drawPalms(world, ctx, cam, view) {
  for (const palm of world.city.palms) {
    if (!inView(cam, view, palm.x, palm.y, 40)) continue;
    const s = palm.s;
    ctx.strokeStyle = COLORS.palmTrunk;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 4 * s, palm.y - 16 * s);
    ctx.stroke();
    ctx.fillStyle = COLORS.palmLeaf;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + palm.x * 0.01;
      ctx.beginPath();
      ctx.ellipse(palm.x + 4 * s + Math.cos(a) * 10 * s, palm.y - 16 * s + Math.sin(a) * 6 * s, 12 * s, 4 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawDocks(world, ctx, cam, view) {
  ctx.fillStyle = '#6a4a2a';
  for (const d of world.city.docks) {
    if (!inView(cam, view, d.x + d.w / 2, d.y + d.h / 2, 100)) continue;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#8a6a3a';
    for (let y = d.y + 10; y < d.y + d.h; y += 24) ctx.fillRect(d.x + 2, y, d.w - 4, 3);
    ctx.fillStyle = '#6a4a2a';
  }
  for (const boat of world.city.boats) {
    if (!inView(cam, view, boat.x, boat.y, 80)) continue;
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, boat.len / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(-boat.len / 4, -6, boat.len / 2, 12);
    ctx.restore();
  }
}

function drawCarShape(ctx, car, police) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 3, car.len, car.wid);
  ctx.fillStyle = car.color;
  ctx.fillRect(-car.len / 2, -car.wid / 2, car.len, car.wid);
  ctx.fillStyle = police ? '#e8e8e8' : '#22242a';
  ctx.fillRect(-car.len / 4, -car.wid / 2 + 3, car.len / 2, car.wid - 6);
  if (police) {
    const blink = Math.floor(performance.now() / 260) % 2 === 0;
    ctx.fillStyle = blink ? '#e83a3a' : '#3a6ae8';
    ctx.fillRect(-6, -car.wid / 2 - 2, 12, 5);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  ctx.fillStyle = '#111';
  ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 - 2, 8, 3);
  ctx.fillRect(-car.len / 2 + 4, car.wid / 2 - 1, 8, 3);
  ctx.fillRect(car.len / 2 - 12, -car.wid / 2 - 2, 8, 3);
  ctx.fillRect(car.len / 2 - 12, car.wid / 2 - 1, 8, 3);
  ctx.restore();
}

function drawCars(world, ctx) {
  for (const car of world.cars) {
    if (car === world.player.car) continue;
    if (!inView(world.camera, world.view, car.x, car.y, 80)) continue;
    drawCarShape(ctx, car, false);
  }
  if (world.player.car) drawCarShape(ctx, world.player.car, false);
}

function drawPolice(world, ctx) {
  for (const cop of world.police) {
    if (!inView(world.camera, world.view, cop.x, cop.y, 80)) continue;
    drawCarShape(ctx, cop, true);
  }
}

function drawPeds(world, ctx) {
  for (const ped of world.peds) {
    if (ped.hp <= 0) continue;
    if (!inView(world.camera, world.view, ped.x, ped.y, 40)) continue;
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a2e';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 9 + bob * 0.3, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(world, ctx) {
  const p = world.player;
  if (!p.onFoot) return;
  if (!inView(world.camera, world.view, p.x, p.y, 60)) return;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim !== undefined ? p.aim : p.angle);
  ctx.fillStyle = '#22242a';
  ctx.fillRect(8, -2, 14, 4);
  ctx.restore();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2e';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Muzzle flash.
  if (world.combat.muzzle > 0) {
    ctx.fillStyle = '#ffd83a';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.aim) * 26, p.y + Math.sin(p.aim) * 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullets(world, ctx) {
  ctx.strokeStyle = '#ffe83a';
  ctx.lineWidth = 2;
  for (const b of world.combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawMissionMarker(world, ctx) {
  const job = currentJob(world.missions);
  if (!job || world.missions.allDone) return;
  const pulse = 1 + Math.sin(world.time * 4) * 0.15;
  ctx.save();
  ctx.translate(job.x, job.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ffd83a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,216,58,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd83a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, 1);
  ctx.restore();
  // Off-screen direction arrow at the screen edge.
  const cam = world.camera;
  const view = world.view;
  const dx = job.x - cam.x;
  const dy = job.y - cam.y;
  if (Math.abs(dx) > view.w / 2 - 60 || Math.abs(dy) > view.h / 2 - 60) {
    const a = Math.atan2(dy, dx);
    const ex = view.w / 2 + Math.cos(a) * (view.w / 2 - 70);
    const ey = view.h / 2 + Math.sin(a) * (view.h / 2 - 70);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd83a';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawDayTint(world, ctx) {
  // Day cycle: 0 = noon, 0.5 = midnight. Tint darkens the scene at night.
  const t = world.dayT;
  const night = Math.max(0, Math.sin((t - 0.25) * Math.PI * 2)) * 0.45;
  if (night > 0.02) {
    ctx.fillStyle = `rgba(8,10,40,${night.toFixed(3)})`;
    ctx.fillRect(0, 0, world.view.w, world.view.h);
  }
  if (t > 0.42 && t < 0.58) {
    ctx.fillStyle = 'rgba(255,120,40,0.06)';
    ctx.fillRect(0, 0, world.view.w, world.view.h);
  }
}
