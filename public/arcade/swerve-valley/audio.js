/* ============================================================================
   SWERVE VALLEY — sound
   ----------------------------------------------------------------------------
   Everything is synthesised with WebAudio: no files to load. The tune is a
   bouncy country-ish chiptune loop that gets more wobbly the tipsier YOU are
   (pitch drift and lazier timing), which is the cheapest possible way to make
   a phone feel drunk.
   ========================================================================== */

let ac = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let enabled = true;
let wobble = 0; // 0..1, from my tier
let mode = 'off'; // 'off' | 'lobby' | 'drive' | 'stop' | 'end'
let nextNoteAt = 0;
let step = 0;

let engine = null;

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = enabled ? 0.9 : 0;
  master.connect(ac.destination);
  musicGain = ac.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
  sfxGain = ac.createGain();
  sfxGain.gain.value = 0.5;
  sfxGain.connect(master);
  setInterval(schedule, 50);
}

export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ac.currentTime, 0.05);
}
export function isEnabled() {
  return enabled;
}
export function setWobble(w) {
  wobble = Math.max(0, Math.min(1, w));
}
export function setMusic(m) {
  if (m === mode) return;
  mode = m;
  step = 0;
  if (ac) nextNoteAt = ac.currentTime + 0.08;
}

// ── tune ─────────────────────────────────────────────────────────────────────
// 16-step bars in G major; numbers are semitones from G3 (196 Hz). null = rest.
const MEL_A = [12, null, 16, null, 19, null, 16, 14, 12, null, 11, null, 9, null, 7, null];
const MEL_B = [9, null, 12, null, 16, null, 14, 12, 11, null, 12, 14, 16, null, null, null];
const MEL_C = [19, 21, 19, 16, 14, null, 12, null, 14, null, 16, null, 12, null, null, null];
const MEL_D = [11, null, 14, null, 19, null, 18, 16, 14, null, 11, null, 12, null, null, null];
const BASS = [[0, 7], [5, 12], [2, 9], [0, 7]]; // G C D G — root / fifth
const BARS = [MEL_A, MEL_B, MEL_C, MEL_D];

function freq(semi) {
  return 196 * Math.pow(2, semi / 12);
}

function schedule() {
  if (!ac || mode === 'off' || !enabled) return;
  const bpm = mode === 'drive' ? 132 : mode === 'stop' ? 112 : mode === 'end' ? 120 : 100;
  const stepDur = 60 / bpm / 4;
  while (nextNoteAt < ac.currentTime + 0.2) {
    const bar = Math.floor(step / 16) % 4;
    const i = step % 16;
    // drunk timing: lazy swing on off-beats
    const swing = i % 2 === 1 ? stepDur * (0.12 + wobble * 0.22) : 0;
    const t = nextNoteAt + swing;
    const mel = BARS[bar][i];
    if (mel != null && mode !== 'lobby') note(t, freq(mel), stepDur * 1.6, 'square', 0.5);
    if (mode === 'lobby' && mel != null && i % 4 === 0) note(t, freq(mel), stepDur * 3, 'triangle', 0.55);
    if (i % 4 === 0) note(t, freq(BASS[bar][0] - 12), stepDur * 2.2, 'triangle', 0.9);
    if (i % 4 === 2) note(t, freq(BASS[bar][1] - 12), stepDur * 1.6, 'triangle', 0.7);
    if (mode === 'drive' || mode === 'end') {
      if (i % 2 === 0) hat(t, i % 4 === 0 ? 0.35 : 0.18);
      if (i % 8 === 4) snare(t);
    }
    nextNoteAt += stepDur;
    step++;
  }
}

function note(t, f, dur, type, vol) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (wobble > 0.05) {
    // pitch drifts like a cassette left in the sun
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = 3 + wobble * 2;
    lg.gain.value = f * 0.012 * wobble;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    o.frequency.setValueAtTime(f * (1 + (Math.random() - 0.5) * 0.03 * wobble), t);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(musicGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBuf() {
  if (noiseBuf.b) return noiseBuf.b;
  const b = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf.b = b;
  return b;
}

function noise(t, dur, vol, filt, freqHz, dest) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf();
  const f = ac.createBiquadFilter();
  f.type = filt;
  f.frequency.value = freqHz;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest || sfxGain);
  s.start(t);
  s.stop(t + dur + 0.02);
}

function hat(t, v) {
  noise(t, 0.04, v * 0.5, 'highpass', 7000, musicGain);
}
function snare(t) {
  noise(t, 0.12, 0.4, 'bandpass', 1800, musicGain);
}

function tone(t, f0, f1, dur, type = 'square', vol = 0.5) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(sfxGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ── sound effects ────────────────────────────────────────────────────────────
export function sfx(name) {
  if (!ac || !enabled) return;
  const t = ac.currentTime + 0.005;
  switch (name) {
    case 'tap':
      tone(t, 900, 700, 0.04, 'square', 0.25);
      break;
    case 'ok':
    case 'ding':
      tone(t, 880, 880, 0.08, 'square', 0.3);
      tone(t + 0.08, 1320, 1320, 0.14, 'square', 0.3);
      break;
    case 'fail':
    case 'buzz':
      tone(t, 220, 140, 0.25, 'sawtooth', 0.3);
      break;
    case 'smash':
      noise(t, 0.35, 0.8, 'highpass', 2500);
      tone(t, 1800, 600, 0.12, 'triangle', 0.3);
      break;
    case 'pop':
      tone(t, 300, 1200, 0.06, 'square', 0.35);
      break;
    case 'hic':
      tone(t, 500, 1100, 0.07, 'square', 0.35);
      break;
    case 'whoosh':
    case 'swoosh':
      noise(t, 0.3, 0.35, 'bandpass', 900);
      break;
    case 'cheer':
      for (let i = 0; i < 6; i++) noise(t + i * 0.03, 0.5, 0.15, 'bandpass', 900 + i * 300);
      tone(t, 660, 990, 0.25, 'triangle', 0.15);
      break;
    case 'clink':
      tone(t, 2600, 2500, 0.18, 'sine', 0.35);
      tone(t + 0.07, 3300, 3200, 0.22, 'sine', 0.25);
      break;
    case 'camera':
      noise(t, 0.05, 0.6, 'highpass', 3000);
      noise(t + 0.08, 0.06, 0.5, 'highpass', 2000);
      break;
    case 'snore':
      noise(t, 0.6, 0.35, 'lowpass', 300);
      break;
    case 'alarm':
      for (let i = 0; i < 4; i++) tone(t + i * 0.12, 1400, 1400, 0.06, 'square', 0.3);
      break;
    case 'pour':
      noise(t, 0.25, 0.25, 'bandpass', 600);
      break;
    case 'stomp':
      tone(t, 140, 60, 0.09, 'sine', 0.6);
      noise(t, 0.06, 0.25, 'lowpass', 800);
      break;
    case 'chomp':
      noise(t, 0.05, 0.4, 'bandpass', 1200);
      noise(t + 0.07, 0.05, 0.3, 'bandpass', 1000);
      break;
    case 'drum':
      for (let i = 0; i < 8; i++) noise(t + i * 0.05, 0.05, 0.25 + i * 0.03, 'bandpass', 400);
      break;
    case 'horn':
      tone(t, 392, 392, 0.32, 'sawtooth', 0.25);
      tone(t, 494, 494, 0.32, 'sawtooth', 0.2);
      break;
    case 'boing':
      tone(t, 180, 720, 0.18, 'square', 0.4);
      tone(t + 0.15, 720, 260, 0.2, 'triangle', 0.3);
      break;
    case 'baa':
      tone(t, 420, 380, 0.35, 'sawtooth', 0.25);
      break;
    case 'bonk':
      tone(t, 260, 90, 0.18, 'square', 0.5);
      noise(t, 0.12, 0.4, 'lowpass', 900);
      break;
    case 'gravel':
      noise(t, 0.3, 0.3, 'bandpass', 2400);
      break;
    case 'skid':
      noise(t, 0.4, 0.35, 'bandpass', 3200);
      break;
    case 'keys':
      for (let i = 0; i < 5; i++) tone(t + i * 0.05, 3000 + Math.random() * 900, 2800, 0.05, 'sine', 0.2);
      break;
    case 'fanfare':
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, f, f, 0.2, 'square', 0.3));
      break;
    default:
      tone(t, 600, 600, 0.05, 'square', 0.2);
  }
}

/** A gentle diesel hum while you're driving. v = 0..1 speed. */
export function setEngine(on, v = 0) {
  if (!ac || !enabled) {
    if (engine) {
      engine.g.gain.setTargetAtTime(0, ac?.currentTime || 0, 0.05);
    }
    return;
  }
  if (!engine) {
    const o = ac.createOscillator();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    o.type = 'sawtooth';
    f.type = 'lowpass';
    f.frequency.value = 300;
    g.gain.value = 0;
    o.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    o.start();
    engine = { o, f, g };
  }
  const now = ac.currentTime;
  engine.g.gain.setTargetAtTime(on ? 0.06 : 0, now, 0.1);
  engine.o.frequency.setTargetAtTime(38 + v * 52, now, 0.1);
}

export function haptic(ms) {
  // Chrome logs a warning for vibrate() before the first tap; skip until then.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* not supported */
  }
}
