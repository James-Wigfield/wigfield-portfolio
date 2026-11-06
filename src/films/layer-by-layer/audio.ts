/**
 * A procedural score in Web Audio: a drone that follows the timeline, plus
 * one-shot hits (typing, the stamp, beats, whooshes) scheduled a few frames
 * ahead of the playhead. No audio files.
 *
 * Like the picture, it's a function of film time: seeking cancels whatever was
 * queued and scheduling resumes from the new position. At the hard cut the
 * master bus drops to zero on the exact sample.
 */

import { DECODE_START, DECODE_STEP, KICK, LAYERS, MESSAGE, STAMP_IMPACT, TRANSITIONS, TYPE_TIMES } from './timeline'
import { clamp, hash1, smoothstep } from './math'

type Hit =
  | { t: number; kind: 'type' }
  | { t: number; kind: 'boom'; gain: number }
  | { t: number; kind: 'kick'; gain: number }
  | { t: number; kind: 'hat'; gain: number }
  | { t: number; kind: 'blip'; freq: number; gain: number }
  | { t: number; kind: 'whoosh'; dur: number; gain: number }
  | { t: number; kind: 'chord'; gain: number }
  | { t: number; kind: 'riser'; dur: number }

function buildHits(): Hit[] {
  const hits: Hit[] = []
  for (const t of TYPE_TIMES) hits.push({ t, kind: 'type' })
  hits.push({ t: STAMP_IMPACT, kind: 'boom', gain: 1 })
  for (const tr of TRANSITIONS) hits.push({ t: tr.at - 1.5, kind: 'whoosh', dur: 2.1, gain: 0.55 })

  const beat = 0.6 // 100 bpm
  // Layer 1: four on the floor, data ticks on the off-beats.
  for (let t = 16.6; t < 30.6; t += beat) {
    hits.push({ t, kind: 'kick', gain: 0.55 })
    hits.push({ t: t + beat / 2, kind: 'hat', gain: 0.16 })
  }
  for (let i = 0; i < 40; i++) {
    const t = 18 + i * 0.15
    if (hash1(i, 3) > 0.45) hits.push({ t, kind: 'blip', freq: 1200 + Math.floor(hash1(i, 9) * 4) * 300, gain: 0.05 })
  }
  // Each decoded letter lands on a note.
  const notes = [440, 523.25, 587.33, 659.25, 783.99]
  let li = 0
  for (const ch of MESSAGE) {
    if (ch === ' ') continue
    hits.push({ t: 16 + DECODE_START + li * DECODE_STEP + 0.5, kind: 'blip', freq: notes[li % notes.length]!, gain: 0.13 })
    li++
  }
  hits.push({ t: 30.65, kind: 'boom', gain: 0.55 })
  // Layer 2: half-time, warmer.
  for (let t = 34.2; t < 49.6; t += beat * 2) {
    hits.push({ t, kind: 'kick', gain: 0.42 })
    hits.push({ t: t + beat, kind: 'hat', gain: 0.08 })
  }
  hits.push({ t: 47.1, kind: 'boom', gain: 0.22 })
  // Layer 3: heartbeat, then the trend.
  for (let t = 52; t < 60.6; t += beat * 2) {
    hits.push({ t, kind: 'kick', gain: 0.38 })
    hits.push({ t: t + 0.22, kind: 'kick', gain: 0.22 })
  }
  hits.push({ t: 58.6, kind: 'riser', dur: 2.4 })
  hits.push({ t: 61.0, kind: 'boom', gain: 0.8 })
  // Layer 4: build into the title.
  for (let t = 69.4; t < 79.4; t += beat) {
    hits.push({ t, kind: 'kick', gain: 0.5 })
    hits.push({ t: t + beat / 2, kind: 'hat', gain: 0.12 })
    if (t > 73) hits.push({ t: t + beat / 4, kind: 'hat', gain: 0.07 })
  }
  hits.push({ t: 76.4, kind: 'riser', dur: 3 })
  hits.push({ t: 79.4, kind: 'chord', gain: 0.32 })
  hits.push({ t: 79.4, kind: 'boom', gain: 0.4 })
  return hits.filter((h) => h.t < KICK).sort((a, b) => a.t - b.t)
}

/** Drone root per layer (Hz) and filter cutoff. */
const DRONE = [
  { root: 55, cutoff: 360, gain: 0.1 },
  { root: 43.65, cutoff: 900, gain: 0.11 },
  { root: 49, cutoff: 640, gain: 0.12 },
  { root: 41.2, cutoff: 520, gain: 0.12 },
  { root: 55, cutoff: 1500, gain: 0.12 },
]

export class Score {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private cut: GainNode | null = null
  private droneGain: GainNode | null = null
  private droneFilter: BiquadFilterNode | null = null
  private oscs: OscillatorNode[] = []
  private noise: AudioBuffer | null = null
  private queued: AudioScheduledSourceNode[] = []
  private hits = buildHits()
  private scheduledUntil = 0
  private wasPlaying = false
  private lastT = 0
  private muted = false

  /** Must be called from a user gesture (iOS will not start audio otherwise). */
  start() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const AC =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    try {
      // On iOS, "playback" lets the film's sound play like a video would.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
      if (session) session.type = 'playback'
    } catch {
      /* not supported — fine */
    }
    const ctx = new AC()
    this.ctx = ctx

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    comp.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.9
    this.master.connect(comp)
    this.cut = ctx.createGain()
    this.cut.connect(this.master)

    const len = ctx.sampleRate
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.Q.value = 2.5
    this.droneGain = ctx.createGain()
    this.droneGain.gain.value = 0
    this.droneFilter.connect(this.droneGain)
    this.droneGain.connect(this.cut)
    const voices: [OscillatorType, number, number][] = [
      ['sawtooth', 1, 0],
      ['sawtooth', 1.5, 4],
      ['triangle', 2, -3],
      ['sine', 0.5, 0],
    ]
    for (const [type, mult, detune] of voices) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = 55 * mult
      o.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = type === 'sine' ? 0.8 : 0.28
      o.connect(g)
      g.connect(this.droneFilter)
      o.start()
      ;(o as OscillatorNode & { mult: number }).mult = mult
      this.oscs.push(o)
    }
    void ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05)
  }

  /** Call every frame with the playhead. */
  update(t: number, playing: boolean) {
    const ctx = this.ctx
    if (!ctx || !this.droneGain || !this.droneFilter || !this.cut) return
    const now = ctx.currentTime
    const jumped = Math.abs(t - this.lastT) > 0.25
    this.lastT = t

    if (!playing || jumped) {
      if (this.wasPlaying || jumped) this.flush()
      this.scheduledUntil = t
    }
    this.wasPlaying = playing

    // The cut gain is 1 everywhere before the kick and 0 after it.
    const cutTarget = t < KICK ? 1 : 0
    if (!playing || jumped) {
      this.cut.gain.cancelScheduledValues(now)
      this.cut.gain.setValueAtTime(cutTarget, now)
    }

    // Drone follows the layer, with a short glide at each boundary.
    let idx = 0
    for (const w of LAYERS) if (t >= w.start) idx = w.index
    const cur = DRONE[idx]!
    const intro = smoothstep(0, 3, t)
    const droneLevel = playing && t < KICK ? cur.gain * intro : 0
    this.droneGain.gain.setTargetAtTime(droneLevel, now, playing ? 0.25 : 0.06)
    const wob = Math.sin(t * 0.7) * 0.18 + 1
    this.droneFilter.frequency.setTargetAtTime(cur.cutoff * wob, now, 0.4)
    for (const o of this.oscs) {
      const mult = (o as OscillatorNode & { mult: number }).mult
      o.frequency.setTargetAtTime(cur.root * mult, now, 0.6)
    }

    if (!playing) return
    const horizon = t + 0.18
    for (const h of this.hits) {
      if (h.t < this.scheduledUntil || h.t >= horizon) continue
      this.play(h, now + Math.max(0, h.t - t))
    }
    if (this.scheduledUntil < KICK && horizon >= KICK) {
      this.cut.gain.setValueAtTime(0, now + Math.max(0, KICK - t))
    }
    this.scheduledUntil = horizon
    this.queued = this.queued.filter((s) => (s as AudioScheduledSourceNode & { endsAt: number }).endsAt > now)
  }

  private flush() {
    for (const s of this.queued) {
      try {
        s.stop()
      } catch {
        /* already stopped */
      }
    }
    this.queued = []
  }

  private track(src: AudioScheduledSourceNode, endsAt: number) {
    const tagged = src as AudioScheduledSourceNode & { endsAt: number }
    tagged.endsAt = endsAt
    this.queued.push(src)
  }

  private noiseSource(at: number, dur: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    src.start(at, Math.random() * 0.5)
    src.stop(at + dur)
    this.track(src, at + dur)
    return src
  }

  private play(h: Hit, at: number) {
    const ctx = this.ctx!
    const out = this.cut!
    switch (h.kind) {
      case 'type': {
        const src = this.noiseSource(at, 0.04)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 2400 + Math.random() * 900
        bp.Q.value = 3
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.5, at)
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.035)
        src.connect(bp).connect(g).connect(out)
        break
      }
      case 'boom': {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.setValueAtTime(90, at)
        o.frequency.exponentialRampToValueAtTime(26, at + 1.1)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(1.1 * h.gain, at + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, at + 1.6)
        o.connect(g).connect(out)
        o.start(at)
        o.stop(at + 1.7)
        this.track(o, at + 1.7)
        const n = this.noiseSource(at, 1.4)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(1800, at)
        lp.frequency.exponentialRampToValueAtTime(120, at + 1.2)
        const ng = ctx.createGain()
        ng.gain.setValueAtTime(0.7 * h.gain, at)
        ng.gain.exponentialRampToValueAtTime(0.001, at + 1.3)
        n.connect(lp).connect(ng).connect(out)
        break
      }
      case 'kick': {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.setValueAtTime(130, at)
        o.frequency.exponentialRampToValueAtTime(42, at + 0.12)
        const g = ctx.createGain()
        g.gain.setValueAtTime(h.gain, at)
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.38)
        o.connect(g).connect(out)
        o.start(at)
        o.stop(at + 0.4)
        this.track(o, at + 0.4)
        break
      }
      case 'hat': {
        const src = this.noiseSource(at, 0.06)
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 7000
        const g = ctx.createGain()
        g.gain.setValueAtTime(h.gain, at)
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
        src.connect(hp).connect(g).connect(out)
        break
      }
      case 'blip': {
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.value = h.freq
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(h.gain, at + 0.005)
        g.gain.exponentialRampToValueAtTime(0.0005, at + 0.22)
        o.connect(g).connect(out)
        o.start(at)
        o.stop(at + 0.25)
        this.track(o, at + 0.25)
        break
      }
      case 'whoosh': {
        const src = this.noiseSource(at, h.dur)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 1.2
        bp.frequency.setValueAtTime(260, at)
        bp.frequency.exponentialRampToValueAtTime(3200, at + h.dur * 0.72)
        bp.frequency.exponentialRampToValueAtTime(500, at + h.dur)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(h.gain, at + h.dur * 0.72)
        g.gain.exponentialRampToValueAtTime(0.001, at + h.dur)
        src.connect(bp).connect(g).connect(out)
        break
      }
      case 'riser': {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(110, at)
        o.frequency.exponentialRampToValueAtTime(880, at + h.dur)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(300, at)
        lp.frequency.exponentialRampToValueAtTime(5000, at + h.dur)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.09, at + h.dur * 0.95)
        g.gain.exponentialRampToValueAtTime(0.0005, at + h.dur + 0.05)
        o.connect(lp).connect(g).connect(out)
        o.start(at)
        o.stop(at + h.dur + 0.1)
        this.track(o, at + h.dur + 0.1)
        break
      }
      case 'chord': {
        // A minor add 9, held until the cut takes it away.
        for (const f of [220, 261.63, 329.63, 493.88, 659.25]) {
          const o = ctx.createOscillator()
          o.type = 'triangle'
          o.frequency.value = f
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, at)
          g.gain.exponentialRampToValueAtTime(h.gain / 5, at + 0.08)
          g.gain.setTargetAtTime(clamp(h.gain / 8), at + 0.6, 1.2)
          o.connect(g).connect(out)
          o.start(at)
          o.stop(at + 4)
          this.track(o, at + 4)
        }
        break
      }
    }
  }

  dispose() {
    this.flush()
    for (const o of this.oscs) {
      try {
        o.stop()
      } catch {
        /* already stopped */
      }
    }
    this.oscs = []
    if (this.ctx) void this.ctx.close()
    this.ctx = null
  }
}
