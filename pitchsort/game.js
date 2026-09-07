// game.js — state machine + render (debug screen only, mirrors stereo axis).
import { ctx, playNote, playChord } from './audio.js';
import { Pad } from './input.js';
import { makeLevel, deal } from './levels.js';

const ORDER = ['L', 'C', 'R'];
const PANFOR = { L: -0.8, C: 0, R: 0.8 };

const S = {
  phase: 'intro', // intro | play | graded
  level: 1,
  cols: { L: [], C: [], R: [] },
  cursor: { col: 'C', row: 0 },
  captured: null, // { midi, srcCol, srcRow }
  targets: null,
  moves: 0,
  t0: 0,
};

function loadLevel(n, sameDeal) {
  const d = sameDeal ? S.deal : deal(makeLevel(n));
  S.deal = d;
  S.cols = { L: [], C: [...d.center], R: [] };
  S.targets = { L: d.targetL, R: d.targetR };
  S.cursor = { col: 'C', row: 0 };
  S.captured = null; S.moves = 0; S.phase = 'intro'; S.pass = undefined;
  playChord(d.targetL, 'left');
  playChord(d.targetR, 'right', { delay: 1.4 });
  setTimeout(() => { S.phase = 'play'; S.t0 = performance.now(); render(); }, 3000);
}

function colArr(k = S.cursor.col) { return S.cols[k]; }
const clampRow = () => { S.cursor.row = Math.max(0, Math.min(S.cursor.row, colArr().length - (S.captured ? 0 : 1))); };

function hearCursor() {
  const n = S.captured?.midi ?? colArr()[S.cursor.row];
  if (n !== undefined) playNote(n, { pan: PANFOR[S.cursor.col], captured: S.captured?.midi === n });
}

function isPass() {
  const match = (arr, target) => arr.length === target.length && arr.every((m) => target.includes(m));
  return S.cols.C.length === 0 && match(S.cols.L, S.targets.L) && match(S.cols.R, S.targets.R);
}

function onButton(b) {
  ctx.resume();
  if (S.phase === 'graded') {
    if (b === 'START') loadLevel(S.pass ? S.level + 1 : S.level, !S.pass);
    return;
  }
  if (S.phase !== 'play') return;

  switch (b) {
    case 'LEFT': case 'RIGHT': {
      const i = ORDER.indexOf(S.cursor.col) + (b === 'RIGHT' ? 1 : -1);
      if (i >= 0 && i < 3) { S.cursor.col = ORDER[i]; clampRow(); hearCursor(); render(); }
      break;
    }
    case 'UP': case 'DOWN':
      S.cursor.row += b === 'DOWN' ? 1 : -1; clampRow(); hearCursor(); render();
      break;
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
    case 'B':
      if (S.captured) {
        S.cols[S.captured.srcCol].splice(S.captured.srcRow, 0, S.captured.midi);
        S.captured = null; S.moves--; hearCursor(); render();
      } else playChord(S.cols.R, 'right');
      break;
    case 'X': playChord(S.cols.L, 'left'); break;
    case 'Y': playChord(S.cols.C, 'center'); break;
    case 'LT': playChord(S.targets.L, 'left'); break;
    case 'RT': playChord(S.targets.R, 'right'); break;
    case 'START': if (S.cols.C.length === 0 && !S.captured) grade(); break;
  }
}

// A release = place (held-state poll, not an edge event)
let aHeldPrev = false;
function tickRelease(aHeld) {
  if (aHeldPrev && !aHeld && S.captured) {
    colArr().splice(S.cursor.row, 0, S.captured.midi);
    S.captured = null;
    hearCursor(); render();
    if (isPass()) { // auto-win: play feedback, then next level
      S.pass = true; grade();
      setTimeout(() => loadLevel(S.level + 1), 4200); // jingle + both chords ≈ 4s
    }
  }
  aHeldPrev = aHeld;
}

// no score — pass/fail only.
// Pass: happy jingle, then player L/R chords. Fail: chords with wrong notes distorted, then clean targets.
function grade() {
  S.phase = 'graded';
  if (S.pass) {
    [60, 64, 67, 72].forEach((m, i) => playNote(m, { dur: 0.25, delay: i * 0.13 })); // jingle
    playChord(S.cols.L, 'left', { delay: 1.0 });
    playChord(S.cols.R, 'right', { delay: 2.6 });
  } else {
    const playCol = (arr, col, baseDelay) => arr.forEach((m, i) =>
      playNote(m, { pan: PANFOR[col], dur: 1.2, delay: baseDelay + i * 0.1, wrong: !S.targets[col].includes(m) }));
    playCol(S.cols.L, 'L', 0);
    playCol(S.cols.R, 'R', 1.6);
    playChord(S.targets.L, 'left', { delay: 3.4 });
    playChord(S.targets.R, 'right', { delay: 5.0 });
  }
  render();
}

function render() {
  const el = document.getElementById('debug');
  const col = (k) => {
    const rows = S.cols[k].map((m, i) => {
      const cur = S.cursor.col === k && S.cursor.row === i ? '>' : ' ';
      const held = S.captured?.midi === m ? '*' : '';
      return `${cur}${m}${held}`;
    });
    if (S.captured && S.cursor.col === k) rows.splice(S.cursor.row, 0, `[${S.captured.midi}]`);
    return `<div class="col"><h3>${k === 'L' ? 'LEFT' : k === 'R' ? 'RIGHT' : 'CENTER'}</h3>${rows.join('<br>') || '&nbsp;'}</div>`;
  };
  el.innerHTML = `
    <h2>PitchSort — Level ${S.level} ${S.phase === 'graded' ? (S.pass ? 'PASS ✓ → START for next' : 'FAIL ✗ → START to retry') : ''}</h2>
    <div class="row">${col('L')}${col('C')}${col('R')}</div>
    <p>moves: ${S.moves} &nbsp; targets: L[${S.targets.L}] R[${S.targets.R}]</p>`;
}

const pad = new Pad(onButton);
loadLevel(1);
(function loop() { pad.poll(); tickRelease(pad.held('A')); requestAnimationFrame(loop); })();
