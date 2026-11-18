// input.js — keyboard + mouse state for the game canvas.
// Tracks held keys, the mouse position in world space (via camera) and
// edge-triggered presses (E to steal a car, R to restart, M to mute).
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    wheel: 0,
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

export function isDown(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

export function wasPressed(input, ...codes) {
  return codes.some((c) => input.pressed.has(c));
}

// Clear edge-triggered state at the end of each frame.
export function endFrame(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
  input.wheel = 0;
}

// Movement vector from WASD / arrows, normalised.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (isDown(input, 'KeyA', 'ArrowLeft')) x -= 1;
  if (isDown(input, 'KeyD', 'ArrowRight')) x += 1;
  if (isDown(input, 'KeyW', 'ArrowUp')) y -= 1;
  if (isDown(input, 'KeyS', 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.hypot(x, y);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
