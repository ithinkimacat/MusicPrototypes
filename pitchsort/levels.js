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
// every pair contains the tonic (degree 0) on ONE side -> tension|home pair,
// and win plays tension first, home last: a cadence either way the columns land.
const FIRST20 = [
  [1, 48, 'maj', 0, 4, 1, 'grab'],     // C: I | V
  [2, 43, 'maj', 0, 3, 1, 'triggers'], // G: I | IV
  [3, 48, 'maj', 0, 4, 2, 'play'],
  [4, 48, 'maj', 3, 0, 3],             // C: IV | I
  [5, 43, 'maj', 0, 5, 3],             // G: I | vi
  [6, 41, 'maj', 0, 1, 3],             // F: I | ii
  [7, 48, 'maj', 1, 0, 3],             // C: ii | I
  [8, 50, 'maj', 3, 0, 3],             // D: IV | I
  [9, 48, 'maj', 0, 4, 4],             // C: Imaj7 | V7
  [10, 43, 'maj', 3, 0, 4],            // G: IVmaj7 | Imaj7
  [11, 41, 'maj', 5, 0, 4],            // F: vim7 | Imaj7
  [12, 48, 'maj', 0, 5, 4],            // C: Imaj7 | vim7
  [13, 45, 'min', 0, 6, 4],            // Am: im7 | VIIm7
  [14, 45, 'min', 3, 0, 4],            // Am: ivm7 | im7
  [15, 40, 'min', 0, 5, 4],            // Em: i7 | VImaj7
  [16, 38, 'min', 0, 4, 4],            // Dm: im7 | vm7
  [17, 45, 'min', 5, 0, 4],            // Am: IIImaj7 | im7
  [18, 43, 'maj', 4, 0, 4],            // G: V7 | Imaj7
  [19, 41, 'maj', 3, 0, 4],            // F: IVmaj7 | Imaj7
  [20, 46, 'maj', 1, 0, 4],            // Bb: iim7 | Imaj7
];

// generated ladder past 20: one side is always tonic, other 1-6, size creeps to 5
export function makeLevel(n) {
  const row = FIRST20.find(([l]) => l === n);
  if (row) {
    const [, keyRoot, scale, degL, degR, size, hint] = row;
    return {
      targetL: diatonic(keyRoot, scale, degL, size),
      targetR: diatonic(keyRoot + 24, scale, degR, size), // R two octaves up; deal() re-mixes
      homeSide: degL === 0 ? 'L' : 'R',
      hint,
    };
  }
  const size = Math.min(4 + Math.floor((n - 21) / 3), 5);
  const scale = n % 3 === 0 ? 'min' : 'maj';
  const rootL = 36 + ((n * 7) % 12);
  const homeLeft = n % 2 === 0;
  const degTension = 1 + ((n * 13) % 5); // 1-5, never 0
  return {
    targetL: diatonic(rootL, scale, homeLeft ? 0 : degTension, size),
    targetR: diatonic(rootL + 22, scale, homeLeft ? degTension : 0, size),
    homeSide: homeLeft ? 'L' : 'R',
  };
}

export const deal = ({ targetL, targetR, hint, homeSide }) => {
  // disguise any L-low / R-high pattern: random side swap + independent octave shifts
  // (homeSide travels with the swap so win playback still resolves onto the tonic)
  const swapped = Math.random() < 0.5;
  let [a, b] = swapped ? [targetR, targetL] : [targetL, targetR];
  let home = homeSide;
  if (swapped) home = homeSide === 'L' ? 'R' : 'L';
  const shifted = [a, b].map((c) => {
    const out = c.map((m) => m + [-12, 0, 12][Math.floor(Math.random() * 3)]);
    return out.every((m) => m >= 36 && m <= 84) ? out : c; // stay in a pleasant band
  });
  if (!shifted[0].some((m) => shifted[1].includes(m))) [a, b] = shifted; // accept only if disjoint
  return { targetL: a, targetR: b, homeSide: home, hint, center: shuffle([...a, ...b]) };
};

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
