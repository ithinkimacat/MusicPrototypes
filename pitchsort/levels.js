// levels.js — guided progression. 10 curated levels with high contrast between
// L and R chords (different registers + qualities) so notes never sound alike.
// After that, a generated ladder keeps the same separation rule.
const T = (root, ...intervals) => intervals.map((i) => root + i);

// contrast rule for Lv1-10: L low (A2–D3 region), R high (>12 semitones above),
// alternating qualities (major vs minor vs add9) so timbres differ per side.
export const TUTORIAL = [
  { targetL: T(50, 0),           targetR: T(74, 0),
    hint: 'Hold grab (bottom button) to pick up a note — move it, release to drop. Left chord sounds LEFT, right chord sounds RIGHT.' },
  { targetL: T(50, 0),           targetR: T(72, 0, 7),
    hint: 'Use LT / RT (triggers) to hear the target chords again.' },
  { targetL: T(48, 0, 7),        targetR: T(74, 0),
    hint: 'X (left face button) plays your Left column. B (right face) plays Right. Y plays Center.' },
  { targetL: T(48, 0, 4, 7),     targetR: T(72, 0, 3, 7) },  // maj triad vs min triad
  { targetL: T(45, 0, 3, 7),     targetR: T(69, 0, 4, 7) },  // swapped qualities, wider gap
  { targetL: T(43, 0, 4, 7),     targetR: T(67, 0, 3, 10) }, // maj vs m7
  { targetL: T(45, 0, 4, 7, 14), targetR: T(70, 0, 3, 7) },  // add9 vs min
  { targetL: T(41, 0, 3, 7, 10), targetR: T(66, 0, 4, 7, 11) }, // m7 vs maj7
  { targetL: T(43, 0, 4, 7, 11), targetR: T(72, 0, 3, 7, 10) },
  { targetL: T(38, 0, 4, 7, 10), targetR: T(64, 0, 3, 7, 14) },
];

// generated ladder: separation guaranteed (R root = L root + 17..25 semitones,
// quality flips per level so the two chords never share a voicing)
const MAJ = [0, 4, 7, 11], MIN = [0, 3, 7, 10];

export function makeLevel(n) {
  if (n <= TUTORIAL.length) return { ...TUTORIAL[n - 1] };
  const size = Math.min(3 + Math.floor((n - 10) / 2), 5);
  const rootL = 38 + ((n * 5) % 8);              // wanders in low register
  const rootR = rootL + 17 + ((n * 3) % 9);      // always 17-25 above
  const qL = n % 2 ? MAJ : MIN, qR = n % 2 ? MIN : MAJ;
  return { targetL: qL.slice(0, size).map((i) => rootL + i), targetR: qR.slice(0, size).map((i) => rootR + i) };
}

export const deal = ({ targetL, targetR, hint }) => ({ targetL, targetR, hint, center: shuffle([...targetL, ...targetR]) });

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
