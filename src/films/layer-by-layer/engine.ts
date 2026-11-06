/**
 * The projector. Owns the renderer, the post chain, the playhead and which
 * layers are alive. Every frame is rendered from `t` alone, so seeking is just
 * setting `t`.
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
  createShot,
  defaultShot,
  type FrameContext,
  type Hud,
  type Layer,
  type LayerFactory,
  type Quality,
  type Shot,
} from './core'
import { clamp, easeInCubic, easeOutCubic, invLerp, smoothstep, wobble } from './math'
import { createFilmPass } from './post'
import { Score } from './audio'
import { CAPTIONS, DURATION, IMPACTS, KICK, KICK_BEATS, LAYERS, TRANSITIONS, layerAt } from './timeline'
import { loadFonts } from './textures'
import { createPageLayer } from './layers/page'
import { createRepoLayer } from './layers/repo'
import { createVisitorLayer } from './layers/visitor'
import { createDreamLayer } from './layers/dream'
import { createAttentionLayer } from './layers/attention'

const FACTORIES: LayerFactory[] = [
  createPageLayer,
  createRepoLayer,
  createVisitorLayer,
  createDreamLayer,
  createAttentionLayer,
]

/** Build the next layer this long before it's needed, so its shaders compile off the beat. */
const PREROLL = 3.5

export interface HudElements {
  counter: HTMLElement
  counterName: HTMLElement
  caption: HTMLElement
  decode: HTMLElement
  sympathy: HTMLElement
  sympathyValue: HTMLElement
  kickNext: HTMLElement
  kickSoon: HTMLElement
  progress: HTMLElement
  time: HTMLElement
  scrub: HTMLElement
}

export interface FilmState {
  playing: boolean
  ended: boolean
  showReplay: boolean
}

export function supportsWebGL2() {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    const ok = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return ok
  } catch {
    return false
  }
}

const fmt = (s: number) => {
  const v = Math.max(0, Math.floor(s))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

const SCRAMBLE = '01<>/[]{}#_=+'

export class Film {
  readonly duration = DURATION
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private renderPass: RenderPass
  private bloom: UnrealBloomPass
  private filmPass: ReturnType<typeof createFilmPass>
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 600)
  private emptyScene = new THREE.Scene()
  private layers: (Layer | null)[] = LAYERS.map(() => null)
  private shot = createShot()
  private hudData: Hud = { sympathy: null, sympathyAt: new THREE.Vector3(), decode: null }
  private frameCtx: FrameContext
  private quality: Quality
  private reducedMotion: boolean
  private score = new Score()

  private t = 0
  private playing = false
  private ended = false
  private dirty = true
  private raf = 0
  private last = 0
  private disposed = false
  private ready = false
  private width = 1
  private height = 1
  private pixelRatio: number
  private perfSamples: number[] = []
  private blackDrawn = false
  private hudCache = new Map<string, string>()
  private resizeObserver: ResizeObserver
  private lastState: FilmState = { playing: false, ended: false, showReplay: false }
  private tmp = new THREE.Vector3()
  private veilRGB = new THREE.Vector3()

  constructor(
    private container: HTMLElement,
    private hud: HudElements,
    private onState: (s: FilmState) => void,
    private onContextLost: () => void,
  ) {
    const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency ?? 8) <= 4
    this.quality = { small, density: small ? 0.45 : 1, shadowSize: small ? 1024 : 2048 }
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.setClearColor(0x000000, 1)
    const canvas = this.renderer.domElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    container.appendChild(canvas)

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 0 : 4 })
    this.composer = new EffectComposer(this.renderer, rt)
    this.renderPass = new RenderPass(this.emptyScene, this.camera)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.45, 0.85)
    this.filmPass = createFilmPass(small)
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.filmPass)

    this.frameCtx = {
      aspect: 1,
      tanHalf: (fov) => Math.tan(THREE.MathUtils.degToRad(this.effectiveFov(fov)) / 2),
      pixelHeight: 1,
      hud: this.hudData,
    }

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    document.addEventListener('visibilitychange', this.handleVisibility)
  }

  /** Load fonts and build the first layer. Resolves when ENTER can be shown. */
  async init() {
    await loadFonts()
    if (this.disposed) return
    this.manageLayers(0)
    this.ready = true
    this.dirty = true
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  /** Called from the ENTER tap: starts sound (needs a user gesture) and playback. */
  start() {
    this.score.start()
    this.seek(0)
    this.play()
  }

  play() {
    if (this.t >= DURATION) this.seek(0)
    this.playing = true
    this.ended = false
    this.last = performance.now()
    this.emit()
  }

  pause() {
    this.playing = false
    this.emit()
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  get isPlaying() {
    return this.playing
  }

  get time() {
    return this.t
  }

  seek(t: number) {
    this.t = clamp(t, 0, DURATION)
    if (this.t < DURATION) this.ended = false
    this.dirty = true
    this.emit()
  }

  setMuted(muted: boolean) {
    this.score.setMuted(muted)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    this.score.dispose()
    this.layers.forEach((l, i) => {
      l?.dispose()
      this.layers[i] = null
    })
    this.bloom.dispose()
    this.filmPass.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private handleContextLost = (e: Event) => {
    e.preventDefault()
    this.pause()
    this.onContextLost()
  }

  private handleVisibility = () => {
    if (document.hidden && this.playing) this.pause()
  }

  private emit() {
    const s: FilmState = {
      playing: this.playing,
      ended: this.ended,
      showReplay: this.t >= KICK_BEATS.replay,
    }
    const l = this.lastState
    if (s.playing !== l.playing || s.ended !== l.ended || s.showReplay !== l.showReplay) {
      this.lastState = s
      this.onState(s)
    }
  }

  /** Portrait frames get a wider lens so compositions still breathe. */
  private effectiveFov(fov: number) {
    const aspect = this.width / this.height
    if (aspect >= 1) return fov
    const tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * Math.pow(1 / aspect, 0.42)
    return THREE.MathUtils.radToDeg(2 * Math.atan(tan))
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.width = w
    this.height = h
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(w, h)
    this.composer.setPixelRatio(this.pixelRatio)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.filmPass.uniforms.uResolution!.value.set(w * this.pixelRatio, h * this.pixelRatio)
    this.frameCtx.aspect = w / h
    this.frameCtx.pixelHeight = h * this.pixelRatio
    this.dirty = true
  }

  private frame = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000))
    this.last = now
    if (this.playing) {
      this.t += dt
      if (this.t >= DURATION) {
        this.t = DURATION
        this.playing = false
        this.ended = true
      }
      this.dirty = true
      this.emit()
    }
    this.score.update(this.t, this.playing)
    if (!this.dirty || !this.ready) return
    this.dirty = false
    this.renderAt(this.t)
    if (this.playing) this.adaptQuality(dt)
  }

  /** If the device can't keep up, drop resolution a notch. Never goes back up mid-film. */
  private adaptQuality(dt: number) {
    if (dt > 0.08) return // a hitch (layer build, tab switch) isn't a trend
    this.perfSamples.push(dt)
    if (this.perfSamples.length < 90) return
    const avg = this.perfSamples.reduce((a, b) => a + b, 0) / this.perfSamples.length
    this.perfSamples = []
    if (avg > 0.027 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25)
      this.resize()
    }
  }

  private manageLayers(t: number) {
    LAYERS.forEach((w, i) => {
      const wanted = t < KICK && t >= w.start - PREROLL && t < w.end + 0.25
      const layer = this.layers[i]
      if (wanted && !layer) {
        const built = FACTORIES[i]!({
          renderer: this.renderer,
          quality: this.quality,
          reducedMotion: this.reducedMotion,
        })
        this.layers[i] = built
        // Compile against the composer's target so the programs match what's used.
        this.renderer.setRenderTarget(this.composer.readBuffer)
        this.renderer.compile(built.scene, this.camera)
        this.renderer.setRenderTarget(null)
      } else if (!wanted && layer) {
        layer.dispose()
        this.layers[i] = null
      }
    })
  }

  private renderAt(t: number) {
    this.manageLayers(t)
    const hud = this.hudData
    hud.sympathy = null
    hud.decode = null

    if (t >= KICK) {
      if (!this.blackDrawn) {
        this.renderer.setRenderTarget(null)
        this.renderer.clear()
        this.blackDrawn = true
      }
      this.updateHud(t)
      return
    }
    this.blackDrawn = false

    const w = layerAt(t)
    const layer = this.layers[w.index]
    if (!layer) return
    const shot = this.shot
    defaultShot(shot)
    layer.update(t - w.start, shot, this.frameCtx)

    // Transition veil: out of one layer into a colour, out of that colour into the next.
    let veil = 0
    let zoomBoost = 0
    const veilColor = this.veilRGB.set(0, 0, 0)
    for (const tr of TRANSITIONS) {
      if (t >= tr.at - tr.out && t < tr.at) {
        const v = easeInCubic(invLerp(tr.at - tr.out, tr.at, t))
        if (v > veil) {
          veil = v
          veilColor.set(...tr.color)
        }
        zoomBoost = Math.max(zoomBoost, v * 0.5)
      } else if (t >= tr.at && t < tr.at + tr.in) {
        const v = 1 - easeOutCubic(invLerp(tr.at, tr.at + tr.in, t))
        if (v > veil) {
          veil = v
          veilColor.set(...tr.color)
        }
        zoomBoost = Math.max(zoomBoost, v * 0.5)
      }
    }
    const opening = 1 - smoothstep(0.2, 2.4, t)
    if (opening > veil) {
      veil = opening
      veilColor.set(0, 0, 0)
    }
    if (shot.veil > veil) {
      veil = shot.veil
      veilColor.set(shot.veilColor.r, shot.veilColor.g, shot.veilColor.b)
    }

    this.applyCamera(t, shot)

    const u = this.filmPass.uniforms
    u.uTime!.value = t
    u.uVeil!.value = veil
    u.uVeilColor!.value.setRGB(veilColor.x, veilColor.y, veilColor.z)
    const zoom = clamp(shot.zoom + zoomBoost)
    u.uZoom!.value = this.reducedMotion ? zoom * 0.4 : zoom
    u.uDefocus!.value = clamp(shot.defocus)
    u.uCA!.value = shot.ca
    u.uVignette!.value = shot.vignette
    u.uGrain!.value = shot.grain
    this.bloom.strength = shot.bloomStrength
    this.bloom.radius = shot.bloomRadius
    this.bloom.threshold = shot.bloomThreshold
    this.renderer.toneMappingExposure = shot.exposure

    this.renderPass.scene = layer.scene
    this.composer.render()
    this.updateHud(t)
  }

  private applyCamera(t: number, shot: Shot) {
    const cam = this.camera
    const dist = Math.max(0.01, shot.pos.distanceTo(shot.target))
    const calm = this.reducedMotion ? 0.3 : 1

    // Handheld: a slow, breathing drift proportional to how far away the subject is.
    const hh = shot.handheld * calm
    const drift = dist * 0.01 * hh
    cam.position.set(
      shot.pos.x + wobble(t * 0.5, 1) * drift,
      shot.pos.y + wobble(t * 0.43, 2) * drift,
      shot.pos.z + wobble(t * 0.37, 3) * drift,
    )
    const look = this.tmp.set(
      shot.target.x + wobble(t * 0.31, 4) * drift * 0.7,
      shot.target.y + wobble(t * 0.29, 5) * drift * 0.7,
      shot.target.z + wobble(t * 0.33, 6) * drift * 0.7,
    )

    // Impact shake: violent, then gone.
    let roll = shot.roll + wobble(t * 0.27, 7) * 0.004 * hh
    for (const im of IMPACTS) {
      const since = t - im.t
      if (since < 0 || since > 2.5) continue
      const k = im.amp * Math.exp(-since * im.decay) * (this.reducedMotion ? 0.12 : 1)
      const s = dist * 0.035 * k
      cam.position.x += wobble(t * im.freq, 11) * s
      cam.position.y += wobble(t * im.freq, 12) * s
      cam.position.z += wobble(t * im.freq, 13) * s * 0.5
      roll += wobble(t * im.freq, 14) * 0.03 * k
    }
    cam.up.set(0, 1, 0)
    cam.lookAt(look)
    cam.rotateZ(roll)
    cam.fov = this.effectiveFov(shot.fov)
    cam.near = shot.near
    cam.far = shot.far
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
  }

  private set(key: string, value: string, apply: (v: string) => void) {
    if (this.hudCache.get(key) === value) return
    this.hudCache.set(key, value)
    apply(value)
  }

  private updateHud(t: number) {
    const h = this.hud
    const w = layerAt(t)
    this.set('counter', `LAYER ${w.index}`, (v) => (h.counter.textContent = v))
    this.set('counterName', w.name, (v) => (h.counterName.textContent = v))

    // Captions decode in, like something being retrieved.
    let cap = ''
    let capOpacity = 0
    for (const c of CAPTIONS) {
      if (t < c.start || t > c.end) continue
      const age = t - c.start
      const revealed = Math.floor(age * 34)
      const frameSeed = Math.floor(t * 30)
      let out = ''
      for (let i = 0; i < c.text.length; i++) {
        const ch = c.text[i]!
        if (i < revealed || ch === ' ') out += ch
        else if (i < revealed + 5) out += SCRAMBLE[(i * 7 + frameSeed * 13) % SCRAMBLE.length]
        else out += ' '
      }
      cap = out
      capOpacity = smoothstep(c.start, c.start + 0.25, t) * (1 - smoothstep(c.end - 0.6, c.end, t))
    }
    this.set('caption', cap, (v) => (h.caption.textContent = v))
    this.set('captionO', capOpacity.toFixed(3), (v) => (h.caption.style.opacity = v))

    const decode = this.hudData.decode ?? ''
    this.set('decode', decode, (v) => (h.decode.textContent = v))
    this.set('decodeO', decode ? '1' : '0', (v) => (h.decode.style.opacity = v))

    // Sympathy readout rides alongside the visitor.
    const sym = this.hudData.sympathy
    if (sym !== null && t < KICK) {
      const p = this.tmp.copy(this.hudData.sympathyAt).project(this.camera)
      const onScreen = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2
      const x = clamp((p.x * 0.5 + 0.5) * this.width, 16, this.width - 150)
      const y = clamp((-p.y * 0.5 + 0.5) * this.height, 64, this.height - 140)
      h.sympathy.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      this.set('symO', onScreen ? '1' : '0', (v) => (h.sympathy.style.opacity = v))
      const pct = Math.round(sym * 100)
      this.set('symV', `${pct}%`, (v) => (h.sympathyValue.textContent = v))
      this.set('symP', (pct / 100).toFixed(2), (v) => h.sympathy.style.setProperty('--lbl-p', v))
    } else {
      this.set('symO', '0', (v) => (h.sympathy.style.opacity = v))
    }

    // The kick.
    const next = t >= KICK_BEATS.nextLayer ? 1 : 0
    this.set('kickNext', String(next), (v) => (h.kickNext.style.opacity = v))
    let soon = 0
    if (t >= KICK_BEATS.comingSoon) {
      // A sign that hasn't quite decided to be on.
      const f = Math.floor((t - KICK_BEATS.comingSoon) * 18)
      const n = Math.sin(f * 12.9898) * 43758.5453
      const r = n - Math.floor(n)
      const settled = t - KICK_BEATS.comingSoon > 1.6
      soon = settled ? (r < 0.08 ? 0.35 : 1) : r < 0.45 ? 0.1 : 1
    }
    this.set('kickSoon', soon.toFixed(2), (v) => (h.kickSoon.style.opacity = v))

    const frac = t / DURATION
    this.set('progress', frac.toFixed(4), (v) => (h.progress.style.transform = `scaleX(${v})`))
    this.set('time', `${fmt(t)} / ${fmt(DURATION)}`, (v) => (h.time.textContent = v))
    this.set('aria', String(Math.floor(t)), (v) => {
      h.scrub.setAttribute('aria-valuenow', v)
      h.scrub.setAttribute('aria-valuetext', `${fmt(Number(v))} of ${fmt(DURATION)}, layer ${w.index}`)
    })
    this.emit()
  }
}
