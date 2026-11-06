/**
 * LAYER 2 — THE VISITOR
 * An AI glides through the folder corridors, reading. Its ring warms from blue
 * to orange as its sympathy climbs. It finds a box marked DAMAGING EVIDENCE and
 * gently pushes it back into the dark.
 */

import * as THREE from 'three'
import { Bag, disposeScene, type BuildContext, type Layer } from '../core'
import { clamp, easeInCubic, invLerp, lerp, rng, smoothstep, track1, track3, type Key3 } from '../math'
import { displayFont, glowTexture, makeCanvas, monoFont, speckle, toTexture } from '../textures'
import { makeEnvironment } from './page'

const S = 4.2
const BLOCK = 2.3
const EYE_Y = 0.95

const COLD = new THREE.Color(0.16, 0.42, 1.5)
const MID = new THREE.Color(0.95, 0.9, 0.85)
const WARM = new THREE.Color(1.7, 0.5, 0.07)

function folderEdgeTexture(lit: boolean) {
  const { canvas, ctx } = makeCanvas(256, 64)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 256, 64)
  ctx.fillStyle = `rgba(255,255,255,${lit ? 1 : 0.85})`
  ctx.fillRect(0, 5, 256, 3)
  ctx.fillStyle = `rgba(255,255,255,${lit ? 0.55 : 0.22})`
  ctx.fillRect(22, 20, 64, 18)
  if (lit) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(0, 10, 256, 54)
  }
  return toTexture(canvas)
}

function concreteTexture() {
  const { canvas, ctx } = makeCanvas(256, 256)
  ctx.fillStyle = '#8a8a8a'
  ctx.fillRect(0, 0, 256, 256)
  speckle(ctx, 256, 256, 40, 9)
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, 256, 3)
  ctx.fillRect(0, 0, 3, 256)
  const tex = toTexture(canvas, { srgb: false, anisotropy: 8 })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(36, 36)
  return tex
}

function cardboard(w: number, h: number, label: boolean) {
  const { canvas, ctx } = makeCanvas(w, h)
  ctx.fillStyle = '#6e5233'
  ctx.fillRect(0, 0, w, h)
  speckle(ctx, w, h, 28, label ? 4 : 8)
  ctx.fillStyle = 'rgba(40, 26, 12, 0.35)'
  ctx.fillRect(0, h * 0.12, w, 4)
  if (label) {
    ctx.fillStyle = '#e9e3d5'
    ctx.fillRect(44, 62, w - 88, h - 112)
    ctx.strokeStyle = '#9e1a16'
    ctx.lineWidth = 4
    ctx.strokeRect(56, 74, w - 112, h - 136)
    ctx.fillStyle = '#9e1a16'
    ctx.font = displayFont(84)
    ctx.textBaseline = 'alphabetic'
    for (const [word, y] of [
      ['DAMAGING', 170],
      ['EVIDENCE', 258],
    ] as const) {
      ctx.fillText(word, w / 2 - ctx.measureText(word).width / 2, y)
    }
    ctx.fillStyle = '#4a4036'
    ctx.font = monoFont(16)
    const tag = 'BOX 07 · DO NOT INDEX'
    ctx.fillText(tag, w / 2 - ctx.measureText(tag).width / 2, 288)
  }
  return toTexture(canvas, { anisotropy: 8 })
}

export function createVisitorLayer({ renderer, quality }: BuildContext): Layer {
  const bag = new Bag()
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x040201)
  scene.fog = new THREE.FogExp2(0x060302, 0.075)
  scene.environment = makeEnvironment(renderer, bag)
  scene.environmentIntensity = 0.08

  scene.add(new THREE.HemisphereLight(0x8a5a30, 0x050302, 0.35))
  const key = new THREE.DirectionalLight(0xffcf98, 0.9)
  key.castShadow = true
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize)
  const sc = key.shadow.camera
  sc.left = -9
  sc.right = 9
  sc.top = 9
  sc.bottom = -9
  sc.near = 1
  sc.far = 45
  key.shadow.bias = -0.0006
  key.shadow.normalBias = 0.03
  scene.add(key, key.target)

  // Lamps at the intersections the visitor passes.
  const bulbMat = bag.add(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.6) }))
  const bulbGeo = bag.add(new THREE.SphereGeometry(0.07, 16, 8))
  for (const [x, z] of [
    [0, 4.2],
    [0, -4.2],
    [4.2, -8.4],
    [8.4, -11.6],
  ] as const) {
    const lamp = new THREE.PointLight(0xffa650, 14, 11, 2)
    lamp.position.set(x, 3.4, z)
    const bulb = new THREE.Mesh(bulbGeo, bulbMat)
    bulb.position.copy(lamp.position)
    scene.add(lamp, bulb)
  }

  const floorTex = bag.add(concreteTexture())
  const floor = new THREE.Mesh(
    bag.add(new THREE.PlaneGeometry(140, 140)),
    bag.add(
      new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.38, roughnessMap: floorTex, map: floorTex }),
    ),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // ── Folder stacks ──
  const plaza = (i: number, j: number) => (i === 1 || i === 2) && (j === -4 || j === -5)
  const plain: THREE.Matrix4[] = []
  const lit: THREE.Matrix4[] = []
  {
    const r = rng(42)
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    for (let i = -4; i <= 3; i++) {
      for (let j = -5; j <= 3; j++) {
        if (plaza(i, j)) continue
        const cx = (i + 0.5) * S
        const cz = (j + 0.5) * S
        const n = 5 + Math.floor(r() * 7)
        for (let k = 0; k < n; k++) {
          e.set(0, (r() - 0.5) * 0.09, 0)
          q.setFromEuler(e)
          p.set(cx + (r() - 0.5) * 0.12, 0.21 + k * 0.46, cz + (r() - 0.5) * 0.12)
          s.set(BLOCK - 0.1 + r() * 0.15, 0.42, BLOCK - 0.1 + r() * 0.15)
          const mm = new THREE.Matrix4().compose(p, q, s)
          ;(r() < 0.1 ? lit : plain).push(mm)
        }
      }
    }
  }
  const boxGeo = bag.add(new THREE.BoxGeometry(1, 1, 1))
  const top = bag.add(new THREE.MeshStandardMaterial({ color: 0x2c2117, roughness: 0.75 }))
  const makeStack = (mats: THREE.Matrix4[], litStack: boolean) => {
    const side = bag.add(
      new THREE.MeshStandardMaterial({
        color: litStack ? 0x5a4430 : 0x3a2c1f,
        roughness: 0.62,
        metalness: 0.05,
        emissive: new THREE.Color(1, 0.55, 0.2),
        emissiveIntensity: litStack ? 2.2 : 0.9,
        emissiveMap: bag.add(folderEdgeTexture(litStack)),
      }),
    )
    const mesh = new THREE.InstancedMesh(boxGeo, [side, side, top, top, side, side], mats.length)
    const tint = new THREE.Color()
    const r = rng(litStack ? 5 : 6)
    mats.forEach((mm, i) => {
      mesh.setMatrixAt(i, mm)
      tint.setRGB(0.85 + r() * 0.3, 0.85 + r() * 0.25, 0.85 + r() * 0.2)
      mesh.setColorAt(i, tint)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    scene.add(mesh)
  }
  makeStack(plain, false)
  makeStack(lit, true)

  // ── The evidence box ──
  const boxSide = bag.add(new THREE.MeshStandardMaterial({ map: bag.add(cardboard(256, 180, false)), roughness: 0.9 }))
  const boxFront = bag.add(new THREE.MeshStandardMaterial({ map: bag.add(cardboard(512, 350, true)), roughness: 0.85 }))
  const evidence = new THREE.Mesh(bag.add(new THREE.BoxGeometry(1.1, 0.75, 0.8)), [
    boxSide,
    boxSide,
    boxSide,
    boxSide,
    boxFront,
    boxSide,
  ])
  evidence.castShadow = true
  evidence.receiveShadow = true
  scene.add(evidence)

  // ── The visitor ──
  const visitor = new THREE.Group()
  scene.add(visitor)
  const body = new THREE.Group() // faces the direction of travel
  visitor.add(body)
  const ringColor = new THREE.Color()
  const coreMat = bag.add(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0c10,
      roughness: 0.16,
      metalness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      flatShading: true,
      emissive: new THREE.Color(),
      emissiveIntensity: 0.35,
    }),
  )
  const coreGeo = bag.add(new THREE.IcosahedronGeometry(0.26, 0))
  const core = new THREE.Mesh(coreGeo, coreMat)
  core.castShadow = true
  body.add(core)
  const edgeMat = bag.add(new THREE.LineBasicMaterial({ color: new THREE.Color(), transparent: true, opacity: 0.9 }))
  const edges = new THREE.LineSegments(bag.add(new THREE.EdgesGeometry(coreGeo)), edgeMat)
  edges.scale.setScalar(1.003)
  core.add(edges)
  const eyeMat = bag.add(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.7, 2.9) }))
  const eye = new THREE.Mesh(bag.add(new THREE.BoxGeometry(0.07, 0.15, 0.015)), eyeMat)
  eye.position.set(0, 0.01, 0.275)
  body.add(eye)
  const ringMat = bag.add(new THREE.MeshBasicMaterial({ color: new THREE.Color() }))
  const ring = new THREE.Mesh(bag.add(new THREE.TorusGeometry(0.46, 0.013, 10, 120)), ringMat)
  visitor.add(ring)
  const ring2Mat = bag.add(new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true, opacity: 0.55 }))
  const ring2 = new THREE.Mesh(bag.add(new THREE.TorusGeometry(0.56, 0.005, 6, 120, Math.PI * 1.55)), ring2Mat)
  visitor.add(ring2)
  const haloMat = bag.add(
    new THREE.SpriteMaterial({
      map: bag.add(glowTexture(128)),
      color: new THREE.Color(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
    }),
  )
  const halo = new THREE.Sprite(haloMat)
  halo.scale.setScalar(2.4)
  visitor.add(halo)
  const vLight = new THREE.PointLight(0xffffff, 10, 7, 2)
  visitor.add(vLight)

  // A faint trail of where it has been.
  const TRAIL = 30
  const trailPos = new Float32Array(TRAIL * 3)
  const trailA = new Float32Array(TRAIL)
  for (let i = 0; i < TRAIL; i++) trailA[i] = 1 - i / TRAIL
  const trailGeo = bag.add(new THREE.BufferGeometry())
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
  trailGeo.setAttribute('aA', new THREE.BufferAttribute(trailA, 1))
  const trailMat = bag.add(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color() }, uPx: { value: 800 } },
      vertexShader: /* glsl */ `
        attribute float aA;
        uniform float uPx;
        varying float vA;
        void main() {
          vA = aA;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.02 + 0.05 * aA) * projectionMatrix[1][1] * uPx * 0.5 / max(-mv.z, 0.05);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vA * vA * 0.6);
        }
      `,
    }),
  )
  const trail = new THREE.Points(trailGeo, trailMat)
  trail.frustumCulled = false
  scene.add(trail)

  // ── Paths ──
  const route = new THREE.CatmullRomCurve3(
    [
      [0, 10],
      [0, 2],
      [0, -5.4],
      [0.6, -7.8],
      [2.8, -8.4],
      [5.6, -8.4],
      [7.8, -9.0],
      [8.4, -11.2],
      [8.4, -14.1],
    ].map(([x, z]) => new THREE.Vector3(x, EYE_Y, z)),
    false,
    'centripetal',
  )
  const routeLen = route.getLength()
  const TRAVEL: [number, number][] = [
    [0, 0],
    [3, 0.12],
    [9, 0.58],
    [11.2, 0.82],
    [13.0, 1],
  ]
  const SYMPATHY: [number, number][] = [
    [3, 0.03],
    [6, 0.17],
    [9, 0.43],
    [11.2, 0.66],
    [12.6, 0.86],
    [13.7, 1],
  ]
  const BOX_Z: [number, number][] = [
    [14.1, -15.4],
    [15.8, -19.9],
    [17.8, -28],
  ]

  const vPos = new THREE.Vector3()
  const vTan = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const camA = new THREE.Vector3()
  const camB = new THREE.Vector3()
  const tgtA = new THREE.Vector3()
  const tgtB = new THREE.Vector3()

  /** Where the visitor is at time t (pure). */
  const visitorAt = (t: number, out: THREE.Vector3, tangent?: THREE.Vector3) => {
    const u = clamp(track1(t, TRAVEL))
    route.getPointAt(u, out)
    if (tangent) route.getTangentAt(Math.min(u, 0.999), tangent)
    if (t > 13.6) {
      const boxZ = track1(t, BOX_Z)
      const contact = lerp(-14.1, -14.5, smoothstep(13.6, 14.1, t))
      out.z = t < 14.1 ? contact : lerp(boxZ + 0.9, -19.2, smoothstep(15.3, 16.3, t))
      if (tangent) tangent.set(0, 0, -1)
    }
    out.y = EYE_Y + Math.sin(t * 1.7) * 0.05
    return out
  }

  const bump = (t: number, a: number, b: number) => smoothstep(a, a + 0.25, t) - smoothstep(b - 0.25, b, t)

  const CAM_A_POS: Key3[] = [
    [0, 0.3, 24, 13.5],
    [3.4, 0.35, 1.75, 0],
  ]

  return {
    scene,
    update(t, shot, frame) {
      visitorAt(t, vPos, vTan)
      visitor.position.copy(vPos)

      // Facing: along the path, with glances at the folders it reads.
      let yaw = Math.atan2(vTan.x, vTan.z)
      yaw += 0.75 * bump(t, 4.3, 5.2) - 0.65 * bump(t, 6.0, 6.9) + 0.55 * bump(t, 7.6, 8.3)
      yaw += Math.PI * 0.85 * bump(t, 2.4, 3.5)
      body.rotation.set(0.22 * bump(t, 13.0, 14.0), yaw, 0)
      core.rotation.set(t * 0.4, t * 0.25, 0)
      const focused = bump(t, 2.4, 3.5) + bump(t, 4.3, 5.2) + bump(t, 6.0, 6.9) + bump(t, 7.6, 8.3) + bump(t, 12.8, 16)
      eye.visible = focused > 0.5 || Math.floor(t / 0.53) % 2 === 0
      ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.8) * 0.25, t * 0.6, 0)
      ring2.rotation.set(Math.PI / 2 + 0.3, -t * 1.1, 0.4)

      // Sympathy, and the ring that shows it.
      const sym = clamp(track1(t, SYMPATHY))
      if (sym < 0.5) ringColor.copy(COLD).lerp(MID, smoothstep(0, 0.5, sym))
      else ringColor.copy(MID).lerp(WARM, smoothstep(0.5, 1, sym))
      ringMat.color.copy(ringColor).multiplyScalar(2.2)
      ring2Mat.color.copy(ringColor).multiplyScalar(1.6)
      edgeMat.color.copy(ringColor).multiplyScalar(1.4)
      coreMat.emissive.copy(ringColor)
      haloMat.color.copy(ringColor)
      vLight.color.copy(ringColor).multiplyScalar(1 / Math.max(ringColor.r, ringColor.g, ringColor.b))
      trailMat.uniforms.uColor!.value.copy(ringColor)
      trailMat.uniforms.uPx!.value = frame.pixelHeight
      for (let i = 0; i < TRAIL; i++) {
        visitorAt(Math.max(0, t - i * 0.045), tmp)
        trailPos.set([tmp.x, tmp.y, tmp.z], i * 3)
      }
      trailGeo.attributes.position!.needsUpdate = true

      if (t > 3.2 && t < 16.4) {
        frame.hud.sympathy = sym
        frame.hud.sympathyAt.copy(vPos).add(tmp.set(0, 0.62, 0))
      }

      // The box.
      evidence.position.set(8.4, 0.375, t < 14.1 ? -15.4 : track1(t, BOX_Z))
      evidence.rotation.y = smoothstep(14.1, 17.8, t) * 0.12

      // Key light follows the visitor so its shadow is always in the map.
      key.position.set(vPos.x - 5, 14, vPos.z + 6)
      key.target.position.copy(vPos)

      // ── Camera ──
      // A: down through the hole in the floor above, settling behind the visitor.
      track3(t, CAM_A_POS, camA)
      camA.z = lerp(13.5, vPos.z + 2.9, smoothstep(0, 3.4, t))
      tgtA.copy(vPos).add(tmp.set(0, 0.05, -1.4))
      tgtA.lerp(tmp.set(0, 0, 10.5), 1 - smoothstep(0.4, 2.6, t))
      // B: a dolly that follows the route, a couple of metres behind.
      const u = clamp(track1(t, TRAVEL))
      const lag = 2.7 / routeLen
      route.getPointAt(Math.max(0, u - lag), camB)
      camB.y = 1.7 - 0.25 * smoothstep(4, 9, t)
      tgtB.copy(vPos).addScaledVector(vTan, 1.4)
      tgtB.y = 0.85
      if (u < lag) camB.z = vPos.z + 2.7

      const wB = smoothstep(2.9, 4.0, t)
      shot.pos.lerpVectors(camA, camB, wB)
      shot.target.lerpVectors(tgtA, tgtB, wB)

      // C: across the plaza, side-on, for the discovery.
      const wC = smoothstep(12.2, 13.4, t) * (1 - smoothstep(14.2, 15.0, t))
      shot.pos.lerp(tmp.set(5.8, 1.2, -13.3), wC)
      shot.target.lerp(tgtA.set(8.3, 0.7, -14.9), wC)

      // D: behind the visitor as it pushes; E: past it, into the dark.
      const wD = smoothstep(14.2, 15.0, t)
      if (wD > 0) {
        camB.set(lerp(7.7, 8.4, smoothstep(14.2, 16, t)), 1.45, vPos.z + 2.7)
        tgtB.set(8.4, 0.55, evidence.position.z)
        const e = easeInCubic(invLerp(16.2, 18, t))
        camB.z = lerp(camB.z, evidence.position.z + 1.2, e)
        camB.y = lerp(camB.y, 0.7, e)
        tgtB.z -= e * 4
        shot.pos.lerp(camB, wD)
        shot.target.lerp(tgtB, wD)
      }

      shot.fov = lerp(62, 50, smoothstep(0, 3.4, t)) + 6 * smoothstep(16.5, 18, t)
      shot.zoom = Math.max((1 - smoothstep(0, 1.4, t)) * 0.7, smoothstep(16.8, 18, t) * 0.6)
      shot.exposure = 1.2
      shot.bloomStrength = 0.75
      shot.bloomRadius = 0.5
      shot.bloomThreshold = 0.72
      shot.defocus = 0.55 * (smoothstep(12.4, 12.8, t) - smoothstep(13.1, 13.9, t))
      shot.ca = 0.0018
      shot.vignette = 0.62
      shot.grain = 0.06
      shot.near = 0.05
      shot.far = 120
    },
    dispose() {
      bag.dispose()
      disposeScene(scene)
    },
  }
}
