// Marina Heat — bootstrap and game loop. The module exports `world` so the
// make.fun smoke test can probe the live state; ?shot=<scene>&seed=7 runs a
// deterministic screenshot scene instead of the interactive loop.
import { createWorld, stepWorld } from './world.js';
import { createInput } from './input.js';
import { renderWorld } from './render.js';
import { renderHud } from './hud.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 7;
const shot = params.get('shot');

export const world = createWorld(seed);
world.input = createInput(canvas);
world.input.attach();
world.ctx = ctx;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  world.view.w = w;
  world.view.h = h;
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepWorld(world, dt);
  renderWorld(world);
  renderHud(world);
  world.input.endFrame();
  requestAnimationFrame(frame);
}

if (shot) {
  // Deterministic scene: stage, settle, render, then signal readiness.
  resize();
  setupShot(world, shot);
  renderWorld(world);
  renderHud(world);
  requestAnimationFrame(() => {
    renderWorld(world);
    renderHud(world);
    window.__shotReady = true;
  });
} else {
  requestAnimationFrame(frame);
}
