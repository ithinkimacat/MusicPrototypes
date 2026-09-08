// levels.js — chords are tension+tonic pairs from one key (cadence logic),
// then VOICED IN THE SAME MID BAND by deal(): no low-L / high-R giveaway.
// Band: roots midi 48-71 (C3-B3... via C3-B5 span incl. chord tones) — the audible
// middle of an 88-key piano; low end would vanish on laptop speakers.
const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10] };

// curated campaign, fetched once; game falls back to generated levels while unloaded
let CAMPAIGN = null;
export function campaignLength() { return CAMPAIGN ? CAMPAIGN.length : 0; }
export function loadCampaign() {
  return fetch('./levels.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((j) => { CAMPAIGN = j.levels; })
    .catch(() => { CAMPAIGN = null; }); // offline/broken file -> generated ladder
}

// diatonic chord: stack thirds from scale degree, returned as intervals from root
function diatonic(root, scaleName, degree, size) {
  const sc = SCALES[scaleName];
  const base = root + 12 * Math.floor(degree / 7) + sc[degree % 7];
  const out = [];
  for (let k = 0; k < size; k++) {
    const d = degree + k * 2;
    out.push(root + 12 * Math.floor(d / 7) + sc[d % 7] - base); // interval from chord root
  }
  return out;
}

// tutorial = which input to highlight (pulsing chip), not text
// [level, keyPitchClass, scale, degL, degR, size, tutorialHighlight?]
// every pair contains the tonic (degree 0) on ONE side.
const FIRST20 = [
  [1, 0, 'maj', 0, 4, 1, 'grab'],     // C: I | V
  [2, 7, 'maj', 0, 3, 1, 'triggers'], // G: I | IV
  [3, 0, 'maj', 0, 4, 2, 'play'],
  [4, 0, 'maj', 3, 0, 3],             // C: IV | I
  [5, 7, 'maj', 0, 5, 3],             // G: I | vi
  [6, 5, 'maj', 0, 1, 3],             // F: I | ii
  [7, 0, 'maj', 1, 0, 3],             // C: ii | I
  [8, 2, 'maj', 3, 0, 3],             // D: IV | I
  [9, 0, 'maj', 0, 4, 4],             // C: Imaj7 | V7
  [10, 7, 'maj', 3, 0, 4],            // G: IVmaj7 | Imaj7
  [11, 5, 'maj', 5, 0, 4],            // F: vim7 | Imaj7
  [12, 0, 'maj', 0, 5, 4],            // C: Imaj7 | vim7
  [13, 9, 'min', 0, 6, 4],            // Am: im7 | VIIm7
  [14, 9, 'min', 3, 0, 4],            // Am: ivm7 | im7
  [15, 4, 'min', 0, 5, 4],            // Em: i7 | VImaj7
  [16, 2, 'min', 0, 4, 4],            // Dm: im7 | vm7
  [17, 9, 'min', 5, 0, 4],            // Am: IIImaj7 | im7
  [18, 7, 'maj', 4, 0, 4],            // G: V7 | Imaj7
  [19, 5, 'maj', 3, 0, 4],            // F: IVmaj7 | Imaj7
  [20, 10, 'maj', 1, 0, 4],           // Bb: iim7 | Imaj7
];

export function makeLevel(n, free = false) {
  // curated campaign: exact notes from levels.json (authored by gen-levels.mjs)
  if (!free && CAMPAIGN && n <= CAMPAIGN.length) {
    const l = CAMPAIGN[n - 1];
    return { curated: l, targetL: l.L, targetR: l.R, pool: l.pool, hint: l.hint };
  }
  if (free) return makeFree(n); // endless 3/4-note generation
  const row = FIRST20.find(([l]) => l === n);
  if (row) {
    const [, keyPc, scale, degL, degR, size, hint] = row;
    return {
      targetL: diatonic(keyPc, scale, degL, size),
      targetR: diatonic(keyPc, scale, degR, size),
      homeSide: degL === 0 ? 'L' : 'R',
      hint,
    };
  }
  return makeFree(n);
}

// free play: endless diatonic tension|tonic pairs, 3 per side, every 4th level 4
function makeFree(n) {
  const size = n % 4 === 0 ? 4 : 3;
  const scale = n % 3 === 0 ? 'min' : 'maj';
  const keyPc = (n * 5) % 12;
  const homeLeft = n % 2 === 0;
  const degTension = 1 + ((n * 13) % 5);
  return {
    targetL: diatonic(keyPc, scale, homeLeft ? 0 : degTension, size),
    targetR: diatonic(keyPc, scale, homeLeft ? degTension : 0, size),
    homeSide: homeLeft ? 'L' : 'R',
  };
}

// voice an interval-chord into midi notes: random root in [48, 71], stack upward.
// Both chords get independent roots in the SAME band — the ear must separate by
// pitch class / quality, not register.
const voice = (intervals, rootMin = 48, rootMax = 71) => {
  const r = rootMin + Math.floor(Math.random() * (rootMax - rootMin + 1));
  const out = intervals.map((i) => r + i);
  return out.every((m) => m <= 84) ? out : out.map((m) => m - 12); // overflow -> down an octave
};

export const deal = ({ curated, targetL, targetR, hint, homeSide, pool }) => {
  // curated: notes, sides and center order frozen in the file — reproducible by design
  if (curated) return { targetL, targetR, homeSide: 'L', hint, center: [...pool] };
  const swapped = Math.random() < 0.5;
  let pair = swapped ? [targetR, targetL] : [targetL, targetR];
  let home = homeSide === 'L' ? (swapped ? 'R' : 'L') : (swapped ? 'L' : 'R');
  let [a, b] = [voice(pair[0]), voice(pair[1])];
  for (let tries = 0; tries < 8 && a.some((m) => b.includes(m)); tries++) {
    b = voice(pair[1]); // shared pitch classes across octaves are fine (common tones),
  }                     // exact same midi = unsolvable, re-voice
  return { targetL: a, targetR: b, homeSide: home, hint, center: shuffle([...a, ...b]) };
};

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
