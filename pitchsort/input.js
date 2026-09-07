// input.js — Gamepad polling, Xbox standard mapping. Emits edge events.
// callbacks: onButton(name) on press edges; poll holds for A/LT/RT via isHeld.
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class Pad {
  constructor(onButton) {
    this.onButton = onButton;
    this.prev = new Set();
    addEventListener('gamepadconnected', (e) => { this.idx = e.gamepad.index; });
  }
  poll() {
    if (this.idx === undefined) return;
    const gp = navigator.getGamepads()[this.idx];
    if (!gp) return;
    const now = new Set();
    for (const [name, i] of Object.entries(BTN)) if (gp.buttons[i]?.pressed) now.add(name);
    for (const name of now) if (!this.prev.has(name)) this.onButton(name);
    this.prev = now;
  }
  held(name) { return this.prev.has(name); }
}
