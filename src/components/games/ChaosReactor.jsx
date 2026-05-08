import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import bandGif from '../../assets/gifs/cyber_band.gif';
import './ChaosReactor.css';

// ─── Constants ───────────────────────────────────────────────────────────────
const STEPS = 16;
const BPM_MIN = 60;
const BPM_MAX = 200;

const TRACKS = [
  { id: 'kick',  label: 'KICK',  short: 'KCK', key: '1', color: 'rose'    },
  { id: 'snare', label: 'SNARE', short: 'SNR', key: '2', color: 'amber'   },
  { id: 'clap',  label: 'CLAP',  short: 'CLP', key: '3', color: 'rose'    },
  { id: 'hat',   label: 'HAT',   short: 'HAT', key: '4', color: 'cyan'    },
  { id: 'open',  label: 'OPEN',  short: 'OPN', key: '5', color: 'cyan'    },
  { id: 'bass',  label: 'BASS',  short: 'BAS', key: '6', color: 'violet'  },
  { id: 'lead',  label: 'LEAD',  short: 'LED', key: '7', color: 'emerald' },
  { id: 'fx',    label: 'FX',    short: 'FX',  key: '8', color: 'amber'   },
];

// FL Studio-ish single octave keyboard mapping. C3 starts at Z.
const KEY_TO_MIDI = {
  z: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54, b: 55,
  h: 56, n: 57, j: 58, m: 59,
  ',': 60, l: 61, '.': 62, ';': 63, '/': 64,
  q: 65, w: 67, e: 69, r: 71, t: 72,
};

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const noteName = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ─── Genre presets ───────────────────────────────────────────────────────────
const PRESETS = [
  {
    name: 'TECHNO',
    bpm: 128,
    pattern: {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      open:  [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
      bass:  [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,1,0,0],
      lead:  [0,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,1,0],
      fx:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
    },
    bassNotes: [36,0,0,38, 0,0,36,0, 41,0,0,0, 0,38,0,0],
    leadNotes: [0,0,0,0, 0,0,0,0, 60,0,63,0, 0,0,67,0],
  },
  {
    name: 'TRAP',
    bpm: 140,
    pattern: {
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,1, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,1,1,0, 1,1,1,1, 1,0,1,1, 1,1,1,1],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
      bass:  [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
      lead:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      fx:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
    },
    bassNotes: [33,0,0,0, 0,0,0,36, 33,0,0,0, 0,0,40,0],
    leadNotes: [60,0,0,0, 0,0,63,0, 0,0,0,0, 67,0,0,0],
  },
  {
    name: 'DNB',
    bpm: 174,
    pattern: {
      kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
      hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      open:  [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
      bass:  [1,0,0,1, 0,1,0,0, 1,0,1,0, 0,1,0,0],
      lead:  [0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
      fx:    [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,1],
    },
    bassNotes: [33,0,0,33, 0,38,0,0, 33,0,40,0, 0,38,0,0],
    leadNotes: [0,0,67,0, 0,0,0,0, 70,0,0,0, 0,0,72,0],
  },
  {
    name: 'LO-FI',
    bpm: 80,
    pattern: {
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,1, 1,0,1,0, 1,0,1,1, 1,0,1,0],
      open:  [0,0,1,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
      bass:  [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,1],
      lead:  [1,0,0,0, 0,1,0,0, 1,0,0,0, 0,0,1,0],
      fx:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    },
    bassNotes: [36,0,0,0, 0,0,38,0, 0,40,0,0, 0,0,0,41],
    leadNotes: [60,0,0,0, 0,63,0,0, 65,0,0,0, 0,0,67,0],
  },
  {
    name: 'HOUSE',
    bpm: 124,
    pattern: {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      open:  [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
      bass:  [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,0],
      lead:  [0,0,0,0, 1,0,1,0, 0,0,0,0, 1,0,1,0],
      fx:    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
    },
    bassNotes: [36,0,0,38, 0,40,0,0, 36,0,0,38, 0,40,0,0],
    leadNotes: [0,0,0,0, 67,0,70,0, 0,0,0,0, 72,0,70,0],
  },
  {
    name: 'INDUSTRIAL',
    bpm: 110,
    pattern: {
      kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,1,0],
      clap:  [0,0,0,1, 0,0,1,0, 0,1,0,0, 0,0,0,1],
      hat:   [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,1],
      open:  [0,0,1,0, 0,1,0,0, 1,0,0,1, 0,1,0,0],
      bass:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      lead:  [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
      fx:    [0,0,0,1, 0,0,1,0, 0,0,0,1, 0,0,1,0],
    },
    bassNotes: [33,0,0,34, 0,0,33,0, 36,0,0,33, 0,0,38,0],
    leadNotes: [60,0,0,0, 0,63,0,0, 0,0,67,0, 0,0,0,70],
  },
  {
    name: 'CHAOS',
    bpm: 150,
    pattern: {
      kick:  [1,0,1,0, 1,1,0,1, 1,0,1,0, 0,1,0,1],
      snare: [0,1,0,1, 1,0,0,1, 0,1,0,0, 1,0,1,0],
      clap:  [1,0,0,0, 0,1,0,1, 0,0,1,0, 1,0,0,1],
      hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      open:  [0,1,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,1],
      bass:  [1,1,0,0, 1,0,1,1, 0,1,0,1, 1,0,0,1],
      lead:  [1,0,1,0, 0,1,0,1, 1,0,0,1, 0,1,1,0],
      fx:    [0,0,1,0, 0,1,0,1, 0,0,1,0, 1,0,0,1],
    },
    bassNotes: [33,38,0,0, 36,0,40,33, 0,38,0,33, 36,0,0,41],
    leadNotes: [60,0,67,0, 0,63,0,72, 70,0,0,67, 0,63,72,0],
  },
  {
    name: 'CLEAR',
    bpm: 120,
    pattern: {
      kick:  Array(STEPS).fill(0),
      snare: Array(STEPS).fill(0),
      clap:  Array(STEPS).fill(0),
      hat:   Array(STEPS).fill(0),
      open:  Array(STEPS).fill(0),
      bass:  Array(STEPS).fill(0),
      lead:  Array(STEPS).fill(0),
      fx:    Array(STEPS).fill(0),
    },
    bassNotes: Array(STEPS).fill(0),
    leadNotes: Array(STEPS).fill(0),
  },
];

const clonePreset = (p) => ({
  pattern: Object.fromEntries(Object.entries(p.pattern).map(([k, v]) => [k, [...v]])),
  bassNotes: [...p.bassNotes],
  leadNotes: [...p.leadNotes],
  bpm: p.bpm,
});

// ─── DSP curve helpers ───────────────────────────────────────────────────────
function makeDistortionCurve(amount) {
  const k = amount * 100;
  const samples = 1024;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeCrushCurve(bits) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const step = 2 / Math.pow(2, Math.max(1, bits));
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.round(x / step) * step;
  }
  return curve;
}

function makeImpulse(ctx, duration = 2.5, decay = 2.0) {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

// ─── Voices ──────────────────────────────────────────────────────────────────
function playKick(ctx, time, dest, vol = 1) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(160, time);
  osc.frequency.exponentialRampToValueAtTime(38, time + 0.22);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.34);
  osc.connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + 0.36);

  // Click attack
  const click = ctx.createOscillator();
  const cg = ctx.createGain();
  click.type = 'square';
  click.frequency.value = 1800;
  cg.gain.setValueAtTime(vol * 0.4, time);
  cg.gain.exponentialRampToValueAtTime(0.001, time + 0.012);
  click.connect(cg).connect(dest);
  click.start(time);
  click.stop(time + 0.02);
}

function playSnare(ctx, time, dest, vol = 1) {
  const len = Math.floor(ctx.sampleRate * 0.22);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.65, time);
  ng.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 220;
  const og = ctx.createGain();
  og.gain.setValueAtTime(vol * 0.3, time);
  og.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

  noise.connect(hp).connect(ng).connect(dest);
  osc.connect(og).connect(dest);
  noise.start(time); noise.stop(time + 0.22);
  osc.start(time);   osc.stop(time + 0.14);
}

function playClap(ctx, time, dest, vol = 1) {
  const len = Math.floor(ctx.sampleRate * 0.24);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

  // Multi-tap clap — three quick bursts
  const taps = [0, 0.012, 0.024, 0.048];
  taps.forEach((tap, i) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    const t = time + tap;
    g.gain.setValueAtTime(vol * (i === taps.length - 1 ? 0.55 : 0.35), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (i === taps.length - 1 ? 0.18 : 0.04));
    src.connect(bp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.2);
  });
}

function playHat(ctx, time, dest, vol = 0.18, length = 0.05) {
  const len = Math.floor(ctx.sampleRate * length);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + length);
  src.connect(hp).connect(g).connect(dest);
  src.start(time);
  src.stop(time + length + 0.01);
}

function playOpenHat(ctx, time, dest, vol = 0.32) {
  playHat(ctx, time, dest, vol, 0.32);
}

function playBass(ctx, time, dest, midi = 36, vol = 1) {
  const freq = midiToFreq(midi);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(900, time);
  filt.frequency.exponentialRampToValueAtTime(180, time + 0.25);
  filt.Q.value = 6;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol * 0.45, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

  osc.connect(filt).connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + 0.55);
}

function playLead(ctx, time, dest, midi = 60, vol = 1, dur = 0.45) {
  const freq = midiToFreq(midi);
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc2.type = 'square';
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 1.005; // slight detune

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(3500, time);
  filt.frequency.exponentialRampToValueAtTime(900, time + dur);
  filt.Q.value = 8;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol * 0.3, time + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc1.connect(filt);
  osc2.connect(filt);
  filt.connect(g).connect(dest);
  osc1.start(time); osc1.stop(time + dur + 0.05);
  osc2.start(time); osc2.stop(time + dur + 0.05);
}

function playFX(ctx, time, dest, vol = 1) {
  // Riser/zap — sweeping square through filter
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(2400, time + 0.4);

  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(800, time);
  filt.frequency.exponentialRampToValueAtTime(5000, time + 0.4);
  filt.Q.value = 12;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol * 0.28, time + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

  osc.connect(filt).connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + 0.5);
}

// Synth voice — for live keyboard play
function playSynth(ctx, time, dest, midi, vol = 1, dur = 0.6) {
  const freq = midiToFreq(midi);
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';
  osc3.type = 'square';
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 1.007;
  osc3.frequency.value = freq * 0.5;

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(4000, time);
  filt.frequency.exponentialRampToValueAtTime(1200, time + dur);
  filt.Q.value = 5;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol * 0.32, time + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc1.connect(filt);
  osc2.connect(filt);
  osc3.connect(filt);
  filt.connect(g).connect(dest);
  osc1.start(time); osc1.stop(time + dur + 0.05);
  osc2.start(time); osc2.stop(time + dur + 0.05);
  osc3.start(time); osc3.stop(time + dur + 0.05);
}

// ─── Game shell ──────────────────────────────────────────────────────────────
function Shell({ onLeave, children }) {
  return (
    <div className="game-wrapper">
      <div className="game-banner">
        <img src={bandGif} alt="" aria-hidden="true" className="game-banner-gif cr-banner-gif" />
        <div className="game-banner-overlay" />
        <div className="game-banner-scan" />
        <div className="game-banner-content">
          <p className="cr-logo">// CHAOS REACTOR</p>
          <p className="cr-tagline">FORGE BEATS · BEND SOUND · BREAK PHYSICS</p>
        </div>
        <button className="game-back-btn" onClick={onLeave}>← ARCADE</button>
      </div>
      <div className="game-body cr-body">{children}</div>
    </div>
  );
}

// ─── Visualizer ──────────────────────────────────────────────────────────────
function Visualizer({ analyserRef, energyRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx2d = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.floor(r.width * dpr);
      cv.height = Math.floor(r.height * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    let hue = 0;
    const draw = () => {
      const w = cv.width;
      const h = cv.height;
      const a = analyserRef.current;
      if (!a) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const N = a.frequencyBinCount;
      const data = new Uint8Array(N);
      const wave = new Uint8Array(a.fftSize);
      a.getByteFrequencyData(data);
      a.getByteTimeDomainData(wave);

      // motion-trail background
      ctx2d.fillStyle = 'rgba(2, 8, 23, 0.22)';
      ctx2d.fillRect(0, 0, w, h);

      // Frequency bars (lower half is mirror)
      const useBins = Math.floor(N * 0.7);
      const bw = w / useBins;
      let energy = 0;
      for (let i = 0; i < useBins; i++) {
        const v = data[i] / 255;
        energy += v;
        const bh = v * h * 0.85;
        const x = i * bw;
        const grad = ctx2d.createLinearGradient(0, h, 0, h - bh);
        const localHue = (hue + i * 2.6) % 360;
        grad.addColorStop(0, `hsla(${localHue}, 95%, 60%, 0.95)`);
        grad.addColorStop(1, `hsla(${(localHue + 70) % 360}, 95%, 75%, 0.95)`);
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(x, h - bh, Math.max(bw - 2 * dpr, 1), bh);
        // Mirror
        ctx2d.globalAlpha = 0.18;
        ctx2d.fillRect(x, 0, Math.max(bw - 2 * dpr, 1), bh * 0.4);
        ctx2d.globalAlpha = 1;
      }

      // Waveform overlay
      ctx2d.lineWidth = 2 * dpr;
      ctx2d.strokeStyle = `hsla(${(hue + 200) % 360}, 100%, 80%, 0.9)`;
      ctx2d.beginPath();
      const sliceW = w / wave.length;
      for (let i = 0; i < wave.length; i++) {
        const v = wave[i] / 128.0;
        const y = (v * h) / 2;
        const x = i * sliceW;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.stroke();

      // Energy & hue update
      const norm = energy / useBins;
      energyRef.current = norm;
      hue = (hue + 0.6 + norm * 4) % 360;

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="cr-viz" />;
}

// ─── FX Knob (vertical slider styled as a knob) ──────────────────────────────
function FXKnob({ label, value, min = 0, max = 1, onChange, color = 'cyan', display }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`cr-knob cr-knob--${color}`}>
      <div className="cr-knob-dial">
        <div className="cr-knob-fill" style={{ height: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 200}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
      </div>
      <div className="cr-knob-label">{label}</div>
      <div className="cr-knob-val">{display ? display(value) : value.toFixed(2)}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ChaosReactor() {
  const navigate = useNavigate();

  // ── React state (UI) ──
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(128);
  const [pattern, setPattern] = useState(() => clonePreset(PRESETS[0]).pattern);
  const [bassNotes, setBassNotes] = useState(() => [...PRESETS[0].bassNotes]);
  const [leadNotes, setLeadNotes] = useState(() => [...PRESETS[0].leadNotes]);
  const [presetName, setPresetName] = useState('TECHNO');
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentStep, setCurrentStep] = useState(-1);
  const [trackMute, setTrackMute] = useState(() =>
    Object.fromEntries(TRACKS.map(t => [t.id, false]))
  );
  const [activeKeys, setActiveKeys] = useState(new Set());
  const [activePads, setActivePads] = useState(new Set());

  // FX state
  const [filterFreq, setFilterFreq] = useState(18000);
  const [resonance, setResonance] = useState(1);
  const [drive, setDrive] = useState(0);
  const [crush, setCrush] = useState(16);          // 16 = pristine, lower = crushed
  const [delayMix, setDelayMix] = useState(0);
  const [reverbMix, setReverbMix] = useState(0);
  const [swing, setSwing] = useState(0);

  // ── Refs (audio engine + non-rendering state) ──
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const fxInRef = useRef(null);
  const filterRef = useRef(null);
  const distortRef = useRef(null);
  const crushRef = useRef(null);
  const delayRef = useRef(null);
  const delayFbRef = useRef(null);
  const delayWetRef = useRef(null);
  const reverbRef = useRef(null);
  const reverbWetRef = useRef(null);
  const analyserRef = useRef(null);
  const energyRef = useRef(0);

  const schedulerIdRef = useRef(null);
  const startTimeRef = useRef(0);
  const nextStepRef = useRef(0);
  const nextNoteAtRef = useRef(0);

  const patternRef = useRef(pattern);
  const bassNotesRef = useRef(bassNotes);
  const leadNotesRef = useRef(leadNotes);
  const trackMuteRef = useRef(trackMute);
  const bpmRef = useRef(bpm);
  const swingRef = useRef(swing);
  const playingRef = useRef(false);

  // Mirror refs
  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { bassNotesRef.current = bassNotes; }, [bassNotes]);
  useEffect(() => { leadNotesRef.current = leadNotes; }, [leadNotes]);
  useEffect(() => { trackMuteRef.current = trackMute; }, [trackMute]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { swingRef.current = swing; }, [swing]);

  // Title + cleanup
  useEffect(() => {
    document.title = 'Chaos Reactor';
    return () => { document.title = 'James Wigfield'; };
  }, []);

  // ── Init audio engine on first user gesture ──
  const ensureAudio = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
      return ctxRef.current;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = volume;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 12;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;

    master.connect(comp).connect(analyser).connect(ctx.destination);

    const fxIn = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = resonance;

    const distortion = ctx.createWaveShaper();
    distortion.curve = makeDistortionCurve(drive);
    distortion.oversample = '2x';

    const crusher = ctx.createWaveShaper();
    crusher.curve = makeCrushCurve(crush);

    fxIn.connect(filter);
    filter.connect(distortion);
    distortion.connect(crusher);
    crusher.connect(master);

    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.375;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.42;
    const delayWet = ctx.createGain();
    delayWet.gain.value = delayMix;

    crusher.connect(delay);
    delay.connect(delayFb).connect(delay);
    delay.connect(delayWet).connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.8, 2.4);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = reverbMix;

    crusher.connect(reverb);
    reverb.connect(reverbWet).connect(master);

    ctxRef.current = ctx;
    masterRef.current = master;
    fxInRef.current = fxIn;
    filterRef.current = filter;
    distortRef.current = distortion;
    crushRef.current = crusher;
    delayRef.current = delay;
    delayFbRef.current = delayFb;
    delayWetRef.current = delayWet;
    reverbRef.current = reverb;
    reverbWetRef.current = reverbWet;
    analyserRef.current = analyser;
    return ctx;
  }, [volume, filterFreq, resonance, drive, crush, delayMix, reverbMix]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (schedulerIdRef.current) clearInterval(schedulerIdRef.current);
      const c = ctxRef.current;
      if (c) { try { c.close(); } catch { /* */ } }
    };
  }, []);

  // ── FX parameter updates flow into audio nodes ──
  useEffect(() => {
    if (filterRef.current) {
      filterRef.current.frequency.setTargetAtTime(filterFreq, ctxRef.current.currentTime, 0.02);
    }
  }, [filterFreq]);
  useEffect(() => {
    if (filterRef.current) {
      filterRef.current.Q.setTargetAtTime(resonance, ctxRef.current.currentTime, 0.02);
    }
  }, [resonance]);
  useEffect(() => {
    if (distortRef.current) distortRef.current.curve = makeDistortionCurve(drive);
  }, [drive]);
  useEffect(() => {
    if (crushRef.current) crushRef.current.curve = makeCrushCurve(crush);
  }, [crush]);
  useEffect(() => {
    if (delayWetRef.current) {
      delayWetRef.current.gain.setTargetAtTime(delayMix, ctxRef.current.currentTime, 0.02);
    }
  }, [delayMix]);
  useEffect(() => {
    if (reverbWetRef.current) {
      reverbWetRef.current.gain.setTargetAtTime(reverbMix, ctxRef.current.currentTime, 0.02);
    }
  }, [reverbMix]);
  useEffect(() => {
    if (masterRef.current) {
      masterRef.current.gain.setTargetAtTime(muted ? 0 : volume, ctxRef.current.currentTime, 0.02);
    }
  }, [muted, volume]);

  // ── Step scheduler ──
  const scheduleStep = useCallback((step, time) => {
    const dest = fxInRef.current;
    const ctx = ctxRef.current;
    if (!dest || !ctx) return;
    const p = patternRef.current;
    const m = trackMuteRef.current;
    if (!m.kick  && p.kick[step])  playKick(ctx, time, dest);
    if (!m.snare && p.snare[step]) playSnare(ctx, time, dest);
    if (!m.clap  && p.clap[step])  playClap(ctx, time, dest);
    if (!m.hat   && p.hat[step])   playHat(ctx, time, dest, step % 4 === 0 ? 0.26 : 0.18);
    if (!m.open  && p.open[step])  playOpenHat(ctx, time, dest);
    if (!m.bass  && p.bass[step]) {
      const bn = bassNotesRef.current[step];
      playBass(ctx, time, dest, bn || 36);
    }
    if (!m.lead && p.lead[step]) {
      const ln = leadNotesRef.current[step];
      playLead(ctx, time, dest, ln || 60);
    }
    if (!m.fx && p.fx[step]) playFX(ctx, time, dest);
  }, []);

  const startScheduler = useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    const lookahead = 0.12; // seconds
    const interval = 25;     // ms
    startTimeRef.current = ctx.currentTime + 0.08;
    nextNoteAtRef.current = startTimeRef.current;
    nextStepRef.current = 0;

    const tick = () => {
      const ctxT = ctx.currentTime;
      const horizon = ctxT + lookahead;
      while (nextNoteAtRef.current < horizon) {
        const step = nextStepRef.current;
        const time = nextNoteAtRef.current;
        scheduleStep(step, time);

        // Visual playhead — schedule UI update aligned to audio time
        setTimeout(() => setCurrentStep(step), Math.max(0, (time - ctx.currentTime) * 1000));

        const sixteenth = (60 / bpmRef.current) / 4;
        // Simple swing: shift odd 16ths back
        const sw = swingRef.current * sixteenth * 0.5;
        const next = step % 2 === 1 ? sixteenth - sw : sixteenth + sw;
        nextNoteAtRef.current += Math.max(0.01, next);
        nextStepRef.current = (step + 1) % STEPS;
      }
    };
    schedulerIdRef.current = setInterval(tick, interval);
    playingRef.current = true;
    setPlaying(true);
  }, [ensureAudio, scheduleStep]);

  const stopScheduler = useCallback(() => {
    if (schedulerIdRef.current) {
      clearInterval(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    playingRef.current = false;
    setPlaying(false);
    setCurrentStep(-1);
  }, []);

  const togglePlay = useCallback(() => {
    if (playingRef.current) stopScheduler();
    else startScheduler();
  }, [startScheduler, stopScheduler]);

  // ── Pattern editing ──
  const toggleCell = useCallback((trackId, step) => {
    setPattern(prev => {
      const row = [...prev[trackId]];
      row[step] = row[step] ? 0 : 1;
      return { ...prev, [trackId]: row };
    });
  }, []);

  const toggleTrackMute = useCallback((trackId) => {
    setTrackMute(prev => ({ ...prev, [trackId]: !prev[trackId] }));
  }, []);

  const loadPreset = useCallback((p) => {
    const cloned = clonePreset(p);
    setPattern(cloned.pattern);
    setBassNotes(cloned.bassNotes);
    setLeadNotes(cloned.leadNotes);
    setBpm(cloned.bpm);
    setPresetName(p.name);
  }, []);

  const randomize = useCallback(() => {
    const rand = (p) => Math.random() < p ? 1 : 0;
    const next = {
      kick:  Array.from({ length: STEPS }, (_, i) => i % 4 === 0 ? 1 : rand(0.18)),
      snare: Array.from({ length: STEPS }, (_, i) => (i === 4 || i === 12) ? 1 : rand(0.08)),
      clap:  Array.from({ length: STEPS }, () => rand(0.1)),
      hat:   Array.from({ length: STEPS }, () => rand(0.62)),
      open:  Array.from({ length: STEPS }, () => rand(0.1)),
      bass:  Array.from({ length: STEPS }, () => rand(0.32)),
      lead:  Array.from({ length: STEPS }, () => rand(0.18)),
      fx:    Array.from({ length: STEPS }, () => rand(0.06)),
    };
    const scale = [33, 36, 38, 40, 41, 43, 45]; // C minor-ish
    const leadScale = [60, 63, 65, 67, 70, 72, 75];
    setPattern(next);
    setBassNotes(Array.from({ length: STEPS }, () => scale[Math.floor(Math.random() * scale.length)]));
    setLeadNotes(Array.from({ length: STEPS }, () => leadScale[Math.floor(Math.random() * leadScale.length)]));
    setPresetName('CHAOS·' + Math.floor(Math.random() * 999).toString().padStart(3, '0'));
  }, []);

  const clearAll = useCallback(() => {
    loadPreset(PRESETS[PRESETS.length - 1]);
    setPresetName('EMPTY');
  }, [loadPreset]);

  // ── Live drum pad triggers ──
  const fireDrum = useCallback((trackId) => {
    const ctx = ensureAudio();
    const dest = fxInRef.current;
    if (!ctx || !dest) return;
    const t = ctx.currentTime + 0.005;
    switch (trackId) {
      case 'kick':  playKick(ctx, t, dest); break;
      case 'snare': playSnare(ctx, t, dest); break;
      case 'clap':  playClap(ctx, t, dest); break;
      case 'hat':   playHat(ctx, t, dest, 0.32); break;
      case 'open':  playOpenHat(ctx, t, dest, 0.4); break;
      case 'bass':  playBass(ctx, t, dest, 36); break;
      case 'lead':  playLead(ctx, t, dest, 67); break;
      case 'fx':    playFX(ctx, t, dest); break;
      default: break;
    }
    setActivePads(prev => {
      const s = new Set(prev);
      s.add(trackId);
      return s;
    });
    setTimeout(() => {
      setActivePads(prev => {
        const s = new Set(prev);
        s.delete(trackId);
        return s;
      });
    }, 120);
  }, [ensureAudio]);

  const fireSynth = useCallback((midi) => {
    const ctx = ensureAudio();
    const dest = fxInRef.current;
    if (!ctx || !dest) return;
    playSynth(ctx, ctx.currentTime + 0.005, dest, midi);
  }, [ensureAudio]);

  // ── Keyboard handlers ──
  useEffect(() => {
    const isTextInput = (el) => {
      const tag = el?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable;
    };

    const onDown = (e) => {
      if (isTextInput(e.target)) return;
      const k = e.key.toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (k === 'tab') {
        e.preventDefault();
        randomize();
        return;
      }
      if (k === 'backspace') {
        e.preventDefault();
        clearAll();
        return;
      }
      if (k === 'arrowup' || k === 'arrowdown') {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : 1;
        setBpm(b => Math.max(BPM_MIN, Math.min(BPM_MAX, b + (k === 'arrowup' ? delta : -delta))));
        return;
      }
      if (k === 'arrowleft' || k === 'arrowright') {
        e.preventDefault();
        const factor = k === 'arrowright' ? 1.18 : 1 / 1.18;
        setFilterFreq(f => Math.max(80, Math.min(20000, f * factor)));
        return;
      }

      // Drum pads — number row
      const padIdx = '12345678'.indexOf(k);
      if (padIdx >= 0) {
        e.preventDefault();
        fireDrum(TRACKS[padIdx].id);
        return;
      }

      // Synth keys
      if (KEY_TO_MIDI[k] !== undefined && !e.repeat) {
        e.preventDefault();
        fireSynth(KEY_TO_MIDI[k]);
        setActiveKeys(prev => {
          const s = new Set(prev);
          s.add(k);
          return s;
        });
      }
    };

    const onUp = (e) => {
      const k = e.key.toLowerCase();
      if (KEY_TO_MIDI[k] !== undefined) {
        setActiveKeys(prev => {
          const s = new Set(prev);
          s.delete(k);
          return s;
        });
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [togglePlay, randomize, clearAll, fireDrum, fireSynth]);

  // ── Render ──
  // Synth keyboard layout
  const SYNTH_KEYS = [
    { k: 'z',   midi: 48, type: 'w' },
    { k: 's',   midi: 49, type: 'b' },
    { k: 'x',   midi: 50, type: 'w' },
    { k: 'd',   midi: 51, type: 'b' },
    { k: 'c',   midi: 52, type: 'w' },
    { k: 'v',   midi: 53, type: 'w' },
    { k: 'g',   midi: 54, type: 'b' },
    { k: 'b',   midi: 55, type: 'w' },
    { k: 'h',   midi: 56, type: 'b' },
    { k: 'n',   midi: 57, type: 'w' },
    { k: 'j',   midi: 58, type: 'b' },
    { k: 'm',   midi: 59, type: 'w' },
    { k: ',',   midi: 60, type: 'w' },
    { k: 'l',   midi: 61, type: 'b' },
    { k: '.',   midi: 62, type: 'w' },
    { k: ';',   midi: 63, type: 'b' },
    { k: '/',   midi: 64, type: 'w' },
  ];

  return (
    <Shell onLeave={() => navigate('/games')}>
      <Visualizer analyserRef={analyserRef} energyRef={energyRef} />

      {/* Master transport */}
      <div className="cr-transport">
        <button
          className={`cr-play ${playing ? 'cr-play--on' : ''}`}
          onClick={togglePlay}
        >
          <span className="cr-play-icon">{playing ? '■' : '▶'}</span>
          <span>{playing ? 'STOP' : 'PLAY'}</span>
        </button>

        <div className="cr-bpm">
          <button
            className="cr-bpm-btn"
            onClick={() => setBpm(b => Math.max(BPM_MIN, b - 1))}
            aria-label="BPM down"
          >−</button>
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="cr-bpm-slider"
            aria-label="BPM"
          />
          <button
            className="cr-bpm-btn"
            onClick={() => setBpm(b => Math.min(BPM_MAX, b + 1))}
            aria-label="BPM up"
          >+</button>
          <span className="cr-bpm-readout">{bpm}<small> BPM</small></span>
        </div>

        <button className="cr-tx-btn cr-tx-btn--rose"  onClick={randomize}>⚡ CHAOS</button>
        <button className="cr-tx-btn cr-tx-btn--ghost" onClick={clearAll}>CLEAR</button>
        <button
          className={`cr-tx-btn ${muted ? 'cr-tx-btn--mute' : 'cr-tx-btn--ghost'}`}
          onClick={() => setMuted(m => !m)}
        >{muted ? 'MUTED' : 'MUTE'}</button>
      </div>

      {/* Preset chips */}
      <div className="cr-presets">
        <span className="cr-presets-label">PRESET ·</span>
        {PRESETS.map(p => (
          <button
            key={p.name}
            className={`cr-preset ${presetName === p.name ? 'cr-preset--on' : ''}`}
            onClick={() => loadPreset(p)}
          >{p.name}</button>
        ))}
      </div>

      {/* Sequencer */}
      <div className="cr-seq">
        {/* Step numbers */}
        <div className="cr-seq-row cr-seq-row--head">
          <div className="cr-seq-label" />
          <div className="cr-seq-cells">
            {Array.from({ length: STEPS }).map((_, s) => (
              <div
                key={s}
                className={`cr-seq-stepnum ${currentStep === s ? 'cr-seq-stepnum--on' : ''} ${s % 4 === 0 ? 'cr-seq-stepnum--beat' : ''}`}
              >
                {s + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Track rows */}
        {TRACKS.map(t => (
          <div key={t.id} className={`cr-seq-row cr-seq-row--${t.color}`}>
            <button
              className={`cr-seq-label ${trackMute[t.id] ? 'cr-seq-label--muted' : ''}`}
              onClick={() => toggleTrackMute(t.id)}
              onContextMenu={(e) => { e.preventDefault(); fireDrum(t.id); }}
              title="Click to mute · Right-click to trigger"
            >
              <span className="cr-seq-label-name">{t.short}</span>
              <span className="cr-seq-label-key">[{t.key}]</span>
            </button>
            <div className="cr-seq-cells">
              {pattern[t.id].map((on, s) => (
                <button
                  key={s}
                  className={`cr-cell ${on ? 'cr-cell--on' : ''} ${currentStep === s ? 'cr-cell--play' : ''} ${s % 4 === 0 ? 'cr-cell--beat' : ''}`}
                  onClick={() => toggleCell(t.id, s)}
                  aria-label={`${t.label} step ${s + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pad grid (live triggers) */}
      <div className="cr-pads">
        {TRACKS.map(t => (
          <button
            key={t.id}
            className={`cr-pad cr-pad--${t.color} ${activePads.has(t.id) ? 'cr-pad--hit' : ''}`}
            onMouseDown={() => fireDrum(t.id)}
            onTouchStart={(e) => { e.preventDefault(); fireDrum(t.id); }}
            aria-label={`${t.label} pad`}
          >
            <span className="cr-pad-key">{t.key}</span>
            <span className="cr-pad-name">{t.label}</span>
          </button>
        ))}
      </div>

      {/* FX rack */}
      <div className="cr-fx">
        <FXKnob
          label="FILTER"
          color="cyan"
          value={filterFreq}
          min={80}
          max={20000}
          onChange={setFilterFreq}
          display={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
        />
        <FXKnob
          label="RES"
          color="cyan"
          value={resonance}
          min={0.5}
          max={20}
          onChange={setResonance}
          display={(v) => v.toFixed(1)}
        />
        <FXKnob
          label="DRIVE"
          color="rose"
          value={drive}
          min={0}
          max={1}
          onChange={setDrive}
        />
        <FXKnob
          label="CRUSH"
          color="amber"
          value={crush}
          min={2}
          max={16}
          onChange={setCrush}
          display={(v) => `${v.toFixed(0)}b`}
        />
        <FXKnob
          label="DELAY"
          color="violet"
          value={delayMix}
          min={0}
          max={0.9}
          onChange={setDelayMix}
        />
        <FXKnob
          label="REVERB"
          color="violet"
          value={reverbMix}
          min={0}
          max={0.9}
          onChange={setReverbMix}
        />
        <FXKnob
          label="SWING"
          color="emerald"
          value={swing}
          min={0}
          max={0.7}
          onChange={setSwing}
        />
        <FXKnob
          label="VOL"
          color="emerald"
          value={volume}
          min={0}
          max={1}
          onChange={setVolume}
        />
      </div>

      {/* Synth keyboard */}
      <div className="cr-keyboard">
        <div className="cr-keyboard-label">SYNTH KEYBOARD <span>· play with mouse, touch, or keyboard</span></div>
        <div className="cr-keys">
          {SYNTH_KEYS.map(({ k, midi, type }) => (
            <button
              key={k}
              className={`cr-key cr-key--${type} ${activeKeys.has(k) ? 'cr-key--down' : ''}`}
              onMouseDown={() => fireSynth(midi)}
              onTouchStart={(e) => { e.preventDefault(); fireSynth(midi); }}
            >
              <span className="cr-key-letter">{k.toUpperCase()}</span>
              <span className="cr-key-note">{noteName(midi)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Help */}
      <div className="cr-help">
        <div className="cr-help-row">
          <span><kbd>Space</kbd> play/stop</span>
          <span><kbd>1</kbd>–<kbd>8</kbd> drum pads</span>
          <span><kbd>Z</kbd>–<kbd>/</kbd> synth keyboard</span>
          <span><kbd>Tab</kbd> chaos</span>
          <span><kbd>⌫</kbd> clear</span>
          <span><kbd>↑↓</kbd> BPM</span>
          <span><kbd>←→</kbd> filter sweep</span>
        </div>
      </div>
    </Shell>
  );
}
