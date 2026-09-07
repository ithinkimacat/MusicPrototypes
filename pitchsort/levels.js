// levels.js — guided progression. Early levels hand-authored to teach controls; then generated chords.
// Level = { targetL, targetR } — center starts as both chords shuffled (fewer notes early = shorter sort).
const ROOT = 50; // D3

const T = (root, ...intervals) => intervals.map((i) => root + i);

// tutorial sequence: single note → split pair → dyads → triads → 7ths → extensions
const TUTORIAL = [
  { targetL: T(ROOT, 0),        targetR: T(ROOT + 12, 0) },           // 1 note each
  { targetL: T(ROOT, 0),        targetR: T(ROOT + 12, 0, 7) },
  { targetL: T(ROOT, 0, 7),     targetR: T(ROOT + 12, 0, 4) },
  { targetL: T(ROOT, 0, 4, 7),  targetR: T(ROOT + 12, 0, 3, 7) },     // major vs minor triad
  { targetL: T(ROOT, 0, 3, 7),  targetR: T(ROOT + 12, 0, 4, 7) },     // swapped qualities
  { targetL: T(ROOT, 0, 4, 7),  targetR: T(ROOT + 14, 0, 3, 10) },    // minor-root R chord
];

// generated ladder after tutorial: quality index grows with level
const QUALITIES = [[0, 4, 7], [0, 3, 7], [0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 14], [0, 4, 7, 10, 14]];

export function makeLevel(n) {
  if (n <= TUTORIAL.length) return { ...TUTORIAL[n - 1] };
  const qi = Math.min(n - TUTORIAL.length - 1, QUALITIES.length - 1);
  const q = QUALITIES[qi];
  const q2 = QUALITIES[Math.min(qi + 1, QUALITIES.length - 1)];
  const rightRoot = ROOT + 12 + (n % 3) * 2; // separate octave so chords don't overlap
  return { targetL: q.map((i) => ROOT + i), targetR: q2.map((i) => rightRoot + i) };
}

export const deal = ({ targetL, targetR }) => ({ targetL, targetR, center: shuffle([...targetL, ...targetR]) });

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
