// levels.js — 20 curated levels built from ONE key per level: L and R chords are
// diatonic to the same scale (real chord progressions: I–V, vi–IV, ii–V…), so the
// two harmonies always sound like they belong to a song. Early = major keys,
// later = natural minor. Size ramps 1->2->3->4 notes; register gap ~2 octaves shrinks late.
const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10] };

// diatonic chord: stack thirds from scale degree inside scale
function diatonic(root, scaleName, degree, size) {
  const sc = SCALES[scaleName];
  const out = [];
  for (let k = 0; k < size; k++) {
    const d = degree + k * 2;
    out.push(root + 12 * Math.floor(d / 7) + sc[d % 7]);
  }
  return out;
}

// tutorial = which input to highlight (pulsing chip), not text
// [level, keyRootLow, scale, degL, degR, size, tutorialHighlight?]
const FIRST20 = [
  [1, 48, 'maj', 0, 4, 1, 'grab'],     // C: I – V
  [2, 43, 'maj', 4, 0, 1, 'triggers'], // G: V – I
  [3, 48, 'maj', 0, 4, 2, 'play'],
  [4, 48, 'maj', 5, 1, 3],             // C: vi – ii
  [5, 43, 'maj', 3, 4, 3],             // G: vi – V
  [6, 41, 'maj', 4, 5, 3],             // F: V – vi
  [7, 48, 'maj', 1, 4, 3],             // C: ii – V
  [8, 50, 'maj', 3, 0, 3],             // D: vi – I
  [9, 48, 'maj', 0, 5, 4],             // C: Imaj7 – vim7
  [10, 43, 'maj', 4, 2, 4],            // G: IVmaj7 – iiim7
  [11, 41, 'maj', 5, 3, 4],            // F: vim7 – IVmaj7
  [12, 48, 'maj', 3, 1, 4],            // C: iiim7 – iim7
  [13, 45, 'min', 0, 3, 4],            // Am: i – iv
  [14, 45, 'min', 5, 6, 3],            // Am: III – VII (C, G)
  [15, 40, 'min', 2, 5, 4],            // Em: iv – VII
  [16, 38, 'min', 0, 4, 4],            // Dm: i – v
  [17, 45, 'min', 3, 6, 4],            // Am: iv – VII
  [18, 43, 'maj', 1, 5, 4],            // G: iim7 – vi (jazz feel)
  [19, 41, 'maj', 4, 3, 4],            // F: V7 – vim7
  [20, 46, 'maj', 0, 1, 4],            // Bb: I – ii
];

// generated ladder past 20: random key/scale, degrees >=2 apart, size creeps to 5
export function makeLevel(n) {
  const row = FIRST20.find(([l]) => l === n);
  if (row) {
    const [, keyRoot, scale, degL, degR, size, hint] = row;
    return {
      targetL: diatonic(keyRoot, scale, degL, size),
      targetR: diatonic(keyRoot + 24, scale, degR, size), // R two octaves up; deal() re-mixes
      hint,
    };
  }
  const size = Math.min(4 + Math.floor((n - 21) / 3), 5);
  const scale = n % 3 === 0 ? 'min' : 'maj';
  const rootL = 36 + ((n * 7) % 12);
  const degL = Math.floor(((n * 13) % 5)); // 0-4 keeps 4-note chords in scale
  let degR = Math.floor(((n * 17) % 5));
  if (Math.abs(degR - degL) < 2) degR = (degL + 2) % 5; // distinct regions of the scale
  return { targetL: diatonic(rootL, scale, degL, size), targetR: diatonic(rootL + 22, scale, degR, size) };
}

export const deal = ({ targetL, targetR, hint }) => {
  // disguise any L-low / R-high pattern: random side swap + independent octave shifts
  let [a, b] = Math.random() < 0.5 ? [targetR, targetL] : [targetL, targetR];
  const shifted = [a, b].map((c) => {
    const out = c.map((m) => m + [-12, 0, 12][Math.floor(Math.random() * 3)]);
    return out.every((m) => m >= 36 && m <= 84) ? out : c; // stay in a pleasant band
  });
  if (!shifted[0].some((m) => shifted[1].includes(m))) [a, b] = shifted; // accept only if disjoint
  return { targetL: a, targetR: b, hint, center: shuffle([...a, ...b]) };
};

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
