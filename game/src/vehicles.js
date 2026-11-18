// vehicles.js — car model: spawn specs, arcade physics with drift,
// and damage states (pristine -> dented -> smoking -> burning -> wreck).
// One Car class serves parked cars, traffic, the mission package car
// and police cruisers (marked with kind).

import { clamp, wrapAngle } from './rng.js';

export const CAR_SPECS = [
  { name: 'Coral Coupe', color: '#e84a5f', accel: 340, topSpeed: 430, grip: 7.5, w: 46, h: 24 },
  { name: 'Palmetto Sedan', color: '#3e7cb1', accel: 290, topSpeed: 385, grip: 8.5, w: 48, h: 25 },
  { name: 'Sunset Hatch', color: '#f2a541', accel: 310, topSpeed: 395, grip: 8, w: 44, h: 23 },
  { name: 'Marina Pickup', color: '#5f8263', accel: 270, topSpeed: 355, grip: 7, w: 52, h: 27 },
  { name: 'Vice Roadster', color: '#b565d8', accel: 380, topSpeed: 470, grip: 7, w: 45, h: 23 },
  { name: 'Taxi Cab', color: '#f5d13d', accel: 285, topSpeed: 380, grip: 8.5, w: 48, h: 25 },
];

export const POLICE_SPEC = { name: 'CPD Interceptor', color: '#eef1f4', accel: 350, topSpeed: 445, grip: 8.2, w: 48, h: 25 };

let nextId = 1;

export class Car {
  constructor(spec, x, y, angle, kind = 'parked') {
    this.id = nextId++;
    this.spec = spec;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.kind = kind;           // parked | traffic | player | police | mission
    this.health = 100;
    this.driver = null;         // 'player' | 'ai' | null
    this.steer = 0;
    this.throttle = 0;
    this.brake = false;
    this.handbrake = false;
    this.drifting = false;
    this.smokeT = 0;
    this.dead = false;          // wrecked: cannot move
    this.flashT = 0;            // police light phase
    this.package = false;       // mission package car
  }

  speed() {
    return Math.hypot(this.vx, this.vy);
  }

  forwardSpeed() {
    return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
  }

  damage(amount) {
    if (this.dead) return;
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0) {
      this.dead = true;
      this.vx = 0;
      this.vy = 0;
    }
  }

  damageState() {
    if (this.health <= 0) return 'wreck';
    if (this.health < 28) return 'burning';
    if (this.health < 55) return 'smoking';
    if (this.health < 85) return 'dented';
    return 'clean';
  }

  // Arcade vehicle step. throttle -1..1, steer -1..1.
  physics(dt) {
    if (this.dead) {
      this.vx *= Math.pow(0.02, dt);
      this.vy *= Math.pow(0.02, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);
    const fSpeed = this.vx * fx + this.vy * fy;
    const lSpeed = this.vx * -fy + this.vy * fx;

    let ns = fSpeed;
    if (this.throttle > 0) ns += this.spec.accel * this.throttle * dt;
    if (this.throttle < 0) ns += this.spec.accel * 0.62 * this.throttle * dt;
    if (this.brake) ns -= Math.sign(ns) * 520 * dt;
    // Drag + rolling resistance.
    ns -= ns * 0.55 * dt;
    if (this.throttle === 0 && !this.brake) ns -= ns * 1.1 * dt;
    ns = clamp(ns, -this.spec.topSpeed * 0.42, this.spec.topSpeed);

    // Steering scales with speed; handbrake loosens the rear end.
    const steerAuthority = clamp(Math.abs(ns) / 130, 0, 1) * (this.handbrake ? 1.5 : 1);
    this.angle = wrapAngle(this.angle + this.steer * 1.9 * steerAuthority * dt * (ns < 0 ? -1 : 1));

    const grip = this.handbrake ? 1.6 : this.spec.grip;
    let nl = lSpeed * Math.exp(-grip * dt);
    this.drifting = Math.abs(lSpeed) > 65 && Math.abs(ns) > 90;

    const nfx = Math.cos(this.angle);
    const nfy = Math.sin(this.angle);
    this.vx = nfx * ns + -nfy * nl;
    this.vy = nfy * ns + nfx * nl;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.flashT += dt;
  }

  collideCity(city) {
    // Sample the four corners; on impact, stop and take damage.
    const hw = this.spec.w / 2;
    const hh = this.spec.h / 2;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const corners = [
      [hw, hh], [hw, -hh], [-hw, hh], [-hw, -hh],
    ];
    for (const [lx, ly] of corners) {
      const wx = this.x + lx * cos - ly * sin;
      const wy = this.y + lx * sin + ly * cos;
      const fixed = city.collideCircle(wx, wy, 2);
      if (Math.abs(fixed.x - wx) > 0.6 || Math.abs(fixed.y - wy) > 0.6) {
        const impact = this.speed();
        if (impact > 120) this.damage((impact - 110) * 0.055);
        this.x += fixed.x - wx;
        this.y += fixed.y - wy;
        this.vx *= -0.18;
        this.vy *= -0.18;
        return impact;
      }
    }
    return 0;
  }

  draw(ctx, particles) {
    const { w, h } = this.spec;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 4, w / 2 + 3, h / 2 + 2, this.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(this.angle);
    const state = this.damageState();
    // Body.
    ctx.fillStyle = state === 'wreck' ? '#3a3a40' : this.spec.color;
    roundRect(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.fill();
    if (this.kind === 'police') {
      ctx.fillStyle = '#20304a';
      roundRect(ctx, -w / 2, -h / 2, w * 0.42, h, 7);
      ctx.fill();
      ctx.fillStyle = '#eef1f4';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 2, 3);
      // Light bar.
      const phase = Math.floor(this.flashT * 6) % 2;
      ctx.fillStyle = phase ? '#ff4040' : '#ffd0d0';
      ctx.fillRect(-7, -h / 2 + 2, 6, 5);
      ctx.fillStyle = phase ? '#cfe4ff' : '#4080ff';
      ctx.fillRect(1, -h / 2 + 2, 6, 5);
    }
    if (this.package) {
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PKG', 0, 4);
    }
    // Cabin + windshield.
    ctx.fillStyle = state === 'wreck' ? '#22242a' : '#bfe6f2';
    roundRect(ctx, -w * 0.16, -h / 2 + 4, w * 0.34, h - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,24,30,0.85)';
    roundRect(ctx, w * 0.2, -h / 2 + 5, w * 0.1, h - 10, 3);
    ctx.fill();
    // Dents.
    if (state === 'dented' || state === 'smoking' || state === 'burning') {
      ctx.fillStyle = 'rgba(30,30,34,0.5)';
      ctx.beginPath();
      ctx.arc(-w * 0.3, -h * 0.2, 4.5, 0, Math.PI * 2);
      ctx.arc(w * 0.32, h * 0.24, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Headlights.
    ctx.fillStyle = '#fff6bf';
    ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5);
    ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(-w / 2, -h / 2 + 3, 3, 5);
    ctx.fillRect(-w / 2, h / 2 - 8, 3, 5);
    ctx.restore();

    // Smoke / fire particles are emitted by the caller via particles list.
    if (particles && (state === 'smoking' || state === 'burning' || state === 'wreck')) {
      this.smokeT -= 1;
      if (this.smokeT <= 0) {
        this.smokeT = state === 'smoking' ? 5 : 2;
        particles.push({
          x: this.x + Math.cos(this.angle) * w * 0.32,
          y: this.y + Math.sin(this.angle) * w * 0.32,
          vx: (Math.random() - 0.5) * 16,
          vy: -22 - Math.random() * 22,
          life: 0.9,
          maxLife: 0.9,
          size: state === 'smoking' ? 7 : 5,
          color: state === 'smoking' ? '120,120,125' : '255,120,30',
          kind: state === 'smoking' ? 'smoke' : 'fire',
        });
      }
    }
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 40) {
    const gx = rng.int(0, 7) * 400;
    const gy = rng.int(0, 7) * 400;
    const vertical = rng.chance(0.5);
    const x = vertical ? gx + (rng.chance(0.5) ? -34 : 34) : gx + rng.float(-160, 160);
    const y = vertical ? gy + rng.float(-160, 160) : gy + (rng.chance(0.5) ? -34 : 34);
    if (x < 80 || y < 80 || x > 3100 || y > 3100) continue;
    const angle = vertical ? Math.PI / 2 : 0;
    const spec = rng.pick(CAR_SPECS);
    const car = new Car(spec, x, y, angle + (rng.chance(0.5) ? Math.PI : 0), 'parked');
    cars.push(car);
  }
  return cars;
}
