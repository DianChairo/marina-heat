// missions.js — three jobs for fixer Marisol Vega, plus her phone thread.
// 1 Bay Run: checkpoint race against the clock. 2 Special Delivery: pick
// up the package, drop it off, no cops is a bonus. 3 Rampage: cause chaos
// for points before the timer ends. Completing one pays out and unlocks
// the next; all three pay a $500 completion bonus on top.
import { randomRoadPoint, WORLD } from './city.js';

export const MISSION_DEFS = [
  {
    id: 0, name: 'Bay Run', reward: 500, time: 90,
    brief: 'Marisol: "Four checkpoints, bay to marina. Beat the clock, no questions."',
    intro: 'Bay Run — hit all 4 checkpoints before the timer runs out.',
  },
  {
    id: 1, name: 'Special Delivery', reward: 800, time: 120,
    brief: 'Marisol: "Pick up the package at the pier. Deliver it uptown. Keep it quiet."',
    intro: 'Special Delivery — grab the package, then reach the drop-off.',
  },
  {
    id: 2, name: 'Rampage', reward: 1000, time: 60,
    brief: 'Marisol: "The Vipers crossed me. Make a mess downtown. Score 300 to get paid."',
    intro: 'Rampage — cause chaos, score 300 before the timer ends.',
  },
];

export function startMission(G, id) {
  const def = MISSION_DEFS[id];
  const m = { id, def, t: def.time, stage: 0, score0: G.score, done: false, failed: false, target: null, target2: null };
  if (id === 0) {
    m.targets = [];
    for (let i = 0; i < 4; i++) {
      const p = randomRoadPoint(G.city, G.rng);
      m.targets.push({ x: p.x, y: p.y, hit: false });
    }
    m.target = m.targets[0];
  } else if (id === 1) {
    m.target = { x: 420, y: WORLD - 380 }; // the pier pickup
    m.target2 = { x: 320 + 7 * 320, y: 320 + 1 * 320 }; // uptown drop-off
  }
  G.mission = m;
  G.messages.push({ from: 'Marisol Vega', text: def.brief, t: 7 });
  G.audio.phone();
  return m;
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m || m.done || m.failed) return;
  m.t -= dt;
  if (m.t <= 0) {
    m.t = 0;
    m.failed = true;
    G.messages.push({ from: 'Marisol Vega', text: '"Too slow. The job is dead."', t: 6 });
    G.mission = null;
    return;
  }
  const p = G.player;
  if (m.id === 0) {
    const cur = m.targets.find((t) => !t.hit);
    if (!cur) { completeMission(G, m); return; }
    m.target = cur;
    if (Math.hypot(p.x - cur.x, p.y - cur.y) < 60) {
      cur.hit = true;
      G.score += 50;
      G.audio.pickup();
      G.messages.push({ from: 'Marisol Vega', text: `"Checkpoint ${m.targets.filter((t) => t.hit).length}/4. Keep moving."`, t: 4 });
    }
  } else if (m.id === 1) {
    if (m.stage === 0) {
      if (Math.hypot(p.x - m.target.x, p.y - m.target.y) < 60) {
        m.stage = 1;
        G.audio.pickup();
        G.messages.push({ from: 'Marisol Vega', text: '"Package secured. Now uptown — and don\'t get spotted."', t: 5 });
      }
    } else if (Math.hypot(p.x - m.target2.x, p.y - m.target2.y) < 60) {
      completeMission(G, m);
    }
  } else if (m.id === 2) {
    if (G.score - m.score0 >= 300) completeMission(G, m);
  }
}

function completeMission(G, m) {
  m.done = true;
  const bonus = G.missionsDone.length === 2 ? 500 : 0; // all-three bonus
  const pay = m.def.reward + bonus;
  G.player.money += pay;
  G.score += m.def.reward;
  if (!G.missionsDone.includes(m.id)) G.missionsDone.push(m.id);
  G.messages.push({ from: 'Marisol Vega', text: `"${m.def.name} done. $${pay} is yours."`, t: 6 });
  G.audio.pickup();
  G.mission = null;
}

export function drawMissionMarkers(ctx, G) {
  const m = G.mission;
  if (!m) return;
  const marks = [];
  if (m.id === 0 && m.target) marks.push({ x: m.target.x, y: m.target.y, color: '#f59e0b', label: 'CHECKPOINT' });
  if (m.id === 1) {
    if (m.stage === 0) marks.push({ x: m.target.x, y: m.target.y, color: '#22c55e', label: 'PICKUP' });
    else marks.push({ x: m.target2.x, y: m.target2.y, color: '#22c55e', label: 'DROP-OFF' });
  }
  for (const mk of marks) {
    const pulse = 1 + Math.sin(G.time * 5) * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = mk.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = mk.color;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(mk.label, mk.x, mk.y - 44);
    ctx.restore();
  }
  if (m.id === 0) {
    for (const t of m.targets) {
      if (t.hit) continue;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(t.x, t.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}
