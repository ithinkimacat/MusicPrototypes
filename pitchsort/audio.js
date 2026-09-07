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
  amp.gain.linearRampToValueAtTime(0.3, t + 0.01);
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

// captured-note voice: SAME sine timbre as a normal note, pulsing every 0.7s —
// envelope gates shut 0.15s before each next beat, echo tail inside the beat.
export function startCaptureVoice(midi, pan = 0) {
  const panner = ctx.createStereoPanner(); panner.pan.value = pan;
  const echo = ctx.createDelay(); echo.delayTime.value = 0.15;
  const fb = ctx.createGain(); fb.gain.value = 0.22;
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  echo.connect(fb).connect(echo);
  echo.connect(wet).connect(ctx.destination);
  panner.connect(ctx.destination);
  panner.connect(echo);

  function beat() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); // plain sine — matches normal note timbre
    o.frequency.value = midiToFreq(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.01);
    g.gain.setValueAtTime(0.3, t + 0.45);
    g.gain.linearRampToValueAtTime(0, t + 0.55); // tight gate before next beat
    o.connect(g).connect(panner);
    o.start(t); o.stop(t + 0.7);
  }
  beat();
  const iv = setInterval(beat, 700);
  return {
    setPan(v) { panner.pan.value = v; },
    stop() { clearInterval(iv); setTimeout(() => { panner.disconnect(); echo.disconnect(); fb.disconnect(); wet.disconnect(); }, 1200); },
  };
}

function distortionCurve(k) {
  const n = 256, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
  return c;
}
