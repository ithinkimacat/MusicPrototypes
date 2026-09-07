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
  render(); // clears win/fade classes → fades in
  playChord(d.targetL, 'left');
  playChord(d.targetR, 'right', { delay: 1.4 });
  setTimeout(() => { S.phase = 'play'; S.t0 = performance.now(); render(); }, 2200);
}

// scheduled DOM flashes synced to WebAudio note onsets (audio scheduled ahead, timers approximate it)
function flashNote(m, delay, dur = 1.2) {
  setTimeout(() => {
    const n = document.querySelector(`[data-midi="${m}"]`);
    n?.classList.add('sounding');
    setTimeout(() => n?.classList.remove('sounding'), dur * 1000);
  }, delay * 1000);
}
function flashCol(k, delay, dur = 1.3) { // chord notes: dur 1.2s, last onset +0.09s
  setTimeout(() => {
    const c = document.querySelector(`[data-col="${k}"]`);
    c?.classList.add('sounding');
    setTimeout(() => c?.classList.remove('sounding'), dur * 1000);
  }, delay * 1000);
}
const auditionCol = (k, pan) => { playChord(S.cols[k], pan); S.cols[k].forEach((m, i) => flashNote(m, i * 0.03)); };
const previewTarget = (k, pan) => { playChord(S.targets[k], pan); flashCol(k === 'L' ? 'L' : 'R', 0); };

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
      } else auditionCol('R', 'right');
      break;
    case 'X': auditionCol('L', 'left'); break;
    case 'Y': auditionCol('C', 'center'); break;
    case 'LT': previewTarget('L', 'left'); break;
    case 'RT': previewTarget('R', 'right'); break;
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
      setTimeout(() => document.getElementById('debug').classList.add('fade'), 2600);
      setTimeout(() => loadLevel(S.level + 1), 2900); // jingle + chords ≈ 2.9s
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
    playChord(S.cols.L, 'left', { delay: 0.6 });
    S.cols.L.forEach((m, i) => flashNote(m, 0.6 + i * 0.03));
    playChord(S.cols.R, 'right', { delay: 1.9 });
    S.cols.R.forEach((m, i) => flashNote(m, 1.9 + i * 0.03));
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

// pitch → hue: blue (low) through green/yellow to red (high)
const midiColor = (m) => `hsl(${240 - ((m - 45) / 31) * 240}, 90%, 55%)`;

function noteHtml(m, k, i) {
  const cls = [
    'note',
    S.cursor.col === k && S.cursor.row === i && !S.captured ? 'cursor' : '',
    S.captured?.midi === m ? 'captured' : '',
  ].join(' ');
  return `<span class="${cls}" data-midi="${m}" style="background:${midiColor(m)}"></span>`;
}

function render() {
  const el = document.getElementById('debug');
  // FLIP: snapshot block positions before rebuild, animate deltas after
  const before = {};
  el.querySelectorAll('.note[data-midi]').forEach((n) => { before[n.dataset.midi] = n.getBoundingClientRect(); });

  const col = (k) => {
    let rows = S.cols[k].map((m, i) => noteHtml(m, k, i));
    if (S.captured && S.cursor.col === k) rows.splice(S.cursor.row, 0, noteHtml(S.captured.midi, k, S.cursor.row));
    return `<div class="col ${S.cursor.col === k ? 'active' : ''}" data-col="${k}"><h3>${{ L: 'LEFT', C: 'CENTER', R: 'RIGHT' }[k]}</h3>${rows.join('')}</div>`;
  };
  el.className = S.phase === 'graded' && S.pass ? 'win' : '';
  el.innerHTML = `
    <h2 class="${S.phase === 'graded' && S.pass ? 'win' : ''}">PitchSort — Level ${S.level}${S.phase === 'graded' ? (S.pass ? ' ✓' : ' ✗ retry (START)') : ''}</h2>
    <div class="row">${col('L')}${col('C')}${col('R')}</div>
    <p style="color:#555">moves: ${S.moves}</p>`;

  el.querySelectorAll('.note[data-midi]').forEach((n) => {
    const b = before[n.dataset.midi];
    if (!b) { // new arrival: grow in
      n.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
      return;
    }
    const a = n.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top;
    if (dx || dy) n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.34,1.4,.64,1)' });
  });
}

const pad = new Pad(onButton);
loadLevel(1);
(function loop() { pad.poll(); tickRelease(pad.held('A')); requestAnimationFrame(loop); })();
