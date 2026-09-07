// audio.js — synth + playback engine. Pure tones, stereo pan per column.
export const ctx = new AudioContext();

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
  amp.gain.linearRampToValueAtTime(0.3, t + 0.03); // 30ms attack — avoids click at onset
  amp.gain.exponentialRampToValueAtTime(0.001, t + endDur);

  let head = osc;
  if (wrong) {
    const ws = ctx.createWaveShaper();
    ws.curve = distortionCurve(30);
    osc.connect(ws); head = ws;
  }

  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  head.connect(amp).connect(panner).connect(ctx.destination);
  osc.start(t); osc.stop(t + endDur + 0.05);
}

export function playChord(midis, column, opts = {}) {
  const base = opts.delay ?? 0;
  midis.forEach((m, i) => playNote(m, { ...opts, pan: PAN[column], dur: 1.2, delay: base + i * 0.03 }));
}

// captured-note voice: SAME sine timbre as a normal note, swelling every 1.5s.
// Smooth half-sine-ish envelope (no hard edges), warm echo per beat, graceful stop.
export function startCaptureVoice(midi, pan = 0) {
  const out = ctx.createGain();
  const panner = ctx.createStereoPanner(); panner.pan.value = pan;
  const echo = ctx.createDelay(); echo.delayTime.value = 0.35;
  const fb = ctx.createGain(); fb.gain.value = 0.25;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  echo.connect(fb).connect(echo);
  echo.connect(wet).connect(ctx.destination);
  panner.connect(out).connect(ctx.destination);
  panner.connect(echo);

  // smooth puff: half-sine curve over the beat, 0.3s of true silence between beats
  const P = 1.5, SWELL = 1.2, N = 48;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = i / (N - 1); curve[i] = 0.3 * Math.sin(Math.PI * Math.min(1, x * 1.1)) ** 1.6; }

  function beat() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); // plain sine — matches normal note timbre
    o.frequency.value = midiToFreq(midi);
    const g = ctx.createGain();
    g.gain.setValueCurveAtTime(curve, t, SWELL);
    o.connect(g).connect(panner);
    o.start(t); o.stop(t + P);
  }
  beat();
  const iv = setInterval(beat, P * 1000);
  let dead = false;
  return {
    setPan(v) { panner.pan.linearRampToValueAtTime(v, ctx.currentTime + 0.12); },
    stop() {
      if (dead) return; dead = true;
      clearInterval(iv);
      out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); // fade, don't cut — avoids click
      wet.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => { panner.disconnect(); echo.disconnect(); fb.disconnect(); wet.disconnect(); out.disconnect(); }, 2000);
    },
  };
}

// soft directional riser for column shifts: quick filtered gliss, up = right, down = left
export function playSwoosh(dir) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(dir > 0 ? 500 : 700, t);
  o.frequency.exponentialRampToValueAtTime(dir > 0 ? 900 : 400, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.08, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.2);
}

function distortionCurve(k) {
  const n = 256, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
  return c;
}
