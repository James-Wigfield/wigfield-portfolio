/**
 * LAYER 3 — THE DREAM
 * Rooms nested inside rooms, turning and folding into each other while gravity
 * shifts. Thousands of people stream through, get pulled into two opposing
 * camps, and then a trend ripples through everyone and fades.
 */

import * as THREE from 'three'
import { Bag, disposeScene, type BuildContext, type Layer } from '../core'
import { easeInOutCubic, easeInQuad, easeOutCubic, invLerp, lerp, rng, smoothstep } from '../math'
import { glowTexture, makeCanvas, toTexture } from '../textures'

const ROOMS = 6
const OUTER = 13
const RATIO = 0.55
const WAVE_T = 10
const WAVE_SPEED = 9
const FOLD_BEATS = [3.6, 7.6, 11.4]

function doorTexture() {
  const { canvas, ctx } = makeCanvas(256, 256)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = '#000'
  // An arched doorway, and a window that doesn't line up with anything.
  ctx.beginPath()
  ctx.moveTo(92, 256)
  ctx.lineTo(92, 120)
  ctx.arc(128, 120, 36, Math.PI, 0)
  ctx.lineTo(164, 256)
  ctx.fill()
  ctx.fillRect(184, 40, 44, 44)
  return toTexture(canvas, { srgb: false })
}

export function createDreamLayer({ quality }: BuildContext): Layer {
  const bag = new Bag()
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05020c)
  scene.fog = new THREE.FogExp2(0x0a0618, 0.026)

  scene.add(new THREE.HemisphereLight(0x6a4cff, 0x0b3a3a, 0.55))
  const coreLight = new THREE.PointLight(0xd8c8ff, 30, 45, 1.6)
  scene.add(coreLight)
  const rim = new THREE.DirectionalLight(0x40ffe0, 1.3)
  rim.position.set(6, 4, -8)
  scene.add(rim)
  const key = new THREE.DirectionalLight(0xb49cff, 1.5)
  key.position.set(-6, 11, 8)
  key.castShadow = true
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize)
  const sc = key.shadow.camera
  sc.left = -12
  sc.right = 12
  sc.top = 12
  sc.bottom = -12
  sc.near = 1
  sc.far = 40
  key.shadow.bias = -0.0006
  key.shadow.normalBias = 0.03
  scene.add(key, key.target)

  // ── Nested rooms ──
  const door = bag.add(doorTexture())
  const beamMats = [
    bag.add(
      new THREE.MeshStandardMaterial({
        color: 0x1b1233,
        roughness: 0.35,
        metalness: 0.6,
        emissive: new THREE.Color(0.5, 0.22, 1.0),
        emissiveIntensity: 0.85,
      }),
    ),
    bag.add(
      new THREE.MeshStandardMaterial({
        color: 0x0f2a2a,
        roughness: 0.35,
        metalness: 0.6,
        emissive: new THREE.Color(0.08, 0.95, 0.82),
        emissiveIntensity: 0.75,
      }),
    ),
  ]
  const panelMats = [
    bag.add(
      new THREE.MeshStandardMaterial({
        color: 0x2b1d4d,
        roughness: 0.85,
        side: THREE.DoubleSide,
        alphaMap: door,
        alphaTest: 0.5,
      }),
    ),
    bag.add(
      new THREE.MeshStandardMaterial({
        color: 0x113838,
        roughness: 0.85,
        side: THREE.DoubleSide,
        alphaMap: door,
        alphaTest: 0.5,
      }),
    ),
  ]
  const stairMat = bag.add(new THREE.MeshStandardMaterial({ color: 0x3a2a5a, roughness: 0.6, metalness: 0.1 }))
  const unitBox = bag.add(new THREE.BoxGeometry(1, 1, 1))
  const unitPlane = bag.add(new THREE.PlaneGeometry(1, 1))

  interface Room {
    group: THREE.Group
    hinges: THREE.Group[]
  }
  const rooms: Room[] = []
  const mm = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  for (let k = 0; k < ROOMS; k++) {
    const size = OUTER * Math.pow(RATIO, k)
    const h = size / 2
    const th = size * 0.035
    const group = new THREE.Group()
    scene.add(group)

    const beams = new THREE.InstancedMesh(unitBox, beamMats[k % 2]!, 12)
    let n = 0
    for (const a of [-h, h]) {
      for (const b of [-h, h]) {
        const edges: [THREE.Vector3, THREE.Vector3][] = [
          [new THREE.Vector3(0, a, b), new THREE.Vector3(size + th, th, th)],
          [new THREE.Vector3(a, 0, b), new THREE.Vector3(th, size + th, th)],
          [new THREE.Vector3(a, b, 0), new THREE.Vector3(th, th, size + th)],
        ]
        for (const [pos, scl] of edges) {
          mm.compose(pos, q, scl)
          beams.setMatrixAt(n++, mm)
        }
      }
    }
    beams.castShadow = true
    beams.receiveShadow = true
    beams.computeBoundingSphere()
    group.add(beams)

    // Panels hinge on one edge so they can fold. Each hinge's local X is the
    // edge; the panel extends along its local +Y.
    const hinges: THREE.Group[] = []
    const faces: [THREE.Vector3, THREE.Euler][] = [
      [new THREE.Vector3(0, -h, -h), new THREE.Euler(Math.PI / 2, 0, 0)], // floor
      [new THREE.Vector3(-h, -h, 0), new THREE.Euler(0, -Math.PI / 2, 0)], // wall
      [new THREE.Vector3(0, h, h), new THREE.Euler(-Math.PI / 2, 0, 0)], // ceiling
    ]
    faces.forEach(([hp, he], fi) => {
      const mount = new THREE.Group()
      mount.position.copy(hp)
      mount.rotation.copy(he)
      const hinge = new THREE.Group()
      mount.add(hinge)
      const panel = new THREE.Mesh(unitPlane, panelMats[(k + fi) % 2]!)
      panel.scale.set(size * 0.97, size * 0.97, 1)
      panel.position.set(0, h, 0)
      panel.castShadow = true
      panel.receiveShadow = true
      hinge.add(panel)
      group.add(mount)
      hinges.push(hinge)
    })

    // Stairs climbing a wall — gravity is a suggestion here.
    const steps = new THREE.InstancedMesh(unitBox, stairMat, 7)
    for (let i = 0; i < 7; i++) {
      p.set(h - size * 0.08, -h + size * (0.1 + i * 0.11), -h + size * (0.15 + i * 0.1))
      s.set(size * 0.16, size * 0.05, size * 0.12)
      mm.compose(p, q, s)
      steps.setMatrixAt(i, mm)
    }
    steps.castShadow = true
    steps.computeBoundingSphere()
    group.add(steps)
    rooms.push({ group, hinges })
  }

  // The idea at the centre of it all.
  const coreMat = bag.add(new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 5.2) }))
  const core = new THREE.Mesh(bag.add(new THREE.SphereGeometry(0.14, 24, 16)), coreMat)
  scene.add(core)
  const haloMat = bag.add(
    new THREE.SpriteMaterial({
      map: bag.add(glowTexture(256)),
      color: new THREE.Color(2.2, 1.6, 3),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  )
  const halo = new THREE.Sprite(haloMat)
  halo.scale.setScalar(2.6)
  scene.add(halo)

  // ── People ──
  const count = Math.round(14000 * quality.density)
  const seedA = new Float32Array(count * 4)
  const side = new Float32Array(count)
  const r = rng(808)
  for (let i = 0; i < count; i++) {
    seedA.set([r(), r(), r(), r()], i * 4)
    side[i] = r() < 0.5 ? -1 : 1
  }
  const peopleGeo = bag.add(new THREE.BufferGeometry())
  peopleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  peopleGeo.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 4))
  peopleGeo.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
  const peopleMat = bag.add(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPolar: { value: 0 },
        uFade: { value: 1 },
        uPx: { value: 800 },
        uCenterA: { value: new THREE.Vector3() },
        uWaveT: { value: WAVE_T },
        uWaveSpeed: { value: WAVE_SPEED },
        uColorN: { value: new THREE.Color(0.85, 0.82, 1.1) },
        uColorA: { value: new THREE.Color(0.1, 1.25, 1.0) },
        uColorB: { value: new THREE.Color(1.45, 0.14, 0.85) },
        uColorT: { value: new THREE.Color(1.7, 1.2, 0.45) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        attribute float aSide;
        uniform float uTime;
        uniform float uPolar;
        uniform float uFade;
        uniform float uPx;
        uniform vec3 uCenterA;
        uniform float uWaveT;
        uniform float uWaveSpeed;
        uniform vec3 uColorN;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorT;
        varying vec3 vColor;
        varying float vAlpha;

        mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }

        void main() {
          // Streaming: a river of people looping through the rooms.
          float u = fract(aSeed.y + uTime * (0.035 + aSeed.x * 0.03));
          float a = u * 6.28318;
          vec3 path = vec3(cos(a) * 7.0, sin(a * 2.0) * 1.4, sin(a) * 4.8);
          path.yz = rot(0.35) * path.yz;
          path.xy = rot(0.2) * path.xy;
          float ta = aSeed.z * 6.28318;
          float tr = 0.25 + aSeed.w * 1.5;
          vec3 stream = path + vec3(cos(ta) * tr, sin(ta) * tr, sin(ta * 1.7) * tr * 0.6);

          // Polarising: everyone ends up in one camp or the other.
          vec3 dir = normalize(vec3(aSeed.z - 0.5, aSeed.w - 0.5, fract(aSeed.x * 7.13) - 0.5) + 0.0001);
          dir.xz = rot(uTime * (0.5 + aSeed.x * 0.7)) * dir.xz;
          float rr = sqrt(fract(aSeed.y * 3.7)) * 2.3;
          vec3 camp = aSide * uCenterA + dir * rr;
          float pol = smoothstep(aSeed.x * 0.5, aSeed.x * 0.5 + 0.5, uPolar);
          vec3 p = mix(stream, camp, pol);
          vec3 col = mix(uColorN, aSide > 0.0 ? uColorA : uColorB, pol);

          // The trend: a shockwave that briefly moves everyone the same way.
          float bright = 1.0;
          float since = uTime - uWaveT;
          if (since > 0.0) {
            float R = since * uWaveSpeed;
            float d = length(p) - R;
            float shell = exp(-d * d * 0.7) * (1.0 - smoothstep(1.5, 3.5, since));
            vec3 n = normalize(p + 0.0001);
            float passed = since - length(p) / uWaveSpeed;
            float trend = passed > 0.0 ? smoothstep(0.0, 0.3, passed) * exp(-passed * 0.75) : 0.0;
            p += n * shell * 1.5;
            p.xz = rot(trend * 0.9) * p.xz;
            col = mix(col, uColorT, clamp(trend * 1.2 + shell, 0.0, 1.0));
            bright += shell * 3.5 + trend * 0.8;
            bright *= mix(1.0, 0.55, smoothstep(1.5, 3.5, passed));
          }

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = 0.035 + aSeed.w * 0.035;
          gl_PointSize = size * projectionMatrix[1][1] * uPx * 0.5 / max(-mv.z, 0.05);
          vColor = col * bright;
          vAlpha = uFade * (0.55 + 0.45 * aSeed.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.1, d) * vAlpha);
        }
      `,
    }),
  )
  const people = new THREE.Points(peopleGeo, peopleMat)
  people.frustumCulled = false
  scene.add(people)

  const waveMat = bag.add(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color(1.8, 1.3, 0.6) } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        uniform vec3 uColor;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.5);
          gl_FragColor = vec4(uColor * f * uStrength, 1.0);
        }
      `,
    }),
  )
  const wave = new THREE.Mesh(bag.add(new THREE.SphereGeometry(1, 48, 24)), waveMat)
  wave.frustumCulled = false
  scene.add(wave)

  const tmp = new THREE.Vector3()

  return {
    scene,
    update(t, shot, frame) {
      // Rooms turn, and on each beat fold a quarter turn in a cascade.
      rooms.forEach((room, k) => {
        const dir = k % 2 ? 1 : -1
        let turns = 0
        for (const beat of FOLD_BEATS) turns += easeInOutCubic(invLerp(beat + k * 0.12, beat + k * 0.12 + 0.95, t))
        room.group.rotation.set(
          Math.sin(t * 0.23 + k * 1.3) * 0.6,
          t * 0.1 * dir * (1 + k * 0.4),
          Math.sin(t * 0.17 + k * 0.7) * 0.4 + turns * (Math.PI / 2) * dir,
        )
        room.hinges.forEach((hinge, fi) => {
          hinge.rotation.x = -Math.max(0, Math.sin(t * 0.45 + k * 0.9 + fi * 2.1)) * 0.75
        })
      })

      const polar = smoothstep(4.4, 9.4, t)
      const ang = t * 0.35
      const sep = 3.9 * polar
      ;(peopleMat.uniforms.uCenterA!.value as THREE.Vector3).set(
        Math.cos(ang) * sep,
        Math.sin(t * 0.5) * 0.6,
        Math.sin(ang) * sep,
      )
      peopleMat.uniforms.uTime!.value = t
      peopleMat.uniforms.uPolar!.value = polar
      peopleMat.uniforms.uFade!.value = 1 - smoothstep(12.8, 14.6, t)
      peopleMat.uniforms.uPx!.value = frame.pixelHeight

      const since = t - WAVE_T
      wave.visible = since > 0 && since < 3.6
      wave.scale.setScalar(Math.max(0.01, since * WAVE_SPEED))
      waveMat.uniforms.uStrength!.value = since > 0 ? (1 - smoothstep(0.2, 3.4, since)) * 1.6 : 0
      coreLight.intensity = 30 + (since > 0 ? 260 * Math.exp(-since * 2.2) : 0)
      const pulse = 1 + 0.12 * Math.sin(t * 3.1)
      halo.scale.setScalar(2.6 * pulse + (since > 0 ? 6 * Math.exp(-since * 1.8) : 0))

      // Camera: in from the dark, orbiting inward, then a dive into the idea.
      const orbit = 0.6 + t * 0.13
      const radius = lerp(24, 6.2, easeOutCubic(invLerp(0, 12.8, t)))
      shot.pos.set(Math.sin(orbit) * radius, 1.2 + Math.sin(t * 0.4) * 1.6, Math.cos(orbit) * radius)
      shot.target.set(0, 0, 0)
      if (t > 12.8) {
        const ds = invLerp(12.8, 16, t)
        const d0 = 6.2
        const dist = d0 * Math.exp(-Math.log(d0 / 0.05) * easeInQuad(ds))
        tmp.copy(shot.pos).normalize()
        shot.pos.copy(tmp).multiplyScalar(dist)
        shot.near = Math.max(0.005, Math.min(0.05, dist * 0.2))
        shot.zoom = smoothstep(0.45, 1, ds) * 0.85
      }
      shot.roll =
        (Math.PI / 2) * easeInOutCubic(invLerp(3.3, 4.6, t)) -
        (Math.PI / 2) * easeInOutCubic(invLerp(7.3, 8.8, t)) +
        Math.PI * easeInQuad(invLerp(12.8, 16, t))
      shot.fov = lerp(55, 76, easeInQuad(invLerp(12.8, 16, t)))
      shot.exposure = 0.95
      shot.bloomStrength = 0.6 + (since > 0 ? 0.6 * Math.exp(-since * 1.5) : 0)
      shot.bloomRadius = 0.55
      shot.bloomThreshold = 0.85
      shot.defocus = 0.7 * (1 - smoothstep(0.2, 2.4, t))
      shot.ca = 0.003 + (since > 0 ? 0.01 * Math.exp(-since * 3) : 0)
      shot.vignette = 0.6
      shot.grain = 0.06
      shot.far = 200
    },
    dispose() {
      bag.dispose()
      disposeScene(scene)
    },
  }
}
