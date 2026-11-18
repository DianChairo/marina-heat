// player.js — the on-foot player: movement with sprint, building
// collision, health and a small drawn character with a gun arm that
// tracks the mouse aim.

import { clamp, angleTo } from './rng.js';
import { WORLD } from './city.js';

export const PLAYER_R = 13;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;      // facing / aim direction
    this.health = 100;
    this.maxHealth = 100;
    this.walkPhase = 0;
    this.moving = false;
    this.inCar = null;   // vehicle reference while driving
    this.dead = false;
  }

  get pos() {
    return this.inCar ? { x: this.inCar.x, y: this.inCar.y } : { x: this.x, y: this.y };
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
  }

  hurt(amount) {
    if (this.dead) return;
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    if (this.health <= 0) this.dead = true;
  }

  update(dt, input, city, worldPos) {
    if (this.inCar || this.dead) return;
    const axis = input.moveAxis();
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    const speed = sprint ? 268 : 168;
    this.moving = axis.x !== 0 || axis.y !== 0;
    const accel = 1400;
    this.vx += axis.x * accel * dt;
    this.vy += axis.y * accel * dt;
    // Friction so the player stops crisply.
    const fr = Math.pow(0.0001, dt);
    if (axis.x === 0) this.vx *= fr;
    if (axis.y === 0) this.vy *= fr;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > speed) {
      this.vx = (this.vx / sp) * speed;
      this.vy = (this.vy / sp) * speed;
    }
    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;
    const fixed = city.collideCircle(nx, ny, PLAYER_R);
    // If collision pushed us, kill the velocity into the wall.
    if (Math.abs(fixed.x - nx) > 0.01) this.vx = 0;
    if (Math.abs(fixed.y - ny) > 0.01) this.vy = 0;
    this.x = clamp(fixed.x, PLAYER_R, WORLD - PLAYER_R);
    this.y = clamp(fixed.y, PLAYER_R, WORLD - PLAYER_R);
    if (this.moving) this.walkPhase += dt * (sprint ? 13 : 9);
    this.angle = angleTo(this.x, this.y, worldPos.x, worldPos.y);
  }

  speedNow() {
    return Math.hypot(this.vx, this.vy);
  }

  draw(ctx) {
    if (this.inCar) return;
    const { x, y } = this;
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs (walk cycle).
    const legSwing = this.moving ? Math.sin(this.walkPhase) * 6 : 0;
    ctx.strokeStyle = '#2c3a55';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(this.angle + Math.PI / 2) * 4 + legSwing * Math.cos(this.angle), Math.sin(this.angle + Math.PI / 2) * 4 + legSwing * Math.sin(this.angle));
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(this.angle - Math.PI / 2) * 4 - legSwing * Math.cos(this.angle), Math.sin(this.angle - Math.PI / 2) * 4 - legSwing * Math.sin(this.angle));
    ctx.stroke();
    // Body: coral shirt.
    ctx.rotate(this.angle);
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(2, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // Gun arm toward the aim.
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(15, 3);
    ctx.stroke();
    ctx.fillStyle = '#22242a';
    ctx.fillRect(13, 1.4, 10, 3.4);
    ctx.restore();
  }
}
