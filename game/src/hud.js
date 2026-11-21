// HUD: health, money, wanted stars, mission banner, speed, clock, and the
// minimap; plus the title, pause, busted and game-over screens.
import { WORLD, WATER_TOP, clamp } from './config.js';
import { currentJob } from './missions.js';

export function renderHud(world) {
  const ctx = world.ctx;
  const view = world.view;
  const p = world.player;
  if (world.state === 'title') {
    drawTitle(world, ctx);
    return;
  }
  // Top-left: wanted stars + money.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 12, 250, 64);
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd83a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 24 + i * 30, 40);
  }
  ctx.fillStyle = '#7ae87a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.money}`, 24, 68);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 84, 200, 18);
  ctx.fillStyle = p.health > 40 ? '#4ad44a' : '#d43a2a';
  ctx.fillRect(16, 86, 196 * clamp(p.health, 0, 100) / 100, 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 220, 98);
  // Mission banner.
  const job = currentJob(world.missions);
  if (job && !world.missions.allDone) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, 110, 380, 52);
    ctx.fillStyle = '#ffd83a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(job.name, 24, 130);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(job.text, 24, 150);
    if (job.survive) {
      ctx.fillStyle = '#ff9a3a';
      ctx.fillText(`Hold out: ${Math.max(0, world.missions.surviveLeft).toFixed(0)}s`, 24, 166);
    }
  }
  if (world.missions.flash > 0 && world.missions.message) {
    ctx.fillStyle = '#7ae87a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.missions.message, view.w / 2, 60);
    ctx.textAlign = 'left';
  }
  // Speed + clock, bottom-left.
  const speed = p.onFoot ? Math.round(p.speed * 2.2) : Math.round(Math.abs(p.car ? p.car.speed : 0) * 2.2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, view.h - 52, 190, 38);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(p.onFoot ? 'ON FOOT' : `${speed} km/h`, 24, view.h - 28);
  const hours = Math.floor(6 + world.dayT * 24) % 24;
  const mins = Math.floor((world.dayT * 24 * 60) % 60);
  ctx.fillText(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, 130, view.h - 28);
  drawMinimap(world, ctx);
  // Controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive · E enter car · Mouse aim · Click shoot · P pause', 14, view.h - 62);
  if (world.state === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 10);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P to resume', view.w / 2, view.h / 2 + 26);
    ctx.textAlign = 'left';
  }
  if (world.state === 'busted') {
    ctx.fillStyle = 'rgba(0,0,20,0.75)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#ffd83a';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', view.w / 2, view.h / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Fine paid: $${world.lastFine || 0} — press Enter to get back out there`, view.w / 2, view.h / 2 + 26);
    ctx.textAlign = 'left';
  }
  if (world.state === 'gameover') {
    ctx.fillStyle = 'rgba(20,0,0,0.8)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#e83a3a';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', view.w / 2, view.h / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Press Enter to start over', view.w / 2, view.h / 2 + 26);
    ctx.textAlign = 'left';
  }
}

function drawMinimap(world, ctx) {
  const view = world.view;
  const size = 150;
  const x0 = view.w - size - 14;
  const y0 = 14;
  const s = size / WORLD;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = '#2a5a34';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#1d6f8e';
  ctx.fillRect(x0, y0 + WATER_TOP * s, size, size - WATER_TOP * s);
  ctx.fillStyle = '#55555c';
  for (let p = 0; p <= WORLD; p += 400) {
    ctx.fillRect(x0, y0 + p * s - 1, size, 2);
    ctx.fillRect(x0 + p * s - 1, y0, 2, size);
  }
  const job = currentJob(world.missions);
  if (job && !world.missions.allDone) {
    ctx.fillStyle = '#ffd83a';
    ctx.beginPath();
    ctx.arc(x0 + job.x * s, y0 + job.y * s, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e83a3a';
  for (const cop of world.police) {
    ctx.fillRect(x0 + cop.x * s - 2, y0 + cop.y * s - 2, 4, 4);
  }
  const p = world.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + p.x * s, y0 + p.y * s, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd83a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + p.x * s, y0 + p.y * s, 6, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTitle(world, ctx) {
  const view = world.view;
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#ffd83a';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MARINA HEAT', view.w / 2, view.h / 2 - 90);
  ctx.fillStyle = '#1d6f8e';
  ctx.fillRect(view.w / 2 - 260, view.h / 2 - 60, 520, 8);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('Coral Marina — an open-world crime sandbox', view.w / 2, view.h / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#c8c8c8';
  ctx.fillText('Five jobs. One city. As many stars as you can handle.', view.w / 2, view.h / 2 + 14);
  ctx.fillStyle = '#ffd83a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to start', view.w / 2, view.h / 2 + 70);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move / drive · E enter car · Mouse aim · Click shoot · P pause', view.w / 2, view.h / 2 + 104);
  ctx.textAlign = 'left';
}
