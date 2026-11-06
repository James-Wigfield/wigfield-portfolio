/**
 * LAYER 0 — THE PAGE
 * A document slab floating in a void, lit like a product shot. Its title types
 * itself, a heavy red stamp drops, and the camera dives into the letter A.
 */

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Bag, disposeScene, type BuildContext, type Layer } from '../core'
import {
  clamp,
  easeInCubic,
  easeInOutCubic,
  easeInQuad,
  easeOutCubic,
  invLerp,
  lerp,
  rng,
  smoothstep,
  track3,
  type Key3,
} from '../math'
import { STAMP_IMPACT, TITLE, TYPE_TIMES } from '../timeline'
import { displayFont, makeCanvas, monoFont, speckle, toTexture } from '../textures'

const PAGE_W = 3.4
const PAGE_D = 4.4
const PAGE_T = 0.07
const TOP = PAGE_T / 2

const STAMP_X = 0.15
const STAMP_Z = 0.62
const STAMP_ROT = 0.12
const INK_W = 1.95
const INK_H = 0.84

export function makeEnvironment(renderer: THREE.WebGLRenderer, bag: Bag) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const rt = bag.add(pmrem.fromScene(room, 0.04))
  room.dispose()
  pmrem.dispose()
  return rt.texture
}

function documentTexture() {
  const W = 1024
  const H = 1325
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#efece5'
  ctx.fillRect(0, 0, W, H)
  speckle(ctx, W, H, 10, 11)

  const M = 78
  ctx.fillStyle = '#8f8a80'
  ctx.font = monoFont(17)
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('PRIVATE  ·  DRAFT', M, 72)
  const pg = 'PAGE 1 / 1'
  ctx.fillText(pg, W - M - ctx.measureText(pg).width, 72)
  ctx.fillStyle = '#cfc9bd'
  ctx.fillRect(M, 94, W - 2 * M, 2)

  ctx.fillStyle = '#7a756c'
  ctx.font = monoFont(19)
  const meta = [
    ['Created', 'just now'],
    ['People', '2'],
    ['Status', 'talking'],
  ]
  meta.forEach(([k, v], i) => {
    ctx.fillText(k!, M, 300 + i * 30)
    ctx.fillText(v!, M + 170, 300 + i * 30)
  })
  ctx.fillStyle = '#cfc9bd'
  ctx.fillRect(M, 384, W - 2 * M, 2)

  // Six sections — the six things the conversation was about.
  const sections = ['§1  Retrieval', '§2  Persona', '§3  Firewall', '§4  Planting', '§5  Attention', '§6  Coming soon']
  const r = rng(5)
  let y = 440
  for (const s of sections) {
    ctx.fillStyle = '#433f38'
    ctx.font = monoFont(19, 700)
    ctx.fillText(s, M, y)
    y += 28
    const lines = 3
    for (let l = 0; l < lines; l++) {
      const len = l === lines - 1 ? 0.3 + r() * 0.35 : 0.82 + r() * 0.18
      let x = M
      const end = M + (W - 2 * M) * len
      ctx.fillStyle = '#bdb7ab'
      while (x < end) {
        const word = 30 + r() * 90
        ctx.fillRect(x, y - 9, Math.min(word, end - x), 10)
        x += word + 12
      }
      y += 25
    }
    y += 24
  }

  ctx.fillStyle = '#a19b90'
  ctx.fillRect(M, 1196, 300, 2)
  ctx.fillRect(W - M - 300, 1196, 300, 2)
  ctx.font = monoFont(16)
  ctx.fillText('Party A', M, 1222)
  ctx.fillText('Party B', W - M - 300, 1222)
  ctx.fillText('— 1 —', W / 2 - ctx.measureText('— 1 —').width / 2, 1280)
  return toTexture(canvas, { anisotropy: 8 })
}

/** Red ink, rubber-stamped: uneven density and pitted where the rubber missed. */
function inkTexture() {
  const W = 1024
  const H = Math.round((W * INK_H) / INK_W)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.clearRect(0, 0, W, H)
  const ink = 'rgb(176, 18, 28)'
  ctx.strokeStyle = ink
  ctx.lineWidth = 24
  const inset = 26
  const rr = 30
  ctx.beginPath()
  ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, rr)
  ctx.stroke()

  const text = 'EXHIBIT A'
  let px = 300
  ctx.font = displayFont(px)
  const maxW = W - 170
  const measured = ctx.measureText(text).width
  if (measured > maxW) {
    px = Math.floor((px * maxW) / measured)
    ctx.font = displayFont(px)
  }
  const m = ctx.measureText(text)
  const left = W / 2 - m.width / 2
  const ascent = m.actualBoundingBoxAscent
  const baseline = H / 2 + ascent / 2
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, left, baseline)

  // Where the A sits — the camera dives into its ink.
  const aLeft = left + ctx.measureText('EXHIBIT ').width
  const aW = ctx.measureText('A').width
  const aCx = aLeft + aW / 2
  const aCy = baseline - ascent * 0.32

  // Wear the stamp in.
  const r = rng(21)
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 2600; i++) {
    ctx.globalAlpha = 0.35 + r() * 0.65
    ctx.beginPath()
    ctx.arc(r() * W, r() * H, 0.6 + r() * r() * 4.5, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.08 + r() * 0.12
    ctx.beginPath()
    ctx.arc(r() * W, r() * H, 40 + r() * 140, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 2
  for (let i = 0; i < 14; i++) {
    ctx.beginPath()
    const x = r() * W
    const yy = r() * H
    ctx.moveTo(x, yy)
    ctx.lineTo(x + (r() - 0.5) * 220, yy + (r() - 0.5) * 30)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  // Nearest solid ink pixel to the middle of the A.
  const data = ctx.getImageData(0, 0, W, H).data
  let best = { x: aCx, y: aCy, d: Infinity }
  for (let y = Math.floor(aCy - ascent * 0.6); y < aCy + ascent * 0.6; y += 2) {
    for (let x = Math.floor(aLeft); x < aLeft + aW; x += 2) {
      const a = data[(Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))) * 4 + 3]!
      if (a < 230) continue
      const d = (x - aCx) ** 2 + (y - aCy) ** 2
      if (d < best.d) best = { x, y, d }
    }
  }
  const aLocal = new THREE.Vector2((best.x / W - 0.5) * INK_W, (0.5 - best.y / H) * INK_H)
  return { texture: toTexture(canvas, { anisotropy: 8 }), aLocal }
}

class TitleDecal {
  readonly canvas: HTMLCanvasElement
  readonly texture: THREE.CanvasTexture
  private ctx: CanvasRenderingContext2D
  private key = ''

  constructor() {
    const { canvas, ctx } = makeCanvas(1024, 128)
    this.canvas = canvas
    this.ctx = ctx
    this.texture = toTexture(canvas, { anisotropy: 8 })
  }

  draw(chars: number, caret: boolean, placeholder: boolean) {
    const key = `${chars}|${caret}|${placeholder}`
    if (key === this.key) return
    this.key = key
    const { ctx } = this
    ctx.clearRect(0, 0, 1024, 128)
    ctx.font = displayFont(96)
    ctx.textBaseline = 'alphabetic'
    const x0 = 12
    const base = 108
    let x = x0
    if (placeholder) {
      ctx.fillStyle = 'rgba(150, 144, 133, 0.75)'
      ctx.fillText('Untitled', x0, base)
    } else {
      const text = TITLE.slice(0, chars)
      ctx.fillStyle = '#141416'
      ctx.fillText(text, x0, base)
      x = x0 + ctx.measureText(text).width + 6
    }
    if (caret) {
      ctx.fillStyle = '#141416'
      ctx.fillRect(placeholder ? x0 - 2 : x, 20, 7, 96)
    }
    this.texture.needsUpdate = true
  }
}

const CAM_POS: Key3[] = [
  [0, 6.4, 6.6, 9.6],
  [2.4, 3.9, 4.6, 5.9],
  [5.5, 1.4, 2.9, 2.5],
  [6.5, 2.6, 4.2, 5.4],
  [7.4, 2.7, 3.7, 5.4],
  [9.0, 1.9, 3.8, 4.4],
  [11.8, 0.9, 3.3, 3.1],
]
const CAM_TGT: Key3[] = [
  [0, 0, -0.2, 0],
  [2.4, -0.3, 0, -1.0],
  [5.5, -0.3, 0, -1.5],
  [6.5, 0.1, 1.3, 0.3],
  [7.4, 0.15, 0.3, 0.6],
  [9.0, 0.15, 0.0, 0.6],
  [11.8, 0.15, 0.0, 0.62],
]
const DIVE_START = 11.8

export function createPageLayer({ renderer, quality }: BuildContext): Layer {
  const bag = new Bag()
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  scene.fog = new THREE.FogExp2(0x000000, 0.03)
  scene.environment = makeEnvironment(renderer, bag)
  scene.environmentIntensity = 0.12

  // Light it like a product shot: hard key from above, cool rim, warm fill.
  scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x080808, 0.15))
  const key = new THREE.SpotLight(0xfff1df, 95, 0, 0.4, 0.7, 2)
  key.position.set(-2.6, 9.5, 3.4)
  key.castShadow = true
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize)
  key.shadow.camera.near = 4
  key.shadow.camera.far = 20
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  scene.add(key, key.target)
  const rim = new THREE.DirectionalLight(0xa9c4ff, 1.6)
  rim.position.set(3.5, 2.5, -6)
  scene.add(rim)
  const fill = new THREE.PointLight(0xffd9b8, 1.6, 0, 2)
  fill.position.set(4.5, 1.6, 4.5)
  scene.add(fill)

  const floor = new THREE.Mesh(
    bag.add(new THREE.PlaneGeometry(70, 70)),
    bag.add(new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.95 })),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.6
  floor.receiveShadow = true
  scene.add(floor)

  // The page.
  const page = new THREE.Group()
  scene.add(page)
  const slab = new THREE.Mesh(
    bag.add(new RoundedBoxGeometry(PAGE_W, PAGE_T, PAGE_D, 3, 0.022)),
    bag.add(
      new THREE.MeshPhysicalMaterial({
        color: 0xe6e2da,
        roughness: 0.8,
        sheen: 0.5,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(0xffffff),
      }),
    ),
  )
  slab.castShadow = true
  slab.receiveShadow = true
  page.add(slab)

  const face = new THREE.Mesh(
    bag.add(new THREE.PlaneGeometry(PAGE_W - 0.03, PAGE_D - 0.03)),
    bag.add(new THREE.MeshStandardMaterial({ map: bag.add(documentTexture()), roughness: 0.86 })),
  )
  face.rotation.x = -Math.PI / 2
  face.position.y = TOP + 0.0015
  face.receiveShadow = true
  page.add(face)

  const title = new TitleDecal()
  bag.add(title.texture)
  const titleW = PAGE_W * 0.88
  const titleMesh = new THREE.Mesh(
    bag.add(new THREE.PlaneGeometry(titleW, (titleW * 128) / 1024)),
    bag.add(
      new THREE.MeshStandardMaterial({
        map: title.texture,
        transparent: true,
        roughness: 0.6,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    ),
  )
  titleMesh.rotation.x = -Math.PI / 2
  titleMesh.position.set(0.02, TOP + 0.003, -PAGE_D / 2 + (190 / 1325) * PAGE_D)
  titleMesh.receiveShadow = true
  page.add(titleMesh)

  // The ink the stamp leaves.
  const inkGroup = new THREE.Group()
  inkGroup.position.set(STAMP_X, TOP + 0.004, STAMP_Z)
  inkGroup.rotation.y = STAMP_ROT
  page.add(inkGroup)
  const ink = inkTexture()
  bag.add(ink.texture)
  const inkMat = bag.add(
    new THREE.MeshPhysicalMaterial({
      map: ink.texture,
      transparent: true,
      roughness: 0.42,
      clearcoat: 0.3,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  )
  const inkMesh = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(INK_W, INK_H)), inkMat)
  inkMesh.rotation.x = -Math.PI / 2
  inkMesh.receiveShadow = true
  inkGroup.add(inkMesh)
  const aMarker = new THREE.Object3D()
  aMarker.position.set(ink.aLocal.x, 0, -ink.aLocal.y)
  inkGroup.add(aMarker)

  // The stamp: red lacquer, heavy.
  const stamp = new THREE.Group()
  inkGroup.add(stamp)
  const lacquer = bag.add(
    new THREE.MeshPhysicalMaterial({ color: 0x8c0c13, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 }),
  )
  const steel = bag.add(new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.3, metalness: 0.9 }))
  const rubber = bag.add(new THREE.MeshStandardMaterial({ color: 0x5e0a0f, roughness: 0.85 }))
  const pad = new THREE.Mesh(bag.add(new THREE.BoxGeometry(INK_W + 0.03, 0.05, INK_H + 0.03)), rubber)
  pad.position.y = 0.025
  const base = new THREE.Mesh(bag.add(new RoundedBoxGeometry(INK_W + 0.12, 0.3, INK_H + 0.12, 3, 0.04)), lacquer)
  base.position.y = 0.2
  const neck = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(0.13, 0.19, 0.55, 28)), steel)
  neck.position.y = 0.625
  const knob = new THREE.Mesh(bag.add(new THREE.SphereGeometry(0.34, 40, 20)), lacquer)
  knob.position.y = 1.1
  knob.scale.set(1, 0.78, 1)
  for (const m of [pad, base, neck, knob]) {
    m.castShadow = true
    m.receiveShadow = true
    stamp.add(m)
  }

  // Dust: a few hundred motes hanging in the light, and a burst on impact.
  const ambientN = Math.round(240 * quality.density)
  const burstN = Math.round(560 * quality.density)
  const n = ambientN + burstN
  const pos = new Float32Array(n * 3)
  const dir = new Float32Array(n * 3)
  const dat = new Float32Array(n * 4)
  const seed = new Float32Array(n * 3)
  const r = rng(3)
  const cos = Math.cos(STAMP_ROT)
  const sin = Math.sin(STAMP_ROT)
  for (let i = 0; i < n; i++) {
    seed.set([r(), r(), r()], i * 3)
    if (i < ambientN) {
      pos.set([(r() - 0.5) * 9, -1.4 + r() * 5, (r() - 0.5) * 9], i * 3)
      dat.set([0, 0, 0.008 + r() * 0.014, 0], i * 4)
    } else {
      // A point on the stamp's footprint perimeter, pushed outward.
      const side = Math.floor(r() * 4)
      const u = r() - 0.5
      let lx = 0
      let lz = 0
      let nx = 0
      let nz = 0
      if (side === 0) [lx, lz, nx, nz] = [u * INK_W, INK_H / 2, 0, 1]
      else if (side === 1) [lx, lz, nx, nz] = [u * INK_W, -INK_H / 2, 0, -1]
      else if (side === 2) [lx, lz, nx, nz] = [INK_W / 2, u * INK_H, 1, 0]
      else [lx, lz, nx, nz] = [-INK_W / 2, u * INK_H, -1, 0]
      const wx = STAMP_X + lx * cos + lz * sin
      const wz = STAMP_Z - lx * sin + lz * cos
      const dx = nx * cos + nz * sin + (r() - 0.5) * 0.9
      const dz = -nx * sin + nz * cos + (r() - 0.5) * 0.9
      const len = Math.hypot(dx, dz) || 1
      pos.set([wx, TOP + 0.02, wz], i * 3)
      dir.set([dx / len, 0.12 + r() * 0.45, dz / len], i * 3)
      dat.set([1.2 + r() * 3.2, 1.6 + r() * 2.4, 0.01 + r() * 0.03, 1], i * 4)
    }
  }
  const dustGeo = bag.add(new THREE.BufferGeometry())
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  dustGeo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
  dustGeo.setAttribute('aData', new THREE.BufferAttribute(dat, 4))
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
  const dustMat = bag.add(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uImpact: { value: STAMP_IMPACT }, uPx: { value: 800 } },
      vertexShader: /* glsl */ `
        attribute vec3 aDir;
        attribute vec4 aData;
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uImpact;
        uniform float uPx;
        varying float vAlpha;
        varying float vKind;
        void main() {
          vec3 p = position;
          float size = aData.z;
          float alpha;
          if (aData.w > 0.5) {
            float age = uTime - uImpact;
            if (age <= 0.0 || age > aData.y) {
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
              gl_PointSize = 0.0;
              vAlpha = 0.0;
              vKind = 1.0;
              return;
            }
            float k = 2.6;
            p += aDir * aData.x * (1.0 - exp(-age * k)) / k;
            p.y += 0.22 * (1.0 - exp(-age * 1.2)) - 0.025 * age * age;
            p.x += sin(age * 1.7 + aSeed.x * 6.0) * 0.06 * age;
            p.z += cos(age * 1.3 + aSeed.y * 6.0) * 0.06 * age;
            float life = age / aData.y;
            alpha = smoothstep(0.0, 0.04, age) * pow(1.0 - life, 1.6) * 0.85;
            size *= 1.0 + age * 0.9;
          } else {
            float t = uTime;
            p += vec3(sin(t * 0.13 + aSeed.x * 6.28) * 0.4, sin(t * 0.09 + aSeed.y * 6.28) * 0.25, cos(t * 0.11 + aSeed.z * 6.28) * 0.4);
            alpha = 0.22 * (0.55 + 0.45 * sin(t * 0.7 + aSeed.x * 20.0));
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * projectionMatrix[1][1] * uPx * 0.5 / max(-mv.z, 0.05);
          // Motes right in front of the lens read as blobs; let them go.
          vAlpha = alpha * smoothstep(0.6, 2.2, -mv.z);
          vKind = aData.w;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vKind;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          vec3 c = mix(vec3(1.0, 0.94, 0.84) * 1.5, vec3(0.86, 0.8, 0.74) * 1.15, vKind);
          gl_FragColor = vec4(c, a);
        }
      `,
    }),
  )
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.frustumCulled = false
  page.add(dust)

  const aWorld = new THREE.Vector3()
  const basePos = new THREE.Vector3()
  const baseTgt = new THREE.Vector3()
  const dirV = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0.1).normalize()

  return {
    scene,
    update(t, shot, frame) {
      // Float, and give under the stamp.
      const since = t - STAMP_IMPACT
      const dip = since > 0 ? -0.07 * Math.exp(-since * 7) * Math.cos(since * 26) : 0
      page.position.y = Math.sin(t * 0.6) * 0.035 + dip
      page.rotation.x = -0.02 + Math.sin(t * 0.4) * 0.008
      page.rotation.z = 0.015 + Math.sin(t * 0.33) * 0.006
      page.updateMatrixWorld(true)

      // The title types itself.
      let chars = 0
      for (const tt of TYPE_TIMES) if (t >= tt) chars++
      const typing = chars > 0 && chars < TITLE.length
      const blink = Math.floor(t / 0.53) % 2 === 0
      const caret = t > 1.2 && t < 6.4 && (typing || blink)
      title.draw(chars, caret, t < TYPE_TIMES[0]! - 0.35)

      // The stamp.
      let sy = 12
      let squash = 1
      let sway = 0
      if (t < 5.2) sy = 12
      else if (t < 6.35) {
        const p = invLerp(5.2, 6.35, t)
        sy = lerp(12, 2.6, easeOutCubic(p))
        sway = Math.sin(t * 2.1) * 0.035 * (1 - p)
      } else if (t < 6.62) sy = 2.6 + Math.sin((t - 6.35) * 9) * 0.02
      else if (t < STAMP_IMPACT) sy = 2.6 * (1 - easeInCubic(invLerp(6.62, STAMP_IMPACT, t)))
      else if (t < 7.7) {
        sy = 0
        squash = 1 - 0.07 * Math.exp(-(t - STAMP_IMPACT) * 14)
        sway = Math.sin((t - STAMP_IMPACT) * 30) * 0.006 * Math.exp(-(t - STAMP_IMPACT) * 6)
      } else sy = 12 * easeInOutCubic(invLerp(7.7, 8.9, t))
      stamp.visible = t > 5.1 && t < 8.95
      stamp.position.y = sy
      stamp.scale.y = squash
      stamp.rotation.z = sway
      inkMat.opacity = t >= STAMP_IMPACT ? 1 : 0

      dustMat.uniforms.uTime!.value = t
      dustMat.uniforms.uPx!.value = frame.pixelHeight

      // Camera.
      if (t < DIVE_START) {
        track3(t, CAM_POS, shot.pos)
        track3(t, CAM_TGT, shot.target)
      } else {
        // The dive: exponential approach into the ink of the A.
        aMarker.getWorldPosition(aWorld)
        track3(DIVE_START, CAM_POS, basePos)
        track3(DIVE_START, CAM_TGT, baseTgt)
        const s = invLerp(DIVE_START, 16, t)
        const d0 = basePos.distanceTo(aWorld)
        dirV.subVectors(basePos, aWorld).normalize().lerp(up, smoothstep(0, 0.75, s)).normalize()
        const dist = d0 * Math.exp(-Math.log(d0 / 0.01) * easeInQuad(s))
        shot.pos.copy(aWorld).addScaledVector(dirV, dist)
        shot.target.lerpVectors(baseTgt, aWorld, smoothstep(0, 0.35, s))
        shot.zoom = smoothstep(0.45, 1, s) * 0.9
        shot.near = clamp(dist * 0.2, 0.002, 0.05)
        shot.handheld = 1 - smoothstep(0.5, 0.9, s)
      }
      const diveS = invLerp(DIVE_START, 16, t)
      shot.fov = lerp(38, 60, easeInCubic(diveS))
      shot.exposure = 1.0
      shot.bloomStrength = 0.3
      shot.bloomThreshold = 1.4
      shot.bloomRadius = 0.4
      shot.defocus = 1 - smoothstep(0.4, 2.8, t) + 0.45 * (smoothstep(5.9, 6.2, t) - smoothstep(6.3, 6.9, t))
      shot.ca = 0.0015 + (since > 0 ? 0.012 * Math.exp(-since * 6) : 0)
      shot.vignette = 0.55
      shot.grain = 0.055
    },
    dispose() {
      bag.dispose()
      disposeScene(scene)
    },
  }
}
