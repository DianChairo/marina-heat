// police.js — the wanted system and the Coral Marina PD.
// Crimes raise heat; heat maps to 1-5 stars. Police cruisers spawn at
// the edge of view and chase, steering to ram the player's car or cut
// off the player on foot. Staying out of sight drains heat. If officers
// stay close while the player is slow or on foot, the BUSTED meter
// fills; a full meter ends the run.

import { Car, POLICE_SPEC } from './vehicles.js';
import { clamp, dist, angleTo, wrapAngle } from './rng.js';
import { WORLD } from './city.js';

export const HEAT_PER_STAR = 100;

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.busted = 0;      // 0..1
    this.hiddenT = 0;     // time since police last saw the player
    this.everWanted = false;
  }

  get stars() {
    if (this.heat <= 0) return 0;
    return clamp(Math.ceil(this.heat / HEAT_PER_STAR), 1, 5);
  }

  addHeat(amount, world) {
    const before = this.stars;
    this.heat = clamp(this.heat + amount, 0, HEAT_PER_STAR * 5);
    if (this.heat > 0) this.everWanted = true;
    if (this.stars > before && world) {
      world.events.push({ type: 'starsUp', stars: this.stars });
    }
  }

  update(dt, world) {
    const p = world.player.pos;
    let seen = false;
    for (const cop of world.police) {
      if (cop.car.dead) continue;
      if (dist(cop.car.x, cop.car.y, p.x, p.y) < 460) { seen = true; break; }
    }
    if (seen) {
      this.hiddenT = 0;
    } else {
      this.hiddenT += dt;
      if (this.stars > 0 && this.hiddenT > 2.5) {
        this.heat = Math.max(0, this.heat - dt * 9);
      }
    }

    // Busted meter: close police + slow/on-foot player.
    let nearest = Infinity;
    for (const cop of world.police) {
      if (cop.car.dead) continue;
      nearest = Math.min(nearest, dist(cop.car.x, cop.car.y, p.x, p.y));
    }
    const playerSpeed = world.player.inCar ? world.player.inCar.speed() : world.player.speedNow();
    const vulnerable = this.stars > 0 && nearest < 120 && playerSpeed < 55;
    if (vulnerable) {
      this.busted = clamp(this.busted + dt * 0.34, 0, 1);
    } else {
      this.busted = clamp(this.busted - dt * 0.5, 0, 1);
    }
    if (this.heat <= 0) this.busted = 0;
    return seen;
  }
}

export class PoliceCar {
  constructor(car) {
    this.car = car;
    this.stuckT = 0;
    this.lastX = car.x;
    this.lastY = car.y;
    this.reverseT = 0;
  }

  update(dt, world) {
    const c = this.car;
    if (c.dead) return;
    const target = world.player.pos;
    const d = dist(c.x, c.y, target.x, target.y);

    // Aim slightly ahead of a moving target so cruisers intercept.
    let tx = target.x;
    let ty = target.y;
    if (world.player.inCar) {
      tx += world.player.inCar.vx * 0.45;
      ty += world.player.inCar.vy * 0.45;
    }
    // When very close on foot, ease off so the bust can happen.
    const wantRam = world.player.inCar !== null || d > 130;

    if (this.reverseT > 0) {
      this.reverseT -= dt;
      c.throttle = -1;
      c.steer = clamp(wrapAngle(angleTo(c.x, c.y, tx, ty) - c.angle) * 2, -1, 1);
    } else {
      const desired = angleTo(c.x, c.y, tx, ty);
      const diff = wrapAngle(desired - c.angle);
      c.steer = clamp(diff * 2.4, -1, 1);
      c.throttle = Math.abs(diff) > 2.2 ? -0.7 : 1;
      if (!wantRam && d < 60) c.throttle = 0.15;
      c.handbrake = Math.abs(diff) > 1.15 && c.speed() > 200;
    }
    c.physics(dt);
    const impact = c.collideCity(world.city);
    if (impact > 170 && world.player.inCar) {
      // Ramming transfers some hurt to the player's car.
    }
    c.x = clamp(c.x, 30, WORLD - 30);
    c.y = clamp(c.y, 30, WORLD - 30);

    // Stuck detection: reverse out.
    if (c.speed() < 14 && c.throttle > 0) {
      this.stuckT += dt;
      if (this.stuckT > 0.9) {
        this.reverseT = 0.65;
        this.stuckT = 0;
      }
    } else {
      this.stuckT = 0;
    }
    this.lastX = c.x;
    this.lastY = c.y;
  }
}

export class PoliceManager {
  constructor() {
    this.spawnT = 0;
  }

  desiredCount(stars) {
    return [0, 2, 3, 4, 6, 8][clamp(stars, 0, 5)];
  }

  update(dt, world) {
    const stars = world.wanted.stars;
    this.spawnT -= dt;
    // Remove wrecks and far-away cruisers.
    world.police = world.police.filter((cop) => {
      if (cop.car.dead) return false;
      return dist(cop.car.x, cop.car.y, world.player.pos.x, world.player.pos.y) < 1900;
    });
    world.cars = world.cars.filter((car) => car.kind !== 'police' || world.police.some((p) => p.car === car));

    const want = this.desiredCount(stars);
    if (world.police.length < want && this.spawnT <= 0) {
      this.spawnT = 1.6;
      const p = world.player.pos;
      const a = world.rng.float(0, Math.PI * 2);
      const r = 640;
      let x = clamp(p.x + Math.cos(a) * r, 60, WORLD - 60);
      let y = clamp(p.y + Math.sin(a) * r, 60, WORLD - 60);
      const fixed = world.city.collideCircle(x, y, 30);
      x = fixed.x;
      y = fixed.y;
      const car = new Car(POLICE_SPEC, x, y, angleTo(x, y, p.x, p.y), 'police');
      car.driver = 'ai';
      world.police.push(new PoliceCar(car));
      world.cars.push(car);
      world.events.push({ type: 'siren', x, y });
    }

    for (const cop of world.police) cop.update(dt, world);
  }
}
