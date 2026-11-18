// missions.js — three jobs for fixer Marisol Vega, plus her phone thread.
// 0 Bay Run: checkpoint race against the clock. 1 Special Delivery:
// carry the package across town without wrecking the car. 2 Rampage:
// score points before the timer ends. Each pays cash on completion.
import { pushMessage } from './player.js';
import { addHeat } from './police.js';

export const MISSION_DEFS = [
  {
    id: 0, name: 'Bay Run', pay: 400,
    brief: 'Race the checkpoints along the bay. Beat the clock, keep the paint on.',
    time: 75,
  },
  {
    id: 1, name: 'Special Delivery', pay: 550,
    brief: 'A package for the docks. Get it there in one piece — the car, and you.',
    time: 90,
  },
  {
    id: 2, name: 'Rampage', pay: 700,
    brief: 'The Marinas want a message sent. Score 500 points before the timer ends.',
    time: 60,
  },
];

export function createMissionState() {
  return {
    active: false, id: -1, stage: 0,
    checkpoints: [], timer: 0, score: 0, target: 0,
    done: [], failed: false,
  };
}

function checkpointRing(G, rng, nearPlayer) {
  // Pick checkpoint spots on roads, spread across the city.
  const spots = [];
  for (let i = 0; i < 4; i++) {
    const rx = G.city.roadsV[(i * 2 + 1) % G.city.roadsV.length];
    const ry = G.city.roadsH[(i * 3 + 2) % G.city.roadsH.length];
    spots.push({ x: rx, y: ry, r: 46, hit: false });
  }
  return spots;
}

export function startMission(G, id) {
  const def = MISSION_DEFS[id];
  if (!def || G.mission.active) return false;
  G.mission.active = true;
  G.mission.id = id;
  G.mission.stage = 0;
  G.mission.timer = def.time;
  G.mission.score = 0;
  G.mission.target = id === 2 ? 500 : 0;
  G.mission.failed = false;
  if (id === 0) {
    G.mission.checkpoints = checkpointRing(G, G.rng, true);
    pushMessage(G, 'Marisol', 'Bay Run: hit all four rings before the clock dies. Go.');
  } else if (id === 1) {
    G.mission.checkpoints = [{ x: 300, y: 1600, r: 60, hit: false }];
    pushMessage(G, 'Marisol', 'Package is in your pocket. Docks, west end. Do not scratch it.');
  } else {
    G.mission.checkpoints = [];
    pushMessage(G, 'Marisol', 'Rampage: 500 points, one minute. Make it loud.');
  }
  G.audio.phone();
  return true;
}

function completeMission(G, reason) {
  const def = MISSION_DEFS[G.mission.id];
  const p = G.player;
  p.money += def.pay;
  p.score += def.pay;
  G.mission.done.push(G.mission.id);
  pushMessage(G, 'Marisol', `${def.name} done. $${def.pay} is yours. ${reason || ''}`);
  G.audio.cash();
  G.mission.active = false;
  G.mission.id = -1;
  G.mission.checkpoints = [];
}

function failMission(G, reason) {
  pushMessage(G, 'Marisol', `Job blown. ${reason}`);
  G.mission.active = false;
  G.mission.id = -1;
  G.mission.checkpoints = [];
  G.mission.failed = true;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m.active) return;
  m.timer -= dt;
  if (m.timer <= 0) {
    if (m.id === 2 && m.score >= m.target) completeMission(G, 'Rampage complete.');
    else failMission(G, 'Out of time.');
    return;
  }
  const p = G.player;
  if (m.id === 0) {
    const cp = m.checkpoints[m.stage];
    if (cp && Math.hypot(p.x - cp.x, p.y - cp.y) < cp.r) {
      cp.hit = true;
      m.stage++;
      m.timer += 12;
      G.audio.cash();
      pushMessage(G, 'Marisol', `Checkpoint ${m.stage} of ${m.checkpoints.length}. +12s.`);
      if (m.stage >= m.checkpoints.length) completeMission(G, 'Clean run.');
    }
  } else if (m.id === 1) {
    const cp = m.checkpoints[0];
    if (cp && Math.hypot(p.x - cp.x, p.y - cp.y) < cp.r) {
      if (!p.onFoot && p.car && p.car.hp > 40) {
        completeMission(G, 'Package intact.');
      } else if (p.onFoot) {
        pushMessage(G, 'Marisol', 'Bring the car, not your feet. The package rides in the trunk.');
        cp.hit = false;
      } else {
        failMission(G, 'The car was too banged up. They noticed.');
      }
    }
    if (!p.onFoot && p.car && p.car.hp <= 25) {
      failMission(G, 'The car is falling apart. Job is off.');
    }
  } else if (m.id === 2) {
    if (m.score >= m.target) {
      completeMission(G, 'The Marinas heard you.');
    }
  }
}

export function nextMissionId(G) {
  for (let i = 0; i < MISSION_DEFS.length; i++) {
    if (!G.mission.done.includes(i)) return i;
  }
  return 0;
}

// Marisol's opening thread, sent when a new game starts.
export function openingMessages(G) {
  pushMessage(G, 'Marisol', 'You are new in Coral Marina. I am Marisol Vega. I find work for people who can drive.');
  pushMessage(G, 'Marisol', 'Walk to the pink M on your map, or press 1, 2, 3 to take a job. First one pays $400.');
  pushMessage(G, 'System', 'WASD move, mouse aim, click to shoot, E to steal a car, Shift to sprint, P pause.');
}

export function drawMissionMarkers(ctx, G) {
  const m = G.mission;
  if (!m.active) return;
  for (let i = 0; i < m.checkpoints.length; i++) {
    const cp = m.checkpoints[i];
    if (cp.hit) continue;
    const isNext = m.id !== 0 || i === m.stage;
    const pulse = 40 + Math.sin(G.time * 5) * 8;
    ctx.strokeStyle = isNext ? '#ffd94a' : 'rgba(255,217,74,0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,74,0.12)';
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    if (isNext) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.id === 1 ? 'DELIVER' : `CHECKPOINT ${i + 1}`, cp.x, cp.y - pulse - 8);
    }
  }
  // Direction arrow at screen edge toward the next checkpoint.
  const target = m.id === 0 ? m.checkpoints[m.stage] : m.checkpoints[0];
  if (target) {
    const p = G.player;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d > 500) {
      const ang = Math.atan2(target.y - p.y, target.x - p.x);
      const ax = p.x + Math.cos(ang) * 120;
      const ay = p.y + Math.sin(ang) * 120;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
