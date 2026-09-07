// input.js — Gamepad polling, Xbox standard mapping. Emits edge events.
// callbacks: onButton(name) on press edges; poll holds for A/LT/RT via isHeld.
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

// button names per controller family (standard mapping indices are shared;
// only labels differ — Nintendo letters rotate vs Xbox)
const FAMILIES = {
  xbox: { match: /xbox|xinput|360|45e/i, names: { bottom: 'A', right: 'B', left: 'X', top: 'Y', lt: 'LT', rt: 'RT', start: 'Menu' } },
  ps: { match: /dualsense|dualshock|054c|wireless controller/i, names: { bottom: '✕ Cross', right: '◯ Circle', left: '☐ Square', top: '△ Triangle', lt: 'L2', rt: 'R2', start: 'Options' } },
  nintendo: { match: /pro controller|joy-?con|057e|switch/i, names: { bottom: 'B', right: 'A', left: 'Y', top: 'X', lt: 'ZL', rt: 'ZR', start: '+' } },
};
export function detectFamily(id = '') {
  for (const [k, f] of Object.entries(FAMILIES)) if (f.match.test(id)) return { family: k, names: f.names };
  return { family: 'other', names: FAMILIES.xbox.names }; // default labels = Xbox
}

export class Pad {
  constructor(onButton) {
    this.onButton = onButton;
    this.prev = new Set();
    addEventListener('gamepadconnected', (e) => {
      this.idx = e.gamepad.index;
      this.info = { ...detectFamily(e.gamepad.id), id: e.gamepad.id };
    });
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
