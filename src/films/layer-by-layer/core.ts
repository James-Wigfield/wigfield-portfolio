import * as THREE from 'three'

/** Anything with a dispose() — geometries, materials, textures, render targets. */
interface Disposable {
  dispose(): void
}

/**
 * Every GPU resource a layer creates goes in its bag, so moving past the layer
 * frees all of it in one call. `disposeScene` is the safety net for anything
 * attached to the scene graph that was not bagged.
 */
export class Bag {
  private items: Disposable[] = []

  add<T extends Disposable>(item: T): T {
    this.items.push(item)
    return item
  }

  dispose() {
    for (const item of this.items) item.dispose()
    this.items = []
  }
}

export function disposeScene(scene: THREE.Scene) {
  const seen = new Set<unknown>()
  const disposeMaterial = (m: THREE.Material) => {
    if (seen.has(m)) return
    seen.add(m)
    for (const value of Object.values(m)) {
      if (value instanceof THREE.Texture && !seen.has(value)) {
        seen.add(value)
        value.dispose()
      }
    }
    if (m instanceof THREE.ShaderMaterial) {
      for (const u of Object.values(m.uniforms)) {
        const v: unknown = u.value
        if (v instanceof THREE.Texture && !seen.has(v)) {
          seen.add(v)
          v.dispose()
        }
      }
    }
    m.dispose()
  }
  scene.traverse((obj) => {
    const o = obj as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry)
      o.geometry.dispose()
    }
    if (Array.isArray(o.material)) o.material.forEach(disposeMaterial)
    else if (o.material) disposeMaterial(o.material)
    if (obj instanceof THREE.InstancedMesh) obj.dispose()
    if (obj instanceof THREE.Light) {
      const shadow = (obj as THREE.Light & { shadow?: THREE.LightShadow }).shadow
      shadow?.map?.dispose()
    }
  })
  scene.clear()
}

export interface Quality {
  /** Phone-sized viewport or a weak device: fewer particles, smaller shadow maps. */
  small: boolean
  /** Multiplier for particle and instance counts. */
  density: number
  shadowSize: number
}

export interface BuildContext {
  renderer: THREE.WebGLRenderer
  quality: Quality
  reducedMotion: boolean
}

/** What a layer asks of the camera and the post stack for one frame. */
export interface Shot {
  pos: THREE.Vector3
  target: THREE.Vector3
  /** Vertical FOV in degrees, as composed for a landscape frame. Portrait frames are widened by the engine. */
  fov: number
  roll: number
  near: number
  far: number
  /** Multiplier on handheld drift. 0 = locked off. */
  handheld: number
  exposure: number
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  /** 0..1 — a blur that makes the frame feel out of focus, for rack-focus moments. */
  defocus: number
  /** 0..1 — radial zoom blur, for dives. */
  zoom: number
  /** Chromatic aberration amount. */
  ca: number
  vignette: number
  grain: number
  /** A layer's own fade, on top of the engine's transition veil. */
  veil: number
  veilColor: THREE.Color
}

export function defaultShot(shot: Shot) {
  shot.pos.set(0, 0, 10)
  shot.target.set(0, 0, 0)
  shot.fov = 45
  shot.roll = 0
  shot.near = 0.05
  shot.far = 600
  shot.handheld = 1
  shot.exposure = 1
  shot.bloomStrength = 0.5
  shot.bloomRadius = 0.45
  shot.bloomThreshold = 0.85
  shot.defocus = 0
  shot.zoom = 0
  shot.ca = 0.0015
  shot.vignette = 0.45
  shot.grain = 0.05
  shot.veil = 0
  shot.veilColor.setRGB(0, 0, 0)
}

export function createShot(): Shot {
  const shot = {
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    veilColor: new THREE.Color(),
  } as Shot
  defaultShot(shot)
  return shot
}

/** Readouts a layer can put on screen. World positions are projected by the engine. */
export interface Hud {
  sympathy: number | null
  sympathyAt: THREE.Vector3
  decode: string | null
}

export interface FrameContext {
  /** Viewport width / height. */
  aspect: number
  /** tan(vFov / 2) for a given composed FOV, after the engine's portrait widening. */
  tanHalf(fovDeg: number): number
  /** Drawing-buffer height in pixels, for sizing points in world units. */
  pixelHeight: number
  hud: Hud
}

export interface Layer {
  scene: THREE.Scene
  /** `t` is seconds since this layer's window opened. Must be a pure function of `t`. */
  update(t: number, shot: Shot, frame: FrameContext): void
  dispose(): void
}

export type LayerFactory = (ctx: BuildContext) => Layer

/** A private copy of three's fog uniforms — UniformsLib's are shared module-wide. */
export function fogUniforms() {
  return THREE.UniformsUtils.clone(THREE.UniformsLib.fog)
}
