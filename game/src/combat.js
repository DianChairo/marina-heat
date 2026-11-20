// combat.js — mouse-aimed shooting: hitscan-feel projectiles with
// tracers, hit reactions for pedestrians, officers and cars, and the
// damage the player takes from police fire.

import { input } from './input.js';
import { dist } from './rng.js';
import { hitsBuilding } from './city.js';

export class Combat {
  constructor(world) {
    this.world = world;
    this.bullets = []; // {x,y,vx,vy,life,from}
    this.tracers = []; // {x1,y1,x2,y2,life}
    this.shotsFired = 0;
    this.fireCooldown = 0;
    this.lastShotAt = -99;
    this.enemyCooldown = 0;
    this.muzzle = 0;
  }

  update(dt) {
    const w = this.world;
    const p = w.player;
    this.fireCooldown -= dt;
    this.muzzle = Math.max(0, this.muzzle - dt * 9);

    // Player fire: hold the mouse, on foot only.
    if (!p.inCar && input.mouseDown && this.fireCooldown <= 0 && w.state === 'playing') {
      this.fireCooldown = 0.14;
      this.shotsFired++;
      this.lastShotAt = w.time;
      this.muzzle = 1;
      w.audio.shot();
      const a = w.aimAngle + w.rng.range(-0.03, 0.03);
      this.bullets.push({
        x: p.x + Math.cos(a) * 14,
        y: p.y + Math.sin(a) * 14,
        vx: Math.cos(a) * 900,
        vy: Math.sin(a) * 900,
        life: 0.45,
        from: 'player',
      });
      w.police.reportCrime('shots', p.x, p.y, 0.55);
    }

    // Police fire: officers and stopped cruisers shoot when they have
    // a clear line at higher wanted levels.
    this.enemyCooldown -= dt;
    if (w.police.stars >= 2 && this.enemyCooldown <= 0) {
      const shooters = w.police.officers.filter((o) => dist(o.x, o.y, p.x, p.y) < 300);
      if (shooters.length > 0 && !hitsBuilding(w.city, p.x, p.y, 2)) {
        this.enemyCooldown = 0.8;
        const o = shooters[0];
        const a = Math.atan2(p.y - o.y, p.x - o.x) + w.rng.range(-0.09, 0.09);
        this.bullets.push({
          x: o.x, y: o.y,
          vx: Math.cos(a) * 780, vy: Math.sin(a) * 780,
          life: 0.5, from: 'police',
        });
        w.audio.shot();
      }
    }

    // Bullet flight + hits.
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (hitsBuilding(w.city, b.x, b.y, 2)) {
        b.life = 0;
        continue;
      }
      if (b.from === 'player') {
        for (const ped of w.pedestrians) {
          if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < 9) {
            ped.state = 'down';
            ped.downTime = 0;
            b.life = 0;
            w.police.reportCrime('assault', ped.x, ped.y, 1.1);
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const o of w.police.officers) {
          if (dist(b.x, b.y, o.x, o.y) < 9) {
            o.done = true;
            b.life = 0;
            w.police.reportCrime('assault', o.x, o.y, 1.4);
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const car of w.allCars()) {
          if (dist(b.x, b.y, car.x, car.y) < 24) {
            car.health -= 7;
            b.life = 0;
            break;
          }
        }
      } else if (dist(b.x, b.y, p.x, p.y) < (p.inCar ? 24 : 10)) {
        p.health -= 6;
        b.life = 0;
        if (p.inCar) p.inCar.health -= 3;
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  draw(ctx, cam) {
    const w = this.world;
    // Muzzle flash.
    if (this.muzzle > 0 && !w.player.inCar) {
      const p = w.player;
      const mx = p.x + Math.cos(w.aimAngle) * 18 - cam.x;
      const my = p.y + Math.sin(w.aimAngle) * 18 - cam.y;
      ctx.fillStyle = `rgba(255,210,80,${0.75 * this.muzzle})`;
      ctx.beginPath();
      ctx.arc(mx, my, 7 * this.muzzle + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,240,180,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const b of this.bullets) {
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - b.vx * 0.016, sy - b.vy * 0.016);
    }
    ctx.stroke();
  }
}
