// game.js — state machine + render (debug screen only, mirrors stereo axis).
import { ctx, playNote, playChord, startCaptureVoice, setVolume, getVolume } from './audio.js';
import { Pad, detectFamily } from './input.js';
import { makeLevel, deal, loadCampaign, campaignLength } from './levels.js';

const ORDER = ['L', 'C', 'R'];
const PANFOR = { L: -0.8, C: 0, R: 0.8 };

const S = {
  phase: 'intro', // intro | play | graded
  mode: 'story', // story = curated levels.json (fixed for everyone); free = endless generated 3-4/side
  level: 1,
  cols: { L: [], C: [], R: [] },
  cursor: { col: 'C', row: 0 },
  captured: null, // { midi, srcCol, srcRow }
  targets: null,
  moves: 0,
  t0: 0,
  lastInput: 0, // for the cursor idle-breathe cue
  score: 0,
  streak: 0,
  best: Number(localStorage.getItem('ps-best') ?? 0),
};

function loadLevel(n, sameDeal) {
  // story finished -> roll into endless free play
  if (S.mode === 'story' && !sameDeal && campaignLength() && n > campaignLength()) {
    S.mode = 'free'; n = 1; S.justCompleted = true;
  }
  S.level = n;
  const d = sameDeal ? S.deal : deal(makeLevel(n, S.mode === 'free'));
  S.deal = d;
  S.cols = { L: [], C: [...d.center], R: [] };
  S.targets = { L: d.targetL, R: d.targetR };
  S.tut = d.hint; // tutorial element to highlight this level ('grab' | 'triggers' | 'play')
  S.everCaptured = false; S.everPlaced = false;
  S.optimal = d.center.length; // every note starts center: min = 1 capture+place per note
  S.cursor = { col: 'C', row: 0 };
  S.captured = null; S.moves = 0; S.phase = 'intro'; S.pass = undefined; S.stars = undefined;
  S.streakLost = 0; S.dispScore = undefined;
  render(); // clears win/fade classes → fades in
  playChord(d.targetL, 'left');
  flashCol('L', 0); // always L then R — consistent spatial learning
  playChord(d.targetR, 'right', { delay: 1.4 });
  flashCol('R', 1.4);
  setTimeout(() => { S.phase = 'play'; S.t0 = performance.now(); S.justCompleted = false; render(); }, 2200);
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
  if (S.help) { S.help = false; render(); return; } // any button dismisses the guide
  if (S.phase === 'title') { start(b === 'X'); return; } // X = free play picker on the title
  if (S.phase === 'graded') {
    if (b === 'START') loadLevel(S.pass ? S.level + 1 : S.level, !S.pass);
    return;
  }
  if (S.phase !== 'play') return;
  S.lastInput = performance.now();

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
      pad.rumble(0.25, 0.35, 90);
      S.capVoice = startCaptureVoice(midi, PANFOR[S.cursor.col]);
      S.lastPan = PANFOR[S.cursor.col];
      S.everCaptured = true;
      render();
      break;
    }
    case 'B':
      if (S.captured) {
        S.capVoice.stop(); S.capVoice = null;
        S.cols[S.captured.srcCol].splice(S.captured.srcRow, 0, S.captured.midi);
        S.captured = null; hearCursor(); render();
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
    if (S.cursor.col !== S.captured.srcCol) S.moves++; // grab-and-return isn't a move
    colArr().splice(S.cursor.row, 0, S.captured.midi);
    S.captured = null;
    S.everPlaced = true;
    S.lastInput = performance.now();
    pad.rumble(0.4, 0.3, 110);
    hearCursor(); render();
    if (isPass()) { // auto-win: play feedback, then next level
      S.pass = true; grade();
      setTimeout(() => document.getElementById('debug').classList.add('fade'), 3600);
      setTimeout(() => loadLevel(S.level + 1), 4000); // jingle + L/R chords + merge ≈ 4s
    }
  }
  aHeldPrev = aHeld;
}

// praise escalates with streak tier — keeping the streak alive is the reward
const PRAISE = [
  ['WELL DONE!', 'GOOD JOB!', 'NICE!', 'SWEET HARMONY!'],
  ['GREAT!', 'NAILED IT!', 'PITCH PERFECT!'],
  ["YOU'RE ON FIRE!", 'UNSTOPPABLE!', 'PERFECT SORT!'],
  ['LEGENDARY!', 'GODLIKE!', 'CHORD MASTER!'],
];
const praisePick = () => { const t = S.streak < 3 ? 0 : S.streak < 5 ? 1 : S.streak < 10 ? 2 : 3;
  const p = PRAISE[t]; return p[Math.floor(Math.random() * p.length)]; };

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function confetti(burst = 70) {
  if (REDUCED) return;
  const HUES = [0, 45, 120, 200, 280, 330];
  const n = innerWidth < 700 ? Math.min(burst, 30) : burst; // small screens: fewer particles
  for (let i = 0; i < n; i++) {
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
  el.innerHTML = `<span><b class="btext">${praisePick()}</b><small id="pts">+0 pts</small></span>`;
  const span = el.firstElementChild;
  const ptsEl = document.getElementById('pts');
  // morph anchor: the columns' combined silhouette — message grows out of it, returns to it
  const fr = span.getBoundingClientRect();
  const rr = document.querySelector('.row')?.getBoundingClientRect() ?? fr;
  const dx = rr.left + rr.width / 2 - (fr.left + fr.width / 2);
  const dy = rr.top + rr.height / 2 - (fr.top + fr.height / 2);
  const sx = rr.width / fr.width, sy = rr.height / fr.height;
  if (REDUCED) {
    span.style.opacity = 1;
    countUp(ptsEl, S.pts);
    setTimeout(() => { span.style.opacity = 0; }, 1600);
    return;
  }
  // phase A: panel shape = columns panel, then springs into the message panel
  span.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.9, offset: 0.3 },
    { transform: 'none', opacity: 1 },
  ], { duration: 650, easing: 'cubic-bezier(.2,1.2,.3,1)', fill: 'forwards' });
  // text fades in once the panel has taken shape
  span.querySelectorAll('.btext, small').forEach((t) =>
    t.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 400, delay: 380, easing: 'ease-out', fill: 'both' }));
  setTimeout(() => { if (document.contains(ptsEl)) countUp(ptsEl, S.pts); }, 500);
  // phase B: morph back into the columns just as the stacks merge (2.6s)
  setTimeout(() => span.animate(
    [{ transform: 'none', opacity: 1 },
     { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0 }],
    { duration: 480, easing: 'cubic-bezier(.6,0,.8,.4)', fill: 'forwards' }), 2450);
}

// points tick up 0 -> target over ~550ms (ease-out cubic) — the cheapest satisfaction lever
function countUp(el, target) {
  const t0 = performance.now(), D = 550;
  (function f(t) {
    const p = Math.min(1, (t - t0) / D);
    el.textContent = `+${Math.round(target * (1 - (1 - p) ** 3))} pts`;
    if (p < 1) requestAnimationFrame(f);
  })(t0);
}

// no score — pass/fail only.
// Pass: happy jingle, then player L/R chords. Fail: chords with wrong notes distorted, then clean targets.
function grade() {
  S.phase = 'graded';
  if (S.pass) {
    // stars: perfect efficiency = 3, each extra 25% over optimal costs half a star, floor 1
    const over = (S.moves - S.optimal) / S.optimal;
    S.stars = over <= 0 ? 3 : over <= 0.25 ? 2.5 : over <= 0.5 ? 2 : over <= 0.75 ? 1.5 : 1;
    // streak = proficiency, not attendance: 3★ -> +1 · 2-2.5★ -> hold · 1-1.5★ -> -1
    if (S.stars >= 3) { S.streak++; S.streakPop = true; }
    else if (S.stars <= 1.5) S.streak = Math.max(0, S.streak - 1);
    // score: level base + efficiency bonus, compounding streak multiplier (cap 2x)
    const mult = Math.min(2, 1 + S.streak * 0.1);
    S.pts = Math.round((100 * S.level + 50 * S.stars) * mult);
    S.score += S.pts;
    if (S.score > S.best) { S.best = S.score; try { localStorage.setItem('ps-best', S.best); } catch {} }
    S.dispScore = S.score - S.pts; // counter climbs as chips land
    banner(); winFx();
    const tr = Math.min(S.streak, 7); // jingle climbs a semitone per streak win (cap +7)
    [60, 64, 67, 72].forEach((m, i) => playNote(m + tr, { dur: 0.25, delay: i * 0.13 })); // jingle
    playChord(S.cols.L, 'left', { delay: 0.6 });
    S.cols.L.forEach((m, i) => flashNote(m, 0.6 + i * 0.03));
    playChord(S.cols.R, 'right', { delay: 1.9 });
    S.cols.R.forEach((m, i) => flashNote(m, 1.9 + i * 0.03));
  } else {
    S.streakLost = S.streak >= 2 ? S.streak : 0; // only mourn a streak worth keeping
    S.streak = 0; // failed submit breaks the multiplier
    pad.rumble(0.9, 0.7, 350);
    const playCol = (arr, col, baseDelay) => arr.forEach((m, i) =>
      playNote(m, { pan: PANFOR[col], dur: 1.2, delay: baseDelay + i * 0.1, wrong: !S.targets[col].includes(m) }));
    playCol(S.cols.L, 'L', 0);
    playCol(S.cols.R, 'R', 1.6);
    playChord(S.targets.L, 'left', { delay: 3.4 });
    playChord(S.targets.R, 'right', { delay: 5.0 });
  }
  render();
}

// win payoff, timed to the chord playback in grade():
//   0.6/1.9s — each played note spits a gold chip that flies into the SCORE counter,
//              counter bumps on each landing
//   2.6s     — both stacks fly to center and merge (ghost clones), combined chord + confetti
function winFx() {
  const notesL = S.cols.L, notesR = S.cols.R;
  const n = notesL.length + notesR.length;
  const per = Math.floor(S.pts / n);
  let idx = 0;
  notesL.forEach((m, i) => flyChip(m, 0.6 + i * 0.03, per + (idx++ === 0 ? S.pts - per * n : 0)));
  notesR.forEach((m, i) => flyChip(m, 1.9 + i * 0.03, per + (idx++ === 0 ? S.pts - per * n : 0)));
  setTimeout(combineStacks, 2600);
}

// closing flourish at the merge — soft arpeggio up the level's own notes
function winOutro() {
  const all = [...new Set([...S.cols.L, ...S.cols.R])].sort((a, b) => a - b);
  all.slice(-5).forEach((m, i) => playNote(m, { dur: 0.4, vel: 0.45, sustain: true, delay: i * 0.1 }));
  pad.rumble(1, 0.8, 450);
}

function flyChip(midi, delay, val) {
  setTimeout(() => {
    const noteEl = document.querySelector(`.note[data-midi="${midi}"]`);
    const scoreEl = document.getElementById('scoreval');
    if (!noteEl || !scoreEl) { bumpScore(val); return; }
    if (REDUCED) { bumpScore(val); return; }
    const r = noteEl.getBoundingClientRect(), t = scoreEl.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const c = document.createElement('div');
    c.className = 'pt';
    document.body.appendChild(c);
    c.animate([
      { transform: `translate(${x0 - 7}px, ${y0 - 7}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${x0 - 7}px, ${y0 - 34}px) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${t.left + t.width / 2 - 7}px, ${t.top + t.height / 2 - 7}px) scale(.7)`, opacity: 1 },
    ], { duration: 460, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = () => { bumpScore(val); c.remove(); };
  }, delay * 1000 + 120);
}

function bumpScore(v) {
  S.dispScore += v;
  const s = document.getElementById('scoreval');
  if (!s) return;
  s.textContent = S.dispScore;
  s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
}

function combineStacks() {
  const row = document.querySelector('.row');
  if (!row || S.phase !== 'graded') return;
  const rr = row.getBoundingClientRect();
  const cx = rr.left + rr.width / 2, cy = rr.top + rr.height / 2;
  const notes = document.querySelectorAll('.col[data-col="L"] .note, .col[data-col="R"] .note');
  const total = notes.length;
  let i = 0;
  notes.forEach((noteEl) => {
    if (REDUCED) { noteEl.style.opacity = 0; return; }
    const r = noteEl.getBoundingClientRect();
    const g = noteEl.cloneNode();
    g.className = 'note'; // drop cursor/outline classes from the clone
    g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;z-index:25;animation:none;opacity:1;background:${noteEl.style.background}`;
    document.body.appendChild(g);
    noteEl.style.opacity = 0;
    const ty = cy - (total * r.height) / 2 + i++ * r.height * 0.9;
    const dx = cx - r.left - r.width / 2, dy = ty - r.top;
    g.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.06)`, opacity: 1, offset: 0.72 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.35)`, opacity: 0 },
    ], { duration: 950, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => g.remove();
  });
  row.classList.add('shake'); // merge impact kick
  setTimeout(winOutro, 550); // rising flourish lands as the stacks meet
  setTimeout(() => confetti(80), 640); // visual burst on the merge — no chord here,
  // a full-stack playback right before the new deal would mask the incoming L/R target chords
}

// pitch → hue: blue (low) through green/yellow to red (high)
const midiColor = (m) => `hsl(${240 - ((m - 45) / 31) * 240}, 90%, 55%)`;

let IDLE = false, idleTimer = 0;
function noteHtml(m, k, i) {
  const isCur = S.cursor.col === k && S.cursor.row === i && !S.captured;
  const cls = [
    'note',
    isCur ? 'cursor' : '',
    isCur && IDLE ? 'breathe' : '', // wordless "your move" after 2s idle
    S.captured?.midi === m ? 'captured' : '',
    S.tut === 'grab' && !S.everCaptured && k === 'C' ? 'attract' : '', // L1: note breathes until grabbed
  ].join(' ');
  const style = `background:${midiColor(m)}${k === 'C' && S.phase === 'intro' ? `;--i:${i}` : ''}`;
  return `<span class="${cls}" data-midi="${m}" style="${style}"></span>`;
}

function render() {
  const el = document.getElementById('debug');
  // arcade HUD: SCORE (glowing, left) · LEVEL + moves/stars (mid) · HI-SCORE (gold, right)
  const mult = Math.min(2, 1 + S.streak * 0.1).toFixed(1);
  const midVal = S.phase === 'graded'
    ? (S.pass ? starHtml(S.stars) : '<span class="retry">✗ RETRY — START</span>')
    : `MOVES ${S.moves}/${S.optimal}`;
  const midLbl = S.justCompleted ? 'STORY COMPLETE! · FREE' : `${S.mode === 'free' ? 'FREE' : 'LEVEL'} ${S.level}`;
  // streak as a line under SCORE (GH-style): bar fills toward streak 10, neon by tier
  const tier = S.streak < 3 ? 0 : S.streak < 5 ? 1 : S.streak < 10 ? 2 : 3;
  const streakRow = S.streak >= 1
    ? `<div class="srow"><span class="snum ${S.streakPop ? 'pop' : ''}" style="font-size:${1.1 + Math.min(10, S.streak) * 0.1}em">${S.streak}</span>
       <span class="strack"><span class="sfill" style="display:block;width:${Math.min(1, S.streak / 10) * 100}%"></span></span>
       <span class="smult">×${mult}</span></div>`
    : S.streakLost ? `<div class="srow"><span class="lost">✕ STREAK ${S.streakLost} LOST</span></div>` : '';
  document.getElementById('hud').innerHTML = `
    <div class="hud-cell" data-tier="${S.streak >= 1 ? tier : ''}"><span class="lbl">SCORE</span>
      <span class="val" id="scoreval">${S.dispScore ?? S.score}</span>${streakRow}</div>
    <div class="hud-cell hud-mid"><span class="lbl">${midLbl}</span><span class="val">${midVal}</span></div>
    <div class="hud-cell hud-r"><span class="lbl">HI-SCORE</span><span class="val">${S.best}</span></div>`;
  S.streakPop = false;
  // hot streak (>=8 of 10): embers rise off the streak bar
  if (S.streak >= 8) startEmbers(); else stopEmbers();
  document.getElementById('help').classList.toggle('show', !!S.help);
  // FLIP: snapshot block positions before rebuild, animate deltas after
  const before = {};
  el.querySelectorAll('.note[data-midi]').forEach((n) => { before[n.dataset.midi] = n.getBoundingClientRect(); });

  IDLE = S.phase === 'play' && performance.now() - S.lastInput > 2000;
  const col = (k) => {
    let rows = S.cols[k].map((m, i) => noteHtml(m, k, i));
    if (S.captured && S.cursor.col === k) rows.splice(S.cursor.row, 0, noteHtml(S.captured.midi, k, S.cursor.row));
    const invite = S.tut === 'grab' && S.everCaptured && !S.everPlaced && k !== 'C' ? 'invite' : '';
    return `<div class="col ${S.cursor.col === k ? 'active' : ''} ${invite}" data-col="${k}"><h3>${{ L: 'LEFT', C: 'CENTER', R: 'RIGHT' }[k]}</h3>${rows.join('')}</div>`;
  };
  el.className = S.phase === 'graded' && S.pass ? 'win' : '';
  el.innerHTML = `<div class="row${S.phase === 'intro' ? ' dealt' : ''}">${col('L')}${col('C')}${col('R')}</div>`;
  syncControls();
  clearTimeout(idleTimer);
  if (S.phase === 'play') idleTimer = setTimeout(render, 2100); // picks up the breathe cue

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

// embers off the streak number while it's hot (>=8 of 10); spawned on an interval,
// each particle rises + fades then self-removes
let emberIv = 0;
function startEmbers() {
  if (emberIv || REDUCED) return;
  emberIv = setInterval(() => {
    const n = document.querySelector('#hud .snum');
    if (!n || S.streak < 8) { stopEmbers(); return; }
    const r = n.getBoundingClientRect();
    const e = document.createElement('div');
    e.className = 'ember';
    e.style.left = r.left + Math.random() * r.width + 'px';
    e.style.top = r.bottom - 4 + 'px';
    document.body.appendChild(e);
    const dx = (Math.random() - 0.5) * 30;
    e.animate(
      [{ transform: 'translateY(0) scale(1)', opacity: 0.9 },
       { transform: `translate(${dx}px,-${34 + Math.random() * 26}px) scale(0.2)`, opacity: 0 }],
      { duration: 700 + Math.random() * 400, easing: 'ease-out' }
    ).onfinish = () => e.remove();
  }, S.streak >= 10 ? 90 : 160); // full streak burns denser
}
function stopEmbers() { clearInterval(emberIv); emberIv = 0; }

const campaignP = loadCampaign(); // prefetch while the title screen waits for input
let bootOnce = false;
async function start(free = false) {
  if (S.phase !== 'title' || bootOnce) return;
  bootOnce = true;
  ctx.resume(); // AudioContext stays suspended until a user gesture — gate on any input
  S.mode = free ? 'free' : 'story';
  await campaignP; // story needs the curated list loaded
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
  if (k === 'i') { S.help = !S.help; render(); return; }
  if (k === 'f') { toggleFs(); return; }
  if (S.help) { S.help = false; render(); return; } // any key dismisses the guide
  if (S.phase === 'title') { start(k === 'j' || k === 'x'); return; } // J/X = free play
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
document.getElementById('helpbtn').addEventListener('click', (e) => {
  e.stopPropagation(); S.help = !S.help; render();
});
const toggleFs = () =>
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
document.getElementById('fsbtn').addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
addEventListener('pointerdown', (e) => {
  if (e.target.closest('#helpbtn')) return;
  if (S.help) { S.help = false; render(); return; } // tap outside closes, doesn't start/act
  start();
});

const starHtml = (stars) =>
  [1, 2, 3].map((i) => `<span class="star ${stars >= i ? 'full' : stars >= i - 0.5 ? 'half' : ''}">★</span>`).join('');

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
  const k = (label, action, tutKey) => `<span class="ctl"><b class="kchip ${S.tut === tutKey && S.phase === 'play' ? 'pulse' : ''}">${label}</b>${action}</span>`;
  const bumpers = pad.info?.family === 'ps' ? 'L1/R1' : 'LB/RB';
  const padGroup = `<div class="ctl-group">
    <div class="ctl-head">${ICON_PAD} <span>gamepad${pad.info ? ' · ' + pad.info.family.toUpperCase() : ''}</span></div>
    <div class="controls">
      ${k('◀▲▼▶', 'move')} ${k(n.bottom, 'hold = grab, release = drop', 'grab')} ${k(n.left, 'play Left', 'play')} ${k(n.right, 'play Right', 'play')}
      ${k(n.top, 'play Center', 'play')} ${k(n.lt, 'target L', 'triggers')} ${k(n.rt, 'target R', 'triggers')} ${k(bumpers, 'volume')}
    </div>
  </div>`;
  const keyGroup = `<div class="ctl-group">
    <div class="ctl-head">${ICON_KEY} <span>keyboard</span></div>
    <div class="controls">
      ${k('WASD / ←↑↓→', 'move')} ${k('Space', 'hold = grab, release = drop', 'grab')} ${k('Esc', 'cancel grab')}
      ${k('J', 'play Left', 'play')} ${k('K', 'play Center', 'play')} ${k('L', 'play Right', 'play')}
      ${k('Q', 'target L', 'triggers')} ${k('E', 'target R', 'triggers')} ${k('- =', 'volume')}
    </div>
  </div>`;
  // show only the setup in use: pad wins once connected, keys when keyboard touched and no pad
  const usePad = !!pad.info && !keyUsed;
  return `<div class="ctl-groups ${S.level > 5 ? 'quiet' : ''}">${usePad ? padGroup : keyGroup}</div>`;
}

// controls cheat-sheet lives outside #debug so board rebuilds don't flash it;
// only touched when the html actually changes
let lastCtl = '';
function syncControls() {
  const h = controlsHtml();
  if (h === lastCtl) return;
  lastCtl = h;
  document.getElementById('ctlwrap').innerHTML = h;
}

function renderTitle() {
  const fam = pad.info ? pad.info.family.toUpperCase() : null;
  document.getElementById('debug').innerHTML = `
    <h2>PITCHSORT</h2>
    <p class="meta">Hear the chords. Sort the notes. Left vs Right.</p>
    <p style="margin-top:2em;animation:glow 1.6s ease-in-out infinite">PRESS ANY BUTTON — STORY</p>
    <p class="meta">X&nbsp;=&nbsp;FREE PLAY (endless chords)</p>
    <p class="meta">${fam ? fam + ' pad connected ✓' : 'Play with gamepad (Xbox · PlayStation · Switch Pro) or keyboard.'}</p>`;
  syncControls();
}
addEventListener('gamepadconnected', () => { if (S.phase === 'title') renderTitle(); });
// held-button auto-repeat: 300ms initial delay, then 90ms steps (pad + keys)
const repeat = { UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0 };
let titlePadShown = false;
(function loop(t = 0) {
  pad.poll();
  if (S.phase === 'title' && pad.info && !titlePadShown) { titlePadShown = true; renderTitle(); }
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
