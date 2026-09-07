// game.js — state machine + render (debug screen only, mirrors stereo axis).
import { ctx, playNote, playChord, startCaptureVoice, setVolume, getVolume } from './audio.js';
import { Pad, detectFamily } from './input.js';
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
  S.level = n; // was never updated — level counter stuck at 1
  const d = sameDeal ? S.deal : deal(makeLevel(n));
  S.deal = d;
  S.cols = { L: [], C: [...d.center], R: [] };
  S.targets = { L: d.targetL, R: d.targetR };
  S.hint = d.hint;
  S.cursor = { col: 'C', row: 0 };
  S.captured = null; S.moves = 0; S.phase = 'intro'; S.pass = undefined;
  render(); // clears win/fade classes → fades in
  playChord(d.targetL, 'left');
  flashCol('L', 0); // glow synced: target chords play L then R
  playChord(d.targetR, 'right', { delay: 1.4 });
  flashCol('R', 1.4);
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
  if (S.capVoice) {
    const p = PANFOR[S.cursor.col];
    if (p !== S.lastPan) { S.lastPan = p; S.capVoice.setPan(p); } // skip same-column moves
    return;
  }
  const n = colArr()[S.cursor.row];
  if (n !== undefined) playNote(n, { pan: PANFOR[S.cursor.col] });
}

function isPass() {
  const match = (arr, target) => arr.length === target.length && arr.every((m) => target.includes(m));
  return S.cols.C.length === 0 && match(S.cols.L, S.targets.L) && match(S.cols.R, S.targets.R);
}

function onButton(b) {
  if (S.phase === 'title') { start(); return; }
  if (S.phase === 'graded') {
    if (b === 'START') loadLevel(S.pass ? S.level + 1 : S.level, !S.pass);
    return;
  }
  if (S.phase !== 'play') return;

  switch (b) {
    case 'LEFT': case 'RIGHT': {
      const i = ORDER.indexOf(S.cursor.col) + (b === 'RIGHT' ? 1 : -1);
      if (i >= 0 && i < 3) {
        S.cursor.col = ORDER[i]; clampRow(); hearCursor(); render();
      }
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
      S.capVoice = startCaptureVoice(midi, PANFOR[S.cursor.col]);
      S.lastPan = PANFOR[S.cursor.col];
      render();
      break;
    }
    case 'B':
      if (S.captured) {
        S.capVoice.stop(); S.capVoice = null;
        S.cols[S.captured.srcCol].splice(S.captured.srcRow, 0, S.captured.midi);
        S.captured = null; S.moves--; hearCursor(); render();
      } else auditionCol('R', 'right');
      break;
    case 'X': auditionCol('L', 'left'); break;
    case 'Y': auditionCol('C', 'center'); break;
    case 'LT': previewTarget('L', 'left'); break;
    case 'RT': previewTarget('R', 'right'); break;
    case 'LB': setVolume(getVolume() - 0.1); render(); break;
    case 'RB': setVolume(getVolume() + 0.1); render(); break;
    case 'START': if (S.cols.C.length === 0 && !S.captured) grade(); break;
  }
}

// A release = place (held-state poll, not an edge event)
let aHeldPrev = false;
function tickRelease(aHeld) {
  if (aHeldPrev && !aHeld && S.captured) {
    S.capVoice.stop(); S.capVoice = null;
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

const PRAISE = ['WELL DONE!', 'GOOD JOB!', "YOU'RE ON FIRE!", 'PITCH PERFECT!', 'NAILED IT!', 'SWEET HARMONY!', 'PERFECT SORT!'];

function confetti() {
  const HUES = [0, 45, 120, 200, 280, 330];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.background = `hsl(${HUES[i % HUES.length]}, 90%, 60%)`;
    document.body.appendChild(p);
    const dx = (Math.random() - 0.5) * 700;
    const peak = -(200 + Math.random() * 300);
    const rot = (Math.random() - 0.5) * 1080;
    const x0 = innerWidth / 2, y0 = innerHeight * 0.4;
    p.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${x0 + dx * 0.6}px, ${y0 + peak}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${x0 + dx}px, ${y0 + peak + 600}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.4,1)' },
    ).onfinish = () => p.remove();
  }
}

function banner() {
  const el = document.getElementById('banner');
  el.innerHTML = `<span>${PRAISE[Math.floor(Math.random() * PRAISE.length)]}</span>`;
  el.classList.remove('show');
  void el.offsetWidth; // restart animation
  el.classList.add('show');
}

// no score — pass/fail only.
// Pass: happy jingle, then player L/R chords. Fail: chords with wrong notes distorted, then clean targets.
function grade() {
  S.phase = 'graded';
  if (S.pass) {
    banner(); confetti();
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
    <p class="meta">moves: ${S.moves}</p>
    ${S.hint && S.phase === 'play' ? `<p class="tut">${S.hint}</p>` : ''}
    ${controlsHtml()}`;

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

function start() {
  if (S.phase !== 'title') return;
  ctx.resume(); // AudioContext stays suspended until a user gesture — gate on any input
  loadLevel(1);
}
// keyboard: arrows/WASD move, Space = grab(hold)/drop, J/K/L = play L/C/R,
// Q/E = target previews, Enter = submit, Esc = cancel grab
const KEYMAP = { arrowup: 'UP', w: 'UP', arrowdown: 'DOWN', s: 'DOWN', arrowleft: 'LEFT', a: 'LEFT', arrowright: 'RIGHT', d: 'RIGHT', j: 'X', k: 'Y', l: 'B', q: 'LT', e: 'RT', enter: 'START', escape: 'ESC' };
const keyHeld = {};
let keyUsed = false;
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || KEYMAP[k]) { keyUsed = true; e.preventDefault(); }
  if (S.phase === 'title') { start(); return; }
  if (k === ' ') { if (!keyHeld.space) { keyHeld.space = true; onButton('A'); } return; }
  if (k === '-') { setVolume(getVolume() - 0.1); render(); return; }
  if (k === '=') { setVolume(getVolume() + 0.1); render(); return; }
  const b = KEYMAP[k];
  if (!b || keyHeld[b]) return;
  keyHeld[b] = true;
  onButton(b === 'ESC' && S.captured ? 'B' : b);
});
addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') keyHeld.space = false;
  const b = KEYMAP[k];
  if (b) keyHeld[b] = false;
});
const held = (b) => pad.held(b) || (b === 'A' ? !!keyHeld.space : !!keyHeld[b]);
addEventListener('pointerdown', start);

// control hint for whatever pad is connected (defaults to Xbox labels until one is)
const ICON_PAD = `<svg viewBox="0 0 48 30" width="38" fill="none" stroke="#888" stroke-width="1.6">
  <rect x="2" y="4" width="44" height="22" rx="11" fill="#ffffff08"/>
  <path d="M12 10v12M6 16h12"/><circle cx="34" cy="11" r="1.8" fill="#888"/><circle cx="40" cy="16" r="1.8" fill="#888"/><circle cx="34" cy="21" r="1.8" fill="#888"/><circle cx="28" cy="16" r="1.8" fill="#888"/></svg>`;
const ICON_KEY = `<svg viewBox="0 0 48 30" width="38" fill="none" stroke="#888" stroke-width="1.6">
  <rect x="2" y="4" width="44" height="22" rx="4" fill="#ffffff08"/>
  ${[8, 16, 24, 32, 40].map((x) => `<rect x="${x - 2.5}" y="8" width="5" height="5" rx="1"/>`).join('')}
  <rect x="12" y="17" width="24" height="5" rx="1"/></svg>`;

function controlsHtml() {
  const n = (pad.info ?? detectFamily()).names;
  const k = (label, action) => `<span class="ctl"><b class="kchip">${label}</b>${action}</span>`;
  const bumpers = pad.info?.family === 'ps' ? 'L1/R1' : 'LB/RB';
  return `<div class="ctl-groups">
    <div class="ctl-group ${pad.info ? '' : 'dim'}">
      <div class="ctl-head">${ICON_PAD} <span>gamepad${pad.info ? ' · ' + pad.info.family.toUpperCase() : ''}</span></div>
      <div class="controls">
        ${k('◀▲▼▶', 'move')} ${k(n.bottom, 'hold = grab, release = drop')} ${k(n.left, 'play Left')} ${k(n.right, 'play Right')}
        ${k(n.top, 'play Center')} ${k(n.lt, 'target L')} ${k(n.rt, 'target R')} ${k(bumpers, 'volume')}
      </div>
    </div>
    <div class="ctl-group ${keyUsed || !pad.info ? '' : 'dim'}">
      <div class="ctl-head">${ICON_KEY} <span>keyboard</span></div>
      <div class="controls">
        ${k('WASD / ←↑↓→', 'move')} ${k('Space', 'hold = grab, release = drop')} ${k('Esc', 'cancel grab')}
        ${k('J', 'play Left')} ${k('K', 'play Center')} ${k('L', 'play Right')}
        ${k('Q', 'target L')} ${k('E', 'target R')} ${k('- =', 'volume')}
      </div>
    </div>
  </div>`;
}

function renderTitle() {
  const fam = pad.info ? pad.info.family.toUpperCase() : null;
  document.getElementById('debug').innerHTML = `
    <h2>PITCHSORT</h2>
    <p class="meta">Hear the chords. Sort the notes. Left vs Right.</p>
    <p style="margin-top:2em;animation:glow 1.6s ease-in-out infinite">PRESS ANY BUTTON TO START</p>
    <p class="meta">${fam ? fam + ' pad connected ✓' : 'Play with gamepad (Xbox · PlayStation · Switch Pro) or keyboard.'}</p>
    ${controlsHtml()}`;
}
addEventListener('gamepadconnected', () => { if (S.phase === 'title') renderTitle(); });
// held-button auto-repeat: 300ms initial delay, then 90ms steps (pad + keys)
const repeat = { UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0 };
(function loop(t = 0) {
  pad.poll();
  tickRelease(held('A'));
  for (const b of Object.keys(repeat)) {
    if (!held(b)) { repeat[b] = 0; continue; }
    if (!repeat[b]) { repeat[b] = t + 300; continue; } // edge already fired
    if (t >= repeat[b]) { onButton(b); repeat[b] = t + 90; }
  }
  requestAnimationFrame(loop);
})();

// boot last — everything above must be initialized before first render (TDZ)
S.phase = 'title';
renderTitle();
