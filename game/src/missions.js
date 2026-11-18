// missions.js — Marisol Vega's job board: Bay Run, Special Delivery, Rampage + story texts.
import { dist, clamp } from './rng.js';
import { addCrime } from './police.js';
export const MARKER = { x: 655, y: 655 }; // downtown corner, block interior edge by the marina offices
const JOBS = [
  {
    id: 'race', name: 'Bay Run', pay: 450, respect: 30,
    brief: 'Bay Run: hit every checkpoint around the bay. Fast wheels help. Clock is ticking!',
    done: 'Clean lines, fast time. The bay crew noticed. Pay sent.',
  },
  {
    id: 'delivery', name: 'Special Delivery', pay: 600, respect: 40,
    brief: 'A package waits by the pier lockers. Grab it, drop it at the marked garage. Carrying it runs hot — expect attention.',
    done: 'Package delivered, no questions asked. You are becoming reliable.',
  },
  {
    id: 'rampage', name: 'Rampage', pay: 550, respect: 45,
    brief: 'A rival crew thinks Marina is theirs. Prove otherwise: cause pure chaos before the timer dies.',
    done: 'Message sent, loud and clear. Coral Marina remembers your name.',
  },
];
export function createMissions() {
  return { idx: 0, active: null, checkpoints: [], cpIdx: 0, timer: 0, scoreNeed: 0, chaos: 0, hasPackage: false, phase: '', target: null, nearMissCd: 0 };
}
export function missionMarker(S) {
  const m = S.missions;
  if (!m.active) return { x: MARKER.x, y: MARKER.y, label: 'M', color: '#ffd23f' };
  if (m.active.id === 'race') { const cp = m.checkpoints[m.cpIdx]; return cp ? { x: cp.x, y: cp.y, label: 'CP', color: '#3ec6d8' } : null; }
  if (m.active.id === 'delivery') return m.hasPackage ? { x: m.target.x, y: m.target.y, label: 'DROP', color: '#7bf1a8' } : { x: m.target.x, y: m.target.y, label: 'PKG', color: '#ffd23f' };
  return null;
}
export function startMission(S) {
  const m = S.missions, job = JOBS[m.idx % JOBS.length];
  m.active = job; m.chaos = 0; m.hasPackage = false; m.cpIdx = 0;
  if (job.id === 'race') {
    m.timer = 95;
    m.checkpoints = [
      { x: 1055, y: 255 }, { x: 2055, y: 655 }, { x: 2455, y: 1455 }, { x: 1655, y: 2055 },
      { x: 655, y: 2455 }, { x: 255, y: 1455 }, { x: 655, y: 655 },
    ];
  } else if (job.id === 'delivery') {
    m.timer = 150; m.target = { x: 255, y: 2655 }; // pier lockers, south-west beach road
  } else {
    m.timer = 80; m.scoreNeed = 600;
  }
  S.phoneMsg('Marisol Vega', job.brief);
  S.audio.sting(true);
  S.objective = job.name + ' — see the marker on your map.';
}
function finish(S, win) {
  const m = S.missions, job = m.active;
  if (win) {
    S.cash += job.pay; S.score += job.respect; S.stats.missionsDone++;
    S.phoneMsg('Marisol Vega', job.done + ` (+$${job.pay})`);
    S.audio.cash(); S.audio.sting(true);
    m.idx++;
    S.objective = 'Head to the M marker for your next job.';
  } else {
    S.phoneMsg('Marisol Vega', 'That fell apart. Shake the heat, come back to the marker, try again.');
    S.audio.sting(false);
    S.objective = 'Mission failed. Return to the M marker.';
  }
  if (m.hasPackage) m.hasPackage = false;
  m.active = null; m.checkpoints = [];
  S.saveBest();
}
export function updateMissions(S, dt) {
  const m = S.missions, p = S.player;
  m.nearMissCd = Math.max(0, m.nearMissCd - dt);
  if (!m.active) {
    if (dist(p.x, p.y, MARKER.x, MARKER.y) < 60) {
      S.objective = 'Press E — take the job: ' + JOBS[m.idx % JOBS.length].name;
      if (S.input.hit('KeyE')) startMission(S);
    } else S.objective = 'Go to the M marker downtown to work for Marisol.';
    return;
  }
  const job = m.active;
  m.timer -= dt;
  if (m.timer <= 0) { finish(S, false); return; }
  if (job.id === 'race') {
    const cp = m.checkpoints[m.cpIdx];
    S.objective = `Bay Run — checkpoint ${m.cpIdx + 1}/${m.checkpoints.length} · ${Math.ceil(m.timer)}s`;
    if (cp && dist(p.x, p.y, cp.x, cp.y) < 78) {
      m.cpIdx++; S.audio.cash(); S.cash += 25;
      for (let i = 0; i < 8; i++) S.parts.push({ x: cp.x, y: cp.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.5, max: 0.5, size: 4, color: '62,198,216', kind: 'spark' });
      if (m.cpIdx >= m.checkpoints.length) finish(S, true);
    }
  } else if (job.id === 'delivery') {
    if (!m.hasPackage) {
      S.objective = `Special Delivery — pick up the package · ${Math.ceil(m.timer)}s`;
      if (dist(p.x, p.y, m.target.x, m.target.y) < 52) {
        m.hasPackage = true; m.target = { x: 2855, y: 455 }; // garage, north-east
        addCrime(S, 34, p.x, p.y); // carrying runs hot: wanted +~1
        S.phoneMsg('Marisol Vega', 'That is the package. North-east garage, and do not stop for anyone.');
        S.audio.cash();
      }
    } else {
      const d = Math.round(dist(p.x, p.y, m.target.x, m.target.y));
      S.objective = `Special Delivery — drop it at the garage · ${d}m · ${Math.ceil(m.timer)}s`;
      if (d < 56) finish(S, true);
    }
  } else {
    S.objective = `Rampage — chaos ${Math.floor(m.chaos)}/${m.scoreNeed} · ${Math.ceil(m.timer)}s`;
    if (m.chaos >= m.scoreNeed) finish(S, true);
  }
}
export function addChaos(S, pts, label) {
  const m = S.missions;
  if (!m.active || m.active.id !== 'rampage') return;
  m.chaos += pts;
  if (label) S.floaters.push({ x: S.player.x, y: S.player.y - 34, text: `+${pts} ${label}`, life: 1.1, color: '#ffd23f' });
}
export function checkNearMiss(S) {
  const m = S.missions, pc = S.player.car;
  if (!pc || m.nearMissCd > 0) return;
  const spd = Math.hypot(pc.vx, pc.vy);
  if (spd < 240) return;
  for (const c of S.cars) {
    if (c === pc) continue;
    const d = dist(pc.x, pc.y, c.x, c.y);
    if (d > 34 && d < 62) { m.nearMissCd = 0.9; addChaos(S, 40, 'NEAR MISS'); S.score += 2; break; }
  }
}
export { JOBS };
