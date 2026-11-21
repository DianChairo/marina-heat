// The player on foot: WASD movement, running, entering and leaving cars,
// and the aim direction from the mouse.
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, clamp } from './config.js';
import { isBlocked } from './city.js';
import { nearestCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null,
    health: 100, money: 250, wanted: 0,
    run: false,
  };
}

export function updatePlayer(world, dt) {
  const p = world.player;
  const input = world.input;
  if (!p.onFoot) return;
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
  let mx = 0;
  let my = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    if (!isBlocked(world.city, nx, p.y, 12)) p.x = nx;
    if (!isBlocked(world.city, p.x, ny, 12)) p.y = ny;
    p.speed = speed;
    p.angle = Math.atan2(my, mx);
  } else {
    p.speed = 0;
  }
  // Aim follows the mouse.
  const cam = world.camera;
  const wx = cam.x + input.mouse.x - world.view.w / 2;
  const wy = cam.y + input.mouse.y - world.view.h / 2;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  // Enter / leave a car with E.
  if (input.wasPressed('KeyE')) {
    const car = nearestCar(world, p.x, p.y, 70);
    if (car && !car.driver) {
      p.car = car;
      car.driver = p;
      p.onFoot = false;
    }
  }
}

export function exitCar(world) {
  const p = world.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = null;
  p.car = null;
  p.onFoot = true;
  const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  const sy = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  if (!isBlocked(world.city, sx, sy, 12)) {
    p.x = sx;
    p.y = sy;
  } else {
    p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
  }
  car.speed = 0;
}
