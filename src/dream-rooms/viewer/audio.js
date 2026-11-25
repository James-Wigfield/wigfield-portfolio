/* Dream Rooms · sound (CONTRACTS.md §8). One shared AudioContext for the whole
   session, made or resumed inside a user gesture:

     unlockAudio()              call synchronously in a tap/keydown (the dream page's
                                Enter, or the corridor's first tap)
     startDreamAudio(sound)     world.sound → the bed: { bed, reverb }. Crossfades from
                                whatever was playing. Before the unlock it's remembered
                                and starts on the unlock.
     stop()                     fades the bed (and any voices) out
     startVoice(pos)            a muffled positional murmur (a `voice` figure) → { setPosition, stop }
     setListener(pos, yaw)      the walker's ear, every frame

   The bed: the hum is the 100 Hz family weighted to 200–400 Hz (phone speakers lose
   < 150 Hz), the room tone is pink noise, and everything runs through a ConvolverNode
   with a generated impulse sized by `reverb`. */

let ctx = null;
let unlocked = false;
let pending = null;
let bed = null;
const voices = new Set();
let noiseBuf = null;

const REVERB = {
  dry: { secs: 0.3, wet: 0.05, pre: 0 },
  room: { secs: 1.2, wet: 0.22, pre: 0.01 },
  big: { secs: 2.8, wet: 0.36, pre: 0.025 },
  'too-big': { secs: 6.5, wet: 0.55, pre: 0.045 },
};

function makeContext() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'playback' });
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Inside a user gesture: make/resume the context, play a silent buffer, ask for playback mode. */
export function unlockAudio() {
  const c = makeContext();
  if (!c) return false;
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    /* not settable here */
  }
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
  c.resume?.().catch(() => {});
  unlocked = true;
  if (pending) {
    const s = pending;
    pending = null;
    startDreamAudio(s);
  }
  return true;
}

export const audioUnlocked = () => unlocked;

/** Pink noise (Paul Kellet's filter), 6 s, looped by every noise source. */
function pinkNoise(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const n = Math.floor(c.sampleRate * 6);
  const buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  noiseBuf = buf;
  return buf;
}

function impulse(c, kind) {
  const r = REVERB[kind] || REVERB.room;
  const len = Math.max(1, Math.floor(c.sampleRate * (r.secs + r.pre)));
  const buf = c.createBuffer(2, len, c.sampleRate);
  const pre = Math.floor(c.sampleRate * r.pre);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, kind === 'too-big' ? 1.6 : 2.6);
    }
  }
  return { buf, wet: r.wet };
}

function noiseSource(c) {
  const src = c.createBufferSource();
  src.buffer = pinkNoise(c);
  src.loop = true;
  src.loopStart = Math.random() * 2;
  src.start(0, Math.random() * 5);
  return src;
}

function buildBed(c, sound) {
  const now = c.currentTime;
  const master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  const bus = c.createGain();
  const dry = c.createGain();
  const conv = c.createConvolver();
  const wet = c.createGain();
  const ir = impulse(c, sound.reverb || 'room');
  conv.buffer = ir.buf;
  wet.gain.value = ir.wet;
  dry.gain.value = 1 - ir.wet * 0.5;
  bus.connect(dry).connect(master);
  bus.connect(conv).connect(wet).connect(master);

  const sources = [];
  const kind = sound.bed || 'room-tone';
  // a faint room under every bed but `none`, so nothing is dead silent
  if (kind !== 'none') {
    const n = noiseSource(c);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = kind === 'room-tone' ? 1100 : 700;
    const g = c.createGain();
    g.gain.value = kind === 'room-tone' ? 0.05 : 0.016;
    n.connect(lp).connect(g).connect(bus);
    sources.push(n);
  }
  if (kind === 'hum-100') {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const hum = c.createGain();
    hum.gain.value = 0.07;
    lp.connect(hum).connect(bus);
    [[100, 0.32], [200, 0.5], [300, 0.3], [400, 0.17], [600, 0.05]].forEach(([f, g], i) => {
      const o = c.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i % 2 ? 1 : -1) * 1.5;
      const gn = c.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(lp);
      o.start();
      sources.push(o);
    });
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.17;
    const lg = c.createGain();
    lg.gain.value = 0.012;
    lfo.connect(lg).connect(hum.gain);
    lfo.start();
    sources.push(lfo);
  } else if (kind === 'water') {
    const n = noiseSource(c);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.06;
    n.connect(lp).connect(g).connect(bus);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = c.createGain();
    lg.gain.value = 0.025;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
    sources.push(n, lfo);
  } else if (kind === 'wind') {
    const n = noiseSource(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0.09;
    n.connect(bp).connect(g).connect(bus);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = c.createGain();
    lg.gain.value = 240;
    lfo.connect(lg).connect(bp.frequency);
    lfo.start();
    sources.push(n, lfo);
  }
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(1, now + 2.2);
  return { master, bus, sources };
}

function fadeOut(b, secs = 1.2) {
  if (!b || !ctx) return;
  const now = ctx.currentTime;
  try {
    b.master.gain.cancelScheduledValues(now);
    b.master.gain.setValueAtTime(b.master.gain.value, now);
    b.master.gain.linearRampToValueAtTime(0, now + secs);
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    b.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    try {
      b.master.disconnect();
    } catch {
      /* ignore */
    }
  }, secs * 1000 + 200);
}

/** world.sound → the bed. Remembered until the unlock when there's no running context yet. */
export function startDreamAudio(sound) {
  const s = sound || { bed: 'room-tone', reverb: 'room' };
  if (!unlocked || !ctx) {
    pending = s;
    return;
  }
  ctx.resume?.().catch(() => {});
  const old = bed;
  bed = buildBed(ctx, s);
  fadeOut(old, 1.4);
}

/** Fade everything out. */
export function stop() {
  pending = null;
  const old = bed;
  bed = null;
  fadeOut(old, 1.2);
  for (const v of [...voices]) v.stop();
}

/** The walker's ear: position (metres) and yaw (0 looks along −z). */
export function setListener(pos, yaw) {
  if (!ctx || !unlocked) return;
  const L = ctx.listener;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  try {
    if (L.positionX) {
      L.positionX.value = pos[0];
      L.positionY.value = pos[1];
      L.positionZ.value = pos[2];
      L.forwardX.value = fx;
      L.forwardY.value = 0;
      L.forwardZ.value = fz;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else {
      L.setPosition(pos[0], pos[1], pos[2]);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  } catch {
    /* ignore */
  }
}

/** A muffled murmur from somewhere you can't reach: bandpassed noise, syllable envelopes, an HRTF panner. */
export function startVoice(pos) {
  if (!ctx || !unlocked || !bed) return { setPosition: () => {}, stop: () => {} };
  const c = ctx;
  const n = noiseSource(c);
  const f1 = c.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 330;
  f1.Q.value = 2.2;
  const f2 = c.createBiquadFilter();
  f2.type = 'lowpass';
  f2.frequency.value = 650;
  const env = c.createGain();
  env.gain.value = 0;
  const level = c.createGain();
  level.gain.value = 0.55;
  const pan = c.createPanner();
  pan.panningModel = 'HRTF';
  pan.distanceModel = 'inverse';
  pan.refDistance = 2.5;
  pan.rolloffFactor = 1.1;
  pan.maxDistance = 80;
  n.connect(f1).connect(f2).connect(env).connect(level).connect(pan).connect(bed.bus);
  const setPosition = (p) => {
    try {
      if (pan.positionX) {
        pan.positionX.value = p[0];
        pan.positionY.value = p[1];
        pan.positionZ.value = p[2];
      } else pan.setPosition(p[0], p[1], p[2]);
    } catch {
      /* ignore */
    }
  };
  setPosition(pos);
  // phrases of 3–9 syllables at ~4.5 Hz, then a pause; scheduled a little ahead
  let next = c.currentTime + 1.5;
  const schedule = () => {
    const horizon = c.currentTime + 2.5;
    while (next < horizon) {
      const syl = 3 + Math.floor(Math.random() * 7);
      for (let k = 0; k < syl; k++) {
        const t = next + k * (0.18 + Math.random() * 0.08);
        const peak = 0.5 + Math.random() * 0.5;
        env.gain.setTargetAtTime(peak, t, 0.025);
        env.gain.setTargetAtTime(0.04, t + 0.09, 0.04);
        f1.frequency.setValueAtTime(260 + Math.random() * 160, t);
      }
      next += syl * 0.22 + 1.2 + Math.random() * 3;
    }
  };
  schedule();
  const timer = setInterval(schedule, 900);
  const v = {
    setPosition,
    stop: () => {
      clearInterval(timer);
      voices.delete(v);
      try {
        level.gain.setTargetAtTime(0, c.currentTime, 0.3);
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          n.stop();
          pan.disconnect();
        } catch {
          /* ignore */
        }
      }, 1500);
    },
  };
  voices.add(v);
  return v;
}
