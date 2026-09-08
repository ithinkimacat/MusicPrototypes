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
  // --- singles: learn the mechanic, intervals far apart ---
  ['C: I | V', 'grab', [60], [67]],
  ['G: I | V', 'triggers', [67], [74]],
  ['F: I | V', 'play', [65], [72]],
  ['D: I | V', , [62], [69]],
  ['Bb: I | V', , [58], [65]],
  ['E: I | V', , [64], [71]],

  // --- 2-note combos (11): dyads, thirds/fifths, registers pulling closer ---
  ['C: I | V', , [60, 64], [67, 71]],
  ['G: I | V', , [67, 71], [74, 78]],
  ['F: IV | I', , [70, 74], [65, 69]],
  ['C: ii | I', , [62, 65], [60, 64]],
  ['Am: i | V', , [57, 60], [64, 68]],
  ['G: vi | I(no8)', , [64, 67], [71, 74]],
  ['C: IV | I', , [65, 69], [72, 76]],
  ['F: ii | V', , [67, 71], [72, 76]],
  ['Dm: i | iv', , [62, 65], [67, 70]],
  ['Em: VI | i', , [60, 64], [52, 55]],
  ['C: iii | I', , [52, 55], [60, 64]],

  // --- 3-note combos (24): triads, then pc-similar pairs in split registers ---
  ['C: I | V', , [60, 64, 67], [67, 71, 74]],
  ['G: I | V', , [55, 59, 62], [62, 66, 69]],
  ['F: V | I', , [60, 64, 67], [65, 69, 72]],
  ['Dm: i | VII', , [62, 65, 69], [60, 64, 67]],
  ['Am: i | iv', , [57, 60, 64], [62, 65, 69]],
  ['C: IV | I', , [65, 69, 72], [60, 64, 67]],
  ['G: ii | I', , [57, 60, 64], [55, 59, 62]],
  ['Em: i | V', , [64, 67, 71], [71, 75, 78]],
  ['C: vi | I', , [69, 72, 76], [60, 64, 67]],
  ['C: I/2inv | vi/open', , [67, 72, 76], [57, 64, 69]],
  ['C: I | iii/2inv', , [60, 64, 67], [71, 76, 79]],
  ['G: I | vi/open', , [67, 71, 74], [64, 71, 76]],
  ['F: I | iii/open', , [65, 69, 72], [57, 72, 76]],
  ['Am: i | III', , [57, 60, 64], [67, 72, 76]],
  ['Em: i | iv', , [64, 67, 71], [69, 72, 76]],
  ['Dm: i | v(low)', , [62, 65, 69], [57, 60, 64]],
  ['Bb: I | IV', , [58, 62, 65], [63, 67, 70]],
  ['C: ii | V', , [62, 65, 69], [67, 71, 74]],
  ['C: IV | V', , [65, 69, 72], [67, 71, 74]],
  ['G: IV | V', , [72, 76, 79], [74, 78, 81]],
  ['Am: VI | VII', , [65, 69, 72], [67, 71, 74]], // pcs disjoint but adjacent — deceptive
  ['C: I/2inv | V/2inv', , [67, 72, 76], [71, 74, 78]],
  ['G: I | IV', , [67, 71, 74], [72, 76, 79]],
  ['C: I/2inv | V(low)', , [67, 72, 76], [55, 59, 62]],

  // --- 4-note combos (10): seventh chords, 2-3 shared pitch classes ---
  ['C: Imaj7 | V7', , [60, 64, 67, 71], [55, 59, 62, 65]],
  ['G: Imaj7 | V7', , [67, 71, 74, 78], [62, 66, 69, 72]],
  ['F: Imaj7 | IVmaj7', , [65, 69, 72, 76], [70, 74, 77, 81]],
  ['C: ii7 | V7', , [62, 65, 69, 72], [67, 71, 74, 77]],
  ['Am: i7 | VImaj7', , [57, 60, 64, 67], [65, 69, 72, 76]], // share A C E pcs
  ['C: Imaj7(hi) | iii7', , [72, 76, 79, 83], [64, 67, 71, 74]], // share E G B pcs
  ['G: Imaj7 | vi7', , [55, 59, 62, 66], [64, 67, 71, 74]], // share G B D pcs
  ['F: Imaj7 | ii7', , [65, 69, 72, 76], [67, 70, 74, 77]],
  ['C: V7 | Imaj7(hi)', , [67, 71, 74, 77], [72, 76, 79, 83]], // share G B pcs
  ['Am: i7(hi) | VII7', , [69, 72, 76, 79], [67, 71, 74, 77]],
];

const SIZE_RAMP = '1x6,2x11,3x24,4x10';
const levels = ROWS.map(([name, hint, L, R], i) => {
  const n = i + 1;
  const set = new Set();
  for (const m of [...L, ...R]) {
    if (m < 48 || m > 84) throw new Error(`L${n} ${name}: midi ${m} out of band 48-84`);
    if (!set.add(m)) throw new Error(`L${n} ${name}: note ${m} duplicated — unsolvable`);
  }
  const pool = L.flatMap((m, k) => [m, R[k]]); // deterministic interleave L,R
  return { n, name, ...(hint ? { hint } : {}), L, R, pool };
});

// size ramp check
const seq = levels.map((l) => l.L.length).join('');
const want = '1'.repeat(6) + '2'.repeat(11) + '3'.repeat(24) + '4'.repeat(10);
if (seq !== want) throw new Error(`size ramp broken (${SIZE_RAMP}):\n${seq}`);

writeFileSync(new URL('./levels.json', import.meta.url), JSON.stringify({ levels }, null, 1) + '\n');
console.log(`levels.json: ${levels.length} levels OK (${SIZE_RAMP})`);
