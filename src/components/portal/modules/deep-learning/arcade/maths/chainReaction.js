/* ============================================================================
   CHAIN REACTION — MATHS + QUESTION GENERATOR (pure, seeded; Lecture 1)
   ----------------------------------------------------------------------------
   A tiny MLP, 2 inputs → 2 hidden (one activation φ) → 1 linear output:
     z_j = x₁w_{1,j} + x₂w_{2,j} + b_j        slide 4 (z = wᵀx + b), slide 8
     h_j = φ(z_j)                             φ = σ (slide 20), tanh / ReLU (21)
     ŷ  = v₁h₁ + v₂h₂ + c                     no output activation (slide 24)
     ℒ  = ½(ŷ − y)²                           slide 11's loss
   backward() is the chain rule. Only ∂ℒ/∂ŷ = ŷ − y and ∂ℒ/∂v_k = (ŷ − y)h_k
   (slide 11's (ŷ_j − y_j)x_i for a linear output) and σ′ = σ(1 − σ) (slide
   20) are printed on the slides; everything through a hidden neuron is
   beyond them, and those items carry `beyond: true` plus a `uses` tag.

   makeItems(rand, level) → the round:
     level 1  forward pass on one net (z₁, h₁, z₂, ŷ), a Figure 10-8 curve,
              slide 23's collapse (slope, intercept)
     level 2  backprop on a sigmoid net under a fuse: which step / order
              slide 19's steps, ŷ − y, ∂ℒ/∂v_k, σ′, ∂ℒ/∂z_k, ∂ℒ/∂w_{i,k}
              (beyond), and slide 11's Gradient Descent step
     level 3  four task cards (slides 24–31), a derivative curve, a
              three-layer collapse, one reverse step through tanh / ReLU
              (beyond)
   Numbers shown to the player are rounded to 2 decimals, and each answer is
   computed from exactly the numbers shown (so a careful player is exact).
   Text comes from content/chain-reaction.js; equations from lecture1.js.
   ========================================================================== */
import { EQUATIONS } from '../content/lecture1.js';
import { ACTIVATIONS, CURVE_ID, STEPS, T, COLLAPSE, HEAD, TASKS, TUNING } from '../content/chain-reaction.js';
import { receipt } from '../kit/why.js';

/* ── numbers and text ─────────────────────────────────────────────────── */
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export const subDigit = (n) => String(n).split('').map((ch) => (/[0-9]/.test(ch) ? SUBS[Number(ch)] : ch)).join('');

// round half away from zero to 2 decimals, never −0
export function r2(v) {
  const r = (Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7)) / 100;
  return r === 0 ? 0 : r;
}
// plain text (Unicode minus)
export const fmt = (v) => String(r2(v)).replace('-', '−');
// TeX number, factor (negatives bracketed), signed term (" + 0.5" / " - 0.5")
const tx = (v) => String(r2(v));
const tp = (v) => (r2(v) < 0 ? `(${tx(v)})` : tx(v));
const ts = (v) => (r2(v) < 0 ? ` - ${tx(-v)}` : ` + ${tx(v)}`);

export function fill(tpl, vars) {
  return String(tpl).replace(/%(\w+)%/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/* ── activations as the slides define them ────────────────────────────── */
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));       // slide 20
export const tanh = (z) => 2 * sigmoid(2 * z) - 1;           // slide 21: tanh(z) = 2σ(2z) − 1
export const relu = (z) => Math.max(0, z);                   // slide 21
export const heaviside = (z) => (z < 0 ? 0 : 1);             // slide 5
export const softplus = (z) => Math.log(1 + Math.exp(z));   // slide 24 (glyph only)
export const PHI = { sigmoid, tanh, relu, heaviside };

// derivatives: σ′ is printed on slide 20; the others only as curves (slide 22)
export const dSigmoid = (z) => sigmoid(z) * (1 - sigmoid(z));
export const dTanh = (z) => 1 - tanh(z) ** 2;                // beyond the slides
export const dRelu = (z) => (z > 0 ? 1 : 0);                 // beyond (undefined at 0; never asked there)
export const dHeaviside = () => 0;                           // Figure 10-8: flat 0
export const DPHI = { sigmoid: dSigmoid, tanh: dTanh, relu: dRelu, heaviside: dHeaviside };

/* ── the tiny MLP ─────────────────────────────────────────────────────── */
// net = { act, x: [x1, x2], W: [[w11, w12], [w21, w22]], b: [b1, b2], v: [v1, v2], c }
// W[i][j] is the weight from input i to hidden neuron j (slide 8's W layout).
export function forward(net, dz = [0, 0]) {
  const z = [0, 1].map((j) => net.x[0] * net.W[0][j] + net.x[1] * net.W[1][j] + net.b[j] + dz[j]);
  const h = z.map((zz) => PHI[net.act](zz));
  const yhat = net.v[0] * h[0] + net.v[1] * h[1] + net.c;
  return { z, h, yhat };
}

export const loss = (net, y, dz) => 0.5 * (forward(net, dz).yhat - y) ** 2;

export function backward(net, y) {
  const { z, h, yhat } = forward(net);
  const e = yhat - y;                                      // ∂ℒ/∂ŷ (slide 11's ŷ − y)
  const dv = h.map((hk) => e * hk);                        // ∂ℒ/∂v_k (slide 11, input h_k)
  const dc = e;                                            // ∂ℒ/∂c (beyond: slide 11 has no bias)
  const dh = net.v.map((vk) => e * vk);                    // chain rule (beyond)
  const dphi = z.map((zz) => DPHI[net.act](zz));
  const dz = dh.map((g, k) => g * dphi[k]);                // chain rule (beyond)
  const dW = net.x.map((xi) => dz.map((g) => g * xi));     // chain rule (beyond)
  return { z, h, yhat, e, dv, dc, dh, dphi, dz, dW, db: dz.slice() };
}

// a copy of net with one parameter nudged: 'v0' 'v1' 'c' 'W01' 'b1' …
export function withParam(net, key, delta) {
  const n = { ...net, x: net.x.slice(), W: net.W.map((r) => r.slice()), b: net.b.slice(), v: net.v.slice() };
  if (key === 'c') n.c += delta;
  else if (key[0] === 'v') n.v[Number(key[1])] += delta;
  else if (key[0] === 'b') n.b[Number(key[1])] += delta;
  else if (key[0] === 'W') n.W[Number(key[1])][Number(key[2])] += delta;
  else throw new Error(`unknown parameter ${key}`);
  return n;
}

// central finite difference of ℒ w.r.t. a parameter, a pre-activation ('z0') or ŷ ('yhat')
export function numGrad(net, y, key, eps = 1e-5) {
  if (key === 'yhat') {
    const yh = forward(net).yhat;
    return (0.5 * (yh + eps - y) ** 2 - 0.5 * (yh - eps - y) ** 2) / (2 * eps);
  }
  if (key[0] === 'z') {
    const k = Number(key[1]);
    const p = [0, 0];
    const m = [0, 0];
    p[k] = eps;
    m[k] = -eps;
    return (loss(net, y, p) - loss(net, y, m)) / (2 * eps);
  }
  return (loss(withParam(net, key, eps), y) - loss(withParam(net, key, -eps), y)) / (2 * eps);
}

/* Slide 23: compose linear layers (application order: first applied first). */
export function compose(layers) {
  return layers.reduce((acc, L) => ({ a: L.a * acc.a, b: L.a * acc.b + L.b }), { a: 1, b: 0 });
}

/* Curves for Figure 10-8 (both panels): polylines + markers, z in [−4, 4]. */
export function curve(fn, panel = 'act', n = 161) {
  const zs = Array.from({ length: n }, (_, i) => -4 + (8 * i) / (n - 1));
  const f = panel === 'deriv' ? DPHI[fn] : PHI[fn];
  if (fn === 'heaviside' || (fn === 'relu' && panel === 'deriv')) {
    // a jump at z = 0: two pieces; the right panel marks the jump with a ×, the left
    // panel draws only the jump line (Figure 10-8 has no marker there)
    const left = zs.filter((z) => z < 0).map((z) => [z, f(z)]);
    const right = zs.filter((z) => z > 0).map((z) => [z, f(z)]);
    left.push([0, f(-1e-9)]);
    right.unshift([0, f(1e-9)]);
    return { segments: [left, right], markers: panel === 'deriv' ? [[0, fn === 'relu' ? 1 : f(0)]] : [], jump: panel === 'act' || fn === 'relu' };
  }
  return { segments: [zs.map((z) => [z, f(z)])], markers: [], jump: false };
}
export const CURVE_RANGE = { act: [-1.2, 2.2], deriv: [-0.2, 1.2] };   // Figure 10-8's y ranges

/* ── generating nets ──────────────────────────────────────────────────── */
const X_VALS = [-1, 0.5, 1, 2];
const W_VALS = [-1, -0.5, 0.5, 1, 1.5, 2];
const B_VALS = [-1, -0.5, 0, 0.5, 1];
const V_VALS = [-2, -1, 1, 2];
const C_VALS = [-1, -0.5, 0.5, 1];

// the hand-worked net of tools/dl-arcade/check-chain-reaction.mjs (fallback)
export const HAND_NET = { act: 'sigmoid', x: [2, -1], W: [[0.5, 1], [1, 2]], b: [0, 0.5], v: [2, -1], c: 0.5 };

export function makeNet(rand, act, { firstNegative = null } = {}) {
  for (let t = 0; t < 4000; t++) {
    const net = {
      act,
      x: [rand.pick(X_VALS), rand.pick(X_VALS)],
      W: [[rand.pick(W_VALS), rand.pick(W_VALS)], [rand.pick(W_VALS), rand.pick(W_VALS)]],
      b: [rand.pick(B_VALS), rand.pick(B_VALS)],
      v: [rand.pick(V_VALS), rand.pick(V_VALS)],
      c: rand.pick(C_VALS),
    };
    const { z } = forward(net);
    if (z.some((zz) => r2(zz) !== zz)) continue;
    if (Math.abs(z[0] - z[1]) < 0.25) continue;
    if (act === 'relu') {
      if (z.some((zz) => Math.abs(zz) < 0.5 || Math.abs(zz) > 3)) continue;
      if (z[0] < 0 && z[1] < 0) continue;
      if (firstNegative === true && z[0] > 0) continue;
      if (firstNegative === false && z[0] < 0) continue;
    } else if (z.some((zz) => Math.abs(zz) > 2)) continue;
    return net;
  }
  // HAND_NET's z₁ is 0, where ReLU′ is undefined (slide 21): nudge b₁ so a ReLU net never asks it
  return act === 'relu' ? { ...HAND_NET, act, b: [1, HAND_NET.b[1]] } : { ...HAND_NET, act };
}

// what the player sees: z exact, h and ŷ to 2 decimals (ŷ from the shown h)
export function display(net) {
  const { z, h } = forward(net);
  const hd = h.map(r2);
  return { ...net, z: z.map(r2), h: hd, yhat: r2(net.v[0] * hd[0] + net.v[1] * hd[1] + net.c), y: null, e: null };
}

function graphStage(d, o = {}) {
  const show = { z: [false, false], h: [false, false], yhat: false, y: false, e: false, ...(o.show ?? {}) };
  return {
    type: 'graph',
    net: { act: d.act, x: d.x, W: d.W, b: d.b, v: d.v, c: d.c },
    vals: { z: d.z, h: d.h, yhat: d.yhat, y: d.y, e: d.e },
    show,
    ledger: o.ledger ?? [],
    target: o.target ?? null,
    hot: o.hot ?? [],
    flow: o.flow ?? null,
    inset: o.inset ?? null,
    update: o.update ?? null,
    dim: !!o.dim,
    scene: o.scene ?? null,   // the which-step scene, in words (aria text)
  };
}
const ALL = { z: [true, true], h: [true, true], yhat: true };

const pad = (negative = true, decimal = true) => ({ negative, decimal });
const mathsLines = (tpls, vars) => tpls.map((m) => {
  if (m.eq) return { tex: EQUATIONS[m.eq].tex[m.idx ?? 0] };
  if (m.tex) return { tex: fill(m.tex, vars) };
  return { text: fill(m.text, vars) };
});

/* ── level 1: the forward pass ────────────────────────────────────────── */
function zItem(d, j, show, id) {
  const J = j + 1;
  const expr = `${tp(d.x[0])} \\cdot ${tp(d.W[0][j])} + ${tp(d.x[1])} \\cdot ${tp(d.W[1][j])}${ts(d.b[j])}`;
  const givens = `x = (${fmt(d.x[0])}, ${fmt(d.x[1])}), w₁,${subDigit(J)} = ${fmt(d.W[0][j])}, w₂,${subDigit(J)} = ${fmt(d.W[1][j])}, b${subDigit(J)} = ${fmt(d.b[j])}`;
  return {
    id, kind: 'number', answer: d.z[j], tol: TUNING.tol.exact,
    concept: T.z.concept, src: T.z.src, uses: [],
    prompt: fill(T.z.prompt, { j: J }),
    sub: fill(T.z.sub, { receipt: receipt(T.z.src) }),
    promptText: fill(T.z.promptText, { J: subDigit(J), givens }),
    why: fill(T.z.why, { j: J, expr, ans: tx(d.z[j]) }),
    maths: mathsLines(T.z.maths, { j: J, expr }),
    stage: graphStage(d, { show, target: `z${j}`, hot: [`w0${j}`, `w1${j}`, `b${j}`], flow: 'fwd' }),
    pad: pad(), padLabel: `z${subDigit(J)}`,
  };
}

function hItem(d, j, show, id) {
  const J = j + 1;
  const A = ACTIVATIONS[d.act];
  const z = d.z[j];
  const curveRead = d.act !== 'relu';
  const tol = curveRead ? TUNING.tol.curve : TUNING.tol.exact;
  const whyTpl = d.act === 'sigmoid' ? T.h.whySigmoid : d.act === 'tanh' ? T.h.whyTanh : T.h.whyRelu;
  const symTex = d.act === 'sigmoid' ? '\\sigma' : d.act === 'tanh' ? '\\tanh' : '\\mathrm{ReLU}';
  const vars = { j: J, z: tx(z), negz: tx(-z), twoz: tx(2 * z), ans: tx(d.h[j]), sym: symTex, deftex: A.tex };
  return {
    id, kind: 'number', answer: d.h[j], tol,
    concept: A.concept, src: A.src, uses: [],
    prompt: fill(T.h.prompt, vars),
    sub: fill(curveRead ? T.h.subCurve : T.h.subExact, { tol: tol.toFixed(2), receipt: receipt(A.src) }),
    promptText: fill(T.h.promptText, { J: subDigit(J), name: A.plain, zt: fmt(z) }),
    why: fill(whyTpl, vars),
    maths: mathsLines(T.h.maths, vars),
    stage: graphStage(d, { show, target: `h${j}`, hot: [], flow: null, inset: { act: d.act, z, j } }),
    pad: pad(), padLabel: `h${subDigit(J)}`,
  };
}

function yhatItem(d, show, id) {
  const expr = `${tp(d.v[0])} \\cdot ${tp(d.h[0])} + ${tp(d.v[1])} \\cdot ${tp(d.h[1])}${ts(d.c)}`;
  const givens = `v₁ = ${fmt(d.v[0])}, h₁ = ${fmt(d.h[0])}, v₂ = ${fmt(d.v[1])}, h₂ = ${fmt(d.h[1])}, c = ${fmt(d.c)}`;
  return {
    id, kind: 'number', answer: d.yhat, tol: TUNING.tol.exact,
    concept: T.yhat.concept, src: T.yhat.src, uses: [],
    prompt: T.yhat.prompt,
    sub: fill(T.yhat.sub, { tol: TUNING.tol.exact.toFixed(2), receipt: receipt(T.yhat.src) }),
    promptText: fill(T.yhat.promptText, { givens }),
    why: fill(T.yhat.why, { expr, ans: tx(d.yhat) }),
    maths: mathsLines(T.yhat.maths, { expr }),
    stage: graphStage(d, { show, target: 'yhat', hot: ['v0', 'v1', 'c'], flow: 'fwd' }),
    pad: pad(), padLabel: 'ŷ',
  };
}

function curveItem(rand, panel, id) {
  const fn = rand.pick(CURVE_ID.options);
  const A = ACTIVATIONS[fn];
  const C = CURVE_ID[panel];
  return {
    id, kind: 'choice', answer: fn,
    choices: CURVE_ID.options.map((o) => ({ value: o, label: ACTIVATIONS[o].label })),
    concept: CURVE_ID.concept, src: A.figSrc, uses: panel === 'deriv' ? ['figure'] : [],
    prompt: C.prompt,
    sub: receipt(A.figSrc),
    promptText: C.promptText,
    why: fill(C.why, { label: A.label, curve: A.curve, deriv: A.deriv }),
    maths: CURVE_ID.options.map((o) => ({ tex: ACTIVATIONS[o].tex })),
    stage: { type: 'curve', fn, panel, title: C.title, range: CURVE_RANGE[panel] },
  };
}

/* slide 23: TeX for a·z + b */
function lin(a, b, v = 'z') {
  const head = a === 1 ? v : a === -1 ? `-${v}` : `${tx(a)}${v}`;
  return b === 0 ? head : `${head}${ts(b)}`;
}
const linText = (a, b) => lin(a, b).replace(/-/g, '−');

function collapseItems(rand, nLayers, idBase) {
  const names = nLayers === 2 ? COLLAPSE.names2 : COLLAPSE.names3;
  let layers;
  if (nLayers === 2 && rand.chance(0.3)) layers = COLLAPSE.slideExample.map((L) => ({ ...L }));
  else {
    const A = nLayers === 2 ? [-3, -2, 2, 3, 4, 5] : [-2, 2, 3];
    const B = nLayers === 2 ? [-4, -3, -2, -1, 1, 2, 3, 4] : [-3, -2, -1, 1, 2, 3];
    layers = names.map((name) => ({ name, a: rand.pick(A), b: rand.pick(B) }));
  }
  const { a, b } = compose(layers);
  const outer = layers.slice().reverse();                          // f, g, (k)
  const comp = outer.map((L) => `${L.name}(`).join('') + 'z' + ')'.repeat(outer.length);
  // nested substitution, unexpanded: f's a times (g's expression) plus f's b, …
  let subst = lin(layers[0].a, layers[0].b);
  for (let i = 1; i < layers.length; i++) subst = `${tp(layers[i].a)}(${subst})${ts(layers[i].b)}`;
  const chain = `$${comp} = ${subst} = ${lin(a, b)}$`;
  const defsTex = outer.map((L) => `${L.name}(z) = ${lin(L.a, L.b)}`).join(',\\quad ');
  const defs = outer.map((L) => `${L.name}(z) = ${linText(L.a, L.b)}`).join(', ');
  const prod = outer.map((L) => tp(L.a)).join(' \\times ');
  const calc = nLayers === 2
    ? `${tp(layers[1].a)} \\times ${tp(layers[0].b)}${ts(layers[1].b)}`
    : `${tp(layers[2].a)} \\times (${tp(layers[1].a)} \\times ${tp(layers[0].b)}${ts(layers[1].b)})${ts(layers[2].b)}`;
  const isSlide = nLayers === 2 && layers.every((L, i) => L.a === COLLAPSE.slideExample[i].a && L.b === COLLAPSE.slideExample[i].b);
  const base = {
    kind: 'number', tol: 0, concept: COLLAPSE.concept, src: COLLAPSE.src, uses: [],
    sub: fill(COLLAPSE.sub, { receipt: receipt(COLLAPSE.src) }),
    maths: mathsLines(COLLAPSE.maths, { defsTex, comp, subst }),
    pad: pad(true, false),
  };
  const stage = (ask) => ({
    type: 'collapse',
    layers: layers.map((L) => ({ name: L.name, a: L.a, b: L.b, label: `${L.name}(z) = ${linText(L.a, L.b)}` })),
    comp: comp.replace(/-/g, '−'),
    slope: ask === 'intercept' ? a : null,
    ask,
    removed: COLLAPSE.removed,
    slide: isSlide,
  });
  return [
    {
      ...base, id: `${idBase}-slope`, answer: a,
      prompt: fill(COLLAPSE.slope.prompt, { comp }),
      promptText: fill(COLLAPSE.slope.promptText, { defs, compt: comp }),
      why: fill(COLLAPSE.slope.why, { chain, prod, ans: tx(a) }),
      stage: stage('slope'), padLabel: 'slope a',
    },
    {
      ...base, id: `${idBase}-intercept`, answer: b,
      prompt: fill(COLLAPSE.intercept.prompt, { a: tx(a) }),
      promptText: fill(COLLAPSE.intercept.promptText, { defs, compt: comp }),
      why: fill(COLLAPSE.intercept.why, { chain, calc, ans: tx(b) }),
      stage: stage('intercept'), padLabel: 'intercept b',
    },
  ];
}

function level1(rand) {
  const act = rand.pick(['relu', 'sigmoid', 'tanh']);
  const d = display(makeNet(rand, act, { firstNegative: act === 'relu' ? rand.chance(0.4) : null }));
  const items = [
    zItem(d, 0, {}, 'cr1-z1'),
    hItem(d, 0, { z: [true, false] }, 'cr1-h1'),
    zItem(d, 1, { z: [true, false], h: [true, false] }, 'cr1-z2'),
    yhatItem(d, ALL, 'cr1-yhat'),
    curveItem(rand, 'act', 'cr1-curve'),
    ...collapseItems(rand, 2, 'cr1-collapse'),
  ];
  return items;
}

/* ── level 2: backprop under the fuse ─────────────────────────────────── */
const E_VALS = [-2, -1, -0.5, 0.5, 1, 2];

function withTarget(rand, net) {
  const d = display(net);
  const e = rand.pick(E_VALS);
  const y = r2(d.yhat - e);
  return { ...d, y, e: r2(d.yhat - y) };
}

function stepsChoices() {
  return STEPS.list.map((s) => ({ value: s.id, label: s.label }));
}

function whichStepItem(rand, d, id) {
  const step = rand.pick(STEPS.list);
  const flow = { forward: 'fwd', error: 'error', reverse: 'bwd', gd: 'update' }[step.id];
  const scene = STEPS.which.scene[step.id];
  const ex = backward(d, d.y);
  const update = step.id === 'gd'
    ? { all: true, eta: TUNING.eta[0], to: { v0: r2(d.v[0] - TUNING.eta[0] * ex.dv[0]), v1: r2(d.v[1] - TUNING.eta[0] * ex.dv[1]) } }
    : null;
  return {
    id, kind: 'choice', answer: step.id, choices: stepsChoices(),
    concept: STEPS.concept, src: STEPS.src, uses: [],
    prompt: STEPS.which.prompt, sub: receipt(STEPS.src),
    promptText: `${STEPS.which.promptText} ${scene}`,
    why: fill(STEPS.which.why, { scene, label: step.label, text: step.text }),
    maths: [],
    stage: graphStage(d, {
      show: step.id === 'forward' ? ALL : { ...ALL, y: true, e: step.id === 'error' || step.id === 'reverse' },
      flow, hot: step.id === 'error' ? [] : ['w00', 'w01', 'w10', 'w11', 'v0', 'v1'], update, scene,
    }),
  };
}

function orderItem(rand, d, id) {
  const answer = STEPS.list.map((s) => s.id);
  let cards = rand.shuffle(STEPS.list);
  for (let t = 0; t < 10 && cards.every((c, i) => c.id === answer[i]); t++) cards = rand.shuffle(STEPS.list);
  const labelOf = (sid) => STEPS.list.find((s) => s.id === sid)?.label ?? String(sid);
  return {
    id, kind: 'custom', input: 'order', answer,
    check: (g) => Array.isArray(g) && g.length === answer.length && g.every((v, i) => v === answer[i]),
    format: (v) => (Array.isArray(v) && v.length ? v.map(labelOf).join(' → ') : '—'),
    concept: STEPS.concept, src: STEPS.src, uses: [],
    prompt: STEPS.order.prompt, sub: receipt(STEPS.src),
    promptText: STEPS.order.promptText,
    why: STEPS.order.why,
    maths: [],
    stage: { ...graphStage(d, { show: ALL, dim: true }), cards: cards.map((c) => ({ id: c.id, label: c.label, text: c.text })) },
  };
}

function level2(rand) {
  const d = withTarget(rand, makeNet(rand, 'sigmoid'));
  const k = rand.int(0, 1);
  const i = rand.int(0, 1);
  const K = k + 1;
  const I = i + 1;
  const sK = subDigit(K);
  const sI = subDigit(I);
  // every answer from the numbers on show
  const dv = r2(d.e * d.h[k]);
  const ds = r2(d.h[k] * (1 - d.h[k]));
  const dz = r2(d.e * d.v[k] * ds);
  const dw = r2(dz * d.x[i]);
  const eta = rand.pick(TUNING.eta);
  const onV = rand.chance(0.5);
  const fwdShow = { ...ALL, y: true };
  const L = {
    e: { key: 'e', label: 'ŷ − y', value: d.e },
    dv: { key: `dv${k}`, label: `∂ℒ/∂v${sK}`, value: dv },
    ds: { key: `ds${k}`, label: `σ′(z${sK})`, value: ds },
    dz: { key: `dz${k}`, label: `∂ℒ/∂z${sK}`, value: dz },
    dw: { key: `dw${i}${k}`, label: `∂ℒ/∂w${sI},${sK}`, value: dw },
  };
  const led = (keys, target) => keys.map((kk) => (kk === target ? { ...L[kk], value: null, target: true } : L[kk]));
  const tol = TUNING.tol.product;
  const subP = (tpl, src) => fill(tpl, { tol: tol.toFixed(2), receipt: receipt(src) });
  const vars = {
    k: K, i: I, K: sK, I: sI,
    yhat: tx(d.yhat), yp: tp(d.y), y: fmt(d.y),
    e: fmt(d.e), ep: tp(d.e), h: tx(d.h[k]), hp: tp(d.h[k]), omh: tx(1 - d.h[k]),
    v: fmt(d.v[k]), vp: tp(d.v[k]), d: fmt(ds), dp: tp(ds), g: fmt(dz), gp: tp(dz), x: fmt(d.x[i]), xp: tp(d.x[i]),
  };

  const items = [
    whichStepItem(rand, d, 'cr2-which'),
    orderItem(rand, d, 'cr2-order'),
    {
      id: 'cr2-error', kind: 'number', answer: d.e, tol: TUNING.tol.exact,
      concept: T.error.concept, src: T.error.src, uses: ['dloss'],
      prompt: T.error.prompt, sub: fill(T.error.sub, { receipt: receipt(T.error.src) }),
      promptText: fill(T.error.promptText, { yhat: fmt(d.yhat), y: fmt(d.y) }),
      why: fill(T.error.why, { ...vars, ans: tx(d.e) }),
      maths: mathsLines(T.error.maths, vars),
      stage: graphStage(d, { show: fwdShow, target: 'e', flow: 'error', ledger: led(['e'], 'e') }),
      pad: pad(), padLabel: 'ŷ − y',
    },
    {
      id: 'cr2-dv', kind: 'number', answer: dv, tol,
      concept: T.dv.concept, src: T.dv.src, uses: ['dloss'],
      prompt: fill(T.dv.prompt, vars), sub: subP(T.dv.sub, T.dv.src),
      promptText: fill(T.dv.promptText, { K: sK, e: fmt(d.e), h: fmt(d.h[k]) }),
      why: fill(T.dv.why, { ...vars, ans: tx(dv) }),
      maths: mathsLines(T.dv.maths, vars),
      stage: graphStage(d, { show: { ...fwdShow, e: true }, target: `dv${k}`, hot: [`v${k}`], flow: 'bwd', ledger: led(['e', 'dv'], 'dv') }),
      pad: pad(), padLabel: `∂ℒ/∂v${sK}`,
    },
    {
      id: 'cr2-dsig', kind: 'number', answer: ds, tol,
      concept: T.dsig.concept, src: T.dsig.src, uses: ['dsigmoid'],
      prompt: fill(T.dsig.prompt, vars), sub: subP(T.dsig.sub, T.dsig.src),
      promptText: fill(T.dsig.promptText, { K: sK, h: fmt(d.h[k]) }),
      why: fill(T.dsig.why, { ...vars, ans: tx(ds) }),
      maths: mathsLines(T.dsig.maths, vars),
      stage: graphStage(d, { show: { ...fwdShow, e: true }, target: `ds${k}`, flow: null, ledger: led(['e', 'dv', 'ds'], 'ds'), inset: { act: 'sigmoid', z: d.z[k], deriv: true, j: k } }),
      pad: pad(), padLabel: `σ′(z${sK})`,
    },
    {
      id: 'cr2-dz', kind: 'number', answer: dz, tol,
      concept: T.dz.concept, src: T.dz.src, beyond: true, note: T.dz.note, uses: ['chain', 'dsigmoid'],
      prompt: fill(T.dz.prompt, vars), sub: subP(T.dz.sub, T.dz.src),
      promptText: fill(T.dz.promptText, { K: sK, e: fmt(d.e), v: fmt(d.v[k]), d: fmt(ds) }),
      why: fill(T.dz.why, { ...vars, ans: tx(dz) }),
      maths: mathsLines(T.dz.maths, vars),
      stage: graphStage(d, { show: { ...fwdShow, e: true }, target: `dz${k}`, hot: [`v${k}`], flow: 'bwd', ledger: led(['e', 'dv', 'ds', 'dz'], 'dz') }),
      pad: pad(), padLabel: `∂ℒ/∂z${sK}`,
    },
    {
      id: 'cr2-dw', kind: 'number', answer: dw, tol,
      concept: T.dw.concept, src: T.dw.src, beyond: true, note: T.dw.note, uses: ['chain'],
      prompt: fill(T.dw.prompt, vars), sub: subP(T.dw.sub, T.dw.src),
      promptText: fill(T.dw.promptText, { I: sI, K: sK, g: fmt(dz), x: fmt(d.x[i]) }),
      why: fill(T.dw.why, { ...vars, ans: tx(dw) }),
      maths: mathsLines(T.dw.maths, vars),
      stage: graphStage(d, { show: { ...fwdShow, e: true }, target: `dw${i}${k}`, hot: [`w${i}${k}`], flow: 'bwd', ledger: led(['e', 'dv', 'ds', 'dz', 'dw'], 'dw') }),
      pad: pad(), padLabel: `∂ℒ/∂w${sI},${sK}`,
    },
  ];
  // slide 11's Gradient Descent step on v_k or w_{i,k}, with its gradient from above
  const p = onV ? { tex: `v_${K}`, text: `v${sK}`, w: d.v[k], g: dv, key: `v${k}` } : { tex: `w_{${I},${K}}`, text: `w${sI},${sK}`, w: d.W[i][k], g: dw, key: `w${i}${k}` };
  const next = r2(p.w - eta * p.g);
  const uv = { p: p.tex, eta: tx(eta), w: tx(p.w), gp: tp(p.g) };
  items.push({
    id: 'cr2-update', kind: 'number', answer: next, tol,
    concept: T.update.concept, src: T.update.src, uses: ['gdstep'],
    prompt: fill(T.update.prompt, uv), sub: subP(T.update.sub, T.update.src),
    promptText: fill(T.update.promptText, { pt: p.text, w: fmt(p.w), g: fmt(p.g), eta: fmt(eta) }),
    why: fill(T.update.why, { ...uv, ans: tx(next) }),
    maths: mathsLines(T.update.maths, uv),
    stage: graphStage(d, { show: { ...fwdShow, e: true }, target: 'update', hot: [p.key], flow: 'update', ledger: led(['e', 'dv', 'ds', 'dz', 'dw'], null), update: { key: p.key, eta, grad: p.g, from: p.w, label: p.text } }),
    pad: pad(), padLabel: `new ${p.text}`,
  });
  return items;
}

/* ── level 3: task cards, the derivative panel, deeper collapse ───────── */
const actLabel = (id) => HEAD.acts.find((a) => a.id === id)?.label ?? String(id ?? '—');
const lossLabel = (id) => HEAD.losses.find((a) => a.id === id)?.label ?? String(id ?? '—');

function cardItem(rand, task, id) {
  const k = task.neurons === 'k' ? rand.pick(task.ks) : task.neurons;
  const answer = { neurons: k, act: task.act[0], loss: task.loss[0] };
  const accept = { act: task.act.slice(), loss: task.loss.slice() };
  const text = fill(task.text, { k });
  return {
    id, kind: 'custom', input: 'head', answer, accept,
    check: (g) => !!g && g.neurons === k && accept.act.includes(g.act) && accept.loss.includes(g.loss),
    format: (v) => (v === answer
      ? `${k} · ${accept.act.map(actLabel).join(' or ')} · ${accept.loss.map(lossLabel).join(' or ')}`
      : `${v?.neurons ?? '—'} · ${actLabel(v?.act)} · ${lossLabel(v?.loss)}`),
    concept: task.concept, src: task.src, uses: [],
    prompt: HEAD.prompt, sub: fill(HEAD.sub, { receipt: receipt(task.src) }),
    promptText: fill(HEAD.promptText, { kicker: task.kicker, text }),
    why: fill(task.why, { k }),
    maths: [],
    stage: { type: 'card', kicker: task.kicker, text, task: task.id },
    head: { neurons: HEAD.neurons, acts: HEAD.acts, losses: HEAD.losses, rows: HEAD.rows },
  };
}

function dzOtherItem(rand, id) {
  const act = rand.pick(['tanh', 'relu']);
  const d = withTarget(rand, makeNet(rand, act, { firstNegative: act === 'relu' ? rand.chance(0.4) : null }));
  const k = rand.int(0, 1);
  const K = k + 1;
  const sK = subDigit(K);
  const C = T.dzOther[act];
  const deriv = act === 'relu' ? dRelu(d.z[k]) : r2(1 - d.h[k] ** 2);
  // tanh: graded from the exact z (on show); ±TUNING.tol.tanh also accepts working from the 2-decimal h
  const ansH = r2(d.e * d.v[k] * (1 - d.h[k] ** 2));
  const ans = act === 'relu' ? r2(d.e * d.v[k] * deriv) : r2(d.e * d.v[k] * (1 - tanh(d.z[k]) ** 2));
  const tol = act === 'relu' ? TUNING.tol.product : TUNING.tol.tanh;
  const vars = { k: K, K: sK, e: fmt(d.e), ep: tp(d.e), v: fmt(d.v[k]), vp: tp(d.v[k]), h: fmt(d.h[k]), hp: tp(d.h[k]), z: tx(d.z[k]), zt: fmt(d.z[k]), d: String(deriv), ansh: tx(ansH), tol: tol.toFixed(2) };
  return {
    id, kind: 'number', answer: ans, tol,
    concept: T.dzOther.concept, src: T.dzOther.src, beyond: true, note: C.note, uses: ['chain', act === 'relu' ? 'drelu' : 'dtanh'],
    prompt: fill(C.prompt, vars), sub: fill(T.dzOther.sub, { tol: tol.toFixed(2), receipt: receipt(T.dzOther.src) }),
    promptText: fill(C.promptText, vars),
    why: fill(C.why, { ...vars, ans: tx(ans) }),
    maths: mathsLines(C.maths, vars),
    stage: graphStage(d, { show: { ...ALL, y: true, e: true }, target: `dz${k}`, hot: [`v${k}`], flow: 'bwd', ledger: [{ key: 'e', label: 'ŷ − y', value: d.e }, { key: `dz${k}`, label: `∂ℒ/∂z${sK}`, value: null, target: true }] }),
    pad: pad(), padLabel: `∂ℒ/∂z${sK}`,
  };
}

function level3(rand) {
  const regs = rand.shuffle(TASKS.filter((t) => t.type === 'regression')).slice(0, 2);
  const cls = rand.shuffle(TASKS.filter((t) => t.type !== 'regression')).slice(0, 2);
  const [c1, c2, c3, c4] = [regs[0], cls[0], regs[1], cls[1]].map((t, n) => cardItem(rand, t, `cr3-card${n + 1}`));
  return [
    c1,
    c2,
    curveItem(rand, 'deriv', 'cr3-curve'),
    ...collapseItems(rand, 3, 'cr3-collapse'),
    c3,
    dzOtherItem(rand, 'cr3-dz'),
    c4,
  ];
}

export function makeItems(rand, level = 1) {
  if (level <= 1) return level1(rand);
  if (level === 2) return level2(rand).map((it) => ({ ...it, fuse: true }));
  return level3(rand);
}

// level 2's per-item fuse (ms), from the round clock
export function fuseMs(durationMs) {
  const F = TUNING.fuse;
  if (!durationMs) return F.untimedMs;
  return Math.max(F.minMs, Math.min(F.maxMs, durationMs * F.share));
}

export { ACTIVATIONS, STEPS, TUNING };
