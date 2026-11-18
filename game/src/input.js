// input.js — keyboard + mouse state. main.js polls this; nothing else touches the DOM events.
export const keys = new Set();
export const pressed = new Set(); // keys that went down this frame (consumed by main loop end)
export const mouse = { x: 0, y: 0, down: false, clicked: false };
let attached = false;
export function attachInput(canvas) {
  if (attached) return; attached = true;
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
export const down = (...ks) => ks.some((k) => keys.has(k));
export function wasPressed(...ks) { return ks.some((k) => pressed.has(k)); }
export function endFrame() { pressed.clear(); mouse.clicked = false; }
