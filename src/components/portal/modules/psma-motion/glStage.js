/* ============================================================================
   PSMA MOTION — WEBGL2 MIP COMPOSITOR
   ----------------------------------------------------------------------------
   Draws the scan: depth-cued bone, PET, probability heat and every mask layer,
   composited per pixel from texture arrays (one layer per rotation angle).

   Why WebGL and not canvas 2D (logged in the review): the frames are packed —
   RGB = PET / body silhouette + bone / probability, one byte = seven mask
   bits — so 180 angles x 2 cases fit in GPU memory once, and the per-pixel
   colouring, outlines and verdict recolouring run in a shader at 60 fps. Every
   draw is a pure function of the uniforms handed to draw(), which the GSAP
   timeline sets from timeline time; nothing here reads a clock.

   Masks are read with texelFetch (no filtering) and are never resampled: at
   scale 1 one layer pixel is one stage pixel, so what is on screen is the
   exported layer, pixel for pixel.
   ========================================================================== */

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray uRgb;   // R = PET (SUV 1.0433..12), G = body + depth-cued bone, B = ensemble probability,
                               // A = body thickness along the ray (0..600 mm)
uniform sampler2DArray uMask;  // bit field (see manifest masks.bits)
uniform sampler2DArray uAnt;   // anterior probability MIPs: layers 0-4 = folds, 5 = mean
uniform sampler2DArray uAcc;   // fold 0's real sliding-window accumulator, one layer per window
uniform int uAccLayer;         // >= 0 while the sweep runs and the replay exists
uniform int uAngle;
uniform int uAngle2;           // next angle layer, for the base image only (beat 1, no masks shown)
uniform float uAngleMix;       // 0 = uAngle alone; masks always use uAngle
uniform vec2 uOrigin;          // stage px of the layer's top-left corner
uniform float uScale;          // stage px per layer px
uniform vec2 uLayer;           // layer W, H
uniform vec2 uCanvas;          // canvas size in device px
uniform float uDpr;

uniform vec3 uBg, uBody, uBone, uPetInk, uPred, uPredEdge, uGtRing, uGtRingOuter, uFound, uMissed, uFa;
uniform vec3 uHeat0, uHeat1, uHeat2, uRemovedCol;
uniform float uBodyA, uBoneA, uPetA, uPetLo, uPetKnee, uPetHi, uPetGamma, uDim, uFeather;
uniform float uHeatA, uHeatFold, uThreshA, uRemovedA, uPredA, uEdgeA, uGtA, uVerdictA;
uniform float uWipe;           // threshold: 0 = kept regions in the heat's top colour, 1 = prediction blue
uniform float uRemovedHi;      // size filter: removed specks shown in the process colour
uniform float uFoundA, uMissedA, uFaA;
uniform int uCover;            // windows revealed (heat only shows inside them); -1 = everywhere
uniform vec4 uWin[200];        // window rects in layer px (col0, row0, col1, row1)

out vec4 outColor;

uint bitsAt(ivec2 q) {
  if (q.x < 0 || q.y < 0 || q.x >= int(uLayer.x) || q.y >= int(uLayer.y)) return 0u;
  return uint(texelFetch(uMask, ivec3(q, uAngle), 0).r * 255.0 + 0.5);
}

vec3 heat(float q) {
  return q < 0.5 ? mix(uHeat0, uHeat1, q * 2.0) : mix(uHeat1, uHeat2, (q - 0.5) * 2.0);
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) / uDpr;
  vec2 lp = (sp - uOrigin) / uScale;
  vec3 col = uBg;
  if (lp.x < 0.0 || lp.y < 0.0 || lp.x >= uLayer.x || lp.y >= uLayer.y) {
    outColor = vec4(col, 1.0);
    return;
  }
  ivec2 ip = ivec2(floor(lp));
  vec4 t = texture(uRgb, vec3(lp / uLayer, float(uAngle)));
  uint b = bitsAt(ip);
  // body silhouette (G > 0) shaded by thickness (A), depth-cued bone (G = 1 + 254 * bone),
  // decoded per layer; while no mask is shown (beat 1) two neighbouring angle layers are
  // cross-dissolved by the fractional angle, so the slow ends of a turn do not step
  float g0 = t.g * 255.0;
  float sil = clamp(g0, 0.0, 1.0);
  float boneV = max(g0 - 1.0, 0.0) / 254.0;
  float thickV = t.a;
  float petV = t.r;
  if (uAngleMix > 0.0) {
    vec4 t2 = texture(uRgb, vec3(lp / uLayer, float(uAngle2)));
    float g1 = t2.g * 255.0;
    sil = mix(sil, clamp(g1, 0.0, 1.0), uAngleMix);
    boneV = mix(boneV, max(g1 - 1.0, 0.0) / 254.0, uAngleMix);
    thickV = mix(thickV, t2.a, uAngleMix);
    petV = mix(petV, t2.r, uAngleMix);
  }

  // The base image fades out over the first and last rows of the field of view, so the
  // scanner's noisy end planes read as a vignette, not as beads. Masks are never feathered.
  float edge = smoothstep(0.0, uFeather, lp.y) * smoothstep(0.0, uFeather, uLayer.y - lp.y);
  float thick = smoothstep(0.02, 0.55, thickV);
  col = mix(col, uBody, sil * uBodyA * (0.45 + 0.55 * thick) * edge);
  col = mix(col, uBone, clamp(boneV * 1.25, 0.0, 1.0) * uBoneA * edge);
  // PET: linear-ish up to the knee, then a soft shoulder so organs keep some texture
  float suv = 1.0433 + petV * (12.0 - 1.0433);
  float lowPart = pow(clamp((suv - uPetLo) / (uPetKnee - uPetLo), 0.0, 1.0), uPetGamma);
  float highPart = clamp((suv - uPetKnee) / (uPetHi - uPetKnee), 0.0, 1.0);
  float p = 0.84 * lowPart + 0.16 * highPart;
  col = mix(col, uPetInk, p * uPetA * edge);
  col = mix(col, uBg, uDim);

  // probability heat (anterior beat). During the sweep: fold 0's running estimate from
  // the replayed accumulator (zero where no window has landed yet) when it exists, else
  // the final fold-0 map gated by the windows processed so far. Then fold 0 -> mean.
  if (uHeatA > 0.0) {
    float qf = texture(uAnt, vec3(lp / uLayer, 0.0)).r;
    float qm = texture(uAnt, vec3(lp / uLayer, 5.0)).r;
    float q = mix(qf, qm, uHeatFold);
    float cover = 1.0;
    if (uCover >= 0 && uAccLayer >= 0) {
      q = texture(uAcc, vec3(lp / uLayer, float(uAccLayer))).r;
    } else if (uCover >= 0) {
      cover = 0.0;
      for (int i = 0; i < 200; i++) {
        if (i >= uCover) break;
        vec4 w = uWin[i];
        if (lp.x >= w.x && lp.x < w.z && lp.y >= w.y && lp.y < w.w) { cover = 1.0; break; }
      }
    }
    float a = smoothstep(0.03, 0.35, q) * cover * uHeatA * (1.0 - uThreshA);
    col = mix(col, heat(q), a);
  }

  bool pred = (b & 1u) != 0u;
  bool gt = (b & 2u) != 0u;
  bool missed = (b & 8u) != 0u;
  bool touch = (b & 16u) != 0u;
  bool fa = (b & 32u) != 0u;
  bool removed = (b & 64u) != 0u;

  // neighbourhood, 5 x 5: a 2-px keyline round every fill (so a fill holds against
  // uptake and against the dark ground alike), and a two-tone ring outside the ground
  // truth (light 1 px next to the lesion, a dark keyline beyond it)
  uint fillBits = 0u;
  if (uThreshA > 0.0) fillBits |= 1u;
  if (uThreshA > 0.0 && uRemovedA > 0.5) fillBits |= 64u;   // removed specks lose their keyline as they dissolve
  if (uPredA > 0.0) fillBits |= 1u;
  if (uVerdictA > 0.0) fillBits |= 16u | 8u | 32u;
  bool nearFill = false;
  bool gtInner = false;
  bool gtOuter = false;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      uint nb = bitsAt(ip + ivec2(dx, dy));
      if ((nb & fillBits) != 0u) nearFill = true;
      if ((nb & 2u) != 0u) {
        int d2 = dx * dx + dy * dy;
        if (d2 <= 2) gtInner = true;
        else if (d2 <= 8) gtOuter = true;
      }
    }
  }
  bool inFill = (b & fillBits) != 0u;

  // binary output of the threshold (prob > 0.5 = pred | removed): it appears in the heat's
  // top colour as the rest of the heat fades, then a band sweeping down turns it to the
  // prediction blue (blue means model output from here on). Kept and removed are drawn
  // separately, so a kept pixel that a removed speck also covers in projection keeps its
  // colour when the speck dissolves.
  if (uThreshA > 0.0) {
    float band = 0.06;
    float toBlue = clamp((uWipe * (1.0 + band) - lp.y / uLayer.y) / band, 0.0, 1.0);
    vec3 binCol = mix(uHeat2, uPred, toBlue);
    if (pred) col = mix(col, binCol, uThreshA);
    else if (removed) col = mix(col, binCol, uThreshA * uRemovedA);
    // the size filter: removed specks show in the process colour, over kept regions too,
    // while their rings show; they dissolve to whatever is behind them
    if (removed && uRemovedHi > 0.0) col = mix(col, uRemovedCol, uRemovedHi * uRemovedA * uThreshA);
  }
  // keyline: drawn outside the fills only, at the strength of whatever fill is showing
  float fillVisible = max(uThreshA, uEdgeA * max(uPredA, uVerdictA));
  if (!inFill && nearFill) col = mix(col, uPredEdge, fillVisible);
  if (pred) col = mix(col, uPred, uPredA);
  // verdict: the fill stays the prediction (regions that touch a lesion keep the model's
  // blue, false alarms turn yellow); missed lesions have no prediction, so their own
  // outline is filled vermillion. Later wins: touching < missed < false alarm.
  if (touch) col = mix(col, uFound, uVerdictA * uFoundA);
  if (missed) col = mix(col, uMissed, uVerdictA * uMissedA);
  if (fa) col = mix(col, uFa, uVerdictA * uFaA);
  // ground-truth ring sits outside the lesion, never over it
  if (!gt && gtInner) col = mix(col, uGtRing, uGtA);
  else if (!gt && gtOuter) col = mix(col, uGtRingOuter, uGtA);

  outColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

export function createGlStage(canvas) {
  // One stage per canvas: React StrictMode mounts effects twice in dev, and a
  // second getContext on the same canvas must not meet a disposed stage.
  if (canvas.psmStage) return canvas.psmStage;
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true, // screenshots read the drawn frame, never a cleared buffer
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser');

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    const name = info.name.replace(/\[0\]$/, '');
    U[name] = gl.getUniformLocation(prog, info.name);
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  const cases = new Map(); // slot -> { rgb, mask, ant, W, H, N }

  function makeArray(format, internal, W, H, N, filter) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, internal, W, H, N);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex, format };
  }

  function allocCase(slot, W, H, N, nAcc = 0) {
    const old = cases.get(slot);
    if (old) [old.rgb, old.mask, old.ant, old.acc].forEach((t) => gl.deleteTexture(t.tex));
    const c = {
      W, H, N, nAcc,
      rgb: makeArray(gl.RGBA, gl.RGBA8, W, H, N, gl.LINEAR),
      mask: makeArray(gl.RED, gl.R8, W, H, N, gl.NEAREST),
      ant: makeArray(gl.RED, gl.R8, W, H, 6, gl.LINEAR),
      acc: makeArray(gl.RED, gl.R8, nAcc ? W : 1, nAcc ? H : 1, Math.max(1, nAcc), gl.LINEAR),
    };
    cases.set(slot, c);
    return c;
  }

  function upload(slot, kind, layer, bitmap) {
    const c = cases.get(slot);
    const t = c[kind];
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t.tex);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, c.W, c.H, 1, t.format, gl.UNSIGNED_BYTE, bitmap);
  }

  function resize(w, h, dpr) {
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    gl.viewport(0, 0, W, H);
  }

  const v3 = (name, c) => gl.uniform3f(U[name], c[0], c[1], c[2]);
  const f1 = (name, v) => gl.uniform1f(U[name], v);

  // p: everything the frame depends on (see Stage.jsx renderFrame)
  function draw(slot, p, look, dpr) {
    const c = cases.get(slot);
    if (!c) return;
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, c.rgb.tex);
    gl.uniform1i(U.uRgb, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, c.mask.tex);
    gl.uniform1i(U.uMask, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, c.ant.tex);
    gl.uniform1i(U.uAnt, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, c.acc.tex);
    gl.uniform1i(U.uAcc, 3);
    gl.uniform1i(U.uAccLayer, c.nAcc && p.accLayer >= 0 ? Math.min(c.nAcc - 1, p.accLayer) : -1);

    gl.uniform1i(U.uAngle, p.angleIndex);
    gl.uniform1i(U.uAngle2, p.angleIndex2 ?? p.angleIndex);
    f1('uAngleMix', p.angleMix ?? 0);
    gl.uniform2f(U.uOrigin, p.originX, p.originY);
    f1('uScale', p.scale);
    gl.uniform2f(U.uLayer, c.W, c.H);
    gl.uniform2f(U.uCanvas, canvas.width, canvas.height);
    f1('uDpr', dpr);

    const g = look.gl;
    v3('uBg', g.bg); v3('uBody', g.body); v3('uBone', g.bone); v3('uPetInk', g.petInk);
    v3('uPred', g.pred); v3('uPredEdge', g.predEdge); v3('uGtRing', g.gtRing);
    v3('uGtRingOuter', g.gtRingOuter ?? g.predEdge);
    v3('uFound', g.found); v3('uMissed', g.missed); v3('uFa', g.falseAlarm);
    v3('uHeat0', g.prob[0]); v3('uHeat1', g.prob[1]); v3('uHeat2', g.prob[2]);
    v3('uRemovedCol', g.removed ?? g.window);

    f1('uBodyA', p.body); f1('uBoneA', p.bone); f1('uPetA', p.pet);
    f1('uPetLo', p.petLo); f1('uPetKnee', p.petKnee); f1('uPetHi', p.petHi); f1('uPetGamma', p.petGamma);
    f1('uDim', p.dim); f1('uFeather', p.feather ?? 12);
    f1('uHeatA', p.heat); f1('uHeatFold', p.heatMean); f1('uThreshA', p.thresh); f1('uRemovedA', p.removed);
    f1('uPredA', p.pred); f1('uEdgeA', p.edge); f1('uGtA', p.gt); f1('uVerdictA', p.verdict);
    f1('uFoundA', p.found); f1('uMissedA', p.missed); f1('uFaA', p.fa);
    f1('uWipe', p.wipe ?? 1); f1('uRemovedHi', p.removedHi ?? 0);
    gl.uniform1i(U.uCover, p.cover);
    if (p.windows) gl.uniform4fv(U.uWin, p.windows);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function finish() {
    gl.finish();
  }

  // Frees the case textures (hundreds of MB); the context itself stays with the canvas.
  function dispose() {
    cases.forEach((c) => [c.rgb, c.mask, c.ant, c.acc].forEach((t) => gl.deleteTexture(t.tex)));
    cases.clear();
  }

  const stage = { gl, allocCase, upload, resize, draw, finish, dispose, hasCase: (s) => cases.has(s) };
  canvas.psmStage = stage;
  return stage;
}
