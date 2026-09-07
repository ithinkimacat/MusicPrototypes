// levels.js — level generation. Chords are stacked thirds from a root. No distractors (prototype).
const ROOT = 50; // D3
// quality = stacked intervals from root (cumulative)
const QUALITIES = [[0, 4, 7], [0, 3, 7], [0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 14], [0, 4, 7, 10, 14]];

export function makeLevel(n) {
  const qi = Math.min(n - 1, QUALITIES.length - 1);
  const q = QUALITIES[qi].slice(0, n <= 3 ? 3 : n <= 6 ? 4 : 5);
  const chord = (root) => q.map((i) => root + i);

  const rightRoot = ROOT + 12 + (n % 3) * 2; // separate octave so chords don't overlap
  const targetL = chord(ROOT);
  const targetR = chord(rightRoot);
  const center = shuffle([...targetL, ...targetR]);
  return { targetL, targetR, center };
}

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
