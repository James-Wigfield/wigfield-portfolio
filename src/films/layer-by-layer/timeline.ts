/**
 * The film's score sheet: every beat, in seconds from the moment ENTER is tapped.
 * Scenes, sound and HUD all read from here so they cannot drift apart.
 */

import { rng } from './math'
import { META } from './meta'

/** Runtime, kick and the layer windows live in meta.ts, so /films and the film agree. */
export const DURATION = META.runtime
/** Hard cut to black. Nothing 3D renders after this. */
export const KICK = META.kick

export interface LayerWindow {
  index: number
  name: string
  start: number
  end: number
}

export const LAYERS: readonly LayerWindow[] = META.chapters.map((c, index) => ({
  index,
  name: c.name,
  start: c.start,
  end: c.end,
}))

export function layerAt(t: number): LayerWindow {
  for (const w of LAYERS) if (t < w.end) return w
  return LAYERS[LAYERS.length - 1]!
}

export const CAPTIONS: readonly { start: number; end: number; text: string }[] = [
  { start: 8.9, end: 13.2, text: 'Everything you say can be retrieved.' },
  { start: 27.0, end: 31.2, text: 'The file structure is the firewall.' },
  { start: 52.6, end: 57.2, text: 'An idea, planted.' },
]

/**
 * Each boundary is a dive: the outgoing camera accelerates into something until
 * the frame is filled with `color` (linear RGB, can exceed 1), and the incoming
 * layer opens out of that same colour.
 */
export const TRANSITIONS: readonly {
  at: number
  out: number
  in: number
  color: readonly [number, number, number]
}[] = [
  { at: 16, out: 0.75, in: 1.2, color: [0.11, 0.004, 0.01] }, // into the red ink
  { at: 33, out: 0.7, in: 1.3, color: [0.02, 0.011, 0.005] }, // through the floor
  { at: 51, out: 0.9, in: 1.4, color: [0.012, 0.006, 0.03] }, // into the dark
  { at: 67, out: 0.8, in: 1.1, color: [1.7, 1.45, 2.1] }, // into the light
]

/** Moments that shake the camera. `amp` 1 is the stamp. */
export const IMPACTS: readonly { t: number; amp: number; decay: number; freq: number }[] = [
  { t: 7.0, amp: 1, decay: 5.2, freq: 31 },
  { t: 30.65, amp: 0.35, decay: 2.2, freq: 22 },
  { t: 47.1, amp: 0.12, decay: 4, freq: 18 },
  { t: 61.0, amp: 0.6, decay: 3.2, freq: 26 },
  { t: 79.4, amp: 0.18, decay: 3, freq: 20 },
]

export const KICK_BEATS = {
  nextLayer: 83.4,
  comingSoon: 87.2,
  replay: 90.2,
}

// ── Layer 0: the title types itself ─────────────────────────────────────────

export const TITLE = 'EQP pilot agreement'
export const TYPE_START = 2.6

/** When each character of the title lands. Human rhythm, but the same every time. */
export const TYPE_TIMES: readonly number[] = (() => {
  const r = rng(7)
  const out: number[] = []
  let t = TYPE_START
  for (let i = 0; i < TITLE.length; i++) {
    out.push(t)
    const ch = TITLE[i]
    t += 0.1 + r() * 0.09 + (ch === ' ' ? 0.12 : 0)
  }
  return out
})()

export const STAMP_IMPACT = 7.0

// ── Layer 1: the message the folders spell ──────────────────────────────────

export const MESSAGE = 'BE NICE TO US'
/** Local time (seconds into Layer 1) the first letter locks in, and the gap between letters. */
export const DECODE_START = 9.1
export const DECODE_STEP = 0.4

// ── Layer 4: the card ───────────────────────────────────────────────────────

export const PAPER_TITLE = 'Opinionated AI'
