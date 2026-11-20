// input.js — keyboard + mouse state. The rest of the game reads this
// object; nothing else touches DOM events.

export const input = {
  keys: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  pressed: new Set(), // keys that went down this frame (edge-triggered)
};

let attached = false;

export function attachInput(canvas) {
  if (attached) return;
  attached = true;

  window.addEventListener('keydown', (e) => {
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    input.mouseX = (e.clientX - rect.left) * sx;
    input.mouseY = (e.clientY - rect.top) * sy;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function down(code) {
  return input.keys.has(code);
}

export function justPressed(code) {
  return input.pressed.has(code);
}

export function endFrame() {
  input.pressed.clear();
}

// Movement vector from WASD / arrows, normalised.
export function moveVector() {
  let x = 0;
  let y = 0;
  if (down('KeyA') || down('ArrowLeft')) x -= 1;
  if (down('KeyD') || down('ArrowRight')) x += 1;
  if (down('KeyW') || down('ArrowUp')) y -= 1;
  if (down('KeyS') || down('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
