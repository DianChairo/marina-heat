// missions.js — three missions from fixer Marisol Vega, delivered by
// phone messages. A small state machine: idle -> active -> done/failed,
// with checkpoints, timers and cash rewards. Progress persists via the
// save object (missionsDone list).

import { dist } from './rng.js';
import { Car, CAR_SPECS } from './vehicles.js';

export const CONTACT = 'Marisol Vega';

export const MISSION_DEFS = [
  {
    id: 'bay-run',
    title: 'Bay Run',
    blurb: 'Hit every checkpoint along the marina before the clock dies.',
    reward: 600,
  },
  {
    id: 'special-delivery',
    title: 'Special Delivery',
    blurb: 'Take the marked package car to the drop-off. Expect heat.',
    reward: 900,
  },
  {
    id: 'rampage',
    title: 'Rampage',
    blurb: 'Cause 1500 chaos points of mayhem before time runs out.',
    reward: 750,
  },
];

export class MissionManager {
  constructor() {
    this.active = null;   // runtime mission state
    this.offerT = 6;      // delay before the first offer
    this.messageQueue = [];
    this.banner = null;   // {text, sub, t, kind}
  }

  phone(world, from, text) {
    this.messageQueue.push({ from, text, t: 5.2 });
    world.audio.phone();
  }

  startNext(world) {
    const done = world.save.missionsDone;
    const def = MISSION_DEFS.find((m) => !done.includes(m.id)) || MISSION_DEFS[world.rng.int(0, 2)];
    this.begin(world, def);
  }

  begin(world, def) {
    const p = world.player.pos;
    const state = {
      def,
      phase: 'run',
      t: 0,
      timeLeft: 0,
      checkpoint: null,
      checkpoints: [],
      idx: 0,
      packageCar: null,
      chaosStart: world.chaos,
      target: 0,
    };
    if (def.id === 'bay-run') {
      // Tuned after a playtest: 100s base, +14s per checkpoint reached.
      state.timeLeft = 100;
      const pts = [];
      const spots = [
        { x: 400, y: 400 }, { x: 1200, y: 400 }, { x: 2000, y: 800 },
        { x: 2400, y: 1600 }, { x: 2000, y: 2400 }, { x: 2600, y: 2600 },
      ];
      for (const s of spots) {
        const fixed = world.city.collideCircle(s.x, s.y, 20);
        pts.push(fixed);
      }
      state.checkpoints = pts;
      state.checkpoint = pts[0];
      this.phone(world, CONTACT, 'Bay Run: checkpoints are lit on your map. Move!');
    } else if (def.id === 'special-delivery') {
      state.timeLeft = 150;
      // Spawn the package car a couple of blocks away on a road.
      const gx = Math.max(400, Math.round(p.x / 400) * 400);
      const gy = Math.max(400, Math.round(p.y / 400) * 400);
      const car = new Car(CAR_SPECS[1], gx + 30, gy + 120, Math.PI / 2, 'mission');
      car.package = true;
      world.cars.push(car);
      state.packageCar = car;
      state.phase = 'getcar';
      state.checkpoint = { x: car.x, y: car.y };
      this.phone(world, CONTACT, 'Special Delivery: grab the marked car. The package is inside.');
    } else if (def.id === 'rampage') {
      state.timeLeft = 50;
      state.target = 1500;
      state.chaosStart = world.chaos;
      this.phone(world, CONTACT, 'Rampage: wreck, shoot, ram — 1500 chaos. Go loud!');
    }
    this.active = state;
    world.events.push({ type: 'missionStart', id: def.id });
  }

  fail(world, reason) {
    if (!this.active) return;
    this.banner = { text: 'MISSION FAILED', sub: reason, t: 3.2, kind: 'fail' };
    world.audio.fail();
    this.cleanup(world);
    this.active = null;
    this.offerT = 14;
  }

  complete(world) {
    const def = this.active.def;
    world.cash += def.reward;
    if (!world.save.missionsDone.includes(def.id)) world.save.missionsDone.push(def.id);
    this.banner = { text: 'MISSION COMPLETE', sub: `${def.title}  +$${def.reward}`, t: 3.6, kind: 'win' };
    world.audio.success();
    this.phone(world, CONTACT, `Clean work. $${def.reward} wired to you. — M`);
    this.cleanup(world);
    this.active = null;
    this.offerT = 20;
  }

  cleanup(world) {
    if (this.active && this.active.packageCar && this.active.packageCar.kind === 'mission') {
      this.active.packageCar.package = false;
      this.active.packageCar.kind = 'parked';
    }
  }

  update(dt, world) {
    // Phone messages age out.
    for (const m of this.messageQueue) m.t -= dt;
    this.messageQueue = this.messageQueue.filter((m) => m.t > 0);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }

    if (!this.active) {
      if (world.state === 'playing') {
        this.offerT -= dt;
        if (this.offerT <= 0) {
          this.offerT = 9999;
          const done = world.save.missionsDone;
          const def = MISSION_DEFS.find((m) => !done.includes(m.id));
          if (def) {
            this.phone(world, CONTACT, `Job for you: ${def.title}. ${def.blurb} Press F to accept.`);
            this.pendingOffer = def;
          } else {
            this.phone(world, CONTACT, 'All my jobs are done. Press F for a repeat run.');
            this.pendingOffer = MISSION_DEFS[0];
          }
        }
      }
      return;
    }

    const s = this.active;
    s.t += dt;
    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      this.fail(world, 'Out of time.');
      return;
    }
    const p = world.player.pos;

    if (s.def.id === 'bay-run') {
      if (s.checkpoint && dist(p.x, p.y, s.checkpoint.x, s.checkpoint.y) < 62) {
        world.audio.pickup();
        world.cash += 40;
        s.idx++;
        if (s.idx >= s.checkpoints.length) {
          this.complete(world);
          return;
        }
        s.checkpoint = s.checkpoints[s.idx];
        s.timeLeft += 14;
      }
    } else if (s.def.id === 'special-delivery') {
      if (s.phase === 'getcar') {
        if (world.player.inCar === s.packageCar) {
          s.phase = 'deliver';
          s.checkpoint = { x: 2520, y: 2760 };
          world.wanted.addHeat(210, world);
          this.phone(world, CONTACT, 'You have the package. Drop it at the marina warehouse — cops incoming!');
        } else {
          s.checkpoint = { x: s.packageCar.x, y: s.packageCar.y };
          if (s.packageCar.dead) {
            this.fail(world, 'The package car was wrecked.');
            return;
          }
        }
      } else if (s.phase === 'deliver') {
        if (s.packageCar.dead) {
          this.fail(world, 'The package car was wrecked.');
          return;
        }
        if (world.player.inCar === s.packageCar && dist(p.x, p.y, s.checkpoint.x, s.checkpoint.y) < 70) {
          this.complete(world);
          return;
        }
      }
    } else if (s.def.id === 'rampage') {
      if (world.chaos - s.chaosStart >= s.target) {
        this.complete(world);
        return;
      }
    }
  }

  objectiveText() {
    const s = this.active;
    if (!s) return null;
    const time = Math.max(0, Math.ceil(s.timeLeft));
    if (s.def.id === 'bay-run') return `${s.def.title}: checkpoint ${s.idx + 1}/${s.checkpoints.length} — ${time}s`;
    if (s.def.id === 'special-delivery') {
      return s.phase === 'getcar'
        ? `${s.def.title}: get in the marked car — ${time}s`
        : `${s.def.title}: reach the drop-off — ${time}s`;
    }
    return `${s.def.title}: cause ${s.target} chaos — ${time}s`;
  }

  drawMarkers(ctx, world) {
    const s = this.active;
    if (!s || !s.checkpoint) return;
    const { x, y } = s.checkpoint;
    const pulse = 26 + Math.sin(world.time * 5) * 6;
    ctx.save();
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,225,77,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(x, y - pulse - 26);
    ctx.lineTo(x - 11, y - pulse - 46);
    ctx.lineTo(x + 11, y - pulse - 46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
