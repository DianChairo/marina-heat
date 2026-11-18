// missions.js — Marisol Vega's work board. Walk (or drive) to the glowing M marker
// and press E to take the next job. Three jobs string the story together:
// Bay Run (checkpoint race), Special Delivery (hot package), Rampage (chaos quota).
import { dist } from './rng.js';

export const MARKER = { x: 716, y: 748 };
const ORDER = ['bayrun', 'delivery', 'rampage'];
const DEFS = {
  bayrun: {
    name: 'Bay Run', pay: 400, respect: 10,
    brief: 'Bay Run: hit every checkpoint before the clock dies. Clean lines, no heroics. — M',
    done: 'Smooth. The marina crew noticed that driving. — M',
  },
  delivery: {
    name: 'Special Delivery', pay: 550, respect: 14,
    brief: 'Special Delivery: pick up the package at Pier West and drop it at the beach club. It is hot — expect company. — M',
    done: 'Package delivered, no questions asked. You are earning a reputation. — M',
  },
  rampage: {
    name: 'Rampage', pay: 650, respect: 18,
    brief: 'Rampage: a rival crew needs a message. Cause 600 chaos — wrecks, near misses, mayhem — before time runs out. — M',
    done: 'Message received, loud and clear. Coral Marina is ours. — M',
  },
};
const CHECKPOINTS = [
  { x: 1008, y: 368 }, { x: 1648, y: 688 }, { x: 1968, y: 1328 },
  { x: 1008, y: 1648 }, { x: 368, y: 1008 },
];
const PICKUP = { x: 368, y: 1328 };
const DROPOFF = { x: 1968, y: 368 };

export function makeMissionState() {
  return { active: null, phase: '', timer: 0, idx: 0, chaosStart: 0, carrying: false, nextIdx: 0, target: null, label: '' };
}

export function startMission(G) {
  const kind = ORDER[G.mission.nextIdx % ORDER.length];
  const m = G.mission, def = DEFS[kind];
  m.active = kind; m.carrying = false;
  if (kind === 'bayrun') { m.phase = 'race'; m.idx = 0; m.timer = 80; m.target = CHECKPOINTS[0]; m.label = 'Checkpoint 1/5'; }
  if (kind === 'delivery') { m.phase = 'pickup'; m.timer = 120; m.target = PICKUP; m.label = 'Pick up the package'; }
  if (kind === 'rampage') { m.phase = 'chaos'; m.timer = 80; m.chaosStart = G.chaosRun; m.target = null; m.label = 'Cause 600 chaos'; }
  G.showPhone(def.brief, 7);
  G.audio.sting(true);
}

function completeMission(G) {
  const m = G.mission, def = DEFS[m.active];
  G.save.cash += def.pay; G.save.respect += def.respect; G.save.missionsDone++;
  G.persist();
  G.showPhone(def.done + ` (+$${def.pay})`, 6);
  G.audio.cash(); G.audio.sting(true);
  G.spawnPopup(G.player.x, G.player.y - 26, `+$${def.pay}`, '#7CFC98');
  m.active = null; m.target = null; m.carrying = false; m.nextIdx++;
  G.wanted.heat = Math.max(0, G.wanted.heat - 20);
}
function failMission(G, why) {
  G.showPhone(`${why} The job is off. Come back to the M when you are ready. — M`, 6);
  G.audio.sting(false);
  G.mission.active = null; G.mission.target = null; G.mission.carrying = false;
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m.active) return;
  m.timer -= dt;
  if (m.timer <= 0) { failMission(G, 'Out of time.'); return; }
  const P = G.player, pos = P.inCar || P;
  if (m.active === 'bayrun') {
    if (dist(pos.x, pos.y, m.target.x, m.target.y) < 62) {
      G.audio.cash(); G.addChaos(10, 'checkpoint');
      m.idx++;
      if (m.idx >= CHECKPOINTS.length) { completeMission(G); return; }
      m.timer += 9; m.target = CHECKPOINTS[m.idx]; m.label = `Checkpoint ${m.idx + 1}/5`;
    }
  } else if (m.active === 'delivery') {
    if (m.phase === 'pickup' && dist(pos.x, pos.y, PICKUP.x, PICKUP.y) < 56) {
      m.phase = 'dropoff'; m.carrying = true; m.target = DROPOFF; m.label = 'Deliver to the beach club';
      G.showPhone('Package on board. Every cop in the marina just got your description. Move. — M', 5);
      G.reportCrime(45, P.x, P.y);
    } else if (m.phase === 'dropoff' && dist(pos.x, pos.y, DROPOFF.x, DROPOFF.y) < 62) {
      completeMission(G); return;
    }
  } else if (m.active === 'rampage') {
    const got = G.chaosRun - m.chaosStart;
    m.label = `Cause 600 chaos — ${Math.min(600, got | 0)}/600`;
    if (got >= 600) { completeMission(G); return; }
  }
}

export function missionObjective(G) {
  const m = G.mission;
  if (!m.active) return G.nearMarker ? 'Press E — Marisol has work for you' : '';
  const t = Math.max(0, m.timer);
  const mm = (t / 60) | 0, ss = (t % 60) | 0;
  const time = `${mm}:${ss.toString().padStart(2, '0')}`;
  let d = '';
  if (m.target) d = ` · ${Math.round(dist((G.player.inCar || G.player).x, (G.player.inCar || G.player).y, m.target.x, m.target.y))}m`;
  return `${DEFS[m.active].name}: ${m.label}${d} · ${time}`;
}

export function drawMissionWorld(ctx, G, t) {
  const m = G.mission;
  const pulse = 1 + Math.sin(t * 4) * 0.12;
  // The M board marker (always standing when no job is active).
  if (!m.active) {
    ctx.save(); ctx.translate(MARKER.x, MARKER.y);
    ctx.fillStyle = 'rgba(255,64,129,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff4081'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('M', 0, 1);
    ctx.restore();
  }
  // Active target beacon: a column of light you can see across the map.
  if (m.target) {
    const { x, y } = m.target;
    const g = ctx.createLinearGradient(x, y - 190, x, y);
    g.addColorStop(0, 'rgba(255,215,64,0)'); g.addColorStop(1, 'rgba(255,215,64,0.5)');
    ctx.fillStyle = g; ctx.fillRect(x - 9, y - 190, 18, 190);
    ctx.fillStyle = 'rgba(255,215,64,0.3)';
    ctx.beginPath(); ctx.arc(x, y, 34 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd740'; ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3800'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.active === 'delivery' && m.phase === 'pickup' ? '▣' : '◎', x, y + 1);
  }
}
