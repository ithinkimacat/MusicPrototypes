// game.js — state machine + render (debug screen only).
import { ctx, playNote, playChord } from './audio.js';
import { Pad } from './input.js';
import { makeLevel } from './levels.js';

const COLS = { L: 'left', C: 'center', R: 'right' };
const ORDER = ['L', 'C', 'R'];

const S = {
  phase: 'intro', // intro | play | graded
  level: 1,
  cols: { L: [], C: [], R: [] },
  cursor: { col: 'C', row: 0 },
  captured: null, // { midi, srcCol, srcRow, moves }
  targets: null,
  moves: 0,
  t0: 0,
  partial: true, // subtle sustain feedback, off at high difficulty
};

function loadLevel(n) {
  const lv = makeLevel(n);
  S.cols = { L: [], C: lv.center, R: [] };
  S.targets = { L: lv.targetL, R: lv.targetR };
  S.cursor = { col: 'C', row: 0 };
  S.captured = null; S.moves = 0; S.phase = 'intro'; S.partial = n <= 6;
  playChord(lv.targetL, 'left');
  playChord(lv.targetR, 'right', { delay: 1.4 });
  setTimeout(() => { S.phase = 'play'; S.t0 = performance.now(); render(); }, 3000);
}

function colArr(k = S.cursor.col) { return S.cols[k]; }
const clampRow = () => { S.cursor.row = Math.max(0, Math.min(S.cursor.row, colArr().length - (S.captured ? 0 : 1))); };

function hearCursor() {
  const n = S.captured?.midi ?? colArr()[S.cursor.row];
  if (n !== undefined) playNote(n, { pan: { L: -0.8, C: 0, R: 0.8 }[S.cursor.col], captured: !!S.captured && S.captured.midi === n });
}

function onButton(b) {
  ctx.resume();
  if (S.phase === 'graded') { if (b === 'START') loadLevel(S.level + 1); return; }
  if (S.phase !== 'play') return;

  switch (b) {
    case 'LEFT': case 'RIGHT': {
      const i = ORDER.indexOf(S.cursor.col) + (b === 'RIGHT' ? 1 : -1);
      if (i >= 0 && i < 3) { S.cursor.col = ORDER[i]; clampRow(); hearCursor(); render(); }
      break;
    }
    case 'UP': case 'DOWN': {
      S.cursor.row += b === 'DOWN' ? 1 : -1; clampRow(); hearCursor(); render();
      break;
    }
    case 'A': {
      if (S.captured) break;
      const arr = colArr();
      if (arr.length === 0) break;
      const midi = arr.splice(S.cursor.row, 1)[0];
      S.captured = { midi, srcCol: S.cursor.col, srcRow: S.cursor.row };
      S.moves++;
      hearCursor(); render();
      break;
    }
    case 'B': {
      if (S.captured) { // cancel capture → back to origin
        S.cols[S.captured.srcCol].splice(S.captured.srcRow, 0, S.captured.midi);
        S.captured = null; S.moves--; hearCursor(); render();
      } else playChord(S.cols.R, 'right');
      break;
    }
    case 'X': playChord(S.cols.L, 'left', { sustain: true }); break;
    case 'Y': playChord(S.cols.C, 'center'); break;
    case 'LT': playChord(S.targets.L, 'left'); break;
    case 'RT': playChord(S.targets.R, 'right'); break;
    case 'START': if (S.cols.C.length === 0 && !S.captured) grade(); break;
  }
}

// A release = place (not an edge event — watch held state in tick)
let aHeldPrev = false;
function tickRelease(aHeld) {
  if (aHeldPrev && !aHeld && S.captured) {
    colArr().splice(S.cursor.row, 0, S.captured.midi);
    S.captured = null;
    hearCursor(); render();
  }
  aHeldPrev = aHeld;
}

function grade() {
  S.phase = 'graded';
  const inChord = (arr, target) => arr.filter((m) => target.includes(m));
  const accL = inChord(S.cols.L, S.targets.L).length / S.targets.L.length;
  const accR = inChord(S.cols.R, S.targets.R).length / S.targets.R.length;
  const posAcc = [...S.targets.L, ...S.targets.R].filter((m) => S.cols.L.indexOf(m) === S.targets.L.indexOf(m) || S.cols.R.indexOf(m) === S.targets.R.indexOf(m)).length / (S.targets.L.length + S.targets.R.length);
  const optimal = S.targets.L.length + S.targets.R.length;
  const eff = Math.max(0, 1 - Math.max(0, S.moves - optimal) / optimal);
  const secs = (performance.now() - S.t0) / 1000;
  const time = Math.max(0, 1 - secs / 120);
  S.score = Math.round(100 * (0.5 * (accL + accR) / 2 + 0.3 * posAcc + 0.1 * eff + 0.1 * time));
  // grading playback: player chords, wrong notes distorted
  const playCol = (arr, col, baseDelay) => arr.forEach((m, i) => playNote(m, { pan: col === 'L' ? -0.8 : 0.8, dur: 1.2, delay: baseDelay + i * 0.1, wrong: !S.targets[col].includes(m) }));
  playCol(S.cols.L, 'L', 0);
  playCol(S.cols.R, 'R', 1.6);
  playChord(S.targets.L, 'left', { delay: 3.4 });
  playChord(S.targets.R, 'right', { delay: 5.0 });
  render();
}

function render() {
  const el = document.getElementById('debug');
  const fmt = (k) => S.cols[k].map((m, i) => {
    const cur = S.cursor.col === k && S.cursor.row === i ? '>' : ' ';
    const held = S.captured?.midi === m ? '*' : '';
    return `${cur}${m}${held}`;
  }).join(' ');
  el.textContent = [
    `PitchSort Lv${S.level} ${S.phase}`,
    `L: ${fmt('L')}`,
    `C: ${fmt('C')}`,
    `R: ${fmt('R')}`,
    `moves:${S.moves} ${S.score !== undefined ? 'score:' + S.score : ''} cursor:${S.cursor.col}${S.cursor.row}`,
    `targets L[${S.targets.L}] R[${S.targets.R}]`,
  ].join('\n');
}

const pad = new Pad(onButton);
loadLevel(1);
(function loop() { pad.poll(); tickRelease(pad.held('A')); requestAnimationFrame(loop); })();
