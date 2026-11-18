// HUD drawn on the main canvas: stars, health, cash, speed, objective, phone, banners.
import { drawMinimap } from './minimap.js';

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(0,0,0,.55)') {
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill();
  ctx.fillStyle = color; if (frac > 0) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(2, w * Math.min(1, frac)), h, 3); ctx.fill(); }
}
export function drawHUD(ctx, vw, vh, G) {
  const W = G.wanted;
  // minimap bottom-left
  drawMinimap(ctx, 14, vh - 14 - 150 * 0.78, 150, G);
  // wanted stars top-right
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    const x = vw - 18 - (4 - i) * 30, y = 16;
    const active = i < W.stars;
    const flash = W.stars > 0 && Math.floor(performance.now() / 400) % 2 === 0;
    ctx.font = '26px sans-serif';
    ctx.fillStyle = active ? (flash ? '#ffd23e' : '#ffb020') : 'rgba(255,255,255,.25)';
    ctx.fillText('★', x, y + 22);
  }
  // heat meter under stars
  if (W.stars > 0 || W.heat > 0) {
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.fillText('HEAT', vw - 18, 58);
    bar(ctx, vw - 168, 62, 150, 7, W.heat, '#ff5a3c');
  }
  // busted meter
  if (W.busted > 0.02) {
    ctx.fillStyle = '#ff3b30'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', vw / 2, 92);
    bar(ctx, vw / 2 - 110, 98, 220, 10, W.busted, '#ff3b30');
  }
  // health + cash bottom-right, on a backing panel so it reads over bright buildings
  ctx.fillStyle = 'rgba(10,12,24,.55)';
  ctx.beginPath(); ctx.roundRect(vw - 230, vh - 76, 216, 64, 8); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('HEALTH', vw - 218, vh - 52);
  bar(ctx, vw - 218, vh - 46, 200, 12, G.player.hp / 100, G.player.hp > 30 ? '#2eff8a' : '#ff3b30');
  ctx.font = 'bold 19px sans-serif'; ctx.fillStyle = '#2eff8a';
  ctx.fillText('$' + G.save.cash.toLocaleString(), vw - 218, vh - 14);
  ctx.fillStyle = '#ffd23e'; ctx.font = '13px sans-serif';
  ctx.fillText('Respect ' + G.save.respect, vw - 118, vh - 14);
  // speed
  if (G.player.car) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(G.speedKmh + '', vw - 230, vh - 70);
    ctx.font = '12px sans-serif'; ctx.fillText('km/h', vw - 230, vh - 54);
    ctx.textAlign = 'left';
  }
  // objective banner top-center
  if (G.objective) {
    const o = G.objective;
    ctx.fillStyle = 'rgba(10,12,24,.78)';
    const label = o.text + (o.target ? ` — ${o.dist}m` : '') + (o.time != null ? ` — ${Math.max(0, Math.ceil(o.time))}s` : '');
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(label).width + 36;
    ctx.beginPath(); ctx.roundRect(vw / 2 - w / 2, 12, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffd23e'; ctx.textAlign = 'center'; ctx.fillText(label, vw / 2, 35);
    ctx.textAlign = 'left';
    // direction arrow at screen edge toward target
    if (o.target) drawTargetArrow(ctx, vw, vh, G, o.target);
  }
  // phone messages bottom-center-left
  let py = vh - 190;
  for (const m of G.mission.phone) {
    ctx.fillStyle = 'rgba(16,20,32,.88)';
    ctx.font = '12px sans-serif';
    const lines = wrap(m.text, 34);
    const h = 22 + lines.length * 15;
    ctx.beginPath(); ctx.roundRect(180, py - h, 300, h, 10); ctx.fill();
    ctx.fillStyle = '#7dd3fc'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('📱 ' + m.from, 190, py - h + 16);
    ctx.fillStyle = '#e8e8e8'; ctx.font = '12px sans-serif';
    lines.forEach((ln, i) => ctx.fillText(ln, 190, py - h + 33 + i * 15));
    py -= h + 8;
  }
  // interaction prompt
  if (G.prompt) {
    ctx.fillStyle = 'rgba(10,12,24,.8)'; ctx.font = 'bold 14px sans-serif';
    const w = ctx.measureText(G.prompt).width + 28;
    ctx.beginPath(); ctx.roundRect(vw / 2 - w / 2, vh - 90, w, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(G.prompt, vw / 2, vh - 70);
    ctx.textAlign = 'left';
  }
  // controls hint
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '11px sans-serif';
  ctx.fillText('WASD move · Mouse aim · Click shoot · E car · Shift sprint · P pause · M mute', 14, 18);
}
function drawTargetArrow(ctx, vw, vh, G, target) {
  const p = G.playerPos;
  const sx = target.x - G.cam.x + vw / 2 - (p.x - G.cam.x), sy = target.y - G.cam.y + vh / 2 - (p.y - G.cam.y);
  // target screen pos relative to camera centered on player:
  const tx = vw / 2 + (target.x - p.x), ty = vh / 2 + (target.y - p.y);
  if (tx > 30 && tx < vw - 30 && ty > 30 && ty < vh - 30) return; // on screen already
  const a = Math.atan2(ty - vh / 2, tx - vw / 2);
  const ex = vw / 2 + Math.cos(a) * (Math.min(vw, vh) / 2 - 46), ey = vh / 2 + Math.sin(a) * (Math.min(vw, vh) / 2 - 46);
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
  ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.fill();
  ctx.restore();
}
function wrap(text, n) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 4);
}
