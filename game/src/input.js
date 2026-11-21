// Keyboard + mouse input. Keys are tracked by code; `pressed` holds the
// edge-triggered codes consumed once per frame by the world update.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    attach() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        if (!e.repeat) input.pressed.add(e.code);
        input.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => input.keys.delete(e.code));
      window.addEventListener('blur', () => input.keys.clear());
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
    },
    down(code) {
      return input.keys.has(code);
    },
    wasPressed(code) {
      return input.pressed.has(code);
    },
    endFrame() {
      input.pressed.clear();
      input.mouse.clicked = false;
    },
  };
  return input;
}
