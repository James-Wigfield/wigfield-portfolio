/* ============================================================================
   GRADIENT ARCADE — SOUND (WebAudio synth, zero assets)
   ----------------------------------------------------------------------------
   Tiny synthesised cues, all wrapped in try/catch (no AudioContext, autoplay
   policies, a muted tab: never an error). The context is created lazily on
   the first cue, which always follows a tap or key press. The mute toggle is
   persisted in settings (core/storage.js).

     sfx.hit()      a right answer        sfx.miss()    a wrong one
     sfx.combo(n)   combo milestone       sfx.tick()    the last seconds
     sfx.start()    round begins          sfx.win()     results, good run
     sfx.flat()     results, flat run     sfx.unlock()  something unlocked
     sfx.muted / sfx.setMuted(bool) / sfx.toggle()
   ========================================================================== */
import { getSettings, setSettings } from '../core/storage';

let ctx = null;
let muted = getSettings().muted;

function ac() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

// one note: freq Hz, dur s, after `at` s; gain 0…1; type sine/square/triangle/sawtooth
function note(freq, dur, { at = 0, gain = 0.08, type = 'triangle', slide = null } = {}) {
  try {
    const c = ac();
    if (!c || muted) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {
    /* no sound */
  }
}

export const sfx = {
  get muted() { return muted; },
  setMuted(m) {
    muted = !!m;
    const s = getSettings();
    setSettings({ ...s, muted });
  },
  toggle() { sfx.setMuted(!muted); return muted; },
  hit() { note(660, 0.09, { gain: 0.07 }); note(990, 0.12, { at: 0.07, gain: 0.06 }); },
  miss() { note(180, 0.22, { type: 'sawtooth', gain: 0.05, slide: 110 }); },
  combo(n) {
    const base = 520 + Math.min(n, 10) * 40;
    [0, 1, 2].forEach((i) => note(base * (1 + i * 0.25), 0.08, { at: i * 0.06, gain: 0.06 }));
  },
  tick() { note(1200, 0.03, { type: 'square', gain: 0.025 }); },
  start() { note(330, 0.12, { gain: 0.06 }); note(495, 0.12, { at: 0.11, gain: 0.06 }); note(660, 0.18, { at: 0.22, gain: 0.06 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => note(f, 0.16, { at: i * 0.1, gain: 0.07 })); },
  flat() { note(392, 0.16, { gain: 0.05 }); note(330, 0.26, { at: 0.16, gain: 0.05 }); },
  unlock() { [784, 988, 1175, 1568].forEach((f, i) => note(f, 0.1, { at: i * 0.07, gain: 0.06, type: 'sine' })); },
};
