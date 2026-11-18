// input.js — keyboard and mouse state for the game.
// Tracks held keys, one-shot presses (consumed by the game each frame),
// mouse position in canvas coordinates and mouse button state.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      const sx = canvas.width / r.width;
      const sy = canvas.height / r.height;
      this.mouse.x = (e.clientX - r.left) * sx;
      this.mouse.y = (e.clientY - r.top) * sy;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Called at the end of each frame: clears one-shot state.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }
}
