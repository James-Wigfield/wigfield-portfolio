/**
 * Small, dependency-free helpers shared by every layer.
 *
 * Everything in the film is a pure function of time, so scrubbing can land on
 * any frame and get exactly what playback would have shown. Nothing in here
 * keeps state between calls.
 */

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const invLerp = (a: number, b: number, x: number) => (a === b ? (x >= b ? 1 : 0) : clamp((x - a) / (b - a)))

export function smoothstep(a: number, b: number, x: number) {
  const t = invLerp(a, b, x)
  return t * t * (3 - 2 * t)
}

export const easeInCubic = (t: number) => t * t * t
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeInQuad = (t: number) => t * t
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** Smooth, deterministic wobble in roughly [-1, 1]. Used for handheld drift and shake. */
export function wobble(t: number, seed = 0) {
  return (
    Math.sin(t * 1.31 + seed * 12.9898) * 0.5 +
    Math.sin(t * 2.73 + seed * 78.233 + 1.3) * 0.3 +
    Math.sin(t * 5.17 + seed * 37.719 + 2.1) * 0.2
  )
}

/** Seeded PRNG (mulberry32) so every procedural layout is identical on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer hash → [0, 1). Deterministic per (i, salt). */
export function hash1(i: number, salt = 0) {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export type Key3 = readonly [t: number, x: number, y: number, z: number]

/**
 * Cubic Hermite through time-stamped keys, with finite-difference tangents
 * scaled by each interval so velocity is continuous across keys. The first and
 * last keys have zero velocity, so a move eases in and out like a dolly.
 */
export function track3(t: number, keys: readonly Key3[], out: { set(x: number, y: number, z: number): unknown }) {
  const n = keys.length
  const first = keys[0]!
  const last = keys[n - 1]!
  if (n === 1 || t <= first[0]) return out.set(first[1], first[2], first[3])
  if (t >= last[0]) return out.set(last[1], last[2], last[3])
  let i = 0
  while (i < n - 2 && t > keys[i + 1]![0]) i++
  const k0 = keys[i]!
  const k1 = keys[i + 1]!
  const h = k1[0] - k0[0]
  const s = (t - k0[0]) / h
  const s2 = s * s
  const s3 = s2 * s
  const h00 = 2 * s3 - 3 * s2 + 1
  const h10 = s3 - 2 * s2 + s
  const h01 = -2 * s3 + 3 * s2
  const h11 = s3 - s2
  const tangent = (j: number, axis: 1 | 2 | 3) => {
    if (j <= 0 || j >= n - 1) return 0
    const a = keys[j - 1]!
    const b = keys[j + 1]!
    return (b[axis] - a[axis]) / (b[0] - a[0])
  }
  const v = (axis: 1 | 2 | 3) =>
    h00 * k0[axis] + h10 * h * tangent(i, axis) + h01 * k1[axis] + h11 * h * tangent(i + 1, axis)
  return out.set(v(1), v(2), v(3))
}

/** Scalar version of {@link track3}: keys are [t, value]. */
export function track1(t: number, keys: readonly (readonly [number, number])[]) {
  const n = keys.length
  const first = keys[0]!
  const last = keys[n - 1]!
  if (n === 1 || t <= first[0]) return first[1]
  if (t >= last[0]) return last[1]
  let i = 0
  while (i < n - 2 && t > keys[i + 1]![0]) i++
  const k0 = keys[i]!
  const k1 = keys[i + 1]!
  const h = k1[0] - k0[0]
  const s = (t - k0[0]) / h
  const s2 = s * s
  const s3 = s2 * s
  const tangent = (j: number) => {
    if (j <= 0 || j >= n - 1) return 0
    const a = keys[j - 1]!
    const b = keys[j + 1]!
    return (b[1] - a[1]) / (b[0] - a[0])
  }
  return (
    (2 * s3 - 3 * s2 + 1) * k0[1] +
    (s3 - 2 * s2 + s) * h * tangent(i) +
    (-2 * s3 + 3 * s2) * k1[1] +
    (s3 - s2) * h * tangent(i + 1)
  )
}
