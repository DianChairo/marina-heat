// hud.js — the full HUD: health bar, money, score, wanted stars, the
// BUSTED meter, mission timer + objective, Marisol's phone messages,
// and the title / pause / WASTED / BUSTED screens with their buttons.
import { MISSION_DEFS } from './missions.js';

export function drawHud(ctx, G, W, H) {
  const p = G.player;
  ctx.save();
  // Health bar (bottom-left)
  ctx.fillStyle = '#00000088';
  ctx.fillRect(16, H - 52, 220, 34);
  ctx.fillStyle = '#14532d';
  ctx.fillRect(22, H - 44, 150, 18);
  ctx.fillStyle = p.hp > 30 ? '#22c55e' : '#ef4444';
  ctx.fillRect(22, H - 44, 150 * (p.hp / p.maxHp), 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 178, H - 30);
  // Money + score (top-right)
  ctx.fillStyle = '#00000088';
  ctx.fillRect(W - 216, 14, 200, 56);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${Math.round(p.money).toLocaleString()}`, W - 206, 38);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`SCORE ${Math.round(G.score)}`, W - 206, 58);
  // Wanted stars (top-centre)
  ctx.fillStyle = '#00000088';
  const sw = 30 * 5 + 20;
  ctx.fillRect(W / 2 - sw / 2, 14, sw, 34);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#facc15' : '#475569';
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★', W / 2 - sw / 2 + 25 + i * 30, 40);
  }
  // BUSTED meter under the stars
  if (G.busted > 0.05) {
    ctx.fillStyle = '#00000088';
    ctx.fillRect(W / 2 - 80, 54, 160, 14);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(W / 2 - 78, 56, 156 * G.busted, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('BUSTED', W / 2, 66);
  }
  // Mission panel (top-left, under the minimap)
  if (G.mission) {
    const m = G.mission;
    ctx.fillStyle = '#000000aa';
    ctx.fillRect(16, 210, 250, 64);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(m.def.name, 26, 230);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${Math.ceil(m.t)}s left  •  $${m.def.reward}`, 26, 250);
    const obj = m.id === 0 ? `Checkpoints ${m.targets.filter((t) => t.hit).length}/4`
      : m.id === 1 ? (m.stage === 0 ? 'Reach the pier pickup' : 'Reach the uptown drop-off')
      : `Score ${Math.min(300, G.score - m.score0)}/300`;
    ctx.fillText(obj, 26, 268);
  } else {
    ctx.fillStyle = '#00000088';
    ctx.fillRect(16, 210, 250, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('No active job — press 1, 2 or 3', 26, 232);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText('1 Bay Run  •  2 Delivery  •  3 Rampage', 26, 252);
    ctx.fillText('E steal car  •  Click shoot  •  P pause', 26, 268);
  }
  // Phone messages (bottom-centre)
  let y = H - 110;
  for (const msg of G.messages.slice(-2)) {
    ctx.fillStyle = '#000000aa';
    const tw = Math.min(520, ctx.measureText(msg.text).width + 90);
    ctx.fillRect(W / 2 - tw / 2, y, tw, 30);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${msg.from}:`, W / 2 - tw / 2 + 10, y + 19);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(msg.text.slice(0, 70), W / 2 - tw / 2 + 118, y + 19);
    y -= 36;
  }
  // Controls hint (bottom-right)
  ctx.fillStyle = '#ffffffcc';
  ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive • Shift sprint • E car • Click shoot • M mute', W - 16, H - 16);
  ctx.restore();
}

function screen(ctx, W, H, title, lines, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 60);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 10 + i * 30));
  ctx.restore();
}

export function drawTitle(ctx, G, W, H) {
  screen(ctx, W, H, 'MARINA HEAT', [
    'Coral Marina is yours. Steal it, race it, survive it.',
    `Money $${Math.round(G.player.money)}  •  Score ${Math.round(G.score)}  •  Jobs done ${G.missionsDone.length}/3`,
    G.save ? 'Press ENTER or click to Continue' : 'Press ENTER or click to Start',
    'WASD move • E steal a car • Click to shoot • 1/2/3 start a job',
  ], '#f59e0b');
}

export function drawPause(ctx, W, H) {
  screen(ctx, W, H, 'PAUSED', ['Press P or Esc to resume', 'M mute • R restart current job'], '#e2e8f0');
}

export function drawWasted(ctx, W, H) {
  screen(ctx, W, H, 'WASTED', ['The marina takes another one.', 'Press ENTER to try again'], '#ef4444');
}

export function drawBusted(ctx, W, H) {
  screen(ctx, W, H, 'BUSTED', ['The Coral Marina PD has you. Bail: $200.', 'Press ENTER to walk free'], '#3b82f6');
}

export { MISSION_DEFS };
