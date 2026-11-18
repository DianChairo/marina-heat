// hud.js — all screen-space UI: bars, stars, banners, phone, overlays, markers.
import { drawMinimap } from './minimap.js';
import { missionMarker } from './missions.js';
import { clamp, dist } from './rng.js';
function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(8,12,18,0.72)'; ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, x + 4, y + h - 2.5); }
}
export function drawWorldMarkers(ctx, S) {
  const mk = missionMarker(S);
  if (!mk) return;
  const sx = mk.x - S.cam.x + S.vw / 2, sy = mk.y - S.cam.y + S.vh / 2;
  const on = sx > -30 && sx < S.vw + 30 && sy > -30 && sy < S.vh + 30;
  const bob = Math.sin(S.t * 4) * 5;
  if (on) {
    ctx.strokeStyle = mk.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 30 + Math.sin(S.t * 3) * 4, 0, 7); ctx.stroke();
    ctx.fillStyle = mk.color; ctx.beginPath(); ctx.arc(mk.x, mk.y - 52 + bob, 15, 0, 7); ctx.fill();
    ctx.fillStyle = '#12233d'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(mk.label === 'M' ? 'M' : '!', mk.x, mk.y - 47 + bob);
    ctx.beginPath(); ctx.moveTo(mk.x - 6, mk.y - 40 + bob); ctx.lineTo(mk.x + 6, mk.y - 40 + bob); ctx.lineTo(mk.x, mk.y - 30 + bob); ctx.closePath(); ctx.fillStyle = mk.color; ctx.fill();
  }
}
export function drawOffscreenArrow(ctx, S) {
  const mk = missionMarker(S);
  if (!mk) return;
  const dx = mk.x - S.player.x, dy = mk.y - S.player.y, d = Math.hypot(dx, dy);
  if (d < 300) return;
  const cx = S.vw / 2, cy = S.vh / 2, a = Math.atan2(dy, dx);
  const ex = cx + Math.cos(a) * 120, ey = cy + Math.sin(a) * 120;
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(d) + 'm', ex, ey + 26);
}
export function drawHUD(ctx, S) {
  const vw = S.vw, vh = S.vh, p = S.player;
  drawMinimap(ctx, S, 14, 14, 148);
  // wanted stars top-right
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.fillStyle = i < S.wanted ? '#ffd23f' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', vw - 18 - (4 - i) * 30, 40);
  }
  if (S.wanted > 0) bar(ctx, vw - 178, 52, 160, 10, S.heat / 100, '#ff9046', 'HEAT');
  if (S.busted > 1) bar(ctx, vw - 178, 70, 160, 12, S.busted / 100, '#ff4040', 'BUSTED');
  if (S.seenByCop === false && S.wanted > 0) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12px sans-serif'; ctx.fillText('out of sight…', vw - 18, 100); }
  // health + cash bottom-left
  bar(ctx, 14, vh - 58, 190, 15, p.hp / p.maxHp, p.hp > 30 ? '#53d769' : '#ff4040', 'HEALTH');
  ctx.fillStyle = 'rgba(8,12,18,0.72)'; ctx.beginPath(); ctx.roundRect(12, vh - 38, 230, 26, 6); ctx.fill();
  ctx.fillStyle = '#7bf1a8'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('$' + S.cash.toLocaleString('en-US'), 20, vh - 19);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('★ ' + S.score, 128, vh - 19);
  if (S.missions.hasPackage) { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('📦 PACKAGE', 20, vh - 70); }
  // speed bottom-right
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36 * 2.2);
    ctx.fillStyle = 'rgba(8,12,18,0.72)'; ctx.beginPath(); ctx.roundRect(vw - 138, vh - 66, 124, 52, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(kmh, vw - 76, vh - 34);
    ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText('km/h', vw - 76, vh - 20);
  }
  // objective banner top-centre
  if (S.objective) {
    ctx.font = 'bold 15px sans-serif';
    const w = Math.min(vw - 420, ctx.measureText(S.objective).width + 34);
    ctx.fillStyle = 'rgba(8,12,18,0.78)'; ctx.beginPath(); ctx.roundRect(vw / 2 - w / 2, 14, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffe9a3'; ctx.textAlign = 'center'; ctx.fillText(S.objective, vw / 2, 37);
  }
  // phone message box bottom-right
  if (S.phone && S.t - S.phone.at < 7) {
    const msg = S.phone;
    ctx.font = '13px sans-serif';
    const lines = wrap(ctx, msg.text, 250);
    const h = 44 + lines.length * 17;
    const x = vw - 292, y = vh - h - (p.car ? 76 : 14);
    ctx.fillStyle = 'rgba(10,16,24,0.92)'; ctx.beginPath(); ctx.roundRect(x, y, 278, h, 12); ctx.fill();
    ctx.strokeStyle = '#3ec6d8'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#3ec6d8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('📱 ' + msg.from, x + 12, y + 20);
    ctx.fillStyle = '#eef4f8'; ctx.font = '13px sans-serif';
    lines.forEach((ln, i) => ctx.fillText(ln, x + 12, y + 40 + i * 17));
  }
  // floaters + hints
  for (const f of S.floaters) { ctx.fillStyle = f.color; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillText(f.text, f.x - S.cam.x + vw / 2, f.y - S.cam.y + vh / 2); ctx.globalAlpha = 1; }
  const near = !p.car && S.cars.some((c) => !c.dead && dist(p.x, p.y, c.x, c.y) < 46);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  if (near) ctx.fillText('[E] steal car', vw / 2, vh - 84);
  else if (p.car) ctx.fillText('[E] exit · SPACE drift · WASD drive', vw / 2, vh - 16);
  else ctx.fillText('WASD move · mouse aim · click shoot · SHIFT sprint · P pause · M mute', vw / 2, vh - 16);
  if (S.audio.muted) { ctx.fillStyle = '#ff9046'; ctx.textAlign = 'right'; ctx.fillText('MUTED', vw - 18, vh - 16); }
}
function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { if (ctx.measureText(cur + ' ' + w).width > maxW && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}
export function drawEndScreen(ctx, S, kind) {
  const vw = S.vw, vh = S.vh;
  ctx.fillStyle = kind === 'dead' ? 'rgba(60,0,0,0.55)' : 'rgba(0,10,50,0.55)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'dead' ? '#ff2d2d' : '#6db3ff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(kind === 'dead' ? 'WASTED' : 'BUSTED', vw / 2, vh / 2 - 60);
  ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif';
  const st = S.stats;
  ctx.fillText(`Cash $${S.cash.toLocaleString('en-US')} · Respect ${S.score} · Missions done ${st.missionsDone}`, vw / 2, vh / 2);
  ctx.fillText(`Cars wrecked ${st.wrecks} · Shots fired ${st.shots} · Crimes ${st.crimes} · Top speed ${Math.round(st.topSpeed)} km/h`, vw / 2, vh / 2 + 30);
  ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#ffd23f';
  ctx.fillText('Press R or click to run it back', vw / 2, vh / 2 + 78);
}
export function drawPause(ctx, S) {
  ctx.fillStyle = 'rgba(5,8,14,0.62)'; ctx.fillRect(0, 0, S.vw, S.vh);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', S.vw / 2, S.vh / 2 - 20);
  ctx.font = '17px sans-serif'; ctx.fillText('P / Esc to resume · your cash & respect are saved', S.vw / 2, S.vh / 2 + 16);
}
