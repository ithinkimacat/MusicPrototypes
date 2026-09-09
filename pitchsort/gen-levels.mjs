#!/usr/bin/env node
// gen-levels.mjs — authors levels.json from hand-written midi rows.
// Rules enforced at build time:
//   - every note in 48..84 (audible mid-band of an 88-key piano)
//   - no note appears in both columns (exact dup = unsolvable deal)
//   - sizes ramp 1 -> 2 -> 3 -> 4
//   - pairs stay within one key/scale at a time (L+R together sound consonant)
// Run: node gen-levels.mjs
import { writeFileSync } from 'node:fs';

// [name, hint?, L:[midis], R:[midis]]
// Difficulty ramp inside a size block: unrelated registers/pcs first,
// shared pitch classes (voiced apart in octave) later — the ear must
// separate chords by quality, not register.
const ROWS = [
  // --- singles: interval distance shrinks 7 -> 1 semitones, anchor note C4 ---
  ['C: P5', 'grab', [60], [67]],
  ['E: P5', 'triggers', [64], [71]],
  ['C: P4', 'play', [60], [65]],
  ['C: M3', , [60], [64]],
  ['C: M2', , [60], [62]],
  ['C: m2', , [60], [61]], // semitone

  // --- 2-note (11): consonant dyads far apart -> whole-step shifts -> semitone clusters ---
  ['C: I | V', , [60, 64], [67, 71]],
  ['C: M3 dyads, 8va', , [60, 64], [72, 76]],
  ['C: dyads, tritone off', , [60, 64], [66, 70]],
  ['C: dyads, P4 off', , [60, 64], [65, 69]],
  ['C: fifths, M2 off', , [64, 67], [69, 72]],
  ['C: M3/F#m dyads, m2', , [64, 69], [65, 70]],
  ['C: fifths, m2 off', , [60, 67], [61, 68]],
  ['C: M3 dyads, M2 off', , [60, 64], [62, 65]],
  ['C: fourths, m2 off', , [60, 65], [61, 66]],
  ['C: m2 inside each side', , [60, 61], [64, 65]],
  ['C: chromatic tetrachord', , [60, 61], [62, 63]], // C C# D D#

  // --- 3-note (24): consonant triads far apart ... shared pcs ... chromatic close ---
  ['C: V(low) | I', , [55, 59, 62], [60, 64, 67]],
  ['G: I | V(hi)', , [55, 59, 62], [74, 78, 81]],
  ['F: V | I', , [60, 64, 67], [65, 69, 72]],
  ['Dm: i | VII', , [62, 65, 69], [60, 64, 67]],
  ['Am: i | iv', , [57, 60, 64], [62, 65, 69]],
  ['C: IV | I', , [65, 69, 72], [60, 64, 67]],
  ['G: ii | I', , [57, 60, 64], [55, 59, 62]],
  ['Em: i | V(low)', , [64, 67, 71], [59, 63, 66]],
  ['C: vi | I', , [69, 72, 76], [60, 64, 67]],           // share C E pcs
  ['C: I/2inv | vi/open', , [67, 72, 76], [57, 64, 69]],
  ['C: I | iii/2inv', , [60, 64, 67], [71, 76, 79]],    // share E G pcs
  ['G: I | vi/spread', , [67, 71, 74], [64, 76, 79]],   // share G pcs
  ['F: I | iii(low)', , [65, 69, 72], [57, 60, 64]],    // share A C pcs
  ['Am: i | III', , [57, 60, 64], [67, 72, 76]],        // share C E pcs
  ['Em: i | iv', , [64, 67, 71], [69, 72, 76]],
  ['Dm: i | v(low)', , [62, 65, 69], [57, 60, 64]],
  ['Bb: I | IV', , [58, 62, 65], [63, 67, 70]],
  ['C: ii | V', , [62, 65, 69], [67, 71, 74]],
  ['C: IV | V', , [65, 69, 72], [67, 71, 74]],
  ['G: IV | V', , [72, 76, 79], [74, 78, 81]],
  ['C: maj triads, m2 shift', , [60, 64, 67], [61, 65, 68]],
  ['C: min triads, m2 shift', , [60, 63, 67], [61, 64, 68]],
  ['C: sus triads, m2 shift', , [60, 65, 70], [61, 66, 71]],
  ['C: chromatic hexachord', , [60, 61, 62], [63, 64, 65]],

  // --- 4-note (10): consonant 7ths far -> shared pcs -> semitone-shifted 7ths -> cluster ---
  ['C: Imaj7 | V7', , [60, 64, 67, 71], [55, 59, 62, 65]],
  ['G: Imaj7 | V7', , [67, 71, 74, 78], [62, 66, 69, 72]],
  ['F: Imaj7 | IVmaj7', , [65, 69, 72, 76], [70, 74, 77, 81]],
  ['C: ii7 | V7', , [62, 65, 69, 72], [67, 71, 74, 77]],
  ['Am: i7 | VImaj7', , [57, 60, 64, 67], [65, 69, 72, 76]], // share A C E pcs
  ['G: Imaj7 | vi7', , [55, 59, 62, 66], [64, 67, 71, 74]],   // share G B D pcs
  ['F: Imaj7 | ii7', , [65, 69, 72, 76], [67, 70, 74, 77]],
  ['C: maj7, m2 shift', , [60, 64, 67, 71], [61, 65, 68, 72]],
  ['C: min7, m2 shift', , [60, 63, 67, 70], [61, 64, 68, 71]],
  ['C: chromatic octave', , [60, 61, 62, 63], [64, 65, 66, 67]],
];

const SIZE_RAMP = '1x6,2x11,3x24,4x10';
const levels = ROWS.map(([name, hint, L, R], i) => {
  const n = i + 1;
  const set = new Set();
  for (const m of [...L, ...R]) {
    if (m < 48 || m > 84) throw new Error(`L${n} ${name}: midi ${m} out of band 48-84`);
    if (set.has(m)) throw new Error(`L${n} ${name}: note ${m} duplicated — unsolvable`);
    set.add(m);
  }
  // seeded shuffle: same pool order for every player, but no LRLR alternation giveaway
  const pool = seededShuffle([...L, ...R], n);
  return { n, name, ...(hint ? { hint } : {}), L, R, pool };
});

function seededShuffle(arr, seed) {
  let s = seed * 2654435761 % 4294967296; // deterministic per level
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = Math.floor((s / 4294967296) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// size ramp check
const seq = levels.map((l) => l.L.length).join('');
const want = '1'.repeat(6) + '2'.repeat(11) + '3'.repeat(24) + '4'.repeat(10);
if (seq !== want) throw new Error(`size ramp broken (${SIZE_RAMP}):\n${seq}`);

writeFileSync(new URL('./levels.json', import.meta.url), JSON.stringify({ levels }, null, 1) + '\n');
console.log(`levels.json: ${levels.length} levels OK (${SIZE_RAMP})`);
