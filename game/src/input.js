// Keyboard + mouse state. Keys tracked by code; mouse in screen space.
export const keys = {};
export const mouse = { x: 0, y: 0, down: false, clicked: false };
const pressed = {};
export function justPressed(code) { return !!pressed[code]; }
export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
export function endFrameInput() { for (const k in pressed) delete pressed[k]; mouse.clicked = false; }
