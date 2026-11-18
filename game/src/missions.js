// Missions + Marisol Vega phone thread. Marker "M" downtown; 3 missions cycle.
import { sfx } from './audio.js';

export const MARKER = { x: 340, y: 340 };
const INTRO = [
  ['Marisol Vega', 'You made it to Coral Marina. Good. I run small jobs for people who don\'t ask questions.'],
  ['Marisol Vega', 'Come see me at the M marker downtown. First job pays cash. Don\'t bring the cops.'],
];
export const MISSIONS = [
  { id: 'race', name: 'Bay Run', pay: 400, respect: 10, brief: 'Bay Run: hit every checkpoint before the clock dies. Pure driving, no excuses.' },
  { id: 'delivery', name: 'Special Delivery', pay: 550, respect: 14, brief: 'Special Delivery: grab the package by the pier, drop it across town. Carrying it adds heat — move.' },
  { id: 'rampage', name: 'Rampage', pay: 650, respect: 18, brief: 'Rampage: score 600 chaos — wrecks, near misses, mayhem — before time runs out. Make noise.' },
];
export function makeMissionState() {
  return { active: null, idx: 0, t: 0, stage: 0, checkpoints: [], cpIdx: 0, chaos: 0, target: null, phone: [], phoneT: 0, offered: false, done: 0 };
}
export function pushPhone(M, from, text, dur = 6) { M.phone.push({ from, text, t: dur }); sfx('blip'); }
export function startIntro(M) { for (const [f, t] of INTRO) pushPhone(M, f, t, 7); }
export function nearMarker(p) { return Math.hypot(p.x - MARKER.x, p.y - MARKER.y) < 46; }
export function offerMission(M) {
  const m = MISSIONS[M.idx % MISSIONS.length];
  pushPhone(M, 'Marisol Vega', m.brief, 8);
  M.offered = true;
  return m;
}
export function beginMission(M, rng, world) {
  const def = MISSIONS[M.idx % MISSIONS.length];
  M.active = { def, id: def.id };
  M.stage = 0; M.cpIdx = 0; M.chaos = 0;
  if (def.id === 'race') {
    M.t = 75; M.checkpoints = [];
    let x = MARKER.x, y = MARKER.y;
    for (let i = 0; i < 6; i++) {
      x = Math.max(120, Math.min(world.w - 120, x + rng.range(-800, 800)));
      y = Math.max(120, Math.min(world.h - 120, y + rng.range(-600, 600)));
      M.checkpoints.push({ x, y });
    }
    M.target = M.checkpoints[0];
  } else if (def.id === 'delivery') {
    M.t = 110;
    M.target = { x: world.w - 260, y: 300, kind: 'pickup' };
  } else {
    M.t = 70; M.target = null;
  }
  return M.active;
}
export function missionObjective(M, player) {
  if (!M.active) return null;
  const a = M.active;
  if (a.id === 'race') return { text: `Bay Run — checkpoint ${M.cpIdx + 1}/6`, target: M.target, dist: M.target ? Math.round(Math.hypot(player.x - M.target.x, player.y - M.target.y)) : 0, time: M.t };
  if (a.id === 'delivery') return { text: M.stage === 0 ? 'Pick up the package' : 'Deliver the package — heat +1 while carrying', target: M.target, dist: M.target ? Math.round(Math.hypot(player.x - M.target.x, player.y - M.target.y)) : 0, time: M.t };
  return { text: `Rampage — chaos ${Math.floor(M.chaos)}/600`, target: null, dist: 0, time: M.t };
}
// Returns 'done' | 'fail' | null. ctx: {playerPos, world, onPay}
export function updateMission(M, dt, pos, world) {
  for (let i = M.phone.length - 1; i >= 0; i--) { M.phone[i].t -= dt; if (M.phone[i].t <= 0) M.phone.splice(i, 1); }
  if (!M.active) return null;
  M.t -= dt;
  if (M.t <= 0) { failMission(M); return 'fail'; }
  const a = M.active;
  if (a.id === 'race' && M.target && Math.hypot(pos.x - M.target.x, pos.y - M.target.y) < 55) {
    sfx('cash'); M.cpIdx++; M.t += 9;
    if (M.cpIdx >= M.checkpoints.length) return completeMission(M);
    M.target = M.checkpoints[M.cpIdx];
  }
  if (a.id === 'delivery' && M.target && Math.hypot(pos.x - M.target.x, pos.y - M.target.y) < 48) {
    if (M.stage === 0) { M.stage = 1; M.target = { x: 260, y: world.h - 300, kind: 'dropoff' }; sfx('cash'); pushPhone(M, 'Marisol Vega', 'Got it. Now the drop — southwest warehouse. Cops will smell it.', 5); return 'pickup'; }
    return completeMission(M);
  }
  if (a.id === 'rampage' && M.chaos >= 600) return completeMission(M);
  return null;
}
function completeMission(M) {
  const def = M.active.def;
  pushPhone(M, 'Marisol Vega', `Clean work. $${def.pay} wired. Respect earned — Coral Marina remembers.`, 7);
  sfx('sting');
  M.done++; M.idx++; M.active = null; M.offered = false;
  return 'done';
}
function failMission(M) {
  pushPhone(M, 'Marisol Vega', 'Clock beat you. Come back to the marker when you\'re ready to try again.', 6);
  M.active = null; M.offered = false;
}
export function addChaos(M, pts) { if (M.active && M.active.id === 'rampage') M.chaos += pts; }
export function drawMarker(ctx, t) {
  const bob = Math.sin(t * 3) * 5;
  ctx.save(); ctx.translate(MARKER.x, MARKER.y + bob);
  ctx.fillStyle = 'rgba(255,190,40,.25)'; ctx.beginPath(); ctx.arc(0, -bob, 30, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', 0, 1);
  ctx.restore();
}
export function drawMissionTarget(ctx, target, t, carrying) {
  if (!target) return;
  const pulse = 16 + Math.sin(t * 5) * 4;
  ctx.strokeStyle = target.kind === 'dropoff' || carrying ? '#2eff8a' : '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, 7); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath(); ctx.moveTo(target.x, target.y - pulse - 16); ctx.lineTo(target.x - 7, target.y - pulse - 28); ctx.lineTo(target.x + 7, target.y - pulse - 28); ctx.fill();
}
