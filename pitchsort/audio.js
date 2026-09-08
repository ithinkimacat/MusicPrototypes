// audio.js — synth + playback engine. Pure tones, stereo pan per column.
export const ctx = new (window.AudioContext || window.webkitAudioContext)(); // Safari <15 prefix

// StereoPanner missing on old Safari -> plain gain (graceful mono, no crash)
const makePanner = (pan = 0) => {
  const n = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if (n.pan) n.pan.value = pan;
  return n;
};

// master bus: compressor catches chord stacks before they hard-clip (= the clicks)
const comp = ctx.createDynamicsCompressor();
comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 6;
comp.attack.value = 0.003; comp.release.value = 0.25;
export const master = ctx.createGain();
master.connect(comp).connect(ctx.destination);

// volume 0..1, persisted
let vol = Number(localStorage.getItem('ps-vol') ?? 0.9); // getItem safe even where setItem throws
master.gain.value = vol;
export function setVolume(v) {
  vol = Math.round(Math.max(0, Math.min(1, v)) * 20) / 20; // 5% steps
  master.gain.setTargetAtTime(vol, ctx.currentTime, 0.03);
  try { localStorage.setItem('ps-vol', vol); } catch {} // private-mode Safari throws
  return vol;
}
export const getVolume = () => vol;

const PAN = { left: -0.8, center: 0, right: 0.8 };
export const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

export function playNote(midi, { pan = 0, dur = 0.5, wrong = false, sustain = false, delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = wrong ? 'sawtooth' : 'sine';
  osc.frequency.value = midiToFreq(midi);
  if (wrong) osc.detune.value = 40;

  const amp = ctx.createGain();
  const endDur = sustain ? dur * 1.5 : dur;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.22, t + 0.03); // 30ms attack — avoids click at onset
  amp.gain.exponentialRampToValueAtTime(0.001, t + endDur);

  let head = osc;
  if (wrong) {
    const ws = ctx.createWaveShaper();
    ws.curve = distortionCurve(30);
    osc.connect(ws); head = ws;
  }

  const panner = makePanner(pan);
  head.connect(amp).connect(panner).connect(master);
  osc.start(t); osc.stop(t + endDur + 0.05);
}

export function playChord(midis, column, opts = {}) {
  const base = opts.delay ?? 0;
  midis.forEach((m, i) => playNote(m, { ...opts, pan: PAN[column], dur: opts.dur ?? 1.2, delay: base + i * 0.03 }));
}

// captured-note voice: ONE continuous sine (never stopped/restarted while held),
// gain gated by a repeating smooth envelope, scheduled with lookahead so nothing
// ever lands in the past (past-time envelope = instant gain jump = click).
export function startCaptureVoice(midi, pan = 0) {
  const P = 1.5, SWELL = 1.2, N = 48;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = i / (N - 1); curve[i] = 0.25 * Math.sin(Math.PI * Math.min(1, x * 1.1)) ** 1.6; }

  const osc = ctx.createOscillator(); // plain sine — matches normal note timbre
  osc.frequency.value = midiToFreq(midi);
  const gate = ctx.createGain(); gate.gain.value = 0;
  const panner = makePanner(pan);
  const echo = ctx.createDelay(); echo.delayTime.value = 0.35;
  const fb = ctx.createGain(); fb.gain.value = 0.25;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  echo.connect(fb).connect(echo);
  osc.connect(gate).connect(panner);
  panner.connect(master);
  panner.connect(echo); echo.connect(wet).connect(master);
  osc.start();

  let nextT = ctx.currentTime + 0.05;
  gate.gain.setValueCurveAtTime(curve, nextT, SWELL); nextT += P;
  const iv = setInterval(() => { // schedule 0.4s ahead, no matter when the timer fires
    while (nextT < ctx.currentTime + 0.4) {
      gate.gain.setValueCurveAtTime(curve, nextT, SWELL);
      nextT += P;
    }
  }, 150);

  let dead = false;
  return {
    setPan(v) { if (panner.pan) panner.pan.setTargetAtTime(v, ctx.currentTime, 0.08); }, // exponential glide, no ramp conflicts
    stop() {
      if (dead) return; dead = true;
      clearInterval(iv);
      const t = ctx.currentTime;
      gate.gain.cancelScheduledValues(t);
      gate.gain.setTargetAtTime(0, t, 0.08); // smooth close, no cut
      wet.gain.setTargetAtTime(0, t, 0.08);
      osc.stop(t + 1);
      setTimeout(() => { [osc, gate, panner, echo, fb, wet].forEach((n) => n.disconnect()); }, 1500);
    },
  };
}

function distortionCurve(k) {
  const n = 256, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
  return c;
}
