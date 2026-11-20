// hud.js — all screen-space drawing: cash/rep, health, wanted stars,
// mission banner + prompt, title / pause / busted / wasted overlays,
// and the cover tableau used by the screenshot mode.

import { drawMinimap } from './minimap.js';

export function drawHUD(ctx, world) {
  const { w, h } = { w: ctx.canvas.width, h: ctx.canvas.height };
  const save = world.save;

  if (world.state === 'title') {
    drawTitle(ctx, world, w, h);
    return;
  }

  // Top-left: money + reputation.
  ctx.textAlign = 'left';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(14, 12, 240, 66);
  ctx.fillStyle = '#7dff6a';
  ctx.fillText(`$${save.cash}`, 26, 42);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`REP ${save.rep}   JOBS ${save.missionsDone}`, 26, 66);

  // Top-right: wanted stars.
  const stars = world.police.stars;
  ctx.textAlign = 'right';
  ctx.font = 'bold 30px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 26 - (4 - i) * 34, 44);
  }
  if (world.police.bust > 0.05) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(w - 190, 56, 164, 12);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(w - 188, 58, 160 * Math.min(1, world.police.bust), 8);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BUSTED?', w - 26, 84);
  }

  // Bottom-left: health bar (+ car health while driving).
  const hp = Math.max(0, world.player.health);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(16, h - 44, 224, 20);
  ctx.fillStyle = hp > 30 ? '#58d158' : '#e74c3c';
  ctx.fillRect(18, h - 42, 220 * (hp / 100), 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 22, h - 30);
  if (world.player.inCar) {
    const ch = Math.max(0, world.player.inCar.health);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(16, h - 70, 224, 14);
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(18, h - 68, 220 * (ch / 100), 10);
  }

  // Mission banner.
  const missions = world.missions;
  if (missions.bannerTime > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 21px system-ui, sans-serif';
    const tw = ctx.measureText(missions.banner).width + 44;
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    ctx.fillRect(w / 2 - tw / 2, 92, tw, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(missions.banner, w / 2, 119);
  }

  // Objective line + Bay Run clock.
  const obj = missions.objective();
  if (obj) {
    ctx.textAlign = 'center';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    let line = `Objective: ${obj.label}`;
    if (missions.active && missions.active.kind === 'bayrun') {
      line += `   ⏱ ${Math.max(0, missions.active.timeLeft).toFixed(0)}s`;
    }
    ctx.fillText(line, w / 2, h - 16);
  }
  if (missions.hint) {
    ctx.textAlign = 'center';
    ctx.font = 'italic 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(missions.hint, w / 2, h - 40);
    missions.hint = null;
  }

  // Context prompt.
  const prompt = contextPrompt(world);
  if (prompt) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(10,14,28,0.66)';
    const tw = ctx.measureText(prompt).width + 36;
    ctx.fillRect(w / 2 - tw / 2, h - 118, tw, 34);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(prompt, w / 2, h - 95);
  }

  drawMinimap(ctx, world);

  if (world.state === 'paused') overlay(ctx, w, h, 'PAUSED', 'Press P to resume');
  if (world.state === 'busted') overlay(ctx, w, h, 'BUSTED', 'The Coral Marina PD got you. Press Enter.');
  if (world.state === 'wasted') overlay(ctx, w, h, 'WASTED', 'You wake up at the marina clinic. Press Enter.');
}

function contextPrompt(world) {
  const p = world.player;
  if (world.state !== 'playing') return null;
  if (p.inCar) return 'E — exit car';
  const mPrompt = world.missions.promptText();
  if (mPrompt) return mPrompt;
  // Near a car?
  for (const car of world.allCars()) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 44) return car.driver === null ? 'E — steal car' : 'E — take car';
  }
  return null;
}

function overlay(ctx, w, h, title, sub) {
  ctx.fillStyle = 'rgba(5,8,18,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, w / 2, h / 2 - 10);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(sub, w / 2, h / 2 + 34);
}

export function drawTitle(ctx, world, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(20,10,40,0.25)');
  grad.addColorStop(1, 'rgba(10,10,30,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5e78';
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.fillText('MARINA HEAT', w / 2, 240);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('CORAL MARINA · EST. 1986', w / 2, 286);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Steal cars. Run jobs for Marisol Vega. Outrun the law.', w / 2, 348);
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Press ENTER to play', w / 2, 430);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WASD move · Mouse aim · Hold mouse to shoot · E enter/exit car · Shift sprint · P pause · M mute', w / 2, 470);
  if (world.save.missionsDone > 0) {
    ctx.fillText(`Welcome back — $${world.save.cash}, REP ${world.save.rep}, ${world.save.missionsDone} jobs done`, w / 2, 510);
  }
}

// The staged cover tableau title (screenshot mode only).
export function drawCoverTitle(ctx, w, h) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,6,24,0.35)';
  ctx.fillRect(0, 0, w, 170);
  ctx.fillStyle = '#ff5e78';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillText('MARINA HEAT', w / 2, 105);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('C O R A L   M A R I N A', w / 2, 145);
}
