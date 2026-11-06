/**
 * LAYER 1 — THE REPO
 * An endless folder tree in blueprint light. Folders flicker filled/empty — a
 * binary wave — until the structure decodes, letter by letter, into a message
 * built out of the folders themselves. Then the floor falls away.
 */

import * as THREE from 'three'
import { Bag, disposeScene, fogUniforms, type BuildContext, type Layer } from '../core'
import { easeInCubic, invLerp, lerp, rng, smoothstep, track3, type Key3 } from '../math'
import { DECODE_START, DECODE_STEP, MESSAGE } from '../timeline'
import { displayFont, glowTexture, makeCanvas } from '../textures'

const LETTER_Z = -70
const LETTER_Y = 13
const LETTER_H = 8
const FALL_T = 14.5
const FALL_SPEED = 16
const FALL_RECT = new THREE.Vector4(-30, -92, 30, 2) // minX, minZ, maxX, maxZ
const TILE = 1.5
const CYAN = new THREE.Color(0.22, 0.8, 1.0)

const GLSL_COMMON = /* glsl */ `
  uniform float uTime;
  uniform float uFallT;
  uniform vec2 uFallC;
  uniform float uFallSpeed;
  uniform vec4 uFallRect;
  float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  vec3 rotAxis(vec3 v, vec3 axis, float a) {
    float c = cos(a); float s = sin(a);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }
  float fallAge(vec2 xz) {
    if (uFallT < 0.0) return -1.0;
    if (xz.x < uFallRect.x || xz.x > uFallRect.z || xz.y < uFallRect.y || xz.y > uFallRect.w) return -1.0;
    return uTime - uFallT - length(xz - uFallC) / uFallSpeed;
  }
`

const GLSL_GRID = /* glsl */ `
  float gridLine(vec2 p, float spacing, float width) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 fw = fwidth(p) * 1.5;
    vec2 l = 1.0 - smoothstep(vec2(width), vec2(width) + fw, g);
    return max(l.x, l.y);
  }
  vec3 blueprint(vec2 p, vec3 color, float front) {
    float minor = gridLine(p, 1.5, 0.012);
    float major = gridLine(p, 7.5, 0.03);
    vec3 col = vec3(0.006, 0.02, 0.034);
    col += color * (minor * 0.16 + major * 0.5);
    col += color * exp(-abs(p.y - front) * 0.5) * 0.5 * (0.4 + major);
    return col;
  }
`

const BOX_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  uniform float uGain;
  varying vec2 vUv;
  varying vec3 vN;
  varying float vLit;
  varying float vFlash;
  void main() {
    vec2 e2 = min(vUv, 1.0 - vUv);
    float e = min(e2.x, e2.y);
    float fw = fwidth(e) * 1.5;
    float edge = 1.0 - smoothstep(0.05, 0.05 + fw, e);
    float shade = 0.5 + 0.5 * max(vN.y, 0.0) + 0.2 * abs(vN.x);
    vec3 col = vec3(0.01, 0.024, 0.04) * shade;
    col += uColor * vLit * (0.16 + 0.32 * shade) * uGain;
    col += uColor * edge * (0.32 + 2.1 * vLit + 3.0 * vFlash) * uGain;
    col += vFlash * 0.2 * uGain;
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`

interface Glyph {
  cols: number
  cells: [number, number][]
}

function sampleGlyphs(cellPx: number) {
  const px = 160
  const { canvas, ctx } = makeCanvas(220, 220)
  ctx.font = displayFont(px)
  const capH = ctx.measureText('E').actualBoundingBoxAscent
  const rows = Math.round(capH / cellPx)
  const base = 200
  const map = new Map<string, Glyph>()
  for (const ch of new Set(MESSAGE.replace(/ /g, ''))) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(ch, 4, base)
    const w = ctx.measureText(ch).width
    const cols = Math.max(1, Math.round(w / cellPx))
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const cells: [number, number][] = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = Math.floor(4 + (i + 0.5) * (w / cols))
        const y = Math.floor(base - capH + (j + 0.5) * (capH / rows))
        if (data[(y * canvas.width + x) * 4 + 3]! > 120) cells.push([i, rows - 1 - j])
      }
    }
    map.set(ch, { cols, cells })
  }
  return { map, rows }
}

interface Placed {
  ch: string
  /** Bottom-left of the letter, world units. */
  x: number
  y: number
  width: number
}

function layoutLines(lines: string[], glyphs: Map<string, Glyph>, rows: number, v: number) {
  const gap = 1
  const space = 4
  const lineH = (rows + 5) * v
  const blockH = lines.length * rows * v + (lines.length - 1) * 5 * v
  // Keep the bottom line (and its row of bits) clear of the floor.
  const cy = Math.max(LETTER_Y, blockH / 2 + 3 * v + 1.5)
  const top = cy + blockH / 2
  const placed: Placed[] = []
  let maxW = 0
  lines.forEach((line, li) => {
    let cells = 0
    for (const ch of line) cells += (ch === ' ' ? space : glyphs.get(ch)!.cols) + gap
    cells -= gap
    const w = cells * v
    maxW = Math.max(maxW, w)
    let x = -w / 2
    const y = top - rows * v - li * lineH
    for (const ch of line) {
      if (ch === ' ') {
        x += (space + gap) * v
        continue
      }
      const g = glyphs.get(ch)!
      placed.push({ ch, x, y, width: g.cols * v })
      x += (g.cols + gap) * v
    }
  })
  return { placed, w: maxW, h: blockH + 2.4 * v, cy }
}

export function createRepoLayer({ quality }: BuildContext): Layer {
  const bag = new Bag()
  const scene = new THREE.Scene()
  const fogColor = new THREE.Color(0x03101b)
  scene.background = new THREE.Color(0x02070d)
  scene.fog = new THREE.FogExp2(fogColor, 0.016)

  const common = {
    uTime: { value: 0 },
    uFallT: { value: FALL_T },
    uFallC: { value: new THREE.Vector2(0, -45) },
    uFallSpeed: { value: FALL_SPEED },
    uFallRect: { value: FALL_RECT },
  }

  // ── Ground: a blueprint grid, with a hole where the fall-away tiles sit ──
  const groundMat = bag.add(
    new THREE.ShaderMaterial({
      fog: true,
      uniforms: { ...fogUniforms(), ...common, uColor: { value: CYAN }, uFront: { value: 0 } },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        ${GLSL_GRID}
        uniform vec3 uColor;
        uniform float uFront;
        uniform vec4 uFallRect;
        varying vec3 vW;
        void main() {
          if (vW.x > uFallRect.x && vW.x < uFallRect.z && vW.z > uFallRect.y && vW.z < uFallRect.w) discard;
          gl_FragColor = vec4(blueprint(vW.xz, uColor, uFront), 1.0);
          #include <fog_fragment>
        }
      `,
    }),
  )
  const ground = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(900, 900)), groundMat)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const tilesX = Math.round((FALL_RECT.z - FALL_RECT.x) / TILE)
  const tilesZ = Math.round((FALL_RECT.w - FALL_RECT.y) / TILE)
  const tileMat = bag.add(
    new THREE.ShaderMaterial({
      fog: true,
      uniforms: { ...fogUniforms(), ...common, uColor: { value: CYAN }, uFront: { value: 0 } },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        ${GLSL_COMMON}
        attribute float aSeed;
        varying vec3 vRest;
        varying float vTop;
        void main() {
          vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vRest = wp.xyz;
          vTop = step(0.5, normal.y);
          float age = fallAge(origin.xz);
          if (age > 0.0) {
            vec3 axis = normalize(vec3(h11(aSeed * 7.0) - 0.5, 0.15, h11(aSeed * 3.0) - 0.5));
            wp.xyz = origin + rotAxis(wp.xyz - origin, axis, age * (1.0 + aSeed * 2.5));
            wp.y -= 4.9 * age * age + 0.5 * age;
          }
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        ${GLSL_GRID}
        uniform vec3 uColor;
        uniform float uFront;
        varying vec3 vRest;
        varying float vTop;
        void main() {
          vec3 col = vTop > 0.5 ? blueprint(vRest.xz, uColor, uFront) : vec3(0.004, 0.012, 0.02) + uColor * 0.05;
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    }),
  )
  const tiles = new THREE.InstancedMesh(bag.add(new THREE.BoxGeometry(TILE, 0.08, TILE)), tileMat, tilesX * tilesZ)
  const tileSeed = new Float32Array(tilesX * tilesZ)
  const m = new THREE.Matrix4()
  {
    const r = rng(17)
    let k = 0
    for (let i = 0; i < tilesX; i++) {
      for (let j = 0; j < tilesZ; j++) {
        m.makeTranslation(FALL_RECT.x + (i + 0.5) * TILE, -0.04, FALL_RECT.y + (j + 0.5) * TILE)
        tiles.setMatrixAt(k, m)
        tileSeed[k] = r()
        k++
      }
    }
  }
  tiles.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(tileSeed, 1))
  tiles.frustumCulled = false
  scene.add(tiles)

  // Far below the floor, a warm glow — the next layer, waiting.
  const glowMat = bag.add(
    new THREE.MeshBasicMaterial({
      map: bag.add(glowTexture(256)),
      color: new THREE.Color(1.6, 0.7, 0.22),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0,
    }),
  )
  const glow = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(160, 160)), glowMat)
  glow.rotation.x = -Math.PI / 2
  glow.position.set(0, -80, -45)
  scene.add(glow)

  // ── The folder tree ──
  const cols = quality.small ? 21 : 31
  const zFar = quality.small ? -190 : -240
  const rowStep = 1.4
  const indent = 1.3
  const boxes: { x: number; z: number; h: number; col: number }[] = []
  const lineVerts: number[] = []
  {
    const r = rng(101)
    for (let c = 0; c < cols; c++) {
      const x0 = (c - (cols - 1) / 2) * 6
      let depth = 0
      let prevDepth = 0
      let prevZ = 36
      for (let z = 36; z > zFar; z -= rowStep) {
        const roll = r()
        if (roll < 0.3 && depth < 3) depth++
        else if (roll > 0.68 && depth > 0) depth -= 1 + (r() > 0.8 && depth > 1 ? 1 : 0)
        const x = x0 + depth * indent
        boxes.push({ x, z, h: 0.3 + r() * 0.65, col: c })
        // ├── stub
        lineVerts.push(x - 0.65, 0.02, z, x - 0.48, 0.02, z)
        // │ guides for every level both rows share
        if (z !== 36) {
          for (let L = 0; L <= Math.min(depth, prevDepth); L++) {
            const gx = x0 + L * indent - 0.65
            lineVerts.push(gx, 0.02, prevZ, gx, 0.02, z)
          }
        }
        prevDepth = depth
        prevZ = z
      }
    }
  }

  const boxMat = bag.add(
    new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...fogUniforms(),
        ...common,
        uColor: { value: CYAN },
        uFront: { value: 60 },
        uFlicker: { value: 0 },
        uGain: { value: 1 },
      },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        ${GLSL_COMMON}
        attribute float aSeed;
        attribute float aCol;
        uniform float uFront;
        uniform float uFlicker;
        varying vec2 vUv;
        varying vec3 vN;
        varying float vLit;
        varying float vFlash;
        void main() {
          vUv = uv;
          vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          float passed = smoothstep(-0.5, 0.5, origin.z - uFront);
          float flick = step(0.5, h11(aSeed * 913.0 + floor(uTime * (5.0 + aSeed * 9.0))));
          float stream = step(0.55, h11(aCol * 17.13 + floor(origin.z / 1.4 + uTime * 4.0)));
          vLit = mix(flick * uFlicker, stream, passed);
          vFlash = exp(-abs(origin.z - uFront) * 0.45) * uFlicker;
          float age = fallAge(origin.xz);
          if (age > 0.0) {
            vec3 axis = normalize(vec3(h11(aSeed * 7.0) - 0.5, 0.3, h11(aSeed * 3.0) - 0.5));
            wp.xyz = origin + rotAxis(wp.xyz - origin, axis, age * (1.5 + aSeed * 3.0));
            wp.y -= 4.9 * age * age + 0.6 * age;
          }
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: BOX_FRAG,
    }),
  )
  const boxGeo = bag.add(new THREE.BoxGeometry(0.95, 1, 0.95))
  boxGeo.translate(0, 0.5, 0)
  const tree = new THREE.InstancedMesh(boxGeo, boxMat, boxes.length)
  const seeds = new Float32Array(boxes.length)
  const colIds = new Float32Array(boxes.length)
  {
    const r = rng(55)
    const s = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    boxes.forEach((b, i) => {
      p.set(b.x, 0, b.z)
      s.set(1, b.h, 1)
      m.compose(p, q, s)
      tree.setMatrixAt(i, m)
      seeds[i] = r()
      colIds[i] = b.col
    })
  }
  tree.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  tree.geometry.setAttribute('aCol', new THREE.InstancedBufferAttribute(colIds, 1))
  tree.frustumCulled = false
  scene.add(tree)

  const lineGeo = bag.add(new THREE.BufferGeometry())
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3))
  const lineMat = bag.add(
    new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...fogUniforms(), ...common, uColor: { value: CYAN } },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        ${GLSL_COMMON}
        varying float vAlive;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vAlive = fallAge(wp.xz) > 0.0 ? 0.0 : 1.0;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform vec3 uColor;
        varying float vAlive;
        void main() {
          if (vAlive < 0.99) discard;
          gl_FragColor = vec4(uColor * 0.55, 1.0);
          #include <fog_fragment>
        }
      `,
    }),
  )
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  lines.frustumCulled = false
  scene.add(lines)

  // ── The message, built from folders ──
  const cellPx = quality.small ? 11 : 8
  const { map: glyphs, rows } = sampleGlyphs(cellPx)
  const v = LETTER_H / rows
  const wide = layoutLines(['BE NICE', 'TO US'], glyphs, rows, v)
  const tall = layoutLines(['BE', 'NICE', 'TO', 'US'], glyphs, rows, v)
  const depthLayers = 2

  const starts: number[] = []
  const endsL: number[] = []
  const endsP: number[] = []
  const t0s: number[] = []
  const kinds: number[] = [] // 0 voxel, 1 bit (lit), 2 bit (dark)
  const sizes: number[] = []
  {
    const r = rng(77)
    wide.placed.forEach((pl, k) => {
      const pp = tall.placed[k]!
      const g = glyphs.get(pl.ch)!
      const T = DECODE_START + k * DECODE_STEP
      for (const [cx, cy] of g.cells) {
        for (let d = 0; d < depthLayers; d++) {
          starts.push(pl.x + (r() - 0.5) * 16, 0.4, LETTER_Z + 8 + r() * 22)
          endsL.push(pl.x + (cx + 0.5) * v, pl.y + (cy + 0.5) * v, LETTER_Z - d * v)
          endsP.push(pp.x + (cx + 0.5) * v, pp.y + (cy + 0.5) * v, LETTER_Z - d * v)
          t0s.push(T + r() * 0.22 + cy * 0.006)
          kinds.push(0)
          sizes.push(v * 0.92)
        }
      }
      // The letter's byte, as eight folders under it.
      const code = pl.ch.charCodeAt(0)
      for (let b = 0; b < 8; b++) {
        const bit = (code >> (7 - b)) & 1
        const fx = (b + 0.5) / 8
        const bx = pl.x + fx * pl.width
        const bpx = pp.x + fx * pp.width
        const y = pl.y - 1.5 * v
        const yp = pp.y - 1.5 * v
        starts.push(bx, y, LETTER_Z)
        endsL.push(bx, y, LETTER_Z)
        endsP.push(bpx, yp, LETTER_Z)
        t0s.push(T - 0.42)
        kinds.push(bit ? 1 : 2)
        sizes.push(Math.min(v * 0.7, (pl.width / 8) * 0.75))
      }
    })
  }
  const letterCount = t0s.length
  const letterGeo = bag.add(new THREE.BoxGeometry(1, 1, 1))
  letterGeo.setAttribute('aStart', new THREE.InstancedBufferAttribute(new Float32Array(starts), 3))
  letterGeo.setAttribute('aEndL', new THREE.InstancedBufferAttribute(new Float32Array(endsL), 3))
  letterGeo.setAttribute('aEndP', new THREE.InstancedBufferAttribute(new Float32Array(endsP), 3))
  letterGeo.setAttribute('aT0', new THREE.InstancedBufferAttribute(new Float32Array(t0s), 1))
  letterGeo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(kinds), 1))
  letterGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 1))
  const letterMat = bag.add(
    new THREE.ShaderMaterial({
      // The message stays legible at any distance: no fog on the type.
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uLayout: { value: 0 },
        uGain: { value: 0.42 },
        uColor: { value: new THREE.Color(0.45, 0.92, 1.25) },
      },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        attribute vec3 aStart;
        attribute vec3 aEndL;
        attribute vec3 aEndP;
        attribute float aT0;
        attribute float aKind;
        attribute float aSize;
        uniform float uTime;
        uniform float uLayout;
        varying vec2 vUv;
        varying vec3 vN;
        varying float vLit;
        varying float vFlash;
        void main() {
          vUv = uv;
          vN = normal;
          vec3 end = mix(aEndL, aEndP, uLayout);
          vec3 c;
          float s;
          if (aKind < 0.5) {
            float p = clamp((uTime - aT0) / 0.62, 0.0, 1.0);
            float e = 1.0 - pow(1.0 - p, 3.0);
            c = mix(aStart, end, e) + vec3(0.0, sin(p * 3.14159) * 3.0, 0.0);
            s = aSize * smoothstep(0.0, 0.12, p);
            float landed = uTime - aT0 - 0.62;
            vFlash = landed > 0.0 ? exp(-landed * 3.5) : 0.0;
            vLit = 0.75 + 0.25 * sin(uTime * 2.0 + end.x * 0.3);
          } else {
            c = end;
            float a = smoothstep(aT0, aT0 + 0.12, uTime);
            s = aSize * a;
            vLit = aKind < 1.5 ? 1.0 : 0.0;
            vFlash = exp(-max(uTime - aT0, 0.0) * 4.0) * a;
          }
          vec4 wp = vec4(c + position * s, 1.0);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: BOX_FRAG,
    }),
  )
  const letters = new THREE.InstancedMesh(letterGeo, letterMat, letterCount)
  letters.frustumCulled = false
  scene.add(letters)

  // Decode readout text, prepared once.
  const letterChars = MESSAGE.replace(/ /g, '')
  const decodedAt = (k: number) => {
    let out = ''
    let n = 0
    for (const ch of MESSAGE) {
      if (ch === ' ') out += ' '
      else {
        if (n > k) break
        out += ch
        n++
      }
    }
    return out
  }

  const kPos: Key3[] = []
  const kTgt: Key3[] = []
  const tmp = new THREE.Vector3()
  const fallPos = new THREE.Vector3()
  const fallTgt = new THREE.Vector3()

  return {
    scene,
    update(t, shot, frame) {
      const portrait = frame.aspect < 0.9
      const lay = portrait ? tall : wide
      const fovL = 52
      const tanH = frame.tanHalf(fovL)
      // Fit the message with room underneath for the caption and controls.
      // The block sits in the band between the HUD (top 12%) and the caption
      // (bottom 22%), and uses at most 90% of the width.
      const D = Math.max(lay.h / (1.32 * tanH), lay.w / (1.8 * tanH * frame.aspect))
      const endZ = LETTER_Z + D
      const aimY = lay.cy - 0.1 * D * tanH
      const endY = aimY - 2
      const fallZ = LETTER_Z + D * 0.55

      for (const mat of [groundMat, tileMat, boxMat, lineMat]) {
        mat.uniforms.uTime!.value = t
        if (mat.uniforms.uFallC) (mat.uniforms.uFallC.value as THREE.Vector2).set(0, fallZ)
      }
      const front = lerp(45, -270, smoothstep(1.4, 9.6, t))
      groundMat.uniforms.uFront!.value = front
      tileMat.uniforms.uFront!.value = front
      boxMat.uniforms.uFront!.value = front
      boxMat.uniforms.uFlicker!.value = smoothstep(0.2, 1.2, t)
      letterMat.uniforms.uTime!.value = t
      letterMat.uniforms.uLayout!.value = portrait ? 1 : 0
      glow.position.z = fallZ
      glowMat.opacity = smoothstep(FALL_T, FALL_T + 2.2, t) * 0.9

      // Camera keys depend on the frame shape, so they're rebuilt each frame.
      kPos.length = 0
      kTgt.length = 0
      kPos.push(
        [0, 0, 72, 42],
        [2.8, 0, 13, 25],
        [5.4, 1.4, 4.0, 12],
        [8.4, -0.8, 4.8, lerp(12, endZ + 5, 0.65)],
        [10.6, 0, endY, endZ + 4],
        [FALL_T, 0, endY + 0.3, endZ],
      )
      kTgt.push(
        [0, 0, 0, 34],
        [2.8, 0, 0, 6],
        [5.4, 0, 2.2, -18],
        [8.4, 0, 4.5, -48],
        [10.6, 0, aimY, LETTER_Z],
        [FALL_T, 0, aimY, LETTER_Z],
      )
      track3(Math.min(t, FALL_T), kPos, shot.pos)
      track3(Math.min(t, FALL_T), kTgt, shot.target)
      shot.fov = lerp(58, fovL, smoothstep(6, 10.6, t))

      if (t > FALL_T) {
        const s = invLerp(FALL_T + 0.3, 17, t)
        fallPos.set(0, endY * 0.75, fallZ + 4)
        shot.pos.lerp(fallPos, smoothstep(0, 0.5, s))
        shot.pos.y -= easeInCubic(invLerp(15.6, 17, t)) * 46
        fallTgt.set(0, -70, fallZ - 3)
        tmp.copy(shot.target).lerp(fallTgt, smoothstep(0.05, 0.6, s))
        shot.target.copy(tmp)
        shot.fov = lerp(fovL, 74, easeInCubic(s))
        shot.zoom = smoothstep(0.55, 1, s) * 0.8
      }
      shot.zoom = Math.max(shot.zoom, (1 - smoothstep(0, 1.8, t)) * 0.75)

      shot.exposure = 1.05
      // Glowing while it's all folders; calmer once the message has to be read.
      const reading = smoothstep(8.6, 10.4, t) * (1 - smoothstep(FALL_T + 0.4, FALL_T + 1.6, t))
      shot.bloomStrength = lerp(0.85, 0.42, reading)
      shot.bloomRadius = lerp(0.55, 0.35, reading)
      shot.bloomThreshold = lerp(0.5, 1.0, reading)
      boxMat.uniforms.uGain!.value = lerp(1, 0.55, reading)
      shot.defocus = 0.5 * (smoothstep(8.6, 9.0, t) - smoothstep(9.2, 10.2, t))
      shot.ca = 0.0022
      shot.vignette = 0.5
      shot.grain = 0.05
      shot.near = 0.1
      shot.far = 700

      // HUD: the byte being decoded, and what's been decoded so far.
      const d0 = DECODE_START - 0.45
      if (t > d0 && t < FALL_T - 0.4) {
        const k = Math.min(letterChars.length - 1, Math.floor((t - d0) / DECODE_STEP))
        const code = letterChars.charCodeAt(k).toString(2).padStart(8, '0')
        frame.hud.decode = `${code}  ${decodedAt(k)}`
      }
    },
    dispose() {
      bag.dispose()
      disposeScene(scene)
    },
  }
}
