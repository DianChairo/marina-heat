// missions.js — work for fixer Marisol Vega, who waits by the marina
// promenade. Walk into her marker to take a job: package deliveries,
// pickups, and the timed Bay Run checkpoint race around the bay.
// Finishing a job pays cash and reputation and saves the game.

import { dist } from './rng.js';
import { BLOCK, WATER_X, WATER_Y } from './city.js';

const JOB_KINDS = ['delivery', 'pickup', 'bayrun'];

export class Missions {
  constructor(world) {
    this.world = world;
    this.active = null; // {kind, stage, target, checkpoints, idx, timeLeft, pay}
    this.completed = 0;
    this.banner = '';
    this.bannerTime = 0;
    this.offerKind = 'delivery';
  }

  get marisol() {
    return this.world.city.marisol;
  }

  nearMarisol() {
    const p = this.world.player;
    return !p.inCar && dist(p.x, p.y, this.marisol.x, this.marisol.y) < 40;
  }

  promptText() {
    if (this.active) return null;
    if (this.nearMarisol()) {
      const label = { delivery: 'a delivery', pickup: 'a pickup', bayrun: 'the Bay Run' }[this.offerKind];
      return `Marisol Vega: "I need ${label}. Step closer, we talk." — walk away and back to accept`;
    }
    return null;
  }

  update(dt) {
    const w = this.world;
    const p = w.player;
    this.bannerTime = Math.max(0, this.bannerTime - dt);

    if (!this.active) {
      // Accept the offered job by standing with Marisol a moment.
      if (this.nearMarisol()) {
        this.acceptTimer = (this.acceptTimer || 0) + dt;
        if (this.acceptTimer > 0.6) {
          this.startJob(this.offerKind);
          this.acceptTimer = 0;
        }
      } else {
        this.acceptTimer = 0;
      }
      return;
    }

    const job = this.active;
    if (job.kind === 'bayrun') {
      job.timeLeft -= dt;
      const cp = job.checkpoints[job.idx];
      if (cp && dist(p.x, p.y, cp.x, cp.y) < 56) {
        job.idx++;
        w.audio.pickup();
        this.showBanner(`Checkpoint ${job.idx}/${job.checkpoints.length}`);
        if (job.idx >= job.checkpoints.length) {
          this.finishJob(job);
          return;
        }
      }
      if (job.timeLeft <= 0) {
        this.failJob('Out of time. Marisol shrugs: "Traffic, huh?"');
      }
      return;
    }

    // Delivery / pickup: reach the target (delivery wants a car).
    const t = job.target;
    if (dist(p.x, p.y, t.x, t.y) < 46) {
      if (job.kind === 'delivery' && !p.inCar) {
        this.hint = 'Marisol wants this done by car — grab some wheels.';
        return;
      }
      this.finishJob(job);
    }
  }

  startJob(kind) {
    const w = this.world;
    const rng = w.rng;
    if (kind === 'bayrun') {
      // Checkpoints ringing the marina promenade and the south shore.
      const cps = [];
      const spots = [
        { x: WATER_X - 130, y: 300 },
        { x: WATER_X - 130, y: 1150 },
        { x: WATER_X - 130, y: 1900 },
        { x: 2300, y: WATER_Y - 130 },
        { x: 1400, y: WATER_Y - 130 },
        { x: 500, y: WATER_Y - 130 },
        { x: 256, y: 1900 },
        { x: 256, y: 900 },
      ];
      for (const s of spots) cps.push({ x: s.x + rng.range(-14, 14), y: s.y + rng.range(-14, 14) });
      this.active = { kind, checkpoints: cps, idx: 0, timeLeft: 150, pay: 420 };
      this.showBanner('BAY RUN — hit every checkpoint before the clock dies!');
    } else {
      // A target on a random street corner, away from the player.
      let tx = 0;
      let ty = 0;
      for (let tries = 0; tries < 20; tries++) {
        tx = Math.floor(rng.range(1, 10)) * BLOCK + rng.range(-20, 20);
        ty = Math.floor(rng.range(1, 10)) * BLOCK + rng.range(-20, 20);
        if (dist(tx, ty, w.player.x, w.player.y) > 800) break;
      }
      this.active = { kind, target: { x: tx, y: ty }, pay: kind === 'delivery' ? 180 : 140 };
      this.showBanner(kind === 'delivery'
        ? 'DELIVERY — get the package across town (by car).'
        : 'PICKUP — reach the contact and bring them in.');
    }
    w.audio.blip(740, 0.09, 'triangle', 0.16);
  }

  finishJob(job) {
    const w = this.world;
    const bonus = job.kind === 'bayrun' ? Math.round(Math.max(0, job.timeLeft) * 2) : 0;
    const total = job.pay + bonus;
    w.save.cash += total;
    w.save.rep += job.kind === 'bayrun' ? 3 : 1;
    w.save.missionsDone += 1;
    if (job.kind === 'bayrun') {
      const elapsed = 150 - job.timeLeft;
      if (w.save.bestBayRun === null || elapsed < w.save.bestBayRun) w.save.bestBayRun = Math.round(elapsed);
    }
    w.persist();
    this.completed++;
    this.active = null;
    this.offerKind = JOB_KINDS[this.completed % JOB_KINDS.length];
    this.showBanner(`Job done — $${total} from Marisol. Rep up.`);
    w.audio.cash();
  }

  failJob(why) {
    this.active = null;
    this.showBanner(why);
    this.offerKind = 'bayrun';
  }

  showBanner(text) {
    this.banner = text;
    this.bannerTime = 4;
  }

  // Objective marker info for HUD/minimap.
  objective() {
    if (!this.active) return { x: this.marisol.x, y: this.marisol.y, label: 'Marisol Vega', color: '#ffd94d' };
    const job = this.active;
    if (job.kind === 'bayrun') {
      const cp = job.checkpoints[job.idx];
      if (cp) return { x: cp.x, y: cp.y, label: `Bay Run ${job.idx + 1}/${job.checkpoints.length}`, color: '#4dd2ff' };
      return null;
    }
    return { x: job.target.x, y: job.target.y, label: job.kind === 'delivery' ? 'Delivery' : 'Pickup', color: '#7dff6a' };
  }

  drawWorld(ctx, cam) {
    const w = this.world;
    // Marisol herself: standing figure with a gold marker.
    const m = this.marisol;
    const sx = m.x - cam.x;
    const sy = m.y - cam.y;
    if (sx > -40 && sy > -40 && sx < cam.w + 40 && sy < cam.h + 40) {
      const bob = Math.sin(w.time * 2.2) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 5, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a4a12';
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 4.4, 0, Math.PI * 2);
      ctx.fill();
      // Floating "!".
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.active ? '…' : '!', sx, sy - 18 + bob);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Marisol Vega', sx, sy + 24);
    }

    // Objective beacon.
    const obj = this.objective();
    if (obj && this.active) {
      const ox = obj.x - cam.x;
      const oy = obj.y - cam.y;
      const pulse = 14 + Math.sin(w.time * 4) * 4;
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ox, oy, pulse + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = obj.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(ox, oy, pulse + 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
