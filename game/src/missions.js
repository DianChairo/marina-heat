// Missions: a five-job chain across Coral Marina. Each job has a map
// marker and a completion test; finishing one pays out and opens the next.
import { MISSION_REWARDS, dist } from './config.js';
import { raiseWanted } from './police.js';

const JOBS = [
  { name: 'Drive to the Marina', text: 'Get a car and drive down the causeway to the docks.', x: 1600, y: 2760, radius: 90, needCar: true },
  { name: 'Pick up the package', text: 'Walk to the glowing crate on the pier and press E.', x: 1560, y: 2960, radius: 46, needCar: false, interact: true },
  { name: 'Lose the heat', text: 'The cops are on you. Stay out of sight until the stars fade.', x: 1600, y: 2760, radius: 0, needCar: false, survive: 14 },
  { name: 'Deliver to the Docks', text: 'Take the package to the east pier. Drive fast, stay clean.', x: 2080, y: 2960, radius: 70, needCar: true },
  { name: 'Escape the city', text: 'Reach the north gate on Marina Blvd and disappear.', x: 1600, y: 60, radius: 90, needCar: false },
];

export function makeMissions() {
  return { index: 0, done: false, allDone: false, surviveLeft: 0, flash: 0, message: '' };
}

export function currentJob(missions) {
  return JOBS[missions.index] || null;
}

export function updateMissions(world, dt) {
  const m = world.missions;
  const p = world.player;
  if (m.allDone) return;
  const job = currentJob(m);
  if (!job) return;
  m.flash = Math.max(0, m.flash - dt);
  // Job 3 arms the heat the moment it starts.
  if (m.index === 2 && !m.armed) {
    m.armed = true;
    m.surviveLeft = job.survive;
    if (p.wanted < 2) raiseWanted(world, 2);
  }
  if (job.survive) {
    if (p.wanted <= 0) {
      completeJob(world);
    } else {
      m.surviveLeft -= dt;
      if (m.surviveLeft <= 0) {
        // Survived the timer with heat still on: heat cools off.
        p.wanted = 0;
        world.police.length = 0;
        completeJob(world);
      }
    }
    return;
  }
  if (job.interact) {
    if (dist(p.x, p.y, job.x, job.y) < job.radius && world.input.wasPressed('KeyE') && p.onFoot) {
      completeJob(world);
    }
    return;
  }
  if (job.radius > 0 && dist(p.x, p.y, job.x, job.y) < job.radius) {
    if (!job.needCar || !p.onFoot) completeJob(world);
  }
}

function completeJob(world) {
  const m = world.missions;
  const reward = MISSION_REWARDS[m.index] || 500;
  world.player.money += reward;
  m.message = `Job done — +$${reward}`;
  m.flash = 3;
  world.audio.pickup();
  m.index += 1;
  m.armed = false;
  if (m.index >= JOBS.length) {
    m.allDone = true;
    m.message = `All jobs done — $${world.player.money} banked. Free roam!`;
  }
}

export function missionMarker(world) {
  const job = currentJob(world.missions);
  return job || null;
}
