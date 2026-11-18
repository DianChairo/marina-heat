// input.js — keyboard + mouse state, edge-triggered presses.
export function createInput(canvas) {
  const keys = {}, pressed = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; });
  addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return {
    keys, mouse,
    down: (c) => !!keys[c],
    hit: (c) => !!pressed[c],
    moveX() { return (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0); },
    moveY() { return (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0); },
    endFrame() { for (const k in pressed) pressed[k] = false; mouse.clicked = false; },
  };
}
