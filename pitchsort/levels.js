// levels.js — 20 curated levels: consonant, related-key chord pairs (maj/min/sus/
// add9/6/maj7/m7 — no dim/aug). Ramp: 1 note -> dyads -> triads -> 4-note chords,
// while the register gap between L and R slowly shrinks (ear-only discrimination).
const Q = {
  one: [0], two: [0, 7], maj: [0, 4, 7], min: [0, 3, 7], sus2: [0, 2, 7],
  sus4: [0, 5, 7], 6: [0, 4, 7, 9], add9: [0, 4, 7, 14], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
};
const ch = (root, q) => Q[q].map((i) => root + i);

// tutorial = which input to highlight (pulsing chip), not text
const HINT = { GRAB: 'grab', TRIGGERS: 'triggers', AUDITION: 'play' };

// [level, rootL, qL, rootR, qR, tutorial-highlight?]
const FIRST20 = [
  [1, 50, 'one', 74, 'one', HINT.GRAB],
  [2, 48, 'one', 72, 'one', HINT.TRIGGERS],
  [3, 50, 'two', 74, 'two', HINT.AUDITION],
  [4, 48, 'maj', 67, 'sus2'],
  [5, 45, 'min', 69, 'maj'],
  [6, 41, 'maj', 65, 'min'],
  [7, 43, 'sus4', 67, 'min'],
  [8, 48, 'maj7', 72, 'maj'],
  [9, 45, 'm7', 67, '6'],
  [10, 50, 'add9', 71, 'sus2'],
  [11, 43, 'maj7', 62, 'm7'],
  [12, 48, '6', 64, 'min'],
  [13, 41, 'min', 60, 'maj7'],
  [14, 45, 'sus2', 64, 'add9'],
  [15, 38, 'maj7', 59, 'm7'],
  [16, 50, 'm7', 71, 'maj'],
  [17, 46, 'add9', 64, 'maj7'],
  [18, 43, 'sus4', 62, 'maj'],
  [19, 48, 'm7', 64, '6'],
  [20, 41, 'maj7', 57, 'm7'], // gap now 16 semitones — register no longer gives it away
];

// generated ladder past 20: >=16 semitone root separation, quality flip per level,
// size creeps 4 -> 5
export function makeLevel(n) {
  const row = FIRST20.find(([l]) => l === n);
  if (row) {
    const [, rL, qL, rR, qR, hint] = row;
    return { targetL: ch(rL, qL), targetR: ch(rR, qR), hint };
  }
  const size = Math.min(4 + Math.floor((n - 21) / 3), 5);
  const rootL = 38 + ((n * 5) % 8);
  const rootR = rootL + 16 + ((n * 3) % 6);
  const qA = n % 2 ? 'maj7' : 'm7', qB = n % 2 ? 'm7' : 'maj7';
  return { targetL: ch(rootL, qA).slice(0, size), targetR: ch(rootR, qB).slice(0, size) };
}

export const deal = ({ targetL, targetR, hint }) => ({ targetL, targetR, hint, center: shuffle([...targetL, ...targetR]) });

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
