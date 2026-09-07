// audio.js — synth + playback engine. Pure tones, stereo pan per column.
export const ctx = new AudioContext();

const PAN = { left: -0.8, center: 0, right: 0.8 };
export const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

// captured-note voice: lowpass + 4Hz gain pulse
export function playNote(midi, { pan = 0, dur = 0.5, captured = false, wrong = false, sustain = false, delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = captured || wrong ? 'sawtooth' : 'sine';
  osc.frequency.value = midiToFreq(midi);
  if (wrong) osc.detune.value = 40;

  const amp = ctx.createGain();
  const endDur = sustain ? dur * 1.5 : dur;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.3, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t + endDur);

  let head = osc;
  if (captured) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 800;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(amp.gain);
    lfo.start(t); lfo.stop(t + endDur);
    osc.connect(lp); head = lp;
  }
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
  midis.forEach((m, i) => playNote(m, { ...opts, pan: PAN[column], dur: 1.2, delay: i * 0.03 }));
}

function distortionCurve(k) {
  const n = 256, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
  return c;
}
