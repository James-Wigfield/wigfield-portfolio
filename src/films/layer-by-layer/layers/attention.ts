/**
 * LAYER 4 — THE ATTENTION
 * One concept, hundreds of influences. The weight on every connection shifts
 * in waves and the concept changes colour with them. Then the connections pull
 * together into the first page of a paper.
 */

import * as THREE from 'three'
import { Bag, disposeScene, type BuildContext, type Layer } from '../core'
import { easeOutExpo, invLerp, lerp, rng, smoothstep } from '../math'
import { PAPER_TITLE } from '../timeline'
import { displayFont, glowTexture, makeCanvas, monoFont, toTexture } from '../textures'

const CARD_W = 6.4
const CARD_H = 8.3
const MORPH_START = 9
const MORPH_END = 12.4

const GROUP_COLORS = [new THREE.Color(0.1, 0.95, 1.4), new THREE.Color(1.5, 0.12, 0.85), new THREE.Color(0.75, 1.45, 0.15)]

function groupWeights(t: number, out: THREE.Vector3) {
  const g = (k: number) => 0.15 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.85 + k * 2.094), 2)
  return out.set(g(0), g(1), g(2))
}

/** Where every line goes on the page: border, two rules, and words. */
function cardSlots(count: number) {
  const slots: [number, number, number, number][] = [] // x0, y0, x1, y1
  const x0 = -2.8
  const x1 = 2.8
  const r = rng(404)

  // Rules under the title block and above the footer.
  for (const y of [1.55, -3.55]) {
    const n = 12
    for (let i = 0; i < n; i++) slots.push([lerp(x0, x1, i / n), y, lerp(x0, x1, (i + 1) / n), y])
  }

  // Words.
  const rows = 18
  const maxWords = rows * 9
  const borderMin = 56
  const words = Math.max(0, Math.min(maxWords, count - slots.length - borderMin))
  const perRow = Math.max(1, Math.round(words / rows))
  let placed = 0
  for (let row = 0; row < rows && placed < words; row++) {
    const y = 1.05 - row * 0.25
    const paragraphEnd = row === 5 || row === 11 || row === 17
    const end = paragraphEnd ? lerp(x0, x1, 0.35 + r() * 0.25) : x1
    const n = Math.min(perRow, words - placed)
    const lens = Array.from({ length: n }, () => 0.5 + r())
    const gap = 0.09
    const total = lens.reduce((a, b) => a + b, 0)
    const scale = (end - x0 - gap * (n - 1)) / total
    let x = x0
    for (const len of lens) {
      const w = len * scale
      slots.push([x, y, x + w, y])
      x += w + gap
      placed++
    }
  }

  // Everything else traces the border.
  const border = count - slots.length
  const hw = CARD_W / 2
  const hh = CARD_H / 2
  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
    [-hw, -hh],
  ]
  const perim = 2 * (CARD_W + CARD_H)
  const at = (d: number): [number, number] => {
    let rem = ((d % perim) + perim) % perim
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!
      const b = corners[i + 1]!
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (rem <= len) {
        const f = rem / len
        return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]
      }
      rem -= len
    }
    return corners[0]!
  }
  for (let i = 0; i < border; i++) {
    const a = at((i / border) * perim)
    const b = at(((i + 1) / border) * perim - 0.001)
    slots.push([a[0], a[1], b[0], b[1]])
  }
  return slots
}

function pageTexture() {
  const W = 1024
  const H = Math.round((W * CARD_H) / CARD_W)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.clearRect(0, 0, W, H)
  const yOf = (cardY: number) => ((CARD_H / 2 - cardY) / CARD_H) * H
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(235, 240, 255, 0.7)'
  ctx.font = monoFont(22)
  const top = 'PREPRINT  ·  UNDER REVIEW'
  ctx.fillText(top, W / 2 - ctx.measureText(top).width / 2, yOf(3.45))

  let px = 168
  ctx.font = displayFont(px)
  const maxW = W - 150
  const w = ctx.measureText(PAPER_TITLE).width
  if (w > maxW) {
    px = Math.floor((px * maxW) / w)
    ctx.font = displayFont(px)
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillText(PAPER_TITLE, W / 2 - ctx.measureText(PAPER_TITLE).width / 2, yOf(2.15))

  ctx.font = monoFont(24)
  ctx.fillStyle = 'rgba(235, 240, 255, 0.8)'
  const by = 'Two friends  &  a model'
  ctx.fillText(by, W / 2 - ctx.measureText(by).width / 2, yOf(1.8))

  ctx.font = monoFont(21, 700)
  ctx.fillStyle = 'rgba(235, 240, 255, 0.9)'
  ctx.fillText('ABSTRACT', 90, yOf(1.3))
  ctx.font = monoFont(18)
  ctx.fillStyle = 'rgba(235, 240, 255, 0.55)'
  ctx.fillText('p. 1', W / 2 - ctx.measureText('p. 1').width / 2, yOf(-3.85))
  return toTexture(canvas, { anisotropy: 8 })
}

export function createAttentionLayer({ quality }: BuildContext): Layer {
  const bag = new Bag()
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const count = Math.max(200, Math.round(480 * quality.density))
  const slots = cardSlots(count)
  // Shuffle so neighbouring influences end up all over the page.
  const order = Array.from({ length: count }, (_, i) => i)
  const rs = rng(9)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rs() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }

  const aA = new Float32Array(count * 4 * 3)
  const aB = new Float32Array(count * 4 * 3)
  const aCA = new Float32Array(count * 4 * 3)
  const aCB = new Float32Array(count * 4 * 3)
  const aCorner = new Float32Array(count * 4 * 2)
  const aInfo = new Float32Array(count * 4 * 2)
  const index: number[] = []
  const nodePos = new Float32Array(count * 3)
  const nodeCard = new Float32Array(count * 3)
  const nodeInfo = new Float32Array(count * 2)
  const r = rng(31)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const th = golden * i
    const d = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad)
    const dist = 3.2 + r() * 4.6
    const b = d.clone().multiplyScalar(dist)
    const a = d.clone().multiplyScalar(0.55)
    const group = Math.floor(((Math.atan2(d.z, d.x) + Math.PI) / (Math.PI * 2)) * 3 + d.y * 0.8 + 3) % 3
    const seed = r()
    const slot = slots[order[i]!]!
    nodePos.set([b.x, b.y, b.z], i * 3)
    nodeCard.set([slot[2], slot[3], 0], i * 3)
    nodeInfo.set([seed, group], i * 2)
    for (let v = 0; v < 4; v++) {
      const k = i * 4 + v
      aA.set([a.x, a.y, a.z], k * 3)
      aB.set([b.x, b.y, b.z], k * 3)
      aCA.set([slot[0], slot[1], 0], k * 3)
      aCB.set([slot[2], slot[3], 0], k * 3)
      aCorner.set([v < 2 ? 0 : 1, v % 2 === 0 ? -1 : 1], k * 2)
      aInfo.set([seed, group], k * 2)
    }
    const o = i * 4
    index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3)
  }

  const groupW = new THREE.Vector3()
  const waveDir = new THREE.Vector3()
  const cardGroup = new THREE.Group()
  scene.add(cardGroup)
  const shared = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uG: { value: groupW },
    uWaveDir: { value: waveDir },
    uCard: { value: cardGroup.matrixWorld },
    uC0: { value: GROUP_COLORS[0] },
    uC1: { value: GROUP_COLORS[1] },
    uC2: { value: GROUP_COLORS[2] },
    uPx: { value: 800 },
  }
  const WEIGHT_GLSL = /* glsl */ `
    uniform float uTime;
    uniform float uMorph;
    uniform vec3 uG;
    uniform vec3 uWaveDir;
    uniform mat4 uCard;
    uniform vec3 uC0;
    uniform vec3 uC1;
    uniform vec3 uC2;
    float weightOf(vec3 dir, float seed, float group) {
      float g = group < 0.5 ? uG.x : (group < 1.5 ? uG.y : uG.z);
      float w = 0.5 + 0.5 * sin(dot(dir, uWaveDir) * 3.2 - uTime * 2.0 + seed * 6.28);
      return g * (0.3 + 0.7 * w);
    }
    vec3 colorOf(float group) { return group < 0.5 ? uC0 : (group < 1.5 ? uC1 : uC2); }
    float morphOf(float seed) {
      float m = smoothstep(seed * 0.4, seed * 0.4 + 0.6, uMorph);
      return m * m * (3.0 - 2.0 * m);
    }
  `

  const lineGeo = bag.add(new THREE.BufferGeometry())
  lineGeo.setAttribute('position', new THREE.BufferAttribute(aB, 3))
  lineGeo.setAttribute('aA', new THREE.BufferAttribute(aA, 3))
  lineGeo.setAttribute('aB', new THREE.BufferAttribute(aB, 3))
  lineGeo.setAttribute('aCA', new THREE.BufferAttribute(aCA, 3))
  lineGeo.setAttribute('aCB', new THREE.BufferAttribute(aCB, 3))
  lineGeo.setAttribute('aCorner', new THREE.BufferAttribute(aCorner, 2))
  lineGeo.setAttribute('aInfo', new THREE.BufferAttribute(aInfo, 2))
  lineGeo.setIndex(index)
  const lineMat = bag.add(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: shared,
      vertexShader: /* glsl */ `
        ${WEIGHT_GLSL}
        attribute vec3 aA;
        attribute vec3 aB;
        attribute vec3 aCA;
        attribute vec3 aCB;
        attribute vec2 aCorner;
        attribute vec2 aInfo;
        varying vec3 vColor;
        varying float vSide;
        varying float vAlong;
        varying float vSeed;
        varying float vW;
        varying float vM;
        void main() {
          float m = morphOf(aInfo.x);
          vec3 cA = (uCard * vec4(aCA, 1.0)).xyz;
          vec3 cB = (uCard * vec4(aCB, 1.0)).xyz;
          vec3 A = mix(aA, cA, m);
          vec3 B = mix(aB, cB, m);
          B += vec3(-aB.z, 0.0, aB.x) * 0.22 * sin(m * 3.14159);
          vec3 P = mix(A, B, aCorner.x);
          float w = weightOf(normalize(aB), aInfo.x, aInfo.y);
          float thick = mix(0.005 + 0.04 * w * w, 0.012, m);
          vec3 toCam = normalize(cameraPosition - P);
          vec3 sideV = normalize(cross(B - A, toCam) + vec3(1e-6));
          P += sideV * aCorner.y * thick;
          vColor = mix(colorOf(aInfo.y), vec3(0.9, 0.95, 1.05), m * 0.85);
          vSide = aCorner.y;
          vAlong = aCorner.x;
          vSeed = aInfo.x;
          vW = mix(w, 0.6, m);
          vM = m;
          gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vColor;
        varying float vSide;
        varying float vAlong;
        varying float vSeed;
        varying float vW;
        varying float vM;
        void main() {
          float core = 1.0 - vSide * vSide;
          float glow = core * core;
          float pulse = smoothstep(0.92, 1.0, fract(vAlong + uTime * 0.7 + vSeed * 3.0)) * (1.0 - vM);
          // Hundreds of lines meet at the core: fade their inner ends so it doesn't white out.
          float inner = mix(smoothstep(0.0, 0.45, vAlong), 1.0, vM);
          float b = (0.03 + 0.75 * vW * vW) * (1.0 - vM) + 0.55 * vM;
          gl_FragColor = vec4(vColor * (b * glow + pulse * 1.2 * vW) * inner, 1.0);
        }
      `,
    }),
  )
  const lines = new THREE.Mesh(lineGeo, lineMat)
  lines.frustumCulled = false
  scene.add(lines)

  const nodeGeo = bag.add(new THREE.BufferGeometry())
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3))
  nodeGeo.setAttribute('aCB', new THREE.BufferAttribute(nodeCard, 3))
  nodeGeo.setAttribute('aInfo', new THREE.BufferAttribute(nodeInfo, 2))
  const nodeMat = bag.add(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: shared,
      vertexShader: /* glsl */ `
        ${WEIGHT_GLSL}
        uniform float uPx;
        attribute vec3 aCB;
        attribute vec2 aInfo;
        varying vec3 vColor;
        varying float vA;
        void main() {
          float m = morphOf(aInfo.x);
          vec3 cB = (uCard * vec4(aCB, 1.0)).xyz;
          vec3 p = mix(position, cB, m) + vec3(-position.z, 0.0, position.x) * 0.22 * sin(m * 3.14159);
          float w = weightOf(normalize(position), aInfo.x, aInfo.y);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.05 + 0.13 * w) * projectionMatrix[1][1] * uPx * 0.5 / max(-mv.z, 0.05);
          vColor = colorOf(aInfo.y) * (0.35 + 1.3 * w);
          vA = 1.0 - m;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * a * a * vA, 1.0);
        }
      `,
    }),
  )
  const nodes = new THREE.Points(nodeGeo, nodeMat)
  nodes.frustumCulled = false
  scene.add(nodes)

  // The concept at the centre.
  const coreColor = new THREE.Color()
  const coreMat = bag.add(new THREE.MeshBasicMaterial({ color: new THREE.Color() }))
  const core = new THREE.Mesh(bag.add(new THREE.IcosahedronGeometry(0.42, 4)), coreMat)
  scene.add(core)
  const haloMat = bag.add(
    new THREE.SpriteMaterial({
      map: bag.add(glowTexture(256)),
      color: new THREE.Color(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  )
  const halo = new THREE.Sprite(haloMat)
  scene.add(halo)

  // The page's printed text, which fades in once the lines have settled.
  const pageMat = bag.add(
    new THREE.MeshBasicMaterial({
      map: bag.add(pageTexture()),
      transparent: true,
      depthWrite: false,
      opacity: 0,
      color: new THREE.Color(0.8, 0.81, 0.85),
    }),
  )
  const page = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(CARD_W, CARD_H)), pageMat)
  cardGroup.add(page)

  const front = new THREE.Vector3()
  const hashFlicker = (t: number) => {
    const s = Math.sin(Math.floor(t * 24) * 91.7) * 43758.5
    return s - Math.floor(s)
  }

  return {
    scene,
    update(t, shot, frame) {
      groupWeights(t, groupW)
      waveDir.set(Math.sin(t * 0.3), 0.4, Math.cos(t * 0.3)).normalize()
      const morph = smoothstep(MORPH_START, MORPH_END, t)
      shared.uTime.value = t
      shared.uMorph.value = morph
      shared.uPx.value = frame.pixelHeight

      cardGroup.rotation.set(-0.04 + Math.sin(t * 0.4) * 0.02, Math.sin(t * 0.3) * 0.12 * (1 - morph * 0.6), 0)
      cardGroup.position.set(0, Math.sin(t * 0.5) * 0.06, 0)
      cardGroup.updateMatrixWorld(true)

      // Core colour is the weighted mix of whatever it's attending to.
      coreColor.setRGB(0, 0, 0)
      const sum = groupW.x + groupW.y + groupW.z
      ;[groupW.x, groupW.y, groupW.z].forEach((w, k) => {
        const c = GROUP_COLORS[k]!
        coreColor.r += (c.r * w) / sum
        coreColor.g += (c.g * w) / sum
        coreColor.b += (c.b * w) / sum
      })
      coreMat.color.copy(coreColor).multiplyScalar(1.6)
      haloMat.color.copy(coreColor)
      const coreScale = 1 - smoothstep(0, 0.45, morph)
      core.scale.setScalar(Math.max(0.0001, coreScale) * (1 + 0.06 * Math.sin(t * 4)))
      core.visible = coreScale > 0.001
      halo.scale.setScalar(3.2 * coreScale + 0.0001)
      halo.visible = core.visible

      const flick = t < 13.0 ? 0.6 + 0.4 * hashFlicker(t) : 1
      pageMat.opacity = smoothstep(11.6, 12.8, t) * flick

      // Camera: out of the light, a slow orbit, then square on to the page.
      const out = easeOutExpo(invLerp(0, 3.2, t))
      const dist = lerp(0.7, 19, out) - 2.5 * smoothstep(3.2, 9, t)
      const a = 0.9 - t * 0.075
      shot.pos.set(Math.sin(a) * dist, dist * 0.16 + Math.sin(t * 0.35) * 0.6, Math.cos(a) * dist)
      shot.target.set(0, 0, 0)
      const fov = 42
      const tanH = frame.tanHalf(fov)
      const fit = Math.max((CARD_H / 2 + 0.7) / tanH, (CARD_W / 2 + 0.55) / (tanH * frame.aspect))
      const wC = smoothstep(MORPH_START, MORPH_END + 0.2, t)
      const push = 1 - 0.035 * smoothstep(MORPH_END, 15, t)
      shot.pos.lerp(front.set(0, 0.05, fit * push), wC)
      shot.fov = fov
      shot.near = t < 1 ? 0.02 : 0.05
      shot.far = 120
      shot.handheld = 1 - 0.6 * wC
      shot.exposure = 1.0
      shot.bloomStrength = lerp(0.8, 0.45, wC)
      shot.bloomRadius = 0.55
      shot.bloomThreshold = lerp(0.55, 0.9, wC)
      shot.defocus = 0.4 * (smoothstep(10.6, 11.2, t) - smoothstep(11.4, 12.4, t))
      shot.ca = 0.0025
      shot.vignette = 0.5
      shot.grain = 0.05
    },
    dispose() {
      bag.dispose()
      disposeScene(scene)
    },
  }
}
