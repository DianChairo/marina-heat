// input.js — keyboard + mouse state for Marina Heat.
// WASD/arrows move, Shift sprints, E steals a car, Space brakes,
// mouse aims, click fires, P/Esc pauses, M mutes, R restarts a mission.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = new Set(); // edge-triggered keys, consumed each frame

  const onKeyDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) pressed.add(e.key.toLowerCase());
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e) => keys.delete(e.key.toLowerCase());
  const onMouseMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  const onMouseDown = (e) => { onMouseMove(e); mouse.down = true; mouse.clicked = true; };
  const onMouseUp = () => { mouse.down = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys, mouse, pressed,
    down(...names) { return names.some((n) => keys.has(n)); },
    wasPressed(...names) { return names.some((n) => pressed.has(n)); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
