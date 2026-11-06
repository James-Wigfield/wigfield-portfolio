import * as THREE from 'three'

/**
 * Canvas-drawn textures. Everything visual in the film is generated here or in
 * a shader: no image files, no remote assets.
 */

// The film self-hosts Anton and Space Mono through Fontsource (see LayerByLayerRoute), so
// they are already registered by the time this chunk loads. These are the
// film's own faces, separate from the app's tokens.
export const DISPLAY = "Anton, Haettenschweiler, 'Arial Narrow', sans-serif"
export const MONO = "'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

export const displayFont = (px: number) => `400 ${px}px ${DISPLAY}`
export const monoFont = (px: number, weight = 400) => `${weight} ${px}px ${MONO}`

/** Canvas text silently falls back to a system face if the webfont isn't decoded yet. */
export async function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return
  const wanted = Promise.all([
    document.fonts.load(displayFont(64)),
    document.fonts.load(monoFont(32)),
    document.fonts.load(monoFont(32, 700)),
  ])
  await Promise.race([wanted, new Promise((resolve) => setTimeout(resolve, 3000))])
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('2D canvas unavailable')
  return { canvas: c, ctx }
}

export function toTexture(c: HTMLCanvasElement, opts: { srgb?: boolean; anisotropy?: number } = {}) {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  tex.anisotropy = opts.anisotropy ?? 4
  tex.needsUpdate = true
  return tex
}

/** Soft round sprite for halos and glows. */
export function glowTexture(size = 128) {
  const { canvas, ctx } = makeCanvas(size, size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return toTexture(canvas, { srgb: false })
}

/** Paint fine noise over a region — paper fibre, cardboard, concrete. */
export function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  let s = seed >>> 0
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0
    const n = ((s >>> 8) / 16777216 - 0.5) * amount
    d[i] = Math.max(0, Math.min(255, d[i]! + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n))
  }
  ctx.putImageData(img, 0, 0)
}
