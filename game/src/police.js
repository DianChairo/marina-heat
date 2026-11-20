// police.js — the Coral Marina PD: a wanted-level heat system fed by
// reported crimes, cruiser spawns at the map edge of the player's view,
// pursuit driving, ramming, and foot pursuit with a bust meter.

import { makeCar, stepCar } from './vehicles.js';
import { clamp, dist } from './rng.js';
import { BLOCK } from './city.js';

export class Police {
  constructor(world) {
    this.world = world;
    this.heat = 0; // 0..5 fractional; stars = ceil while > 0
    this.cruisers = [];
    this.officers = [];
    this.cooldown = 0; // time since the player was last seen
    this.spawnTimer = 0;
    this.bust = 0; // 0..1 bust meter while an officer is on top of you
  }

  get stars() {
    return this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat));
  }

  // Crimes reported by gameplay systems. `weight` adds heat.
  reportCrime(kind, x, y, weight = 1) {
    const w = this.world;
    // Only witnessed crimes count in full; far-away ones count less.
    const d = dist(x, y, w.player.x, w.player.y);
    const factor = d < 700 ? 1 : 0.4;
    const gains = { theft: 0.9, assault: 1.2, shots: 0.7, collision: 0.35, speeding: 0.2 };
    this.heat = clamp(this.heat + (gains[kind] || 0.5) * weight * factor, 0, 5);
    this.cooldown = 0;
  }

  desiredCruisers() {
    return [0, 1, 2, 3, 4, 6][this.stars] || 0;
  }

  spawnCruiser() {
    const w = this.world;
    const p = w.player;
    // Spawn on a street roughly 620px away, out of immediate view.
    const angle = w.rng.range(0, Math.PI * 2);
    let x = p.x + Math.cos(angle) * 620;
    let y = p.y + Math.sin(angle) * 620;
    // Snap to the nearest street centreline.
    x = Math.round(x / BLOCK) * BLOCK + (Math.cos(angle) > 0 ? -19 : 19);
    y = Math.max(40, Math.min(2840, y));
    x = Math.max(40, Math.min(2840, x));
    const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), '#ffffff', 'police');
    car.driver = 'police';
    car.cruise = 330;
    this.cruisers.push(car);
  }

  update(dt) {
    const w = this.world;
    const p = w.player;

    // Heat decay: stay unseen and clean to cool off.
    const anyNear = this.cruisers.some((c) => dist(c.x, c.y, p.x, p.y) < 460) ||
      this.officers.some((o) => dist(o.x, o.y, p.x, p.y) < 300);
    if (anyNear) {
      this.cooldown = 0;
    } else {
      this.cooldown += dt;
      if (this.cooldown > 6 && this.heat > 0) {
        this.heat = Math.max(0, this.heat - dt * 0.14);
      }
    }
    if (this.heat <= 0.02 && this.cruisers.length === 0) this.heat = 0;

    // Spawning.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      if (this.cruisers.length < this.desiredCruisers()) this.spawnCruiser();
    }
    // Despawn far cruisers when the heat is gone.
    if (this.stars === 0) {
      this.cruisers = this.cruisers.filter((c) => dist(c.x, c.y, p.x, p.y) < 900);
    }

    // Cruiser pursuit: steer at a point ahead of the player.
    for (const car of this.cruisers) {
      const targetX = p.x + (p.inCar ? p.inCar.vx * 0.35 : 0);
      const targetY = p.y + (p.inCar ? p.inCar.vy * 0.35 : 0);
      const desired = Math.atan2(targetY - car.y, targetX - car.x);
      let diff = desired - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = clamp(diff * 1.6, -1, 1);
      const d = dist(car.x, car.y, p.x, p.y);
      let throttle = 1;
      if (d < 60) throttle = 0.2;
      if (Math.abs(diff) > 2.4) throttle = -0.6; // reverse out of a bad angle
      const crashed = stepCar(car, throttle, steer, dt, w.city);
      if (crashed) w.audio.crash(0.2);
      // Ram damage.
      if (p.inCar && d < 34 && Math.abs(car.speed) > 90) {
        p.inCar.health -= 9 * dt * 4;
        p.health -= 3 * dt;
      }
      // An officer steps out when close to a foot player and slow.
      if (!p.inCar && d < 90 && Math.abs(car.speed) < 30 && this.officers.length < this.stars + 1) {
        this.officers.push({ x: car.x + 18, y: car.y, angle: 0, speed: 128, car });
      }
    }

    // Officers on foot chase and build the bust meter.
    this.bust = Math.max(0, this.bust - dt * 0.25);
    for (const o of this.officers) {
      const d = dist(o.x, o.y, p.x, p.y);
      if (p.inCar || this.stars === 0) {
        // Get back in the car / give up.
        o.x += Math.cos(Math.atan2(o.car.y - o.y, o.car.x - o.x)) * o.speed * dt;
        o.y += Math.sin(Math.atan2(o.car.y - o.y, o.car.x - o.x)) * o.speed * dt;
        if (dist(o.x, o.y, o.car.x, o.car.y) < 16) o.done = true;
        continue;
      }
      const a = Math.atan2(p.y - o.y, p.x - o.x);
      o.angle = a;
      if (d > 20) {
        o.x += Math.cos(a) * o.speed * dt;
        o.y += Math.sin(a) * o.speed * dt;
      } else {
        this.bust += dt * 0.55;
        if (this.bust >= 1) w.busted();
      }
    }
    this.officers = this.officers.filter((o) => !o.done);

    // Siren audio while any cruiser is near.
    const nearest = this.cruisers.reduce((m, c) => Math.min(m, dist(c.x, c.y, p.x, p.y)), Infinity);
    w.audio.siren(this.stars > 0 && nearest < 700, dt);
  }

  drawOfficers(ctx, cam) {
    for (const o of this.officers) {
      const sx = o.x - cam.x;
      const sy = o.y - cam.y;
      if (sx < -20 || sy < -20 || sx > cam.w + 20 || sy > cam.h + 20) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b2a4a';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c39e';
      ctx.beginPath();
      ctx.arc(Math.cos(o.angle) * 2.5, Math.sin(o.angle) * 2.5, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(-4, -8, 8, 3);
      ctx.restore();
    }
  }
}
