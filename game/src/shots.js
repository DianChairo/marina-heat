// Deterministic screenshot scenes (?shot=cover|drive|chase|mission&seed=7).
// Each scene resets the world, stages the player and traffic, then steps
// the simulation a fixed number of ticks so the frame is stable and real.
import { createWorld, stepWorld } from './world.js';

export function setupShot(world, name) {
  const seed = 7;
  // Preserve the live canvas/input handles: the fresh world carries nulls.
  const keep = { input: world.input, ctx: world.ctx, view: world.view };
  const fresh = createWorld(seed);
  Object.assign(world, fresh, keep);
  world.state = 'playing';
  const p = world.player;
  if (name === 'cover') {
    p.x = 1600;
    p.y = 2620;
    p.angle = Math.PI / 2;
    p.aim = Math.PI / 2;
    world.dayT = 0.47;
    world.camera.x = 1600;
    world.camera.y = 2700;
  } else if (name === 'drive') {
    p.x = 1600;
    p.y = 1200;
    const car = world.cars.find((c) => c.kind === 'parked' && Math.abs(c.x - 1600) < 300) || world.cars[0];
    p.car = car;
    car.driver = p;
    p.onFoot = false;
    car.speed = 300;
    car.angle = Math.PI / 2;
    p.x = car.x;
    p.y = car.y;
    world.camera.x = car.x;
    world.camera.y = car.y;
    world.dayT = 0.1;
  } else if (name === 'chase') {
    p.x = 1600;
    p.y = 1600;
    p.wanted = 3;
    const car = world.cars.find((c) => c.kind === 'parked') || world.cars[0];
    p.car = car;
    car.driver = p;
    p.onFoot = false;
    car.speed = 380;
    car.angle = 0;
    p.x = car.x;
    p.y = car.y;
    world.dayT = 0.3;
    for (let i = 0; i < 30; i++) stepWorld(world, 1 / 60);
    world.camera.x = p.x;
    world.camera.y = p.y;
  } else if (name === 'mission') {
    p.x = 1500;
    p.y = 2900;
    p.angle = Math.PI / 2;
    p.aim = Math.PI / 2;
    world.dayT = 0.2;
    world.camera.x = 1580;
    world.camera.y = 2920;
  }
  // Settle the frame with a few fixed steps (not for chase — already run).
  if (name !== 'chase') {
    for (let i = 0; i < 12; i++) stepWorld(world, 1 / 60);
  }
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  if (name === 'cover') {
    world.camera.y = 2700;
  }
}
