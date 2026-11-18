// combat.js — mouse-aim hitscan shooting. Holding the mouse fires the
// pistol at a fixed rate; each shot traces instantly to the nearest
// building, car or pedestrian, spawns a tracer + sparks, applies damage
// and feeds the chaos score and wanted heat.

import { dist, angleTo } from './rng.js';

export class Combat {
  constructor() {
    this.fireCooldown = 0;
    this.fireRate = 0.16;
    this.range = 560;
    this.tracers = [];
    this.muzzleT = 0;
    this.shotsFired = 0;
  }

  update(dt, world, input) {
    this.fireCooldown -= dt;
    this.muzzleT -= dt;
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);

    const player = world.player;
    if (player.inCar || player.dead || world.state !== 'playing') return;
    if (!input.mouse.down) return;
    if (this.fireCooldown > 0) return;
    this.fireCooldown = this.fireRate;
    this.shotsFired++;

    const from = { x: player.x, y: player.y };
    const aim = world.screenToWorld(input.mouse.x, input.mouse.y);
    const angle = angleTo(from.x, from.y, aim.x, aim.y);
    this.muzzleT = 0.05;
    world.audio.shot();
    world.events.push({ type: 'gunshot', x: from.x, y: from.y });

    // Find the nearest hit along the ray.
    let bestT = this.range;
    let hitKind = null;
    let hitTarget = null;

    // Buildings: step the ray until it enters a collider.
    const steps = 56;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * this.range;
      const x = from.x + Math.cos(angle) * t;
      const y = from.y + Math.sin(angle) * t;
      if (world.city.rectHitsBuilding(x, y, 2, 2)) {
        if (t < bestT) { bestT = t; hitKind = 'building'; hitTarget = null; }
        break;
      }
    }
    // Cars.
    for (const car of world.cars) {
      const d = rayCircle(from, angle, car.x, car.y, Math.max(car.spec.w, car.spec.h) * 0.55);
      if (d !== null && d < bestT) { bestT = d; hitKind = 'car'; hitTarget = car; }
    }
    // Pedestrians.
    for (const ped of world.peds) {
      if (ped.dead) continue;
      const d = rayCircle(from, angle, ped.x, ped.y, 13);
      if (d !== null && d < bestT) { bestT = d; hitKind = 'ped'; hitTarget = ped; }
    }
    // Police officers count as cars (their cruisers) — handled above.

    const hx = from.x + Math.cos(angle) * bestT;
    const hy = from.y + Math.sin(angle) * bestT;
    this.tracers.push({
      x1: from.x + Math.cos(angle) * 20, y1: from.y + Math.sin(angle) * 20,
      x2: hx, y2: hy, life: 0.07, maxLife: 0.07,
    });

    if (hitKind === 'car') {
      hitTarget.damage(9);
      world.audio.hit();
      world.addChaos(6, hx, hy);
      world.wanted.addHeat(7, world);
      spawnSparks(world, hx, hy, '255,190,80');
      if (hitTarget.kind === 'police') world.wanted.addHeat(10, world);
      if (hitTarget.dead) {
        world.addChaos(120, hx, hy);
        world.wanted.addHeat(30, world);
        world.events.push({ type: 'explosion', x: hx, y: hy });
      }
    } else if (hitKind === 'ped') {
      hitTarget.hurt();
      world.audio.hit();
      world.addChaos(45, hx, hy);
      world.wanted.addHeat(34, world);
      world.events.push({ type: 'pedDown', x: hx, y: hy });
      spawnSparks(world, hx, hy, '220,60,50');
    } else if (hitKind === 'building') {
      spawnSparks(world, hx, hy, '240,230,180');
    }

    // Gunfire panics nearby pedestrians and alerts police ears.
    for (const ped of world.peds) ped.scare(from.x, from.y, 4);
  }

  draw(ctx) {
    for (const t of this.tracers) {
      const a = t.life / t.maxLife;
      ctx.strokeStyle = `rgba(255,225,120,${0.85 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
  }

  drawMuzzle(ctx, player) {
    if (this.muzzleT <= 0 || player.inCar) return;
    const x = player.x + Math.cos(player.angle) * 26;
    const y = player.y + Math.sin(player.angle) * 26;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.angle);
    ctx.fillStyle = 'rgba(255,190,60,0.95)';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function rayCircle(from, angle, cx, cy, r) {
  const dx = cx - from.x;
  const dy = cy - from.y;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (along < 0) return null;
  const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
  if (perp > r) return null;
  return along;
}

export function spawnSparks(world, x, y, color) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 130;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.28, maxLife: 0.28,
      size: 2.4, color, kind: 'spark',
    });
  }
}

export function updateParticles(world, dt) {
  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'smoke' || p.kind === 'fire') {
      p.size += dt * 9;
      p.vx *= Math.pow(0.2, dt);
    }
    if (p.kind === 'spark') {
      p.vx *= Math.pow(0.01, dt);
      p.vy *= Math.pow(0.01, dt);
    }
  }
  world.particles = world.particles.filter((p) => p.life > 0);
}

export function drawParticles(ctx, world) {
  for (const p of world.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    if (p.kind === 'fire') {
      ctx.fillStyle = `rgba(${p.color},${0.75 * a})`;
    } else if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(${p.color},${0.4 * a})`;
    } else if (p.kind === 'text') {
      continue;
    } else {
      ctx.fillStyle = `rgba(${p.color},${a})`;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function distCheck(a, b) {
  return dist(a.x, a.y, b.x, b.y);
}
