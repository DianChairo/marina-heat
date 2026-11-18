// hud.js — heads-up display and full-screen states drawn on the canvas:
// health, cash, wanted stars, chaos, mission objective, phone messages,
// banners, and the title / pause / WASTED / BUSTED screens.

import { clamp } from './rng.js';

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(12,16,24,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export function drawHUD(ctx, world, vw, vh) {
  const { player, wanted } = world;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Health bar (bottom-left, above the minimap zone).
  const hx = 18;
  const hy = vh - 44;
  panel(ctx, hx - 6, hy - 24, 236, 56, 0.5);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HEALTH', hx, hy - 8);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(hx + 62, hy - 17, 160, 11);
  const hpRatio = clamp(player.health / player.maxHealth, 0, 1);
  ctx.fillStyle = hpRatio > 0.3 ? '#57d977' : '#e84a4a';
  ctx.fillRect(hx + 62, hy - 17, 160 * hpRatio, 11);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`$${world.cash}`, hx, hy + 16);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(`CHAOS ${Math.floor(world.chaos)}`, hx + 90, hy + 16);

  // Wanted stars (top-right).
  const stars = wanted.stars;
  if (stars > 0 || wanted.heat > 0) {
    panel(ctx, vw - 208, 14, 190, 46, 0.5);
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i < 5; i++) {
      const sx = vw - 30 - i * 32;
      ctx.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', sx, 48);
    }
    ctx.textAlign = 'left';
  }

  // Busted meter.
  if (wanted.busted > 0.02) {
    const bw = 260;
    const bx = vw / 2 - bw / 2;
    panel(ctx, bx - 10, 66, bw + 20, 40, 0.6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', vw / 2, 84);
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(bx, 90, bw, 8);
    ctx.fillStyle = '#4a90ff';
    ctx.fillRect(bx, 90, bw * wanted.busted, 8);
    ctx.textAlign = 'left';
  }

  // Mission objective (top-centre).
  const objective = world.missions.objectiveText();
  if (objective) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(objective).width + 28;
    panel(ctx, vw / 2 - w / 2, 14, w, 34, 0.55);
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(objective, vw / 2, 37);
    ctx.textAlign = 'left';
  }

  // Car name + damage while driving.
  if (player.inCar) {
    const car = player.inCar;
    ctx.font = 'bold 14px system-ui, sans-serif';
    const label = `${car.spec.name}  ${Math.round(car.speed() * 0.14)} km/h`;
    const w = ctx.measureText(label).width + 24;
    panel(ctx, vw - w - 18, vh - 96, w, 52, 0.5);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, vw - w - 6, vh - 72);
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(vw - w - 6, vh - 62, w - 24, 7);
    ctx.fillStyle = car.health > 30 ? '#57d977' : '#e84a4a';
    ctx.fillRect(vw - w - 6, vh - 62, (w - 24) * (car.health / 100), 7);
  }

  // Context prompt.
  if (world.prompt) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(world.prompt).width + 30;
    panel(ctx, vw / 2 - w / 2, vh - 108, w, 34, 0.65);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(world.prompt, vw / 2, vh - 85);
    ctx.textAlign = 'left';
  }

  drawPhone(ctx, world, vw, vh);
  drawBanner(ctx, world, vw, vh);
  ctx.restore();
}

function drawPhone(ctx, world, vw, vh) {
  const msgs = world.missions.messageQueue;
  if (!msgs.length) return;
  const m = msgs[msgs.length - 1];
  const w = 292;
  const h = 86;
  const x = vw - w - 18;
  const y = vh - h - 150;
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,18,0.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = '#3a4152';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#57d977';
  ctx.beginPath();
  ctx.arc(x + 20, y + 20, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(m.from, x + 36, y + 25);
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillStyle = '#d7dde8';
  wrapText(ctx, m.text, x + 14, y + 46, w - 28, 15, 2);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      lines++;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH);
}

function drawBanner(ctx, world, vw, vh) {
  const b = world.missions.banner;
  if (!b) return;
  const a = clamp(b.t, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(10,12,18,0.72)';
  ctx.fillRect(0, vh * 0.3, vw, 110);
  ctx.textAlign = 'center';
  ctx.fillStyle = b.kind === 'win' ? '#57d977' : '#e84a4a';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText(b.text, vw / 2, vh * 0.3 + 52);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(b.sub, vw / 2, vh * 0.3 + 84);
  ctx.restore();
}

export function drawTitle(ctx, world, vw, vh) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, 'rgba(16,24,48,0.55)');
  grad.addColorStop(1, 'rgba(60,16,32,0.65)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('MARINA HEAT', vw / 2, vh * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = '21px system-ui, sans-serif';
  ctx.fillText('An open-world crime spree in Coral Marina', vw / 2, vh * 0.3 + 40);
  panel(ctx, vw / 2 - 250, vh * 0.46, 500, 168, 0.62);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#d7dde8';
  const lines = [
    'WASD / Arrows — move & drive      Shift — sprint',
    'Mouse — aim      Click / hold — shoot',
    'E — steal / exit car      Space — handbrake',
    'F — accept mission      P — pause      M — mute',
  ];
  lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh * 0.46 + 36 + i * 26));
  ctx.fillStyle = '#57d977';
  ctx.font = 'bold 24px system-ui, sans-serif';
  if (world.save && !world.save.fresh && (world.save.missionsDone.length > 0 || world.save.cash !== 250)) {
    ctx.fillText('Press ENTER to continue', vw / 2, vh * 0.46 + 210);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Saved cash $${world.save.cash} · missions done ${world.save.missionsDone.length}/3 · N for new game`, vw / 2, vh * 0.46 + 238);
  } else {
    ctx.fillText('Press ENTER to start', vw / 2, vh * 0.46 + 210);
  }
  ctx.restore();
}

export function drawPause(ctx, vw, vh) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.66)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh * 0.42);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#d7dde8';
  ctx.fillText('P or Esc to resume · M to toggle sound', vw / 2, vh * 0.42 + 38);
  ctx.restore();
}

export function drawEndScreen(ctx, kind, world, vw, vh) {
  ctx.save();
  ctx.fillStyle = kind === 'wasted' ? 'rgba(60,4,4,0.68)' : 'rgba(4,16,60,0.68)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'wasted' ? '#e84a4a' : '#6ab4ff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', vw / 2, vh * 0.42);
  ctx.fillStyle = '#fff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(`Cash kept: $${world.cash} · Chaos caused: ${Math.floor(world.chaos)}`, vw / 2, vh * 0.42 + 44);
  ctx.fillText('Press ENTER to play again', vw / 2, vh * 0.42 + 78);
  ctx.restore();
}
