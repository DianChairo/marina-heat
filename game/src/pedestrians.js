// pedestrians.js — pedestrians who stroll the sidewalks and plazas,
// wander between waypoints, and flee from gunfire, explosions and
// fast-approaching cars. Getting run over or shot takes them down.

import { clamp, dist, angleTo } from './rng.js';
import { WORLD, onRoad, isWater } from './city.js';

const SHIRTS = ['#e8e3d8', '#7fb3d5', '#f1948a', '#82e0aa', '#f9e79f', '#d2b4de', '#f5cba7', '#aed6f1', '#f0b27a', '#95d5b2'];
const PANTS = ['#34495e', '#5d4037', '#616a6b', '#1a5276', '#7d3c98'];

let pedId = 1;

export class Pedestrian {
  constructor(rng, x, y) {
    this.id = pedId++;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = rng.float(0, Math.PI * 2);
    this.speed = rng.float(52, 88);
    this.state = 'wander'; // wander | flee | down
    this.target = null;
    this.waitT = rng.float(0, 2);
    this.fleeT = 0;
    this.fleeFrom = null;
    this.dead = false;
    this.phase = rng.float(0, 6.28);
    this.shirt = rng.pick(SHIRTS);
    this.pants = rng.pick(PANTS);
    this.skin = rng.pick(['#ffd9a0', '#e8b48a', '#b57e52', '#8a5a34']);
    this.rng = rng;
  }

  scare(x, y, seconds = 4) {
    if (this.dead) return;
    if (dist(this.x, this.y, x, y) < 340) {
      this.state = 'flee';
      this.fleeT = seconds;
      this.fleeFrom = { x, y };
    }
  }

  hurt() {
    this.dead = true;
    this.state = 'down';
  }

  pickTarget(city) {
    for (let i = 0; i < 10; i++) {
      const x = clamp(this.x + this.rng.float(-260, 260), 30, WORLD - 30);
      const y = clamp(this.y + this.rng.float(-260, 260), 30, WORLD - 30);
      if (isWater(x, y)) continue;
      const fixed = city.collideCircle(x, y, 12);
      this.target = fixed;
      return;
    }
    this.target = { x: this.x, y: this.y };
  }

  update(dt, world) {
    if (this.dead) return;
    const city = world.city;
    this.phase += dt * 8;

    if (this.state === 'flee') {
      this.fleeT -= dt;
      if (this.fleeT <= 0 || !this.fleeFrom) {
        this.state = 'wander';
        this.target = null;
      } else {
        const away = angleTo(this.fleeFrom.x, this.fleeFrom.y, this.x, this.y);
        const runSpeed = 196;
        this.vx = Math.cos(away) * runSpeed;
        this.vy = Math.sin(away) * runSpeed;
        this.angle = away;
        this.move(dt, city);
        return;
      }
    }

    // A fast car bearing down scares a pedestrian out of the road.
    for (const car of world.cars) {
      if (car.dead) continue;
      const cs = car.speed();
      if (cs > 130 && dist(this.x, this.y, car.x, car.y) < 85) {
        this.scare(car.x, car.y, 1.6);
        break;
      }
    }
    if (this.state === 'flee') return;

    if (this.waitT > 0) {
      this.waitT -= dt;
      this.vx *= Math.pow(0.001, dt);
      this.vy *= Math.pow(0.001, dt);
      return;
    }
    if (!this.target || dist(this.x, this.y, this.target.x, this.target.y) < 14) {
      this.pickTarget(city);
      if (this.rng.chance(0.25)) this.waitT = this.rng.float(0.6, 2.4);
    }
    if (this.target) {
      const a = angleTo(this.x, this.y, this.target.x, this.target.y);
      this.angle = a;
      this.vx = Math.cos(a) * this.speed;
      this.vy = Math.sin(a) * this.speed;
    }
    this.move(dt, city);
  }

  move(dt, city) {
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (isWater(nx, ny)) {
      this.vx = 0;
      this.vy = 0;
      this.target = null;
      return;
    }
    const fixed = city.collideCircle(nx, ny, 10);
    this.x = fixed.x;
    this.y = fixed.y;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead) {
      ctx.rotate(this.angle + Math.PI / 2);
      ctx.fillStyle = this.pants;
      ctx.fillRect(-4, -3, 16, 6);
      ctx.fillStyle = this.shirt;
      ctx.beginPath();
      ctx.arc(-8, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.skin;
      ctx.beginPath();
      ctx.arc(-16, 0, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const step = Math.sin(this.phase) * 4;
    ctx.strokeStyle = this.pants;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(step * Math.cos(this.angle), step * Math.sin(this.angle));
    ctx.moveTo(0, 0);
    ctx.lineTo(-step * Math.cos(this.angle), -step * Math.sin(this.angle));
    ctx.stroke();
    ctx.rotate(this.angle);
    ctx.fillStyle = this.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.skin;
    ctx.beginPath();
    ctx.arc(2.5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function spawnPeds(rng, city, centre, count, minD = 120, maxD = 1000) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 60) {
    const x = clamp(centre.x + rng.float(-maxD, maxD), 40, WORLD - 40);
    const y = clamp(centre.y + rng.float(-maxD, maxD), 40, WORLD - 40);
    if (isWater(x, y)) continue;
    if (dist(x, y, centre.x, centre.y) < minD) continue;
    const fixed = city.collideCircle(x, y, 12);
    if (Math.abs(fixed.x - x) > 2 || Math.abs(fixed.y - y) > 2) continue;
    if (onRoad(x, y) && rng.chance(0.7)) continue; // most peds keep off the road
    peds.push(new Pedestrian(rng, fixed.x, fixed.y));
  }
  return peds;
}
