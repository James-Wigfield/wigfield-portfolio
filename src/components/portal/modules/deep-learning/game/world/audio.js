/* ============================================================================
   AUDIO — footsteps, sea, chimes, all synthesised, no files
   ----------------------------------------------------------------------------
   WebAudio built on first user gesture (autoplay policy). Zero payload, so
   nothing to lazy-load; the mute flag persists per browser.
   ========================================================================== */

const MUTE_KEY = 'dlg:muted';

class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sea = null;
    this.muted = false;
    try {
      this.muted = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* fine */
    }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  /* One footfall on stone: a short filtered noise burst with a soft knock. */
  footstep(hard = false) {
    if (!this.ensure()) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const len = 0.09;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hard ? 1400 : 900 + Math.random() * 300;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(hard ? 0.5 : 0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    // the knock
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  /* Scroll found: a small bright chord that decays. */
  chime() {
    if (!this.ensure()) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    [660, 990, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.06);
      g.gain.linearRampToValueAtTime(0.22 / (i + 1), t + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4 + i * 0.2);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.06);
      o.stop(t + 1.8 + i * 0.2);
    });
  }

  /* Door opens: a low stone slide. */
  door() {
    if (!this.ensure()) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const len = 0.9;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.04) * 0.98;
      d[i] = last * 6 * Math.sin((Math.PI * i) / d.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(900, t + len);
    const g = ctx.createGain();
    g.gain.value = 0.55;
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
  }

  /* Wrong answer: a dull knock. */
  thud() {
    if (!this.ensure()) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }

  /* Mechanism tick: a tile lighting, a box sliding one cell. */
  tick(pitch = 520) {
    if (!this.ensure()) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = pitch;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }

  /* The sea: brown noise, low-passed, breathing slowly. Starts once. */
  startSea() {
    if (!this.ensure() || this.sea) return;
    const { ctx } = this;
    const len = 4;
    const buf = ctx.createBuffer(2, ctx.sampleRate * len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995;
        d[i] = last * 3.5;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.07;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.sea = { src, g, lfo };
  }

  /* Distance to the water sets how loud the sea is. */
  setSeaLevel(v) {
    if (!this.sea || !this.ctx) return;
    this.sea.g.gain.setTargetAtTime(0.04 + 0.16 * v, this.ctx.currentTime, 0.4);
  }

  dispose() {
    try {
      this.sea?.src.stop();
      this.sea?.lfo.stop();
      this.ctx?.close();
    } catch {
      /* already gone */
    }
    this.sea = null;
    this.ctx = null;
  }
}

export const audio = new GameAudio();
